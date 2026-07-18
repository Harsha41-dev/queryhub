// admin report queue

import type { Metadata } from "next";
import { AdminTable } from "@/components/admin/admin-table";
import { getAdminRows } from "@/lib/query-data";
export const metadata: Metadata = { title: "Reports" };
export default async function AdminReportsPage() {
  const rows = await getAdminRows("reports");
  return <AdminTable kind="reports" rows={rows} />;
}
