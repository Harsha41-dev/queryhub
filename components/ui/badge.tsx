import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-semibold leading-none text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary",
        className,
      )}
      {...props}
    />
  );
}
