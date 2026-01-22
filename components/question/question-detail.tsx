"use client";

// full question page: title, vote/follow, answers list, report dialog

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BellPlus,
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  Flag,
  MessageSquareText,
  Pencil,
  Plus,
  Search,
  Share2,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AnswerCard } from "@/components/question/answer-card";
import { AnswerEditor } from "@/components/question/answer-editor";
import { MarkdownContent } from "@/components/question/markdown-content";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useModalFocus } from "@/components/ui/use-modal-focus";
import type {
  AnswerRequestItem,
  PersonSummary,
  QuestionDetailData,
} from "@/lib/types";
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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reason, setReason] = useState("SPAM");
  const [reportDetails, setReportDetails] = useState("");
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(question.title);
  const [description, setDescription] = useState(question.description);
  const [selectedTopics, setSelectedTopics] = useState(question.topics);
  const [topicOptions, setTopicOptions] = useState(question.topicItems ?? []);
  const [topicSearch, setTopicSearch] = useState("");
  const [deleted, setDeleted] = useState(false);
  const [voting, setVoting] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requests, setRequests] = useState<AnswerRequestItem[]>(
    question.answerRequests ?? [],
  );
  const reportDialogRef = useModalFocus(reportOpen, () => setReportOpen(false));

  useEffect(() => {
    if (!editing) return;
    const controller = new AbortController();
    void fetch("/api/questions", { signal: controller.signal })
      .then((response) => response.json())
      .then(
        (payload: {
          ok?: boolean;
          data?: { topics: NonNullable<QuestionDetailData["topicItems"]> };
        }) => {
          if (payload.ok && payload.data) setTopicOptions(payload.data.topics);
        },
      )
      .catch(() => undefined);
    return () => controller.abort();
  }, [editing]);

  // sort answers on the client so the dropdown feels instant
  const answers = useMemo(() => {
    const items = [...question.answersList];
    if (sort === "Newest")
      return items.sort(
        (a, b) =>
          Number(Boolean(b.accepted)) - Number(Boolean(a.accepted)) ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    if (sort === "Oldest")
      return items.sort(
        (a, b) =>
          Number(Boolean(b.accepted)) - Number(Boolean(a.accepted)) ||
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    return items.sort(
      (a, b) =>
        Number(Boolean(b.accepted)) - Number(Boolean(a.accepted)) ||
        b.score - a.score,
    );
  }, [question.answersList, sort]);

  // prompt login if this page is opened as a guest
  function authAction(action: () => void | Promise<void>) {
    if (publicMode) {
      toast.info("Sign in to take part", {
        action: {
          label: "Sign in",
          onClick: () => {
            router.push("/login");
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
      body: JSON.stringify({
        questionId: question.id,
        reason,
        details: reportDetails || undefined,
      }),
    });
    if (!response.ok) {
      toast.error("Report could not be submitted");
      return;
    }
    setReportOpen(false);
    setReportDetails("");
    toast.success("Report submitted for review");
  }

  // authors and moderators can edit title, context, and topics
  function saveQuestion() {
    authAction(async () => {
      const response = await fetch(`/api/questions/${question.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, description, topics: selectedTopics }),
      });
      if (!response.ok) {
        toast.error("Question could not be updated");
        return;
      }
      setEditing(false);
      toast.success("Question updated");
      router.refresh();
    });
  }

  function toggleTopic(topic: string) {
    setSelectedTopics((current) =>
      current.includes(topic)
        ? current.filter((item) => item !== topic)
        : current.length < 5
          ? [...current, topic]
          : current,
    );
  }

  function deleteQuestion() {
    authAction(async () => {
      const response = await fetch(`/api/questions/${question.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        toast.error("Question could not be deleted");
        return;
      }
      setDeleteOpen(false);
      setDeleted(true);
      toast.success("Question deleted");
      router.push("/home");
    });
  }

  if (deleted) return null;

  return (
    <>
      <div className="space-y-4">
        <section className="border-y bg-card p-5 shadow-card sm:rounded-xl sm:border sm:p-7">
          <div className="flex flex-wrap gap-2">
            {selectedTopics.map((topic) => (
              <Badge key={topic}>{topic}</Badge>
            ))}
            {question.spaces?.map((space) => (
              <Link href={`/spaces/${space.slug}`} key={space.slug}>
                <Badge className="border-primary/20 bg-primary/5 text-primary">
                  {space.name}
                </Badge>
              </Link>
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
              <div className="rounded-lg border p-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    aria-label="Search topics"
                    value={topicSearch}
                    onChange={(event) => setTopicSearch(event.target.value)}
                    placeholder="Search topics"
                    className="h-10 w-full rounded-lg border bg-muted/30 pl-9 pr-3 text-sm outline-none focus:border-primary"
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedTopics.map((topic) => (
                    <button
                      type="button"
                      key={topic}
                      onClick={() => toggleTopic(topic)}
                      className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      {topic}
                    </button>
                  ))}
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {topicOptions
                    .filter((topic) =>
                      topic.name
                        .toLowerCase()
                        .includes(topicSearch.toLowerCase()),
                    )
                    .slice(0, 8)
                    .map((topic) => {
                      const selected = selectedTopics.includes(topic.name);
                      return (
                        <button
                          type="button"
                          key={topic.id ?? topic.slug}
                          onClick={() => toggleTopic(topic.name)}
                          className="flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs hover:bg-muted"
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {topic.name}
                          </span>
                          {selected ? (
                            <Check className="size-3.5 text-primary" />
                          ) : (
                            <Plus className="size-3.5 text-muted-foreground" />
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={saveQuestion}
                  disabled={
                    title.trim().length < 12 ||
                    !title.trim().endsWith("?") ||
                    selectedTopics.length === 0
                  }
                >
                  Save question
                </Button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="mt-4 font-serif text-4xl leading-tight">
                {title}
              </h1>
              {description && (
                <MarkdownContent
                  content={description}
                  className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground"
                />
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
              onClick={() => authAction(() => setRequestOpen(true))}
            >
              <Users className="size-4" />
              Request answer
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
            {question.canDelete && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete question"
                onClick={() => authAction(() => setDeleteOpen(true))}
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
            {requests.length > 0 && (
              <span>
                {requests.length} pending{" "}
                {requests.length === 1 ? "request" : "requests"}
              </span>
            )}
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
              questionId={question.id}
              onAccepted={() => router.refresh()}
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
        questionTopics={selectedTopics}
        onPublished={() => router.refresh()}
      />
      <AnswerRequestDialog
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        questionId={question.id}
        questionSlug={question.slug}
        questionTitle={title}
        requester={question.author}
        existingRequests={requests}
        onRequested={(request) =>
          setRequests((current) => [request, ...current])
        }
      />
      {deleteOpen && (
        <DeleteQuestionDialog
          onCancel={() => setDeleteOpen(false)}
          onConfirm={deleteQuestion}
        />
      )}
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
            <label className="mt-4 block text-sm font-semibold">
              Details
              <textarea
                value={reportDetails}
                onChange={(event) => setReportDetails(event.target.value)}
                maxLength={2000}
                className="mt-1.5 min-h-24 w-full rounded-lg border bg-card p-3 text-sm font-normal leading-6 outline-none focus:border-primary"
                placeholder="Add context, links, or what moderators should review"
              />
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

function DeleteQuestionDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useModalFocus(true, onCancel);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
      <section
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-question-title"
        className="w-full max-w-sm rounded-xl border bg-card p-5 shadow-2xl"
      >
        <Trash2 className="size-9 text-destructive" />
        <h2 id="delete-question-title" className="mt-4 text-lg font-bold">
          Delete question
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This removes the question from feeds and topic pages.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </div>
      </section>
    </div>
  );
}

function AnswerRequestDialog({
  open,
  onClose,
  questionId,
  questionSlug,
  questionTitle,
  requester,
  existingRequests,
  onRequested,
}: {
  open: boolean;
  onClose: () => void;
  questionId: string;
  questionSlug: string;
  questionTitle: string;
  requester: QuestionDetailData["author"];
  existingRequests: AnswerRequestItem[];
  onRequested: (request: AnswerRequestItem) => void;
}) {
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [sendingId, setSendingId] = useState("");
  const [sentIds, setSentIds] = useState(
    () =>
      new Set(
        existingRequests
          .map((request) => request.requestedUser?.id)
          .filter((id): id is string => Boolean(id)),
      ),
  );
  const dialogRef = useModalFocus(open, onClose);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const value = query.trim();
    const timer = window.setTimeout(
      () => {
        const params = new URLSearchParams({ questionId });
        if (value.length >= 2) params.set("q", value);
        setLoading(true);
        void fetch(`/api/answer-requests?${params.toString()}`, {
          signal: controller.signal,
        })
          .then((response) => response.json())
          .then(
            (payload: {
              ok?: boolean;
              data?: { people: PersonSummary[] };
              error?: { message: string };
            }) => {
              if (!payload.ok || !payload.data)
                throw new Error(
                  payload.error?.message ?? "Could not load people",
                );
              setPeople(payload.data.people);
            },
          )
          .catch((error) => {
            if (error instanceof DOMException && error.name === "AbortError")
              return;
            toast.error(
              error instanceof Error ? error.message : "Could not load people",
            );
          })
          .finally(() => {
            if (!controller.signal.aborted) setLoading(false);
          });
      },
      value.length >= 2 ? 200 : 0,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, questionId, query]);

  async function requestAnswer(person: PersonSummary) {
    if (!person.id || sentIds.has(person.id) || sendingId) return;
    setSendingId(person.id);
    try {
      const response = await fetch("/api/answer-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          questionId,
          userId: person.id,
          message: message || undefined,
        }),
      });
      const result = (await response.json()) as {
        ok: boolean;
        data?: { id: string; status: "PENDING" | "ANSWERED" | "DISMISSED" };
        error?: { message: string };
      };
      if (!response.ok || !result.ok || !result.data)
        throw new Error(result.error?.message ?? "Request could not be sent");
      setSentIds((current) => new Set(current).add(person.id!));
      onRequested({
        id: result.data.id,
        questionId,
        questionSlug,
        questionTitle,
        requester,
        requestedUser: person,
        status: result.data.status,
        message: message || null,
        createdAt: new Date().toISOString(),
      });
      toast.success(`Requested ${person.name}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Request could not be sent",
      );
    } finally {
      setSendingId("");
    }
  }

  if (!open) return null;

  const filteredPeople = people.filter((person) =>
    `${person.name} ${person.username} ${person.headline}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-slate-950/50 sm:place-items-center sm:p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="answer-request-title"
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border bg-card shadow-2xl sm:rounded-2xl"
      >
        <header className="flex items-start gap-3 border-b p-4 sm:p-5">
          <div className="min-w-0 flex-1">
            <h2 id="answer-request-title" className="text-lg font-bold">
              Request an answer
            </h2>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {questionTitle}
            </p>
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full hover:bg-muted"
          >
            <X className="size-5" />
          </button>
        </header>
        <div className="border-b p-4 sm:p-5">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              aria-label="Search users"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search users to request"
              className="h-10 w-full rounded-lg border bg-muted/30 pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <textarea
            aria-label="Optional request message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Add a short context note"
            className="mt-3 min-h-20 w-full rounded-lg border bg-card p-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {filteredPeople.map((person) => {
            const sent = Boolean(person.id && sentIds.has(person.id));
            return (
              <div
                key={person.id ?? person.username}
                className="flex items-center gap-3 border-b p-4 last:border-0"
              >
                <Avatar
                  src={person.avatar}
                  name={person.name}
                  className="size-10"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {person.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {person.credential ?? person.headline}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {compactNumber(person.reputation ?? 0)} rep -{" "}
                    {compactNumber(person.answers)} answers
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={sent ? "outline" : "default"}
                  disabled={sent || sendingId === person.id}
                  onClick={() => requestAnswer(person)}
                >
                  {sent ? "Requested" : "Request"}
                </Button>
              </div>
            );
          })}
          {loading && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading suggestions...
            </div>
          )}
          {!loading && filteredPeople.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {query.trim().length >= 2
                ? "No eligible users found for this search."
                : "No suggested users found for this question."}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
