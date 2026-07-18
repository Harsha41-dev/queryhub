"use client";

// settings side menu

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  ChevronRight,
  Lock,
  Palette,
  Settings2,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/settings", label: "Overview", icon: Settings2 },
  { href: "/settings/profile", label: "Profile", icon: UserRound },
  { href: "/settings/account", label: "Account", icon: Lock },
  { href: "/settings/privacy", label: "Privacy", icon: Palette },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
];
export function SettingsNav() {
  const path = usePathname();
  return (
    <aside className="overflow-x-auto rounded-xl border bg-card p-2 scrollbar-none lg:w-56 lg:shrink-0">
      <nav className="flex lg:block">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
              path === href && "bg-primary/10 font-semibold text-primary",
            )}
          >
            <Icon className="size-4" />
            {label}
            <ChevronRight className="ml-auto hidden size-4 lg:block" />
          </Link>
        ))}
      </nav>
    </aside>
  );
}
