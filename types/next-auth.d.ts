import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: "USER" | "MODERATOR" | "ADMIN";
    username?: string;
    sessionVersion: number;
  }
  interface Session {
    user: {
      id: string;
      role: "USER" | "MODERATOR" | "ADMIN";
      username?: string;
      sessionVersion: number;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "USER" | "MODERATOR" | "ADMIN";
    username?: string;
    sessionVersion?: number;
  }
}
