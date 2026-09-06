import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { finishOnboardingIfNeeded } from "./helpers";

const prisma = new PrismaClient();

test.describe.serial("complete content and social mutations", () => {
  test.setTimeout(120_000);

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("registers and persists question, answer, comment, vote, bookmark, follow, search, and report changes", async ({
    page,
  }) => {
    const marker = `audit${Date.now()}`;
    const email = `${marker}@example.com`;
    await page.goto("/register");
    await page.getByLabel("Full name").fill("Audit Workflow");
    await page.getByLabel("Username").fill(marker);
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel(/^Password/).fill("Workflow123");
    await page.getByLabel("Confirm password").fill("Workflow123");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Create account" }).click();
    await finishOnboardingIfNeeded(page);
    await expect(page).toHaveURL(/\/home/);

    await page.reload();
    await expect(
      page.getByText("What do you want to know?").first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Ask a question" }).click();
    const originalTitle = `How should teams validate ${marker} before release?`;
    await page
      .getByPlaceholder("What would you like to understand better?")
      .fill(originalTitle);
    await page
      .getByPlaceholder(/Share what you already know/)
      .fill(
        "This audit needs a complete workflow with persistent data and server-side authorization checks.",
      );
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: /Software Engineering/ }).click();
    await page.getByRole("button", { name: "Publish question" }).click();
    await expect(page).toHaveURL(/\/question\//);

    const question = await prisma.question.findFirstOrThrow({
      where: { title: originalTitle },
    });
    const updatedTitle = `How can teams validate ${marker} safely before release?`;
    const questionUpdate = await page.request.patch(
      `/api/questions/${question.id}`,
      {
        data: {
          title: updatedTitle,
          description: "Updated through the authenticated ownership endpoint.",
        },
      },
    );
    expect(questionUpdate.status()).toBe(200);
    const updatedQuestion = (await questionUpdate.json()) as {
      data: { slug: string };
    };
    await page.goto(`/question/${updatedQuestion.data.slug}`);
    await expect(
      page.getByRole("heading", { name: updatedTitle }),
    ).toBeVisible();
    const viewsBeforeReload = (
      await prisma.question.findUniqueOrThrow({ where: { id: question.id } })
    ).viewCount;
    await page.reload();
    await expect
      .poll(
        async () =>
          (
            await prisma.question.findUniqueOrThrow({
              where: { id: question.id },
            })
          ).viewCount,
      )
      .toBeGreaterThan(viewsBeforeReload);

    await page.getByRole("button", { name: "Answer" }).first().click();
    const answerBody = `The ${marker} workflow should verify authorization, persistence, rollback behavior, and the user-visible result before release.`;
    await page.getByPlaceholder(/Write from experience/).fill(answerBody);
    await page.getByRole("button", { name: "Preview" }).click();
    await expect(page.getByText(answerBody)).toBeVisible();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByRole("button", { name: "Publish answer" }).click();
    await expect(page.getByText("Your answer was published")).toBeVisible();

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const answer = await prisma.answer.findFirstOrThrow({
      where: { questionId: question.id, authorId: user.id },
    });
    const safeXssText = `<img src=x onerror="window.__queryHubXss=true"> ${answerBody}`;
    const answerUpdate = await page.request.patch(`/api/answers/${answer.id}`, {
      data: { content: safeXssText },
    });
    expect(answerUpdate.status()).toBe(200);
    await page.reload();
    const escapedPayloads = page.getByText(/<img src=x onerror=/);
    expect(await escapedPayloads.count()).toBeGreaterThan(0);
    await expect(escapedPayloads.first()).toBeVisible();
    expect(
      await page.evaluate(() => Reflect.get(window, "__queryHubXss")),
    ).toBeUndefined();

    const mentionedUser = await prisma.user.findUniqueOrThrow({
      where: { email: "maya@queryhub.dev" },
    });
    const commentResponse = await page.request.post("/api/comments", {
      data: {
        answerId: answer.id,
        content: `Root ${marker} comment for @${mentionedUser.username}`,
      },
    });
    expect(commentResponse.status()).toBe(201);
    const comment = (await commentResponse.json()) as { data: { id: string } };
    expect(
      await prisma.notification.count({
        where: {
          recipientId: mentionedUser.id,
          actorId: user.id,
          commentId: comment.data.id,
          type: "MENTION",
        },
      }),
    ).toBe(1);
    const replyResponse = await page.request.post("/api/comments", {
      data: {
        answerId: answer.id,
        parentId: comment.data.id,
        content: `Nested ${marker} reply`,
      },
    });
    expect(replyResponse.status()).toBe(201);
    const reply = (await replyResponse.json()) as { data: { id: string } };
    expect(
      (
        await page.request.patch(`/api/comments/${comment.data.id}`, {
          data: { content: `Edited ${marker} comment` },
        })
      ).status(),
    ).toBe(200);

    const voteBody = { answerId: answer.id, value: 1 };
    const [firstVote, duplicateVote] = await Promise.all([
      page.request.post("/api/votes", { data: voteBody }),
      page.request.post("/api/votes", { data: voteBody }),
    ]);
    expect(firstVote.status()).toBe(200);
    expect(duplicateVote.status()).toBe(200);
    expect(
      await prisma.vote.count({
        where: { userId: user.id, answerId: answer.id },
      }),
    ).toBe(1);
    expect(
      (
        await page.request.post("/api/votes", {
          data: { answerId: answer.id, value: -1 },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await page.request.post("/api/votes", {
          data: { answerId: answer.id, value: 0 },
        })
      ).status(),
    ).toBe(200);
    expect(
      await prisma.vote.count({
        where: { userId: user.id, answerId: answer.id },
      }),
    ).toBe(0);

    expect(
      (
        await page.request.post("/api/bookmarks", {
          data: { questionId: question.id },
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await page.request.post("/api/bookmarks", {
          data: { answerId: answer.id },
        })
      ).status(),
    ).toBe(201);
    await page.goto("/bookmarks");
    const bookmarkedPayloads = page.getByText(safeXssText, { exact: false });
    await expect(bookmarkedPayloads).toHaveCount(2);
    await expect(bookmarkedPayloads.first()).toBeVisible();

    const topic = await prisma.topic.findUniqueOrThrow({
      where: { slug: "software-engineering" },
    });
    const targetUser = await prisma.user.findUniqueOrThrow({
      where: { email: "maya@queryhub.dev" },
    });
    expect(
      (
        await page.request.post("/api/follows", {
          data: { questionId: question.id },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await page.request.post("/api/follows", { data: { topicId: topic.id } })
      ).status(),
    ).toBe(200);
    expect(
      (
        await page.request.post("/api/follows", {
          data: { userId: targetUser.id },
        })
      ).status(),
    ).toBe(200);
    expect(
      await prisma.questionFollow.count({
        where: { userId: user.id, questionId: question.id },
      }),
    ).toBe(1);
    expect(
      await prisma.topicFollow.count({
        where: { userId: user.id, topicId: topic.id },
      }),
    ).toBe(1);
    expect(
      await prisma.userFollow.count({
        where: { followerId: user.id, followingId: targetUser.id },
      }),
    ).toBe(1);

    const search = await page.request.get(`/api/search?q=${marker}`);
    expect(search.status()).toBe(200);
    const searchBody = (await search.json()) as {
      data: { counts: { questions: number; answers: number } };
    };
    expect(searchBody.data.counts.questions).toBeGreaterThan(0);
    expect(searchBody.data.counts.answers).toBeGreaterThan(0);
    const categoryChecks = [
      ["database", "questions"],
      ["reversible", "answers"],
      ["Software Engineering", "topics"],
      ["Maya", "people"],
    ] as const;
    for (const [query, category] of categoryChecks) {
      const response = await page.request.get(
        `/api/search?q=${encodeURIComponent(query)}`,
      );
      const body = (await response.json()) as {
        data: { counts: Record<string, number> };
      };
      expect(
        body.data.counts[category],
        `${category} search for ${query}`,
      ).toBeGreaterThan(0);
    }
    expect(
      (
        await page.request.post("/api/reports", {
          data: {
            answerId: answer.id,
            reason: "OTHER",
            details: `Audit report ${marker}`,
          },
        })
      ).status(),
    ).toBe(201);

    expect(
      (await page.request.delete(`/api/comments/${comment.data.id}`)).status(),
    ).toBe(200);
    const deletedComments = await prisma.comment.findMany({
      where: { id: { in: [comment.data.id, reply.data.id] } },
      select: { deletedAt: true },
    });
    expect(deletedComments.every((item) => item.deletedAt !== null)).toBe(true);
    expect(
      (await page.request.delete(`/api/answers/${answer.id}`)).status(),
    ).toBe(200);
    expect(
      (await page.request.delete(`/api/questions/${question.id}`)).status(),
    ).toBe(200);
  });
});
