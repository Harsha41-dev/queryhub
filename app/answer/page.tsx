import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { AnswerRequests } from "@/components/answer/answer-requests";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { getAnswerRequests } from "@/lib/query-data";
import { getActiveSession } from "@/lib/session";

export const metadata: Metadata = { title: "Answer requests" };

export default async function AnswerPage() {
  const session = await getActiveSession();
  if (!session) redirect("/login?callbackUrl=/answer");
  const questions = await getAnswerRequests(session.user.id);
  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeading
          title="Questions for you"
          description="Unanswered questions matched to what you know."
          action={
            <Badge className="bg-primary/10 text-primary">
              {questions.length} requests
            </Badge>
          }
        />
        <AnswerRequests questions={questions} />
      </div>
    </AppShell>
  );
}
