import LandingForm from "@/components/solve/landing-form";
import ResumeLink from "@/components/solve/resume-link";

export const dynamic = "force-dynamic";

// LAND. One sentence, one text box, no signup wall.
export default function SolveLandingPage() {
  return (
    <main className="se-wrap">
      <h1>Tell us what&rsquo;s eating your time or keeping you up at night.</h1>
      <p className="se-lede">
        We&rsquo;ll build you something that fixes it &mdash; usually within days, usually free &mdash; because building
        doesn&rsquo;t cost what it used to.
      </p>

      <LandingForm />

      <hr className="se-divider" />

      <p>
        And then we&rsquo;ll do the part no software can: introduce you to someone else fighting the same battle.
      </p>
      <p className="se-quiet">
        Because the solution was never the point. You were.
      </p>

      <ResumeLink />

      <p className="se-footer">
        If you&rsquo;re in danger right now, please call or text <strong>988</strong>, or call <strong>911</strong>.
        That matters more than anything we could build.
      </p>
    </main>
  );
}
