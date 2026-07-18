"use client";

// one answer on a question page (vote, edit, comments, etc.)

import Link from "next/link";
import { useState } from "react";
import {
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  Flag,
  MessageCircle,
  Pencil,
  Reply,
  Share2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/question/markdown-content";
import type { AnswerSummary, CommentSummary } from "@/lib/types";
import { cn, compactNumber, relativeDate } from "@/lib/utils";

export function AnswerCard({
  answer,
  publicMode = false,
}: {
  answer: AnswerSummary;
  publicMode?: boolean;
}) {
  const [score, setScore] = useState(answer.score);
  const [vote, setVote] = useState<-1 | 0 | 1>(answer.userVote);
  const [saved, setSaved] = useState(answer.bookmarked);
  const [showComments, setShowComments] = useState(true);
  const [comments, setComments] = useState(answer.comments);
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(answer.content);
  const [deleted, setDeleted] = useState(false);
  const [voting, setVoting] = useState(false);

  // guests can read, but need to sign in to interact
  function requireAuth(action: () => void | Promise<void>) {
    if (publicMode) {
      toast.info("Sign in to take part", {
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

  // optimistic vote first, then sync with the API
  function applyVote(next: -1 | 1) {
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
          body: JSON.stringify({ answerId: answer.id, value: actual }),
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

  // bookmark this answer
  function toggleSave() {
    requireAuth(async () => {
      const previous = saved;
      setSaved(!saved);
      const response = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answerId: answer.id }),
      });
      if (!response.ok) {
        setSaved(previous);
        toast.error("Bookmark could not be saved");
        return;
      }
      toast.success(previous ? "Removed from bookmarks" : "Answer saved");
    });
  }

  async function share() {
    await navigator.clipboard.writeText(
      `${window.location.href}#answer-${answer.id}`,
    );
    toast.success("Answer link copied");
  }

  // post a top-level comment under this answer
  function submitComment(event: React.FormEvent) {
    event.preventDefault();
    if (!comment.trim()) return;
    requireAuth(async () => {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answerId: answer.id, content: comment }),
      });
      const result = (await response.json()) as {
        ok: boolean;
        data?: { id: string; content: string; createdAt: string };
        error?: { message: string };
      };
      if (!response.ok || !result.ok || !result.data) {
        toast.error(result.error?.message ?? "Comment could not be added");
        return;
      }
      setComments([
        {
          id: result.data.id,
          content: result.data.content,
          createdAt: result.data.createdAt,
          score: 0,
          userVote: 0,
          author: { name: "You", username: "", avatar: "", headline: "" },
          replies: [],
          canEdit: true,
        },
        ...comments,
      ]);
      setComment("");
      toast.success("Comment added");
    });
  }

  // save edits to my own answer
  function saveEdit() {
    requireAuth(async () => {
      const response = await fetch(`/api/answers/${answer.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) {
        toast.error("Answer could not be updated");
        return;
      }
      setEditing(false);
      toast.success("Answer updated");
    });
  }

  // soft-delete (server sets deletedAt)
  function deleteAnswer() {
    requireAuth(async () => {
      if (!window.confirm("Delete this answer?")) return;
      const response = await fetch(`/api/answers/${answer.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        toast.error("Answer could not be deleted");
        return;
      }
      setDeleted(true);
      toast.success("Answer deleted");
    });
  }

  function reportAnswer() {
    requireAuth(async () => {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answerId: answer.id, reason: "OTHER" }),
      });
      toast[response.ok ? "success" : "error"](
        response.ok
          ? "Report submitted for review"
          : "Report could not be submitted",
      );
    });
  }

  // hide the card after a successful delete
  if (deleted) return null;

  return (
    <article
      id={`answer-${answer.id}`}
      className="border-y bg-card p-4 shadow-card sm:rounded-xl sm:border sm:p-6"
    >
      <header className="flex gap-3">
        <Avatar
          src={answer.author.avatar}
          name={answer.author.name}
          className="size-11"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Link
              href={`/profile/${answer.author.username}`}
              className="font-bold hover:text-primary"
            >
              {answer.author.name}
            </Link>
            {answer.author.verified && (
              <span className="grid size-3.5 place-items-center rounded-full bg-primary text-white">
                <Check className="size-2.5" />
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {answer.author.headline} -{" "}
            <span suppressHydrationWarning>
              {relativeDate(answer.createdAt)}
            </span>
          </p>
        </div>
        <div className="flex gap-1">
          {answer.canEdit && (
            <button
              aria-label="Edit answer"
              onClick={() => setEditing(true)}
              className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <Pencil className="size-4" />
            </button>
          )}
          {answer.canEdit && (
            <button
              aria-label="Delete answer"
              onClick={deleteAnswer}
              className="grid size-9 place-items-center rounded-full text-destructive hover:bg-muted"
            >
              <Trash2 className="size-4" />
            </button>
          )}
          <button
            aria-label="Report answer"
            onClick={reportAnswer}
            className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <Flag className="size-4" />
          </button>
        </div>
      </header>
      {editing ? (
        <div className="mt-5">
          <textarea
            aria-label="Edit answer"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            className="min-h-48 w-full rounded-lg border bg-card p-3 text-sm leading-6 outline-none focus:border-primary"
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setContent(answer.content);
              }}
            >
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={content.trim().length < 40}>
              Save answer
            </Button>
          </div>
        </div>
      ) : (
        <MarkdownContent
          content={content}
          className="mt-5 whitespace-pre-wrap text-[15px] leading-7 text-slate-700 dark:text-slate-300"
        />
      )}
      <div className="mt-5 flex flex-wrap items-center gap-1 border-t pt-3">
        <div className="flex h-9 items-center overflow-hidden rounded-full border bg-muted/40">
          <button
            onClick={() => applyVote(1)}
            disabled={voting}
            aria-pressed={vote === 1}
            aria-label="Upvote answer"
            className={cn(
              "flex h-full items-center gap-1.5 px-3 text-xs font-bold disabled:cursor-wait disabled:opacity-60",
              vote === 1 && "bg-primary/10 text-primary",
            )}
          >
            <ChevronUp className="size-4" />
            {compactNumber(score)}
          </button>
          <span className="h-5 w-px bg-border" />
          <button
            onClick={() => applyVote(-1)}
            disabled={voting}
            aria-pressed={vote === -1}
            aria-label="Downvote answer"
            className={cn(
              "grid h-full w-9 place-items-center disabled:cursor-wait disabled:opacity-60",
              vote === -1 && "bg-primary/10 text-primary",
            )}
          >
            <ChevronDown className="size-4" />
          </button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowComments(!showComments)}
        >
          <MessageCircle className="size-4" />
          {comments.length}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto size-9"
          aria-label="Share answer"
          onClick={share}
        >
          <Share2 className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn("size-9", saved && "text-primary")}
          aria-label={saved ? "Remove answer bookmark" : "Save answer"}
          onClick={toggleSave}
        >
          <Bookmark className={cn("size-4", saved && "fill-current")} />
        </Button>
      </div>
      {showComments && (
        <div className="mt-4 rounded-xl bg-muted/40 p-3 sm:p-4">
          <form onSubmit={submitComment} className="flex gap-2">
            <input
              aria-label="Add a comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Add a thoughtful comment"
              className="h-9 min-w-0 flex-1 rounded-full border bg-card px-3 text-xs outline-none focus:border-primary"
            />
            <Button size="sm" disabled={!comment.trim()}>
              Comment
            </Button>
          </form>
          <div className="mt-4 space-y-4">
            {comments.map((item) => (
              <CommentItem
                key={item.id}
                comment={item}
                answerId={answer.id}
                publicMode={publicMode}
                onDelete={(id) =>
                  setComments(
                    comments.filter((commentItem) => commentItem.id !== id),
                  )
                }
              />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

function CommentItem({
  comment,
  answerId,
  publicMode,
  onDelete,
}: {
  comment: CommentSummary;
  answerId: string;
  publicMode: boolean;
  onDelete: (id: string) => void;
}) {
  const [content, setContent] = useState(comment.content);
  const [editing, setEditing] = useState(false);
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState("");
  const [replies, setReplies] = useState(comment.replies ?? []);
  const [score, setScore] = useState(comment.score);
  const [vote, setVote] = useState<-1 | 0 | 1>(comment.userVote);
  const [voting, setVoting] = useState(false);

  function requireAuth(action: () => void | Promise<void>) {
    if (publicMode) {
      toast.info("Sign in to comment");
      return;
    }
    void action();
  }

  function saveComment() {
    requireAuth(async () => {
      if (voting) return;
      const response = await fetch(`/api/comments/${comment.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) {
        toast.error("Comment could not be updated");
        return;
      }
      setEditing(false);
      toast.success("Comment updated");
    });
  }

  function deleteComment() {
    requireAuth(async () => {
      if (!window.confirm("Delete this comment?")) return;
      const response = await fetch(`/api/comments/${comment.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        toast.error("Comment could not be deleted");
        return;
      }
      onDelete(comment.id);
      toast.success("Comment deleted");
    });
  }

  function submitReply(event: React.FormEvent) {
    event.preventDefault();
    if (!reply.trim()) return;
    requireAuth(async () => {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          answerId,
          parentId: comment.id,
          content: reply,
        }),
      });
      const result = (await response.json()) as {
        ok: boolean;
        data?: { id: string; content: string; createdAt: string };
        error?: { message: string };
      };
      if (!response.ok || !result.ok || !result.data) {
        toast.error(result.error?.message ?? "Reply could not be added");
        return;
      }
      setReplies([
        ...replies,
        {
          id: result.data.id,
          content: result.data.content,
          createdAt: result.data.createdAt,
          score: 0,
          userVote: 0,
          author: { name: "You", username: "", avatar: "", headline: "" },
          replies: [],
          canEdit: true,
        },
      ]);
      setReply("");
      setReplying(false);
      toast.success("Reply added");
    });
  }

  function voteComment(next: -1 | 1) {
    requireAuth(async () => {
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
          body: JSON.stringify({ commentId: comment.id, value: actual }),
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

  function reportComment() {
    requireAuth(async () => {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ commentId: comment.id, reason: "OTHER" }),
      });
      toast[response.ok ? "success" : "error"](
        response.ok
          ? "Report submitted for review"
          : "Report could not be submitted",
      );
    });
  }

  return (
    <div className="flex gap-2.5">
      <Avatar
        src={comment.author.avatar}
        name={comment.author.name}
        className="size-8"
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs">
          <strong>{comment.author.name}</strong>
          <span className="text-muted-foreground">
            {" "}
            -{" "}
            <span suppressHydrationWarning>
              {relativeDate(comment.createdAt)}
            </span>
          </span>
        </p>
        {editing ? (
          <div className="mt-2">
            <input
              aria-label="Edit comment"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="h-9 w-full rounded-md border bg-card px-3 text-sm outline-none focus:border-primary"
            />
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={saveComment}>
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setContent(comment.content);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-sm leading-5">{content}</p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-muted-foreground">
          <button
            onClick={() => voteComment(1)}
            disabled={voting}
            className={cn(
              "disabled:cursor-wait disabled:opacity-60",
              vote === 1 && "text-primary",
            )}
          >
            Upvote {score}
          </button>
          <button
            onClick={() => voteComment(-1)}
            disabled={voting}
            className={cn(
              "disabled:cursor-wait disabled:opacity-60",
              vote === -1 && "text-primary",
            )}
          >
            Downvote
          </button>
          <button
            onClick={() => setReplying(!replying)}
            className="flex items-center gap-1 hover:text-primary"
          >
            <Reply className="size-3" />
            Reply
          </button>
          <button onClick={reportComment} className="hover:text-primary">
            Report
          </button>
          {comment.canEdit && (
            <button
              onClick={() => setEditing(true)}
              className="hover:text-primary"
            >
              Edit
            </button>
          )}
          {comment.canEdit && (
            <button onClick={deleteComment} className="text-destructive">
              Delete
            </button>
          )}
        </div>
        {replying && (
          <form onSubmit={submitReply} className="mt-2 flex gap-2">
            <input
              aria-label={`Reply to ${comment.author.name}`}
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              placeholder="Reply"
              className="h-8 min-w-0 flex-1 rounded-md border bg-card px-2 text-xs outline-none focus:border-primary"
            />
            <Button size="sm" disabled={!reply.trim()}>
              Reply
            </Button>
          </form>
        )}
        {replies.length > 0 && (
          <div className="mt-3 space-y-3 border-l-2 pl-3">
            {replies.map((item) => (
              <CommentItem
                key={item.id}
                comment={item}
                answerId={answerId}
                publicMode={publicMode}
                onDelete={(id) =>
                  setReplies(replies.filter((replyItem) => replyItem.id !== id))
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
