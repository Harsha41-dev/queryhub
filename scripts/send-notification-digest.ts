import "dotenv/config";

import {
  NotificationDeliveryChannel,
  NotificationDeliveryStatus,
  PrismaClient,
} from "@prisma/client";
import { weeklyDigestEmail } from "../lib/email/templates";

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

const prisma = new PrismaClient();
const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);
const lookbackDays = Math.max(
  1,
  Number.parseInt(process.env.DIGEST_LOOKBACK_DAYS ?? "7", 10) || 7,
);
const maxItems = Math.max(
  1,
  Number.parseInt(process.env.DIGEST_MAX_ITEMS ?? "10", 10) || 10,
);

async function sendEmail(message: EmailMessage) {
  if ((process.env.EMAIL_PROVIDER ?? "log") !== "resend") {
    console.info("email.development", message);
    return;
  }
  if (!process.env.RESEND_API_KEY)
    throw new Error("RESEND_API_KEY is required for digest delivery");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      reply_to: process.env.EMAIL_REPLY_TO || undefined,
      ...message,
    }),
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok)
    throw new Error(`Digest email failed with status ${response.status}`);
}

function notificationHref(notification: {
  question?: { slug: string } | null;
}) {
  return notification.question
    ? `/question/${notification.question.slug}`
    : "/notifications";
}

async function main() {
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      suspendedAt: null,
      emailVerified: { not: null },
      OR: [
        { preference: { is: null } },
        { preference: { is: { emailDigest: true } } },
      ],
    },
    select: {
      id: true,
      email: true,
      name: true,
      notifications: {
        where: {
          createdAt: { gte: since },
          deliveries: {
            none: {
              channel: NotificationDeliveryChannel.DIGEST,
              status: NotificationDeliveryStatus.SENT,
            },
          },
        },
        include: {
          actor: { select: { name: true } },
          question: { select: { slug: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: maxItems,
      },
    },
    take: Number.parseInt(process.env.DIGEST_USER_BATCH_SIZE ?? "200", 10),
  });

  let attempted = 0;
  let sent = 0;
  let failed = 0;

  for (const user of users) {
    if (!user.notifications.length) continue;
    attempted += 1;
    const message = weeklyDigestEmail({
      to: user.email,
      name: user.name,
      url: appUrl,
      items: user.notifications.map((notification) => ({
        message: notification.message,
        detail: notification.question?.title ?? "Account activity",
        href: notificationHref(notification),
      })),
    });

    try {
      await sendEmail(message);
      sent += 1;
      await prisma.notificationDelivery.createMany({
        data: user.notifications.map((notification) => ({
          notificationId: notification.id,
          channel: NotificationDeliveryChannel.DIGEST,
          status: NotificationDeliveryStatus.SENT,
          sentAt: new Date(),
        })),
      });
    } catch (error) {
      failed += 1;
      const message =
        error instanceof Error ? error.message.slice(0, 500) : "unknown";
      await prisma.notificationDelivery.createMany({
        data: user.notifications.map((notification) => ({
          notificationId: notification.id,
          channel: NotificationDeliveryChannel.DIGEST,
          status: NotificationDeliveryStatus.FAILED,
          error: message,
        })),
      });
    }
  }

  console.info(
    JSON.stringify(
      { job: "notification-digest", attempted, sent, failed },
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
