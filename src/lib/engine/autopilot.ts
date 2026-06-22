import { generateProjectApp } from "./app-generator";
import { assertProjectBuildAllowed } from "./build-gate";
import { setupGeneratedAppDatabase } from "./database-setup";
import { prepareProjectDeployment, runProjectAgents, runProjectAutomation } from "./execution";
import { getProjectLaunchReadiness, type ProjectReadinessReport } from "./readiness";

type AutopilotStatus = "completed" | "blocked" | "max_steps_reached";

type AutopilotStep = {
  action: string;
  status: "completed" | "blocked";
  details: string;
};

export type ProjectAutopilotResult = {
  projectId: string;
  status: AutopilotStatus;
  steps: AutopilotStep[];
  readiness: ProjectReadinessReport;
};

const maxAutopilotSteps = 6;

export async function runProjectAutopilot(projectId: string): Promise<ProjectAutopilotResult> {
  await assertProjectBuildAllowed(projectId, "run_project_autopilot");
  const steps: AutopilotStep[] = [];
  let readiness = await getProjectLaunchReadiness(projectId);

  for (let index = 0; index < maxAutopilotSteps; index += 1) {
    const blocker = readiness.blockers[0];

    if (!blocker) {
      return {
        projectId,
        status: "completed",
        steps,
        readiness
      };
    }

    const action = getAutopilotAction(blocker.id);

    if (!action) {
      steps.push({
        action: blocker.nextAction,
        status: "blocked",
        details: blocker.details
      });

      return {
        projectId,
        status: "blocked",
        steps,
        readiness
      };
    }

    const step = await action(projectId);
    steps.push(step);
    const nextReadiness = await getProjectLaunchReadiness(projectId);

    if (nextReadiness.blockers[0]?.id === blocker.id && nextReadiness.status !== "ready") {
      return {
        projectId,
        status: "blocked",
        steps,
        readiness: nextReadiness
      };
    }

    readiness = nextReadiness;
  }

  return {
    projectId,
    status: "max_steps_reached",
    steps,
    readiness
  };
}

function getAutopilotAction(blockerId: string) {
  const actions: Record<string, (projectId: string) => Promise<AutopilotStep>> = {
    "agent-build": async (projectId) => {
      const result = await runProjectAgents(projectId);
      const status = result.run.status === "agents_completed" ? "completed" : "blocked";

      return {
        action: "Run Agents",
        status,
        details: status === "completed" ? "Agent build run completed." : "Agent build run needs attention."
      };
    },
    "generated-app": async (projectId) => {
      const result = await generateProjectApp(projectId);

      return {
        action: "Generate App",
        status: "completed",
        details: `Generated app export ${result.export.id} was created.`
      };
    },
    "generated-database": async (projectId) => {
      const result = await setupGeneratedAppDatabase(projectId);
      const status = result.setup.status === "database_ready" ? "completed" : "blocked";

      return {
        action: "Setup DB",
        status,
        details: result.setup.details
      };
    },
    "qa-loop": async (projectId) => {
      const result = await runProjectAutomation(projectId);
      const status = result.run.status === "qa_passed" ? "completed" : "blocked";

      return {
        action: "Run QA Loop",
        status,
        details: status === "completed" ? "Automated QA loop passed." : "Automated QA loop still needs attention."
      };
    },
    "deployment-prep": async (projectId) => {
      const result = await prepareProjectDeployment(projectId);
      const status = result.deployment.status === "deployment_ready" ? "completed" : "blocked";

      return {
        action: "Prepare Deploy",
        status,
        details: result.deployment.details
      };
    }
  };

  return actions[blockerId];
}
