import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { loginSchema } from "@/lib/validators";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { checkRateLimit, clearRateLimit } from "@/lib/rate-limit";

// dummy hash so we still do bcrypt work when email is missing (harder to time users)
const INVALID_LOGIN_HASH =
  "$2b$12$YDPQFHxQV2q6x8KM8MiwOOl0pfNoCv7/kPCluuA5Yf8DEB2OzFy5u";

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Email and password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const parsed = loginSchema.safeParse(credentials);
      if (!parsed.success) return null;
      const rateLimitKey = `login:${parsed.data.email}`;
      const loginLimit = await checkRateLimit(rateLimitKey, 10, 15 * 60_000);
      if (!loginLimit.allowed) return null;
      const user = await prisma.user.findUnique({
        where: { email: parsed.data.email },
      });
      const valid = await compare(
        parsed.data.password,
        user?.passwordHash ?? INVALID_LOGIN_HASH,
      );
      // block deleted / suspended accounts too
      if (!user?.passwordHash || user.deletedAt || user.suspendedAt || !valid)
        return null;
      await clearRateLimit(rateLimitKey, 15 * 60_000);
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
        username: user.username,
        sessionVersion: user.sessionVersion,
      };
    },
  }),
];

if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

export const authOptions: NextAuthOptions = {
  providers,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;
      if (!user.email) return false;

      const linked = await prisma.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: account.provider,
            providerAccountId: account.providerAccountId,
          },
        },
        include: { user: true },
      });
      const localUser =
        linked?.user ??
        (await findOrCreateOAuthUser({
          email: user.email,
          name: user.name,
          image: user.image,
        }));
      if (localUser.deletedAt || localUser.suspendedAt) return false;

      await prisma.account.upsert({
        where: {
          provider_providerAccountId: {
            provider: account.provider,
            providerAccountId: account.providerAccountId,
          },
        },
        create: {
          userId: localUser.id,
          type: account.type,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          access_token: account.access_token,
          expires_at: account.expires_at,
          id_token: account.id_token,
          refresh_token: account.refresh_token,
          scope: account.scope,
          session_state: account.session_state,
          token_type: account.token_type,
        },
        update: {
          access_token: account.access_token,
          expires_at: account.expires_at,
          id_token: account.id_token,
          refresh_token: account.refresh_token,
          scope: account.scope,
          session_state: account.session_state,
          token_type: account.token_type,
        },
      });
      user.id = localUser.id;
      user.name = localUser.name;
      user.image = localUser.image;
      user.role = localUser.role;
      user.username = localUser.username;
      user.sessionVersion = localUser.sessionVersion;
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.username = user.username;
        token.sessionVersion = user.sessionVersion;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id ?? token.sub);
        session.user.role =
          token.role === "ADMIN" || token.role === "MODERATOR"
            ? token.role
            : "USER";
        session.user.username = token.username;
        session.user.sessionVersion = Number(token.sessionVersion ?? 0);
      }
      return session;
    },
  },
  secret: env.NEXTAUTH_SECRET,
};

async function findOrCreateOAuthUser(user: {
  email: string;
  name?: string | null;
  image?: string | null;
}) {
  const email = user.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;

  const stem = email
    .split("@")[0]
    .replace(/[^a-z0-9_]/gi, "")
    .toLowerCase()
    .slice(0, 24);
  let username = stem.length >= 3 ? stem : `user_${stem}`;
  const usernameExists = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (usernameExists)
    username = `${username.slice(0, 20)}_${crypto.randomUUID().slice(0, 8)}`;
  return prisma.user.create({
    data: {
      email,
      emailVerified: new Date(),
      image: user.image,
      name: user.name?.trim() || username,
      username,
      preference: { create: {} },
    },
  });
}
