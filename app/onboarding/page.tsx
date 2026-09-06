// first-run personalization flow

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { getOnboardingOptions } from "@/lib/query-data";
import { getActiveSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Personalize your feed",
  robots: { index: false, follow: false },
};

export default async function OnboardingPage() {
  const session = await getActiveSession();
  if (!session) redirect("/login?callbackUrl=/onboarding");
  const options = await getOnboardingOptions(session.user.id);
  return (
    <AppShell rightSidebar={false} wide>
      <OnboardingFlow options={options} />
    </AppShell>
  );
}
