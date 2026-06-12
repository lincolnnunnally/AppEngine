# Agent Enforcement Rules

These rules apply to ChatGPT, Codex, GitHub Actions, future agents, and monitoring services.

## Before Acting

- Check GitHub source of truth.
- Load the manifest.
- Load shared context files from the manifest.
- Load the app charter.
- Load the issue, pull request, or active task.
- Run the Context Gate.

## Stop Conditions

Stop and reconcile before editing when:

- ChatGPT, Codex, local files, and GitHub disagree.
- The local branch is stale.
- The agent cannot find the referenced source-of-truth files.
- The task contradicts the app charter.
- The task imports goals from another app without a documented connection.
- The task depends only on chat memory and has no GitHub issue, doc, or repo file.

## Follow-Up Tasks

Agents should create or recommend GitHub issues when they find missing context, cross-app opportunities, recurring failures, growth opportunities, or app charter conflicts.
