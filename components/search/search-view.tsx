"use client";

// search page UI – tabs, recent searches, and results list

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FeedQuestion, PersonSummary, TopicSummary } from "@/lib/types";
import { compactNumber, contrastTextColor } from "@/lib/utils";

type SearchTab = "All" | "Questions" | "Answers" | "Topics" | "People";
const tabs: SearchTab[] = ["All", "Questions", "Answers", "Topics", "People"];
// quick chips shown when the box is empty
const suggestions = [
  "AI product evaluation",
  "Database scaling patterns",
  "Climate technology",
  "Product design",
];

type SearchResult = {
  questions: FeedQuestion[];
  answers: Array<{
    id: string;
    content: string;
    questionTitle: string;
    questionSlug: string;
    author: FeedQuestion["author"];
    score: number;
    createdAt: string;
  }>;
  topics: TopicSummary[];
  people: PersonSummary[];
  counts: {
    questions: number;
    answers: number;
    topics: number;
    people: number;
    total: number;
  };
  page: number;
  pageSize: number;
  sort: "relevance" | "newest";
};

export function SearchView() {
  const params = useSearchParams();
  const router = useRouter();
  const initial = params.get("q") ?? "";
  const [query, setQuery] = useState(initial);
  const [committed, setCommitted] = useState(initial);
  const [tab, setTab] = useState<SearchTab>(parseTab(params.get("tab")));
  const [page, setPage] = useState(() => {
    const value = Number(params.get("page"));
    return Number.isInteger(value) && value > 0 ? value : 1;
  });
  const [sort, setSort] = useState<"relevance" | "newest">(
    params.get("sort") === "newest" ? "newest" : "relevance",
  );
  const [recent, setRecent] = useState<string[]>([]);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // load recent searches from localStorage after mount
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored: unknown = JSON.parse(
          localStorage.getItem("queryhub-recent-searches") ?? "[]",
        );
        setRecent(
          Array.isArray(stored)
            ? stored
                .filter((item): item is string => typeof item === "string")
                .slice(0, 5)
            : [],
        );
      } catch {
        setRecent([]);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // debounce typing so we don't hit the API on every keypress
  useEffect(() => {
    const timer = setTimeout(() => {
      const value = query.trim();
      setCommitted(value);
      if (value) {
        setLoading(true);
        setError("");
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // actually run search when the committed query / page / sort changes
  useEffect(() => {
    if (!committed) {
      return;
    }
    const controller = new AbortController();
    fetch(
      `/api/search?q=${encodeURIComponent(committed)}&page=${page}&sort=${sort}`,
      {
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        const payload = (await response.json()) as {
          ok: boolean;
          data?: SearchResult;
          error?: { message: string };
        };
        if (!response.ok || !payload.ok || !payload.data)
          throw new Error(payload.error?.message ?? "Search failed");
        setResult(payload.data);
        // keep last 5 searches for the "recent" chips
        setRecent((current) => {
          const next = [
            committed,
            ...current.filter((item) => item !== committed),
          ].slice(0, 5);
          localStorage.setItem(
            "queryhub-recent-searches",
            JSON.stringify(next),
          );
          return next;
        });
        // keep the URL in sync so refresh works
        router.replace(
          `/search?q=${encodeURIComponent(committed)}${tab !== "All" ? `&tab=${tab.toLowerCase()}` : ""}${page > 1 ? `&page=${page}` : ""}${sort === "newest" ? "&sort=newest" : ""}`,
          { scroll: false },
        );
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Search failed");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [committed, page, router, sort, tab]);

  // click a suggestion / recent chip
  function select(value: string) {
    setQuery(value);
    setCommitted(value);
    setPage(1);
    setLoading(Boolean(value.trim()));
    setError("");
  }

  const count = result
    ? tab === "Questions"
      ? result.counts.questions
      : tab === "Answers"
        ? result.counts.answers
        : tab === "Topics"
          ? result.counts.topics
          : tab === "People"
            ? result.counts.people
            : result.counts.total
    : 0;
  const paginationCount = result
    ? tab === "All"
      ? Math.max(
          result.counts.questions,
          result.counts.answers,
          result.counts.topics,
          result.counts.people,
        )
      : count
    : 0;
  const totalPages = result
    ? Math.max(1, Math.ceil(paginationCount / result.pageSize))
    : 1;

  return (
    <div className="space-y-4">
      <section className="border-y bg-card p-4 sm:rounded-xl sm:border sm:p-5">
        <h1 className="text-xl font-extrabold">Search QueryHub</h1>
        <div className="mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              autoFocus
              aria-label="Search QueryHub"
              placeholder="Search questions, answers, topics, and people"
              className="h-12 w-full rounded-xl border bg-muted/30 pl-11 pr-10 text-sm outline-none focus:border-primary focus:bg-card focus:ring-2 focus:ring-primary/10"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  setCommitted("");
                  setPage(1);
                  setLoading(false);
                  setError("");
                }}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>
      </section>
      {!committed ? (
        <section className="border-y bg-card p-5 sm:rounded-xl sm:border">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">Recent searches</h2>
            {recent.length > 0 && (
              <button
                onClick={() => {
                  setRecent([]);
                  localStorage.removeItem("queryhub-recent-searches");
                }}
                className="text-xs font-semibold text-primary"
              >
                Clear all
              </button>
            )}
          </div>
          {recent.length > 0 ? (
            <div className="mt-3 space-y-1">
              {recent.map((item) => (
                <button
                  key={item}
                  onClick={() => select(item)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted"
                >
                  <Clock3 className="size-4 text-muted-foreground" />
                  {item}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Your recent searches will appear here.
            </p>
          )}
          <h2 className="mt-7 flex items-center gap-2 text-sm font-bold">
            <Sparkles className="size-4 text-amber-500" />
            Try searching for
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((item) => (
              <button key={item} onClick={() => select(item)}>
                <Badge className="px-3 py-2 text-xs">{item}</Badge>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <>
          <section className="overflow-hidden border-y bg-card sm:rounded-xl sm:border">
            <div className="flex overflow-x-auto border-b px-2 scrollbar-none">
              {tabs.map((item) => (
                <button
                  key={item}
                  onClick={() => {
                    setTab(item);
                    setPage(1);
                  }}
                  className={`relative h-12 px-4 text-sm font-semibold ${tab === item ? "text-primary after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-primary" : "text-muted-foreground"}`}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-xs text-muted-foreground">
              <span>
                {loading ? "Searching..." : `${count} results for `}
                <strong className="text-foreground">{committed}</strong>
              </span>
              <label className="flex items-center gap-2">
                <span>Sort</span>
                <select
                  value={sort}
                  onChange={(event) => {
                    setSort(
                      event.target.value === "newest" ? "newest" : "relevance",
                    );
                    setPage(1);
                  }}
                  className="h-8 rounded-md border bg-card px-2 text-xs font-semibold text-foreground"
                >
                  <option value="relevance">Relevance</option>
                  <option value="newest">Newest</option>
                </select>
              </label>
            </div>
          </section>
          {error && (
            <section className="border-y bg-card p-5 text-sm text-destructive sm:rounded-xl sm:border">
              {error}
            </section>
          )}
          {!loading && result && count === 0 && (
            <EmptySearch query={committed} />
          )}
          {!loading && result && count > 0 && (
            <div className="space-y-3">
              {(tab === "All" || tab === "Questions") &&
                result.questions.map((item) => (
                  <QuestionResult key={item.id} item={item} query={committed} />
                ))}
              {(tab === "All" || tab === "Answers") &&
                result.answers.map((item) => (
                  <AnswerResult key={item.id} item={item} query={committed} />
                ))}
              {(tab === "All" || tab === "Topics") &&
                result.topics.map((item) => (
                  <TopicResult
                    key={item.id ?? item.slug}
                    item={item}
                    query={committed}
                  />
                ))}
              {(tab === "All" || tab === "People") &&
                result.people.map((item) => (
                  <PersonResult
                    key={item.id ?? item.username}
                    item={item}
                    query={committed}
                  />
                ))}
              {totalPages > 1 && (
                <nav
                  aria-label="Search result pages"
                  className="flex items-center justify-center gap-3 border-y bg-card p-4 sm:rounded-xl sm:border"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((current) => current - 1)}
                  >
                    <ChevronLeft className="size-4" />
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Next
                    <ChevronRight className="size-4" />
                  </Button>
                </nav>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function QuestionResult({
  item,
  query,
}: {
  item: FeedQuestion;
  query: string;
}) {
  return (
    <article className="border-y bg-card p-5 sm:rounded-xl sm:border">
      <div className="flex flex-wrap gap-1.5">
        {item.topics.map((topic) => (
          <Badge key={topic}>{topic}</Badge>
        ))}
      </div>
      <Link href={`/question/${item.slug}`}>
        <h2 className="mt-3 text-lg font-bold hover:text-primary">
          <Highlight text={item.title} query={query} />
        </h2>
      </Link>
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
        <Highlight text={item.answer} query={query} />
      </p>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Avatar
          src={item.author.avatar}
          name={item.author.name}
          className="size-6"
        />
        {item.author.name}
        <span>-</span>
        {compactNumber(item.views)} views
      </div>
    </article>
  );
}

function AnswerResult({
  item,
  query,
}: {
  item: SearchResult["answers"][number];
  query: string;
}) {
  return (
    <article className="border-y bg-card p-5 sm:rounded-xl sm:border">
      <Link href={`/question/${item.questionSlug}`}>
        <h2 className="text-sm font-bold text-primary">
          Answer on <Highlight text={item.questionTitle} query={query} />
        </h2>
      </Link>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
        <Highlight text={item.content} query={query} />
      </p>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Avatar
          src={item.author.avatar}
          name={item.author.name}
          className="size-6"
        />
        {item.author.name}
        <span>-</span>
        {compactNumber(item.score)} score
      </div>
    </article>
  );
}

function TopicResult({ item, query }: { item: TopicSummary; query: string }) {
  return (
    <Link
      href={`/topic/${item.slug}`}
      className="flex gap-4 border-y bg-card p-5 sm:rounded-xl sm:border"
    >
      <span
        className="grid size-12 shrink-0 place-items-center rounded-xl text-sm font-black"
        style={{
          backgroundColor: item.accent,
          color: contrastTextColor(item.accent),
        }}
      >
        {item.icon}
      </span>
      <span>
        <span className="font-bold">
          <Highlight text={item.name} query={query} />
        </span>
        <span className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {item.description}
        </span>
        <span className="mt-2 block text-xs text-muted-foreground">
          {compactNumber(item.followers)} followers
        </span>
      </span>
    </Link>
  );
}

function PersonResult({ item, query }: { item: PersonSummary; query: string }) {
  return (
    <Link
      href={`/profile/${item.username}`}
      className="flex gap-3 border-y bg-card p-5 sm:rounded-xl sm:border"
    >
      <Avatar src={item.avatar} name={item.name} className="size-12" />
      <span>
        <span className="font-bold">
          <Highlight text={item.name} query={query} />
        </span>
        <span className="block text-xs text-muted-foreground">
          @{item.username}
        </span>
        <span className="mt-1 block text-sm text-muted-foreground">
          {item.headline}
        </span>
      </span>
    </Link>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={`${part}-${index}`}
            className="rounded bg-amber-200/70 px-0.5 text-inherit dark:bg-amber-500/30"
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

function EmptySearch({ query }: { query: string }) {
  return (
    <section className="border-y bg-card p-10 text-center sm:rounded-xl sm:border">
      <Search className="mx-auto size-10 text-muted-foreground/50" />
      <h2 className="mt-4 font-bold">No results for {query}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Try fewer words, check the spelling, or explore a related topic.
      </p>
    </section>
  );
}

function parseTab(value: string | null): SearchTab {
  switch (value?.toLowerCase()) {
    case "questions":
      return "Questions";
    case "answers":
      return "Answers";
    case "topics":
      return "Topics";
    case "people":
      return "People";
    default:
      return "All";
  }
}
