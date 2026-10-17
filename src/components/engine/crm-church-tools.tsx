"use client";

import { useActionState, useEffect, useState, useSyncExternalStore } from "react";
import { logChurchVisitAction, removeChurchContactAction, saveChurchContactAction, undoDoNotContactAction, type CrmFormState } from "@/app/(cockpit)/crm/actions";
import { DROP_OFF_REST_DAYS, VISIT_REST_DAYS, type CrmCard, type CrmContact } from "@/lib/engine/lpl-crm-core";

// Contacts and "log a visit" on a CRM card, for a ChurchConnect church or a
// business lead (the same forms; the form carries church_id or lead_id and the
// server picks the writer). Everyone who can open the
// desk sees names and titles. Email and phone arrive only for the owner (the
// page strips them for anyone else), and only the owner gets the save forms.
// Every save runs an owner check on the server again.

const SOURCE_LABEL: Record<CrmContact["source"], string> = {
  saved: "",
  pastor: "From the church record",
  secretary: "From the church record",
  contact: "From the church record"
};

/** Where this card's saves go: a ChurchConnect church, or a business lead. */
export type SaveTarget = { field: "church_id" | "lead_id"; id: string; noun: "church" | "business" };

export function saveTargetOf(card: Pick<CrmCard, "churchId" | "leadId">): SaveTarget | null {
  if (card.churchId) return { field: "church_id", id: card.churchId, noun: "church" };
  if (card.leadId) return { field: "lead_id", id: card.leadId, noun: "business" };
  return null;
}

// Confirmations ("Visit saved.", "Undone. …") live outside the card, keyed by
// the org, so they stay on screen when the saved card re-renders or moves to
// another part of the desk. They clear when the owner starts something else.
export type CardNotice = { message: string; warn: boolean };
const notices = new Map<string, CardNotice>();
const noticeListeners = new Set<() => void>();
function setNoticeFor(key: string, message: string, warn = false) {
  if (message) notices.set(key, { message, warn });
  else notices.delete(key);
  for (const listener of noticeListeners) listener();
}
function subscribeNotices(listener: () => void) {
  noticeListeners.add(listener);
  return () => {
    noticeListeners.delete(listener);
  };
}
function useNotice(key: string): [CardNotice | null, (message: string) => void] {
  const notice = useSyncExternalStore(subscribeNotices, () => notices.get(key) ?? null, () => null);
  return [notice, (next: string) => setNoticeFor(key, next)];
}

// "Use this" on a suggested next step opens this card's Log a visit form with the
// next step and date filled in. Nothing is saved until the owner taps Save.
export type VisitDraft = { nextStep: string; nextDate: string };
const drafts = new Map<string, VisitDraft>();
const draftListeners = new Set<() => void>();
export function offerVisitDraft(key: string, draft: VisitDraft | null) {
  if (draft) drafts.set(key, draft);
  else drafts.delete(key);
  for (const listener of draftListeners) listener();
}
function subscribeDrafts(listener: () => void) {
  draftListeners.add(listener);
  return () => {
    draftListeners.delete(listener);
  };
}
function useDraft(key: string): VisitDraft | null {
  return useSyncExternalStore(subscribeDrafts, () => drafts.get(key) ?? null, () => null);
}
export function saveKeyOf(target: SaveTarget | null): string {
  return target ? `${target.field}:${target.id}` : "none";
}

/** Under every save form on a card: what saving does and doesn't do. */
export function CrmOnlyNote() {
  return <p className="crm-dim crm-crm-only">Saved to your CRM only. Nothing is sent to anyone.</p>;
}

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function todayEastern(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function Status({ state }: { state: CrmFormState }) {
  if (!state) return null;
  return (
    <p className={`crm-form-status ${state.ok ? "crm-ok-text" : "crm-warn-text"}`} role={state.ok ? "status" : "alert"}>
      {state.message}
    </p>
  );
}

function ContactForm({ target, contact, onDone, onCancel }: { target: SaveTarget; contact: CrmContact | null; onDone: () => void; onCancel: () => void }) {
  const [contactId] = useState(() => contact?.id ?? newId());
  const [state, action, pending] = useActionState<CrmFormState, FormData>(saveChurchContactAction, null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  return (
    <form action={action} className="crm-form" data-testid="crm-contact-form">
      <input type="hidden" name={target.field} value={target.id} />
      <input type="hidden" name="contact_id" value={contactId} />
      <label className="crm-field">
        <span>Name</span>
        <input name="name" required maxLength={120} defaultValue={contact?.name ?? ""} autoComplete="off" />
      </label>
      <label className="crm-field">
        <span>{target.noun === "church" ? "Role (pastor, secretary, deacon…)" : "Role (owner, manager…)"}</span>
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
      <CrmOnlyNote />
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

/** Next step: a one-line-looking box that grows to show the whole step (a suggestion can be long). Same name, length and value as before. */
function NextStepField({ defaultValue, placeholder }: { defaultValue: string; placeholder: string }) {
  const fit = (box: HTMLTextAreaElement | null) => {
    if (!box) return;
    box.style.height = "auto";
    box.style.height = `${box.scrollHeight + 2}px`;
  };
  return (
    <textarea
      name="next_step"
      className="crm-next-step"
      rows={1}
      maxLength={200}
      defaultValue={defaultValue}
      placeholder={placeholder}
      autoComplete="off"
      ref={fit}
      onInput={(event) => fit(event.currentTarget)}
      onKeyDown={(event) => {
        // One line of text: Enter submits like the old input did, instead of adding a line break.
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          const save = event.currentTarget.form?.querySelector<HTMLButtonElement>('button[type="submit"]');
          // Same as Enter in a text input: only when Save is enabled (not while saving).
          if (save && !save.disabled) event.currentTarget.form?.requestSubmit(save);
        }
      }}
    />
  );
}

function VisitForm({
  card,
  target,
  draft,
  onDone,
  onCancel
}: {
  card: CrmCard;
  target: SaveTarget;
  draft?: VisitDraft | null;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [clientRef, setClientRef] = useState(() => newId());
  const [newContactId] = useState(() => newId());
  const [contactChoice, setContactChoice] = useState("");
  const [outcome, setOutcome] = useState("");
  const [kind, setKind] = useState<"visit" | "drop_off">("visit");
  // Do-not-contact: Save stays off until the tick, the same way "Add anyway" waits for its tick.
  const [confirmed, setConfirmed] = useState(false);
  const stopping = outcome === "do_not_contact";
  // The confirmation is handed over as soon as the server answers, inside the action itself:
  // the same answer re-renders the card, which can unmount this form before an effect would run.
  const [state, action, pending] = useActionState<CrmFormState, FormData>(async (prev, formData) => {
    const result = await logChurchVisitAction(prev, formData);
    if (result?.ok) {
      setClientRef(newId());
      onDone(result.message);
    }
    return result;
  }, null);
  const picked = card.contacts.find((contact) => contact.id === contactChoice) ?? null;
  return (
    <form action={action} className="crm-form" data-testid="crm-visit-form">
      <input type="hidden" name={target.field} value={target.id} />
      <input type="hidden" name="client_ref" value={clientRef} />
      <input type="hidden" name="contact_mode" value={contactChoice === "new" ? "new" : "existing"} />
      <input type="hidden" name="contact_id" value={picked?.id ?? ""} />
      <input type="hidden" name="contact_name" value={picked?.name ?? ""} />
      <input type="hidden" name="contact_title" value={picked?.title ?? ""} />
      <input type="hidden" name="new_contact_id" value={newContactId} />
      <fieldset className="crm-field crm-choice">
        <legend>What happened</legend>
        <label>
          <input type="radio" name="kind" value="visit" checked={kind === "visit"} onChange={() => setKind("visit")} /> I visited
        </label>
        <label>
          <input type="radio" name="kind" value="drop_off" checked={kind === "drop_off"} onChange={() => setKind("drop_off")} /> I dropped something off
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
        <input name="left_item" maxLength={200} placeholder={target.noun === "church" ? "A brochure, a gift, a sample…" : "A Laser sample, a card, a brochure…"} autoComplete="off" />
      </label>
      <label className="crm-field">
        <span>How it went</span>
        <select
          name="outcome_code"
          value={outcome}
          onChange={(event) => {
            setOutcome(event.target.value);
            setConfirmed(false);
          }}
        >
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
      {stopping ? (
        <>
          <p className="crm-banner crm-banner--stop">
            {target.noun === "church" ? "Saving this marks the church lost" : "Saving this marks the business do-not-contact"} and adds its emails, phones,
            and website to the do-not-contact list. No app will reach out again. You can undo it from this card.
          </p>
          <label className="crm-confirm">
            <input type="checkbox" name="confirm_dnc" value="yes" required checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />{" "}
            <span>Yes, never contact this {target.noun}</span>
          </label>
        </>
      ) : (
        <div className="crm-form-group">
          <label className="crm-field">
            <span>Next step</span>
            <NextStepField defaultValue={draft?.nextStep ?? ""} placeholder={target.noun === "church" ? "Call the pastor back" : "Call the owner back"} />
          </label>
          <label className="crm-field">
            <span>When</span>
            <input name="next_date" type="date" min={todayEastern()} defaultValue={draft?.nextDate ?? ""} />
          </label>
        </div>
      )}
      {draft ? <p className="crm-dim crm-from-suggestion">Next step filled in from the suggestion. Change it as you like.</p> : null}
      <p className="crm-dim">
        A visit lets the {target.noun} rest {VISIT_REST_DAYS} days; a drop-off rests {DROP_OFF_REST_DAYS}.
      </p>
      <CrmOnlyNote />
      <div className="crm-form-actions">
        <button
          type="submit"
          className={`dx-btn ${stopping && confirmed ? "dx-btn--danger" : "dx-btn--primary"}`}
          disabled={pending || (stopping && !confirmed)}
          aria-busy={pending}
          data-testid="crm-visit-save"
        >
          {pending ? "Saving…" : stopping && confirmed ? "Save and stop contact" : kind === "drop_off" ? "Save drop-off" : "Save visit"}
        </button>
        <button type="button" className="dx-btn" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
      </div>
      <Status state={state} />
    </form>
  );
}

function RemoveContact({ target, contact, onDone, onCancel }: { target: SaveTarget; contact: CrmContact; onDone: () => void; onCancel: () => void }) {
  const [state, action, pending] = useActionState<CrmFormState, FormData>(removeChurchContactAction, null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  return (
    <form action={action} className="crm-form crm-confirm-box" data-testid="crm-remove-contact">
      <input type="hidden" name={target.field} value={target.id} />
      <input type="hidden" name="contact_id" value={contact.id} />
      <p>
        Remove {contact.name} from this {target.noun}? Their visits stay in the timeline.
      </p>
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

function UndoDoNotContact({ target, onDone }: { target: SaveTarget; onDone: (message: string, warn?: boolean) => void }) {
  // Undo removes this button in the same re-render that answers; hand the message to the card first.
  const [state, action, pending] = useActionState<CrmFormState, FormData>(async (prev, formData) => {
    const result = await undoDoNotContactAction(prev, formData);
    if (result?.ok) onDone(result.message, result.warn === true);
    return result;
  }, null);
  return (
    <form action={action} className="crm-undo" data-testid="crm-undo-dnc">
      <input type="hidden" name={target.field} value={target.id} />
      <button type="submit" className="dx-btn" disabled={pending} aria-busy={pending}>
        {pending ? "Undoing…" : "Undo do-not-contact"}
      </button>
      {state?.ok ? null : <Status state={state} />}
    </form>
  );
}

export function PeopleTools({ card, canSave }: { card: CrmCard; canSave: boolean }) {
  const target = canSave ? saveTargetOf(card) : null;
  const [mode, setModeRaw] = useState<"" | "visit" | "add" | string>("");
  const noticeKey = saveKeyOf(target);
  const [notice, setNotice] = useNotice(noticeKey);
  const draft = useDraft(noticeKey);
  const setMode = (next: string) => {
    if (next) setNotice("");
    if (next !== "visit") offerVisitDraft(noticeKey, null);
    setModeRaw(next);
  };
  // A suggestion's "Use this" opens Log a visit with its next step filled in.
  useEffect(() => {
    if (draft) {
      setNoticeFor(noticeKey, "");
      setModeRaw("visit");
    }
  }, [draft, noticeKey]);
  const close = (message: string) => () => {
    offerVisitDraft(noticeKey, null);
    setModeRaw("");
    setNotice(message);
  };
  // Writes straight to the store, so it lands even if this card re-mounts mid-save.
  const done = (message: string, warn = false) => {
    offerVisitDraft(noticeKey, null);
    setNoticeFor(noticeKey, message, warn);
    setModeRaw("");
  };
  if (!card.contacts.length && !target) return null;
  return (
    <section className="crm-sub crm-church-tools" aria-label={`People at this ${card.leadId && !card.churchId ? "business" : "church"}`}>
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
              {target && contact.source === "saved" ? (
                mode === `edit:${contact.id}` ? (
                  <ContactForm target={target} contact={contact} onDone={close("Contact saved.")} onCancel={close("")} />
                ) : mode === `remove:${contact.id}` ? (
                  <RemoveContact target={target} contact={contact} onDone={close(`${contact.name} removed.`)} onCancel={close("")} />
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
      {target ? (
        <>
          {notice && !mode ? (
            <p
              className={`crm-form-status crm-card-notice ${notice.warn ? "crm-card-notice--stop" : "crm-ok-text"}`}
              role={notice.warn ? "alert" : "status"}
              data-testid="crm-people-notice"
            >
              {notice.message}
            </p>
          ) : null}
          {mode === "add" ? <ContactForm target={target} contact={null} onDone={close("Contact saved.")} onCancel={close("")} /> : null}
          {mode === "visit" ? (
            <VisitForm key={draft ? `${draft.nextStep}|${draft.nextDate}` : "blank"} card={card} target={target} draft={draft} onDone={done} onCancel={close("")} />
          ) : null}
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
          {/* Below the everyday buttons, so it's hard to hit by accident. */}
          {card.deskDoNotContact && !mode ? <UndoDoNotContact target={target} onDone={done} /> : null}
        </>
      ) : null}
    </section>
  );
}
