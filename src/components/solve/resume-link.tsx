"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// There is no login, so "come back later" has to work off the device itself. If we
// remembered a token here, offer it — quietly, below everything else.
export default function ResumeLink() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    try {
      setToken(window.localStorage.getItem("se_token"));
    } catch {
      setToken(null);
    }
  }, []);

  if (!token) {
    return null;
  }

  return (
    <p className="se-quiet">
      <Link href={`/solve/c/${token}`}>Pick up where you left off</Link>
    </p>
  );
}
