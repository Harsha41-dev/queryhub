import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminTable } from "@/components/admin/admin-table";
import { hasRole } from "@/lib/authorization";
import { getAdminRows } from "@/lib/query-data";
import { getActiveSession } from "@/lib/session";
export const metadata: Metadata = { title: "Manage topics" };
export default async function AdminTopicsPage() {
  const session = await getActiveSession();
  if (!hasRole(session?.user.role, "ADMIN")) redirect("/admin/reports");
  const rows = await getAdminRows("topics");
  return <AdminTable kind="topics" rows={rows} />;
}
