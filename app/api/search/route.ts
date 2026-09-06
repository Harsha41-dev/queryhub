import { NextResponse } from "next/server";
import { z } from "zod";
import { trackAnalytics } from "@/lib/analytics";
import { actionError, actionSuccess } from "@/lib/errors";
import { monitorPerformance } from "@/lib/monitoring";
import {
  checkRateLimit,
  clientRateLimitKey,
  rateLimitResponse,
} from "@/lib/rate-limit";
import { searchAll } from "@/lib/search-service";

const schema = z.object({
  q: z.string().trim().min(2).max(200),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  sort: z.enum(["relevance", "newest", "views"]).default("relevance"),
  filter: z.enum(["all", "unanswered"]).default("all"),
  topic: z
    .string()
    .trim()
    .max(80)
    .transform((value) => value || undefined)
    .optional(),
  author: z
    .string()
    .trim()
    .max(80)
    .transform((value) => value || undefined)
    .optional(),
});

export async function GET(request: Request) {
  const limit = await checkRateLimit(
    `search:${clientRateLimitKey(request)}`,
    90,
    60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);

  const url = new URL(request.url);
  const parsed = schema.safeParse({
    q: url.searchParams.get("q"),
    page: url.searchParams.get("page") ?? 1,
    sort: url.searchParams.get("sort") ?? "relevance",
    filter: url.searchParams.get("filter") ?? "all",
    topic: url.searchParams.get("topic") ?? undefined,
    author: url.searchParams.get("author") ?? undefined,
  });
  if (!parsed.success)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "Enter at least two characters."),
      { status: 400 },
    );

  try {
    const result = await monitorPerformance(
      "search.query",
      () =>
        searchAll({
          query: parsed.data.q,
          page: parsed.data.page,
          sort: parsed.data.sort,
          filter: parsed.data.filter,
          topic: parsed.data.topic,
          author: parsed.data.author,
        }),
      {
        requestId: request.headers.get("x-request-id") ?? undefined,
        route: "/api/search",
      },
    );
    void trackAnalytics("search_performed", {
      request,
      properties: {
        queryLength: parsed.data.q.length,
        page: parsed.data.page,
        sort: parsed.data.sort,
        filter: parsed.data.filter,
        hasTopicFilter: Boolean(parsed.data.topic),
        hasAuthorFilter: Boolean(parsed.data.author),
        resultCount: result.counts.total,
      },
    });
    return NextResponse.json(actionSuccess(result));
  } catch {
    return NextResponse.json(
      actionError("SEARCH_UNAVAILABLE", "Search is temporarily unavailable."),
      { status: 503 },
    );
  }
}
