"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { canAccessEngineOwner } from "@/lib/auth/access";
import {
  createOrg,
  editOrg,
  logBusinessVisit,
  logChurchVisit,
  removeBusinessContact,
  removeChurchContact,
  saveBusinessContact,
  saveChurchContact,
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

export type CrmFormState = { ok: boolean; message: string; at: number } | null;

const field = (formData: FormData, name: string) => String(formData.get(name) ?? "");

async function ownerEmail(): Promise<string> {
  const session = await auth().catch(() => null);
  return (session?.user?.email || process.env.APP_ENGINE_OWNER_EMAIL || "owner").trim().toLowerCase();
}

// The same forms serve a church and a business lead: a form carries either
// church_id (saved through ChurchConnect) or lead_id (a business lead, saved
// to op_leads / op_lead_activities). Never both.
const leadOf = (formData: FormData) => field(formData, "lead_id").trim();

const refused = (): CrmFormState => ({ ok: false, message: "Only the owner can save here.", at: Date.now() });

export async function saveChurchContactAction(_prev: CrmFormState, formData: FormData): Promise<CrmFormState> {
  if (!(await canAccessEngineOwner())) return refused();
  const lead = leadOf(formData);
  const contact = {
    id: field(formData, "contact_id"),
    name: field(formData, "name"),
    title: field(formData, "title"),
    email: field(formData, "email"),
    phone: field(formData, "phone")
  };
  const result = lead
    ? await saveBusinessContact(await ownerEmail(), lead, contact)
    : await saveChurchContact(await ownerEmail(), field(formData, "church_id"), contact);
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
  return { ok: result.ok, message: result.message, at: Date.now() };
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
    confirmNew: field(formData, "confirm_new") === "yes"
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
