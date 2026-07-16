import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { FeedCard } from "@/components/feed/feed-card";
import { PageHeading } from "@/components/page-heading";
import { getBookmarkedQuestions } from "@/lib/query-data";
import { getActiveSession } from "@/lib/session";

export const metadata: Metadata = { title: "Bookmarks" };

export default async function BookmarksPage() {
  const session = await getActiveSession();
  if (!session) redirect("/login?callbackUrl=/bookmarks");
  const saved = await getBookmarkedQuestions(session.user.id);
  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeading
          title="Bookmarks"
          description="A private library of questions and answers you want to revisit."
        />
        {saved.length > 0 ? (
          saved.map((question) => (
            <FeedCard
              key={`${question.id}-${question.bookmarkAnswerId ?? "question"}`}
              question={question}
            />
          ))
        ) : (
          <section className="border-y bg-card p-10 text-center sm:rounded-xl sm:border">
            <p className="text-sm font-semibold">No bookmarks yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Save a question or answer and it will appear here.
            </p>
          </section>
        )}
      </div>
    </AppShell>
  );
}
