// individual Space page

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { SpaceView } from "@/components/spaces/space-view";
import { getSpaceView } from "@/lib/query-data";
import { appBaseUrl, seoDescription } from "@/lib/seo";
import { getActiveSession } from "@/lib/session";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const view = await getSpaceView(slug);
  const baseUrl = appBaseUrl();
  return {
    title: view?.space.name ?? "Space",
    description: seoDescription(
      view?.space.description,
      "A focused QueryHub community for curated questions and answers.",
    ),
    alternates: view
      ? { canonical: `${baseUrl}/spaces/${view.space.slug}` }
      : undefined,
    openGraph: view
      ? {
          title: `${view.space.name} | QueryHub`,
          description: seoDescription(
            view.space.description,
            "A focused QueryHub community for curated questions and answers.",
          ),
          url: `${baseUrl}/spaces/${view.space.slug}`,
        }
      : undefined,
    twitter: view
      ? {
          card: "summary",
          title: `${view.space.name} | QueryHub`,
          description: seoDescription(
            view.space.description,
            "A focused QueryHub community for curated questions and answers.",
          ),
        }
      : undefined,
  };
}

export default async function SpacePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await getActiveSession();
  const { slug } = await params;
  const view = await getSpaceView(slug, session?.user.id);
  if (!view) notFound();
  return (
    <AppShell rightSidebar={false} publicMode={!session} wide>
      <SpaceView initialView={view} publicMode={!session} />
    </AppShell>
  );
}
