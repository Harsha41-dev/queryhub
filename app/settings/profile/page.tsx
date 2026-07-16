import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/settings/profile-form";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/session";

export const metadata: Metadata = { title: "Profile settings" };

export default async function ProfileSettingsPage() {
  const session = await getActiveSession();
  if (!session?.user) redirect("/login?callbackUrl=/settings/profile");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      username: true,
      image: true,
      bio: true,
      location: true,
      occupation: true,
      website: true,
    },
  });
  if (!user) redirect("/login");
  return <ProfileForm initial={user} />;
}
