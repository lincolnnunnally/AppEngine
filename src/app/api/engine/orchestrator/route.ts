import { NextResponse } from "next/server";
import { z } from "zod";
import { createAgentExecutionPlan } from "@/lib/engine/orchestrator";

const outputRecord = z.object({
  agent: z.string(),
  status: z.enum(["completed", "blocked", "needs_follow_up"]),
  summary: z.string().optional(),
  findings: z
    .array(
      z.object({
        title: z.string(),
        details: z.string().optional(),
        severity: z.enum(["low", "medium", "high"]).optional(),
        recommendedLabel: z.string().optional()
      })
    )
    .optional(),
  followUpTasks: z
    .array(
      z.object({
        title: z.string(),
        body: z.string(),
        recommendedLabel: z.string().optional()
      })
    )
    .optional(),
  handoffTo: z.array(z.string()).optional()
});

const orchestratorInput = z.object({
  triggerLabel: z.string().optional(),
  requestedAgent: z.string().optional(),
  issue: z
    .object({
      title: z.string().optional(),
      body: z.string().optional(),
      number: z.union([z.string(), z.number()]).optional(),
      url: z.string().optional(),
      labels: z.array(z.string()).optional()
    })
    .optional(),
  outputs: z.array(outputRecord).optional()
});

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = orchestratorInput.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid orchestrator input",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  return NextResponse.json(createAgentExecutionPlan(parsed.data));
}
