// about QueryHub

import { StaticPage } from "@/components/static-page";
export default function AboutPage() {
  return (
    <StaticPage
      title="Knowledge gets better when people build it together"
      intro="QueryHub is a question-and-answer community designed for clear reasoning, useful experience, and respectful disagreement."
      sections={[
        {
          title: "Why we built it",
          body: "The internet has plenty of information. What is harder to find is context: why a recommendation works, where it breaks, and what someone learned by applying it. QueryHub gives those explanations a durable home.",
        },
        {
          title: "What we value",
          body: "We value clarity over performance, evidence over certainty, and generosity over point-scoring. Reputation is earned through consistent, useful contributions—not volume alone.",
        },
        {
          title: "Original by design",
          body: "QueryHub is an independent product concept. Its identity, interface, content, and implementation are original and are not affiliated with Quora or any other question-and-answer service.",
        },
      ]}
    />
  );
}
