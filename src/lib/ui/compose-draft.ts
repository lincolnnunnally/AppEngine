const KEY = "ae-compose-draft";

export type ComposeDraft = {
  idea: string;
  summary: string;
  featureIds?: string[];
  themeId?: string;
  accentColor?: string;
  logoUrl?: string;
};

export function saveComposeDraft(draft: ComposeDraft) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // Private mode can block storage; sign-in still works, pack just has to be described again.
  }
}

export function readComposeDraft(): ComposeDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ComposeDraft;
    if (!parsed?.idea || typeof parsed.idea !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearComposeDraft() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export function safeNextPath(value?: string | string[] | null): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/signin")) {
    return "/";
  }
  return raw;
}
