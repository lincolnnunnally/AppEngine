import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./styles.css";

// Public-facing metadata — consumer brand only, no operator/infra jargon
// (scope: customers never see "App Engine", "Neon", or provider/engine terms).
export const metadata: Metadata = {
  title: "AppEngine",
  description: "Describe a problem you want solved or a tool you want to build, and AppEngine builds you a real, working app for it — live, online, ready to sign into."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
