# QueryHub

QueryHub is a production-style Q&A platform inspired by the workflows of Quora: users can ask questions, write rich answers, request answers from specific people, follow topics and users, join Spaces, vote, bookmark, comment, report abuse, and manage profile credentials.

I built it as a portfolio project to show full-stack product engineering beyond simple CRUD: relational modeling, authenticated API routes, personalized feeds, moderation workflows, notifications, rich text, search, testing, deployment checks, and production hardening.

## Screenshots

Add screenshots here after deployment:

- Home feed and question composer
- Question detail with rich answers, credentials, and accepted answer
- Search with filters/autocomplete
- Spaces and moderation queue
- Admin report review

## Tech Stack

- Next.js App Router
- React and TypeScript
- Tailwind CSS
- PostgreSQL
- Prisma ORM
- Auth.js / NextAuth
- Zod validation
- Vitest and Playwright
- Docker and GitHub Actions

## Major Features

- Email/password auth with optional Google OAuth
- Email verification, password reset, email-change confirmation, and session invalidation
- Questions, answers, comments, voting, follows, and bookmarks
- Rich markdown answer/question editor with toolbar, preview, links, code, quotes, lists, and image uploads
- Specific answer requests with suggested users and notifications
- Topic-specific user credentials shown beside answers
- Personalized feeds using followed topics/users/questions, quality signals, freshness, and feedback controls
- Hide question, mute user, and not-interested topic controls
- Spaces with membership, owner/moderator roles, submissions, approvals, and notifications
- Reputation and badges for useful contributions
- Accepted/best answer selection with reputation rewards
- Bookmark collections
- Search across questions, answers, topics, and people with autocomplete, filters, and sorting
- Notification center with email preferences and per-topic/per-user mutes
- Optional push subscriptions, delivery audit records, and weekly digest job
- Report flows and moderator/admin review tools
- Public SEO metadata, Open Graph image routes, robots, sitemap, and Q&A structured data
- Health/readiness endpoints, structured logs, optional monitoring, optional analytics, and production env validation

## Architecture

```text
app/          Next.js routes, pages, layouts, metadata, and API handlers
components/   Reusable UI, feed, question, auth, admin, settings, and Spaces components
lib/          Auth, Prisma, validation, rate limits, storage, email, logging, monitoring, analytics, search, and query helpers
prisma/       PostgreSQL schema, migrations, and realistic demo seed data
scripts/      Environment validation, security checks, client bundle scan, and load smoke test
tests/        Unit, integration, and Playwright e2e tests
docs/         Deployment, operations, project, and load-testing notes
```

Most mutations live under `app/api` and use:

- `getActiveSession` for active, non-suspended users
- Zod schemas from `lib/validators.ts`
- route-specific rate limits
- Prisma transactions for multi-row writes
- generic user-facing errors instead of raw server exceptions

## Database Overview

The Prisma schema models a real Q&A domain:

- core content: `Question`, `Answer`, `Comment`, `Topic`
- social graph: `UserFollow`, `TopicFollow`, `QuestionFollow`
- interactions: `Vote`, `Bookmark`, `BookmarkCollection`
- personalization: `UserTopicAffinity`, `QuestionView`, feed feedback
- trust: `UserCredential`, `UserBadge`, `Report`, `ModerationAction`
- communities: `Space`, `SpaceMember`, `SpaceQuestion`, `SpaceInvite`
- notifications: `Notification`, `NotificationMute`, `NotificationDelivery`, `PushSubscription`, `AnswerRequest`
- auth/security: `Account`, `Session`, reset/verification/change tokens

Indexes are added for feed ordering, search, reports, notifications, follows, bookmarks, Spaces, and moderation query patterns. Migrations are applied with `npm run db:deploy` / `npx prisma migrate deploy`.

## Search And Feed

Search is implemented in `lib/search-service.ts` and supports:

- question, answer, topic, and people results
- autocomplete suggestions
- unanswered filter
- topic and author filters
- relevance, newest, and views sorting
- public-profile filtering for people results

Feeds are loaded through `lib/query-data.ts`. The For You feed combines freshness, score, answer count, view count, accepted-answer status, followed topics, followed authors, followed questions, and explicit feed feedback.

## Authentication And Authorization

Auth uses NextAuth credentials and optional Google OAuth. Active sessions are rechecked against the database so deleted or suspended users cannot keep using stale sessions. Password reset, password change, suspension, and account deletion increment `sessionVersion` to invalidate old tokens.

Authorization helpers enforce role hierarchy:

- `USER`
- `MODERATOR`
- `ADMIN`

Moderators can review reports and moderate lower-role content. Admin-only actions are kept separate where appropriate.

## Moderation And Abuse Prevention

The app includes:

- content/profile reporting
- duplicate report suppression per reporter
- repeated-report escalation to review
- moderator notes and action history
- role-aware moderation checks
- self-vote and self-report prevention
- rate limits on auth, posting, voting, reports, uploads, search, follows, and settings
- rich text rendered as React nodes instead of raw user HTML
- image upload validation through Sharp, MIME allow-listing, resizing, metadata stripping, and safe storage keys
- same-origin protection for unsafe API mutations
- lightweight link/repetition spam checks and recent exact duplicate checks

## Observability And Analytics

Production support is optional and provider-neutral:

- structured JSON server logs with sensitive-key redaction
- `/api/health` liveness endpoint
- `/api/ready` readiness endpoint protected by `READINESS_TOKEN`
- optional monitoring via webhook or Sentry-compatible event delivery
- optional server-side analytics via logs, webhook, or PostHog capture

Tracked product events include signup, onboarding, question creation, answer creation, accepted answers, votes, follows, bookmarks, searches, Space creation, and Space membership changes. Analytics is disabled by default and never records raw post/search content.

## Testing Strategy

The repo includes:

- validation tests for Zod schemas
- authorization tests
- markdown/XSS rendering tests
- storage/image processing tests
- rate-limit tests
- abuse and mutation-origin tests
- email/token tests
- database integration tests guarded by `RUN_DATABASE_TESTS=1`
- Playwright e2e tests for core workflows, admin controls, settings, responsive behavior, and browser console checks

Useful commands:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm audit --audit-level=moderate
npx prisma validate
npm run security:check
npm run security:client
```

## Running Locally

Requirements:

- Node.js 20 or newer
- npm
- Docker Desktop
- Git

```powershell
Copy-Item .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
npm ci
docker compose up -d postgres
npm run db:deploy
npm run db:seed
npm run dev
```

Open:

```text
http://localhost:3000
```

## Demo Data

The seed script creates realistic users, topics, questions, answers, comments, Spaces, votes, bookmarks, badges, notifications, and reports.

Demo password:

```text
DemoPass123!
```

Demo users:

- User: `maya@queryhub.dev`
- Moderator: `moderator@queryhub.dev`
- Admin: `admin@queryhub.dev`

The seed script deletes and recreates demo data. Production seeding is blocked unless `ALLOW_PRODUCTION_SEED=true`, and that should only be used on a disposable demo database.

## Deployment

Use `.env.example` for required variable names. For a real public deployment:

- Set `APP_ENV=production`
- Use HTTPS `APP_URL` and `NEXTAUTH_URL`
- Generate `NEXTAUTH_SECRET` and `READINESS_TOKEN`
- Set `TRUST_PROXY=true` behind a deployment proxy
- Use managed PostgreSQL with backups enabled
- Use `RATE_LIMIT_PROVIDER=upstash`
- Use `EMAIL_PROVIDER=resend`
- Use `STORAGE_PROVIDER=s3`
- Schedule `npm run notifications:push` and `npm run notifications:digest` if using external notification delivery
- Keep `ALLOW_PRODUCTION_SEED=false`
- Run `npm run db:deploy`
- Run `npm run build`
- Check `/api/health` and token-protected `/api/ready`

More detail:

- [Deployment notes](docs/DEPLOYMENT.md)
- [Operations guide](docs/OPERATIONS.md)
- [Load testing](docs/LOAD_TESTING.md)
- [Project notes](docs/PROJECT_NOTES.md)

## Engineering Highlights

- Personalized feed ranking with explicit feedback controls
- Role-based moderation with report history and protected admin routes
- Reputation and badge system connected to voting and accepted answers
- Rich text handling without rendering raw user HTML
- Image upload pipeline with Sharp validation, metadata stripping, and object storage abstraction
- Notification architecture with email preferences and notification mutes
- Push/digest notification jobs with delivery audit records
- Provider-neutral analytics and monitoring abstractions
- Search service with filters, autocomplete, public-profile filtering, and relevance sorting
- Spaces/community modeling with submission approval workflows
- Prisma relational modeling with transactions, constraints, and query-pattern indexes
- API validation, rate limiting, safe error responses, and same-origin mutation protection
- Production hardening docs covering migrations, backups, rollback, secrets, monitoring, and incident response

## Current Status

QueryHub is resume-ready and portfolio-demo-ready. It has production-style architecture and hardening, but a real public production launch still requires deployed infrastructure, real secrets, provider configuration, verified backups/restores, and production-like load testing.

## License

MIT. See [LICENSE](LICENSE).
