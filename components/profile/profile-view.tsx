"use client";

// user profile page: header, follow button, answers/questions tabs

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Award,
  CalendarDays,
  Check,
  ExternalLink,
  Flag,
  GraduationCap,
  Link as LinkIcon,
  MapPin,
  Pencil,
  Share2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FeedCard } from "@/components/feed/feed-card";
import { useModalFocus } from "@/components/ui/use-modal-focus";
import type { FeedQuestion, PersonSummary } from "@/lib/types";
import { compactNumber, relativeDate } from "@/lib/utils";

type ReportReason =
  | "SPAM"
  | "HARASSMENT"
  | "MISINFORMATION"
  | "HATE_ABUSE"
  | "COPYRIGHT"
  | "OTHER";

const reportReasons: Array<{ value: ReportReason; label: string }> = [
  { value: "SPAM", label: "Spam" },
  { value: "HARASSMENT", label: "Harassment" },
  { value: "MISINFORMATION", label: "Misinformation" },
  { value: "HATE_ABUSE", label: "Hate or abusive content" },
  { value: "COPYRIGHT", label: "Copyright issue" },
  { value: "OTHER", label: "Other" },
];

export function ProfileView({
  person,
  ownProfile,
  questions,
  answers,
  publicMode = false,
}: {
  person: PersonSummary;
  ownProfile: boolean;
  questions: FeedQuestion[];
  answers: FeedQuestion[];
  publicMode?: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(person.following ?? false);
  const [tab, setTab] = useState("Answers");
  const [reportOpen, setReportOpen] = useState(false);

  // follow / unfollow this user
  function follow() {
    if (publicMode) {
      router.push("/login");
      return;
    }
    void (async () => {
      const previous = following;
      setFollowing(!following);
      const response = await fetch("/api/follows", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: person.id }),
      });
      if (!response.ok) {
        setFollowing(previous);
        toast.error("Follow could not be saved");
        return;
      }
      toast.success(previous ? "Unfollowed" : `Following ${person.name}`);
    })();
  }

  async function share() {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Profile link copied");
  }

  // report a profile to moderators
  async function reportProfile(reason: ReportReason, details: string) {
    if (publicMode) {
      router.push("/login");
      return;
    }
    if (!person.id) {
      toast.error("Profile could not be reported");
      return;
    }
    const response = await fetch("/api/reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        profileId: person.id,
        reason,
        details: details || undefined,
      }),
    });
    if (response.ok) setReportOpen(false);
    toast[response.ok ? "success" : "error"](
      response.ok
        ? "Profile report submitted for review"
        : "Report could not be submitted",
    );
  }

  const stats = [
    { label: "Answers", value: person.answers },
    { label: "Questions", value: person.questions ?? questions.length },
    { label: "Reputation", value: person.reputation ?? 0 },
    { label: "Best answers", value: person.acceptedAnswers ?? 0 },
    { label: "Views", value: person.profileViews ?? 0 },
    { label: "Followers", value: person.followers },
  ];

  return (
    <div className="space-y-4">
      <section className="border-y bg-card shadow-card sm:rounded-xl sm:border">
        <div className="h-28 bg-[linear-gradient(120deg,rgba(79,70,229,.18),rgba(8,145,178,.16))] dark:bg-slate-900 sm:h-36" />
        <div className="px-5 pb-5 sm:px-7 sm:pb-7">
          <div className="flex items-end gap-4">
            <Avatar
              src={person.avatar}
              name={person.name}
              className="-mt-12 size-24 border-4 border-card sm:-mt-14 sm:size-28"
            />
            <div className="mb-1 ml-auto flex gap-2">
              {ownProfile ? (
                <>
                  <Link
                    href="/settings/profile"
                    className="inline-flex h-10 items-center gap-2 rounded-lg border bg-card px-4 text-sm font-semibold hover:bg-muted"
                  >
                    <Pencil className="size-4" />
                    Edit profile
                  </Link>
                  <Link
                    href="/settings/credentials"
                    className="hidden h-10 items-center gap-2 rounded-lg border bg-card px-4 text-sm font-semibold hover:bg-muted sm:inline-flex"
                  >
                    <GraduationCap className="size-4" />
                    Credentials
                  </Link>
                </>
              ) : (
                <Button onClick={follow}>
                  {following ? (
                    <Check className="size-4" />
                  ) : (
                    <UserPlus className="size-4" />
                  )}
                  {following ? "Following" : "Follow"}
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={share}
                aria-label="Share profile"
              >
                <Share2 className="size-4" />
              </Button>
              {!ownProfile && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    publicMode ? router.push("/login") : setReportOpen(true)
                  }
                  aria-label="Report profile"
                >
                  <Flag className="size-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                {person.name}
              </h1>
              {person.verified && (
                <span
                  title="Verified contributor"
                  className="grid size-5 place-items-center rounded-full bg-primary text-white"
                >
                  <Check className="size-3.5" />
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              @{person.username}
            </p>
            {person.badges && person.badges.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {person.badges.map((badge) => (
                  <Badge
                    key={badge}
                    className="border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950"
                  >
                    <Award className="size-3" />
                    {badge}
                  </Badge>
                ))}
              </div>
            )}
            {person.occupation && (
              <p className="mt-1 text-sm font-semibold text-muted-foreground">
                {person.occupation}
              </p>
            )}
            <p className="mt-3 max-w-2xl text-sm leading-6">
              {person.bio || person.headline}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
              {person.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5" />
                  {person.location}
                </span>
              )}
              {person.website && (
                <span className="flex items-center gap-1">
                  <LinkIcon className="size-3.5" />
                  <a
                    href={person.website}
                    className="font-semibold text-primary"
                    rel="nofollow noopener noreferrer"
                    target="_blank"
                  >
                    {person.website.replace(/^https?:\/\//, "")}
                  </a>
                </span>
              )}
              {person.joinedAt && (
                <span className="flex items-center gap-1">
                  <CalendarDays className="size-3.5" />
                  Joined{" "}
                  <span suppressHydrationWarning>
                    {relativeDate(person.joinedAt)}
                  </span>
                </span>
              )}
            </div>
            <div className="mt-5 flex flex-wrap gap-6">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <p className="font-bold">{compactNumber(stat.value)}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex overflow-x-auto border-t px-3 scrollbar-none">
          {["Answers", "Questions", "Topics"].map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`relative h-12 px-4 text-sm font-semibold ${tab === item ? "text-primary after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-primary" : "text-muted-foreground"}`}
            >
              {item}
            </button>
          ))}
        </div>
      </section>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="space-y-4">
          {tab === "Answers" &&
            (answers.length > 0 ? (
              answers.map((question) => (
                <FeedCard
                  key={`${question.id}-answer`}
                  question={question}
                  publicMode={publicMode}
                />
              ))
            ) : (
              <Empty label="No answers yet" />
            ))}
          {tab === "Questions" &&
            (questions.length > 0 ? (
              questions.map((question) => (
                <FeedCard
                  key={question.id}
                  question={question}
                  publicMode={publicMode}
                />
              ))
            ) : (
              <Empty label="No questions yet" />
            ))}
          {tab === "Topics" && (
            <section className="border-y bg-card p-5 sm:rounded-xl sm:border">
              <h2 className="font-bold">Topics</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {person.expertise.length ? (
                  person.expertise.map((item) => (
                    <Badge key={item}>{item}</Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No followed topics yet.
                  </p>
                )}
              </div>
            </section>
          )}
        </div>
        <aside className="space-y-4">
          <section className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2">
              <Award className="size-4 text-amber-500" />
              <h2 className="text-sm font-bold">Credibility</h2>
            </div>
            <div className="mt-3 space-y-3">
              <Credibility
                label="Reputation"
                detail={`${compactNumber(person.reputation ?? 0)} community points`}
              />
              <Credibility
                label="Answers"
                detail={`${compactNumber(person.answers)} published answers`}
              />
              <Credibility
                label="Best answers"
                detail={`${compactNumber(person.acceptedAnswers ?? 0)} selected by question authors`}
              />
              <Credibility
                label="Views"
                detail={`${compactNumber(person.profileViews ?? 0)} views on published questions`}
              />
              <Credibility
                label="Followers"
                detail={`${compactNumber(person.followers)} people follow this profile`}
              />
            </div>
          </section>
          {person.credentials && person.credentials.length > 0 && (
            <section className="rounded-xl border bg-card p-4">
              <h2 className="text-sm font-bold">Credentials</h2>
              <div className="mt-3 space-y-3">
                {person.credentials.map((credential) => (
                  <div key={credential.id}>
                    <p className="text-xs font-semibold">{credential.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {credential.topic?.name ?? "All topics"}
                      {credential.organization
                        ? ` - ${credential.organization}`
                        : ""}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
          <section className="rounded-xl border bg-card p-4">
            <h2 className="text-sm font-bold">Knows about</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {person.expertise.slice(0, 6).map((item) => (
                <Badge key={item}>{item}</Badge>
              ))}
            </div>
            <Link
              href="/search?tab=topics"
              className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary"
            >
              Explore topics <ExternalLink className="size-3" />
            </Link>
          </section>
        </aside>
      </div>
      {reportOpen && (
        <ProfileReportDialog
          onCancel={() => setReportOpen(false)}
          onSubmit={reportProfile}
        />
      )}
    </div>
  );
}

function ProfileReportDialog({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (reason: ReportReason, details: string) => void;
}) {
  const [reason, setReason] = useState<ReportReason>("OTHER");
  const [details, setDetails] = useState("");
  const dialogRef = useModalFocus(true, onCancel);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-report-title"
        className="w-full max-w-md rounded-xl border bg-card p-5 shadow-2xl"
      >
        <Flag className="size-9 text-amber-500" />
        <h2 id="profile-report-title" className="mt-4 text-lg font-bold">
          Report profile
        </h2>
        <label className="mt-4 block text-sm font-semibold">
          Reason
          <select
            value={reason}
            onChange={(event) => setReason(event.target.value as ReportReason)}
            className="mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm font-normal"
          >
            {reportReasons.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-4 block text-sm font-semibold">
          Details
          <textarea
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            maxLength={2000}
            className="mt-1.5 min-h-24 w-full rounded-lg border bg-card p-3 text-sm font-normal leading-6 outline-none focus:border-primary"
            placeholder="Add context, links, or what moderators should review"
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onSubmit(reason, details)}>
            Submit report
          </Button>
        </div>
      </section>
    </div>
  );
}

function Credibility({ label, detail }: { label: string; detail: string }) {
  return (
    <div>
      <p className="text-xs font-semibold">{label}</p>
      <p className="text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
}
function Empty({ label }: { label: string }) {
  return (
    <section className="border-y bg-card p-10 text-center sm:rounded-xl sm:border">
      <p className="text-sm font-semibold">{label}</p>
    </section>
  );
}
