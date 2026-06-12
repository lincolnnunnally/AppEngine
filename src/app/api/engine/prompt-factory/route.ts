import { NextResponse } from "next/server";
import { z } from "zod";
import { createAgentPromptPackage } from "@/lib/engine/prompt-factory";

const promptFactoryInput = z.object({
  agentType: z.string().optional(),
  triggerLabel: z.string().optional(),
  repositoryContext: z.string().optional(),
  issue: z
    .object({
      title: z.string().optional(),
      body: z.string().optional(),
      number: z.union([z.string(), z.number()]).optional(),
      url: z.string().optional(),
      labels: z.array(z.string()).optional()
    })
    .optional()
});

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = promptFactoryInput.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid prompt factory input",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  return NextResponse.json(createAgentPromptPackage(parsed.data));
}
