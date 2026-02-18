import "server-only";

import { env } from "@/lib/env";

type LogLevel = "debug" | "info" | "warn" | "error";
export type LogMeta = Record<string, unknown>;

const priorities: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const sensitiveKey =
  /authorization|cookie|password|secret|token|credential|database_url|direct_url/i;

export function sanitizeForLog(value: unknown, key = "", depth = 0): unknown {
  if (sensitiveKey.test(key)) return "[REDACTED]";
  if (depth > 4) return "[TRUNCATED]";
  if (value instanceof Error)
    return { name: value.name, message: value.message, stack: value.stack };
  if (Array.isArray(value))
    return value
      .slice(0, 25)
      .map((item) => sanitizeForLog(item, key, depth + 1));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(
        ([entryKey, item]) => [
          entryKey,
          sanitizeForLog(item, entryKey, depth + 1),
        ],
      ),
    );
  if (typeof value === "string" && value.length > 2000)
    return `${value.slice(0, 2000)}...`;
  return value;
}

function write(level: LogLevel, event: string, meta: LogMeta = {}) {
  if (priorities[level] < priorities[env.LOG_LEVEL]) return;
  const entry = JSON.stringify({
    level,
    event,
    time: new Date().toISOString(),
    service: "queryhub",
    ...(sanitizeForLog(meta) as LogMeta),
  });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}

export function requestIdFrom(request: Request) {
  const value = request.headers.get("x-request-id");
  return value && /^[a-f0-9-]{16,64}$/i.test(value) ? value : undefined;
}

export const logger = {
  debug: (event: string, meta?: LogMeta) => write("debug", event, meta),
  info: (event: string, meta?: LogMeta) => write("info", event, meta),
  warn: (event: string, meta?: LogMeta) => write("warn", event, meta),
  error: (event: string, meta?: LogMeta) => write("error", event, meta),
};
