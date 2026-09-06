// answer credentials settings

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CredentialForm } from "@/components/settings/credential-form";
import { getUserCredentials } from "@/lib/query-data";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/session";

export const metadata: Metadata = { title: "Credentials" };

export default async function CredentialSettingsPage() {
  const session = await getActiveSession();
  if (!session?.user) redirect("/login?callbackUrl=/settings/credentials");
  const [credentials, topics] = await Promise.all([
    getUserCredentials(session.user.id),
    prisma.topic.findMany({
      where: { deletedAt: null },
      orderBy: [{ followerCount: "desc" }, { name: "asc" }],
      take: 80,
    }),
  ]);
  return (
    <CredentialForm
      initialCredentials={credentials}
      topics={topics.map((topic) => ({
        id: topic.id,
        slug: topic.slug,
        name: topic.name,
        description: topic.description,
        followers: topic.followerCount,
        questions: topic.questionCount,
        accent: topic.color ?? "#4f46e5",
        icon: topic.name
          .split(/\s+/)
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
      }))}
    />
  );
}
