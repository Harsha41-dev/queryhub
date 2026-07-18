// terms of use page

import { StaticPage } from "@/components/static-page";
export default function TermsPage() {
  return (
    <StaticPage
      title="Terms of service"
      intro="These plain-language terms describe the rules for using QueryHub. A production deployment should have these terms reviewed by qualified counsel."
      sections={[
        {
          title: "Your account",
          body: "Keep your credentials secure and provide accurate account information. You are responsible for activity performed through your account.",
        },
        {
          title: "Your content",
          body: "You retain ownership of content you create and grant QueryHub the limited rights needed to host, display, moderate, and distribute it as part of the service.",
        },
        {
          title: "Acceptable use",
          body: "Do not abuse the service, access data without authorization, interfere with platform operation, or use QueryHub to violate the rights of others.",
        },
        {
          title: "Service changes",
          body: "Features may change as the platform evolves. Material updates to these terms should be announced before they take effect.",
        },
      ]}
    />
  );
}
