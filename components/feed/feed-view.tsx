"use client";

// home feed shell: tabs, composer, and "load more"

import { useState } from "react";
import { FeedCard } from "@/components/feed/feed-card";
import { FeedComposer } from "@/components/feed/feed-composer";
import { FeedTabs } from "@/components/feed/feed-tabs";
import { QuestionDialog } from "@/components/question/question-dialog";
import { Button } from "@/components/ui/button";
import type { FeedQuestion } from "@/lib/types";

export function FeedView({
  publicMode = false,
  questions,
}: {
  publicMode?: boolean;
  questions: FeedQuestion[];
}) {
  const [askOpen, setAskOpen] = useState(false);
  const [visible, setVisible] = useState(4);
  const [active, setActive] = useState("For you");
  // filter by the active tab on the client
  const filtered = questions
    .filter(
      (question) =>
        active !== "Following" || question.followed || question.author.verified,
    )
    .filter((question) => active !== "Unanswered" || question.answers === 0);
  const sorted =
    active === "Trending"
      ? [...filtered].sort((a, b) => b.score - a.score || b.views - a.views)
      : filtered;

  return (
    <div className="space-y-4">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">For you</p>
        <h1 className="mt-1 font-serif text-4xl">Questions worth answering</h1>
      </div>
      {publicMode && (
        <div className="rounded-[28px] border border-border bg-card p-5">
          <p className="font-serif text-xl">
            A community for people who stay curious.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Read thoughtful answers. Join to ask, vote, and save what matters.
          </p>
        </div>
      )}
      <FeedComposer onAsk={() => setAskOpen(true)} publicMode={publicMode} />
      <section className="overflow-hidden rounded-[28px] border border-border bg-card">
        <FeedTabs
          active={active}
          onChange={(tab) => {
            setActive(tab);
            setVisible(4);
          }}
        />
      </section>
      {sorted.slice(0, visible).map((question) => (
        <FeedCard
          key={question.id}
          question={question}
          publicMode={publicMode}
        />
      ))}
      {sorted.length === 0 && (
        <section className="border-y bg-card p-10 text-center sm:rounded-xl sm:border">
          <p className="text-sm font-semibold">
            No questions match this filter.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try another tab or follow more topics.
          </p>
        </section>
      )}
      {visible < sorted.length ? (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setVisible(sorted.length)}
        >
          Load more questions
        </Button>
      ) : (
        sorted.length > 0 && (
          <div className="py-8 text-center">
            <p className="text-sm font-semibold">You are all caught up</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Follow more topics to personalize your feed.
            </p>
          </div>
        )
      )}
      <QuestionDialog
        open={askOpen}
        onClose={() => setAskOpen(false)}
        publicMode={publicMode}
      />
    </div>
  );
}
