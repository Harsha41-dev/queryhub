"use client";

// top bar on small screens

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Bell, Plus, Search } from "lucide-react";
import { Logo } from "@/components/logo";
import { Avatar } from "@/components/ui/avatar";

export function MobileHeader({
  onAsk,
  publicMode,
  unread = 0,
}: {
  onAsk: () => void;
  publicMode?: boolean;
  unread?: number;
}) {
  const { data: session } = useSession();
  const user = {
    name: session?.user?.name ?? "QueryHub member",
    username: session?.user?.username ?? "member",
    avatar: session?.user?.image,
  };
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background/90 px-4 backdrop-blur md:hidden">
      <Logo compact />
      <Link
        href="/search"
        className="ml-1 flex h-9 flex-1 items-center gap-2 rounded-full bg-muted px-3 text-sm text-muted-foreground"
      >
        <Search className="size-4" /> Search
      </Link>
      {publicMode ? (
        <Link href="/login" className="text-sm font-semibold text-primary">
          Log in
        </Link>
      ) : (
        <>
          <button
            onClick={onAsk}
            aria-label="Ask a question"
            className="grid size-9 place-items-center rounded-full bg-primary text-white"
          >
            <Plus className="size-5" />
          </button>
          <Link
            href="/notifications"
            aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
            className="relative grid size-9 place-items-center rounded-full hover:bg-muted"
          >
            <Bell className="size-5" />
            {unread > 0 && (
              <span className="absolute right-0 top-0 grid min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
          <Link href={`/profile/${user.username}`}>
            <Avatar src={user.avatar} name={user.name} className="size-8" />
          </Link>
        </>
      )}
    </header>
  );
}
