import { NextResponse } from "next/server";
import { actionError, actionSuccess } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { parseJson } from "@/lib/request";
import { getActiveSession } from "@/lib/session";
import { pushSubscriptionSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to enable push notifications."),
      { status: 401 },
    );

  const limit = await checkRateLimit(
    `push-subscription:${session.user.id}`,
    30,
    5 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);

  const parsed = pushSubscriptionSchema.safeParse(await parseJson(request));
  if (!parsed.success)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "Browser push subscription is invalid."),
      { status: 400 },
    );

  const subscription = await prisma.pushSubscription.upsert({
    where: { endpoint: parsed.data.endpoint },
    create: {
      userId: session.user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      userAgent: request.headers.get("user-agent")?.slice(0, 300),
    },
    update: {
      userId: session.user.id,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      userAgent: request.headers.get("user-agent")?.slice(0, 300),
    },
  });

  return NextResponse.json(
    actionSuccess({ endpoint: subscription.endpoint, enabled: true }),
  );
}

export async function DELETE(request: Request) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to disable push notifications."),
      { status: 401 },
    );

  const limit = await checkRateLimit(
    `push-subscription:${session.user.id}`,
    30,
    5 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);

  const parsed = zEndpoint.safeParse(await parseJson(request));
  if (!parsed.success)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "Choose a push subscription to remove."),
      { status: 400 },
    );

  await prisma.pushSubscription.deleteMany({
    where: { userId: session.user.id, endpoint: parsed.data.endpoint },
  });

  return NextResponse.json(
    actionSuccess({ endpoint: parsed.data.endpoint, enabled: false }),
  );
}

const zEndpoint = pushSubscriptionSchema.pick({ endpoint: true });
