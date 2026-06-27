import { ConversationalIntake } from "@/components/intake/conversational-intake";

// Entry point. One conversational discovery replaces the old two-door form wall:
// the agent asks a few questions one at a time (problem OR build — the same
// question set, just framed differently) and maps the answers onto the existing
// intake APIs behind the scenes. A "use the form" fallback keeps the original
// forms for anyone who prefers them. Routing/auth unchanged.
export default function HomePage() {
  return (
    <main className="entry">
      <ConversationalIntake />
    </main>
  );
}
