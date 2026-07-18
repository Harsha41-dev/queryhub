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
- Adding tests for important helpers and workflows
- Making the repo easy to run locally with Docker

## Things I Would Improve Next

- Replace simple browser confirm boxes with better confirmation dialogs
- Add more database integration tests
- Add better pagination for large feeds and admin tables
- Improve search ranking and filtering
- Add image support inside question and answer content
- Make the moderation panel more detailed
- Add better production logging and monitoring

These are not blockers for a portfolio project, but they are the next practical improvements I would make.
