// privacy policy page

import { StaticPage } from "@/components/static-page";
export default function PrivacyPage() {
  return (
    <StaticPage
      title="Privacy policy"
      intro="QueryHub is designed to collect only the information needed to provide and protect the community."
      sections={[
        {
          title: "Information collected",
          body: "Account details, public profile information, content, interaction history, session data, and limited technical logs are used to operate the service.",
        },
        {
          title: "How information is used",
          body: "Information personalizes feeds, secures accounts, supports moderation, measures platform health, and delivers notifications you choose to receive.",
        },
        {
          title: "Your choices",
          body: "Settings control profile visibility, activity, messages, theme, and notifications. Account deletion begins a recovery period before permanent removal.",
        },
        {
          title: "Security and retention",
          body: "Passwords are hashed and secrets stay server-side. Production deployments should add managed key rotation, encrypted backups, and documented retention schedules.",
        },
      ]}
    />
  );
}
