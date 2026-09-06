import { NextResponse } from "next/server";
import { actionSuccess } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import {
  checkRateLimit,
  clientRateLimitKey,
  rateLimitResponse,
} from "@/lib/rate-limit";
import { getActiveSession } from "@/lib/session";

const accents = ["#4f46e5", "#0891b2", "#16a34a", "#c2410c"];

export async function GET(request: Request) {
  const limit = await checkRateLimit(
    `sidebar:${clientRateLimitKey(request)}`,
    120,
    60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);

  const session = await getActiveSession();
  const topicSelect = {
    id: true,
    slug: true,
    name: true,
    description: true,
    followerCount: true,
    questionCount: true,
    color: true,
  } as const;
  let topics = session
    ? await prisma.topic.findMany({
        where: {
          deletedAt: null,
          followers: { some: { userId: session.user.id } },
        },
        select: topicSelect,
        orderBy: { followerCount: "desc" },
        take: 4,
      })
    : [];
  if (topics.length === 0)
    topics = await prisma.topic.findMany({
      where: { deletedAt: null },
      select: topicSelect,
      orderBy: [{ questionCount: "desc" }, { followerCount: "desc" }],
      take: 4,
    });

  const people = await prisma.user.findMany({
    where: {
      id: session ? { not: session.user.id } : undefined,
      deletedAt: null,
      suspendedAt: null,
      OR: [
        { preference: { is: null } },
        { preference: { is: { profilePublic: true } } },
      ],
    },
    select: {
      id: true,
      name: true,
      username: true,
      image: true,
      occupation: true,
      bio: true,
      role: true,
      _count: { select: { followers: true, answers: true } },
    },
    orderBy: [{ reputation: "desc" }, { createdAt: "desc" }],
    take: 3,
  });

  return NextResponse.json(
    actionSuccess({
      topics: topics.map((topic, index) => ({
        id: topic.id,
        slug: topic.slug,
        name: topic.name,
        description: topic.description,
        followers: topic.followerCount,
        questions: topic.questionCount,
        accent: topic.color ?? accents[index % accents.length],
        icon: topic.name
          .split(/\s+/)
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
      })),
      people: people.map((person) => ({
        id: person.id,
        name: person.name,
        username: person.username,
        avatar: person.image ?? "https://i.pravatar.cc/160?img=11",
        headline: person.occupation ?? person.bio ?? "QueryHub contributor",
        verified: person.role === "ADMIN" || person.role === "MODERATOR",
        followers: person._count.followers,
        answers: person._count.answers,
        expertise: [],
      })),
    }),
  );
}
