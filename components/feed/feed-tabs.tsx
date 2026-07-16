"use client";

import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = ["For you", "Following", "Trending", "Unanswered"];

export function FeedTabs({
  active,
  onChange,
}: {
  active: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center border-b bg-card px-2 sm:px-4">
      <div
        className="flex min-w-0 flex-1 overflow-x-auto scrollbar-none"
        role="tablist"
        aria-label="Feed filters"
      >
        {tabs.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={active === tab}
            onClick={() => onChange(tab)}
            className={cn(
              "relative h-12 whitespace-nowrap px-3 text-sm font-semibold text-muted-foreground hover:text-foreground sm:px-4",
              active === tab &&
                "text-primary after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary",
            )}
          >
            {tab}
          </button>
        ))}
      </div>
      <span
        className="ml-2 grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground"
        aria-hidden="true"
      >
        <SlidersHorizontal className="size-4" />
      </span>
    </div>
  );
}
