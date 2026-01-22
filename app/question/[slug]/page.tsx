// single question page (works for guests + logged-in users)

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { QuestionDetail } from "@/components/question/question-detail";
import { getQuestionDetail } from "@/lib/query-data";
import { appBaseUrl, jsonLd, seoDescription } from "@/lib/seo";
import { getActiveSession } from "@/lib/session";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const question = await getQuestionDetail(slug);
  const description = seoDescription(
    question?.description || question?.answer,
    "Read answers on QueryHub.",
  );
  return {
    title: question?.title ?? "Question",
    description,
    alternates: question
      ? { canonical: `/question/${question.slug}` }
      : undefined,
    openGraph: question
      ? {
          title: question.title,
          description,
          type: "article",
          url: `/question/${question.slug}`,
          images: [
            {
              url: `/og/question/${question.slug}`,
              width: 1200,
              height: 630,
              alt: question.title,
            },
          ],
        }
      : undefined,
    twitter: question
      ? {
          card: "summary_large_image",
          title: question.title,
          description,
          images: [`/og/question/${question.slug}`],
        }
      : undefined,
  };
}

export default async function QuestionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getActiveSession();
  // load votes/bookmarks for this viewer if they're signed in
  const question = await getQuestionDetail(
    slug,
    session?.user.id,
    session?.user.role,
    true,
  );
  if (!question) notFound();
  const baseUrl = appBaseUrl();
  const acceptedAnswer = question.answersList.find((answer) => answer.accepted);
  return (
    <AppShell publicMode={!session}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "QAPage",
            mainEntity: {
              "@type": "Question",
              name: question.title,
              text: question.description || question.title,
              answerCount: question.answers,
              upvoteCount: question.score,
              dateCreated: question.createdAt ?? question.publishedAt,
              author: {
                "@type": "Person",
                name: question.author.name,
                url: `${baseUrl}/profile/${question.author.username}`,
              },
              acceptedAnswer: acceptedAnswer
                ? {
                    "@type": "Answer",
                    text: acceptedAnswer.content.slice(0, 5000),
                    upvoteCount: acceptedAnswer.score,
                    dateCreated: acceptedAnswer.createdAt,
                    url: `${baseUrl}/question/${question.slug}#answer-${acceptedAnswer.id}`,
                    author: {
                      "@type": "Person",
                      name: acceptedAnswer.author.name,
                      url: `${baseUrl}/profile/${acceptedAnswer.author.username}`,
                    },
                  }
                : undefined,
            },
          }),
        }}
      />
      <QuestionDetail question={question} publicMode={!session} />
    </AppShell>
  );
}
