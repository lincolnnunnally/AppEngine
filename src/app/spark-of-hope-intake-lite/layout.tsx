import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Spark of hope",
  description: "A quiet place for stories of hope and encouragement.",
};

export default function SparkOfHopeLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
