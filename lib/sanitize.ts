import sanitizeHtml from "sanitize-html";

export function sanitizeAnswerHtml(value: string) {
  return sanitizeHtml(value, {
    allowedTags: [
      "p",
      "br",
      "h2",
      "h3",
      "strong",
      "em",
      "ul",
      "ol",
      "li",
      "blockquote",
      "pre",
      "code",
      "a",
    ],
    allowedAttributes: { a: ["href", "title", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "nofollow noreferrer",
        target: "_blank",
      }),
    },
  });
}
