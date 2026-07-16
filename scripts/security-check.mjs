import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

const tracked = execFileSync("git", ["ls-files", "-z"], {
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);

const forbiddenPaths = tracked.filter(
  (file) => /(^|\/)\.env($|\.)/.test(file) && file !== ".env.example",
);

const patterns = [
  /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/,
  /\bgh[oprsu]_[A-Za-z0-9]{30,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{40,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bAIza[0-9A-Za-z_-]{30,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
];

const findings = [];
for (const file of tracked) {
  let stat;
  try {
    stat = statSync(file);
  } catch {
    continue;
  }
  if (!stat.isFile() || stat.size > 5 * 1024 * 1024) continue;
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const pattern of patterns) {
    if (pattern.test(content))
      findings.push(`${file}: credential-like pattern`);
  }
}

for (const file of tracked.filter((name) =>
  /^prisma\/migrations\/.*\/migration\.sql$/.test(name),
)) {
  const content = readFileSync(file, "utf8");
  if (/\b(?:DROP\s+(?:TABLE|COLUMN)|TRUNCATE\s+TABLE)\b/i.test(content))
    findings.push(
      `${file}: destructive migration statement requires manual review`,
    );
}

if (forbiddenPaths.length || findings.length) {
  console.error(
    [
      ...forbiddenPaths.map((file) => `${file}: unsafe environment file`),
      ...findings,
    ].join("\n"),
  );
  process.exit(1);
}

console.log(`Security scan passed for ${tracked.length} tracked files.`);
