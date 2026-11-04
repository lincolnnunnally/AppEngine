import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Outfit } from "next/font/google";
import "./styles.css";
import { Telemetry } from '../lib/TelemetryProvider';
import { isDashboardRequest } from "@/lib/auth/hosts";

const deskSans = Inter({ subsets: ["latin"], variable: "--font-desk-sans" });
const deskDisplay = Outfit({ subsets: ["latin"], variable: "--font-desk-display" });

// One United Under God mark everywhere: the battle standard on a dark tile.
// Declared in every format a browser or phone looks for, because each one that
// is missing gets filled in by the browser itself — Safari, which does not
// reliably use SVG favicons, drew its own tile when there was no .ico, and iOS
// had no home-screen icon at all. The version bump makes cached copies refetch.
const SEAL_ICONS: Metadata["icons"] = {
  icon: [
    { url: "/favicon.svg?v=standard2", type: "image/svg+xml" },
    { url: "/favicon.ico?v=standard2", sizes: "16x16 32x32 48x48" },
    { url: "/icon-192.png?v=standard2", type: "image/png", sizes: "192x192" }
  ],
  shortcut: "/favicon.ico?v=standard2",
  apple: [{ url: "/apple-touch-icon.png?v=standard2", sizes: "180x180" }]
};

export async function generateMetadata(): Promise<Metadata> {
  if (await isDashboardRequest()) {
    return {
      title: "The businesses — United Under God",
      description: "Private desk for the live apps: money, people, and who needs a hand.",
      robots: { index: false, follow: false },
      icons: SEAL_ICONS,
    };
  }
  return {
    title: "Describe a problem. Open a live starter.",
    description:
      "Tell us what's stuck. We snap together pieces we already keep, show you the price, and publish a starter you can open — usually within minutes.",
    icons: SEAL_ICONS,
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const desk = await isDashboardRequest();
  return (
    <html lang="en" className={desk ? `desk ${deskSans.variable} ${deskDisplay.variable}` : undefined}>
      <body className={desk ? "desk" : undefined}>
        {children}
        <Telemetry app="appengine" />
      </body>
    </html>
  );
}
