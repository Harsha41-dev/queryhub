import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { NotificationList } from "@/components/notifications/notification-list";
import { PageHeading } from "@/components/page-heading";
import { buttonVariants } from "@/components/ui/button";
import { getNotifications } from "@/lib/query-data";
import { getActiveSession } from "@/lib/session";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const session = await getActiveSession();
  if (!session) redirect("/login?callbackUrl=/notifications");
  const items = await getNotifications(session.user.id);
  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeading
          title="Notifications"
          description="Responses, mentions, and activity from your network."
          action={
            <Link
              href="/settings/notifications"
              className={buttonVariants({ variant: "outline", size: "icon" })}
              aria-label="Notification settings"
            >
              <Settings className="size-4" />
            </Link>
          }
        />
        <NotificationList initialItems={items} />
      </div>
    </AppShell>
  );
}
