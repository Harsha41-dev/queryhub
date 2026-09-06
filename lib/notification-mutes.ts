import "server-only";

import type { Prisma } from "@prisma/client";

type NotificationMuteClient = Pick<
  Prisma.TransactionClient,
  "notificationMute"
>;

type NotificationMuteScope = {
  actorId?: string | null;
  topicIds?: string[];
};

function muteClauses(scope: NotificationMuteScope) {
  const topicIds = Array.from(new Set(scope.topicIds ?? [])).filter(Boolean);
  const clauses: Prisma.NotificationMuteWhereInput[] = [];

  if (scope.actorId)
    clauses.push({ targetType: "USER", targetId: scope.actorId });
  if (topicIds.length)
    clauses.push({ targetType: "TOPIC", targetId: { in: topicIds } });

  return clauses;
}

export async function isNotificationMuted(
  client: NotificationMuteClient,
  recipientId: string,
  scope: NotificationMuteScope,
) {
  const clauses = muteClauses(scope);
  if (!clauses.length) return false;

  const mute = await client.notificationMute.findFirst({
    where: { userId: recipientId, OR: clauses },
    select: { id: true },
  });
  return Boolean(mute);
}

export async function filterNotificationRecipients(
  client: NotificationMuteClient,
  recipientIds: string[],
  scope: NotificationMuteScope,
) {
  const uniqueRecipients = Array.from(new Set(recipientIds)).filter(Boolean);
  const clauses = muteClauses(scope);
  if (!uniqueRecipients.length || !clauses.length) return uniqueRecipients;

  const mutes = await client.notificationMute.findMany({
    where: { userId: { in: uniqueRecipients }, OR: clauses },
    select: { userId: true },
  });
  const mutedUsers = new Set(mutes.map((mute) => mute.userId));
  return uniqueRecipients.filter((recipientId) => !mutedUsers.has(recipientId));
}
