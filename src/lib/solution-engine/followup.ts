// The follow-up stage. Two weeks after delivery: "Still working? Still meeting?"
// One-tap answers, and the answers go straight into the knowledge layer (§9).

import { insertRow, selectOne, selectRows, updateOne } from "./db";
import type { FollowUp, SolutionCase } from "./types";

export const FOLLOW_UP_DAYS = 14;

export async function scheduleFollowUp(theCase: SolutionCase): Promise<FollowUp> {
  const existing = await selectOne<FollowUp>("se_followups", `case_id=eq.${theCase.id}&kind=eq.two_week&select=*`);

  if (existing) {
    return existing;
  }

  const due = new Date();
  due.setUTCDate(due.getUTCDate() + FOLLOW_UP_DAYS);

  return insertRow<FollowUp>("se_followups", {
    case_id: theCase.id,
    kind: "two_week",
    due_at: due.toISOString()
  });
}

export async function getOpenFollowUp(caseId: string): Promise<FollowUp | null> {
  return selectOne<FollowUp>("se_followups", `case_id=eq.${caseId}&answered_at=is.null&select=*&order=due_at.asc`);
}

export async function answerFollowUp(
  followUp: FollowUp,
  answers: { stillWorking: boolean; stillMeeting: boolean; testimony?: string }
): Promise<FollowUp> {
  return updateOne<FollowUp>("se_followups", `id=eq.${followUp.id}`, {
    answered_at: new Date().toISOString(),
    still_working: answers.stillWorking,
    still_meeting: answers.stillMeeting,
    testimony: answers.testimony?.trim() || null
  });
}

export async function listDueFollowUps(now = new Date()): Promise<FollowUp[]> {
  return selectRows<FollowUp>("se_followups", `answered_at=is.null&due_at=lte.${now.toISOString()}&select=*&order=due_at.asc`);
}

// "Regenerate or escalate as needed" (§3). A solution that stopped working is not
// a support ticket — it's a rebuild, because there is nothing to configure
// (principle 1: regenerate over configure).
export function nextActionFromFollowUp(followUp: FollowUp): "regenerate" | "reconnect" | "close" {
  if (followUp.still_working === false) {
    return "regenerate";
  }

  if (followUp.still_meeting === false) {
    return "reconnect";
  }

  return "close";
}
