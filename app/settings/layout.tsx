import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeading } from "@/components/page-heading";
import { SettingsNav } from "@/components/settings/settings-nav";
import { getActiveSession } from "@/lib/session";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getActiveSession();
  if (!session) redirect("/login?callbackUrl=/settings");
  return (
    <AppShell rightSidebar={false} wide>
      <div className="space-y-4">
        <PageHeading
          title="Settings"
          description="Manage your profile, account security, privacy, and notifications."
        />
        <div className="flex flex-col gap-4 lg:flex-row">
          <SettingsNav />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </AppShell>
  );
}
