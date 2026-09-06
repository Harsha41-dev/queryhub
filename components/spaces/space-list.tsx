"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Plus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useModalFocus } from "@/components/ui/use-modal-focus";
import type { SpaceInviteSummary, SpaceSummary } from "@/lib/types";
import { compactNumber, contrastTextColor } from "@/lib/utils";

const colors = ["#4f46e5", "#0891b2", "#16a34a", "#be123c", "#7c3aed"];

export function SpaceList({
  initialSpaces,
  initialInvites = [],
  publicMode = false,
}: {
  initialSpaces: SpaceSummary[];
  initialInvites?: SpaceInviteSummary[];
  publicMode?: boolean;
}) {
  const router = useRouter();
  const [spaces, setSpaces] = useState(initialSpaces);
  const [invites, setInvites] = useState(initialInvites);
  const [createOpen, setCreateOpen] = useState(false);

  async function toggleJoin(space: SpaceSummary) {
    if (publicMode) {
      router.push(`/login?callbackUrl=/spaces/${space.slug}`);
      return;
    }
    if (space.role === "OWNER") return;
    const previous = spaces;
    setSpaces(
      spaces.map((item) =>
        item.id === space.id
          ? {
              ...item,
              joined: !item.joined,
              followers: Math.max(0, item.followers + (item.joined ? -1 : 1)),
            }
          : item,
      ),
    );
    const response = await fetch(`/api/spaces/${space.id}/join`, {
      method: "POST",
    });
    const result = (await response.json()) as {
      ok: boolean;
      data?: { joined: boolean };
      error?: { message: string };
    };
    if (!response.ok || !result.ok || !result.data) {
      setSpaces(previous);
      toast.error(result.error?.message ?? "Space membership could not update");
      return;
    }
    toast.success(result.data.joined ? "Joined Space" : "Left Space");
  }

  async function respondToInvite(
    invite: SpaceInviteSummary,
    response: "ACCEPT" | "DECLINE",
  ) {
    const previousInvites = invites;
    const previousSpaces = spaces;
    setInvites((current) => current.filter((item) => item.id !== invite.id));
    if (response === "ACCEPT")
      setSpaces((current) =>
        current.map((space) =>
          space.id === invite.space.id
            ? {
                ...space,
                joined: true,
                role: invite.role,
                followers: space.joined ? space.followers : space.followers + 1,
              }
            : space,
        ),
      );
    const result = await fetch(`/api/spaces/${invite.space.id}/invites`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "RESPOND",
        inviteId: invite.id,
        response,
      }),
    }).then(
      (request) =>
        request.json() as Promise<{
          ok: boolean;
          error?: { message: string };
        }>,
    );
    if (!result.ok) {
      setInvites(previousInvites);
      setSpaces(previousSpaces);
      toast.error(result.error?.message ?? "Invite could not be updated");
      return;
    }
    toast.success(response === "ACCEPT" ? "Space joined" : "Invite declined");
  }

  return (
    <>
      {invites.length > 0 && (
        <section className="border-y bg-card p-4 sm:rounded-xl sm:border">
          <h2 className="text-sm font-bold">Invitations</h2>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {invites.map((invite) => (
              <article key={invite.id} className="rounded-lg border p-3">
                <Link
                  href={`/spaces/${invite.space.slug}`}
                  className="flex items-start gap-3"
                >
                  <span
                    className="grid size-10 shrink-0 place-items-center rounded-lg text-xs font-black"
                    style={{
                      backgroundColor: invite.space.color ?? colors[0],
                      color: contrastTextColor(invite.space.color ?? colors[0]),
                    }}
                  >
                    {invite.space.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">
                      {invite.space.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Invited by {invite.inviter.name} as{" "}
                      {invite.role.toLowerCase()}
                    </span>
                  </span>
                </Link>
                {invite.message && (
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                    {invite.message}
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => void respondToInvite(invite, "ACCEPT")}
                  >
                    <Check className="size-3.5" />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void respondToInvite(invite, "DECLINE")}
                  >
                    Decline
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      <section className="flex flex-wrap items-center gap-3 border-y bg-card p-4 sm:rounded-xl sm:border">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold">Community Spaces</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Curated collections with owners and moderators.
          </p>
        </div>
        <Button
          onClick={() =>
            publicMode
              ? router.push("/login?callbackUrl=/spaces")
              : setCreateOpen(true)
          }
        >
          <Plus className="size-4" />
          Create Space
        </Button>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        {spaces.map((space) => (
          <article
            key={space.id}
            className="border-y bg-card p-5 shadow-card sm:rounded-xl sm:border"
          >
            <Link href={`/spaces/${space.slug}`} className="group flex gap-4">
              <span
                className="grid size-12 shrink-0 place-items-center rounded-lg text-sm font-black"
                style={{
                  backgroundColor: space.color ?? colors[0],
                  color: contrastTextColor(space.color ?? colors[0]),
                }}
              >
                {space.name
                  .split(/\s+/)
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-bold group-hover:text-primary">
                  {space.name}
                </span>
                <span className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                  {space.description}
                </span>
              </span>
            </Link>
            <footer className="mt-5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Users className="size-3.5" />
                {compactNumber(space.followers)} members
              </span>
              <span>{compactNumber(space.questions)} questions</span>
              {space.role && <span>{space.role.toLowerCase()}</span>}
              <Button
                className="ml-auto"
                variant={space.joined ? "outline" : "default"}
                size="sm"
                disabled={space.role === "OWNER"}
                onClick={() => toggleJoin(space)}
              >
                {space.role === "OWNER"
                  ? "Owner"
                  : space.joined
                    ? "Joined"
                    : "Join"}
              </Button>
            </footer>
          </article>
        ))}
      </div>
      <CreateSpaceDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </>
  );
}

function CreateSpaceDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(colors[0]);
  const [saving, setSaving] = useState(false);
  const dialogRef = useModalFocus(open, onClose);

  async function create() {
    setSaving(true);
    try {
      const response = await fetch("/api/spaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, description, color }),
      });
      const result = (await response.json()) as {
        ok: boolean;
        data?: { slug: string };
        error?: { message: string };
      };
      if (!response.ok || !result.ok || !result.data)
        throw new Error(result.error?.message ?? "Space could not be created");
      router.push(`/spaces/${result.data.slug}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Space could not be created",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-space-title"
        className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl"
      >
        <div className="flex items-center gap-3">
          <h2 id="create-space-title" className="text-lg font-bold">
            Create Space
          </h2>
          <button
            aria-label="Close"
            className="ml-auto grid size-8 place-items-center rounded-full hover:bg-muted"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-5 space-y-4">
          <label className="block text-sm font-semibold">
            Name
            <Input
              className="mt-1.5"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="AI Builders"
            />
          </label>
          <label className="block text-sm font-semibold">
            Description
            <Textarea
              className="mt-1.5"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="A focused place for practical questions and thoughtful answers."
            />
          </label>
          <div>
            <p className="text-sm font-semibold">Color</p>
            <div className="mt-2 flex gap-2">
              {colors.map((option) => (
                <button
                  key={option}
                  aria-label={`Use ${option}`}
                  aria-pressed={color === option}
                  onClick={() => setColor(option)}
                  className="size-8 rounded-full border-2"
                  style={{
                    backgroundColor: option,
                    borderColor: color === option ? "currentColor" : option,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={create}
            disabled={
              saving || name.trim().length < 3 || description.length < 20
            }
          >
            Create Space
          </Button>
        </div>
      </section>
    </div>
  );
}
