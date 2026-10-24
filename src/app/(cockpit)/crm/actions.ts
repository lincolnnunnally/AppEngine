"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { canAccessEngineOwner } from "@/lib/auth/access";
import type { Suggestion } from "@/lib/engine/crm-suggest-core";
import { suggestNextStep } from "@/lib/engine/crm-suggest";
import { loadAvProspects, loadCrmSnapshot, loadTechDirectorChurches, loadTopProspects } from "@/lib/engine/lpl-crm";
import type { TechDirectorRow } from "@/lib/engine/tech-director-core";
import { resolveTopProspectTier, type AvProspect, type AvTierIndex, type TopProspect, type TopProspectCounts } from "@/lib/engine/av-prospects-core";
import {
  createOrg,
  dismissLeadFromQueue,
  editOrg,
  logBusinessVisit,
  logChurchContactOutreach,
  logChurchVisit,
  logLeadContactOutreach,
  removeBusinessContact,
  removeChurchContact,
  saveBusinessContact,
  saveChurchContact,
  searchChurchesForAttach,
  attachLeadToChurch,
  undoBusinessDoNotContact,
  undoChurchDoNotContact,
  type OrgInput,
  type OrgMatch,
  type OutcomeCode,
  type VisitKind
} from "@/lib/engine/lpl-crm-write";

// Saves from the CRM desk. OWNER ONLY: every action checks the owner gate on
// the server before anything is read from the form. Admins can view the desk
// but never reach a save.

export type CrmFormState = { ok: boolean; message: string; at: number; warn?: boolean } | null;

const field = (formData: FormData, name: string) => String(formData.get(name) ?? "");

async function ownerEmail(): Promise<string> {
  const session = await auth().catch(() => null);
  return (session?.user?.email || process.env.APP_ENGINE_OWNER_EMAIL || "owner").trim().toLowerCase();
}

// The same forms serve a church and a business lead: a form carries either
// church_id (saved through ChurchConnect) or lead_id (a business lead, saved
// to op_leads / op_lead_activities). Never both.
const leadOf = (formData: FormData) => field(formData, "lead_id").trim();

const refused = (message = "Only the owner can save here."): CrmFormState => ({ ok: false, message, at: Date.now() });
const SUGGEST_OWNER_ONLY = "Only the owner can use this.";

export async function saveChurchContactAction(_prev: CrmFormState, formData: FormData): Promise<CrmFormState> {
  if (!(await canAccessEngineOwner())) return refused();
  const lead = leadOf(formData);
  const contact = {
    id: field(formData, "contact_id"),
    name: field(formData, "name"),
    title: field(formData, "title"),
    email: field(formData, "email"),
    phone: field(formData, "phone"),
    tags: field(formData, "role_tag") ? [field(formData, "role_tag")] : [],
    sourceUrl: field(formData, "source_url")
  };
  const result = lead
    ? await saveBusinessContact(await ownerEmail(), lead, contact)
    : await saveChurchContact(await ownerEmail(), field(formData, "church_id"), contact);
  if (result.ok) revalidatePath("/crm");
  return { ok: result.ok, message: result.message, at: Date.now(), warn: result.ok && result.warn === true };
}

export async function logContactOutreachAction(_prev: CrmFormState, formData: FormData): Promise<CrmFormState> {
  if (!(await canAccessEngineOwner())) return refused();
  const lead = leadOf(formData);
  const tags = field(formData, "role_tag")
    .split("|")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const input = {
    churchId: lead ? "" : field(formData, "church_id"),
    leadId: lead,
    contactId: field(formData, "contact_id"),
    name: field(formData, "name"),
    title: field(formData, "title"),
    email: field(formData, "email"),
    phone: field(formData, "phone"),
    tags,
    sourceUrl: field(formData, "source_url"),
    note: field(formData, "note"),
    day: field(formData, "day"),
    status: field(formData, "status"),
    clientRef: field(formData, "client_ref")
  };
  const result = lead ? await logLeadContactOutreach(await ownerEmail(), input) : await logChurchContactOutreach(await ownerEmail(), input);
  if (result.ok) revalidatePath("/crm");
  return { ok: result.ok, message: result.message, at: Date.now() };
}

export async function logChurchVisitAction(_prev: CrmFormState, formData: FormData): Promise<CrmFormState> {
  if (!(await canAccessEngineOwner())) return refused();
  const email = await ownerEmail();
  const lead = leadOf(formData);
  const churchId = lead ? "" : field(formData, "church_id");
  const saveContact = (input: Parameters<typeof saveChurchContact>[2]) =>
    lead ? saveBusinessContact(email, lead, input) : saveChurchContact(email, churchId, input);
  let contact: { id: string; name: string; title: string } | null = null;

  if (field(formData, "contact_mode") === "new" && field(formData, "new_name").trim()) {
    // Save the new person first, so the visit points at a real contact.
    const saved = await saveContact({
      id: field(formData, "new_contact_id"),
      name: field(formData, "new_name"),
      title: field(formData, "new_title"),
      email: field(formData, "new_email"),
      phone: field(formData, "new_phone")
    });
    if (!saved.ok) return { ok: false, message: `Not saved: ${saved.message}`, at: Date.now() };
    contact = { id: field(formData, "new_contact_id"), name: field(formData, "new_name"), title: field(formData, "new_title") };
  } else if (field(formData, "contact_name").trim()) {
    contact = { id: field(formData, "contact_id"), name: field(formData, "contact_name"), title: field(formData, "contact_title") };
  }

  const result = await (lead ? logBusinessVisit : logChurchVisit)(email, {
    churchId,
    ...(lead ? { leadId: lead } : {}),
    kind: field(formData, "kind") as VisitKind,
    day: field(formData, "day"),
    contact,
    leftItem: field(formData, "left_item"),
    outcomeCode: field(formData, "outcome_code") as OutcomeCode | "",
    outcomeNote: field(formData, "outcome_note"),
    nextStep: field(formData, "next_step"),
    nextDate: field(formData, "next_date"),
    clientRef: field(formData, "client_ref"),
    confirmDnc: field(formData, "confirm_dnc") === "yes"
  });
  revalidatePath("/crm");
  return { ok: result.ok, message: result.message, at: Date.now() };
}

export async function removeChurchContactAction(_prev: CrmFormState, formData: FormData): Promise<CrmFormState> {
  if (!(await canAccessEngineOwner())) return refused();
  const lead = leadOf(formData);
  const result = lead
    ? await removeBusinessContact(await ownerEmail(), lead, field(formData, "contact_id"))
    : await removeChurchContact(await ownerEmail(), field(formData, "church_id"), field(formData, "contact_id"));
  if (result.ok) revalidatePath("/crm");
  return { ok: result.ok, message: result.message, at: Date.now() };
}

export async function undoDoNotContactAction(_prev: CrmFormState, formData: FormData): Promise<CrmFormState> {
  if (!(await canAccessEngineOwner())) return refused();
  const lead = leadOf(formData);
  const result = lead
    ? await undoBusinessDoNotContact(await ownerEmail(), lead)
    : await undoChurchDoNotContact(await ownerEmail(), field(formData, "church_id"));
  revalidatePath("/crm");
  return { ok: result.ok, message: result.message, at: Date.now(), warn: result.ok && result.warn === true };
}

// ── Add or edit an org ─────────────────────────────────────────────────────

export type OrgFormState = { ok: boolean; message: string; at: number; matches?: OrgMatch[]; kind?: "church" | "business"; id?: string } | null;

function orgInput(formData: FormData): Partial<OrgInput> {
  return {
    kind: field(formData, "kind"),
    confirmBusiness: field(formData, "confirm_business") === "yes",
    name: field(formData, "name"),
    city: field(formData, "city"),
    state: field(formData, "state"),
    website: field(formData, "website"),
    phone: field(formData, "phone"),
    email: field(formData, "email"),
    offers: formData.getAll("offers").map((value) => String(value)),
    confirmNew: field(formData, "confirm_new") === "yes",
    version: field(formData, "org_version")
  };
}

export async function addOrgAction(_prev: OrgFormState, formData: FormData): Promise<OrgFormState> {
  if (!(await canAccessEngineOwner())) return refused();
  const result = await createOrg(await ownerEmail(), orgInput(formData));
  if (result.ok) {
    revalidatePath("/crm");
    return { ok: true, message: result.message, at: Date.now(), kind: result.kind, id: result.id };
  }
  return { ok: false, message: result.message, at: Date.now(), matches: result.matches };
}

export async function editOrgAction(_prev: OrgFormState, formData: FormData): Promise<OrgFormState> {
  if (!(await canAccessEngineOwner())) return refused();
  const kind = field(formData, "org_kind") === "business" ? "business" : "church";
  const result = await editOrg(await ownerEmail(), kind, field(formData, "org_id"), orgInput(formData));
  if (result.ok) {
    revalidatePath("/crm");
    return { ok: true, message: result.message, at: Date.now(), kind: result.kind, id: result.id };
  }
  return { ok: false, message: result.message, at: Date.now(), matches: result.matches };
}

// ── Suggested next step (slice 4) ──────────────────────────────────────────
// Owner only, suggestions only: nothing is saved or sent here. The card is
// re-read on the server (never trusted from the browser) so do-not-contact and
// rest are checked against live data before anything is asked.

export type SuggestState = { ok: boolean; message: string; at: number; suggestion?: Suggestion } | null;

export async function suggestNextStepAction(_prev: SuggestState, formData: FormData): Promise<SuggestState> {
  if (!(await canAccessEngineOwner())) return refused(SUGGEST_OWNER_ONLY);
  const key = field(formData, "card_key").trim().slice(0, 200);
  const snapshot = await loadCrmSnapshot().catch(() => null);
  const card = snapshot?.cards.find((item) => item.key === key);
  if (!snapshot || !card) return { ok: false, message: "Suggestions aren't available right now.", at: Date.now() };
  const result = await suggestNextStep(card, snapshot.outreachHidden);
  if (result.ok) return { ok: true, message: "", at: Date.now(), suggestion: result.suggestion };
  return { ok: false, message: result.message, at: Date.now() };
}

// ── AV prospects (Messenger AVL kit) ───────────────────────────────────────
// Owner only, read only: a ranked list of churches that may want help with
// sound, video, lighting or streaming. Nothing is saved or sent.

export type AvProspectState = {
  ok: boolean;
  message: string;
  at: number;
  prospects?: AvProspect[];
  directors?: TechDirectorRow[];
  read?: number;
} | null;

export async function loadAvProspectsAction(_prev: AvProspectState, formData: FormData): Promise<AvProspectState> {
  if (!(await canAccessEngineOwner())) return refused(SUGGEST_OWNER_ONLY);
  if (field(formData, "tech") === "1") {
    const list = await loadTechDirectorChurches().catch(() => null);
    if (!list) return { ok: false, message: "Churches couldn't be read just now. Try again in a minute.", at: Date.now() };
    if (!list.ok) return { ok: false, message: list.message, at: Date.now() };
    return { ok: true, message: "", at: Date.now(), directors: list.rows, read: list.read };
  }
  const list = await loadAvProspects().catch(() => null);
  if (!list) return { ok: false, message: "Churches couldn't be read just now. Try again in a minute.", at: Date.now() };
  if (!list.ok) return { ok: false, message: list.message, at: Date.now() };
  return { ok: true, message: "", at: Date.now(), prospects: list.prospects, read: list.read };
}

// ── Top prospects (second mode of the AV core) ─────────────────────────────
// Owner only, read only. Nothing is saved or sent.

export type TopProspectState = {
  ok: boolean;
  message: string;
  at: number;
  tier?: AvTierIndex;
  open?: TopProspect[];
  won?: TopProspect[];
  counts?: TopProspectCounts;
} | null;

export type ChurchPickState = { ok: boolean; message: string; at: number; churches?: { id: string; name: string; town: string }[] } | null;

export async function searchChurchesAction(_prev: ChurchPickState, formData: FormData): Promise<ChurchPickState> {
  if (!(await canAccessEngineOwner())) return refused();
  const result = await searchChurchesForAttach(field(formData, "church_query"), {
    city: field(formData, "lead_city"),
    state: field(formData, "lead_state")
  });
  if (!result.ok) return { ok: false, message: result.message, at: Date.now(), churches: [] };
  return {
    ok: true,
    message: result.churches.length ? "" : "No church with that name is on file.",
    at: Date.now(),
    churches: result.churches
  };
}

export async function attachLeadAction(_prev: CrmFormState, formData: FormData): Promise<CrmFormState> {
  if (!(await canAccessEngineOwner())) return refused();
  const result = await attachLeadToChurch(await ownerEmail(), field(formData, "lead_id"), field(formData, "attach_church_id"), field(formData, "client_ref"));
  if (result.ok) revalidatePath("/crm");
  return { ok: result.ok, message: result.message, at: Date.now() };
}

export async function dismissLeadAction(_prev: CrmFormState, formData: FormData): Promise<CrmFormState> {
  if (!(await canAccessEngineOwner())) return refused();
  const result = await dismissLeadFromQueue(await ownerEmail(), field(formData, "lead_id"), field(formData, "client_ref"));
  if (result.ok) revalidatePath("/crm");
  return { ok: result.ok, message: result.message, at: Date.now() };
}

export async function loadTopProspectsAction(_prev: TopProspectState, formData: FormData): Promise<TopProspectState> {
  if (!(await canAccessEngineOwner())) return refused(SUGGEST_OWNER_ONLY);
  const resolved = resolveTopProspectTier(field(formData, "tier") || null);
  if (!resolved.ok) return { ok: false, message: resolved.detail, at: Date.now() };
  const tier = resolved.tier;
  const list = await loadTopProspects(tier).catch(() => null);
  if (!list) return { ok: false, message: "Churches couldn't be read just now. Try again in a minute.", at: Date.now(), tier };
  if (!list.ok) return { ok: false, message: list.message, at: Date.now(), tier };
  return { ok: true, message: "", at: Date.now(), tier, open: list.open, won: list.won, counts: list.counts };
}
