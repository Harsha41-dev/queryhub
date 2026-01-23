"use client";

// left sidebar for admin pages (mods don't see topics)

import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import {
  FileText,
  Flag,
  LayoutDashboard,
  Settings,
  Tags,
  Users,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

const links = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/content", label: "Content", icon: FileText },
  { href: "/admin/reports", label: "Reports", icon: Flag },
  { href: "/admin/topics", label: "Topics", icon: Tags },
];
export function AdminNav({ role }: { role: Role }) {
  const path = usePathname();
  const { data: session } = useSession();
  // only full admins manage topics
  const visibleLinks =
    role === "ADMIN"
      ? links
      : links.filter((link) => link.href !== "/admin/topics");
  const user = {
    name: session?.user?.name ?? "QueryHub moderator",
    image: session?.user?.image,
  };
  return (
    <aside className="border-b bg-slate-950 p-4 text-slate-300 lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:border-b-0 lg:border-r lg:border-slate-800 lg:p-5">
      <Logo className="text-white" />
      <div className="mt-6 flex gap-1 overflow-x-auto scrollbar-none lg:block lg:space-y-1">
        {visibleLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex h-10 shrink-0 items-center gap-3 rounded-lg px-3 text-sm font-medium hover:bg-white/10 hover:text-white",
              path === href && "bg-indigo-500/20 font-semibold text-indigo-300",
            )}
          >
            <Icon className="size-[18px]" />
            {label}
          </Link>
        ))}
      </div>
      <div className="mt-6 hidden border-t border-slate-800 pt-4 lg:block">
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-white/10"
        >
          <Settings className="size-4" />
          Platform settings
        </Link>
        <div className="mt-3 flex items-center gap-3 rounded-lg bg-white/5 p-3">
          <Avatar src={user.image} name={user.name} className="size-9" />
          <div>
            <p className="text-xs font-semibold text-white">{user.name}</p>
            <p className="text-[10px] text-slate-400">
              {role === "ADMIN" ? "Administrator" : "Moderator"}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
