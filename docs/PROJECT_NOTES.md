# Project Notes

This file is for anyone reviewing the project and wanting a quick idea of how it is built.

## Why I Built It

I wanted to build something bigger than a simple CRUD app. A Q&A platform gave me a chance to work on authentication, user-generated content, voting, comments, notifications, reports, and admin actions in one project.

The goal was not to copy any one product exactly. I used the Q&A idea because it has enough real-world problems to practice backend and frontend work properly.

## Main Areas

Frontend:

- Next.js App Router pages
- Reusable React components
- Tailwind CSS styling
- Responsive layouts for desktop and mobile
- Forms for auth, questions, answers, comments, and settings

Backend:

- API routes under `app/api`
- Prisma models and migrations
- Auth.js / NextAuth session handling
- Zod validation before writing data
- Rate limiting on important actions
- Soft delete fields for user-generated content
- Role checks for admin and moderator actions

Testing:

- Unit tests with Vitest
- Integration tests for database behavior
- Playwright e2e tests for important user flows
- CI workflow that runs checks before merge

## Database Models

The main models are:

- `User`
- `Question`
- `Answer`
- `Comment`
- `Topic`
- `Vote`
- `Bookmark`
- `Notification`
- `Report`
- `ModerationAction`

I used separate join tables for follows and topic/question relations so that the app can support many-to-many behavior cleanly.

## Things I Focused On

- Keeping API input validation in one place with Zod
- Using transactions when counters and related rows need to update together
- Keeping deleted or hidden content out of normal user views
- Adding rate limits to actions like login, posting, voting, search, and uploads
- Adding answer requests, credentials, Spaces, accepted answers, and bookmark collections without breaking the existing Q&A model
- Keeping observability and analytics provider-neutral and optional
- Adding tests for important helpers and workflows
- Making the repo easy to run locally with Docker

## Things I Would Improve Next

- Add more database integration coverage for the newer Spaces, answer-request, and analytics-adjacent workflows.
- Run load tests against staging with realistic data and tune database connection limits.
- Add production dashboards for latency, 5xx rate, email delivery failures, and storage errors.
- Add stronger spam/abuse automation after observing real traffic patterns.
- Add real screenshots and a short demo video after deployment.

These are not blockers for a portfolio project, but they are the next practical improvements I would make.
