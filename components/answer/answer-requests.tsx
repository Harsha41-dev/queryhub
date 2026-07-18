"use client";

// questions waiting for an answer – open the editor when user clicks Reply

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, MessageSquareText } from "lucide-react";
import { AnswerEditor } from "@/components/question/answer-editor";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { FeedQuestion } from "@/lib/types";
import { relativeDate } from "@/lib/utils";

export function AnswerRequests({ questions }: { questions: FeedQuestion[] }) {
  const [selected, setSelected] = useState<FeedQuestion | null>(null);

  return (
    <>
      <div className="space-y-3">
        {questions.map((question) => (
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
            </footer>
          </article>
        ))}
        {questions.length === 0 && (
          <section className="border-y bg-card p-12 text-center sm:rounded-xl sm:border">
            <CheckCircle2 className="mx-auto size-12 text-emerald-500" />
            <h2 className="mt-4 font-bold">All requests handled</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              New unanswered questions will appear here.
            </p>
          </section>
        )}
      </div>
      <AnswerEditor
        open={selected !== null}
        onClose={() => setSelected(null)}
        questionTitle={selected?.title ?? ""}
        questionId={selected?.id}
      />
    </>
  );
}
