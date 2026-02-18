import "server-only";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// get current user from JWT, and make sure they still exist / aren't suspended
export async function getActiveSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const user = await prisma.user.findFirst({
    where: { id: session.user.id, deletedAt: null, suspendedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      username: true,
      sessionVersion: true,
    },
  });
  // sessionVersion changes after password reset / suspend so old tokens stop working
  if (!user || user.sessionVersion !== Number(session.user.sessionVersion ?? 0))
    return null;

  session.user = { ...session.user, ...user };
  return session;
}
