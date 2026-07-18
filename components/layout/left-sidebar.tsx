"use client";

// left nav on desktop (home, following, bookmarks, etc.)

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import {
  Bell,
  Bookmark,
  CircleHelp,
  Home,
  LogIn,
  LogOut,
  MessageSquareText,
  Plus,
  Settings,
  Users,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { TopicSummary } from "@/lib/types";
import { cn, contrastTextColor } from "@/lib/utils";

const links = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/following", label: "Following", icon: Users },
  { href: "/answer", label: "Answer requests", icon: MessageSquareText },
  { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/notifications", label: "Notifications", icon: Bell },
];

export function LeftSidebar({
  onAsk,
  publicMode,
  unread = 0,
  topics,
}: {
  onAsk: () => void;
  publicMode?: boolean;
  unread?: number;
  topics: TopicSummary[];
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = {
    name: session?.user?.name ?? "QueryHub member",
    username: session?.user?.username ?? "member",
    avatar: session?.user?.image,
  };
  return (
    <aside className="sticky top-0 hidden h-screen flex-col py-6 md:flex">
      <Logo className="px-2" />
      <nav className="mt-8 space-y-1" aria-label="Primary navigation">
        {links.map(({ href, label, icon: Icon }) => {
          const target = publicMode && href !== "/home" ? "/login" : href;
          const active =
            pathname === href || (href === "/home" && pathname === "/");
          return (
            <Link
              key={href}
              href={target}
              className={cn(
                "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground",
                active && "bg-primary/10 font-semibold text-primary",
              )}
            >
              <Icon className="size-[18px]" /> {label}
              {label === "Notifications" && unread > 0 && !publicMode && (
                <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      {publicMode ? (
        <Link
          href="/login"
          className="mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90"
        >
          <LogIn className="size-4" />
          Sign in to ask
        </Link>
      ) : (
        <Button className="mt-5 w-full" onClick={onAsk}>
          <Plus className="size-4" />
          Ask a question
        </Button>
      )}
      <div className="mt-7">
        <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Your topics
        </p>
        <div className="mt-2 space-y-0.5">
          {topics.length === 0 &&
            Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="mx-3 h-9" />
            ))}
          {topics.map((topic) => (
            <Link
              href={`/topic/${topic.slug}`}
              key={topic.slug}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <span
                className="grid size-6 place-items-center rounded-md text-[9px] font-black"
                style={{
                  backgroundColor: topic.accent,
                  color: contrastTextColor(topic.accent),
                }}
              >
                {topic.icon}
              </span>
              <span className="truncate">{topic.name}</span>
            </Link>
          ))}
        </div>
      </div>
      <div className="mt-auto border-t pt-4">
        {publicMode ? (
          <div className="rounded-xl bg-primary/10 p-3 text-sm">
            <p className="font-semibold">Make knowledge useful.</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Join to vote, follow topics, and write answers.
            </p>
            <Link
              href="/register"
              className="mt-2 inline-flex font-semibold text-primary"
            >
              Create account →
            </Link>
          </div>
        ) : (
          <div className="group flex items-center gap-3 rounded-xl p-2 hover:bg-muted">
            <Avatar src={user.avatar} name={user.name} />
            <Link href={`/profile/${user.username}`} className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                @{user.username}
              </p>
            </Link>
            <Link href="/settings" aria-label="Settings">
              <Settings className="size-4 text-muted-foreground" />
            </Link>
            <button
              aria-label="Log out"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              <LogOut className="size-4 text-muted-foreground" />
            </button>
          </div>
        )}
        <div className="mt-2 flex gap-3 px-2 text-[11px] text-muted-foreground">
          <Link href="/about">About</Link>
          <Link href="/guidelines">Guidelines</Link>
          <CircleHelp className="ml-auto size-3.5" />
        </div>
      </div>
    </aside>
  );
}
