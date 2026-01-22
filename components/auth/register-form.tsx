"use client";

// create account form with basic password strength checks

import Link from "next/link";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { registerSchema, type RegisterInput } from "@/lib/validators";

export function RegisterForm() {
  const [serverError, setServerError] = useState("");
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      terms: undefined,
    },
  });
  const password = useWatch({ control: form.control, name: "password" }) ?? "";
  // little checklist under the password field
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
  ];
  async function submit(values: RegisterInput) {
    setServerError("");
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    const result = (await response.json()) as {
      ok: boolean;
      error?: { message: string };
    };
    if (!response.ok || !result.ok) {
      setServerError(
        result.error?.message ?? "We could not create your account.",
      );
      return;
    }
    await signIn("credentials", {
      email: values.email,
      password: values.password,
      callbackUrl: "/onboarding",
    });
  }
  return (
    <form
      onSubmit={form.handleSubmit(submit)}
      className="mt-7 space-y-4"
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" error={form.formState.errors.name?.message}>
          <Input
            aria-label="Full name"
            autoComplete="name"
            placeholder="Maya Chen"
            {...form.register("name")}
          />
        </Field>
        <Field label="Username" error={form.formState.errors.username?.message}>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              @
            </span>
            <Input
              aria-label="Username"
              autoComplete="username"
              placeholder="mayachen"
              className="pl-7"
              {...form.register("username")}
            />
          </div>
        </Field>
      </div>
      <Field label="Email address" error={form.formState.errors.email?.message}>
        <Input
          aria-label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          {...form.register("email")}
        />
      </Field>
      <Field label="Password" error={form.formState.errors.password?.message}>
        <Input
          aria-label="Password"
          type="password"
          autoComplete="new-password"
          {...form.register("password")}
        />
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          {["8+ characters", "Uppercase", "Number"].map((label, index) => (
            <span
              key={label}
              className={checks[index] ? "text-emerald-600" : ""}
            >
              <CheckCircle2 className="mr-1 inline size-3" />
              {label}
            </span>
          ))}
        </div>
      </Field>
      <Field
        label="Confirm password"
        error={form.formState.errors.confirmPassword?.message}
      >
        <Input
          aria-label="Confirm password"
          type="password"
          autoComplete="new-password"
          {...form.register("confirmPassword")}
        />
      </Field>
      <label className="flex items-start gap-3 text-xs leading-5 text-muted-foreground">
        <input
          type="checkbox"
          className="mt-1 size-4 rounded border"
          {...form.register("terms")}
        />
        <span>
          I agree to the{" "}
          <Link href="/terms" className="font-semibold text-primary">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="font-semibold text-primary">
            Privacy Policy
          </Link>
          , and I will follow the community guidelines.
        </span>
      </label>
      {form.formState.errors.terms && (
        <span className="block text-xs text-destructive">
          {form.formState.errors.terms.message}
        </span>
      )}
      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting
          ? "Creating your account..."
          : "Create account"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-primary hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
      {error && (
        <span className="mt-1 block text-xs text-destructive">{error}</span>
      )}
    </label>
  );
}
