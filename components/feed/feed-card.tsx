"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  Ellipsis,
  Flag,
  MessageCircle,
  Share2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FeedQuestion } from "@/lib/types";
import { cn, compactNumber, relativeDate } from "@/lib/utils";

export function FeedCard({
  question,
  publicMode = false,
}: {
  question: FeedQuestion;
  publicMode?: boolean;
}) {
  const [score, setScore] = useState(question.score);
  const [vote, setVote] = useState<-1 | 0 | 1>(question.userVote ?? 0);
  const [bookmarked, setBookmarked] = useState(question.bookmarked ?? false);
  const [followed, setFollowed] = useState(question.followed ?? false);
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [voting, setVoting] = useState(false);

  function requireAuth(action: () => void | Promise<void>) {
    if (publicMode) {
      toast.info("Join QueryHub to take part", {
        action: {
          label: "Sign in",
          onClick: () => {
            window.location.href = "/login";
          },
        },
      });
      return;
    }
    void action();
  }

  function updateVote(next: -1 | 1) {
    requireAuth(async () => {
      if (voting) return;
      const actual = vote === next ? 0 : next;
      const previousVote = vote;
      const previousScore = score;
      setVote(actual);
      setScore(score - vote + actual);
      setVoting(true);
      try {
        const response = await fetch("/api/votes", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            question.voteAnswerId
              ? { answerId: question.voteAnswerId, value: actual }
              : { questionId: question.id, value: actual },
          ),
        });
        const result = (await response.json()) as {
          ok: boolean;
          data?: { score: number; vote: -1 | 0 | 1 };
        };
        if (!response.ok || !result.ok || !result.data)
          throw new Error("Vote failed");
        setVote(result.data.vote);
        setScore(result.data.score);
      } catch {
        setVote(previousVote);
        setScore(previousScore);
        toast.error("Vote could not be saved");
      } finally {
        setVoting(false);
      }
    });
  }

  function toggleBookmark() {
    requireAuth(async () => {
      const previous = bookmarked;
      setBookmarked(!bookmarked);
      const response = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          question.bookmarkAnswerId
            ? { answerId: question.bookmarkAnswerId }
            : { questionId: question.id },
        ),
      });
      if (!response.ok) {
        setBookmarked(previous);
        toast.error("Bookmark could not be saved");
        return;
      }
      toast.success(previous ? "Removed from bookmarks" : "Saved to bookmarks");
    });
  }

  function toggleFollow() {
    requireAuth(async () => {
      const previous = followed;
      setFollowed(!followed);
      const response = await fetch("/api/follows", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ questionId: question.id }),
      });
      if (!response.ok) {
        setFollowed(previous);
        toast.error("Follow could not be saved");
        return;
      }
      toast.success(previous ? "Question unfollowed" : "Following question");
    });
  }

  function reportContent() {
    requireAuth(async () => {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ questionId: question.id, reason: "OTHER" }),
      });
      if (!response.ok) {
        toast.error("Report could not be submitted");
        return;
      }
      toast.success("Report submitted for review");
    });
  }

  async function share() {
    const url = `${window.location.origin}/question/${question.slug}`;
    if (navigator.share) await navigator.share({ title: question.title, url });
    else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    }
  }

  return (
    <article className="border-y bg-card p-4 shadow-card sm:rounded-xl sm:border sm:p-5">
      <header className="flex items-start gap-3">
        <Avatar
          src={question.author.avatar}
          name={question.author.name}
          className="size-10"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Link
              href={`/profile/${question.author.username}`}
              className="truncate text-sm font-bold hover:text-primary"
            >
              {question.author.name}
            </Link>
            {question.author.verified && (
              <span className="grid size-3.5 place-items-center rounded-full bg-primary text-white">
                <Check className="size-2.5" />
              </span>
            )}
            <span
              suppressHydrationWarning
              className="text-xs text-muted-foreground"
            >
              - {relativeDate(question.publishedAt)}
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {question.author.headline}
          </p>
        </div>
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="More actions"
            aria-expanded={menuOpen}
            className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <Ellipsis className="size-5" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 z-10 w-48 rounded-xl border bg-card p-1.5 shadow-xl">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  reportContent();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <Flag className="size-4" />
                Report content
              </button>
            </div>
          )}
        </div>
      </header>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {question.topics.map((topic) => (
          <Badge key={topic}>{topic}</Badge>
        ))}
      </div>
      <Link href={`/question/${question.slug}`}>
        <h2 className="mt-3 text-[18px] font-bold leading-snug hover:text-primary sm:text-xl">
          {question.title}
        </h2>
      </Link>
      <div className="mt-3 text-[15px] leading-7 text-slate-700 dark:text-slate-300">
        <p className={cn(!expanded && "line-clamp-3")}>{question.answer}</p>
        {question.answer.length > 220 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1 text-sm font-semibold text-primary hover:underline"
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        )}
      </div>
      <div className="mt-4 flex items-center gap-1 text-xs text-muted-foreground">
        <span>{question.answers} answers</span>
        <span>-</span>
        <span>{compactNumber(question.views)} views</span>
      </div>
      <footer className="mt-4 flex items-center gap-1 border-t pt-3">
        <div className="flex h-9 items-center overflow-hidden rounded-full border bg-muted/40">
          <button
            aria-label="Upvote"
            aria-pressed={vote === 1}
            disabled={voting}
            onClick={() => updateVote(1)}
            className={cn(
              "flex h-full items-center gap-1.5 px-3 text-xs font-bold hover:bg-muted disabled:cursor-wait disabled:opacity-60",
              vote === 1 && "bg-primary/10 text-primary",
            )}
          >
            <ChevronUp className="size-4" />
            <span>{compactNumber(score)}</span>
          </button>
          <span className="h-5 w-px bg-border" />
          <button
            aria-label="Downvote"
            aria-pressed={vote === -1}
            disabled={voting}
            onClick={() => updateVote(-1)}
            className={cn(
              "grid h-full w-9 place-items-center hover:bg-muted disabled:cursor-wait disabled:opacity-60",
              vote === -1 && "bg-primary/10 text-primary",
            )}
          >
            <ChevronDown className="size-4" />
          </button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`${question.comments} comments`}
          onClick={() => {
            window.location.href = `/question/${question.slug}`;
          }}
        >
          <MessageCircle className="size-4" />
          <span className="hidden sm:inline">{question.comments}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label={followed ? "Unfollow question" : "Follow question"}
          onClick={toggleFollow}
          className={followed ? "text-primary" : ""}
        >
          <UserPlus className="size-4" />
          <span className="hidden sm:inline">
            {followed ? "Following" : "Follow"}
          </span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={share}
          className="ml-auto size-9"
          aria-label="Share"
        >
          <Share2 className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleBookmark}
          className={cn("size-9", bookmarked && "text-primary")}
          aria-label={bookmarked ? "Remove bookmark" : "Bookmark"}
        >
          <Bookmark className={cn("size-4", bookmarked && "fill-current")} />
        </Button>
      </footer>
    </article>
  );
}
