"use client";

// edit profile fields + avatar upload

import { useState } from "react";
import { CheckCircle2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ProfileInitial = {
  name: string;
  username: string;
  image?: string | null;
  bio?: string | null;
  location?: string | null;
  occupation?: string | null;
  website?: string | null;
};

export function ProfileForm({ initial }: { initial: ProfileInitial }) {
  const [bio, setBio] = useState(initial.bio ?? "");
  const [avatar, setAvatar] = useState(initial.image ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // send the image to /api/uploads/avatar
  async function uploadAvatar(file?: File) {
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.set("avatar", file);
    const response = await fetch("/api/uploads/avatar", {
      method: "POST",
      body: form,
    });
    const result = (await response.json()) as {
      ok: boolean;
      data?: { url: string };
      error?: { message: string };
    };
    setUploading(false);
    if (!response.ok || !result.ok || !result.data) {
      toast.error(result.error?.message ?? "The avatar could not be uploaded");
      return;
    }
    setAvatar(result.data.url);
    toast.success("Avatar uploaded");
  }

  async function removeAvatar() {
    setUploading(true);
    const response = await fetch("/api/uploads/avatar", { method: "DELETE" });
    setUploading(false);
    if (!response.ok) {
      toast.error("The avatar could not be removed");
      return;
    }
    setAvatar("");
    toast.success("Avatar removed");
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch("/api/settings/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = (await response.json()) as {
        ok: boolean;
        error?: { message: string };
      };
      if (!response.ok || !result.ok)
        throw new Error(result.error?.message ?? "Could not save your profile");
      toast.success("Profile updated", {
        icon: <CheckCircle2 className="size-4" />,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save your profile",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="rounded-xl border bg-card p-5 sm:p-6">
      <h2 className="text-lg font-bold">Public profile</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        This information appears next to your questions and answers.
      </p>
      <div className="mt-6 flex items-center gap-4">
        <Avatar src={avatar} name={initial.name} className="size-20" />
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border bg-card px-3 text-xs font-semibold hover:bg-muted">
            <Upload className="size-4" />
            {uploading ? "Processing…" : "Upload image"}
            <input
              type="file"
              className="sr-only"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={(event) => void uploadAvatar(event.target.files?.[0])}
            />
          </label>
          {avatar && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={uploading}
              onClick={() => void removeAvatar()}
            >
              <Trash2 className="size-4" />
              Remove
            </Button>
          )}
          <p className="w-full max-w-md text-xs leading-5 text-muted-foreground">
            JPG, PNG, or WebP up to 5 MB. Uploads are validated and re-encoded
            as 512px WebP images. You can also provide a trusted HTTPS URL
            below.
          </p>
        </div>
      </div>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Field label="Display name">
          <Input name="name" defaultValue={initial.name} />
        </Field>
        <Field
          label="Username"
          hint={`queryhub.com/profile/${initial.username}`}
        >
          <Input name="username" defaultValue={initial.username} />
        </Field>
        <Field label="Occupation">
          <Input name="occupation" defaultValue={initial.occupation ?? ""} />
        </Field>
        <Field label="Location">
          <Input name="location" defaultValue={initial.location ?? ""} />
        </Field>
        <Field label="Website">
          <Input
            name="website"
            type="url"
            defaultValue={initial.website ?? ""}
          />
        </Field>
        <Field label="Avatar URL">
          <Input
            name="image"
            type="url"
            value={avatar}
            onChange={(event) => setAvatar(event.target.value)}
            placeholder="https://example.com/avatar.jpg"
          />
        </Field>
      </div>
      <label className="mt-5 block">
        <span className="mb-1.5 flex justify-between text-sm font-semibold">
          <span>Bio</span>
          <span className="font-normal text-muted-foreground">
            {bio.length}/500
          </span>
        </span>
        <Textarea
          name="bio"
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          maxLength={500}
        />
      </label>
      <div className="mt-6 flex justify-end gap-2 border-t pt-5">
        <Button
          type="reset"
          variant="ghost"
          onClick={() => {
            setBio(initial.bio ?? "");
            setAvatar(initial.image ?? "");
          }}
        >
          Cancel
        </Button>
        <Button disabled={saving}>
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
      {hint && (
        <span className="mt-1 block text-[11px] text-muted-foreground">
          {hint}
        </span>
      )}
    </label>
  );
}
