import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { appBaseUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = appBaseUrl();

  const [questions, topics, users, spaces] = await Promise.all([
    prisma.question.findMany({
      where: { deletedAt: null, isHidden: false, mergedIntoId: null },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 1000,
    }),
    prisma.topic.findMany({
      where: { deletedAt: null },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
    prisma.user.findMany({
      where: {
        deletedAt: null,
        suspendedAt: null,
        OR: [
          { preference: { is: null } },
          { preference: { is: { profilePublic: true } } },
        ],
      },
      select: { username: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 1000,
    }),
    prisma.space.findMany({
      where: { deletedAt: null },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
  ]);

  return ["", "/about", "/guidelines", "/spaces"]
    .map((path) => ({
      url: `${baseUrl}${path}`,
      lastModified: new Date(),
    }))
    .concat(
      questions.map((question) => ({
        url: `${baseUrl}/question/${question.slug}`,
        lastModified: question.updatedAt,
      })),
      topics.map((topic) => ({
        url: `${baseUrl}/topic/${topic.slug}`,
        lastModified: topic.updatedAt,
      })),
      users.map((user) => ({
        url: `${baseUrl}/profile/${user.username}`,
        lastModified: user.updatedAt,
      })),
      spaces.map((space) => ({
        url: `${baseUrl}/spaces/${space.slug}`,
        lastModified: space.updatedAt,
      })),
    );
}
