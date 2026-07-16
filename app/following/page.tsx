import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { FeedCard } from "@/components/feed/feed-card";
import { PageHeading } from "@/components/page-heading";
import { getFeedQuestions } from "@/lib/query-data";
import { getActiveSession } from "@/lib/session";

export const metadata: Metadata = { title: "Following" };

export default async function FollowingPage() {
  const session = await getActiveSession();
  if (!session) redirect("/login?callbackUrl=/following");
  const questions = await getFeedQuestions({
    viewerId: session.user.id,
    filter: "following",
    take: 40,
  });
  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeading
          title="Following"
          description="Fresh answers from the people, questions, and topics you follow."
        />
        {questions.length > 0 ? (
          questions.map((question) => (
            <FeedCard key={question.id} question={question} />
          ))
        ) : (
          <section className="border-y bg-card p-10 text-center sm:rounded-xl sm:border">
            <p className="text-sm font-semibold">No followed activity yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Follow topics, people, or questions to build this feed.
            </p>
          </section>
        )}
      </div>
    </AppShell>
  );
}
