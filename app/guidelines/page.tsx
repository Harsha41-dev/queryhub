// community guidelines page

import { StaticPage } from "@/components/static-page";
export default function GuidelinesPage() {
  return (
    <StaticPage
      title="Community guidelines"
      intro="Help make QueryHub a place where curiosity is rewarded and expertise is shared responsibly."
      sections={[
        {
          title: "Be useful",
          body: "Answer the question that was asked. Explain your reasoning, name important uncertainty, and cite sources when a factual claim needs support.",
        },
        {
          title: "Be respectful",
          body: "Challenge ideas without attacking people. Harassment, hate, threats, coordinated abuse, and unwanted exposure of private information are not allowed.",
        },
        {
          title: "Be authentic",
          body: "Do not spam, manipulate votes, impersonate others, or publish work you do not have the right to share. Disclose meaningful conflicts of interest.",
        },
        {
          title: "Protect people",
          body: "Health, safety, legal, and financial claims receive additional scrutiny. Reports are confidential, and moderation decisions can be appealed.",
        },
      ]}
    />
  );
}
