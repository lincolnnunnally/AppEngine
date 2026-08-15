import { ConversationalIntake } from "@/components/intake/conversational-intake";

// Same conversational intake customers get at the factory "/". Also a
// bookmark if the owner wants the builder from the desk.
export default function StartPage() {
  return (
    <main className="entry">
      <ConversationalIntake />
    </main>
  );
}
