import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Outfit } from "next/font/google";
import "./styles.css";
import { Telemetry } from '../lib/TelemetryProvider';
import { isDashboardRequest } from "@/lib/auth/hosts";

const deskSans = Inter({ subsets: ["latin"], variable: "--font-desk-sans" });
const deskDisplay = Outfit({ subsets: ["latin"], variable: "--font-desk-display" });

export async function generateMetadata(): Promise<Metadata> {
  if (await isDashboardRequest()) {
    return {
      title: "The businesses — United Under God",
      description: "Private desk for the live apps: money, people, and who needs a hand.",
      robots: { index: false, follow: false }
    };
  }
  return {
    title: "AppEngine",
    description:
      "Describe a problem you want solved or a tool you want to build, and AppEngine builds you a real, working app for it — live, online, ready to sign into."
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
