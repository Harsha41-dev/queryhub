// topic landing page

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { TopicView } from "@/components/topic/topic-view";
import { getTopicView } from "@/lib/query-data";
import { getActiveSession } from "@/lib/session";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const view = await getTopicView(slug);
  return { title: view?.topic.name ?? "Topic" };
}

export default async function TopicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getActiveSession();
  const view = await getTopicView(slug, session?.user.id);
  if (!view) notFound();
  return (
    <AppShell publicMode={!session} rightSidebar={false} wide>
      <TopicView {...view} publicMode={!session} />
    </AppShell>
  );
}
