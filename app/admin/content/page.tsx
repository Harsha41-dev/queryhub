// admin content moderation table

import type { Metadata } from "next";
import { AdminTable } from "@/components/admin/admin-table";
import { parseAdminOptions, type AdminSearchParams } from "@/lib/admin-options";
import { getAdminRowsPage } from "@/lib/query-data";
export const metadata: Metadata = { title: "Manage content" };
export default async function AdminContentPage({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const params = await searchParams;
  const initialPage = await getAdminRowsPage(
    "content",
    parseAdminOptions(params),
  );
  return <AdminTable kind="content" initialPage={initialPage} />;
}
