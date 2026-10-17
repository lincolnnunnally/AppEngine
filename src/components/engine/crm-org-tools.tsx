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

function Matches({ matches, onOpen, allowNew }: { matches: Match[]; onOpen: (match: Match) => void; allowNew: boolean }) {
  return (
    <div className="crm-matches" data-testid="crm-org-matches">
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
            <button type="button" className="dx-btn" onClick={() => onOpen(match)}>
              Open it
            </button>
          </li>
        ))}
      </ul>
      {allowNew ? (
        <label className="crm-confirm">
          <input type="checkbox" name="confirm_new" value="yes" />
          <span>None of these. It&apos;s a different one.</span>
        </label>
      ) : null}
    </div>
  );
}

function OrgFields({ kind, org, kindLocked, onName }: { kind: OrgKind | "unsure"; org: CrmOrg | null; kindLocked: boolean; onName?: (value: string) => void }) {
  const offerKind: OrgKind = kind === "business" ? "business" : "church";
  return (
    <>
      <label className="crm-field">
        <span>Name</span>
        <input name="name" required maxLength={160} defaultValue={org?.name ?? ""} autoComplete="off" onInput={onName ? (event) => onName(event.currentTarget.value) : undefined} />
      </label>
      <div className="crm-form-group">
        <label className="crm-field">
          <span>Town</span>
          <input name="city" required maxLength={80} defaultValue={org?.city ?? ""} autoComplete="off" />
        </label>
        <label className="crm-field">
          <span>State</span>
          <input name="state" maxLength={40} defaultValue={org?.state ?? "GA"} autoComplete="off" />
        </label>
        <label className="crm-field">
          <span>Website</span>
          <input name="website" maxLength={300} defaultValue={org?.website ?? ""} autoComplete="off" inputMode="url" />
        </label>
        <label className="crm-field">
          <span>Phone</span>
          <input name="phone" type="tel" maxLength={40} defaultValue={org?.phone ?? ""} autoComplete="off" />
        </label>
        <label className="crm-field">
          <span>Email</span>
          <input name="email" type="email" maxLength={200} defaultValue={org?.email ?? ""} autoComplete="off" />
        </label>
      </div>
      {/* key: switching church/business clears the picks, so a business app can't ride along to a church. */}
      <fieldset className="crm-field crm-choice crm-offers" key={offerKind} data-testid="crm-org-offers">
        <legend>{offerKind === "church" ? "Apps for this church" : "Apps for this business"}</legend>
        {offerChoices(offerKind).map((choice) => (
          <label key={choice.id}>
            <input type="checkbox" name="offers" value={choice.id} defaultChecked={!kindLocked ? false : Boolean(org?.offers.includes(choice.id))} />
            {choice.label}
          </label>
        ))}
      </fieldset>
    </>
  );
}

/** "Add a church or business" — top of the cards list. */
export function AddOrg({ onOpen }: { onOpen: (match: { kind: OrgKind; id: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<OrgKind | "unsure">("church");
  const [name, setName] = useState("");
  const [state, action, pending] = useActionState<OrgFormState, FormData>(addOrgAction, null);
  const [formKey, setFormKey] = useState(0);
  const [lastAdded, setLastAdded] = useState<{ kind: OrgKind; id: string; message: string } | null>(null);

  useEffect(() => {
    if (state?.ok && state.kind && state.id) {
      setLastAdded({ kind: state.kind, id: state.id, message: state.message });
      setOpen(false);
      setFormKey((value) => value + 1);
      setKind("church");
      setName("");
    }
  }, [state]);

  const churchy = kind === "business" && looksLikeChurch(name);
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
        <form action={action} className="crm-form" data-testid="crm-add-org-form" key={formKey}>
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
          <OrgFields kind={kind} org={null} kindLocked={false} onName={setName} />
          {churchy ? (
            <label className="crm-confirm">
              <input type="checkbox" name="confirm_business" value="yes" />
              <span>Yes, this is a business, not a church</span>
            </label>
          ) : null}
          <p className="crm-dim">
            {kind === "business"
              ? "Saved as a business lead. Nothing is sent to anyone."
              : "Saved in ChurchConnect, hidden from the public directory until it's real. Nothing is sent to anyone."}
          </p>
          {matches.length ? <Matches matches={matches} onOpen={onOpen} allowNew={!hard} /> : null}
          <div className="crm-form-actions">
            <button type="submit" className="dx-btn dx-btn--primary" disabled={pending} aria-busy={pending}>
              {pending ? "Checking…" : matches.length && !hard ? "Add anyway" : "Check and add"}
            </button>
            <button type="button" className="dx-btn" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </button>
          </div>
          <Status state={state} />
        </form>
      )}
    </div>
  );
}

/** Org basics and picked apps on a card; the owner can edit them. */
export function OrgTools({ card, canSave, onOpen }: { card: CrmCard; canSave: boolean; onOpen: (match: { kind: OrgKind; id: string }) => void }) {
  const org = card.org;
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const [state, action, pending] = useActionState<OrgFormState, FormData>(editOrgAction, null);
  useEffect(() => {
    if (state?.ok) {
      setEditing(false);
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
      <h4>{org.kind === "church" ? "Apps for this church" : "Apps for this business"}</h4>
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
            <p className="crm-dim">{KIND_LABEL[org.kind]}</p>
            <OrgFields kind={org.kind} org={org} kindLocked />
            {matches.length ? <Matches matches={matches} onOpen={onOpen} allowNew={!hard} /> : null}
            <div className="crm-form-actions">
              <button type="submit" className="dx-btn dx-btn--primary" disabled={pending} aria-busy={pending}>
                {pending ? "Saving…" : matches.length && !hard ? "Save anyway" : "Save details"}
              </button>
              <button type="button" className="dx-btn" onClick={() => setEditing(false)} disabled={pending}>
                Cancel
              </button>
            </div>
            <Status state={state} />
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
