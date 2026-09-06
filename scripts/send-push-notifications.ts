import "dotenv/config";

import {
  NotificationDeliveryChannel,
  NotificationDeliveryStatus,
  PrismaClient,
} from "@prisma/client";

const prisma = new PrismaClient();
const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);
const lookbackHours = Math.max(
  1,
  Number.parseInt(process.env.PUSH_LOOKBACK_HOURS ?? "48", 10) || 48,
);
const maxItems = Math.max(
  1,
  Number.parseInt(process.env.PUSH_MAX_ITEMS ?? "25", 10) || 25,
);

type PushNotification = Awaited<
  ReturnType<typeof loadPushBatch>
>[number]["notifications"][number];

function notificationHref(notification: PushNotification) {
  return notification.question
    ? `/question/${notification.question.slug}`
    : "/notifications";
}

async function postPush(input: {
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
  notification: PushNotification;
}) {
  const response = await fetch(process.env.PUSH_WEBHOOK_URL!, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(process.env.PUSH_WEBHOOK_TOKEN
        ? { authorization: `Bearer ${process.env.PUSH_WEBHOOK_TOKEN}` }
        : {}),
    },
    body: JSON.stringify({
      subscription: input.subscription,
      notification: {
        id: input.notification.id,
        type: input.notification.type,
        title: "QueryHub",
        body: input.notification.message,
        url: `${appUrl}${notificationHref(input.notification)}`,
      },
    }),
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok)
    throw new Error(`Push webhook failed with status ${response.status}`);
}

async function loadPushBatch() {
  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
  return prisma.user.findMany({
    where: {
      deletedAt: null,
      suspendedAt: null,
      pushSubscriptions: { some: {} },
      OR: [
        { preference: { is: null } },
        { preference: { is: { pushNotifications: true } } },
      ],
    },
    select: {
      id: true,
      pushSubscriptions: {
        select: { endpoint: true, p256dh: true, auth: true },
        orderBy: { updatedAt: "desc" },
        take: 5,
      },
      notifications: {
        where: {
          readAt: null,
          createdAt: { gte: since },
          deliveries: {
            none: {
              channel: NotificationDeliveryChannel.PUSH,
              status: NotificationDeliveryStatus.SENT,
            },
          },
        },
        include: {
          question: { select: { slug: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: maxItems,
      },
    },
    take: Number.parseInt(process.env.PUSH_USER_BATCH_SIZE ?? "200", 10),
  });
}

async function main() {
  if ((process.env.PUSH_PROVIDER ?? "none") !== "webhook") {
    console.info(
      JSON.stringify(
        { job: "push-notifications", skipped: true, reason: "provider-none" },
        null,
        2,
      ),
    );
    return;
  }
  if (!process.env.PUSH_WEBHOOK_URL)
    throw new Error("PUSH_WEBHOOK_URL is required when PUSH_PROVIDER=webhook");

  const users = await loadPushBatch();
  let attempted = 0;
  let sent = 0;
  let failed = 0;

  for (const user of users) {
    for (const notification of user.notifications) {
      attempted += 1;
      const errors: string[] = [];
      for (const subscription of user.pushSubscriptions) {
        try {
          await postPush({
            subscription: {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            notification,
          });
        } catch (error) {
          errors.push(error instanceof Error ? error.message : "unknown");
        }
      }

      if (errors.length < user.pushSubscriptions.length) {
        sent += 1;
        await prisma.notificationDelivery.create({
          data: {
            notificationId: notification.id,
            channel: NotificationDeliveryChannel.PUSH,
            status: NotificationDeliveryStatus.SENT,
            sentAt: new Date(),
          },
        });
      } else {
        failed += 1;
        await prisma.notificationDelivery.create({
          data: {
            notificationId: notification.id,
            channel: NotificationDeliveryChannel.PUSH,
            status: NotificationDeliveryStatus.FAILED,
            error: errors.join("; ").slice(0, 500),
          },
        });
      }
    }
  }

  console.info(
    JSON.stringify(
      { job: "push-notifications", attempted, sent, failed },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
