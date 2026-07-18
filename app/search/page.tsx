// search page (client SearchView does the work)

import { Suspense } from "react";
import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { SearchView } from "@/components/search/search-view";
import { Skeleton } from "@/components/ui/skeleton";
import { getActiveSession } from "@/lib/session";

export const metadata: Metadata = { title: "Search" };
export default async function SearchPage() {
  const session = await getActiveSession();
  return (
    <AppShell publicMode={!session} rightSidebar={false} wide>
      <div className="mx-auto max-w-3xl">
        <Suspense fallback={<Skeleton className="h-96" />}>
          <SearchView />
        </Suspense>
      </div>
    </AppShell>
  );
}
