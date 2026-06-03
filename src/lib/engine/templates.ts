export type CoreTemplate = {
  id: string;
  name: string;
  category: string;
  description: string;
  triggers: string[];
  includes: string[];
};

export const coreTemplates: CoreTemplate[] = [
  {
    id: "auth",
    name: "Authentication + Roles",
    category: "Foundation",
    description: "Customer sign-in, admin sign-in, protected routes, sessions, roles, and account recovery.",
    triggers: ["always"],
    includes: ["Sign in", "Sign up", "Admin role", "Customer role", "Session checks"]
  },
  {
    id: "customer-account",
    name: "Customer Account Portal",
    category: "Customer",
    description: "Customers manage profile, organization, plan, service usage, requests, and notifications.",
    triggers: ["customer", "portal", "saas", "service"],
    includes: ["Profile", "Organization", "Usage", "Requests", "Notifications"]
  },
  {
    id: "admin-console",
    name: "Admin Console",
    category: "Admin",
    description: "Administrators manage customers, projects, app runs, billing state, support, and audit logs.",
    triggers: ["always"],
    includes: ["Customers", "Projects", "Agent runs", "Billing", "Support", "Audit log"]
  },
  {
    id: "onboarding",
    name: "Guided Onboarding",
    category: "Growth",
    description: "First-run setup captures goals, company details, plan fit, and success criteria.",
    triggers: ["always"],
    includes: ["Welcome", "Company setup", "Goal capture", "Checklist"]
  },
  {
    id: "billing",
    name: "Billing + Plans",
    category: "Revenue",
    description: "Pricing tiers, subscription state, invoices, usage limits, and upgrade prompts.",
    triggers: ["saas", "subscription", "usage", "marketplace"],
    includes: ["Plans", "Subscription", "Invoices", "Usage limits"]
  },
  {
    id: "dashboard",
    name: "Operational Dashboard",
    category: "Product",
    description: "Work surface for status, tasks, alerts, key metrics, and next best actions.",
    triggers: ["always"],
    includes: ["Metrics", "Status", "Tasks", "Alerts", "Activity"]
  },
  {
    id: "notifications",
    name: "Notifications",
    category: "Retention",
    description: "Email and in-app messages for account events, workflow updates, failures, and opportunities.",
    triggers: ["workflow", "service", "operations", "automation"],
    includes: ["Email", "In-app feed", "Preferences", "Failure alerts"]
  },
  {
    id: "marketplace",
    name: "Marketplace Core",
    category: "Commerce",
    description: "Supply/demand listings, matches, commissions, vendor profiles, and transaction records.",
    triggers: ["marketplace", "vendor", "supplier"],
    includes: ["Listings", "Vendors", "Matches", "Commissions", "Transactions"]
  },
  {
    id: "ai-runs",
    name: "AI Run History",
    category: "AI",
    description: "Traceable AI requests, prompts, outputs, cost, artifacts, and retry history.",
    triggers: ["ai", "agent", "generate", "automation"],
    includes: ["Prompts", "Outputs", "Artifacts", "Costs", "Retries"]
  }
];

export function selectTemplates(input: string) {
  const text = input.toLowerCase();
  return coreTemplates.filter((template) => {
    if (template.triggers.includes("always")) return true;
    return template.triggers.some((trigger) => text.includes(trigger));
  });
}
