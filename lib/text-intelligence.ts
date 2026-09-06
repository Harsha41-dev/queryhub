const stopWords = new Set([
  "about",
  "after",
  "again",
  "also",
  "because",
  "being",
  "between",
  "could",
  "does",
  "from",
  "have",
  "into",
  "more",
  "should",
  "than",
  "that",
  "their",
  "there",
  "these",
  "this",
  "through",
  "what",
  "when",
  "where",
  "which",
  "with",
  "would",
  "your",
]);

const MAX_SEARCH_TERMS = 12;
const QUESTION_START = /^(how|why|what|which|when|where)\b/i;

function normalizeForSearch(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s]/g, " ");
}

export function tokenizeSearch(input: string) {
  return normalizeForSearch(input)
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 2 && !stopWords.has(term))
    .slice(0, MAX_SEARCH_TERMS);
}

export function textRelevance(
  query: string,
  fields: Array<{ text: string | null | undefined; weight?: number }>,
) {
  const normalizedQuery = query.trim().toLowerCase();
  const terms = tokenizeSearch(query);
  let score = 0;
  const matchedTerms = new Set<string>();
  let reason = "Related match";

  for (const field of fields) {
    const text = (field.text ?? "").toLowerCase();
    if (!text) continue;
    const weight = field.weight ?? 1;
    const words = tokenizeSearch(text);

    const phraseMatch = scorePhraseMatch(text, normalizedQuery, weight);
    score += phraseMatch.score;
    if (phraseMatch.reason) reason = phraseMatch.reason;

    for (const term of terms) {
      if (text.includes(term)) {
        matchedTerms.add(term);
        score += 18 * weight;
        continue;
      }

      if (words.some((word) => isFuzzyMatch(term, word))) {
        matchedTerms.add(term);
        score += 10 * weight;
        if (reason === "Related match") reason = "Spelling-tolerant match";
      }
    }
  }

  if (matchedTerms.size > 0 && reason === "Related match")
    reason = "Keyword match";

  return {
    score,
    matchedTerms: [...matchedTerms],
    reason,
  };
}

function scorePhraseMatch(text: string, query: string, weight: number) {
  if (text === query) return { score: 120 * weight, reason: "Exact match" };
  if (text.startsWith(query))
    return { score: 80 * weight, reason: "Starts with your search" };
  if (text.includes(query))
    return { score: 55 * weight, reason: "Phrase match" };
  return { score: 0, reason: undefined };
}

export function similarityRatio(a: string, b: string) {
  const left = tokenizeSearch(a);
  const rightTerms = tokenizeSearch(b);
  const right = new Set(rightTerms);
  if (!left.length || !right.size) return 0;
  const shared = left.filter(
    (term) =>
      right.has(term) ||
      rightTerms.some((candidate) => isFuzzyMatch(term, candidate)),
  ).length;
  return shared / Math.max(left.length, right.size);
}

export function buildSearchExcerpt(
  text: string | null | undefined,
  query: string,
  maxLength = 220,
) {
  const value = (text ?? "").replace(/\s+/g, " ").trim();
  if (value.length <= maxLength) return value;

  const terms = tokenizeSearch(query);
  const lower = value.toLowerCase();
  const firstMatch = firstSearchTermIndex(lower, terms);
  const start = Math.max(0, (firstMatch ?? 0) - 60);
  const excerpt = value.slice(start, start + maxLength);
  return `${start > 0 ? "..." : ""}${excerpt}${start + maxLength < value.length ? "..." : ""}`;
}

function firstSearchTermIndex(text: string, terms: string[]) {
  const matches = terms
    .map((term) => text.indexOf(term))
    .filter((index) => index >= 0);
  return matches.length ? Math.min(...matches) : undefined;
}

export function questionQualityWarnings({
  title,
  description = "",
  duplicateScore = 0,
  topicCount = 0,
}: {
  title: string;
  description?: string;
  duplicateScore?: number;
  topicCount?: number;
}) {
  const warnings: string[] = [];
  const titleTerms = tokenizeSearch(title);
  if (title.trim().split(/\s+/).filter(Boolean).length < 5)
    warnings.push("Make the question more specific.");
  if (titleTerms.length < 3)
    warnings.push("Add searchable keywords so topic experts can find it.");
  if (QUESTION_START.test(title) && description.length < 40)
    warnings.push("Add context so answers can match your situation.");
  if (topicCount === 0) warnings.push("Choose at least one topic.");
  if (duplicateScore >= 0.7)
    warnings.push("A very similar question already exists.");
  else if (duplicateScore >= 0.45)
    warnings.push("Review similar questions before publishing.");
  return warnings;
}

function isFuzzyMatch(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 2) return false;
  const threshold = a.length > 7 ? 2 : 1;
  return levenshtein(a, b) <= threshold;
}

// Small edit-distance check keeps typo-tolerant search local and dependency-free.
function levenshtein(a: string, b: string) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let last = i - 1;
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const old = previous[j];
      previous[j] =
        a[i - 1] === b[j - 1]
          ? last
          : Math.min(previous[j - 1], previous[j], last) + 1;
      last = old;
    }
  }
  return previous[b.length];
}
