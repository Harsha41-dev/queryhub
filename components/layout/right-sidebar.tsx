import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { PersonSummary, TopicSummary } from "@/lib/types";
import { compactNumber } from "@/lib/utils";

export function RightSidebar({
  people,
  topics,
}: {
  people: PersonSummary[];
  topics: TopicSummary[];
}) {
  return (
    <aside className="sticky top-0 hidden h-screen overflow-y-auto py-6 xl:block scrollbar-none">
      <section className="rounded-xl border bg-card p-4 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Trending topics</h2>
          <Sparkles className="size-4 text-amber-500" />
        </div>
        <div className="mt-3 space-y-3">
          {topics.length === 0 &&
            Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-10" />
            ))}
          {topics.map((topic, index) => (
            <Link
              href={`/topic/${topic.slug}`}
              key={topic.slug}
              className="group flex gap-3"
            >
              <span className="pt-0.5 text-xs font-bold text-muted-foreground">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold group-hover:text-primary">
                  {topic.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {compactNumber(topic.questions)} questions
                </span>
              </span>
            </Link>
          ))}
        </div>
        <Link
          href="/search?tab=topics"
          className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary"
        >
          Explore topics <ArrowUpRight className="size-3" />
        </Link>
      </section>
      <section className="mt-4 rounded-xl border bg-card p-4 shadow-card">
        <h2 className="text-sm font-bold">People worth following</h2>
        <div className="mt-3 space-y-4">
          {people.length === 0 &&
            Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-12" />
            ))}
          {people.map((person) => (
            <div key={person.username} className="flex gap-3">
              <Avatar src={person.avatar} name={person.name} />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/profile/${person.username}`}
                  className="block truncate text-sm font-semibold hover:text-primary"
                >
                  {person.name}
                </Link>
                <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-muted-foreground">
                  {person.headline}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="mt-4 rounded-xl border bg-card p-4 shadow-card">
        <h2 className="text-sm font-bold">Share knowledge generously</h2>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Assume good intent, cite reliable sources, and explain the reasoning
          behind your answer.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge>Be kind</Badge>
          <Badge>Be clear</Badge>
          <Badge>Be useful</Badge>
        </div>
      </section>
      <footer className="px-2 py-5 text-[11px] leading-5 text-muted-foreground">
        © 2026 QueryHub · Terms · Privacy · Cookies · Community guidelines
      </footer>
    </aside>
  );
}
