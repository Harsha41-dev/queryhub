// admin report queue

import type { Metadata } from "next";
import { AdminTable } from "@/components/admin/admin-table";
import { parseAdminOptions, type AdminSearchParams } from "@/lib/admin-options";
import { getAdminRowsPage } from "@/lib/query-data";
export const metadata: Metadata = { title: "Reports" };
export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const params = await searchParams;
  const initialPage = await getAdminRowsPage(
    "reports",
    parseAdminOptions(params),
  );
  return <AdminTable kind="reports" initialPage={initialPage} />;
}
