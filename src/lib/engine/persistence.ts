import { z } from "zod";
import { getDatabase } from "@/lib/db/client";
import { createLocalPlannedProject, listLocalProjects } from "./development-store";
import { isLocalMode } from "./local-mode";
import { analyzeIdea } from "./planner";
import { defaultTaskGraph } from "./tasks";

export const createProjectInput = z.object({
  idea: z.string().min(8),
  name: z.string().optional(),
  targetCustomer: z.string().optional(),
  problem: z.string().optional(),
  revenueModel: z.string().default("SaaS subscription"),
  appType: z.string().default("Auto detect"),
  buildTarget: z.string().optional()
});

export type CreateProjectInput = z.infer<typeof createProjectInput>;

export async function listPlannedProjects() {
  if (isLocalMode()) {
    return {
      projects: await listLocalProjects(),
      storage: "local" as const
    };
  }

  const sql = getDatabase();
  const projects = await sql`
    select id, name, status, readiness_score, app_type, recommended_target, created_at, updated_at
    from app_projects
    order by updated_at desc
    limit 50
  `;

  return {
    projects,
    storage: "neon" as const
  };
}

export async function createPlannedProject(input: CreateProjectInput) {
  if (isLocalMode()) {
    return createLocalPlannedProject(input);
  }

  const sql = getDatabase();
  const plan = analyzeIdea(input);
  const projectName = input.name || plan.title || "Untitled App";

  const [project] = await sql`
    insert into app_projects (
      name,
      idea,
      target_customer,
      problem_statement,
      revenue_model,
      app_type,
      recommended_target,
      build_target,
      status,
      readiness_score,
      created_by_user_id
    )
    values (
      ${projectName},
      ${input.idea},
      ${plan.customer},
      ${plan.problem},
      ${input.revenueModel},
      ${plan.appType},
      ${plan.recommendedTarget},
      ${input.buildTarget || plan.recommendedTarget},
      'planned',
      25,
      null
    )
    returning *
  `;

  for (const template of plan.templates) {
    await sql`
      insert into project_templates (project_id, template_id, selected_reason)
      select ${project.id}, app_templates.id, ${`Selected by planner for ${plan.appType}.`}
      from app_templates
      where app_templates.slug = ${template.id}
      on conflict (project_id, template_id) do nothing
    `;
  }

  for (const task of defaultTaskGraph) {
    await sql`
      insert into app_tasks (project_id, agent_role_id, title, description, status, priority)
      select ${project.id}, agent_roles.id, ${task.title}, ${task.description}, 'todo', 'medium'
      from agent_roles
      where agent_roles.slug = ${task.agent}
    `;
  }

  await sql`
    insert into audit_events (project_id, actor_user_id, event_type, event_data)
    values (
      ${project.id},
      null,
      'project.planned',
      ${JSON.stringify({ templates: plan.templates.map((template) => template.id), recommendedTarget: plan.recommendedTarget })}
    )
  `;

  return {
    project,
    plan,
    taskCount: defaultTaskGraph.length,
    templateCount: plan.templates.length,
    storage: "neon" as const
  };
}
