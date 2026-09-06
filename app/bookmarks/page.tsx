// saved questions / answers for the current user

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { BookmarkLibrary } from "@/components/bookmarks/bookmark-library";
import { PageHeading } from "@/components/page-heading";
import {
  getBookmarkedQuestions,
  getBookmarkCollections,
} from "@/lib/query-data";
import { getActiveSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Bookmarks",
  robots: { index: false, follow: false },
};

export default async function BookmarksPage() {
  const session = await getActiveSession();
  if (!session) redirect("/login?callbackUrl=/bookmarks");
  const [saved, collections] = await Promise.all([
    getBookmarkedQuestions(session.user.id),
    getBookmarkCollections(session.user.id),
  ]);
  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeading
          title="Bookmarks"
          description="A private library of questions and answers you want to revisit."
        />
        <BookmarkLibrary saved={saved} initialCollections={collections} />
      </div>
    </AppShell>
  );
}
