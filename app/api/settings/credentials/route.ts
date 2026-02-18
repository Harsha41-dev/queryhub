import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { actionError, actionSuccess } from "@/lib/errors";
import { getUserCredentials } from "@/lib/query-data";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { parseJson } from "@/lib/request";
import { getActiveSession } from "@/lib/session";
import { credentialSchema } from "@/lib/validators";

const deleteSchema = z.object({ id: z.string().cuid() });

export async function GET() {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to view credentials."),
      { status: 401 },
    );
  return NextResponse.json(
    actionSuccess({ credentials: await getUserCredentials(session.user.id) }),
  );
}

export async function POST(request: Request) {
  return upsertCredential(request, "create");
}

export async function PATCH(request: Request) {
  return upsertCredential(request, "update");
}

export async function DELETE(request: Request) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to delete credentials."),
      { status: 401 },
    );
  const limit = await checkRateLimit(
    `credentials:${session.user.id}`,
    40,
    5 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);

  const parsed = deleteSchema.safeParse(await parseJson(request));
  if (!parsed.success)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "Choose a credential."),
      { status: 400 },
    );
  const result = await prisma.userCredential.deleteMany({
    where: { id: parsed.data.id, userId: session.user.id },
  });
  return NextResponse.json(actionSuccess({ deleted: result.count > 0 }));
}

async function upsertCredential(request: Request, mode: "create" | "update") {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to manage credentials."),
      { status: 401 },
    );
  const limit = await checkRateLimit(
    `credentials:${session.user.id}`,
    40,
    5 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);

  const parsed = credentialSchema.safeParse(await parseJson(request));
  if (!parsed.success || (mode === "update" && !parsed.data.id))
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "Check your credential details."),
      { status: 400 },
    );

  const topic = parsed.data.topicId
    ? await prisma.topic.findFirst({
        where: { id: parsed.data.topicId, deletedAt: null },
        select: { id: true },
      })
    : null;
  if (parsed.data.topicId && !topic)
    return NextResponse.json(
      actionError("NOT_FOUND", "That topic is no longer available."),
      { status: 404 },
    );

  if (mode === "update") {
    const existing = await prisma.userCredential.findFirst({
      where: { id: parsed.data.id, userId: session.user.id },
      select: { id: true },
    });
    if (!existing)
      return NextResponse.json(
        actionError("NOT_FOUND", "That credential was not found."),
        { status: 404 },
      );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (parsed.data.isDefault) {
        await tx.userCredential.updateMany({
          where: { userId: session.user.id },
          data: { isDefault: false },
        });
      }
      const data = {
        label: parsed.data.label,
        organization: parsed.data.organization || null,
        url: parsed.data.url || null,
        topicId: parsed.data.topicId,
        isDefault: parsed.data.isDefault,
      };
      return mode === "create"
        ? tx.userCredential.create({
            data: { userId: session.user.id, ...data },
            select: { id: true },
          })
        : tx.userCredential.updateMany({
            where: { id: parsed.data.id, userId: session.user.id },
            data,
          });
    });

    return NextResponse.json(actionSuccess(result), {
      status: mode === "create" ? 201 : 200,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return NextResponse.json(
        actionError(
          "CONFLICT",
          "Your default credential changed. Refresh and try again.",
        ),
        { status: 409 },
      );
    return NextResponse.json(
      actionError("INTERNAL_ERROR", "Credential could not be saved."),
      { status: 500 },
    );
  }
}
