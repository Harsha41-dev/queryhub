// root layout: fonts, providers, skip link

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { appBaseUrl } from "@/lib/seo";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "QueryHub - Learn from people who know",
    template: "%s | QueryHub",
  },
  description:
    "Ask thoughtful questions, share useful knowledge, and learn from curious people.",
  metadataBase: new URL(appBaseUrl()),
  openGraph: {
    type: "website",
    siteName: "QueryHub",
    title: "QueryHub - Learn from people who know",
    description:
      "Ask thoughtful questions, share useful knowledge, and learn from curious people.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "QueryHub - Learn from people who know",
    description:
      "Ask thoughtful questions, share useful knowledge, and learn from curious people.",
  },
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        {/* keyboard users can jump past the nav */}
        <a
          href="#main-content"
          className="fixed left-3 top-3 z-[100] -translate-y-20 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white focus:translate-y-0"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
