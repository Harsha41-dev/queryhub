# Production Operations Guide

This guide keeps QueryHub production-ready without turning a portfolio project into enterprise infrastructure.

## Deployment Workflow

1. Build from a clean commit.
2. Set production environment variables in the hosting provider.
3. Run `npx prisma migrate deploy` against the production database.
4. Run `npm run build`.
5. Start with `npm run start` or the platform equivalent.
6. Check `/api/health`.
7. Check `/api/ready` with `Authorization: Bearer READINESS_TOKEN`.

Never run `prisma migrate dev` against production.

## Database Setup

Use managed PostgreSQL with:

- automated backups enabled
- point-in-time recovery when the provider supports it
- separate databases for local, staging, and production
- connection pooling when the platform needs it

Set both:

- `DATABASE_URL`: pooled application URL when available
- `DIRECT_URL`: direct database URL for migrations

Use `DATABASE_ADAPTER=neon` only with Neon's serverless pooled URL; otherwise use `native`.

## Backups

Before launch:

- Confirm daily automated backups are enabled.
- Take a manual backup before large migrations.
- Store backup access separately from app deployment credentials.
- Test one restore into a staging database before trusting the process.

For a manual PostgreSQL backup:

```powershell
pg_dump "$env:DIRECT_URL" --format=custom --file=queryhub-backup.dump
```

Restore into a fresh database:

```powershell
pg_restore --clean --if-exists --dbname "$env:DIRECT_URL" queryhub-backup.dump
```

Do not restore directly over production until you have confirmed the target database and maintenance window.

## Migrations

Use:

```powershell
npx prisma migrate deploy
```

Recommended workflow:

- Review generated SQL before merging.
- Avoid destructive statements unless there is a written rollback plan.
- Run migrations on staging first.
- Keep application code compatible with the current and next schema during deployment.
- Take a backup before migrations that touch large tables or constraints.

The seed script is destructive by design for demo databases. Production seeding is blocked unless `ALLOW_PRODUCTION_SEED=true`, and that should only be used on disposable demo environments.

## Rollback

Application rollback:

- Re-deploy the previous known-good build.
- Keep old builds available in the hosting provider.
- Confirm env vars did not change incompatibly.

Database rollback:

- Prefer forward-fix migrations when possible.
- Restore from backup only when data corruption or irreversible migration failure requires it.
- Restore into staging first and verify app behavior before replacing production.

## Secrets

Rotate immediately if a secret is exposed:

- `NEXTAUTH_SECRET`
- database URLs
- OAuth client secrets
- Upstash token
- Resend API key
- S3 access keys
- monitoring and analytics tokens
- push webhook token
- `READINESS_TOKEN`

After rotating `NEXTAUTH_SECRET`, all sessions become invalid. That is expected.

Never commit `.env`, provider dashboards exports, private keys, or service-account files.

## Monitoring

Production should monitor:

- `/api/health`
- `/api/ready` with the bearer token
- server logs by `x-request-id`
- database connection count
- 5xx rate
- p95 latency for feed, question page, search, and key API mutations
- email delivery failures
- push and digest delivery failures
- upload/storage failures

Optional integrations:

- `MONITORING_PROVIDER=webhook`
- `MONITORING_PROVIDER=sentry`
- `ANALYTICS_PROVIDER=webhook`
- `ANALYTICS_PROVIDER=posthog`

All integrations are optional; missing providers must not break the app.

## Notification Delivery

In-app notifications are created during normal mutations. External delivery is intentionally separated into jobs:

```powershell
npm run notifications:push
npm run notifications:digest
```

Use your hosting provider's cron/scheduler for these jobs. `notifications:push` should run every few minutes when `PUSH_PROVIDER=webhook`; `notifications:digest` should run on the weekly digest schedule. Review `NotificationDelivery` rows or logs for failed sends.

## Incident Basics

1. Confirm scope: affected routes, users, and first observed time.
2. Check health/readiness, platform logs, database metrics, and recent deployments.
3. If the issue is active and user-facing, rollback the app first.
4. If data is affected, pause risky writes if the host supports it.
5. Preserve logs and request IDs.
6. Write a short post-incident note: cause, impact, fix, and prevention.

## Production Checklist

- `APP_ENV=production`
- HTTPS `APP_URL` and `NEXTAUTH_URL`
- generated `NEXTAUTH_SECRET`
- generated `READINESS_TOKEN`
- `TRUST_PROXY=true`
- `RATE_LIMIT_PROVIDER=upstash`
- `EMAIL_PROVIDER=resend`
- `STORAGE_PROVIDER=s3`
- optional `PUSH_PROVIDER=webhook` and scheduled notification jobs
- `ALLOW_PRODUCTION_SEED=false`
- production database backups enabled
- `npx prisma migrate deploy` completed
- `npm run build` completed
- `/api/health` returns `200`
- `/api/ready` returns `200` with the bearer token
- admin demo credentials removed or changed
