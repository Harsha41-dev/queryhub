"use client";

// "Ask a question" modal: write question and pick topics.

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  Image as ImageIcon,
  Lightbulb,
  Plus,
  Search,
  Tags,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useModalFocus } from "@/components/ui/use-modal-focus";
import type { TopicSummary } from "@/lib/types";
import { contrastTextColor } from "@/lib/utils";
import { questionSchema, type QuestionInput } from "@/lib/validators";

const DRAFT_KEY = "queryhub-question-draft";

export function QuestionDialog({
  open,
  onClose,
  publicMode,
}: {
  open: boolean;
  onClose: () => void;
  publicMode?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [topicSearch, setTopicSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [topicOptions, setTopicOptions] = useState<TopicSummary[]>([]);
  const [duplicates, setDuplicates] = useState<
    Array<{ id: string; slug: string; title: string; score?: number }>
  >([]);
  const [serverWarnings, setServerWarnings] = useState<string[]>([]);
  const form = useForm<QuestionInput>({
    resolver: zodResolver(questionSchema),
    defaultValues: { title: "", description: "", topics: [] },
  });
  const title = useWatch({ control: form.control, name: "title" }) ?? "";
  const description =
    useWatch({ control: form.control, name: "description" }) ?? "";
  const selectedTopics =
    useWatch({ control: form.control, name: "topics" }) ?? [];
  const draftValues = useWatch({ control: form.control });
  const dialogRef = useModalFocus(open, onClose);

  // restore draft if the user closed the modal earlier
  useEffect(() => {
    if (!open) return;
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        const parsed = questionSchema.safeParse(JSON.parse(saved));
        if (parsed.success) form.reset(parsed.data);
        else localStorage.removeItem(DRAFT_KEY);
      } catch {
        localStorage.removeItem(DRAFT_KEY);
      }
    }
  }, [form, open]);

  // load topic chips when the modal opens
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void fetch("/api/questions", { signal: controller.signal })
      .then((response) => response.json())
      .then((payload: { ok?: boolean; data?: { topics: TopicSummary[] } }) => {
        if (payload.ok && payload.data) setTopicOptions(payload.data.topics);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [open]);

  // keep typing saved so refresh doesn't wipe the draft
  useEffect(() => {
    if (!open) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draftValues));
  }, [draftValues, open]);

  // after a short pause, look for similar questions
  useEffect(() => {
    if (!open) return;
    if (title.trim().length < 8) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(`/api/questions?q=${encodeURIComponent(title.trim())}`, {
        signal: controller.signal,
      })
        .then((response) => response.json())
        .then(
          (payload: {
            ok?: boolean;
            data?: {
              suggestions: Array<{
                id: string;
                slug: string;
                title: string;
                score?: number;
              }>;
              qualityWarnings?: string[];
            };
          }) => {
            if (payload.ok && payload.data) {
              setDuplicates(payload.data.suggestions.slice(0, 3));
              setServerWarnings(payload.data.qualityWarnings ?? []);
            }
          },
        )
        .catch(() => undefined);
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, title]);

  const readyForQualityCheck = title.trim().length >= 8;
  const shownDuplicates = readyForQualityCheck ? duplicates : [];

  const filteredTopics = topicOptions.filter((topic) =>
    topic.name.toLowerCase().includes(topicSearch.toLowerCase()),
  );
  const questionText = `${title} ${description}`.toLowerCase();
  const suggestedTopics = topicOptions
    .filter(
      (topic) =>
        !selectedTopics.includes(topic.name) &&
        topic.name
          .toLowerCase()
          .split(/\s+/)
          .some((word) => word.length > 2 && questionText.includes(word)),
    )
    .slice(0, 5);
  const qualityWarnings = [
    ...(readyForQualityCheck ? serverWarnings : []),
    title.toLowerCase().startsWith("how") &&
      description.trim().length < 40 &&
      "Add context so answers can match your situation.",
  ]
    .filter((item): item is string => Boolean(item))
    .filter((item, index, list) => list.indexOf(item) === index);

  function toggleTopic(topic: string) {
    if (selectedTopics.includes(topic))
      form.setValue(
        "topics",
        selectedTopics.filter((item) => item !== topic),
        { shouldValidate: true },
      );
    else if (selectedTopics.length < 5)
      form.setValue("topics", [...selectedTopics, topic], {
        shouldValidate: true,
      });
  }

  async function uploadImage(file?: File) {
    if (!file) return;
    if (publicMode) {
      onClose();
      router.push(`/login?callbackUrl=${encodeURIComponent("/home")}`);
      return;
    }
    setUploading(true);
    const payload = new FormData();
    payload.set("image", file);
    try {
      const response = await fetch("/api/uploads/content", {
        method: "POST",
        body: payload,
      });
      const result = (await response.json()) as {
        ok: boolean;
        data?: { markdown: string };
        error?: { message: string };
      };
      if (!response.ok || !result.ok || !result.data)
        throw new Error(result.error?.message ?? "Image could not upload");
      const current = form.getValues("description") ?? "";
      form.setValue(
        "description",
        current.trim()
          ? `${current.trimEnd()}\n\n${result.data.markdown}\n`
          : `${result.data.markdown}\n`,
        { shouldDirty: true, shouldValidate: true },
      );
      toast.success("Image added to question");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Image could not upload",
      );
    } finally {
      setUploading(false);
    }
  }

  async function submit(values: QuestionInput) {
    if (publicMode) {
      onClose();
      router.push(`/login?callbackUrl=${encodeURIComponent("/home")}`);
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/questions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = (await response.json()) as {
        ok: boolean;
        data?: { slug: string };
        error?: { message: string };
      };
      if (!response.ok || !result.ok || !result.data)
        throw new Error(
          result.error?.message ?? "Could not publish the question",
        );
      localStorage.removeItem(DRAFT_KEY);
      toast.success("Your question is live", {
        description: "We will notify you when someone answers.",
      });
      form.reset();
      onClose();
      router.push(`/question/${result.data.slug}`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not publish the question",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-slate-950/45 p-0 backdrop-blur-[2px] sm:place-items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="question-dialog-title"
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border bg-card shadow-2xl sm:max-w-2xl sm:rounded-2xl"
      >
        <header className="flex items-center border-b px-4 py-3 sm:px-6">
          {step === 2 && (
            <button
              onClick={() => setStep(1)}
              aria-label="Back"
              className="mr-2 grid size-8 place-items-center rounded-full hover:bg-muted"
            >
              <ChevronLeft className="size-5" />
            </button>
          )}
          <div>
            <h2 id="question-dialog-title" className="font-bold">
              {step === 1 ? "Ask the community" : "Add topics"}
            </h2>
            <p className="text-xs text-muted-foreground">Step {step} of 2</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="ml-auto grid size-9 place-items-center rounded-full hover:bg-muted"
          >
            <X className="size-5" />
          </button>
        </header>
        <form
          onSubmit={form.handleSubmit(submit)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="overflow-y-auto p-4 sm:p-6">
            {step === 1 ? (
              <div className="space-y-5">
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex gap-3">
                    <Lightbulb className="mt-0.5 size-5 shrink-0 text-primary" />
                    <div>
                      <p className="text-sm font-semibold">
                        A strong question invites a useful answer
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Be specific, check your assumptions, and add context
                        that helps people understand what you need.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="block">
                  <span className="mb-2 flex justify-between text-sm font-semibold">
                    <span>Question</span>
                    <span className="font-normal text-muted-foreground">
                      {title.length}/240
                    </span>
                  </span>
                  <Textarea
                    autoFocus
                    rows={3}
                    maxLength={240}
                    placeholder="What would you like to understand better?"
                    className="min-h-24 text-base font-medium"
                    {...form.register("title")}
                    aria-invalid={!!form.formState.errors.title}
                  />
                  {form.formState.errors.title && (
                    <span
                      role="alert"
                      className="mt-1.5 block text-xs text-destructive"
                    >
                      {form.formState.errors.title.message}
                    </span>
                  )}
                </div>
                {qualityWarnings.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                    <div className="flex gap-2">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      <div className="space-y-1 text-xs leading-5">
                        {qualityWarnings.map((warning) => (
                          <p key={warning}>{warning}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {shownDuplicates.length > 0 && (
                  <div className="rounded-xl border p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Similar questions
                    </p>
                    <div className="mt-2 divide-y">
                      {shownDuplicates.map((item) => (
                        <a
                          key={item.id}
                          href={`/question/${item.slug}`}
                          className="block py-2 text-sm font-medium hover:text-primary"
                        >
                          {item.title}
                          {item.score !== undefined && (
                            <span className="ml-2 text-[11px] font-semibold text-muted-foreground">
                              {Math.round(item.score * 100)}% similar
                            </span>
                          )}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                <div className="block">
                  <span className="mb-2 block text-sm font-semibold">
                    Context{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </span>
                  <Textarea
                    aria-label="Question context"
                    rows={5}
                    maxLength={5000}
                    placeholder="Share what you already know or why you're asking..."
                    {...form.register("description")}
                  />
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">
                      {description.length}/5000
                    </span>
                    <label>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        disabled={uploading || submitting}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.currentTarget.value = "";
                          void uploadImage(file);
                        }}
                      />
                      <span
                        aria-disabled={uploading || submitting}
                        className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-xs font-semibold hover:bg-muted aria-disabled:cursor-wait aria-disabled:opacity-60"
                      >
                        <ImageIcon className="size-4" />
                        {uploading ? "Uploading..." : "Add image"}
                      </span>
                    </label>
                  </div>
                </div>
                {suggestedTopics.length > 0 && (
                  <div className="rounded-xl border p-3">
                    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      <Tags className="size-3.5" />
                      Suggested topics
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {suggestedTopics.map((topic) => (
                        <button
                          key={topic.id ?? topic.slug}
                          type="button"
                          onClick={() => toggleTopic(topic.name)}
                          className="rounded-full border px-3 py-1.5 text-xs font-semibold hover:border-primary hover:text-primary"
                        >
                          {topic.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Topics help the right people find your question. Choose up to
                  five.
                </p>
                <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    aria-label="Search topics"
                    value={topicSearch}
                    onChange={(event) => setTopicSearch(event.target.value)}
                    placeholder="Search topics"
                    className="pl-9"
                  />
                </div>
                {selectedTopics.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedTopics.map((topic) => (
                      <button
                        type="button"
                        key={topic}
                        onClick={() => toggleTopic(topic)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        {topic}
                        <X className="size-3" />
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-5 space-y-2">
                  {filteredTopics.map((topic) => {
                    const selected = selectedTopics.includes(topic.name);
                    return (
                      <button
                        type="button"
                        key={topic.slug}
                        onClick={() => toggleTopic(topic.name)}
                        className="flex w-full items-center gap-3 rounded-xl border p-3 text-left hover:bg-muted"
                      >
                        <span
                          className="grid size-10 place-items-center rounded-lg text-xs font-black"
                          style={{
                            backgroundColor: topic.accent,
                            color: contrastTextColor(topic.accent),
                          }}
                        >
                          {topic.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">
                            {topic.name}
                          </span>
                          <span className="line-clamp-1 text-xs text-muted-foreground">
                            {topic.description}
                          </span>
                        </span>
                        <span
                          className={`grid size-6 place-items-center rounded-full border ${selected ? "border-primary bg-primary text-white" : "text-muted-foreground"}`}
                        >
                          {selected ? (
                            <Check className="size-3.5" />
                          ) : (
                            <Plus className="size-3.5" />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {form.formState.errors.topics && (
                  <span
                    role="alert"
                    className="mt-3 block text-xs text-destructive"
                  >
                    {form.formState.errors.topics.message}
                  </span>
                )}
              </div>
            )}
          </div>
          <footer className="flex items-center justify-between border-t bg-muted/30 px-4 py-3 sm:px-6">
            <span className="text-xs text-muted-foreground">
              Draft saved automatically
            </span>
            {step === 1 ? (
              <Button
                type="button"
                onClick={async () => {
                  const valid = await form.trigger(["title", "description"]);
                  if (valid) setStep(2);
                }}
              >
                Continue
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={
                  submitting || uploading || selectedTopics.length === 0
                }
              >
                {submitting
                  ? "Publishing..."
                  : publicMode
                    ? "Sign in to publish"
                    : "Publish question"}
              </Button>
            )}
          </footer>
        </form>
      </section>
    </div>
  );
}
