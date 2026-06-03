export const roles = ["owner", "admin", "customer", "vendor"] as const;

export type Role = (typeof roles)[number];

export function canAccessAdmin(role?: string | null) {
  return role === "owner" || role === "admin";
}

export function canAccessCustomerArea(role?: string | null) {
  return role === "owner" || role === "admin" || role === "customer" || role === "vendor";
}

export function roleForEmail(email?: string | null): Role {
  if (!email) return "customer";
  return email.toLowerCase() === process.env.APP_ENGINE_OWNER_EMAIL?.toLowerCase() ? "owner" : "customer";
}
