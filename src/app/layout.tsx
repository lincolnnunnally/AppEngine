import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Outfit } from "next/font/google";
import "./styles.css";
import { Telemetry } from '../lib/TelemetryProvider';
import { isDashboardRequest } from "@/lib/auth/hosts";

const deskSans = Inter({ subsets: ["latin"], variable: "--font-desk-sans" });
const deskDisplay = Outfit({ subsets: ["latin"], variable: "--font-desk-display" });

const SEAL_ICONS: Metadata["icons"] = {
  icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  shortcut: "/favicon.svg",
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
      "Tell us what's stuck. We snap together pieces we already keep, show you the price, and publish a starter you can open — usually in days.",
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
