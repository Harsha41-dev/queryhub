// email / password / delete account

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountForm } from "@/components/settings/account-form";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/session";

export const metadata: Metadata = { title: "Account settings" };

export default async function AccountSettingsPage() {
  const session = await getActiveSession();
  if (!session?.user) redirect("/login?callbackUrl=/settings/account");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  });
  if (!user) redirect("/login");
  return <AccountForm email={user.email} />;
}
