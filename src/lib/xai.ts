// The AI provider helper, ported unchanged in behavior from AI Website Design
// (lincolnnunnally/ai-website-design src/lib/xai.ts) so every app talks to the
// provider the same way: plain fetch to the OpenAI-compatible chat endpoint, no
// SDK. The key is read from XAI_API_KEY and is never logged or returned.
// SERVER ONLY: import this from server actions and server modules, never from a
// "use client" file (the smoke test checks the browser bundle for it).

const XAI_URL = "https://api.x.ai/v1/chat/completions";

/** Default model (same default as AI Website Design). Override with XAI_MODEL. */
export const DESIGN_MODEL = (process.env.XAI_MODEL || "grok-4.7").trim();

export function hasAiProvider(): boolean {
  return Boolean((process.env.XAI_API_KEY || "").trim());
}

/** An HTTP failure from the provider: status plus a short message, nothing else. */
export class XaiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "XaiError";
    this.status = status;
  }
}

type JsonCall = {
  system: string;
  user: string;
  maxTokens: number;
  model?: string;
  /** Abort the call after this long. */
  timeoutMs?: number;
};

/**
 * One chat completion in JSON mode. Streams so a long answer never waits on a
 * silent socket, and returns the full text of the model's answer.
 */
export async function xaiJson({ system, user, maxTokens, model = DESIGN_MODEL, timeoutMs = 240_000 }: JsonCall): Promise<string> {
  const key = (process.env.XAI_API_KEY || "").trim();
  if (!key) throw new XaiError(401, "AI provider is not configured");

  const res = await fetch(XAI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      stream: true,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    }),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store"
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new XaiError(res.status, `${res.status} ${detail.slice(0, 300)}`.trim());
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let finish: string | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const chunk = JSON.parse(data) as {
          choices?: { delta?: { content?: string }; finish_reason?: string | null }[];
          error?: { message?: string };
        };
        if (chunk.error) throw new XaiError(502, `stream error: ${String(chunk.error.message || "").slice(0, 200)}`);
        const choice = chunk.choices?.[0];
        if (choice?.delta?.content) text += choice.delta.content;
        if (choice?.finish_reason) finish = choice.finish_reason;
      } catch (e) {
        if (e instanceof XaiError) throw e;
        // A partial or keep-alive line; ignore it.
      }
    }
  }
  if (finish === "length") {
    throw new XaiError(502, "response was cut off at the token limit");
  }
  return text;
}
