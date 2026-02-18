import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const size = {
  width: 1200,
  height: 630,
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const question = await prisma.question.findFirst({
    where: { slug, deletedAt: null, isHidden: false, mergedIntoId: null },
    select: {
      title: true,
      answerCount: true,
      topics: {
        include: { topic: { select: { name: true } } },
        take: 4,
      },
    },
  });
  if (!question) return new Response("Not found", { status: 404 });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f8fafc",
          color: "#0f172a",
          padding: 64,
          fontFamily: "Inter, Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {question.topics.map((item) => (
            <div
              key={item.topic.name}
              style={{
                border: "2px solid #e2e8f0",
                borderRadius: 999,
                padding: "10px 18px",
                fontSize: 24,
                fontWeight: 700,
                color: "#475569",
              }}
            >
              {item.topic.name}
            </div>
          ))}
        </div>
        <div
          style={{
            fontSize: 62,
            fontWeight: 900,
            lineHeight: 1.08,
            letterSpacing: 0,
            maxWidth: 1040,
          }}
        >
          {question.title}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 28,
            color: "#475569",
          }}
        >
          <span>{question.answerCount} answers</span>
          <span style={{ fontWeight: 900, color: "#4f46e5" }}>QueryHub</span>
        </div>
      </div>
    ),
    size,
  );
}
