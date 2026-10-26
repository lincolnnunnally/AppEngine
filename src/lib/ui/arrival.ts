// Where a visitor came from when one of our platforms sent them here: ChurchConnect
// ("Build a ministry app") or Operate ("Build a tool for your business"). Same
// engine, same prices — the welcome just speaks to them, and the order remembers
// which platform sent it. Kept for the tab in sessionStorage so it survives the
// sign-in round trip. Safe to import on the server (parseArrival) and client.
export type ArrivalSource = "churchconnect" | "operate";
export type Arrival = { from: ArrivalSource; org: string | null };

const KEY = "ae-arrival";

export const ARRIVAL_COPY: Record<ArrivalSource, { platform: string; home: string; headline: string; examples: string[] }> = {
  churchconnect: {
    platform: "ChurchConnect",
    home: "https://www.churchconnect.cloud",
    headline: "Build a ministry app",
    examples: [
      "A youth group check-in with parent contacts",
      "Checking on our elderly members each week",
      "An outreach sign-up for serving our neighborhood"
    ]
  },
  operate: {
    platform: "Operate",
    home: "https://operate.unitedundergod.org",
    headline: "Build a tool for your business",
    examples: [
      "Track jobs from quote to paid",
      "A booking page my customers can use",
      "An inventory list my crew can update"
    ]
  }
};

function cleanOrg(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
  return text || null;
}

export function parseArrival(input: { from?: unknown; org?: unknown } | null | undefined): Arrival | null {
  if (!input) return null;
  const from = typeof input.from === "string" ? input.from.trim().toLowerCase() : "";
  if (from !== "churchconnect" && from !== "operate") return null;
  return { from, org: cleanOrg(input.org) };
}

export function saveArrival(arrival: Arrival) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(arrival));
  } catch {
    // Private mode can block storage; the order just won't record its source.
  }
}

export function readArrival(): Arrival | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? parseArrival(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
