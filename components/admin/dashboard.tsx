// admin home – stats cards + recent mod actions

import Link from "next/link";
import {
  Clock3,
  Flag,
  MessageSquareText,
  TrendingUp,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { compactNumber, contrastTextColor, relativeDate } from "@/lib/utils";

type DashboardProps = {
  stats: Array<{
    label: string;
    value: number;
    icon: "users" | "questions" | "answers" | "reports";
  }>;
  topics: Array<{
    slug: string;
    name: string;
    questionCount: number;
    color?: string | null;
  }>;
  actions: Array<{
    id: string;
    label: string;
    moderator: { name: string; image?: string | null };
    createdAt: string;
  }>;
  health: Array<{ label: string; value: string; status: string }>;
};

const icons = {
  users: Users,
  questions: TrendingUp,
  answers: MessageSquareText,
  reports: Flag,
};

export function AdminDashboard({
  stats,
  topics,
  actions,
  health,
}: DashboardProps) {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = icons[stat.icon];
          return (
            <div
              key={stat.label}
              className="rounded-xl border bg-card p-5 shadow-card"
            >
              <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <p className="mt-4 text-2xl font-extrabold">
                {compactNumber(stat.value)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
            </div>
          );
        })}
      </section>
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.8fr)]">
        <div className="rounded-xl border bg-card p-5 sm:p-6">
          <h2 className="font-bold">Platform health</h2>
          <div className="mt-5 grid grid-cols-2 gap-4">
            {health.map((item) => (
              <Health key={item.label} {...item} />
            ))}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5 sm:p-6">
          <h2 className="font-bold">Popular topics</h2>
          <div className="mt-4 space-y-4">
            {topics.map((topic, index) => (
              <Link
                href={`/topic/${topic.slug}`}
                key={topic.slug}
                className="flex items-center gap-3"
              >
                <span
                  className="grid size-8 place-items-center rounded-lg text-[9px] font-black"
                  style={{
                    backgroundColor: topic.color ?? "#4f46e5",
                    color: contrastTextColor(topic.color ?? "#4f46e5"),
                  }}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold">
                    {topic.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {topic.questionCount.toLocaleString()} questions
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b p-5">
          <h2 className="font-bold">Recent moderation</h2>
          <Link
            href="/admin/reports"
            className="text-xs font-semibold text-primary"
          >
            View queue
          </Link>
        </div>
        <div className="divide-y">
          {actions.length ? (
            actions.map((action) => (
              <div key={action.id} className="flex items-center gap-3 p-4">
                <Avatar
                  src={action.moderator.image}
                  name={action.moderator.name}
                  className="size-8"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">
                    {action.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    by {action.moderator.name}
                  </p>
                </div>
                <span
                  suppressHydrationWarning
                  className="flex items-center gap-1 text-[10px] text-muted-foreground"
                >
                  <Clock3 className="size-3" />
                  {relativeDate(action.createdAt)}
                </span>
              </div>
            ))
          ) : (
            <div className="p-6 text-sm text-muted-foreground">
              No moderation actions recorded yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Health({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: string;
}) {
  return (
    <div className="rounded-lg bg-muted/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
      <Badge className="mt-2">{status}</Badge>
    </div>
  );
}
