import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

const enabled = process.env.RUN_DATABASE_TESTS === "1";
const prisma = new PrismaClient();
const marker = `integration-${Date.now()}`;
let userId = "";
let topicId = "";

describe.skipIf(!enabled)("database mutations", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        name: "Integration User",
        username: marker,
        email: `${marker}@example.com`,
      },
    });
    const topic = await prisma.topic.create({
      data: {
        name: marker,
        slug: marker,
        description: "Integration test topic",
      },
    });
    userId = user.id;
    topicId = topic.id;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.question.deleteMany({ where: { authorId: userId } });
      await prisma.user.delete({ where: { id: userId } });
    }
    if (topicId) await prisma.topic.delete({ where: { id: topicId } });
    await prisma.$disconnect();
  });

  it("creates a question and answer atomically with denormalized counts", async () => {
    const question = await prisma.question.create({
      data: {
        authorId: userId,
        slug: `${marker}-question`,
        title: "How does the integration mutation behave?",
        topics: { create: { topicId } },
      },
    });
    const secondUser = await prisma.user.findFirstOrThrow({
      where: { id: { not: userId } },
    });
    const answer = await prisma.$transaction(async (tx) => {
      const created = await tx.answer.create({
        data: {
          authorId: secondUser.id,
          questionId: question.id,
          content:
            "This answer is long enough to model the real mutation and verify its transactional counter update.",
        },
      });
      await tx.question.update({
        where: { id: question.id },
        data: { answerCount: { increment: 1 } },
      });
      return created;
    });
    const updated = await prisma.question.findUniqueOrThrow({
      where: { id: question.id },
    });
    expect(answer.questionId).toBe(question.id);
    expect(updated.answerCount).toBe(1);
  });

  it("enforces one vote per user and target", async () => {
    const question = await prisma.question.findFirstOrThrow({
      where: { authorId: userId },
    });
    await prisma.vote.create({
      data: { userId, questionId: question.id, value: "UP" },
    });
    await expect(
      prisma.vote.create({
        data: { userId, questionId: question.id, value: "DOWN" },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });
});
