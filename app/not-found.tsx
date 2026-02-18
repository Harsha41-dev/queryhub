// 404 page

import Link from "next/link";
import { Compass } from "lucide-react";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="max-w-md text-center">
        <Logo className="justify-center" />
        <Compass className="mx-auto mt-10 size-14 text-primary/60" />
        <p className="mt-5 text-sm font-bold uppercase tracking-widest text-primary">
          404
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
          This trail ends here
        </h1>
        <p className="mt-3 text-muted-foreground">
          The page may have moved, or the question is no longer available.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white"
        >
          Back to the feed
        </Link>
      </div>
    </main>
  );
}
