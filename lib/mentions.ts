export function extractMentionedUsernames(content: string) {
  const matches = content.matchAll(/(^|[^a-z0-9_])@([a-z0-9_]{3,30})\b/gi);
  return Array.from(
    new Set(Array.from(matches, (match) => match[2].toLowerCase())),
  ).slice(0, 10);
}
