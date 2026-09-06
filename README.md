# QueryHub

[![CI](https://github.com/Harsha41-dev/queryhub/actions/workflows/ci.yml/badge.svg)](https://github.com/Harsha41-dev/queryhub/actions/workflows/ci.yml)

QueryHub is a full-stack Q&A platform inspired by Quora. It supports questions, answers, comments, topic follows, personalized feeds, answer requests, Spaces, reputation, badges, notifications, moderation, search, bookmarks, onboarding, and production deployment checks.

The project is built to demonstrate practical full-stack engineering: relational database design, authenticated API routes, server-rendered pages, client-side interactions, secure validation, moderation workflows, background notification jobs, testing, and deployment readiness.

## Tech Stack

| Area           | Technology                            |
| -------------- | ------------------------------------- |
| Frontend       | Next.js App Router, React, TypeScript |
| Styling        | Tailwind CSS                          |
| Backend        | Next.js Route Handlers                |
| Database       | PostgreSQL                            |
| ORM            | Prisma                                |
| Authentication | Auth.js / NextAuth                    |
| Validation     | Zod                                   |
| Testing        | Vitest, Playwright                    |
| Tooling        | Docker, GitHub Actions                |

## Core Features

### Q&A Workflow

- Ask questions with descriptions, topic tags, and optional images.
- Write rich markdown answers with toolbar actions, preview mode, links, code blocks, quotes, lists, and image upload.
- Upvote, downvote, follow, bookmark, comment, and report content.
- Question authors can mark an accepted/best answer.
- Duplicate question suggestions and moderator question merge flow.

### Quora-Style Discovery

- Personalized "For You" feed based on followed topics, followed users, followed questions, topic affinity, votes, freshness, answer count, views, and accepted answers.
- Feed feedback controls: hide, mute user, and not interested in topic.
- Answer requests from specific users.
- Suggested answerers based on topics, prior answers, reputation, and credentials.
- Search across questions, answers, topics, and people with autocomplete, filters, and ranking.

### Profiles And Trust

- User profiles with bio, occupation, location, website, reputation, stats, and contribution history.
- Credentials such as "Software Engineer at X" or topic-specific expertise.
- Credentials can appear beside answers to improve answer trust.
- Badges for useful contributions, topic expertise, moderation, and top writers.

### Spaces

- Topic-based communities similar to Quora Spaces.
- Create and join Spaces.
- Space owners and moderators can approve or reject submissions.
- Space settings include rules, submission permissions, and approval requirements.
- Member roles and invitations are supported.

### Notifications

- In-app notification center.
- Notification types for answer requests, answers, comments, replies, mentions, follows, votes, accepted answers, Spaces, and moderation.
- Email notification templates and user preferences.
- Per-user and per-topic notification mutes.
- Optional push subscription storage, push delivery job, weekly digest job, and delivery audit records.

### Moderation And Admin

- Report questions, answers, comments, and profiles.
- Admin/moderator dashboard for reports, users, topics, and content.
- Moderator notes and action history.
- Hide, restore, suspend, and merge moderation actions.
- Lightweight spam and abuse signals for links, repeated text, promotional wording, and off-platform contact requests.

### Production Readiness

- Environment validation before production start.
- Health and readiness endpoints.
- Rate limiting with local memory mode and Upstash-compatible production mode.
- Local and S3-compatible upload storage.
- Structured logging with sensitive field redaction.
- Optional monitoring and analytics providers.
- SEO metadata, sitemap, robots config, Open Graph image routes, and Q&A structured data.
- Load smoke test script for staging or production-like deployments.

## Architecture

```text
app/          Pages, layouts, metadata, and API route handlers
components/   Reusable UI and feature components
lib/          Auth, validation, Prisma, search, feed, email, storage, security, and shared services
prisma/       Database schema, migrations, and seed data
scripts/      Environment checks, security scans, notification jobs, and load testing
tests/        Unit, integration, and Playwright e2e tests
docs/         Deployment, operations, load testing, and project notes
```

The app uses a standard Next.js App Router structure:

- Server pages fetch data through helpers in `lib/query-data.ts`.
- Client components handle interactive UI and call API routes.
- API routes validate requests with Zod, check sessions and permissions, then update PostgreSQL through Prisma.
- Multi-table writes use Prisma transactions for consistency.
- Background-style work such as push delivery and weekly digests is handled through scripts.

## Database Design

The Prisma schema models the main parts of a real Q&A product:

- Content: `Question`, `Answer`, `Comment`, `Topic`
- Social graph: `UserFollow`, `TopicFollow`, `QuestionFollow`
- Interactions: `Vote`, `Bookmark`, `BookmarkCollection`
- Personalization: `UserTopicAffinity`, `QuestionView`, feed feedback
- Trust: `UserCredential`, `UserBadge`, `Report`, `ModerationAction`
- Communities: `Space`, `SpaceMember`, `SpaceQuestion`, `SpaceInvite`
- Notifications: `Notification`, `NotificationMute`, `NotificationDelivery`, `PushSubscription`, `AnswerRequest`
- Auth and security: `Account`, `Session`, password reset, email verification, and email-change tokens

Indexes are included for feed loading, search, notifications, moderation queues, follows, bookmarks, and Space queries.

## Security And Reliability

- Passwords are hashed with bcrypt.
- Active sessions are rechecked against the database.
- Suspended or deleted users cannot keep using stale sessions.
- Protected routes use shared role checks for user, moderator, and admin access.
- User input is validated with Zod before database writes.
- Unsafe mutations are protected with same-origin checks.
- Rich text is rendered safely instead of trusting raw user HTML.
- Image uploads are validated, resized, and stripped of metadata.
- Rate limits are applied to auth, posting, voting, reporting, uploads, search, follows, and settings.
- Production startup checks prevent missing or unsafe environment configuration.

## Testing

The project includes coverage for validation, authorization, markdown safety, abuse checks, rate limits, storage, email tokens, utility helpers, and browser workflows.

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

Database integration tests are guarded by `RUN_DATABASE_TESTS=1`. Playwright e2e tests require the app and PostgreSQL database to be running.

## Running Locally

Requirements:

- Node.js 20 or newer
- npm
- Docker Desktop
- Git

Setup:

```powershell
Copy-Item .env.example .env
npm ci
docker compose up -d postgres
npm run db:deploy
npm run db:seed
npm run dev
```

Open the app:

```text
http://localhost:3000
```

## Demo Accounts

The seed script creates realistic demo data for local testing.

Password for all demo accounts:

```text
DemoPass123!
```

Accounts:

| Role      | Email                    |
| --------- | ------------------------ |
| User      | `maya@queryhub.dev`      |
| Moderator | `moderator@queryhub.dev` |
| Admin     | `admin@queryhub.dev`     |

The seed script is destructive and should only be used with local or disposable demo databases. Production seeding is blocked unless `ALLOW_PRODUCTION_SEED=true`.

## Deployment

For a public deployment, configure real production services and secrets:

- Managed PostgreSQL database with backups enabled.
- Secure `NEXTAUTH_SECRET` and `READINESS_TOKEN`.
- HTTPS `APP_URL` and `NEXTAUTH_URL`.
- `TRUST_PROXY=true` when hosted behind a platform proxy.
- Upstash-compatible Redis for production rate limiting.
- Resend or another configured provider for transactional email.
- S3-compatible storage for image uploads.
- Optional monitoring, analytics, push notifications, and scheduled notification jobs.

Deployment commands:

```powershell
npm run db:deploy
npm run build
npm run start
```

After deployment:

- Check `/api/health`.
- Check `/api/ready` with `Authorization: Bearer READINESS_TOKEN`.
- Run the load smoke test against staging or the deployed URL.

```powershell
$env:LOAD_TEST_BASE_URL="https://your-queryhub-domain.com"
npm run test:load
```

## Documentation

- [Deployment notes](docs/DEPLOYMENT.md)
- [Operations guide](docs/OPERATIONS.md)
- [Load testing](docs/LOAD_TESTING.md)
- [Project notes](docs/PROJECT_NOTES.md)

## Engineering Highlights

- End-to-end Q&A domain modeling with Prisma and PostgreSQL.
- Authenticated API routes with validation, permissions, rate limits, and safe error responses.
- Personalized feed ranking using explicit product signals.
- Search service with autocomplete, filters, relevance scoring, and typo-tolerant matching.
- Rich editor and safe image upload pipeline.
- Role-based moderation dashboard with report history and question merge support.
- Spaces/community feature with roles, invites, approvals, and settings.
- Notification system with preferences, mutes, email templates, push subscriptions, digest jobs, and delivery logs.
- Production hardening through environment validation, health checks, readiness checks, structured logs, security scans, CI, and load testing.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
