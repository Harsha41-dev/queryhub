"use client";

// top bar for logged-out / marketing pages

import Link from "next/link";
import { Search, Moon, Sun, Menu, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

export function PublicHeader() {
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-4 px-4 lg:px-6">
        <Logo />
        <form
          action="/search"
          className="relative ml-auto hidden w-full max-w-md sm:block"
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            aria-label="Search QueryHub"
            placeholder="Search questions, topics, or people"
            className="h-10 w-full rounded-lg border bg-muted/70 pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:bg-card focus:ring-2 focus:ring-primary/10"
          />
        </form>
        <nav
          className="ml-auto hidden items-center gap-2 sm:ml-0 sm:flex"
          aria-label="Public navigation"
        >
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle theme"
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
          >
            {resolvedTheme === "dark" ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
          </Button>
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-muted"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            Join QueryHub
          </Link>
        </nav>
        <Button
          className="ml-auto sm:hidden"
          variant="ghost"
          size="icon"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen(!open)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </div>
      {open && (
        <div className="space-y-3 border-t p-4 sm:hidden">
          <form action="/search" className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              aria-label="Search QueryHub"
              placeholder="Search QueryHub"
              className="h-11 w-full rounded-lg border bg-muted pl-9 pr-3 text-sm"
            />
          </form>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/login"
              className="rounded-lg border px-4 py-2.5 text-center text-sm font-semibold"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-white"
            >
              Join
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
