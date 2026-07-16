"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginSchema, type LoginInput } from "@/lib/validators";
import { safeRedirectPath } from "@/lib/utils";

export function LoginForm({
  googleEnabled = false,
}: {
  googleEnabled?: boolean;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [serverError, setServerError] = useState("");
  const notice =
    params.get("emailVerification") === "success"
      ? "Email verified. You can sign in now."
      : params.get("emailChange") === "success"
        ? "Email changed. Sign in with the new address."
        : params.get("emailVerification") === "invalid" ||
            params.get("emailChange") === "invalid"
          ? "That email link is invalid or has expired."
          : "";
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "maya@queryhub.dev", password: "DemoPass123!" },
  });
  async function submit(values: LoginInput) {
    setServerError("");
    const result = await signIn("credentials", {
      ...values,
      redirect: false,
      callbackUrl: safeRedirectPath(params.get("callbackUrl")),
    });
    if (result?.error) {
      setServerError(
        "Email or password is incorrect. Try the demo credentials below.",
      );
      return;
    }
    router.push(result?.url ?? "/home");
  }
  return (
    <form
      onSubmit={form.handleSubmit(submit)}
      className="mt-8 space-y-5"
      noValidate
    >
      {serverError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {serverError}
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-foreground"
        >
          {notice}
        </div>
      )}
      <div className="block">
        <label
          htmlFor="login-email"
          className="mb-2 block text-sm font-semibold"
        >
          Email address
        </label>
        <span className="relative block">
          <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            className="pl-10"
            {...form.register("email")}
          />
        </span>
        {form.formState.errors.email && (
          <span className="mt-1 block text-xs text-destructive">
            {form.formState.errors.email.message}
          </span>
        )}
      </div>
      <div className="block">
        <span className="mb-2 flex items-center justify-between text-sm font-semibold">
          <label htmlFor="login-password">Password</label>
          <Link
            href="/forgot-password"
            className="text-xs font-semibold text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </span>
        <span className="relative block">
          <LockKeyhole className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="login-password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            className="px-10"
            {...form.register("password")}
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </span>
        {form.formState.errors.password && (
          <span className="mt-1 block text-xs text-destructive">
            {form.formState.errors.password.message}
          </span>
        )}
      </div>
      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
      </Button>
      <div className="relative flex items-center">
        <span className="h-px flex-1 bg-border" />
        <span className="px-3 text-xs text-muted-foreground">
          or continue with
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        size="lg"
        disabled={!googleEnabled}
        onClick={() =>
          void signIn("google", {
            callbackUrl: safeRedirectPath(params.get("callbackUrl")),
          })
        }
      >
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M21.35 12.2c0-.7-.06-1.2-.2-1.75H12v3.32h5.37a4.58 4.58 0 0 1-2 3v2.15h3.24c1.9-1.75 2.74-4.32 2.74-6.72"
          />
          <path
            fill="#34A853"
            d="M12 21.7c2.7 0 4.98-.9 6.64-2.43l-3.25-2.5c-.9.6-2.05.96-3.39.96-2.6 0-4.8-1.76-5.6-4.13H3.05v2.22A10 10 0 0 0 12 21.7"
          />
          <path
            fill="#FBBC05"
            d="M6.4 13.6a6 6 0 0 1 0-3.82V7.56H3.05a10 10 0 0 0 0 8.26z"
          />
          <path
            fill="#EA4335"
            d="M12 5.65c1.48 0 2.8.5 3.84 1.5l2.88-2.88A9.65 9.65 0 0 0 3.05 7.56L6.4 9.78A5.96 5.96 0 0 1 12 5.65"
          />
        </svg>
        {googleEnabled ? "Continue with Google" : "Google OAuth not configured"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        New to QueryHub?{" "}
        <Link
          href="/register"
          className="font-semibold text-primary hover:underline"
        >
          Create an account
        </Link>
      </p>
      <div className="rounded-lg bg-muted p-3 text-xs leading-5 text-muted-foreground">
        <strong className="text-foreground">Demo:</strong> maya@queryhub.dev /
        DemoPass123!
      </div>
    </form>
  );
}
