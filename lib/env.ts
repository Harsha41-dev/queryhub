import "server-only";

import { z } from "zod";

// validate required env vars once when the server starts

const optionalString = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() ? value.trim() : undefined,
  z.string().optional(),
);

const optionalUrl = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() ? value.trim() : undefined,
  z.string().url().optional(),
);

const booleanString = (fallback: boolean) =>
  z
    .enum(["true", "false"])
    .default(String(fallback) as "true" | "false")
    .transform((value) => value === "true");

const postgresUrl = z
  .string()
  .url()
  .refine(
    (value) =>
      value.startsWith("postgresql://") || value.startsWith("postgres://"),
    "Use a PostgreSQL connection URL",
  );

const envSchema = z
  .object({
    APP_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    APP_URL: z.string().url(),
    DATABASE_URL: postgresUrl,
    DIRECT_URL: postgresUrl,
    DATABASE_ADAPTER: z.enum(["native", "neon"]).default("native"),
    NEXTAUTH_URL: z.string().url(),
    NEXTAUTH_SECRET: z.string().min(32),
    GOOGLE_CLIENT_ID: optionalString,
    GOOGLE_CLIENT_SECRET: optionalString,

    EMAIL_PROVIDER: z.enum(["log", "resend"]).default("log"),
    EMAIL_FROM: z.string().min(3),
    EMAIL_REPLY_TO: optionalString,
    RESEND_API_KEY: optionalString,

    RATE_LIMIT_PROVIDER: z.enum(["memory", "upstash"]).default("memory"),
    UPSTASH_REDIS_REST_URL: optionalUrl,
    UPSTASH_REDIS_REST_TOKEN: optionalString,
    TRUST_PROXY: booleanString(false),

    STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
    MAX_UPLOAD_BYTES: z.coerce
      .number()
      .int()
      .min(1024)
      .max(10 * 1024 * 1024)
      .default(5 * 1024 * 1024),
    S3_REGION: optionalString,
    S3_BUCKET: optionalString,
    S3_ENDPOINT: optionalUrl,
    S3_ACCESS_KEY_ID: optionalString,
    S3_SECRET_ACCESS_KEY: optionalString,
    S3_PUBLIC_BASE_URL: optionalUrl,
    S3_FORCE_PATH_STYLE: booleanString(false),

    READINESS_TOKEN: z.string().min(16),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    MONITORING_PROVIDER: z.enum(["log", "webhook"]).default("log"),
    MONITORING_WEBHOOK_URL: optionalUrl,
    MONITORING_WEBHOOK_TOKEN: optionalString,
    ANALYTICS_ID: optionalString,
  })
  .superRefine((value, context) => {
    if (
      Boolean(value.GOOGLE_CLIENT_ID) !== Boolean(value.GOOGLE_CLIENT_SECRET)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured together",
        path: ["GOOGLE_CLIENT_ID"],
      });
    }
    if (value.EMAIL_PROVIDER === "resend" && !value.RESEND_API_KEY) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "RESEND_API_KEY is required when EMAIL_PROVIDER=resend",
        path: ["RESEND_API_KEY"],
      });
    }
    if (
      value.RATE_LIMIT_PROVIDER === "upstash" &&
      (!value.UPSTASH_REDIS_REST_URL || !value.UPSTASH_REDIS_REST_TOKEN)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Both Upstash REST variables are required for distributed rate limiting",
        path: ["UPSTASH_REDIS_REST_URL"],
      });
    }
    if (
      value.STORAGE_PROVIDER === "s3" &&
      (!value.S3_REGION ||
        !value.S3_BUCKET ||
        !value.S3_ACCESS_KEY_ID ||
        !value.S3_SECRET_ACCESS_KEY ||
        !value.S3_PUBLIC_BASE_URL)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "S3 region, bucket, credentials, and public base URL are required",
        path: ["S3_BUCKET"],
      });
    }
    if (
      value.MONITORING_PROVIDER === "webhook" &&
      !value.MONITORING_WEBHOOK_URL
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "MONITORING_WEBHOOK_URL is required for webhook monitoring",
        path: ["MONITORING_WEBHOOK_URL"],
      });
    }
    if (value.APP_ENV === "production") {
      const productionChecks: Array<[boolean, keyof typeof value, string]> = [
        [
          value.APP_URL.startsWith("https://"),
          "APP_URL",
          "APP_URL must use HTTPS in production",
        ],
        [
          value.NEXTAUTH_URL.startsWith("https://"),
          "NEXTAUTH_URL",
          "NEXTAUTH_URL must use HTTPS in production",
        ],
        [
          value.NEXTAUTH_SECRET.length >= 43 &&
            !value.NEXTAUTH_SECRET.toLowerCase().includes("replace"),
          "NEXTAUTH_SECRET",
          "Use a generated production NEXTAUTH_SECRET",
        ],
        [
          value.RATE_LIMIT_PROVIDER === "upstash",
          "RATE_LIMIT_PROVIDER",
          "Production must use distributed rate limiting",
        ],
        [
          value.EMAIL_PROVIDER === "resend",
          "EMAIL_PROVIDER",
          "Production must use the transactional email provider",
        ],
        [
          value.STORAGE_PROVIDER === "s3",
          "STORAGE_PROVIDER",
          "Production must use S3-compatible storage",
        ],
        [
          value.READINESS_TOKEN.length >= 32 &&
            !value.READINESS_TOKEN.toLowerCase().includes("local"),
          "READINESS_TOKEN",
          "Use a generated readiness token in production",
        ],
      ];
      for (const [valid, path, message] of productionChecks) {
        if (!valid)
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message,
            path: [path],
          });
      }
    }
  });

export const env = envSchema.parse({
  APP_ENV: process.env.APP_ENV,
  APP_URL: process.env.APP_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  DATABASE_ADAPTER: process.env.DATABASE_ADAPTER,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
  EMAIL_FROM: process.env.EMAIL_FROM,
  EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RATE_LIMIT_PROVIDER: process.env.RATE_LIMIT_PROVIDER,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  TRUST_PROXY: process.env.TRUST_PROXY,
  STORAGE_PROVIDER: process.env.STORAGE_PROVIDER,
  MAX_UPLOAD_BYTES: process.env.MAX_UPLOAD_BYTES,
  S3_REGION: process.env.S3_REGION,
  S3_BUCKET: process.env.S3_BUCKET,
  S3_ENDPOINT: process.env.S3_ENDPOINT,
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
  S3_PUBLIC_BASE_URL: process.env.S3_PUBLIC_BASE_URL,
  S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE,
  READINESS_TOKEN: process.env.READINESS_TOKEN,
  LOG_LEVEL: process.env.LOG_LEVEL,
  MONITORING_PROVIDER: process.env.MONITORING_PROVIDER,
  MONITORING_WEBHOOK_URL: process.env.MONITORING_WEBHOOK_URL,
  MONITORING_WEBHOOK_TOKEN: process.env.MONITORING_WEBHOOK_TOKEN,
  ANALYTICS_ID: process.env.ANALYTICS_ID,
});

export type RuntimeEnvironment = typeof env;
