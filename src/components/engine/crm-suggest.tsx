"use client";

import { useActionState, useState } from "react";
import { suggestNextStepAction, type SuggestState } from "@/app/(cockpit)/crm/actions";
import { offerVisitDraft, saveKeyOf, saveTargetOf } from "@/components/engine/crm-church-tools";
import { SUGGEST_LABEL, suggestGate } from "@/lib/engine/crm-suggest-core";
import type { CrmCard } from "@/lib/engine/lpl-crm-core";

// "Suggested next step" on a CRM card. OWNER ONLY (the page passes isOwner; the
// server action checks again). Suggestions only: nothing is saved or sent. "Use
// this" fills the card's Log a visit form; the owner still decides and saves.

const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });

function whenText(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? "" : dayFmt.format(date);
}

export function SuggestNextStep({ card, isOwner, canSave, outreachHidden = false }: { card: CrmCard; isOwner: boolean; canSave: boolean; outreachHidden?: boolean }) {
  const [dismissedAt, setDismissedAt] = useState(0);
  const [state, action, pending] = useActionState<SuggestState, FormData>(suggestNextStepAction, null);
  if (!isOwner) return null;
  // Stopped, resting, or the do-not-contact list unreadable: the banners already say it; no suggestion area at all.
  if (suggestGate(card, outreachHidden).kind !== "ok") return null;
  const target = canSave ? saveTargetOf(card) : null;
  const shown = state && state.at > dismissedAt ? state : null;
  const suggestion = shown?.ok ? shown.suggestion : undefined;
  return (
    <section className="crm-sub crm-suggest" aria-label={SUGGEST_LABEL} data-testid="crm-suggest">
      {suggestion ? (
        <div className="crm-suggest-box" data-testid="crm-suggest-box">
          <h4>{SUGGEST_LABEL}</h4>
          <p className="crm-suggest-step">{suggestion.nextStep}</p>
          <dl className="crm-suggest-facts">
            {suggestion.appLabel ? (
              <div>
                <dt>App</dt>
                <dd>{suggestion.appLabel}</dd>
              </div>
            ) : null}
            <div>
              <dt>When</dt>
              <dd>{whenText(suggestion.when)}</dd>
            </div>
          </dl>
          {suggestion.why ? <p className="crm-dim">{suggestion.why}</p> : null}
          <p className="crm-dim crm-suggest-note">A suggestion only. Nothing is saved or sent.</p>
          <div className="crm-actions">
            {target ? (
              <button
                type="button"
                className="dx-btn dx-btn--primary"
                data-testid="crm-suggest-use"
                onClick={() => {
                  offerVisitDraft(saveKeyOf(target), { nextStep: suggestion.nextStep, nextDate: suggestion.when });
                  setDismissedAt(Date.now());
                }}
              >
                Use this
              </button>
            ) : null}
            <button type="button" className="dx-btn" onClick={() => setDismissedAt(Date.now())}>
              Not now
            </button>
          </div>
        </div>
      ) : (
        <form action={action} className="crm-suggest-form">
          <input type="hidden" name="card_key" value={card.key} />
          <button type="submit" className="dx-btn" disabled={pending} aria-busy={pending} data-testid="crm-suggest-ask">
            {pending ? "Thinking…" : "Suggest a next step"}
          </button>
          {shown && !shown.ok ? (
            <p className="crm-form-status crm-dim" role="status" data-testid="crm-suggest-status">
              {shown.message}
            </p>
          ) : null}
        </form>
      )}
    </section>
  );
}
