# Load Testing

QueryHub includes a dependency-free load smoke script for production-like staging environments.

It is not part of normal development, build, or production start. Run it only when the app and database are already deployed or running locally.

## Run

```powershell
$env:LOAD_TEST_BASE_URL="http://localhost:3000"
npm run test:load
```

Useful options:

- `LOAD_TEST_BASE_URL`: target app URL
- `LOAD_TEST_DURATION_MS`: default `30000`
- `LOAD_TEST_CONCURRENCY`: default `8`
- `LOAD_TEST_MAX_ERROR_RATE`: default `0.05`
- `LOAD_TEST_READINESS_TOKEN`: includes `/api/ready`
- `LOAD_TEST_SESSION_COOKIE`: includes authenticated notification-count reads
- `LOAD_TEST_ADMIN_COOKIE`: includes admin report table reads

Example:

```powershell
$env:LOAD_TEST_BASE_URL="https://queryhub.example.com"
$env:LOAD_TEST_DURATION_MS="60000"
$env:LOAD_TEST_CONCURRENCY="20"
npm run test:load
```

## Covered Paths

The default smoke covers:

- `/`
- `/search`
- `/api/search?q=software`
- `/api/search/suggest?q=software`
- `/spaces`
- `/api/health`

Optional checks cover:

- `/api/ready` when `LOAD_TEST_READINESS_TOKEN` is set
- `/api/notifications?count=1` when `LOAD_TEST_SESSION_COOKIE` is set
- `/api/admin/rows?kind=reports&pageSize=20&sort=desc` when `LOAD_TEST_ADMIN_COOKIE` is set

Mutation load tests are intentionally not enabled by default because they create real data and can distort reputation, rate limits, notifications, and moderation queues. Run write-heavy tests only against a disposable database.

## Metrics To Inspect

Look at:

- requests per second
- error rate
- p95 and p99 latency
- status-code distribution
- per-target p95 latency

For a portfolio deployment, the goal is not massive scale. A good target is stable p95 latency, no 5xx spikes, and no database connection exhaustion at modest concurrency.
