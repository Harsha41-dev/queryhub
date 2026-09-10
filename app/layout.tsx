// root layout: fonts, providers, skip link

import type { Metadata } from "next";
import { Outfit, Instrument_Serif, IBM_Plex_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { appBaseUrl } from "@/lib/seo";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
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
    <html lang="en" className={`${outfit.variable} ${serif.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className={`${outfit.variable} ${serif.variable} ${mono.variable} font-sans`}>
        {/* keyboard users can jump past the nav */}
        <a
          href="#main-content"
          className="fixed left-3 top-3 z-[100] -translate-y-20 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:translate-y-0"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
