import "dotenv/config";

process.env.APP_ENV ??= "test";
process.env.APP_URL ??= "http://localhost:3000";
process.env.DATABASE_URL ??=
  "postgresql://queryhub:queryhub@localhost:5432/queryhub";
process.env.DIRECT_URL ??=
  "postgresql://queryhub:queryhub@localhost:5432/queryhub";
process.env.NEXTAUTH_URL ??= "http://localhost:3000";
process.env.NEXTAUTH_SECRET ??=
  "test-nextauth-secret-at-least-thirty-two-characters";
process.env.EMAIL_FROM ??= "QueryHub <noreply@example.com>";
process.env.READINESS_TOKEN ??= "test-readiness-token-at-least-32-chars";

import "@testing-library/jest-dom/vitest";
