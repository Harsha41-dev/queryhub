"use client";

import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

const names: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/users": "User management",
  "/admin/content": "Content management",
  "/admin/reports": "Report queue",
  "/admin/topics": "Topic management",
};

export function AdminHeader() {
  const path = usePathname();
  const router = useRouter();
  function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = new FormData(event.currentTarget).get("q")?.toString().trim();
    if (query) router.push(`/admin/content?q=${encodeURIComponent(query)}`);
  }
  return (
    <header className="flex h-16 items-center gap-4 border-b bg-card px-4 sm:px-7">
      <div>
        <h1 className="text-lg font-bold">{names[path] ?? "Administration"}</h1>
        <p className="hidden text-xs text-muted-foreground sm:block">
          Monitor community health and platform operations
        </p>
      </div>
      <form onSubmit={search} className="relative ml-auto hidden sm:block">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          name="q"
          aria-label="Search administration content"
          placeholder="Search content"
          className="h-9 w-56 rounded-lg border bg-muted/50 pl-9 pr-3 text-xs outline-none focus:border-primary"
        />
      </form>
      <Link
        href="/notifications"
        aria-label="Admin notifications"
        className="relative grid size-9 place-items-center rounded-lg border hover:bg-muted"
      >
        <Bell className="size-4" />
        <span className="absolute right-2 top-2 size-1.5 rounded-full bg-rose-500" />
      </Link>
    </header>
  );
}
