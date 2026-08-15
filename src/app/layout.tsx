import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./styles.css";
import { Telemetry } from '../lib/TelemetryProvider';

// Public-facing metadata — consumer brand only, no operator/infra jargon
// (scope: customers never see "App Engine", "Neon", or provider/engine terms).
export const metadata: Metadata = {
  title: "The businesses — United Under God",
  description: "Internal desk for the live apps: money, people, and who needs a hand."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Telemetry app="appengine" />
      </body>
    </html>
  );
}
