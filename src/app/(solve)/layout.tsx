import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./solve.css";

// The public front door. This route group deliberately does NOT sit behind the
// cockpit's consumer-surface gate: "no signup wall" is the first promise the
// product makes (§3, Land), and a gate would break it before anyone typed a word.
export const metadata: Metadata = {
  title: "Tell us what's keeping you up at night",
  description:
    "Describe the problem. We'll build you something that fixes it — usually within days, usually free — and then introduce you to someone else fighting the same battle."
};

export default function SolveLayout({ children }: { children: ReactNode }) {
  return <div className="se">{children}</div>;
}
