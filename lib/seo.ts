export function appBaseUrl() {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function seoDescription(
  value: string | null | undefined,
  fallback: string,
) {
  const description = value?.replace(/\s+/g, " ").trim() || fallback;
  return description.length > 180
    ? `${description.slice(0, 177).trimEnd()}...`
    : description;
}
