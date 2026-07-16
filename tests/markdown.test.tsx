import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownContent } from "@/components/question/markdown-content";

describe("safe markdown rendering", () => {
  it("renders supported formatting without interpreting HTML or unsafe links", () => {
    const { container } = render(
      <MarkdownContent
        content={
          '## Heading\n\n<img src=x onerror="alert(1)">\n\n[unsafe](javascript:alert(1)) [safe](https://example.com)'
        }
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Heading" }),
    ).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText(/<img src=x onerror=/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "safe" })).toHaveAttribute(
      "href",
      "https://example.com",
    );
    expect(screen.queryByRole("link", { name: "unsafe" })).toBeNull();
  });
});
