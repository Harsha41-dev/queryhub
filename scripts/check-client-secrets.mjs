import "dotenv/config";

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(".next/static");
const files = [];

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target);
    else files.push(target);
  }
}

walk(root);

const serverOnlyNames = [
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXTAUTH_SECRET",
  "GOOGLE_CLIENT_SECRET",
  "RESEND_API_KEY",
  "UPSTASH_REDIS_REST_TOKEN",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "READINESS_TOKEN",
  "MONITORING_WEBHOOK_TOKEN",
];

const needles = serverOnlyNames
  .map((name) => [name, process.env[name]])
  .filter(([, value]) => value && value.length >= 8);

const exposed = [];
for (const file of files) {
  const content = readFileSync(file);
  for (const [name, value] of needles) {
    if (content.includes(value))
      exposed.push(`${name} appears in ${path.relative(root, file)}`);
  }
}

if (exposed.length) {
  console.error(exposed.join("\n"));
  process.exit(1);
}

console.log(`Client bundle scan passed across ${files.length} static assets.`);
