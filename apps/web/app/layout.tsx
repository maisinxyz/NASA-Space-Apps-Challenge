import type { Metadata } from "next";

import { Header } from "@/components/Header";
import { Providers } from "@/components/Providers";
import { SupportBanner } from "@/components/ui/SupportBanner";

import "./globals.css";

export const metadata: Metadata = {
  title: "FieldTwin",
  description: "Replay real NASA POWER storms on a 3D model of farmland and compare crop rotations side by side (NASA Space Apps 2026).",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col">
        <a href="#main" className="sr-only z-50 bg-surface p-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
          Skip to content
        </a>
        <Providers>
          <div className="sticky top-0 z-40">
            <Header />
            <SupportBanner />
          </div>
          <main id="main" className="flex-1">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
