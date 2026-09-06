"use client";

// notifications page: filter tabs and mark as read

import Link from "next/link";
import { useState } from "react";
import {
  AtSign,
  Award,
  Bell,
  CheckCheck,
  Heart,
  MessageCircle,
  ShieldAlert,
  Users,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { NotificationItem } from "@/lib/types";
import { cn, relativeDate } from "@/lib/utils";

const icons = {
  answer: Bell,
  "answer-request": MessageCircle,
  accepted: Award,
  upvote: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  mention: AtSign,
  moderation: ShieldAlert,
  space: Users,
};

export function NotificationList({
  initialItems,
}: {
  initialItems: NotificationItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [tab, setTab] = useState("All");
  const unread = items.filter((item) => !item.read).length;
  // simple client-side filter for the chips
  const visible = items.filter(
    (item) =>
      tab === "All" ||
      (tab === "Responses" &&
        ["answer", "answer-request", "accepted", "comment"].includes(
          item.type,
        )) ||
      (tab === "Mentions" && item.type === "mention") ||
      (tab === "Activity" &&
        ["follow", "upvote", "moderation", "space"].includes(item.type)),
  );

  // mark one notification read (optimistic)
  async function mark(id: string) {
    const previous = items;
    setItems(
      items.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
    const response = await fetch("/api/notifications/read", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!response.ok) {
      setItems(previous);
      toast.error("Notification could not be marked read");
    } else {
      // tell the shell to update the unread badge
      window.dispatchEvent(
        new CustomEvent("queryhub:unread", { detail: Math.max(0, unread - 1) }),
      );
    }
  }

  // mark everything read in one request
  async function markAll() {
    const previous = items;
    setItems(items.map((item) => ({ ...item, read: true })));
    const response = await fetch("/api/notifications/read", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    if (!response.ok) {
      setItems(previous);
      toast.error("Notifications could not be marked read");
      return;
    }
    toast.success("All notifications marked as read");
    window.dispatchEvent(new CustomEvent("queryhub:unread", { detail: 0 }));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 overflow-x-auto px-4 scrollbar-none sm:px-0">
        {["All", "Responses", "Mentions", "Activity"].map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={cn(
              "shrink-0 rounded-full border bg-card px-3 py-1.5 text-xs font-semibold",
              tab === item && "border-primary bg-primary text-white",
            )}
          >
            {item}
          </button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto shrink-0"
          onClick={markAll}
          disabled={unread === 0}
        >
          <CheckCheck className="size-4" />
          Mark all read
        </Button>
      </div>
      <section className="overflow-hidden border-y bg-card sm:rounded-xl sm:border">
        <div className="border-b bg-muted/30 px-5 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {unread} unread
        </div>
        {visible.map((item) => {
          const Icon = icons[item.type];
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => {
                if (!item.read) void mark(item.id);
              }}
              className={cn(
                "flex w-full gap-3 border-b p-4 text-left last:border-0 hover:bg-muted/50",
                !item.read && "bg-primary/[0.035]",
              )}
            >
              <span className="relative">
                <Avatar
                  src={item.actorAvatar}
                  name={item.actorName}
                  className="size-10"
                />
                <span className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full border-2 border-card bg-primary text-white">
                  <Icon className="size-2.5" />
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-sm">
                  <strong>{item.actorName}</strong> {item.message}
                </span>
                <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {item.detail}
                </span>
                <span
                  suppressHydrationWarning
                  className="mt-1 block text-[11px] font-medium text-primary"
                >
                  {relativeDate(item.createdAt)}
                </span>
              </span>
              {!item.read && (
                <span className="mt-2 size-2 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
        {visible.length === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No notifications in this view.
          </div>
        )}
      </section>
    </div>
  );
}
