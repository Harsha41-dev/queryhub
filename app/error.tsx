"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="max-w-sm text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950">
          <AlertTriangle />
        </span>
        <h1 className="mt-4 text-xl font-bold">Something didn’t load</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          The problem has been logged. You can try this page again without
          losing your work.
        </p>
        <Button className="mt-5" onClick={reset}>
          Try again
        </Button>
      </div>
    </main>
  );
}
