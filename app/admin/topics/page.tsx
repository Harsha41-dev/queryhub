// admin topic management

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminTable } from "@/components/admin/admin-table";
import { parseAdminOptions, type AdminSearchParams } from "@/lib/admin-options";
import { hasRole } from "@/lib/authorization";
import { getAdminRowsPage } from "@/lib/query-data";
import { getActiveSession } from "@/lib/session";
export const metadata: Metadata = { title: "Manage topics" };
export default async function AdminTopicsPage({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const session = await getActiveSession();
  if (!hasRole(session?.user.role, "ADMIN")) redirect("/admin/reports");
  const params = await searchParams;
  const initialPage = await getAdminRowsPage(
    "topics",
    parseAdminOptions(params),
  );
  return <AdminTable kind="topics" initialPage={initialPage} />;
}
