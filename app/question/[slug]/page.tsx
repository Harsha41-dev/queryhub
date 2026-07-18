// single question page (works for guests + logged-in users)

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { QuestionDetail } from "@/components/question/question-detail";
import { getQuestionDetail } from "@/lib/query-data";
import { getActiveSession } from "@/lib/session";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const question = await getQuestionDetail(slug);
  return { title: question?.title ?? "Question" };
}

export default async function QuestionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getActiveSession();
  // load votes/bookmarks for this viewer if they're signed in
  const question = await getQuestionDetail(
    slug,
    session?.user.id,
    session?.user.role,
    true,
  );
  if (!question) notFound();
  return (
    <AppShell publicMode={!session}>
      <QuestionDetail question={question} publicMode={!session} />
    </AppShell>
  );
}
