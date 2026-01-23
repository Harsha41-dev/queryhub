"use client";

import { useState } from "react";
import { Check, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CredentialSummary, TopicSummary } from "@/lib/types";

type FormState = {
  id?: string;
  label: string;
  organization: string;
  url: string;
  topicId: string;
  isDefault: boolean;
};

const emptyForm: FormState = {
  label: "",
  organization: "",
  url: "",
  topicId: "",
  isDefault: true,
};

export function CredentialForm({
  initialCredentials,
  topics,
}: {
  initialCredentials: CredentialSummary[];
  topics: TopicSummary[];
}) {
  const [credentials, setCredentials] = useState(initialCredentials);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function refreshCredentials() {
    const response = await fetch("/api/settings/credentials");
    const result = (await response.json()) as {
      ok: boolean;
      data?: { credentials: CredentialSummary[] };
    };
    if (result.ok && result.data) setCredentials(result.data.credentials);
  }

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/settings/credentials", {
        method: form.id ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: form.id,
          label: form.label,
          organization: form.organization,
          url: form.url,
          topicId: form.topicId || undefined,
          isDefault: form.isDefault,
        }),
      });
      const result = (await response.json()) as {
        ok: boolean;
        error?: { message: string };
      };
      if (!response.ok || !result.ok)
        throw new Error(result.error?.message ?? "Credential could not save");
      await refreshCredentials();
      setForm(emptyForm);
      toast.success("Credential saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Credential could not save",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteCredential(id: string) {
    const previous = credentials;
    setCredentials(credentials.filter((credential) => credential.id !== id));
    const response = await fetch("/api/settings/credentials", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!response.ok) {
      setCredentials(previous);
      toast.error("Credential could not be deleted");
      return;
    }
    toast.success("Credential deleted");
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-xl border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-bold">Answer credentials</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Credentials appear beside your answers and can be scoped to a topic.
        </p>
        <div className="mt-5 space-y-3">
          {credentials.map((credential) => (
            <article key={credential.id} className="rounded-lg border p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{credential.label}</p>
                    {credential.isDefault && (
                      <Badge className="border-primary/20 bg-primary/5 text-primary">
                        Default
                      </Badge>
                    )}
                    {credential.topic && <Badge>{credential.topic.name}</Badge>}
                  </div>
                  {(credential.organization || credential.url) && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[credential.organization, credential.url]
                        .filter(Boolean)
                        .join(" - ")}
                    </p>
                  )}
                </div>
                <button
                  aria-label="Edit credential"
                  onClick={() =>
                    setForm({
                      id: credential.id,
                      label: credential.label,
                      organization: credential.organization ?? "",
                      url: credential.url ?? "",
                      topicId: credential.topic?.id ?? "",
                      isDefault: credential.isDefault,
                    })
                  }
                  className="grid size-8 place-items-center rounded-md hover:bg-muted"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  aria-label="Delete credential"
                  onClick={() => deleteCredential(credential.id)}
                  className="grid size-8 place-items-center rounded-md text-destructive hover:bg-muted"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </article>
          ))}
          {credentials.length === 0 && (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Add a credential to make your answers feel more trustworthy.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-bold">
          {form.id ? "Edit credential" : "New credential"}
        </h2>
        <div className="mt-5 space-y-4">
          <label className="block text-sm font-semibold">
            Credential
            <Input
              className="mt-1.5"
              value={form.label}
              onChange={(event) => update("label", event.target.value)}
              placeholder="Software Engineer at X"
            />
          </label>
          <label className="block text-sm font-semibold">
            Organization
            <Input
              className="mt-1.5"
              value={form.organization}
              onChange={(event) => update("organization", event.target.value)}
              placeholder="Company, college, or group"
            />
          </label>
          <label className="block text-sm font-semibold">
            Verification link
            <Input
              className="mt-1.5"
              value={form.url}
              onChange={(event) => update("url", event.target.value)}
              placeholder="https://..."
            />
          </label>
          <label className="block text-sm font-semibold">
            Topic
            <select
              value={form.topicId}
              onChange={(event) => update("topicId", event.target.value)}
              className="mt-1.5 h-11 w-full rounded-lg border bg-card px-3 text-sm outline-none focus:border-primary"
            >
              <option value="">All topics</option>
              {topics.map((topic) => (
                <option key={topic.id ?? topic.slug} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-3 text-sm font-semibold">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(event) => update("isDefault", event.target.checked)}
              className="size-4 rounded border"
            />
            Use as default credential
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          {form.id && (
            <Button variant="ghost" onClick={() => setForm(emptyForm)}>
              Cancel
            </Button>
          )}
          <Button
            onClick={save}
            disabled={saving || form.label.trim().length < 4}
          >
            <Check className="size-4" />
            Save credential
          </Button>
        </div>
      </section>
    </div>
  );
}
