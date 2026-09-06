// admin dashboard stats

import type { Metadata } from "next";
import { Prisma } from "@prisma/client";
import { AdminDashboard } from "@/components/admin/dashboard";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Admin dashboard" };

export default async function AdminPage() {
  const [
    users,
    activeUsers,
    newUserRows,
    questions,
    answeredQuestions,
    answers,
    openReports,
    votes,
    bookmarks,
    topics,
    actions,
    moderationActionCount,
    notificationDeliveries,
    failedNotificationDeliveries,
    recentQuestions,
    recentAnswers,
    recentEngagement,
  ] = await prisma.$transaction([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null, suspendedAt: null } }),
    prisma.$queryRaw<Array<{ count: bigint }>>(
      Prisma.sql`SELECT COUNT(*)::bigint AS count FROM "User" WHERE "deletedAt" IS NULL AND "createdAt" >= NOW() - INTERVAL '30 days'`,
    ),
    prisma.question.count({ where: { deletedAt: null } }),
    prisma.question.count({
      where: {
        deletedAt: null,
        answers: { some: { deletedAt: null, isHidden: false } },
      },
    }),
    prisma.answer.count({ where: { deletedAt: null } }),
    prisma.report.count({
      where: { status: { in: ["PENDING", "REVIEWING"] } },
    }),
    prisma.vote.count(),
    prisma.bookmark.count(),
    prisma.topic.findMany({
      where: { deletedAt: null },
      orderBy: { questionCount: "desc" },
      take: 5,
    }),
    prisma.moderationAction.findMany({
      include: { moderator: { select: { name: true, image: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.moderationAction.count(),
    prisma.notificationDelivery.count({
      where: { createdAt: { gte: recentWindow() } },
    }),
    prisma.notificationDelivery.count({
      where: {
        status: "FAILED",
        createdAt: { gte: recentWindow() },
      },
    }),
    prisma.question.count({
      where: { deletedAt: null, createdAt: { gte: recentWindow() } },
    }),
    prisma.answer.count({
      where: { deletedAt: null, createdAt: { gte: recentWindow() } },
    }),
    prisma.vote.count({ where: { createdAt: { gte: recentWindow() } } }),
  ]);
  const newUsers = Number(newUserRows[0]?.count ?? 0);
  const answerRate = questions
    ? Math.round((answeredQuestions / questions) * 100)
    : 0;
  return (
    <AdminDashboard
      stats={[
        { label: "Total users", value: users, icon: "users" },
        { label: "Active users", value: activeUsers, icon: "users" },
        { label: "New registrations (30d)", value: newUsers, icon: "users" },
        { label: "Questions created", value: questions, icon: "questions" },
        { label: "Answers created", value: answers, icon: "answers" },
        { label: "Reports pending", value: openReports, icon: "reports" },
        {
          label: "Content engagement",
          value: votes + bookmarks,
          icon: "questions",
        },
        {
          label: "Notification deliveries (7d)",
          value: notificationDeliveries,
          icon: "reports",
        },
      ]}
      topics={topics}
      actions={actions.map((action) => ({
        id: action.id,
        label: action.action.replaceAll("_", " ").toLowerCase(),
        moderator: action.moderator,
        createdAt: action.createdAt.toISOString(),
      }))}
      health={[
        {
          label: "Answer rate",
          value: `${answerRate}%`,
          status: answerRate > 50 ? "Healthy" : "Watch",
        },
        {
          label: "Open reports",
          value: String(openReports),
          status: openReports < 10 ? "Stable" : "Watch",
        },
        {
          label: "Content volume",
          value: String(questions + answers),
          status: "Healthy",
        },
        {
          label: "Moderation actions",
          value: String(moderationActionCount),
          status: "Stable",
        },
        {
          label: "Delivery failures (7d)",
          value: String(failedNotificationDeliveries),
          status: failedNotificationDeliveries === 0 ? "Stable" : "Watch",
        },
        {
          label: "New content (7d)",
          value: String(recentQuestions + recentAnswers),
          status: recentQuestions + recentAnswers > 0 ? "Healthy" : "Watch",
        },
        {
          label: "Votes (7d)",
          value: String(recentEngagement),
          status: recentEngagement > 0 ? "Healthy" : "Watch",
        },
      ]}
    />
  );
}

function recentWindow(days = 7) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}
