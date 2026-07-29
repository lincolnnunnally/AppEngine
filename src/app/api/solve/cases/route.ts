import { cleanText, clientKey, handleCaught, jsonError, jsonOk, readJson, requireConfigured, throttle } from "@/lib/solution-engine/http";
import { startCase } from "@/lib/solution-engine/service";

export const dynamic = "force-dynamic";

// LAND. One text box, no signup wall — this is the only endpoint a first-time
// visitor touches, and it is deliberately open (§3).
export async function POST(request: Request) {
  const unconfigured = requireConfigured();

  if (unconfigured) {
    return unconfigured;
  }

  if (!throttle(`start:${clientKey(request)}`, 5, 60_000)) {
    return jsonError("You've started a few of these just now — give it a minute.", 429);
  }

  const body = await readJson<{ statedProblem?: string; anonId?: string }>(request);
  const statedProblem = cleanText(body?.statedProblem);

  if (statedProblem.length < 8) {
    return jsonError("Tell me a little more than that — a sentence is plenty.");
  }

  try {
    const view = await startCase({ statedProblem, anonId: cleanText(body?.anonId, 64) || null });

    return jsonOk(
      {
        token: view.theCase.token,
        state: view.theCase.state,
        messages: view.messages.map(publicMessage)
      },
      201
    );
  } catch (caught) {
    return handleCaught(caught);
  }
}

function publicMessage(message: { role: string; body: string; turn_index: number }) {
  return { role: message.role, body: message.body, turnIndex: message.turn_index };
}
