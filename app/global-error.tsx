"use client";

import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
          <div className="max-w-sm text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-amber-100 text-amber-700">
              <AlertTriangle aria-hidden="true" />
            </span>
            <h1 className="mt-4 text-xl font-bold">Something went wrong</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              The error was logged. Try again, or return to QueryHub in a new
              tab.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
