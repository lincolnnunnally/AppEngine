import { agentRoles, type AgentTaskPriority } from "./agent-roles";

export type EngineTask = {
  agent: string;
  phase: string;
  title: string;
  description: string;
  dependsOn: string[];
  priority: AgentTaskPriority;
  expectedArtifacts: string[];
  acceptanceCriteria: string[];
};

export const defaultTaskGraph: EngineTask[] = agentRoles.map((role) => ({
  agent: role.slug,
  phase: role.phase,
  title: role.task.title,
  description: role.task.description,
  dependsOn: role.task.dependsOn,
  priority: role.task.priority,
  expectedArtifacts: role.deliverables,
  acceptanceCriteria: role.qualityBar
}));
