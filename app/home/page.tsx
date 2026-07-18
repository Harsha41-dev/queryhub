// logged-in home feed

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { FeedView } from "@/components/feed/feed-view";
import { getFeedQuestions } from "@/lib/query-data";
import { getActiveSession } from "@/lib/session";

export const metadata: Metadata = { title: "Home" };
export default async function HomePage() {
  const session = await getActiveSession();
  if (!session) redirect("/login?callbackUrl=/home");
  // personalized feed for this user
  const questions = await getFeedQuestions({
    viewerId: session.user.id,
    take: 40,
  });
  return (
    <AppShell>
      <FeedView questions={questions} />
    </AppShell>
  );
}
