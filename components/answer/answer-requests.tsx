"use client";

// questions waiting for an answer - direct requests first, suggestions second

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, MessageSquareText, X } from "lucide-react";
import { AnswerEditor } from "@/components/question/answer-editor";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { AnswerRequestQueueItem, FeedQuestion } from "@/lib/types";
import { relativeDate } from "@/lib/utils";

export function AnswerRequests({
  requests,
  suggestions,
}: {
  requests: AnswerRequestQueueItem[];
  suggestions: FeedQuestion[];
}) {
  const [direct, setDirect] = useState(requests);
  const [suggested, setSuggested] = useState(suggestions);
  const [selected, setSelected] = useState<FeedQuestion | null>(null);

  async function dismiss(id: string) {
    const previous = direct;
    setDirect(direct.filter((request) => request.id !== id));
    const response = await fetch("/api/answer-requests", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, action: "DISMISS" }),
    });
    if (!response.ok) setDirect(previous);
  }

  function removeAnswered(questionId: string) {
    setDirect((current) =>
      current.filter((request) => request.question.id !== questionId),
    );
    setSuggested((current) =>
      current.filter((question) => question.id !== questionId),
    );
  }

  return (
    <>
      <div className="space-y-3">
        {direct.map((request) => (
          <article
            key={request.id}
            className="border-y bg-card p-5 sm:rounded-xl sm:border"
          >
            <header className="flex items-center gap-2 text-xs text-muted-foreground">
              <Avatar
                src={request.requester.avatar}
                name={request.requester.name}
                className="size-6"
              />
              <span>
                <strong className="text-foreground">
                  {request.requester.name}
                </strong>{" "}
                requested your answer
              </span>
              <span>-</span>
              <Clock3 className="size-3" />
              <span suppressHydrationWarning>
                {relativeDate(request.createdAt)}
              </span>
            </header>
            <Link href={`/question/${request.question.slug}`}>
              <h2 className="mt-4 text-lg font-bold leading-snug hover:text-primary">
                {request.question.title}
              </h2>
            </Link>
            {request.message && (
              <p className="mt-2 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
                {request.message}
              </p>
            )}
            <div className="mt-2 flex gap-2 text-xs text-muted-foreground">
              <span>{request.question.answers} answers</span>
              <span>-</span>
              <span>{request.question.views.toLocaleString()} views</span>
            </div>
            <footer className="mt-4 flex items-center gap-2">
              <Button onClick={() => setSelected(request.question)}>
                <MessageSquareText className="size-4" />
                Write answer
              </Button>
              <Button variant="ghost" onClick={() => dismiss(request.id)}>
                <X className="size-4" />
                Dismiss
              </Button>
            </footer>
          </article>
        ))}

        {suggested.length > 0 && (
          <section className="border-y bg-card p-4 sm:rounded-xl sm:border">
            <h2 className="text-sm font-bold">Suggested questions</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Matched from followed topics and unanswered questions.
            </p>
          </section>
        )}

        {suggested.map((question) => (
          <article
            key={question.id}
            className="border-y bg-card p-5 sm:rounded-xl sm:border"
          >
            <header className="flex items-center gap-2 text-xs text-muted-foreground">
              <Avatar
                src={question.author.avatar}
                name={question.author.name}
                className="size-6"
              />
              <span>
                <strong className="text-foreground">
                  {question.author.name}
                </strong>{" "}
                asked this question
              </span>
              <span>-</span>
              <Clock3 className="size-3" />
              <span suppressHydrationWarning>
                {relativeDate(question.publishedAt)}
              </span>
            </header>
            <Link href={`/question/${question.slug}`}>
              <h2 className="mt-4 text-lg font-bold leading-snug hover:text-primary">
                {question.title}
              </h2>
            </Link>
            <div className="mt-2 flex gap-2 text-xs text-muted-foreground">
              <span>{question.answers} answers</span>
              <span>-</span>
              <span>{question.views.toLocaleString()} views</span>
            </div>
            <footer className="mt-4 flex items-center gap-2">
              <Button onClick={() => setSelected(question)}>
                <MessageSquareText className="size-4" />
                Write answer
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  setSuggested((current) =>
                    current.filter((item) => item.id !== question.id),
                  )
                }
              >
                <X className="size-4" />
                Hide
              </Button>
            </footer>
          </article>
        ))}

        {direct.length === 0 && suggested.length === 0 && (
          <section className="border-y bg-card p-12 text-center sm:rounded-xl sm:border">
            <CheckCircle2 className="mx-auto size-12 text-emerald-500" />
            <h2 className="mt-4 font-bold">All requests handled</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              New answer requests and unanswered questions will appear here.
            </p>
          </section>
        )}
      </div>
      <AnswerEditor
        open={selected !== null}
        onClose={() => setSelected(null)}
        questionTitle={selected?.title ?? ""}
        questionId={selected?.id}
        questionTopics={selected?.topics ?? []}
        onPublished={() => {
          if (selected) removeAnswered(selected.id);
        }}
      />
    </>
  );
}
