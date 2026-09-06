// admin user management table

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminTable } from "@/components/admin/admin-table";
import { parseAdminOptions, type AdminSearchParams } from "@/lib/admin-options";
import { canManageUsers } from "@/lib/authorization";
import { getAdminRowsPage } from "@/lib/query-data";
import { getActiveSession } from "@/lib/session";
export const metadata: Metadata = { title: "Manage users" };
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const session = await getActiveSession();
  if (!session?.user || !canManageUsers(session.user.role))
    redirect("/admin/reports");
  const params = await searchParams;
  const initialPage = await getAdminRowsPage("users", {
    ...parseAdminOptions(params),
    actorId: session.user.id,
    actorRole: session.user.role,
  });
  return <AdminTable kind="users" initialPage={initialPage} />;
}
