import { ConversationalIntake } from "@/components/intake/conversational-intake";

// "Start something new" — the same conversational intake that customers get at
// "/", reachable by the owner now that his "/" is the command deck. One
// component, two doors; no parallel intake path.
export default function StartPage() {
  return (
    <main className="entry">
      <ConversationalIntake />
    </main>
  );
}
