"use client";

// modal for writing an answer (simple markdown toolbar + preview)

import Link from "next/link";
import { type DragEvent, useEffect, useRef, useState } from "react";
import {
  Bold,
  Code2,
  Eye,
  Heading2,
  Italic,
  Image as ImageIcon,
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
import type { CredentialSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

// wrap selected text with markdown markers
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
  questionTopics = [],
  onPublished,
}: {
  open: boolean;
  onClose: () => void;
  questionTitle: string;
  questionId?: string;
  questionTopics?: string[];
  onPublished?: () => void;
}) {
  const key = `queryhub-answer-${questionTitle.slice(0, 32)}`;
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageAlt, setImageAlt] = useState("");
  const [imageCaption, setImageCaption] = useState("");
  const [credentials, setCredentials] = useState<CredentialSummary[]>([]);
  const [credentialId, setCredentialId] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const dialogRef = useModalFocus(open, onClose);
  useEffect(() => {
    if (open) queueMicrotask(() => setContent(localStorage.getItem(key) ?? ""));
  }, [key, open]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void fetch("/api/settings/credentials", { signal: controller.signal })
      .then((response) => response.json())
      .then(
        (payload: {
          ok?: boolean;
          data?: { credentials: CredentialSummary[] };
        }) => {
          if (!payload.ok || !payload.data) return;
          setCredentials(payload.data.credentials);
          const topicCredential = payload.data.credentials.find(
            (item) => item.topic && questionTopics.includes(item.topic.name),
          );
          const defaultCredential =
            topicCredential ??
            payload.data.credentials.find((item) => item.isDefault) ??
            payload.data.credentials[0];
          setCredentialId(defaultCredential?.id ?? "");
        },
      )
      .catch(() => undefined);
    return () => controller.abort();
  }, [open, questionTopics]);
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

  function chooseImage(file?: File) {
    if (!file) return;
    setImageFile(file);
    setImageAlt(
      file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[-_]+/g, " ")
        .trim(),
    );
    setImageCaption("");
    setImageDialogOpen(true);
  }

  function cancelImageDialog() {
    setImageDialogOpen(false);
    setImageFile(null);
    setImageAlt("");
    setImageCaption("");
    if (imageRef.current) imageRef.current.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    chooseImage(
      [...event.dataTransfer.files].find((file) =>
        ["image/jpeg", "image/png", "image/webp"].includes(file.type),
      ),
    );
  }

  async function uploadImage() {
    if (!imageFile) return;
    setUploading(true);
    const form = new FormData();
    form.set("image", imageFile);
    form.set("alt", imageAlt);
    form.set("caption", imageCaption);
    try {
      const response = await fetch("/api/uploads/content", {
        method: "POST",
        body: form,
      });
      const result = (await response.json()) as {
        ok: boolean;
        data?: { markdown: string };
        error?: { message: string };
      };
      if (!response.ok || !result.ok || !result.data)
        throw new Error(result.error?.message ?? "Image could not be uploaded");
      setContent((current) =>
        current.trim()
          ? `${current.trimEnd()}\n\n${result.data!.markdown}\n`
          : `${result.data!.markdown}\n`,
      );
      toast.success("Image added to draft");
      cancelImageDialog();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Image could not be uploaded",
      );
    } finally {
      setUploading(false);
    }
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
        body: JSON.stringify({
          questionId,
          content,
          credentialId: credentialId || undefined,
        }),
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
          <button
            type="button"
            title="Upload image"
            aria-label="Upload image"
            disabled={publishing || uploading}
            onClick={() => imageRef.current?.click()}
            className="grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground disabled:cursor-wait disabled:opacity-60"
          >
            <ImageIcon className="size-4" />
          </button>
          <input
            ref={imageRef}
            type="file"
            className="sr-only"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => chooseImage(event.target.files?.[0])}
          />
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
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3 text-xs sm:px-5">
          <label className="flex min-w-0 flex-1 items-center gap-2">
            <span className="font-semibold text-muted-foreground">
              Credential
            </span>
            <select
              value={credentialId}
              onChange={(event) => setCredentialId(event.target.value)}
              className="h-8 min-w-0 flex-1 rounded-md border bg-card px-2 text-xs font-medium outline-none focus:border-primary sm:max-w-sm"
            >
              <option value="">No credential</option>
              {credentials.map((credential) => (
                <option key={credential.id} value={credential.id}>
                  {credential.topic
                    ? `${credential.label} - ${credential.topic.name}`
                    : credential.label}
                </option>
              ))}
            </select>
          </label>
          <Link
            href="/settings/credentials"
            className="font-semibold text-primary"
          >
            Manage
          </Link>
        </div>
        <div
          className={cn(
            "relative min-h-0 flex-1 overflow-y-auto",
            dragging && "bg-primary/5",
          )}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node))
              return;
            setDragging(false);
          }}
          onDrop={onDrop}
        >
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
              placeholder="Write from experience, explain your reasoning, and link to reliable sources where useful..."
            />
          )}
          {dragging && (
            <div className="pointer-events-none absolute inset-3 grid place-items-center rounded-xl border-2 border-dashed border-primary bg-card/80 text-sm font-semibold text-primary">
              Drop image to add it
            </div>
          )}
        </div>
        <footer className="flex items-center gap-3 border-t bg-muted/30 px-4 py-3 sm:px-5">
          <span className="mr-auto text-xs text-muted-foreground">
            {uploading
              ? "Uploading image..."
              : `Draft saved - ${content.length.toLocaleString()} characters`}
          </span>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={publish}
            disabled={publishing || uploading || content.trim().length < 40}
          >
            <Send className="size-4" />
            {publishing ? "Publishing..." : "Publish answer"}
          </Button>
        </footer>
      </section>
      {imageDialogOpen && (
        <ImageDetailsDialog
          fileName={imageFile?.name ?? "image"}
          alt={imageAlt}
          caption={imageCaption}
          uploading={uploading}
          onAltChange={setImageAlt}
          onCaptionChange={setImageCaption}
          onCancel={cancelImageDialog}
          onConfirm={() => void uploadImage()}
        />
      )}
    </div>
  );
}

function ImageDetailsDialog({
  fileName,
  alt,
  caption,
  uploading,
  onAltChange,
  onCaptionChange,
  onCancel,
  onConfirm,
}: {
  fileName: string;
  alt: string;
  caption: string;
  uploading: boolean;
  onAltChange: (value: string) => void;
  onCaptionChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useModalFocus(true, onCancel);
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/50 p-4">
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-details-title"
        className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl"
      >
        <h2 id="image-details-title" className="text-lg font-bold">
          Image details
        </h2>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {fileName}
        </p>
        <label className="mt-4 block text-sm font-semibold">
          Alt text
          <input
            value={alt}
            onChange={(event) => onAltChange(event.target.value)}
            className="mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm font-normal outline-none focus:border-primary"
            placeholder="Describe the image"
          />
        </label>
        <label className="mt-4 block text-sm font-semibold">
          Caption
          <input
            value={caption}
            onChange={(event) => onCaptionChange(event.target.value)}
            className="mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm font-normal outline-none focus:border-primary"
            placeholder="Optional caption"
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={uploading || !alt.trim()}>
            {uploading ? "Uploading..." : "Add image"}
          </Button>
        </div>
      </section>
    </div>
  );
}
