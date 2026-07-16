import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NotificationPreferences } from "@/components/settings/notification-preferences";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/session";

export const metadata: Metadata = { title: "Notification settings" };

export default async function NotificationSettingsPage() {
  const session = await getActiveSession();
  if (!session?.user) redirect("/login?callbackUrl=/settings/notifications");
  const preference = await prisma.userPreference.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id },
    update: {},
  });
  return <NotificationPreferences initial={preference} />;
}
