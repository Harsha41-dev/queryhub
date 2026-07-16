import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { actionError, actionSuccess } from "@/lib/errors";
import { issueEmailVerification } from "@/lib/email/tokens";
import { logger } from "@/lib/logger";
import { captureException } from "@/lib/monitoring";
import { prisma } from "@/lib/prisma";
import {
  checkRateLimit,
  clientRateLimitKey,
  rateLimitResponse,
} from "@/lib/rate-limit";
import { parseJson } from "@/lib/request";
import { registerSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const limit = await checkRateLimit(
    `register:${clientRateLimitKey(request)}`,
    5,
    15 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);
  const parsed = registerSchema.safeParse(await parseJson(request));
  if (!parsed.success)
    return NextResponse.json(
      actionError(
        "VALIDATION_ERROR",
        "Check the highlighted fields.",
        parsed.error.flatten().fieldErrors,
      ),
      { status: 400 },
    );
  try {
    const passwordHash = await hash(parsed.data.password, 12);
    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        username: parsed.data.username,
        email: parsed.data.email,
        passwordHash,
        preference: { create: {} },
      },
      select: { id: true, name: true, username: true, email: true },
    });
    logger.info("user.registered", { userId: user.id });
    try {
      await issueEmailVerification(user.id);
    } catch (error) {
      await captureException(error, {
        operation: "email.registration_verification",
        requestId: request.headers.get("x-request-id") ?? undefined,
        userId: user.id,
      });
    }
    return NextResponse.json(actionSuccess(user), { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return NextResponse.json(
        actionError(
          "ALREADY_EXISTS",
          "That email or username is already in use.",
        ),
        { status: 409 },
      );
    logger.error("user.registration_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      actionError("INTERNAL_ERROR", "We couldn’t create your account."),
      { status: 500 },
    );
  }
}
