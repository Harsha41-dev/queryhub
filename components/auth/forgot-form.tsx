"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setSent(true);
    setLoading(false);
  }
  if (sent)
    return (
      <div className="mt-8 text-center">
        <CheckCircle2 className="mx-auto size-12 text-emerald-500" />
        <h2 className="mt-4 text-lg font-bold">Check your inbox</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          If an account exists for <strong>{email}</strong>, recovery
          instructions are on the way.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary"
        >
          <ArrowLeft className="size-4" />
          Return to sign in
        </Link>
      </div>
    );
  return (
    <form onSubmit={submit} className="mt-8 space-y-5">
      <label className="block">
        <span className="mb-2 block text-sm font-semibold">Email address</span>
        <Input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
      </label>
      <Button className="w-full" size="lg" disabled={loading}>
        {loading ? "Sending…" : "Send recovery link"}
      </Button>
      <Link
        href="/login"
        className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to sign in
      </Link>
    </form>
  );
}
