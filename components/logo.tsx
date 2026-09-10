import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-2 text-foreground",
        className,
      )}
      aria-label="QueryHub home"
    >
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <rect width="32" height="32" rx="8" className="fill-primary" />
        <path
          d="M11 11.2h7.2c2.6 0 4.3 1.6 4.3 4.1 0 2.6-1.8 4.2-4.5 4.2H14.4V21.5"
          className="stroke-primary-foreground"
          fill="none"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M11 11.2V21.5"
          className="stroke-primary-foreground"
          fill="none"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      {!compact && (
        <span className="text-lg font-medium tracking-tight">QueryHub</span>
      )}
    </Link>
  );
}
