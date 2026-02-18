# Deployment Notes

QueryHub can run locally with Docker PostgreSQL and is structured for deployment with managed PostgreSQL, distributed rate limiting, transactional email, object storage, optional monitoring, and optional analytics.

For production operations, also read [Operations](OPERATIONS.md) and [Load Testing](LOAD_TESTING.md).

## Local Setup

```powershell
Copy-Item .env.example .env
npm ci
docker compose up -d postgres
npm run db:deploy
npm run db:seed
npm run dev
```

The app runs at:

```text
http://localhost:3000
```

## Environment Variables

Use `.env.example` as the source for required variable names.

Important production variables:

- `APP_ENV`
- `APP_URL`
- `DATABASE_URL`
- `DIRECT_URL`
- `DATABASE_ADAPTER`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `TRUST_PROXY`
- `EMAIL_PROVIDER`
- `RATE_LIMIT_PROVIDER`
- `STORAGE_PROVIDER`
- `READINESS_TOKEN`
- `MONITORING_PROVIDER`
- `SENTRY_DSN`
- `ANALYTICS_PROVIDER`
- `ANALYTICS_WEBHOOK_URL`
- `POSTHOG_PROJECT_API_KEY`
- `NEXT_PUBLIC_PUSH_VAPID_PUBLIC_KEY`
- `PUSH_PROVIDER`
- `PUSH_WEBHOOK_URL`
- `ALLOW_PRODUCTION_SEED`

For local development, most values can stay close to `.env.example`. For production, use real secrets, HTTPS URLs, external providers, and keep `ALLOW_PRODUCTION_SEED=false`.

## Production Providers

The app supports:

- PostgreSQL database
- Redis-compatible rate limiting through Upstash REST
- Resend for email
- S3-compatible storage for uploads
- Optional monitoring webhook or Sentry-compatible error capture
- Optional server-side analytics through logs, webhook delivery, or PostHog capture
- Optional push notification delivery through a webhook worker

Local-only values like in-memory rate limiting and logged emails are useful for development, but they should not be used for a real public deployment.

Analytics and monitoring providers are optional. If they are disabled, the app still builds and runs normally.

Push delivery is optional. Browser subscription only appears when `NEXT_PUBLIC_PUSH_VAPID_PUBLIC_KEY` is set. If `PUSH_PROVIDER=webhook`, also set `PUSH_WEBHOOK_URL` and schedule `npm run notifications:push`.

## Notification Jobs

The web app writes in-app notifications immediately. External delivery is handled by scheduled jobs so page requests stay fast:

```powershell
npm run notifications:push
npm run notifications:digest
```

Run `notifications:push` every few minutes when push delivery is enabled. Run `notifications:digest` on your weekly digest schedule. Both jobs are safe to skip for a demo deployment that only needs in-app notifications.

## Build And Start

Validate the Prisma schema:

```powershell
npx prisma validate
```

Apply migrations against the target database:

```powershell
npm run db:deploy
```

Build the app:

```powershell
npm run build
```

Start the production server:

```powershell
npm run start
```

The start command runs environment validation before starting Next.js.

## Database Backups And Rollbacks

Before a real launch:

- Enable automated PostgreSQL backups in the database provider.
- Take a manual backup before applying new migrations.
- Test a restore into a staging database.
- Prefer forward-fix migrations for small mistakes.
- Restore from backup only when data integrity requires it.

Use `npx prisma migrate deploy` or `npm run db:deploy` for production. Never use `prisma migrate dev` against production.

The seed script deletes and recreates demo data. It is blocked in production unless `ALLOW_PRODUCTION_SEED=true`, which should only be used for a disposable demo database.

## Docker

The Dockerfile builds a standalone Next.js app image.

```powershell
docker build -t queryhub .
docker run --env-file .env -p 3000:3000 queryhub
```

## Health Checks

- `/api/health` is a public liveness check.
- `/api/ready` checks database, rate limiting, email, and storage. It requires `Authorization: Bearer READINESS_TOKEN`.

## Load Smoke

After deploying to staging or a production-like environment:

```powershell
$env:LOAD_TEST_BASE_URL="https://queryhub.example.com"
npm run test:load
```

Inspect request rate, error rate, p95/p99 latency, and status-code distribution. Authenticated reads can be included with `LOAD_TEST_SESSION_COOKIE`; admin table reads can be included with `LOAD_TEST_ADMIN_COOKIE`. Write-heavy tests should only run against disposable data.

## CI

The GitHub Actions workflow runs:

- Environment validation
- Prisma validation
- Security checks
- Database migrations and seed
- Format check
- Lint
- Type check
- Unit tests
- Audit
- Production build
- Playwright e2e tests

Database integration tests run in CI with `RUN_DATABASE_TESTS=1`.

## Before Real Deployment

Before using this as a public app, check:

- Real secrets are set in the hosting provider.
- `.env` is not committed.
- Production database is separate from demo/local databases.
- `ALLOW_PRODUCTION_SEED=false` in production.
- `APP_URL` and `NEXTAUTH_URL` use HTTPS.
- `TRUST_PROXY=true` when hosted behind a platform proxy.
- Email provider is configured.
- Rate limiting uses Redis/Upstash.
- Upload storage uses S3 or a similar provider.
- Admin demo users are removed or changed.
- New Prisma migrations have been deployed before starting the app.
- Automated backups and restore procedure are verified.
- Optional monitoring or Sentry is configured.
- Optional analytics provider is configured if product metrics are needed.
- Optional push provider and notification jobs are configured if external delivery is needed.
- Playwright tests pass against the production-like build.
