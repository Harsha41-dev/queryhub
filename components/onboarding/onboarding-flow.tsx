"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PersonSummary, TopicSummary } from "@/lib/types";
import { cn, compactNumber, contrastTextColor } from "@/lib/utils";

export function OnboardingFlow({
  options,
}: {
  options: {
    onboarded: boolean;
    topics: TopicSummary[];
    people: PersonSummary[];
  };
}) {
  const router = useRouter();
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [userIds, setUserIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function toggleTopic(id?: string) {
    if (!id) return;
    setTopicIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id].slice(0, 10),
    );
  }

  function toggleUser(id?: string) {
    if (!id) return;
    setUserIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id].slice(0, 10),
    );
  }

  async function finish(skip = false) {
    setSaving(true);
    try {
      const response = await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          topicIds: skip ? [] : topicIds,
          userIds: skip ? [] : userIds,
        }),
      });
      const result = (await response.json()) as {
        ok: boolean;
        error?: { message: string };
      };
      if (!response.ok || !result.ok)
        throw new Error(result.error?.message ?? "Onboarding could not save");
      router.push("/home");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Onboarding could not save",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="border-y bg-card p-5 shadow-card sm:rounded-xl sm:border sm:p-7">
        <Badge className="border-primary/20 bg-primary/5 text-primary">
          {options.onboarded ? "Update preferences" : "First step"}
        </Badge>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight">
          Personalize your feed
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Follow a few topics and people so QueryHub can rank your For You feed
          with better signals.
        </p>
      </section>

      <section className="border-y bg-card p-5 sm:rounded-xl sm:border">
        <h2 className="text-sm font-bold">Topics</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {options.topics.map((topic) => {
            const selected = Boolean(topic.id && topicIds.includes(topic.id));
            return (
              <button
                key={topic.id ?? topic.slug}
                onClick={() => toggleTopic(topic.id)}
                className={cn(
                  "flex min-h-24 gap-3 rounded-lg border p-3 text-left hover:border-primary/40",
                  selected && "border-primary bg-primary/[0.035]",
                )}
              >
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-lg text-xs font-black"
                  style={{
                    backgroundColor: topic.accent,
                    color: contrastTextColor(topic.accent),
                  }}
                >
                  {topic.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{topic.name}</span>
                  <span className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {topic.description}
                  </span>
                </span>
                {selected && <Check className="size-4 text-primary" />}
              </button>
            );
          })}
        </div>
      </section>

      <section className="border-y bg-card p-5 sm:rounded-xl sm:border">
        <h2 className="text-sm font-bold">People</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {options.people.map((person) => {
            const selected = Boolean(person.id && userIds.includes(person.id));
            return (
              <button
                key={person.id ?? person.username}
                onClick={() => toggleUser(person.id)}
                className={cn(
                  "flex gap-3 rounded-lg border p-3 text-left hover:border-primary/40",
                  selected && "border-primary bg-primary/[0.035]",
                )}
              >
                <Avatar
                  src={person.avatar}
                  name={person.name}
                  className="size-10"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{person.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {person.credential ?? person.headline}
                  </span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {compactNumber(person.followers)} followers -{" "}
                    {compactNumber(person.answers)} answers
                  </span>
                </span>
                <UserPlus
                  className={cn(
                    "size-4 text-muted-foreground",
                    selected && "text-primary",
                  )}
                />
              </button>
            );
          })}
        </div>
      </section>

      <footer className="sticky bottom-[68px] flex justify-end gap-2 border-y bg-card/95 p-4 backdrop-blur sm:bottom-0 sm:rounded-xl sm:border">
        <Button variant="ghost" onClick={() => finish(true)} disabled={saving}>
          Skip
        </Button>
        <Button
          onClick={() => finish(false)}
          disabled={saving || topicIds.length + userIds.length === 0}
        >
          Continue
        </Button>
      </footer>
    </div>
  );
}
