// Outbound messages. Email only, by owner decision D-S6: Resend is already wired
// and free at our volume; SMS costs money and is therefore Lincoln's call, not a
// technical one. The `channel` field on a case is honoured for phone numbers by
// queueing them for an operator instead of silently dropping them.
//
// Principle 4 applies to every word that leaves this file: no "AI", no "generated",
// no engine vocabulary. These read like a person wrote them, because a person did.

import { insertRow } from "./db";
import type { SolutionCase } from "./types";

export type OutboundMessage = {
  to: string;
  subject: string;
  body: string;
};

export function resendConfigured() {
  return Boolean(process.env.AUTH_RESEND_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(message: OutboundMessage): Promise<{ sent: boolean; reason?: string }> {
  if (!resendConfigured()) {
    return { sent: false, reason: "email is not configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.AUTH_RESEND_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        text: message.body
      })
    });

    if (!response.ok) {
      return { sent: false, reason: `email provider returned ${response.status}` };
    }

    return { sent: true };
  } catch (caught) {
    return { sent: false, reason: caught instanceof Error ? caught.message : "email failed" };
  }
}

export function caseUrl(theCase: Pick<SolutionCase, "token">): string {
  const base = (process.env.SOLUTION_ENGINE_PUBLIC_URL || process.env.AUTH_URL || "https://appengine.unitedundergod.org").replace(/\/$/, "");
  return `${base}/solve/c/${theCase.token}`;
}

export async function notifyOfferReady(theCase: SolutionCase): Promise<{ sent: boolean; reason?: string }> {
  if (!theCase.contact_email) {
    return { sent: false, reason: "no email on file" };
  }

  return sendEmail({
    to: theCase.contact_email,
    subject: "Here's what we'd build for you",
    body: [
      `${theCase.contact_name ? `${theCase.contact_name},` : "Hi,"}`,
      "",
      "We put together what we'd build for you. It's one page, it's plain English, and there's nothing to sign up for.",
      "",
      caseUrl(theCase),
      "",
      "If it's not right, say so and we'll change it."
    ].join("\n")
  });
}

export async function notifyDelivered(theCase: SolutionCase): Promise<{ sent: boolean; reason?: string }> {
  if (!theCase.contact_email) {
    return { sent: false, reason: "no email on file" };
  }

  return sendEmail({
    to: theCase.contact_email,
    subject: "It's ready",
    body: [
      `${theCase.contact_name ? `${theCase.contact_name},` : "Hi,"}`,
      "",
      "Your thing is built and working. There's a ten-minute walkthrough with it — that's the whole manual.",
      "",
      caseUrl(theCase),
      "",
      "One more thing waiting for you there too. Someone you should meet.",
      "",
      "Nothing to install, no account to keep up with."
    ].join("\n")
  });
}

export async function notifyIntroDrafted(theCase: SolutionCase, matchName: string): Promise<{ sent: boolean; reason?: string }> {
  if (!theCase.contact_email) {
    return { sent: false, reason: "no email on file" };
  }

  return sendEmail({
    to: theCase.contact_email,
    subject: `You should meet ${matchName}`,
    body: [
      `${theCase.contact_name ? `${theCase.contact_name},` : "Hi,"}`,
      "",
      `${matchName} has been exactly where you are. We'd like to introduce you.`,
      "",
      "Nothing gets shared until you both say yes:",
      caseUrl(theCase),
      "",
      "No pressure either way. Saying no costs you nothing with us."
    ].join("\n")
  });
}

export async function notifyCommitmentDue(theCase: SolutionCase, description: string): Promise<{ sent: boolean; reason?: string }> {
  if (!theCase.contact_email) {
    return { sent: false, reason: "no email on file" };
  }

  return sendEmail({
    to: theCase.contact_email,
    subject: "This week's one thing",
    body: [
      `${theCase.contact_name ? `${theCase.contact_name},` : "Hi,"}`,
      "",
      description,
      "",
      "Did it? One tap:",
      caseUrl(theCase),
      "",
      "If the step is too big this week, say so there and we'll cut it in half. That still counts."
    ].join("\n")
  });
}

export async function notifyFollowUp(theCase: SolutionCase): Promise<{ sent: boolean; reason?: string }> {
  if (!theCase.contact_email) {
    return { sent: false, reason: "no email on file" };
  }

  return sendEmail({
    to: theCase.contact_email,
    subject: "Two weeks in — still working?",
    body: [
      `${theCase.contact_name ? `${theCase.contact_name},` : "Hi,"}`,
      "",
      "Two questions, one tap each: is the thing we built still working for you, and are you still in touch with the person we introduced you to?",
      "",
      caseUrl(theCase),
      "",
      "If it stopped being useful, tell us — we'll rebuild it rather than ask you to fiddle with it."
    ].join("\n")
  });
}

// §4d — a safety escalation always reaches a human. D-S2 default: the owner
// address, until a pastoral contact is designated. This is the one message that is
// allowed to be blunt and operational, because its reader is staff, not the person.
export async function alertSafetyEscalation(theCase: SolutionCase, category: string, excerpt: string): Promise<{ sent: boolean; reason?: string }> {
  const to = process.env.SOLUTION_ENGINE_SAFETY_CONTACT || process.env.APP_ENGINE_OWNER_EMAIL;

  if (!to) {
    return { sent: false, reason: "no safety contact configured" };
  }

  const result = await sendEmail({
    to,
    subject: `[Solution Engine] Safety escalation — ${category}`,
    body: [
      `A case was halted by the safety screen at ${new Date().toISOString()}.`,
      "",
      `Category: ${category}`,
      `Case: ${theCase.id}`,
      `Contact: ${theCase.contact_email || theCase.contact_phone || "none given yet"}`,
      `Region: ${theCase.region || "unknown"}`,
      "",
      "What they wrote:",
      excerpt,
      "",
      "They were shown crisis resources and the solution flow was stopped. Nothing further is automated on this case."
    ].join("\n")
  });

  await insertRow("se_case_events", {
    case_id: theCase.id,
    from_state: theCase.state,
    to_state: "escalated",
    reason: `safety escalation (${category}); human alert ${result.sent ? "sent" : `NOT sent: ${result.reason}`}`,
    actor: "safety_screen"
  }).catch(() => {
    // The alert matters more than its audit row; never let this throw.
  });

  return result;
}
