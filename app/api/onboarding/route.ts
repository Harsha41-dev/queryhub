import { NextResponse } from "next/server";
import { trackAnalytics } from "@/lib/analytics";
import { actionError, actionSuccess } from "@/lib/errors";
import { getOnboardingOptions } from "@/lib/query-data";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { parseJson } from "@/lib/request";
import { getActiveSession } from "@/lib/session";
import { onboardingSchema } from "@/lib/validators";

export async function GET() {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to personalize your feed."),
      { status: 401 },
    );
  return NextResponse.json(
    actionSuccess(await getOnboardingOptions(session.user.id)),
  );
}

export async function PATCH(request: Request) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to personalize your feed."),
      { status: 401 },
    );

  const limit = await checkRateLimit(
    `onboarding:${session.user.id}`,
    20,
    15 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);

  const parsed = onboardingSchema.safeParse(await parseJson(request));
  if (!parsed.success)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "Choose valid topics and people."),
      { status: 400 },
    );

  await prisma.$transaction(async (tx) => {
    const topics = parsed.data.topicIds.length
      ? await tx.topic.findMany({
          where: { id: { in: parsed.data.topicIds }, deletedAt: null },
          select: { id: true },
        })
      : [];
    const people = parsed.data.userIds.length
      ? await tx.user.findMany({
          where: {
            id: { in: parsed.data.userIds, not: session.user.id },
            deletedAt: null,
            suspendedAt: null,
          },
          select: { id: true },
        })
      : [];

    const existingTopicFollows = topics.length
      ? await tx.topicFollow.findMany({
          where: {
            userId: session.user.id,
            topicId: { in: topics.map((topic) => topic.id) },
          },
          select: { topicId: true },
        })
      : [];
    const existingTopicIds = new Set(
      existingTopicFollows.map((follow) => follow.topicId),
    );
    const newTopics = topics.filter((topic) => !existingTopicIds.has(topic.id));

    if (newTopics.length)
      await tx.topicFollow.createMany({
        data: newTopics.map((topic) => ({
          userId: session.user.id,
          topicId: topic.id,
        })),
        skipDuplicates: true,
      });
    if (newTopics.length)
      await Promise.all(
        newTopics.map((topic) =>
          tx.topic.update({
            where: { id: topic.id },
            data: { followerCount: { increment: 1 } },
          }),
        ),
      );
    if (people.length)
      await tx.userFollow.createMany({
        data: people.map((person) => ({
          followerId: session.user.id,
          followingId: person.id,
        })),
        skipDuplicates: true,
      });
    await tx.user.update({
      where: { id: session.user.id },
      data: { onboardedAt: new Date() },
    });
  });

  void trackAnalytics("onboarding_completed", {
    userId: session.user.id,
    request,
    properties: {
      topicCount: parsed.data.topicIds.length,
      userCount: parsed.data.userIds.length,
    },
  });
  return NextResponse.json(actionSuccess({ onboarded: true }));
}
