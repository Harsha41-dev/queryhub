// admin shell – only mods/admins

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminNav } from "@/components/admin/admin-nav";
import { canModerate } from "@/lib/authorization";
import { getActiveSession } from "@/lib/session";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getActiveSession();
  if (!session?.user) redirect("/login?callbackUrl=/admin");
  // normal users get bounced back home
  if (!canModerate(session.user.role)) redirect("/home");
  return (
    <div className="min-h-screen bg-background">
      <AdminNav role={session.user.role} />
      <div className="lg:pl-64">
        <AdminHeader />
        <main id="main-content" className="p-4 sm:p-7">
          {children}
        </main>
      </div>
    </div>
  );
}
