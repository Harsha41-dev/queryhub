import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import { env } from "@/lib/env";
import { captureException } from "@/lib/monitoring";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/provider";
import {
  emailChangeEmail,
  passwordResetEmail,
  securityNotificationEmail,
  verificationEmail,
} from "@/lib/email/templates";

const MINUTE = 60_000;
// same generic message for invalid/expired tokens (don't leak which case it is)
const genericTokenError = new Error("The link is invalid or has expired.");

// store only the hash of email tokens in the database
export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function newToken() {
  return randomBytes(32).toString("base64url");
}

// only allow redirects back to our own site
export function safeRedirectPath(value: string | null, fallback = "/login") {
  if (!value || !value.startsWith("/") || value.startsWith("//"))
    return fallback;
  try {
    const parsed = new URL(value, env.APP_URL);
    return parsed.origin === new URL(env.APP_URL).origin
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}

function applicationUrl(path: string, token: string) {
  const url = new URL(path, env.APP_URL);
  url.searchParams.set("token", token);
  return url.toString();
}

export async function issueEmailVerification(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null, emailVerified: null },
    select: { id: true, email: true, name: true },
  });
  if (!user) return;
  const token = newToken();
  await prisma.$transaction([
    prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } }),
    prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: tokenHash(token),
        expiresAt: new Date(Date.now() + 24 * 60 * MINUTE),
      },
    }),
  ]);
  await sendEmail(
    verificationEmail({
      to: user.email,
      name: user.name,
      url: applicationUrl("/api/auth/verify-email", token),
    }),
  );
}

export async function consumeEmailVerification(token: string) {
  const record = await prisma.emailVerificationToken.findFirst({
    where: {
      tokenHash: tokenHash(token),
      usedAt: null,
      expiresAt: { gt: new Date() },
      user: { deletedAt: null },
    },
  });
  if (!record) throw genericTokenError;
  await prisma.$transaction(async (transaction) => {
    const claimed = await transaction.emailVerificationToken.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) throw genericTokenError;
    await transaction.user.update({
      where: { id: record.userId },
      data: { emailVerified: new Date() },
    });
  });
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null, suspendedAt: null },
    select: { id: true, email: true, name: true },
  });
  if (!user) return;
  const token = newToken();
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: tokenHash(token),
        expiresAt: new Date(Date.now() + 30 * MINUTE),
      },
    }),
  ]);
  await sendEmail(
    passwordResetEmail({
      to: user.email,
      name: user.name,
      url: applicationUrl("/reset-password", token),
    }),
  );
}

export async function consumePasswordReset(token: string, password: string) {
  const record = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash: tokenHash(token),
      usedAt: null,
      expiresAt: { gt: new Date() },
      user: { deletedAt: null, suspendedAt: null },
    },
    include: { user: { select: { email: true, name: true } } },
  });
  if (!record) throw genericTokenError;
  const passwordHash = await hash(password, 12);
  await prisma.$transaction(
    async (transaction) => {
      const claimed = await transaction.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) throw genericTokenError;
      await transaction.user.update({
        where: { id: record.userId },
        data: { passwordHash, sessionVersion: { increment: 1 } },
      });
      await transaction.passwordResetToken.deleteMany({
        where: { userId: record.userId, id: { not: record.id } },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  void sendEmail(
    securityNotificationEmail({
      to: record.user.email,
      name: record.user.name,
      event: "Your QueryHub password was reset successfully.",
    }),
  ).catch((error) =>
    captureException(error, { operation: "email.password_reset_notice" }),
  );
}

export async function issueEmailChange(userId: string, newEmail: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null, suspendedAt: null },
    select: { id: true, name: true },
  });
  if (!user) throw genericTokenError;
  const token = newToken();
  await prisma.$transaction([
    prisma.emailChangeToken.deleteMany({ where: { userId: user.id } }),
    prisma.emailChangeToken.create({
      data: {
        userId: user.id,
        newEmail,
        tokenHash: tokenHash(token),
        expiresAt: new Date(Date.now() + 60 * MINUTE),
      },
    }),
  ]);
  await sendEmail(
    emailChangeEmail({
      to: newEmail,
      name: user.name,
      url: applicationUrl("/api/auth/confirm-email-change", token),
    }),
  );
}

export async function consumeEmailChange(token: string) {
  const record = await prisma.emailChangeToken.findFirst({
    where: {
      tokenHash: tokenHash(token),
      usedAt: null,
      expiresAt: { gt: new Date() },
      user: { deletedAt: null, suspendedAt: null },
    },
    include: { user: { select: { email: true, name: true } } },
  });
  if (!record) throw genericTokenError;
  try {
    await prisma.$transaction(
      async (transaction) => {
        const claimed = await transaction.emailChangeToken.updateMany({
          where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
          data: { usedAt: new Date() },
        });
        if (claimed.count !== 1) throw genericTokenError;
        await transaction.user.update({
          where: { id: record.userId },
          data: {
            email: record.newEmail,
            emailVerified: new Date(),
            sessionVersion: { increment: 1 },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw genericTokenError;
    throw error;
  }
  void sendEmail(
    securityNotificationEmail({
      to: record.user.email,
      name: record.user.name,
      event: `Your QueryHub sign-in email was changed to ${record.newEmail}.`,
    }),
  ).catch((error) =>
    captureException(error, { operation: "email.change_notice" }),
  );
}
