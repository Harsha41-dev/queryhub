import { compare, hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { issueEmailChange } from "@/lib/email/tokens";
import { sendEmail } from "@/lib/email/provider";
import { securityNotificationEmail } from "@/lib/email/templates";
import { actionError, actionSuccess } from "@/lib/errors";
import { captureException } from "@/lib/monitoring";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { parseJson } from "@/lib/request";
import { getActiveSession } from "@/lib/session";
import { accountSchema } from "@/lib/validators";

export async function PATCH(request: Request) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to update your account."),
      { status: 401 },
    );
  const limit = await checkRateLimit(
    `account:${session.user.id}`,
    10,
    15 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);
  const parsed = accountSchema.safeParse(await parseJson(request));
  if (!parsed.success)
    return NextResponse.json(
      actionError(
        "VALIDATION_ERROR",
        "Check your account details.",
        parsed.error.flatten().fieldErrors,
      ),
      { status: 400 },
    );
  const user = await prisma.user.findFirst({
    where: { id: session.user.id, deletedAt: null, suspendedAt: null },
    select: { id: true, email: true, name: true, passwordHash: true },
  });
  if (!user || !user.passwordHash)
    return NextResponse.json(actionError("NOT_FOUND", "Account not found."), {
      status: 404,
    });
  const valid = parsed.data.currentPassword
    ? await compare(parsed.data.currentPassword, user.passwordHash)
    : false;
  if (
    (parsed.data.email ||
      parsed.data.newPassword ||
      parsed.data.deleteConfirmation) &&
    !valid
  )
    return NextResponse.json(
      actionError("INVALID_PASSWORD", "Current password is incorrect."),
      { status: 403 },
    );

  if (parsed.data.deleteConfirmation === "DELETE") {
    await prisma.user.update({
      where: { id: user.id },
      data: { deletedAt: new Date(), sessionVersion: { increment: 1 } },
    });
    void sendEmail(
      securityNotificationEmail({
        to: user.email,
        name: user.name,
        event:
          "Your QueryHub account was marked for deletion and all sessions were invalidated.",
      }),
    ).catch((error) =>
      captureException(error, { operation: "email.account_deleted" }),
    );
    return NextResponse.json(actionSuccess({ deleted: true }));
  }

  const emailChanged =
    parsed.data.email && parsed.data.email !== user.email
      ? parsed.data.email
      : undefined;
  if (emailChanged) {
    const exists = await prisma.user.findUnique({
      where: { email: emailChanged },
      select: { id: true },
    });
    if (exists)
      return NextResponse.json(
        actionError("EMAIL_TAKEN", "That email is already in use."),
        { status: 409 },
      );
    try {
      await issueEmailChange(user.id, emailChanged);
    } catch (error) {
      await captureException(error, {
        operation: "email.change_request",
        requestId: request.headers.get("x-request-id") ?? undefined,
        userId: user.id,
      });
      return NextResponse.json(
        actionError(
          "EMAIL_UNAVAILABLE",
          "The confirmation email could not be sent.",
        ),
        { status: 503 },
      );
    }
  }

  if (parsed.data.newPassword) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hash(parsed.data.newPassword, 12),
        sessionVersion: { increment: 1 },
      },
    });
    void sendEmail(
      securityNotificationEmail({
        to: user.email,
        name: user.name,
        event:
          "Your QueryHub password was changed and existing sessions were invalidated.",
      }),
    ).catch((error) =>
      captureException(error, { operation: "email.password_changed" }),
    );
  }

  if (!emailChanged && !parsed.data.newPassword)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "Choose a setting to update."),
      { status: 400 },
    );

  return NextResponse.json(
    actionSuccess({
      email: user.email,
      emailChangePending: Boolean(emailChanged),
      passwordUpdated: Boolean(parsed.data.newPassword),
    }),
  );
}
