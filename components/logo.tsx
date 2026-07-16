import Link from "next/link";
import { MessageCircleQuestion } from "lucide-react";
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
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-white shadow-sm">
        <MessageCircleQuestion className="size-[18px]" strokeWidth={2.4} />
      </span>
      {!compact && (
        <span className="text-lg font-extrabold tracking-tight">QueryHub</span>
      )}
    </Link>
  );
}
