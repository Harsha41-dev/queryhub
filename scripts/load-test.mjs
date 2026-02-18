const config = {
  baseUrl: (process.env.LOAD_TEST_BASE_URL ?? "http://localhost:3000")
    .trim()
    .replace(/\/$/, ""),
  durationMs: Number(process.env.LOAD_TEST_DURATION_MS ?? 30_000),
  concurrency: Number(process.env.LOAD_TEST_CONCURRENCY ?? 8),
  maxErrorRate: Number(process.env.LOAD_TEST_MAX_ERROR_RATE ?? 0.05),
  sessionCookie: process.env.LOAD_TEST_SESSION_COOKIE?.trim(),
  adminCookie: process.env.LOAD_TEST_ADMIN_COOKIE?.trim(),
  readinessToken: process.env.LOAD_TEST_READINESS_TOKEN?.trim(),
};

const targets = buildTargets(config);
const results = [];
const endsAt = Date.now() + config.durationMs;

await runLoadSmoke();

function buildTargets({ readinessToken, sessionCookie, adminCookie }) {
  const list = [
    { name: "landing", method: "GET", path: "/" },
    { name: "search_page", method: "GET", path: "/search" },
    { name: "search_api", method: "GET", path: "/api/search?q=software" },
    {
      name: "search_suggest",
      method: "GET",
      path: "/api/search/suggest?q=software",
    },
    { name: "spaces_page", method: "GET", path: "/spaces" },
    { name: "health", method: "GET", path: "/api/health" },
  ];

  if (readinessToken)
    list.push({
      name: "readiness",
      method: "GET",
      path: "/api/ready",
      headers: { authorization: `Bearer ${readinessToken}` },
    });

  if (sessionCookie)
    list.push({
      name: "notifications_count",
      method: "GET",
      path: "/api/notifications?count=1",
      headers: { cookie: sessionCookie },
    });

  if (adminCookie)
    list.push({
      name: "admin_rows",
      method: "GET",
      path: "/api/admin/rows?kind=reports&pageSize=20&sort=desc",
      headers: { cookie: adminCookie },
    });

  return list;
}

async function runLoadSmoke() {
  console.info(
    `Running load smoke against ${config.baseUrl} for ${config.durationMs}ms at concurrency ${config.concurrency}`,
  );

  await Promise.all(
    Array.from({ length: config.concurrency }, (_, index) => worker(index)),
  );

  const summary = summarizeResults(results, targets, config.durationMs);
  console.info(JSON.stringify(summary, null, 2));

  if (summary.errorRate > config.maxErrorRate) {
    console.error(
      `Load smoke failed: error rate ${summary.errorRate.toFixed(4)} exceeded ${config.maxErrorRate}`,
    );
    process.exit(1);
  }
}

async function worker(startIndex) {
  let targetIndex = startIndex;

  while (Date.now() < endsAt) {
    await hit(targets[targetIndex % targets.length]);
    targetIndex += config.concurrency;
  }
}

async function hit(target) {
  const startedAt = performance.now();

  try {
    const response = await fetch(`${config.baseUrl}${target.path}`, {
      method: target.method,
      headers: target.headers,
      redirect: "manual",
      cache: "no-store",
    });

    results.push({
      name: target.name,
      status: response.status,
      duration: performance.now() - startedAt,
      ok: response.status < 500,
    });
  } catch (error) {
    results.push({
      name: target.name,
      status: 0,
      duration: performance.now() - startedAt,
      ok: false,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

function summarizeResults(results, targets, durationMs) {
  const durations = results.map((result) => result.duration);
  const failures = results.filter((result) => !result.ok);
  const seconds = durationMs / 1000;
  const errorRate = results.length ? failures.length / results.length : 1;

  return {
    requests: results.length,
    requestsPerSecond: Number((results.length / seconds).toFixed(2)),
    errorRate: Number(errorRate.toFixed(4)),
    p50Ms: Math.round(percentile(durations, 0.5)),
    p95Ms: Math.round(percentile(durations, 0.95)),
    p99Ms: Math.round(percentile(durations, 0.99)),
    statusCounts: countByStatus(results),
    byTarget: targets.map((target) => summarizeTarget(results, target)),
  };
}

function summarizeTarget(results, target) {
  const targetResults = results.filter((result) => result.name === target.name);
  const durations = targetResults.map((result) => result.duration);

  return {
    name: target.name,
    count: targetResults.length,
    p95Ms: Math.round(percentile(durations, 0.95)),
    errors: targetResults.filter((result) => !result.ok).length,
  };
}

function countByStatus(results) {
  return results.reduce((counts, result) => {
    const status = String(result.status);
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}
