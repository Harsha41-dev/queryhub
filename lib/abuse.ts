import "server-only";

export type AbuseAssessment =
  | { ok: true }
  | { ok: false; code: "LINK_SPAM" | "REPETITIVE_TEXT"; message: string };

export type ContentRiskAssessment = {
  score: number;
  labels: string[];
  summary?: string;
};

export function assessUserText(
  value: string,
  {
    maxLinks = 8,
    repeatedCharacterLimit = 30,
  }: {
    maxLinks?: number;
    repeatedCharacterLimit?: number;
  } = {},
): AbuseAssessment {
  if (countLinks(value) > maxLinks)
    return {
      ok: false,
      code: "LINK_SPAM",
      message: "This looks like link spam. Reduce the number of links.",
    };

  if (hasRepeatedCharacterRun(value, repeatedCharacterLimit))
    return {
      ok: false,
      code: "REPETITIVE_TEXT",
      message: "This looks repetitive. Rewrite it so it is useful to readers.",
    };

  if (hasLowWordVariety(value, 0.2))
    return {
      ok: false,
      code: "REPETITIVE_TEXT",
      message:
        "This looks like repeated text. Rewrite it so it is useful to readers.",
    };

  return { ok: true };
}

export function assessContentRisk(value: string): ContentRiskAssessment {
  const normalized = value.toLowerCase().normalize("NFKC");
  const labels: string[] = [];
  let score = 0;

  const links = countLinks(normalized);
  if (links >= 5) {
    labels.push("high link density");
    score += 3;
  } else if (links >= 2) {
    labels.push("multiple links");
    score += 1;
  }

  if (hasLowWordVariety(normalized, 0.25)) {
    labels.push("repetitive wording");
    score += 3;
  }

  if (isMostlyUppercase(value)) {
    labels.push("mostly uppercase");
    score += 1;
  }

  if (hasOffPlatformContact(value)) {
    labels.push("off-platform contact request");
    score += 2;
  }

  if (hasPromotionalWording(value)) {
    labels.push("promotional wording");
    score += 2;
  }

  if (hasRepeatedSentence(normalized)) {
    labels.push("repeated sentence");
    score += 2;
  }

  return {
    score,
    labels,
    summary: labels.length
      ? `${score} risk points: ${labels.join(", ")}`
      : undefined,
  };
}

export function recentDuplicateWindow(hours = 24) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function countLinks(value: string) {
  return value.match(/\bhttps?:\/\/[^\s<>)]+/gi)?.length ?? 0;
}

function hasRepeatedCharacterRun(
  value: string,
  repeatedCharacterLimit: number,
) {
  const repeatedCharacterPattern = new RegExp(
    `(.)\\1{${Math.max(1, repeatedCharacterLimit)}}`,
    "i",
  );
  return repeatedCharacterPattern.test(value);
}

function hasLowWordVariety(value: string, maxUniqueRatio: number) {
  const words = extractWords(value);
  if (words.length < 24) return false;
  return new Set(words).size <= Math.ceil(words.length * maxUniqueRatio);
}

function extractWords(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFKC")
      .match(/[a-z0-9]{2,}/g) ?? []
  );
}

function isMostlyUppercase(value: string) {
  const uppercaseLetters = value.match(/[A-Z]/g)?.length ?? 0;
  const letters = value.match(/[a-z]/gi)?.length ?? 0;
  return letters >= 40 && uppercaseLetters / letters > 0.75;
}

function hasOffPlatformContact(value: string) {
  const asksToLeavePlatform =
    /\b(whatsapp|telegram|dm me|contact me|call me|email me)\b/i.test(value);
  const includesContact =
    /(\+?\d[\d .-]{7,}\d|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i.test(value);
  return asksToLeavePlatform && includesContact;
}

function hasPromotionalWording(value: string) {
  return /\b(buy now|limited offer|guaranteed income|risk free profit|work from home)\b/i.test(
    value,
  );
}

function hasRepeatedSentence(value: string) {
  const repeatedSentences = value
    .split(/[.!?\n]+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 24);
  const sentenceCounts = new Map<string, number>();

  for (const sentence of repeatedSentences)
    sentenceCounts.set(sentence, (sentenceCounts.get(sentence) ?? 0) + 1);

  return [...sentenceCounts.values()].some((count) => count >= 3);
}
