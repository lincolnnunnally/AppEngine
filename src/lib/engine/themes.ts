// Visual style themes for generated apps. Six named looks (the profiles from
// design-intent-engine.md) turned into REAL theme tokens that drive the generated
// app's stylesheet — replacing the single hardcoded look. A person picks one in the
// build flow (visual gallery); if they skip it, pickThemeForIdea auto-matches a
// fitting theme from their idea, so every app looks intentional either way.
//
// PURE module (no fs/db imports) so the build-flow client picker can import
// THEME_OPTIONS directly.

export type Theme = {
  id: string;
  name: string;
  description: string;
  mode: "light" | "dark";
  paper: string; // page background
  panel: string; // card/surface background
  ink: string; // primary text
  muted: string; // secondary text
  line: string; // borders
  accent: string; // primary action / brand
  accentInk: string; // text on the accent
  radius: string; // corner style (controls the app's "feel")
  font: string; // font-family stack (system fonts only — no external load)
};

const SANS =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const ROUNDED =
  'ui-rounded, "Segoe UI", "Helvetica Neue", system-ui, -apple-system, sans-serif';
const REFINED =
  '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, ui-serif, serif';

export const THEMES: Theme[] = [
  {
    id: "warm-approachable",
    name: "Warm & approachable",
    description: "Friendly, hopeful, easy on the eyes. A safe default for most apps.",
    mode: "light",
    paper: "#f6f3ed",
    panel: "#ffffff",
    ink: "#17211b",
    muted: "#66736c",
    line: "#d9d4ca",
    accent: "#127c73",
    accentInk: "#ffffff",
    radius: "10px",
    font: SANS
  },
  {
    id: "professional-clean",
    name: "Professional & clean",
    description: "Crisp, trustworthy, business-ready. Great for SaaS and B2B tools.",
    mode: "light",
    paper: "#f5f7fa",
    panel: "#ffffff",
    ink: "#1a2230",
    muted: "#64748b",
    line: "#e2e8f0",
    accent: "#2563eb",
    accentInk: "#ffffff",
    radius: "6px",
    font: SANS
  },
  {
    id: "premium-modern",
    name: "Premium & modern",
    description: "Dark, elegant, high-end. For finance, agencies, and luxury feels.",
    mode: "dark",
    paper: "#14151a",
    panel: "#1e2028",
    ink: "#f0f0f4",
    muted: "#9a9aa8",
    line: "#2c2e38",
    accent: "#c9a35e",
    accentInk: "#14151a",
    radius: "10px",
    font: REFINED
  },
  {
    id: "playful-friendly",
    name: "Playful & friendly",
    description: "Bright, rounded, energetic. For consumer, social, and kids apps.",
    mode: "light",
    paper: "#fff7f2",
    panel: "#ffffff",
    ink: "#3a2a2a",
    muted: "#a5776a",
    line: "#ffe3d6",
    accent: "#f26a4b",
    accentInk: "#ffffff",
    radius: "18px",
    font: ROUNDED
  },
  {
    id: "ministry-community",
    name: "Ministry & community",
    description: "Warm, grounded, welcoming. For churches, nonprofits, and communities.",
    mode: "dark",
    paper: "#0e1512",
    panel: "#17211c",
    ink: "#eef2ee",
    muted: "#9aa79f",
    line: "#28332c",
    accent: "#e6a93a",
    accentInk: "#0e1512",
    radius: "10px",
    font: SANS
  },
  {
    id: "operations-dashboard",
    name: "Operations dashboard",
    description: "Dense, neutral, data-first. For admin panels and internal tools.",
    mode: "light",
    paper: "#f1f4f8",
    panel: "#ffffff",
    ink: "#1e2732",
    muted: "#647082",
    line: "#dbe1ea",
    accent: "#3457d5",
    accentInk: "#ffffff",
    radius: "6px",
    font: SANS
  }
];

export const DEFAULT_THEME_ID = "warm-approachable";

export function getTheme(id: string | null | undefined): Theme | null {
  if (!id) return null;
  return THEMES.find((theme) => theme.id === id) || null;
}

// Keyword auto-match: choose a fitting theme from the idea when the user does not pick.
const MATCHERS: Array<{ id: string; keywords: string[] }> = [
  { id: "ministry-community", keywords: ["church", "ministry", "faith", "worship", "nonprofit", "non-profit", "community", "congregation", "charity", "volunteer", "mission"] },
  { id: "operations-dashboard", keywords: ["dashboard", "operations", "ops", "admin", "internal", "fleet", "monitor", "inventory", "analytics", "logistics", "back office", "back-office", "reporting"] },
  { id: "playful-friendly", keywords: ["kids", "child", "game", "play", "fun", "social", "friend", "teen", "family", "party", "hobby", "pet"] },
  { id: "premium-modern", keywords: ["premium", "luxury", "finance", "invest", "portfolio", "wealth", "agency", "elite", "concierge", "real estate", "crypto"] },
  { id: "professional-clean", keywords: ["saas", "b2b", "business", "clinic", "legal", "law", "consult", "clients", "enterprise", "professional", "medical", "accounting", "invoice"] }
];

export function pickThemeForIdea(text: string): Theme {
  const haystack = (text || "").toLowerCase();
  for (const matcher of MATCHERS) {
    if (matcher.keywords.some((keyword) => haystack.includes(keyword))) {
      return getTheme(matcher.id) as Theme;
    }
  }
  return getTheme(DEFAULT_THEME_ID) as Theme;
}

// Resolve the theme for a build: an explicit pick wins; "auto"/empty auto-matches.
export function resolveTheme(themeId: string | null | undefined, idea: string): Theme {
  if (themeId && themeId !== "auto") {
    const chosen = getTheme(themeId);
    if (chosen) return chosen;
  }
  return pickThemeForIdea(idea);
}

// Lightweight data for the build-flow picker (no CSS) — safe to import client-side.
export const THEME_OPTIONS = THEMES.map((theme) => ({
  id: theme.id,
  name: theme.name,
  description: theme.description,
  mode: theme.mode,
  swatch: { paper: theme.paper, panel: theme.panel, ink: theme.ink, accent: theme.accent, line: theme.line }
}));

// The generated app's full stylesheet, themed + mobile-first + touch-friendly.
export function buildThemedCss(theme: Theme): string {
  return `:root {
  --ink: ${theme.ink};
  --muted: ${theme.muted};
  --line: ${theme.line};
  --paper: ${theme.paper};
  --panel: ${theme.panel};
  --accent: ${theme.accent};
  --accent-ink: ${theme.accentInk};
  --radius: ${theme.radius};
  font-family: ${theme.font};
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; color: var(--ink); background: var(--paper); font-size: 16px; line-height: 1.55; -webkit-font-smoothing: antialiased; }
a { color: inherit; }
img { max-width: 100%; height: auto; }
.shell { width: min(1120px, 100%); margin: 0 auto; padding: 20px 16px 40px; }
.hero { min-height: 58vh; display: grid; align-content: center; }
.eyebrow, .card span { margin: 0 0 6px; color: var(--muted); font-size: .75rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
h1 { margin: 0 0 14px; font-size: clamp(1.7rem, 5vw, 3rem); line-height: 1.06; }
h2 { margin: 0 0 12px; font-size: clamp(1.3rem, 3.5vw, 2rem); line-height: 1.15; }
h3 { margin: 0; }
p, small { color: var(--ink); line-height: 1.6; }
.grid, .metric-grid { display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 18px; }
.panel-list { display: grid; gap: 10px; margin-top: 18px; }
.card, .metric-card, .wide-card { border: 1px solid var(--line); border-radius: var(--radius); padding: 16px; background: var(--panel); }
.card strong, .metric-card strong, .wide-card strong { display: block; }
.metric-card strong { font-size: 1.6rem; line-height: 1.1; }
.wide-card span, .metric-card span { display: block; margin-bottom: 6px; color: var(--muted); font-size: .75rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
.action-row { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
.button { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--line); border-radius: var(--radius); padding: 0 16px; background: var(--panel); color: var(--ink); font-weight: 700; text-decoration: none; cursor: pointer; }
.button.primary { border-color: var(--accent); color: var(--accent-ink); background: var(--accent); }
.card .button { margin-top: 10px; }
.session-note { display: inline-flex; max-width: 100%; border: 1px solid var(--line); border-radius: var(--radius); padding: 8px 10px; background: var(--panel); color: var(--muted); font-size: .9rem; }
.stack { display: grid; gap: 10px; margin-top: 14px; max-width: 560px; }
.input { width: 100%; min-height: 44px; border: 1px solid var(--line); border-radius: var(--radius); padding: 10px 12px; font: inherit; background: var(--panel); color: var(--ink); }
textarea.input { min-height: 96px; resize: vertical; }
.note { color: var(--muted); font-size: .9rem; margin: 6px 0 0; }
@media (min-width: 640px) {
  .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (min-width: 960px) {
  .shell { padding: 32px 24px 48px; }
  .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .metric-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
`;
}
