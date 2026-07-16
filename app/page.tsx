import { AppShell } from "@/components/layout/app-shell";
import { FeedView } from "@/components/feed/feed-view";
import { getFeedQuestions } from "@/lib/query-data";

export default async function PublicHomePage() {
  const questions = await getFeedQuestions({ take: 40 });
  return (
    <AppShell publicMode>
      <FeedView publicMode questions={questions} />
    </AppShell>
  );
}
