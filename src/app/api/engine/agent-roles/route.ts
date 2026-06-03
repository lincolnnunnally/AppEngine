import { NextResponse } from "next/server";
import { listAgentRoles } from "@/lib/engine/agent-roles";
import { defaultTaskGraph } from "@/lib/engine/tasks";

export async function GET() {
  return NextResponse.json({
    roles: listAgentRoles(),
    taskCount: defaultTaskGraph.length
  });
}
