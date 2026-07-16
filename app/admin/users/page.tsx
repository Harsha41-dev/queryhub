import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminTable } from "@/components/admin/admin-table";
import { canActOnRole, canManageUsers } from "@/lib/authorization";
import { getAdminRows } from "@/lib/query-data";
import { getActiveSession } from "@/lib/session";
export const metadata: Metadata = { title: "Manage users" };
export default async function AdminUsersPage() {
  const session = await getActiveSession();
  if (!canManageUsers(session?.user.role)) redirect("/admin/reports");
  const rows = (await getAdminRows("users")).filter((row) => {
    const targetRole =
      row.meta === "USER" || row.meta === "MODERATOR" || row.meta === "ADMIN"
        ? row.meta
        : "ADMIN";
    return (
      row.id !== session?.user.id &&
      canActOnRole(session?.user.role, targetRole)
    );
  });
  return <AdminTable kind="users" rows={rows} />;
}
