# QueryHub

QueryHub is a full-stack Q&A web app that I built as a portfolio project. The app is based on a simple idea: users can ask questions, write answers, vote on useful content, follow topics or people, and manage their profile.

I made this project to practice building a complete application, not only frontend pages. It includes authentication, database relations, API routes, validation, basic moderation, tests, Docker setup, and CI checks.

## Tech Stack

- Next.js App Router
- React and TypeScript
- Tailwind CSS
- PostgreSQL
- Prisma ORM
- Auth.js / NextAuth
- Zod for validation
- Vitest and Playwright for testing
- Docker and GitHub Actions

## Main Features

- Email and password login
- Optional Google OAuth login
- Ask questions and add answers
- Nested comments on answers
- Upvote and downvote questions, answers, and comments
- Bookmark questions and answers
- Follow users, topics, and questions
- Notifications for answers, follows, mentions, and moderation updates
- User profile and account settings
- Search for questions, topics, and people
- Report content or profiles
- Admin/moderator panel for basic moderation
- API validation and rate limiting

## Project Structure

```text
app/          Next.js pages, layouts, and API routes
components/   Reusable React components
lib/          Shared server/client helpers
prisma/       Prisma schema, migrations, and seed data
tests/        Unit, integration, and e2e tests
scripts/      Environment and security check scripts
docs/         Extra notes about the project
```

Most of the backend request handling is inside `app/api`. Shared logic like auth, rate limiting, validation, email, storage, and database helpers is kept inside `lib`.

## Running Locally

Requirements:

- Node.js 20 or newer
- npm
- Docker Desktop
- Git

Copy the example environment file:

```powershell
Copy-Item .env.example .env
```

Generate a local `NEXTAUTH_SECRET` and put it in `.env`:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Install dependencies and start the database:

```powershell
npm ci
docker compose up -d postgres
```

Run migrations, seed demo data, and start the app:

```powershell
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open:

```text
http://localhost:3000
```

## Demo Accounts

The seed script creates these accounts for local testing.

Password for all demo users:

```text
DemoPass123!
```

- User: `maya@queryhub.dev`
- Moderator: `moderator@queryhub.dev`
- Admin: `admin@queryhub.dev`

Do not use the seed data on a real production database.

## Useful Commands

```powershell
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run db:seed
```

Database integration tests are skipped by default. To run them locally, keep Postgres running and use:

```powershell
$env:RUN_DATABASE_TESTS="1"
npm test
```

## Environment Notes

Local development uses:

- Docker PostgreSQL
- In-memory rate limiting
- Logged email messages instead of a real email provider
- Local avatar uploads in `.local-uploads`

For a real deployment, the app is prepared to use external services like Neon/PostgreSQL, Upstash Redis, Resend, and S3-compatible storage. The required variable names are listed in `.env.example`.

Never commit `.env` or real secrets.

## More Notes

- [Project notes](docs/PROJECT_NOTES.md)
- [Deployment notes](docs/DEPLOYMENT.md)

## Current Status

This is a learning and portfolio project. I tried to keep the code clean and practical, but there are still things I would improve before treating it like a real production product, such as stronger observability, more integration tests, and a more polished admin workflow.

## License

MIT. See [LICENSE](LICENSE).
