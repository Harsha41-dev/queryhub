import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PrivacyForm } from "@/components/settings/preference-form";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/session";

export const metadata: Metadata = { title: "Privacy settings" };

export default async function PrivacySettingsPage() {
  const session = await getActiveSession();
  if (!session?.user) redirect("/login?callbackUrl=/settings/privacy");
  const preference = await prisma.userPreference.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id },
    update: {},
  });
  return <PrivacyForm initial={preference} />;
}
