import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // CLI migrations use the non-pooled connection. Prisma Client continues to
    // use DATABASE_URL from schema.prisma at runtime.
    url: env("DIRECT_URL"),
  },
});
