"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Clock3,
  Plus,
  Save,
  Settings,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { FeedCard } from "@/components/feed/feed-card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import type { FeedQuestion, SpaceSummary, SpaceViewData } from "@/lib/types";
import { compactNumber, contrastTextColor } from "@/lib/utils";

type SpaceRole = NonNullable<SpaceSummary["role"]>;

const colors = ["#4f46e5", "#0891b2", "#16a34a", "#be123c", "#7c3aed"];
const editableRoles: SpaceRole[] = ["MODERATOR", "CONTRIBUTOR", "MEMBER"];

export function SpaceView({
  initialView,
  publicMode = false,
}: {
  initialView: SpaceViewData;
  publicMode?: boolean;
}) {
  const router = useRouter();
  const [space, setSpace] = useState(initialView.space);
  const [questions, setQuestions] = useState(initialView.questions);
  const [pending, setPending] = useState(initialView.pending);
  const [myQuestions, setMyQuestions] = useState(initialView.myQuestions);
  const [members, setMembers] = useState(initialView.members);
  const [selectedQuestionId, setSelectedQuestionId] = useState(
    initialView.myQuestions[0]?.id ?? "",
  );
  const [settings, setSettings] = useState({
    name: initialView.space.name,
    description: initialView.space.description,
    rules: initialView.space.rules ?? "",
    color: initialView.space.color ?? colors[0],
    allowMemberSubmissions: initialView.space.allowMemberSubmissions ?? true,
    requireApproval: initialView.space.requireApproval ?? true,
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteRole, setInviteRole] = useState<SpaceRole>("MEMBER");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviting, setInviting] = useState(false);
  const canModerate = ["OWNER", "MODERATOR"].includes(space.role ?? "");
  const canManageMembers = space.role === "OWNER";
  const canSubmit =
    !publicMode &&
    ((space.allowMemberSubmissions ?? true) ||
      ["OWNER", "MODERATOR", "CONTRIBUTOR"].includes(space.role ?? ""));
  const signInHref = `/login?callbackUrl=${encodeURIComponent(
    `/spaces/${space.slug}`,
  )}`;
  const initials = space.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function requireSignedIn() {
    router.push(signInHref);
  }

  async function toggleJoin() {
    if (publicMode) {
      requireSignedIn();
      return;
    }
    if (space.role === "OWNER") return;
    const previous = space;
    setSpace({
      ...space,
      joined: !space.joined,
      followers: Math.max(0, space.followers + (space.joined ? -1 : 1)),
    });
    const response = await fetch(`/api/spaces/${space.id}/join`, {
      method: "POST",
    });
    const result = (await response.json()) as {
      ok: boolean;
      data?: { joined: boolean };
      error?: { message: string };
    };
    if (!response.ok || !result.ok || !result.data) {
      setSpace(previous);
      toast.error(result.error?.message ?? "Space membership could not update");
      return;
    }
    setSpace((current) => ({ ...current, joined: result.data!.joined }));
  }

  async function submitQuestion() {
    if (publicMode) {
      requireSignedIn();
      return;
    }
    if (!selectedQuestionId || !canSubmit) return;
    const response = await fetch(`/api/spaces/${space.id}/questions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ questionId: selectedQuestionId }),
    });
    const result = (await response.json()) as {
      ok: boolean;
      data?: { status: "SUBMITTED" | "APPROVED" | "REJECTED" };
      error?: { message: string };
    };
    if (!response.ok || !result.ok || !result.data) {
      toast.error(result.error?.message ?? "Question could not be submitted");
      return;
    }
    const submitted = myQuestions.find(
      (question) => question.id === selectedQuestionId,
    );
    if (submitted && result.data.status === "APPROVED") {
      setQuestions((current) => [submitted, ...current]);
      setSpace((current) => ({
        ...current,
        questions: current.questions + 1,
      }));
    }
    setMyQuestions((current) =>
      current.filter((question) => question.id !== selectedQuestionId),
    );
    setSelectedQuestionId("");
    toast.success(
      result.data.status === "APPROVED"
        ? "Question added to Space"
        : "Question sent for review",
    );
  }

  async function moderate(
    question: FeedQuestion,
    action: "APPROVE" | "REJECT",
  ) {
    const response = await fetch(`/api/spaces/${space.id}/questions`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ questionId: question.id, action }),
    });
    const result = (await response.json()) as {
      ok: boolean;
      error?: { message: string };
    };
    if (!response.ok || !result.ok) {
      toast.error(result.error?.message ?? "Submission could not be updated");
      return;
    }
    setPending((current) => current.filter((item) => item.id !== question.id));
    if (action === "APPROVE") {
      setQuestions((current) => [question, ...current]);
      setSpace((current) => ({
        ...current,
        questions: current.questions + 1,
      }));
    }
    toast.success(action === "APPROVE" ? "Submission approved" : "Rejected");
  }

  async function saveSettings() {
    setSavingSettings(true);
    try {
      const response = await fetch(`/api/spaces/${space.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_SETTINGS",
          ...settings,
        }),
      });
      const result = (await response.json()) as {
        ok: boolean;
        data?: SpaceSummary;
        error?: { message: string };
      };
      if (!response.ok || !result.ok || !result.data)
        throw new Error(result.error?.message ?? "Space settings failed");
      setSpace((current) => ({ ...current, ...result.data }));
      toast.success("Space settings saved");
      if (result.data.slug !== space.slug)
        router.replace(`/spaces/${result.data.slug}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Space settings failed",
      );
    } finally {
      setSavingSettings(false);
    }
  }

  async function updateMember(userId: string, role: SpaceRole) {
    const previous = members;
    setMembers((current) =>
      current.map((member) =>
        member.id === userId ? { ...member, role } : member,
      ),
    );
    const response = await fetch(`/api/spaces/${space.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "UPDATE_MEMBER", userId, role }),
    });
    const result = (await response.json()) as {
      ok: boolean;
      error?: { message: string };
    };
    if (!response.ok || !result.ok) {
      setMembers(previous);
      toast.error(result.error?.message ?? "Member role could not be saved");
      return;
    }
    toast.success("Member role updated");
  }

  async function removeMember(userId: string) {
    const previous = members;
    setMembers((current) => current.filter((member) => member.id !== userId));
    const response = await fetch(`/api/spaces/${space.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "REMOVE_MEMBER", userId }),
    });
    const result = (await response.json()) as {
      ok: boolean;
      error?: { message: string };
    };
    if (!response.ok || !result.ok) {
      setMembers(previous);
      toast.error(result.error?.message ?? "Member could not be removed");
      return;
    }
    setSpace((current) => ({
      ...current,
      followers: Math.max(0, current.followers - 1),
    }));
    toast.success("Member removed");
  }

  async function inviteMember() {
    if (!inviteUsername.trim()) return;
    setInviting(true);
    try {
      const response = await fetch(`/api/spaces/${space.id}/invites`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "INVITE",
          username: inviteUsername,
          role: inviteRole,
          message: inviteMessage,
        }),
      });
      const result = (await response.json()) as {
        ok: boolean;
        error?: { message: string };
      };
      if (!response.ok || !result.ok)
        throw new Error(result.error?.message ?? "Invite could not be sent");
      setInviteUsername("");
      setInviteRole("MEMBER");
      setInviteMessage("");
      toast.success("Space invite sent");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Invite could not be sent",
      );
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="border-y bg-card p-5 shadow-card sm:rounded-xl sm:border sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <span
            className="grid size-16 shrink-0 place-items-center rounded-xl text-xl font-black"
            style={{
              backgroundColor: space.color ?? "#4f46e5",
              color: contrastTextColor(space.color ?? "#4f46e5"),
            }}
          >
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight">
                {space.name}
              </h1>
              {space.role && (
                <Badge className="border-primary/20 bg-primary/5 text-primary">
                  {space.role.toLowerCase()}
                </Badge>
              )}
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {space.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Users className="size-3.5" />
                {compactNumber(space.followers)} members
              </span>
              <span>{compactNumber(space.questions)} questions</span>
              {canModerate && (
                <span className="flex items-center gap-1.5 text-primary">
                  <ShieldCheck className="size-3.5" />
                  Moderator tools enabled
                </span>
              )}
            </div>
          </div>
          <Button
            variant={space.joined ? "outline" : "default"}
            onClick={toggleJoin}
            disabled={!publicMode && space.role === "OWNER"}
          >
            {space.joined ? (
              <Check className="size-4" />
            ) : (
              <Plus className="size-4" />
            )}
            {space.role === "OWNER"
              ? "Owner"
              : space.joined
                ? "Joined"
                : "Join"}
          </Button>
        </div>
      </section>

      {space.rules && (
        <section className="border-y bg-card p-4 sm:rounded-xl sm:border">
          <h2 className="text-sm font-bold">Rules</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">
            {space.rules}
          </p>
        </section>
      )}

      {canManageMembers && (
        <section className="border-y bg-card p-4 sm:rounded-xl sm:border">
          <div className="flex items-center gap-2">
            <Settings className="size-4 text-primary" />
            <h2 className="text-sm font-bold">Space settings</h2>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <label className="block text-sm font-semibold">
              Name
              <Input
                className="mt-1.5"
                value={settings.name}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </label>
            <div>
              <p className="text-sm font-semibold">Color</p>
              <div className="mt-2 flex gap-2">
                {colors.map((option) => (
                  <button
                    key={option}
                    aria-label={`Use ${option}`}
                    aria-pressed={settings.color === option}
                    onClick={() =>
                      setSettings((current) => ({
                        ...current,
                        color: option,
                      }))
                    }
                    className="size-8 rounded-full border-2"
                    style={{
                      backgroundColor: option,
                      borderColor:
                        settings.color === option ? "currentColor" : option,
                    }}
                  />
                ))}
              </div>
            </div>
            <label className="block text-sm font-semibold lg:col-span-2">
              Description
              <Textarea
                className="mt-1.5 min-h-24"
                value={settings.description}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </label>
            <label className="block text-sm font-semibold lg:col-span-2">
              Rules
              <Textarea
                className="mt-1.5 min-h-24"
                value={settings.rules}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    rules: event.target.value,
                  }))
                }
                placeholder="Keep questions specific, cite sources, and stay civil."
              />
            </label>
            <SettingToggle
              label="Member submissions"
              detail="Members can submit questions to this Space"
              checked={settings.allowMemberSubmissions}
              onChange={(value) =>
                setSettings((current) => ({
                  ...current,
                  allowMemberSubmissions: value,
                }))
              }
            />
            <SettingToggle
              label="Submission review"
              detail="New member submissions require moderator approval"
              checked={settings.requireApproval}
              onChange={(value) =>
                setSettings((current) => ({
                  ...current,
                  requireApproval: value,
                }))
              }
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={saveSettings}
              disabled={
                savingSettings ||
                settings.name.trim().length < 3 ||
                settings.description.trim().length < 20
              }
            >
              <Save className="size-4" />
              Save settings
            </Button>
          </div>
        </section>
      )}

      <section className="border-y bg-card p-4 sm:rounded-xl sm:border">
        <h2 className="text-sm font-bold">Submit a question</h2>
        {publicMode ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Sign in to submit a question to this Space.
            </p>
            <Button onClick={requireSignedIn}>Sign in</Button>
          </div>
        ) : canSubmit && myQuestions.length > 0 ? (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <select
              aria-label="Choose a question to submit"
              value={selectedQuestionId}
              onChange={(event) => setSelectedQuestionId(event.target.value)}
              className="h-10 min-w-0 flex-1 rounded-lg border bg-card px-3 text-sm outline-none focus:border-primary"
            >
              {myQuestions.map((question) => (
                <option key={question.id} value={question.id}>
                  {question.title}
                </option>
              ))}
            </select>
            <Button onClick={submitQuestion} disabled={!selectedQuestionId}>
              Submit
            </Button>
          </div>
        ) : canSubmit ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Ask a question first, then submit it to this Space.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            This Space accepts submissions from contributors and moderators.
          </p>
        )}
      </section>

      {canModerate && pending.length > 0 && (
        <section className="border-y bg-card p-4 sm:rounded-xl sm:border">
          <h2 className="text-sm font-bold">Pending submissions</h2>
          <div className="mt-3 space-y-3">
            {pending.map((question) => (
              <div
                key={question.id}
                className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/question/${question.slug}`}
                    className="font-semibold hover:text-primary"
                  >
                    {question.title}
                  </Link>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock3 className="size-3" />
                    {question.answers} answers
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => moderate(question, "APPROVE")}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => moderate(question, "REJECT")}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          {questions.map((question) => (
            <FeedCard key={question.id} question={question} />
          ))}
          {questions.length === 0 && (
            <section className="border-y bg-card p-10 text-center sm:rounded-xl sm:border">
              <p className="text-sm font-semibold">No questions yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Approved submissions will appear here.
              </p>
            </section>
          )}
        </div>
        <aside className="space-y-4">
          <section className="rounded-xl border bg-card p-4">
            <h2 className="text-sm font-bold">Members</h2>
            {canModerate && (
              <div className="mt-3 space-y-2 rounded-lg border p-3">
                <Input
                  value={inviteUsername}
                  onChange={(event) => setInviteUsername(event.target.value)}
                  placeholder="username"
                  aria-label="Username to invite"
                  className="h-9"
                />
                <select
                  value={inviteRole}
                  onChange={(event) =>
                    setInviteRole(event.target.value as SpaceRole)
                  }
                  aria-label="Invite role"
                  className="h-9 w-full rounded-md border bg-card px-2 text-xs outline-none focus:border-primary"
                >
                  {(canManageMembers
                    ? editableRoles
                    : editableRoles.filter((role) => role !== "MODERATOR")
                  ).map((role) => (
                    <option key={role} value={role}>
                      {role.toLowerCase()}
                    </option>
                  ))}
                </select>
                <Textarea
                  value={inviteMessage}
                  onChange={(event) => setInviteMessage(event.target.value)}
                  placeholder="Optional message"
                  aria-label="Invite message"
                  className="min-h-20"
                />
                <Button
                  size="sm"
                  onClick={inviteMember}
                  disabled={inviting || inviteUsername.trim().length < 3}
                  className="w-full"
                >
                  Invite
                </Button>
              </div>
            )}
            <div className="mt-3 space-y-3">
              {members.map((member) => (
                <div
                  key={member.id ?? member.username}
                  className="rounded-lg p-1 hover:bg-muted"
                >
                  <Link
                    href={`/profile/${member.username}`}
                    className="flex items-center gap-3"
                  >
                    <Avatar src={member.avatar} name={member.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {member.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {member.credential ?? member.headline}
                      </span>
                    </span>
                  </Link>
                  <MemberControls
                    member={member}
                    canManage={canManageMembers}
                    onRoleChange={updateMember}
                    onRemove={removeMember}
                  />
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function SettingToggle({
  label,
  detail,
  checked,
  onChange,
}: {
  label: string;
  detail: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg border p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
      </div>
      <Toggle checked={checked} onCheckedChange={onChange} label={label} />
    </div>
  );
}

function MemberControls({
  member,
  canManage,
  onRoleChange,
  onRemove,
}: {
  member: SpaceViewData["members"][number];
  canManage: boolean;
  onRoleChange: (userId: string, role: SpaceRole) => void;
  onRemove: (userId: string) => void;
}) {
  if (!canManage || member.role === "OWNER" || !member.id) {
    return member.role ? (
      <Badge className="ml-12 mt-2 border-border bg-muted text-muted-foreground">
        {member.role.toLowerCase()}
      </Badge>
    ) : null;
  }

  return (
    <div className="ml-12 mt-2 flex items-center gap-2">
      <UserCog className="size-3.5 text-muted-foreground" />
      <select
        aria-label={`Change role for ${member.name}`}
        value={member.role ?? "MEMBER"}
        onChange={(event) =>
          onRoleChange(member.id!, event.target.value as SpaceRole)
        }
        className="h-8 min-w-0 flex-1 rounded-md border bg-card px-2 text-xs outline-none focus:border-primary"
      >
        {editableRoles.map((role) => (
          <option key={role} value={role}>
            {role.toLowerCase()}
          </option>
        ))}
      </select>
      <button
        aria-label={`Remove ${member.name}`}
        onClick={() => onRemove(member.id!)}
        className="grid size-8 shrink-0 place-items-center rounded-md text-rose-600 hover:bg-muted"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}
