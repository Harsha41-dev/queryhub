// loading skeleton while a page is streaming

import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main
      className="mx-auto max-w-2xl space-y-4 p-4 sm:p-8"
      aria-busy="true"
      aria-label="Loading content"
    >
      <Skeleton className="h-28" />
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-xl border bg-card p-5">
          <div className="flex gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-52" />
            </div>
          </div>
          <Skeleton className="mt-5 h-6 w-5/6" />
          <Skeleton className="mt-4 h-20 w-full" />
        </div>
      ))}
    </main>
  );
}
