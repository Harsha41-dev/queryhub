import Link from "next/link";
import { Bell, ChevronRight, Lock, Palette, UserRound } from "lucide-react";

const cards = [
  {
    href: "/settings/profile",
    title: "Public profile",
    text: "Name, bio, photo, links, and expertise",
    icon: UserRound,
  },
  {
    href: "/settings/account",
    title: "Account & security",
    text: "Email, password, sessions, and account deletion",
    icon: Lock,
  },
  {
    href: "/settings/privacy",
    title: "Privacy & appearance",
    text: "Visibility, messages, activity, and theme",
    icon: Palette,
  },
  {
    href: "/settings/notifications",
    title: "Notification preferences",
    text: "Choose what reaches your inbox and devices",
    icon: Bell,
  },
];
export default function SettingsPage() {
  return (
    <section className="rounded-xl border bg-card p-5 sm:p-6">
      <h2 className="text-lg font-bold">Your preferences</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Changes apply across all devices signed in to this account.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {cards.map(({ href, title, text, icon: Icon }) => (
          <Link
            href={href}
            key={href}
            className="group flex gap-3 rounded-xl border p-4 hover:border-primary/30 hover:bg-primary/[0.025]"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="font-semibold group-hover:text-primary">
                {title}
              </span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {text}
              </span>
            </span>
            <ChevronRight className="ml-auto size-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </section>
  );
}
