"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { canAccessEngineOwner } from "@/lib/auth/access";
import { logChurchVisit, saveChurchContact, type OutcomeCode, type VisitKind } from "@/lib/engine/lpl-crm-write";

// Saves from the CRM desk. OWNER ONLY: every action checks the owner gate on
// the server before anything is read from the form. Admins can view the desk
// but never reach a save.

export type CrmFormState = { ok: boolean; message: string; at: number } | null;

const field = (formData: FormData, name: string) => String(formData.get(name) ?? "");

async function ownerEmail(): Promise<string> {
  const session = await auth().catch(() => null);
  return (session?.user?.email || process.env.APP_ENGINE_OWNER_EMAIL || "owner").trim().toLowerCase();
}

const refused = (): CrmFormState => ({ ok: false, message: "Only the owner can save here.", at: Date.now() });

export async function saveChurchContactAction(_prev: CrmFormState, formData: FormData): Promise<CrmFormState> {
  if (!(await canAccessEngineOwner())) return refused();
  const result = await saveChurchContact(await ownerEmail(), field(formData, "church_id"), {
    id: field(formData, "contact_id"),
    name: field(formData, "name"),
    title: field(formData, "title"),
    email: field(formData, "email"),
    phone: field(formData, "phone")
  });
  if (result.ok) revalidatePath("/crm");
  return { ok: result.ok, message: result.message, at: Date.now() };
}

export async function logChurchVisitAction(_prev: CrmFormState, formData: FormData): Promise<CrmFormState> {
  if (!(await canAccessEngineOwner())) return refused();
  const email = await ownerEmail();
  const churchId = field(formData, "church_id");
  let contact: { id: string; name: string; title: string } | null = null;

  if (field(formData, "contact_mode") === "new" && field(formData, "new_name").trim()) {
    // Save the new person first, so the visit points at a real contact.
    const saved = await saveChurchContact(email, churchId, {
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

  const result = await logChurchVisit(email, {
    churchId,
    kind: field(formData, "kind") as VisitKind,
    day: field(formData, "day"),
    contact,
    leftItem: field(formData, "left_item"),
    outcomeCode: field(formData, "outcome_code") as OutcomeCode | "",
    outcomeNote: field(formData, "outcome_note"),
    nextStep: field(formData, "next_step"),
    nextDate: field(formData, "next_date"),
    clientRef: field(formData, "client_ref")
  });
  revalidatePath("/crm");
  return { ok: result.ok, message: result.message, at: Date.now() };
}
