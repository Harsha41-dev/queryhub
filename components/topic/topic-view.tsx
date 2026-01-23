"use client";

// topic page: questions under this topic and follow toggle

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellPlus, Check, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FeedCard } from "@/components/feed/feed-card";
import type { FeedAuthor, FeedQuestion, TopicSummary } from "@/lib/types";
import { compactNumber, contrastTextColor } from "@/lib/utils";

export function TopicView({
  topic,
  questions,
  related,
  contributors,
  publicMode = false,
}: {
  topic: TopicSummary;
  questions: FeedQuestion[];
  related: TopicSummary[];
  contributors: Array<FeedAuthor & { answers: number }>;
  publicMode?: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(topic.followed ?? false);
  const [tab, setTab] = useState("Recent");

  // optimistic follow, then hit the API
  function follow() {
    if (publicMode) {
      router.push("/login");
      return;
    }
    void (async () => {
      const previous = following;
      setFollowing(!following);
      const response = await fetch("/api/follows", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topicId: topic.id }),
      });
      if (!response.ok) {
        setFollowing(previous);
        toast.error("Follow could not be saved");
        return;
      }
      toast.success(previous ? "Topic unfollowed" : `Following ${topic.name}`);
    })();
  }

  const visible =
    tab === "Popular"
      ? [...questions].sort((a, b) => b.score - a.score)
      : questions;

  return (
    <div className="space-y-4">
      <section className="overflow-hidden border-y bg-card shadow-card sm:rounded-xl sm:border">
        <div
          className="h-32 sm:h-40"
          style={{
            background: `linear-gradient(125deg, ${topic.accent}22, ${topic.accent}70)`,
          }}
        />
        <div className="p-5 sm:p-7">
          <div className="-mt-14 flex items-end gap-4">
            <span
              className="grid size-20 place-items-center rounded-2xl border-4 border-card text-xl font-black shadow-md"
              style={{
                backgroundColor: topic.accent,
                color: contrastTextColor(topic.accent),
              }}
            >
              {topic.icon}
            </span>
            <div className="mb-1 ml-auto flex gap-2">
              <Button
                onClick={follow}
                className={
                  following ? "bg-emerald-600 hover:bg-emerald-700" : ""
                }
              >
                {following ? (
                  <Check className="size-4" />
                ) : (
                  <BellPlus className="size-4" />
                )}
                {following ? "Following" : "Follow topic"}
              </Button>
            </div>
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
            {topic.name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {topic.description}
          </p>
          <div className="mt-4 flex gap-5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Users className="size-4" />
              <strong className="text-foreground">
                {compactNumber(topic.followers)}
              </strong>{" "}
              followers
            </span>
            <span>
              <strong className="text-foreground">
                {compactNumber(topic.questions)}
              </strong>{" "}
              questions
            </span>
          </div>
        </div>
        <div className="flex overflow-x-auto border-t px-3 scrollbar-none">
          {["Recent", "Popular", "Contributors", "About"].map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`relative h-12 px-4 text-sm font-semibold ${tab === item ? "text-primary after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-primary" : "text-muted-foreground"}`}
            >
              {item}
            </button>
          ))}
        </div>
      </section>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="space-y-4">
          {(tab === "Recent" || tab === "Popular") &&
            (visible.length ? (
              visible.map((question) => (
                <FeedCard
                  key={question.id}
                  question={question}
                  publicMode={publicMode}
                />
              ))
            ) : (
              <section className="border-y bg-card p-10 text-center sm:rounded-xl sm:border">
                <p className="text-sm font-semibold">
                  No questions in this topic yet.
                </p>
              </section>
            ))}
          {tab === "Contributors" && (
            <section className="border-y bg-card p-5 sm:rounded-xl sm:border">
              <h2 className="font-bold">Top contributors</h2>
              <div className="mt-4 space-y-3">
                {contributors.map((person) => (
                  <Link
                    href={`/profile/${person.username}`}
                    key={person.username}
                    className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted"
                  >
                    <Avatar
                      src={person.avatar}
                      name={person.name}
                      className="size-9"
                    />
                    <span>
                      <span className="block text-sm font-semibold">
                        {person.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {person.answers} answers
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          {tab === "About" && (
            <section className="border-y bg-card p-5 sm:rounded-xl sm:border">
              <h2 className="font-bold">About {topic.name}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {topic.description}
              </p>
            </section>
          )}
        </div>
        <aside className="space-y-4">
          <section className="rounded-xl border bg-card p-4">
            <h2 className="text-sm font-bold">Top contributors</h2>
            <div className="mt-3 space-y-3">
              {contributors.map((person, index) => (
                <Link
                  href={`/profile/${person.username}`}
                  key={person.username}
                  className="flex items-center gap-2.5"
                >
                  <span className="w-3 text-xs text-muted-foreground">
                    {index + 1}
                  </span>
                  <Avatar
                    src={person.avatar}
                    name={person.name}
                    className="size-8"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold">
                      {person.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {person.answers} answers
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
          <section className="rounded-xl border bg-card p-4">
            <h2 className="text-sm font-bold">Related topics</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {related.map((item) => (
                <Link href={`/topic/${item.slug}`} key={item.slug}>
                  <Badge>{item.name}</Badge>
                </Link>
              ))}
            </div>
          </section>
          <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <ShieldCheck className="size-5 text-primary" />
            <h2 className="mt-2 text-sm font-bold">Topic moderation</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Community moderators keep questions relevant and useful.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
