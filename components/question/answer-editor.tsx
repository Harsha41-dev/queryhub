"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Code2,
  Eye,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { MarkdownContent } from "@/components/question/markdown-content";
import { Button } from "@/components/ui/button";
import { useModalFocus } from "@/components/ui/use-modal-focus";
import { cn } from "@/lib/utils";

const tools = [
  { icon: Heading2, label: "Heading", before: "## ", after: "" },
  { icon: Bold, label: "Bold", before: "**", after: "**" },
  { icon: Italic, label: "Italic", before: "_", after: "_" },
  { icon: List, label: "Bulleted list", before: "- ", after: "" },
  { icon: ListOrdered, label: "Numbered list", before: "1. ", after: "" },
  { icon: Quote, label: "Quote", before: "> ", after: "" },
  { icon: Link2, label: "Link", before: "[", after: "](https://)" },
  { icon: Code2, label: "Code block", before: "```\n", after: "\n```" },
];

export function AnswerEditor({
  open,
  onClose,
  questionTitle,
  questionId,
  onPublished,
}: {
  open: boolean;
  onClose: () => void;
  questionTitle: string;
  questionId?: string;
  onPublished?: () => void;
}) {
  const key = `queryhub-answer-${questionTitle.slice(0, 32)}`;
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useModalFocus(open, onClose);
  useEffect(() => {
    if (open) queueMicrotask(() => setContent(localStorage.getItem(key) ?? ""));
  }, [key, open]);
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => localStorage.setItem(key, content), 500);
    return () => clearTimeout(timer);
  }, [content, key, open]);
  function insert(before: string, after: string) {
    const textarea = ref.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = `${content.slice(0, start)}${before}${content.slice(start, end)}${after}${content.slice(end)}`;
    setContent(value);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    });
  }
  async function publish() {
    if (content.trim().length < 40) {
      toast.error("Add a little more detail before publishing");
      return;
    }
    setPublishing(true);
    try {
      if (!questionId) throw new Error("Choose a question before publishing");
      const response = await fetch("/api/answers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ questionId, content }),
      });
      const result = (await response.json()) as {
        ok: boolean;
        error?: { message: string };
      };
      if (!response.ok || !result.ok)
        throw new Error(
          result.error?.message ?? "Could not publish your answer",
        );
      localStorage.removeItem(key);
      onClose();
      toast.success("Your answer was published");
      onPublished?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not publish your answer",
      );
    } finally {
      setPublishing(false);
    }
  }
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-slate-950/45 sm:place-items-center sm:p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Write an answer"
        className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border bg-card shadow-2xl sm:rounded-2xl"
      >
        <header className="flex items-start gap-4 border-b p-4 sm:p-5">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              Your answer to
            </p>
            <h2 className="mt-1 line-clamp-2 font-bold sm:text-lg">
              {questionTitle}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close editor"
            className="grid size-9 place-items-center rounded-full hover:bg-muted"
          >
            <X className="size-5" />
          </button>
        </header>
        <div className="flex items-center gap-0.5 overflow-x-auto border-b bg-muted/30 p-2 scrollbar-none">
          {tools.map(({ icon: Icon, label, before, after }) => (
            <button
              key={label}
              type="button"
              title={label}
              aria-label={label}
              onClick={() => insert(before, after)}
              className="grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
            >
              <Icon className="size-4" />
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-border" />
          <button
            type="button"
            onClick={() => setPreview(!preview)}
            className={cn(
              "flex h-9 items-center gap-2 rounded-md px-3 text-xs font-semibold text-muted-foreground hover:bg-card",
              preview && "bg-card text-primary",
            )}
          >
            <Eye className="size-4" />
            {preview ? "Edit" : "Preview"}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {preview ? (
            content ? (
              <MarkdownContent
                content={content}
                className="min-h-[340px] whitespace-pre-wrap p-5 text-sm leading-7 sm:p-7"
              />
            ) : (
              <div className="min-h-[340px] p-5 text-sm text-muted-foreground sm:p-7">
                Nothing to preview yet.
              </div>
            )
          ) : (
            <textarea
              aria-label="Answer content"
              ref={ref}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              autoFocus
              className="min-h-[340px] w-full resize-none bg-card p-5 text-[15px] leading-7 outline-none sm:p-7"
              placeholder="Write from experience, explain your reasoning, and link to reliable sources where useful…"
            />
          )}
        </div>
        <footer className="flex items-center gap-3 border-t bg-muted/30 px-4 py-3 sm:px-5">
          <span className="mr-auto text-xs text-muted-foreground">
            Draft saved · {content.length.toLocaleString()} characters
          </span>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={publish}
            disabled={publishing || content.trim().length < 40}
          >
            <Send className="size-4" />
            {publishing ? "Publishing…" : "Publish answer"}
          </Button>
        </footer>
      </section>
    </div>
  );
}
