import type { Metadata } from "next";
import { AdminTable } from "@/components/admin/admin-table";
import { getAdminRows } from "@/lib/query-data";
export const metadata: Metadata = { title: "Manage content" };
export default async function AdminContentPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const rows = await getAdminRows("content");
  const params = await searchParams;
  return (
    <AdminTable kind="content" rows={rows} initialQuery={params.q ?? ""} />
  );
}
