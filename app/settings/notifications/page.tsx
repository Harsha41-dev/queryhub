// notification preference toggles

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NotificationPreferences } from "@/components/settings/notification-preferences";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/session";

export const metadata: Metadata = { title: "Notification settings" };

export default async function NotificationSettingsPage() {
  const session = await getActiveSession();
  if (!session?.user) redirect("/login?callbackUrl=/settings/notifications");
  const preference = await prisma.userPreference.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id },
    update: {},
  });
  const [followedTopics, followedPeople, mutes] = await Promise.all([
    prisma.topicFollow.findMany({
      where: { userId: session.user.id, topic: { deletedAt: null } },
      include: { topic: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.userFollow.findMany({
      where: {
        followerId: session.user.id,
        following: { deletedAt: null, suspendedAt: null },
      },
      include: {
        following: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
            occupation: true,
            bio: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.notificationMute.findMany({
      where: { userId: session.user.id },
      select: { targetType: true, targetId: true },
    }),
  ]);

  const mutedUsers = new Set(
    mutes
      .filter((mute) => mute.targetType === "USER")
      .map((mute) => mute.targetId),
  );
  const mutedTopics = new Set(
    mutes
      .filter((mute) => mute.targetType === "TOPIC")
      .map((mute) => mute.targetId),
  );
  const [mutedPeople, mutedTopicRecords] = await Promise.all([
    mutedUsers.size
      ? prisma.user.findMany({
          where: {
            id: { in: [...mutedUsers] },
            deletedAt: null,
            suspendedAt: null,
          },
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
          },
        })
      : Promise.resolve([]),
    mutedTopics.size
      ? prisma.topic.findMany({
          where: { id: { in: [...mutedTopics] }, deletedAt: null },
          select: { id: true, name: true, questionCount: true },
        })
      : Promise.resolve([]),
  ]);
  const userControls = new Map<
    string,
    {
      id: string;
      label: string;
      detail: string;
      avatar?: string | null;
      muted: boolean;
    }
  >();
  const topicControls = new Map<
    string,
    { id: string; label: string; detail: string; muted: boolean }
  >();

  for (const { following } of followedPeople)
    userControls.set(following.id, {
      id: following.id,
      label: following.name,
      detail: `@${following.username}`,
      avatar: following.image,
      muted: mutedUsers.has(following.id),
    });
  for (const user of mutedPeople)
    if (!userControls.has(user.id))
      userControls.set(user.id, {
        id: user.id,
        label: user.name,
        detail: `@${user.username}`,
        avatar: user.image,
        muted: true,
      });

  for (const { topic } of followedTopics)
    topicControls.set(topic.id, {
      id: topic.id,
      label: topic.name,
      detail: `${topic.questionCount} questions`,
      muted: mutedTopics.has(topic.id),
    });
  for (const topic of mutedTopicRecords)
    if (!topicControls.has(topic.id))
      topicControls.set(topic.id, {
        id: topic.id,
        label: topic.name,
        detail: `${topic.questionCount} questions`,
        muted: true,
      });

  return (
    <NotificationPreferences
      initial={{
        emailDigest: preference.emailDigest,
        emailAnswers: preference.emailAnswers,
        emailAnswerRequests: preference.emailAnswerRequests,
        emailAcceptedAnswers: preference.emailAcceptedAnswers,
        emailSpacePosts: preference.emailSpacePosts,
        emailComments: preference.emailComments,
        emailFollowers: preference.emailFollowers,
        pushNotifications: preference.pushNotifications,
      }}
      notificationMutes={{
        users: [...userControls.values()],
        topics: [...topicControls.values()],
      }}
    />
  );
}
