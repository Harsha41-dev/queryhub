/* eslint-disable @next/next/no-img-element */
// very small markdown renderer (no external markdown lib)

import { cn } from "@/lib/utils";

export function MarkdownContent({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let index = 0;

  // walk line by line and build react nodes
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (line.startsWith("```")) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```"))
        code.push(lines[index++]);
      if (index < lines.length) index += 1;
      blocks.push(
        <pre key={`code-${index}`}>
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push(<h3 key={`h3-${index}`}>{inline(line.slice(4))}</h3>);
      index += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push(<h2 key={`h2-${index}`}>{inline(line.slice(3))}</h2>);
      index += 1;
      continue;
    }
    if (line.startsWith("> ")) {
      blocks.push(
        <blockquote key={`quote-${index}`}>{inline(line.slice(2))}</blockquote>,
      );
      index += 1;
      continue;
    }
    if (/^[-*] /.test(line)) {
      const items: React.ReactNode[] = [];
      while (index < lines.length && /^[-*] /.test(lines[index])) {
        items.push(
          <li key={`bullet-${index}`}>{inline(lines[index].slice(2))}</li>,
        );
        index += 1;
      }
      blocks.push(<ul key={`ul-${index}`}>{items}</ul>);
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const items: React.ReactNode[] = [];
      while (index < lines.length && /^\d+\. /.test(lines[index])) {
        items.push(
          <li key={`number-${index}`}>
            {inline(lines[index].replace(/^\d+\. /, ""))}
          </li>,
        );
        index += 1;
      }
      blocks.push(<ol key={`ol-${index}`}>{items}</ol>);
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{2,3} |```|> |[-*] |\d+\. )/.test(lines[index])
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push(
      <p key={`paragraph-${index}`}>{inline(paragraph.join("\n"))}</p>,
    );
  }

  return <div className={cn("prose-answer", className)}>{blocks}</div>;
}

function inline(value: string) {
  const token =
    /(!\[[^\]]*\]\(https?:\/\/[^)\s]+\)|\*\*[^*]+\*\*|_[^_]+_|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  return value.split(token).map((part, index) => {
    const image = part.match(/^!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)$/);
    if (image)
      return (
        <img
          key={`${index}-${part}`}
          src={image[2]}
          alt={image[1]}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="my-4 max-h-[520px] rounded-lg border object-contain"
        />
      );
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={`${index}-${part}`}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("_") && part.endsWith("_"))
      return <em key={`${index}-${part}`}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={`${index}-${part}`}>{part.slice(1, -1)}</code>;
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
    if (link)
      return (
        <a
          key={`${index}-${part}`}
          href={link[2]}
          target="_blank"
          rel="nofollow noopener noreferrer"
        >
          {link[1]}
        </a>
      );
    return part;
  });
}
