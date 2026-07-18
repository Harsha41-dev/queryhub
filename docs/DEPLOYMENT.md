# Deployment Notes

The project can run locally with Docker PostgreSQL. It also has a Dockerfile and CI setup so it can be prepared for deployment later.

## Local Setup

For local development:

```powershell
Copy-Item .env.example .env
npm ci
docker compose up -d postgres
npx prisma migrate deploy
npm run db:seed
npm run dev
```

The app runs at:

```text
http://localhost:3000
```

## Environment Variables

Use `.env.example` as the source for required variable names.

Important variables:

- `APP_ENV`
- `APP_URL`
- `DATABASE_URL`
- `DIRECT_URL`
- `DATABASE_ADAPTER`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `EMAIL_PROVIDER`
- `RATE_LIMIT_PROVIDER`
- `STORAGE_PROVIDER`
- `READINESS_TOKEN`

For local development, most values can stay close to `.env.example`. For production, secrets and provider values should be changed.

## Production Providers

The app has support for these kinds of production services:

- PostgreSQL database
- Redis-compatible rate limiting through Upstash REST
- Resend for email
- S3-compatible storage for uploads
- Optional monitoring webhook

Local-only values like in-memory rate limiting and logged emails are useful for development, but they should not be used for a real public deployment.

## Build And Start

Build the app:

```powershell
npm run build
```

Start the production server:

```powershell
npm run start
```

The start command runs environment validation before starting Next.js.

## Docker

The Dockerfile builds a standalone Next.js app image.

Build the image:

```powershell
docker build -t queryhub .
```

Run it after providing the required environment variables:

```powershell
docker run --env-file .env -p 3000:3000 queryhub
```

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

Before using this as a public app, I would check:

- Real secrets are set in the hosting provider
- `.env` is not committed
- Production database is separate from demo/local database
- Email provider is configured
- Rate limiting uses Redis/Upstash
- Upload storage uses S3 or a similar provider
- Admin demo users are removed or changed
- Playwright tests pass against the production-like build
