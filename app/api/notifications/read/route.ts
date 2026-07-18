import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveSession } from "@/lib/session";
import { actionError, actionSuccess } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { parseJson } from "@/lib/request";

const schema = z
  .object({ id: z.string().cuid().optional(), all: z.boolean().optional() })
  .refine((data) => data.id || data.all);
export async function PATCH(request: Request) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to manage notifications."),
      { status: 401 },
    );
  const limit = await checkRateLimit(
    `notification-read:${session.user.id}`,
    120,
    5 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);
  const parsed = schema.safeParse(await parseJson(request));
  if (!parsed.success)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "Choose a notification."),
      { status: 400 },
    );
  const result = await prisma.notification.updateMany({
    where: {
      recipientId: session.user.id,
      readAt: null,
      ...(parsed.data.id ? { id: parsed.data.id } : {}),
    },
    data: { readAt: new Date() },
  });
  return NextResponse.json(actionSuccess({ updated: result.count }));
}
