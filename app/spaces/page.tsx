// browse and create topic-based communities

import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeading } from "@/components/page-heading";
import { SpaceList } from "@/components/spaces/space-list";
import { getSpaceInvites, getSpaces } from "@/lib/query-data";
import { getActiveSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Spaces",
  description: "Join focused QueryHub communities and submit questions.",
};

export default async function SpacesPage() {
  const session = await getActiveSession();
  const [spaces, invites] = await Promise.all([
    getSpaces(session?.user.id),
    session?.user.id ? getSpaceInvites(session.user.id) : Promise.resolve([]),
  ]);
  return (
    <AppShell rightSidebar={false} publicMode={!session} wide>
      <div className="space-y-4">
        <PageHeading
          title="Spaces"
          description="Focused communities with moderators, submissions, and curated questions."
        />
        <SpaceList
          initialSpaces={spaces}
          initialInvites={invites}
          publicMode={!session}
        />
      </div>
    </AppShell>
  );
}
