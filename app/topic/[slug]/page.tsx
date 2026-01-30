// topic landing page

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { TopicView } from "@/components/topic/topic-view";
import { getTopicView } from "@/lib/query-data";
import { seoDescription } from "@/lib/seo";
import { getActiveSession } from "@/lib/session";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const view = await getTopicView(slug);
  const description = seoDescription(
    view?.topic.description,
    "Explore questions and answers on QueryHub.",
  );
  return {
    title: view?.topic.name ?? "Topic",
    description,
    alternates: view ? { canonical: `/topic/${view.topic.slug}` } : undefined,
    openGraph: view
      ? {
          title: `${view.topic.name} | QueryHub`,
          description,
          url: `/topic/${view.topic.slug}`,
          images: [
            {
              url: `/og/topic/${view.topic.slug}`,
              width: 1200,
              height: 630,
              alt: `${view.topic.name} on QueryHub`,
            },
          ],
        }
      : undefined,
    twitter: view
      ? {
          card: "summary_large_image",
          title: `${view.topic.name} | QueryHub`,
          description,
          images: [`/og/topic/${view.topic.slug}`],
        }
      : undefined,
  };
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
