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
  const topic = await prisma.topic.findFirst({
    where: { slug, deletedAt: null },
    select: {
      name: true,
      description: true,
      followerCount: true,
      questionCount: true,
      color: true,
    },
  });
  if (!topic) return new Response("Not found", { status: 404 });

  const accent = topic.color ?? "#4f46e5";

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
        <div
          style={{
            width: 112,
            height: 112,
            borderRadius: 24,
            background: accent,
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 40,
            fontWeight: 900,
          }}
        >
          {topic.name
            .split(/\s+/)
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </div>
        <div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: 0,
            }}
          >
            {topic.name}
          </div>
          <div
            style={{
              marginTop: 24,
              maxWidth: 960,
              fontSize: 30,
              lineHeight: 1.35,
              color: "#475569",
            }}
          >
            {topic.description}
          </div>
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
          <span>
            {topic.followerCount} followers - {topic.questionCount} questions
          </span>
          <span style={{ fontWeight: 900, color: accent }}>QueryHub</span>
        </div>
      </div>
    ),
    size,
  );
}
