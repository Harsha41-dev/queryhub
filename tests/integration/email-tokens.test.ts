import { compare, hash } from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  consumeEmailChange,
  consumePasswordReset,
  tokenHash,
} from "@/lib/email/tokens";

const enabled = process.env.RUN_DATABASE_TESTS === "1";
const prisma = new PrismaClient();
const marker = `email-token-${Date.now()}`;
let userId = "";

describe.skipIf(!enabled)("single-use email tokens", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        name: "Email Token Test",
        username: marker,
        email: `${marker}@example.com`,
        passwordHash: await hash("Original123", 12),
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("consumes password resets once and invalidates existing sessions", async () => {
    const raw = `password-${marker}`;
    await prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash: tokenHash(raw),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await consumePasswordReset(raw, "Updated123");
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(await compare("Updated123", user.passwordHash!)).toBe(true);
    expect(user.sessionVersion).toBe(1);
    await expect(consumePasswordReset(raw, "Again123")).rejects.toThrow(
      "invalid or has expired",
    );
  });

  it("verifies a pending email change once and increments the session version", async () => {
    const raw = `email-${marker}`;
    const newEmail = `${marker}.changed@example.com`;
    await prisma.emailChangeToken.create({
      data: {
        userId,
        newEmail,
        tokenHash: tokenHash(raw),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await consumeEmailChange(raw);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.email).toBe(newEmail);
    expect(user.emailVerified).not.toBeNull();
    expect(user.sessionVersion).toBe(2);
    await expect(consumeEmailChange(raw)).rejects.toThrow(
      "invalid or has expired",
    );
  });
});
