import Link from "next/link";
import { CheckCircle2, Quote } from "lucide-react";
import { Logo } from "@/components/logo";

export function AuthShell({
  children,
  title,
  description,
}: {
  children: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <main className="grid min-h-screen bg-card lg:grid-cols-[minmax(0,1fr)_minmax(520px,0.8fr)]">
      <section className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_30%,#818cf8_0,transparent_30%),radial-gradient(circle_at_80%_70%,#22d3ee_0,transparent_28%)]" />
        <Logo className="relative text-white" />
        <div className="relative my-auto max-w-xl">
          <Quote className="size-10 text-indigo-400" />
          <blockquote className="mt-6 text-balance text-4xl font-bold leading-tight tracking-tight">
            A good question changes what everyone in the room can see.
          </blockquote>
          <p className="mt-6 text-base leading-7 text-slate-300">
            Join people who explain the hard parts, challenge assumptions with
            care, and make what they know useful to others.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-4 text-sm text-slate-300">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-400" />
              Thoughtful answers
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-400" />
              Expert communities
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-400" />
              Curated feed
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-400" />
              Respectful discussion
            </span>
          </div>
        </div>
        <p className="relative text-xs text-slate-500">
          © 2026 QueryHub · Knowledge grows when it is shared.
        </p>
      </section>
      <section className="flex min-h-screen flex-col p-5 sm:p-10 lg:p-14">
        <div className="flex items-center justify-between lg:hidden">
          <Logo />
          <Link
            href="/"
            className="text-sm font-semibold text-muted-foreground"
          >
            Explore first
          </Link>
        </div>
        <div className="m-auto w-full max-w-[430px] py-10">
          <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
          {children}
        </div>
        <p className="text-center text-xs text-muted-foreground lg:hidden">
          By continuing, you agree to our Terms and Privacy Policy.
        </p>
      </section>
    </main>
  );
}
