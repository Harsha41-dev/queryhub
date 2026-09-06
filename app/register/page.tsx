// create account page

import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Create an account",
  robots: { index: false, follow: false },
};
export default function RegisterPage() {
  return (
    <AuthShell
      title="Join a curious community"
      description="Create your profile and start building a library of useful knowledge."
    >
      <RegisterForm />
    </AuthShell>
  );
}
