import { NextResponse } from "next/server";
import { z } from "zod";
import { actionError, actionSuccess } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import {
  checkRateLimit,
  clientRateLimitKey,
  rateLimitResponse,
} from "@/lib/rate-limit";

const schema = z.object({ q: z.string().trim().min(2).max(80) });

export async function GET(request: Request) {
  const limit = await checkRateLimit(
    `search-suggest:${clientRateLimitKey(request)}`,
    120,
    60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);

  const parsed = schema.safeParse({
    q: new URL(request.url).searchParams.get("q"),
  });
  if (!parsed.success)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "Enter at least two characters."),
      { status: 400 },
    );

  const query = parsed.data.q;
  const [questions, topics, people] = await prisma.$transaction([
    prisma.question.findMany({
      where: {
        deletedAt: null,
        isHidden: false,
        author: {
          deletedAt: null,
          suspendedAt: null,
          OR: [
            { preference: { is: null } },
            { preference: { is: { profilePublic: true } } },
          ],
        },
        title: { contains: query, mode: "insensitive" },
      },
      select: { title: true, slug: true },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 4,
    }),
    prisma.topic.findMany({
      where: {
        deletedAt: null,
        name: { contains: query, mode: "insensitive" },
      },
      select: { name: true, slug: true },
      orderBy: [{ followerCount: "desc" }, { name: "asc" }],
      take: 4,
    }),
    prisma.user.findMany({
      where: {
        deletedAt: null,
        suspendedAt: null,
        AND: [
          {
            OR: [
              { preference: { is: null } },
              { preference: { is: { profilePublic: true } } },
            ],
          },
          {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { username: { contains: query, mode: "insensitive" } },
            ],
          },
        ],
      },
      select: { name: true, username: true },
      orderBy: [{ reputation: "desc" }, { createdAt: "desc" }],
      take: 4,
    }),
  ]);

  return NextResponse.json(
    actionSuccess({
      suggestions: [
        ...questions.map((item) => ({
          label: item.title,
          href: `/question/${item.slug}`,
          type: "question" as const,
        })),
        ...topics.map((item) => ({
          label: item.name,
          href: `/topic/${item.slug}`,
          type: "topic" as const,
        })),
        ...people.map((item) => ({
          label: item.name,
          href: `/profile/${item.username}`,
          type: "person" as const,
        })),
      ],
    }),
  );
}
