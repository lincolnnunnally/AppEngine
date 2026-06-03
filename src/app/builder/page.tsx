import Link from "next/link";
import { AppEngineCockpit } from "@/components/engine/app-engine-cockpit";

export default function BuilderPage() {
  return (
    <main className="shell wide-shell">
      <nav className="topnav">
        <strong>App Engine</strong>
        <div className="navlinks">
          <Link href="/">Overview</Link>
          <Link href="/account">Customer Account</Link>
          <Link href="/admin">Admin Console</Link>
        </div>
      </nav>

      <AppEngineCockpit />
    </main>
  );
}
