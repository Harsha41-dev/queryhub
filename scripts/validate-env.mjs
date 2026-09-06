try {
  await import("dotenv/config");
} catch {
  // docker/prod may already inject env vars without dotenv
}

const required = [
  "APP_URL",
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXTAUTH_URL",
  "NEXTAUTH_SECRET",
  "EMAIL_FROM",
  "READINESS_TOKEN",
];

const missing = required.filter((name) => !process.env[name]?.trim());
const errors = missing.map((name) => `${name} is required`);
const appEnvironment = process.env.APP_ENV ?? "development";

if ((process.env.NEXTAUTH_SECRET?.length ?? 0) < 32)
  errors.push("NEXTAUTH_SECRET must contain at least 32 characters");
if ((process.env.READINESS_TOKEN?.length ?? 0) < 16)
  errors.push("READINESS_TOKEN must contain at least 16 characters");

for (const name of Object.keys(process.env)) {
  if (
    name.startsWith("NEXT_PUBLIC_") &&
    /SECRET|TOKEN|PASSWORD|DATABASE|PRIVATE|CREDENTIAL/i.test(name)
  )
    errors.push(`${name} must not expose a server-only value`);
}

if (appEnvironment === "production") {
  const productionRequirements = [
    [process.env.APP_URL?.startsWith("https://"), "APP_URL must use HTTPS"],
    [
      process.env.NEXTAUTH_URL?.startsWith("https://"),
      "NEXTAUTH_URL must use HTTPS",
    ],
    [
      process.env.RATE_LIMIT_PROVIDER === "upstash",
      "RATE_LIMIT_PROVIDER must be upstash",
    ],
    [process.env.TRUST_PROXY === "true", "TRUST_PROXY must be true"],
    [process.env.EMAIL_PROVIDER === "resend", "EMAIL_PROVIDER must be resend"],
    [process.env.STORAGE_PROVIDER === "s3", "STORAGE_PROVIDER must be s3"],
  ];
  for (const [valid, message] of productionRequirements) {
    if (!valid) errors.push(String(message));
  }
  for (const name of [
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "RESEND_API_KEY",
    "S3_REGION",
    "S3_BUCKET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
    "S3_PUBLIC_BASE_URL",
  ]) {
    if (!process.env[name]?.trim())
      errors.push(`${name} is required in production`);
  }
  if (
    (process.env.NEXTAUTH_SECRET?.length ?? 0) < 43 ||
    process.env.NEXTAUTH_SECRET?.toLowerCase().includes("replace")
  )
    errors.push("NEXTAUTH_SECRET must be generated for production");
  if (
    (process.env.READINESS_TOKEN?.length ?? 0) < 32 ||
    process.env.READINESS_TOKEN?.toLowerCase().includes("local")
  )
    errors.push("READINESS_TOKEN must be generated for production");
}

if (
  process.env.MONITORING_PROVIDER === "webhook" &&
  !process.env.MONITORING_WEBHOOK_URL?.trim()
)
  errors.push(
    "MONITORING_WEBHOOK_URL is required when MONITORING_PROVIDER=webhook",
  );
if (process.env.MONITORING_PROVIDER === "sentry" && !process.env.SENTRY_DSN)
  errors.push("SENTRY_DSN is required when MONITORING_PROVIDER=sentry");
if (
  process.env.ANALYTICS_PROVIDER === "webhook" &&
  !process.env.ANALYTICS_WEBHOOK_URL?.trim()
)
  errors.push(
    "ANALYTICS_WEBHOOK_URL is required when ANALYTICS_PROVIDER=webhook",
  );
if (
  process.env.ANALYTICS_PROVIDER === "posthog" &&
  !process.env.POSTHOG_PROJECT_API_KEY?.trim()
)
  errors.push(
    "POSTHOG_PROJECT_API_KEY is required when ANALYTICS_PROVIDER=posthog",
  );
if (
  process.env.PUSH_PROVIDER === "webhook" &&
  !process.env.PUSH_WEBHOOK_URL?.trim()
)
  errors.push("PUSH_WEBHOOK_URL is required when PUSH_PROVIDER=webhook");

if (errors.length) {
  console.error(
    `Environment validation failed:\n- ${[...new Set(errors)].join("\n- ")}`,
  );
  process.exit(1);
}

console.log(`Environment validation passed for APP_ENV=${appEnvironment}.`);
