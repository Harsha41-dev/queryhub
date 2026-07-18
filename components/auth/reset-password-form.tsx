"use client";

// set a new password using the token from the email link

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ResetPasswordForm({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token,
        password: form.get("password"),
        confirmPassword: form.get("confirmPassword"),
      }),
    });
    const result = (await response.json()) as {
      ok: boolean;
      error?: { message: string };
    };
    setLoading(false);
    if (!response.ok || !result.ok) {
      setError(result.error?.message ?? "The password could not be reset.");
      return;
    }
    setComplete(true);
  }

  if (complete)
    return (
      <div className="mt-8 text-center">
        <CheckCircle2 className="mx-auto size-12 text-emerald-500" />
        <h2 className="mt-4 text-lg font-bold">Password updated</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Existing sessions have been invalidated. Sign in with the new
          password.
        </p>
        <Link href="/login" className={buttonVariants({ className: "mt-6" })}>
          Continue to sign in
        </Link>
      </div>
    );

  return (
    <form onSubmit={submit} className="mt-8 space-y-5">
      <label className="block">
        <span className="mb-2 block text-sm font-semibold">New password</span>
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold">
          Confirm new password
        </span>
        <Input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button className="w-full" size="lg" disabled={loading || !token}>
        {loading ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
