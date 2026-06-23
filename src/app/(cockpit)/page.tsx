import Link from "next/link";

// Entry point. Two doors, consumer-friendly language. Both routes flow through the
// canonical problem_intake_gate behind the scenes (problem -> consumer problem
// intake; build -> opportunity intake). Presentation only — routing/auth unchanged.
export default function HomePage() {
  return (
    <main className="entry">
      <header className="entry-head">
        <h1 className="entry-title">Where would you like to begin?</h1>
        <p className="entry-sub">Every problem has an opportunity inside it.</p>
      </header>

      <section className="entry-doors" aria-label="Choose how to begin">
        <Link className="entry-door entry-door--problem" href="/problem-intake-lite" data-testid="entry-door-problem">
          <span className="entry-door-accent" aria-hidden="true" />
          <h2 className="entry-door-title">I have a problem to solve</h2>
          <p className="entry-door-text">
            Describe what&apos;s getting in the way, and we&apos;ll work toward a solution together.
          </p>
        </Link>

        <Link className="entry-door entry-door--build" href="/opportunity-intake" data-testid="entry-door-build">
          <span className="entry-door-accent" aria-hidden="true" />
          <h2 className="entry-door-title">I have something I want to build</h2>
          <p className="entry-door-text">
            Share your idea and we&apos;ll help shape it, building on what already works.
          </p>
        </Link>
      </section>
    </main>
  );
}
