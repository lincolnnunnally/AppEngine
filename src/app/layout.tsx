import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./styles.css";

// Public-facing metadata — consumer brand only, no operator/infra jargon
// (scope: customers never see "App Engine", "Neon", or provider/engine terms).
export const metadata: Metadata = {
  title: "We Succeed",
  description: "Bring a problem or an idea — we'll help you find the opportunity inside it and take the next real step."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
