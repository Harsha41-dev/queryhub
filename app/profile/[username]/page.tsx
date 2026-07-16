import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ProfileView } from "@/components/profile/profile-view";
import { getProfileView } from "@/lib/query-data";
import { getActiveSession } from "@/lib/session";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const view = await getProfileView(username);
  return { title: view?.person.name ?? "Profile" };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const session = await getActiveSession();
  const view = await getProfileView(
    username,
    session?.user.id,
    session?.user.role,
  );
  if (!view) notFound();
  const ownProfile = session?.user.username === username;
  return (
    <AppShell publicMode={!session} rightSidebar={false} wide>
      <ProfileView
        person={view.person}
        questions={view.questions}
        answers={view.answers}
        ownProfile={ownProfile}
        publicMode={!session}
      />
    </AppShell>
  );
}
