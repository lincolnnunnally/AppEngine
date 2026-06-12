# Context Checklist

All agent workflows must load and answer this checklist before taking action.

## Required Inputs

- Global Principles
- Life Produces Life product doctrine
- App Charter
- App Build Packet for new apps, major rebuilds, or complex multi-phase work
- Current Context from GitHub issue, pull request, docs, or committed source
- Active Task and triggering label
- Relevant manifest agent prompt
- Current GitHub source-of-truth state

## Required Checks

1. Is the local workspace aligned with live GitHub source?
2. Does the task belong to this app or should it be routed elsewhere?
3. Does the task preserve the app's charter, audience, boundaries, and success definition?
4. Does the task preserve the Life Produces Life doctrine?
5. Does the task risk app-goal bleeding between unrelated apps?
6. Is this a new app or complex build that needs an App Build Packet before implementation?
7. If an App Build Packet exists, does the active task stay inside its current phase?
8. Are any core files, docs, prompts, context, or issue links missing?
9. Should the agent proceed, pause, ask for clarification, or create a follow-up issue?

## Output

The Context Gate must produce:

- Go / No-Go decision
- Missing context
- Boundary warnings
- Required source files read
- Recommended next step
