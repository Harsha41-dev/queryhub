"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Bookmark, Home, MessageSquareText, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/answer", label: "Answer", icon: MessageSquareText },
  { href: "#ask", label: "Ask", icon: Plus, action: true },
  { href: "/bookmarks", label: "Saved", icon: Bookmark },
  { href: "/notifications", label: "Updates", icon: Bell },
];

export function BottomNav({
  onAsk,
  publicMode,
  unread = 0,
}: {
  onAsk: () => void;
  publicMode?: boolean;
  unread?: number;
}) {
  const path = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid h-[68px] grid-cols-5 border-t bg-card/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      aria-label="Mobile navigation"
    >
      {nav.map(({ href, label, icon: Icon, action }) => {
        if (action)
          return (
            <button
              key={label}
              onClick={
                publicMode
                  ? () => {
                      window.location.href = "/login";
                    }
                  : onAsk
              }
              className="flex flex-col items-center justify-center gap-1 text-[10px] font-semibold text-primary"
            >
              <span className="grid size-10 place-items-center rounded-full bg-primary text-white shadow">
                <Icon className="size-5" />
              </span>
              {label}
            </button>
          );
        return (
          <Link
            key={label}
            href={publicMode ? (href === "/home" ? "/" : "/login") : href}
            className={cn(
              "relative flex flex-col items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground",
              (path === href || (href === "/home" && path === "/")) &&
                "text-primary",
            )}
          >
            <span className="relative">
              <Icon className="size-5" />
              {href === "/notifications" && unread > 0 && (
                <span className="absolute -right-2 -top-2 grid min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
