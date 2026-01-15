// sign in page

import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};
export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to continue learning and sharing what you know."
    >
      <Suspense>
        <LoginForm googleEnabled={Boolean(env.GOOGLE_CLIENT_ID)} />
      </Suspense>
    </AuthShell>
  );
}
