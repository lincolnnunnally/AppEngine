"use client";

import { useActionState, useEffect, useState } from "react";
import { addOrgAction, editOrgAction, type OrgFormState } from "@/app/(cockpit)/crm/actions";
import { BUSINESS_OFFERS, CHURCH_ALLOWED_OFFERS, offerChoices } from "@/lib/engine/church-offer-rule";
import { looksLikeChurch, type CrmCard, type CrmOrg, type OrgKind } from "@/lib/engine/lpl-crm-core";
import { Status } from "@/components/engine/crm-church-tools";

// Add a church or business, and edit an org's basics and picked apps. OWNER
// ONLY (the desk shows these only when the owner can save, and every save
// checks the owner again on the server). Adding always looks for the same
// name + town, website, phone, or email first and offers to open that one.
// A church only ever sees the church choices; "Not sure" is saved as a church.

type Match = NonNullable<NonNullable<OrgFormState>["matches"]>[number];

const KIND_LABEL: Record<OrgKind, string> = { church: "ChurchConnect church", business: "Business lead" };

export function offerLabel(kind: OrgKind, id: string): string {
  const list: Record<string, string> = kind === "church" ? CHURCH_ALLOWED_OFFERS : BUSINESS_OFFERS;
  return list[id] ?? "";
}

function Matches({
  matches,
  onOpen,
  allowNew,
  confirmNew,
  setConfirmNew
}: {
  matches: Match[];
  onOpen: (match: Match) => void;
  allowNew: boolean;
  confirmNew: boolean;
  setConfirmNew: (value: boolean) => void;
}) {
  const hardMatch = matches.find((match) => match.hard);
  const town = (hardMatch?.town ?? "").split(",")[0].trim();
  // One message, at the top of the box. (The form's own status line is hidden while matches show.)
  const headline = hardMatch
    ? `${hardMatch.name}${town ? ` in ${town}` : ""} is already here.`
    : "This might already be here. Open it, or tick that it's a different one.";
  return (
    <div className="crm-matches" data-testid="crm-org-matches" role="alert">
      <p className="crm-matches-head">{headline}</p>
      <ul className="crm-list">
        {matches.map((match) => (
          <li key={`${match.kind}-${match.id}`}>
            <span>
              <strong>{match.name}</strong>
              {match.town ? ` (${match.town})` : ""}
              <span className="crm-dim">
                {" "}
                · {KIND_LABEL[match.kind]} · {match.why.join(", ")}
              </span>
            </span>
            <button type="button" className="dx-btn dx-btn--primary" onClick={() => onOpen(match)}>
              Open it
            </button>
          </li>
        ))}
      </ul>
      {allowNew ? (
        <label className="crm-confirm">
          <input type="checkbox" name="confirm_new" value="yes" checked={confirmNew} onChange={(event) => setConfirmNew(event.target.checked)} />
          <span>None of these. It&apos;s a different one.</span>
        </label>
      ) : null}
    </div>
  );
}

type Draft = { name: string; city: string; state: string; website: string; phone: string; email: string; offers: string[] };

function draftOf(org: CrmOrg | null): Draft {
  return {
    name: org?.name ?? "",
    city: org?.city ?? "",
    state: org?.state || "GA",
    website: org?.website ?? "",
    phone: org?.phone ?? "",
    email: org?.email ?? "",
    offers: org ? [...org.offers] : []
  };
}

const FIELDS: Array<{ key: keyof Omit<Draft, "offers">; label: string; type?: string; max: number; required?: boolean; mode?: "url" }> = [
  { key: "city", label: "Town", max: 80, required: true },
  { key: "state", label: "State", max: 40 },
  { key: "website", label: "Website", max: 300, mode: "url" },
  { key: "phone", label: "Phone", type: "tel", max: 40 },
  { key: "email", label: "Email", type: "email", max: 200 }
];

// Controlled on purpose: a form action resets plain inputs after each submit,
// and the owner must not lose what they typed when the match check answers.
function OrgFields({ kind, draft, setDraft }: { kind: OrgKind | "unsure"; draft: Draft; setDraft: (next: Draft) => void }) {
  const offerKind: OrgKind = kind === "business" ? "business" : "church";
  const set = (key: keyof Draft, value: string) => setDraft({ ...draft, [key]: value });
  const toggle = (id: string, on: boolean) => setDraft({ ...draft, offers: on ? [...new Set([...draft.offers, id])] : draft.offers.filter((item) => item !== id) });
  return (
    <>
      <label className="crm-field">
        <span>Name (required)</span>
        <input name="name" required maxLength={160} value={draft.name} onChange={(event) => set("name", event.target.value)} autoComplete="off" />
      </label>
      <div className="crm-form-group">
        {FIELDS.map((field) => (
          <label className="crm-field" key={field.key}>
            <span>
              {field.label}
              {field.required ? " (required)" : ""}
            </span>
            <input
              name={field.key}
              type={field.type ?? "text"}
              required={field.required}
              maxLength={field.max}
              inputMode={field.mode}
              value={draft[field.key]}
              onChange={(event) => set(field.key, event.target.value)}
              autoComplete="off"
            />
          </label>
        ))}
      </div>
      <fieldset className="crm-field crm-choice crm-offers" data-testid="crm-org-offers">
        <legend>{offerKind === "church" ? "Apps for this church" : "Apps for this business"}</legend>
        {offerChoices(offerKind).map((choice) => (
          <label key={choice.id} className={choice.hint ? "crm-offer-with-hint" : undefined}>
            <input type="checkbox" name="offers" value={choice.id} checked={draft.offers.includes(choice.id)} onChange={(event) => toggle(choice.id, event.target.checked)} />
            <span>
              {choice.label}
              {choice.hint ? <span className="crm-offer-hint">{choice.hint}</span> : null}
            </span>
          </label>
        ))}
      </fieldset>
    </>
  );
}

/** "Add a church or business" — top of the cards list. */
export function AddOrg({ onOpen }: { onOpen: (match: { kind: OrgKind; id: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [kind, setKindRaw] = useState<OrgKind | "unsure">("church");
  const [draft, setDraft] = useState<Draft>(() => draftOf(null));
  const [confirmBusiness, setConfirmBusiness] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [state, action, pending] = useActionState<OrgFormState, FormData>(addOrgAction, null);
  // Switching church ↔ business clears the app picks, so a business app can't ride along to a church.
  const setKind = (next: OrgKind | "unsure") => {
    if ((next === "business") !== (kind === "business")) setDraft((current) => ({ ...current, offers: [] }));
    setKindRaw(next);
  };
  const [lastAdded, setLastAdded] = useState<{ kind: OrgKind; id: string; message: string } | null>(null);

  useEffect(() => {
    if (state?.ok && state.kind && state.id) {
      setLastAdded({ kind: state.kind, id: state.id, message: state.message });
      setOpen(false);
      setKindRaw("church");
      setDraft(draftOf(null));
      setConfirmBusiness(false);
      setConfirmNew(false);
    }
  }, [state]);

  const churchy = kind === "business" && looksLikeChurch(draft.name);
  const matches = !state?.ok ? state?.matches ?? [] : [];
  const hard = matches.some((match) => match.hard);

  return (
    <div className="crm-add-org">
      {lastAdded && !open ? (
        <p className="crm-form-status crm-ok-text" role="status">
          {lastAdded.message}{" "}
          <button type="button" className="crm-link-btn" onClick={() => onOpen(lastAdded)}>
            Open it
          </button>
        </p>
      ) : null}
      {!open ? (
        <button type="button" className="dx-btn dx-btn--primary" onClick={() => setOpen(true)} data-testid="crm-add-org">
          Add a church or business
        </button>
      ) : (
        <form action={action} className="crm-form" data-testid="crm-add-org-form">
          <fieldset className="crm-field crm-choice">
            <legend>What is it?</legend>
            {(["church", "business", "unsure"] as const).map((value) => (
              <label key={value}>
                <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} />
                {value === "church" ? "Church" : value === "business" ? "Business" : "Not sure"}
              </label>
            ))}
          </fieldset>
          {kind === "unsure" ? <p className="crm-dim">Not sure is saved as a church, with church apps only.</p> : null}
          <OrgFields kind={kind} draft={draft} setDraft={setDraft} />
          {churchy ? <p className="crm-churchy-note">This name sounds like a church. Tick to confirm it&apos;s a business.</p> : null}
          {churchy ? (
            <label className="crm-confirm">
              <input type="checkbox" name="confirm_business" value="yes" checked={confirmBusiness} onChange={(event) => setConfirmBusiness(event.target.checked)} />
              <span>Yes, this is a business, not a church</span>
            </label>
          ) : null}
          <p className="crm-dim">
            {kind === "business"
              ? "Saved as a business lead. Nothing is sent to anyone."
              : "Saved in ChurchConnect, hidden from the public directory until it's real. Nothing is sent to anyone."}
          </p>
          {matches.length ? <Matches matches={matches} onOpen={onOpen} allowNew={!hard} confirmNew={confirmNew} setConfirmNew={setConfirmNew} /> : null}
          <div className="crm-form-actions">
            {/* Same name + town: no way to add it again. A weaker match: "Add anyway" only after the tick. */}
            {hard ? null : (
              <button type="submit" className="dx-btn dx-btn--primary" disabled={pending || (matches.length > 0 && !confirmNew)} aria-busy={pending}>
                {pending ? "Checking…" : matches.length ? "Add anyway" : "Check and add"}
              </button>
            )}
            <button type="button" className="dx-btn" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </button>
          </div>
          {matches.length ? null : <Status state={state} />}
        </form>
      )}
    </div>
  );
}

/** Org basics and picked apps on a card; the owner can edit them. */
export function OrgTools({ card, canSave, onOpen }: { card: CrmCard; canSave: boolean; onOpen: (match: { kind: OrgKind; id: string }) => void }) {
  const org = card.org;
  const [editing, setEditingRaw] = useState(false);
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState<Draft>(() => draftOf(org));
  const [confirmNew, setConfirmNew] = useState(false);
  const [state, action, pending] = useActionState<OrgFormState, FormData>(editOrgAction, null);
  const setEditing = (on: boolean) => {
    if (on) {
      setDraft(draftOf(org));
      setConfirmNew(false);
    }
    setEditingRaw(on);
  };
  useEffect(() => {
    if (state?.ok) {
      setEditingRaw(false);
      setNotice(state.message);
    }
  }, [state]);
  if (!org) return null;
  const picked = org.offers.map((id) => offerLabel(org.kind, id)).filter(Boolean);
  if (!picked.length && !canSave) return null;
  const matches = !state?.ok ? state?.matches ?? [] : [];
  const hard = matches.some((match) => match.hard);
  return (
    <section className="crm-sub crm-org-tools" aria-label="Apps picked">
      {/* While editing, the form has its own heading so it doesn't sit under "Apps for this church". */}
      <h4>{editing ? "Edit details and apps" : org.kind === "church" ? "Apps for this church" : "Apps for this business"}</h4>
      {!editing ? (
        picked.length ? (
          <div className="crm-pills crm-offer-pills" data-testid="crm-org-picked">
            {picked.map((label) => (
              <span className="crm-pill crm-pill--offer" key={label}>
                {label}
              </span>
            ))}
          </div>
        ) : (
          <p className="crm-dim">None picked yet.</p>
        )
      ) : null}
      {canSave ? (
        editing ? (
          <form action={action} className="crm-form" data-testid="crm-edit-org-form">
            <input type="hidden" name="org_kind" value={org.kind} />
            <input type="hidden" name="org_id" value={org.id} />
            <OrgFields kind={org.kind} draft={draft} setDraft={setDraft} />
            {matches.length ? <Matches matches={matches} onOpen={onOpen} allowNew={!hard} confirmNew={confirmNew} setConfirmNew={setConfirmNew} /> : null}
            <div className="crm-form-actions">
              {hard ? null : (
                <button type="submit" className="dx-btn dx-btn--primary" disabled={pending || (matches.length > 0 && !confirmNew)} aria-busy={pending}>
                  {pending ? "Saving…" : matches.length ? "Save anyway" : "Save details"}
                </button>
              )}
              <button type="button" className="dx-btn" onClick={() => setEditing(false)} disabled={pending}>
                Cancel
              </button>
            </div>
            {matches.length ? null : <Status state={state} />}
          </form>
        ) : (
          <>
            {notice ? (
              <p className="crm-form-status crm-ok-text" role="status">
                {notice}
              </p>
            ) : null}
            <div className="crm-actions">
              <button type="button" className="dx-btn" onClick={() => setEditing(true)} data-testid="crm-edit-org">
                Edit details and apps
              </button>
            </div>
          </>
        )
      ) : null}
    </section>
  );
}
