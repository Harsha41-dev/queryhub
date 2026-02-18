const markdownImagePattern = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g;

export function extractMarkdownImageUrls(content: string) {
  const urls = new Set<string>();
  for (const match of content.matchAll(markdownImagePattern)) {
    const url = match[1];
    if (url.length <= 2048) urls.add(url);
  }
  return [...urls].slice(0, 20);
}
