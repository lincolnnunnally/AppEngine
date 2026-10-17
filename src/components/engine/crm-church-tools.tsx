"use client";

import { useActionState, useEffect, useState } from "react";
import { logChurchVisitAction, removeChurchContactAction, saveChurchContactAction, undoDoNotContactAction, type CrmFormState } from "@/app/(cockpit)/crm/actions";
import { DROP_OFF_REST_DAYS, VISIT_REST_DAYS, type CrmCard, type CrmContact } from "@/lib/engine/lpl-crm-core";

// Church contacts and "log a visit" on a CRM card. Everyone who can open the
// desk sees names and titles. Email and phone arrive only for the owner (the
// page strips them for anyone else), and only the owner gets the save forms.
// Every save runs an owner check on the server again.

const SOURCE_LABEL: Record<CrmContact["source"], string> = {
  saved: "",
  pastor: "From the church record",
  secretary: "From the church record",
  contact: "From the church record"
};

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function todayEastern(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function Status({ state }: { state: CrmFormState }) {
  if (!state) return null;
  return (
    <p className={`crm-form-status ${state.ok ? "crm-ok-text" : "crm-warn-text"}`} role={state.ok ? "status" : "alert"}>
      {state.message}
    </p>
  );
}

function ContactForm({ churchId, contact, onDone, onCancel }: { churchId: string; contact: CrmContact | null; onDone: () => void; onCancel: () => void }) {
  const [contactId] = useState(() => contact?.id ?? newId());
  const [state, action, pending] = useActionState<CrmFormState, FormData>(saveChurchContactAction, null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  return (
    <form action={action} className="crm-form" data-testid="crm-contact-form">
      <input type="hidden" name="church_id" value={churchId} />
      <input type="hidden" name="contact_id" value={contactId} />
      <label className="crm-field">
        <span>Name</span>
        <input name="name" required maxLength={120} defaultValue={contact?.name ?? ""} autoComplete="off" />
      </label>
      <label className="crm-field">
        <span>Role (pastor, secretary, deacon…)</span>
        <input name="title" maxLength={80} defaultValue={contact?.title ?? ""} autoComplete="off" />
      </label>
      <label className="crm-field">
        <span>Email</span>
        <input name="email" type="email" maxLength={200} defaultValue={contact?.email ?? ""} autoComplete="off" />
      </label>
      <label className="crm-field">
        <span>Phone</span>
        <input name="phone" type="tel" maxLength={40} defaultValue={contact?.phone ?? ""} autoComplete="off" />
      </label>
      <div className="crm-form-actions">
        <button type="submit" className="dx-btn dx-btn--primary" disabled={pending} aria-busy={pending}>
          {pending ? "Saving…" : contact ? "Save changes" : "Save contact"}
        </button>
        <button type="button" className="dx-btn" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
      </div>
      <Status state={state} />
    </form>
  );
}

function VisitForm({ card, onDone, onCancel }: { card: CrmCard; onDone: () => void; onCancel: () => void }) {
  const [clientRef, setClientRef] = useState(() => newId());
  const [newContactId] = useState(() => newId());
  const [contactChoice, setContactChoice] = useState("");
  const [outcome, setOutcome] = useState("");
  const [state, action, pending] = useActionState<CrmFormState, FormData>(logChurchVisitAction, null);
  useEffect(() => {
    if (state?.ok) {
      setClientRef(newId());
      onDone();
    }
  }, [state, onDone]);
  const picked = card.contacts.find((contact) => contact.id === contactChoice) ?? null;
  return (
    <form action={action} className="crm-form" data-testid="crm-visit-form">
      <input type="hidden" name="church_id" value={card.churchId ?? ""} />
      <input type="hidden" name="client_ref" value={clientRef} />
      <input type="hidden" name="contact_mode" value={contactChoice === "new" ? "new" : "existing"} />
      <input type="hidden" name="contact_id" value={picked?.id ?? ""} />
      <input type="hidden" name="contact_name" value={picked?.name ?? ""} />
      <input type="hidden" name="contact_title" value={picked?.title ?? ""} />
      <input type="hidden" name="new_contact_id" value={newContactId} />
      <fieldset className="crm-field crm-choice">
        <legend>What happened</legend>
        <label>
          <input type="radio" name="kind" value="visit" defaultChecked /> I visited
        </label>
        <label>
          <input type="radio" name="kind" value="drop_off" /> I dropped something off
        </label>
      </fieldset>
      <label className="crm-field">
        <span>Day</span>
        <input name="day" type="date" required defaultValue={todayEastern()} max={todayEastern()} />
      </label>
      <label className="crm-field">
        <span>Who you met</span>
        <select value={contactChoice} onChange={(event) => setContactChoice(event.target.value)}>
          <option value="">No one in particular</option>
          {card.contacts.map((contact) => (
            <option value={contact.id} key={contact.id}>
              {contact.name}
              {contact.title ? ` (${contact.title})` : ""}
            </option>
          ))}
          <option value="new">Someone new…</option>
        </select>
      </label>
      {contactChoice === "new" ? (
        <div className="crm-form-group">
          <label className="crm-field">
            <span>Their name</span>
            <input name="new_name" required maxLength={120} autoComplete="off" />
          </label>
          <label className="crm-field">
            <span>Their role</span>
            <input name="new_title" maxLength={80} autoComplete="off" />
          </label>
          <label className="crm-field">
            <span>Email (if they gave it)</span>
            <input name="new_email" type="email" maxLength={200} autoComplete="off" />
          </label>
          <label className="crm-field">
            <span>Phone (if they gave it)</span>
            <input name="new_phone" type="tel" maxLength={40} autoComplete="off" />
          </label>
        </div>
      ) : null}
      <label className="crm-field">
        <span>What you left</span>
        <input name="left_item" maxLength={200} placeholder="A brochure, a gift, a sample…" autoComplete="off" />
      </label>
      <label className="crm-field">
        <span>How it went</span>
        <select name="outcome_code" value={outcome} onChange={(event) => setOutcome(event.target.value)}>
          <option value="">Not sure yet</option>
          <option value="interested">Interested</option>
          <option value="follow_up">Follow up</option>
          <option value="not_now">Not right now</option>
          <option value="do_not_contact">Asked not to be contacted</option>
        </select>
      </label>
      <label className="crm-field">
        <span>Notes on how it went</span>
        <input name="outcome_note" maxLength={300} autoComplete="off" />
      </label>
      {outcome === "do_not_contact" ? (
        <>
          <p className="crm-banner crm-banner--stop">
            Saving this marks the church lost and adds its emails, phones, and website to the do-not-contact list. No app will
            reach out again. You can undo it from this card.
          </p>
          <label className="crm-confirm">
            <input type="checkbox" name="confirm_dnc" value="yes" required /> <span>Yes, never contact this church</span>
          </label>
        </>
      ) : (
        <div className="crm-form-group">
          <label className="crm-field">
            <span>Next step</span>
            <input name="next_step" maxLength={200} placeholder="Call the pastor back" autoComplete="off" />
          </label>
          <label className="crm-field">
            <span>When</span>
            <input name="next_date" type="date" min={todayEastern()} />
          </label>
        </div>
      )}
      <p className="crm-dim">
        A visit lets the church rest {VISIT_REST_DAYS} days; a drop-off rests {DROP_OFF_REST_DAYS}.
      </p>
      <div className="crm-form-actions">
        <button type="submit" className="dx-btn dx-btn--primary" disabled={pending} aria-busy={pending}>
          {pending ? "Saving…" : "Save visit"}
        </button>
        <button type="button" className="dx-btn" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
      </div>
      <Status state={state} />
    </form>
  );
}

function RemoveContact({ churchId, contact, onDone, onCancel }: { churchId: string; contact: CrmContact; onDone: () => void; onCancel: () => void }) {
  const [state, action, pending] = useActionState<CrmFormState, FormData>(removeChurchContactAction, null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  return (
    <form action={action} className="crm-form crm-confirm-box" data-testid="crm-remove-contact">
      <input type="hidden" name="church_id" value={churchId} />
      <input type="hidden" name="contact_id" value={contact.id} />
      <p>Remove {contact.name} from this church? Their visits stay in the timeline.</p>
      <div className="crm-form-actions">
        <button type="submit" className="dx-btn dx-btn--danger" disabled={pending} aria-busy={pending}>
          {pending ? "Removing…" : "Yes, remove"}
        </button>
        <button type="button" className="dx-btn" onClick={onCancel} disabled={pending}>
          Keep
        </button>
      </div>
      <Status state={state} />
    </form>
  );
}

function UndoDoNotContact({ churchId }: { churchId: string }) {
  const [state, action, pending] = useActionState<CrmFormState, FormData>(undoDoNotContactAction, null);
  return (
    <form action={action} className="crm-undo" data-testid="crm-undo-dnc">
      <input type="hidden" name="church_id" value={churchId} />
      <button type="submit" className="dx-btn" disabled={pending} aria-busy={pending}>
        {pending ? "Undoing…" : "Undo do-not-contact"}
      </button>
      <Status state={state} />
    </form>
  );
}

export function ChurchTools({ card, canSave }: { card: CrmCard; canSave: boolean }) {
  const [mode, setMode] = useState<"" | "visit" | "add" | string>("");
  const [notice, setNotice] = useState("");
  const close = (message: string) => () => {
    setMode("");
    setNotice(message);
  };
  if (!card.contacts.length && !(canSave && card.churchId)) return null;
  return (
    <section className="crm-sub crm-church-tools" aria-label="People at this church">
      <h4>People</h4>
      {card.contacts.length ? (
        <ul className="crm-contacts" data-testid="crm-contacts">
          {card.contacts.map((contact) => (
            <li key={contact.id} className="crm-contact">
              <div>
                <span className="crm-contact-name">{contact.name}</span>
                {contact.title ? <span className="crm-dim"> · {contact.title}</span> : null}
                {SOURCE_LABEL[contact.source] ? <span className="crm-contact-note">{SOURCE_LABEL[contact.source]}</span> : null}
              </div>
              {/* While this contact is being edited, the form shows the phone and email; don't show them twice. */}
              {(contact.email || contact.phone) && mode !== `edit:${contact.id}` && mode !== `remove:${contact.id}` ? (
                <div className="crm-contact-links">
                  {contact.phone ? (
                    <a className="crm-contact-link" href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}>
                      {contact.phone}
                    </a>
                  ) : null}
                  {contact.email ? (
                    <a className="crm-contact-link" href={`mailto:${contact.email}`}>
                      {contact.email}
                    </a>
                  ) : null}
                </div>
              ) : null}
              {canSave && card.churchId && contact.source === "saved" ? (
                mode === `edit:${contact.id}` ? (
                  <ContactForm churchId={card.churchId} contact={contact} onDone={close("Contact saved.")} onCancel={close("")} />
                ) : mode === `remove:${contact.id}` ? (
                  <RemoveContact churchId={card.churchId} contact={contact} onDone={close(`${contact.name} removed.`)} onCancel={close("")} />
                ) : (
                  <div className="crm-contact-actions">
                    <button type="button" className="dx-btn crm-contact-edit" onClick={() => setMode(`edit:${contact.id}`)}>
                      Edit
                    </button>
                    <button type="button" className="dx-btn crm-contact-remove" onClick={() => setMode(`remove:${contact.id}`)}>
                      Remove
                    </button>
                  </div>
                )
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="crm-dim">No one saved yet.</p>
      )}
      {canSave && card.churchId ? (
        <>
          {notice && !mode ? (
            <p className="crm-form-status crm-ok-text" role="status">
              {notice}
            </p>
          ) : null}
          {mode === "add" ? <ContactForm churchId={card.churchId} contact={null} onDone={close("Contact saved.")} onCancel={close("")} /> : null}
          {mode === "visit" ? <VisitForm card={card} onDone={close("Saved. The card updates in a moment.")} onCancel={close("")} /> : null}
          {card.deskDoNotContact && !mode ? <UndoDoNotContact churchId={card.churchId} /> : null}
          {!mode ? (
            <div className="crm-actions">
              <button type="button" className="dx-btn dx-btn--primary" onClick={() => setMode("visit")}>
                Log a visit
              </button>
              <button type="button" className="dx-btn" onClick={() => setMode("add")}>
                Add a contact
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
