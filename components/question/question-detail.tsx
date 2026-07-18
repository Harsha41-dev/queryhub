"use client";

// full question page: title, vote/follow, answers list, report dialog

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BellPlus,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Eye,
  Flag,
  MessageSquareText,
  Pencil,
  Share2,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AnswerCard } from "@/components/question/answer-card";
import { AnswerEditor } from "@/components/question/answer-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useModalFocus } from "@/components/ui/use-modal-focus";
import type { QuestionDetailData } from "@/lib/types";
import { compactNumber, relativeDate } from "@/lib/utils";

export function QuestionDetail({
  question,
  publicMode = false,
}: {
  question: QuestionDetailData;
  publicMode?: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(question.followed ?? false);
  const [editor, setEditor] = useState(false);
  const [sort, setSort] = useState("Top");
  const [vote, setVote] = useState<-1 | 0 | 1>(question.userVote ?? 0);
  const [score, setScore] = useState(question.score);
  const [saved, setSaved] = useState(question.bookmarked ?? false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("SPAM");
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(question.title);
  const [description, setDescription] = useState(question.description);
  const [deleted, setDeleted] = useState(false);
  const [voting, setVoting] = useState(false);
  const reportDialogRef = useModalFocus(reportOpen, () => setReportOpen(false));

  // sort answers on the client so the dropdown feels instant
  const answers = useMemo(() => {
    const items = [...question.answersList];
    if (sort === "Newest")
      return items.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    if (sort === "Oldest")
      return items.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    return items.sort((a, b) => b.score - a.score);
  }, [question.answersList, sort]);

  // prompt login if this page is opened as a guest
  function authAction(action: () => void | Promise<void>) {
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

  // click same arrow again = remove vote
  function updateVote(next: -1 | 1) {
    authAction(async () => {
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
          body: JSON.stringify({ questionId: question.id, value: actual }),
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
    authAction(async () => {
      const previous = saved;
      setSaved(!saved);
      const response = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ questionId: question.id }),
      });
      if (!response.ok) {
        setSaved(previous);
        toast.error("Bookmark could not be saved");
        return;
      }
      toast.success(previous ? "Removed from bookmarks" : "Question saved");
    });
  }

  function toggleFollow() {
    authAction(async () => {
      const previous = following;
      setFollowing(!following);
      const response = await fetch("/api/follows", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ questionId: question.id }),
      });
      if (!response.ok) {
        setFollowing(previous);
        toast.error("Follow could not be saved");
        return;
      }
      toast.success(previous ? "Question unfollowed" : "Following question");
    });
  }

  async function share() {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Question link copied");
  }

  // report dialog submit
  async function report() {
    const response = await fetch("/api/reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ questionId: question.id, reason }),
    });
    if (!response.ok) {
      toast.error("Report could not be submitted");
      return;
    }
    setReportOpen(false);
    toast.success("Report submitted for review");
  }

  // only the author can edit title/description
  function saveQuestion() {
    authAction(async () => {
      const response = await fetch(`/api/questions/${question.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      if (!response.ok) {
        toast.error("Question could not be updated");
        return;
      }
      setEditing(false);
      toast.success("Question updated");
    });
  }

  function deleteQuestion() {
    authAction(async () => {
      if (!window.confirm("Delete this question?")) return;
      const response = await fetch(`/api/questions/${question.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        toast.error("Question could not be deleted");
        return;
      }
      setDeleted(true);
      toast.success("Question deleted");
      window.location.href = "/home";
    });
  }

  if (deleted) return null;

  return (
    <>
      <div className="space-y-4">
        <section className="border-y bg-card p-5 shadow-card sm:rounded-xl sm:border sm:p-7">
          <div className="flex flex-wrap gap-2">
            {question.topics.map((topic) => (
              <Badge key={topic}>{topic}</Badge>
            ))}
          </div>
          {editing ? (
            <div className="mt-4 space-y-3">
              <input
                aria-label="Question title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="h-11 w-full rounded-lg border bg-card px-3 text-lg font-bold outline-none focus:border-primary"
              />
              <textarea
                aria-label="Question context"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="min-h-28 w-full rounded-lg border bg-card p-3 text-sm leading-6 outline-none focus:border-primary"
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={saveQuestion}
                  disabled={
                    title.trim().length < 12 || !title.trim().endsWith("?")
                  }
                >
                  Save question
                </Button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="mt-4 text-balance text-2xl font-extrabold leading-tight tracking-tight sm:text-[30px]">
                {title}
              </h1>
              {description && (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                  {description}
                </p>
              )}
              <p
                suppressHydrationWarning
                className="mt-3 text-xs text-muted-foreground"
              >
                Asked by{" "}
                <Link
                  className="font-semibold text-primary"
                  href={`/profile/${question.author.username}`}
                >
                  {question.author.name}
                </Link>{" "}
                - {relativeDate(question.publishedAt)}
              </p>
            </>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button onClick={() => authAction(() => setEditor(true))}>
              <MessageSquareText className="size-4" />
              Answer
            </Button>
            <Button
              variant="outline"
              onClick={toggleFollow}
              className={
                following ? "border-primary/30 bg-primary/5 text-primary" : ""
              }
            >
              <BellPlus className="size-4" />
              {following ? "Following" : "Follow"}
            </Button>
            <div className="flex h-10 overflow-hidden rounded-lg border">
              <button
                aria-label="Upvote question"
                aria-pressed={vote === 1}
                disabled={voting}
                onClick={() => updateVote(1)}
                className={`flex items-center gap-1 px-3 text-xs font-bold disabled:cursor-wait disabled:opacity-60 ${vote === 1 ? "bg-primary/10 text-primary" : ""}`}
              >
                <ChevronUp className="size-4" />
                {compactNumber(score)}
              </button>
              <button
                aria-label="Downvote question"
                aria-pressed={vote === -1}
                disabled={voting}
                onClick={() => updateVote(-1)}
                className={`border-l px-2 disabled:cursor-wait disabled:opacity-60 ${vote === -1 ? "bg-primary/10 text-primary" : ""}`}
              >
                <ChevronDown className="size-4" />
              </button>
            </div>
            <Button variant="ghost" onClick={share}>
              <Share2 className="size-4" />
              Share
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={saved ? "Remove bookmark" : "Save question"}
              onClick={toggleBookmark}
              className={saved ? "text-primary" : ""}
            >
              <Bookmark className={`size-4 ${saved ? "fill-current" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Report question"
              onClick={() => authAction(() => setReportOpen(true))}
            >
              <Flag className="size-4" />
            </Button>
            {question.canEdit && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Edit question"
                onClick={() => setEditing(true)}
              >
                <Pencil className="size-4" />
              </Button>
            )}
            {question.canEdit && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete question"
                onClick={deleteQuestion}
                className="text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
          <div className="mt-5 flex items-center gap-4 border-t pt-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <MessageSquareText className="size-3.5" />
              {answers.length} answers
            </span>
            <span className="flex items-center gap-1.5">
              <Eye className="size-3.5" />
              {compactNumber(question.views)} views
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="size-3.5" />
              {compactNumber(question.followerCount ?? 0)} followers
            </span>
          </div>
        </section>
        <div className="flex items-center justify-between px-4 sm:px-1">
          <h2 className="text-sm font-bold">{answers.length} answers</h2>
          <label className="relative">
            <span className="sr-only">Sort answers</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className="h-9 appearance-none rounded-lg border bg-card py-1 pl-3 pr-8 text-xs font-semibold outline-none focus:border-primary"
            >
              <option>Top</option>
              <option>Newest</option>
              <option>Oldest</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2" />
          </label>
        </div>
        {answers.length > 0 ? (
          answers.map((answer) => (
            <AnswerCard
              key={answer.id}
              answer={answer}
              publicMode={publicMode}
            />
          ))
        ) : (
          <section className="border-y bg-card p-10 text-center sm:rounded-xl sm:border">
            <MessageSquareText className="mx-auto size-10 text-primary/50" />
            <h2 className="mt-3 font-bold">Be the first to answer</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Share your experience and help the next person who finds this
              question.
            </p>
            <Button
              className="mt-4"
              onClick={() => authAction(() => setEditor(true))}
            >
              Write an answer
            </Button>
          </section>
        )}
      </div>
      <AnswerEditor
        open={editor}
        onClose={() => setEditor(false)}
        questionTitle={title}
        questionId={question.id}
        onPublished={() => router.refresh()}
      />
      {reportOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <section
            ref={reportDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-question-title"
            className="w-full max-w-md rounded-2xl border bg-card p-6"
          >
            <div className="flex items-center">
              <h2 id="report-question-title" className="text-lg font-bold">
                Report question
              </h2>
              <button
                className="ml-auto"
                onClick={() => setReportOpen(false)}
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Reports are confidential and reviewed by the moderation team.
            </p>
            <label className="mt-4 block text-sm font-semibold">
              Reason
              <select
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="mt-1.5 h-11 w-full rounded-lg border bg-card px-3 font-normal"
              >
                <option value="SPAM">Spam</option>
                <option value="HARASSMENT">Harassment</option>
                <option value="MISINFORMATION">Misinformation</option>
                <option value="HATE_ABUSE">Hate or abusive content</option>
                <option value="COPYRIGHT">Copyright issue</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setReportOpen(false)}>
                Cancel
              </Button>
              <Button onClick={report}>Submit report</Button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
