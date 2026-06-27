import { auth } from "@/auth";
import { canAccessAdmin, canAccessConsumerSurfaceForRole, canAccessCustomerArea, canAccessOwner } from "./roles";

export function hasGoogleProvider() {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}

export function hasGithubProvider() {
  return Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET);
}

// Email magic-link also needs a database (verification tokens) to function.
export function hasEmailSignIn() {
  return Boolean(process.env.AUTH_RESEND_KEY && process.env.EMAIL_FROM);
}

export function hasAuthProvider() {
  return hasGithubProvider() || hasGoogleProvider() || hasEmailSignIn();
}

export function isSetupAdminMode() {
  return Boolean(
    process.env.NODE_ENV !== "production" &&
      process.env.APP_ENGINE_SETUP_ADMIN_BYPASS === "true" &&
      process.env.AUTH_SECRET &&
      process.env.APP_ENGINE_OWNER_EMAIL &&
      !hasAuthProvider()
  );
}

export function isDevelopmentAdminMode() {
  return process.env.NODE_ENV === "development" && process.env.APP_ENGINE_DEV_ADMIN_BYPASS !== "false";
}

export async function canAccessEngineAdmin() {
  if (isDevelopmentAdminMode()) {
    return true;
  }

  if (isSetupAdminMode()) {
    return true;
  }

  const session = await auth();

  return canAccessAdmin(session?.user?.role);
}

export async function canAccessEngineOwner() {
  if (isDevelopmentAdminMode()) {
    return true;
  }

  if (isSetupAdminMode()) {
    return true;
  }

  const session = await auth();

  return canAccessOwner(session?.user?.role);
}

export async function canAccessEngineCustomerArea() {
  if (isDevelopmentAdminMode()) {
    return true;
  }

  if (isSetupAdminMode()) {
    return true;
  }

  const session = await auth();

  return canAccessCustomerArea(session?.user?.role);
}

// Consumer surface gate (Step 6, staged): the two-door entry + problem/opportunity
// intakes + their POST APIs. Owner/admin operators always pass; non-owner customers
// pass only when Lincoln has opened the doors via APP_ENGINE_PUBLIC_ACCESS
// (allowlist/public). Defaults closed (owner-only), so this is inert until flipped.
export async function canAccessEngineConsumerSurface() {
  if (isDevelopmentAdminMode()) {
    return true;
  }

  if (isSetupAdminMode()) {
    return true;
  }

  const session = await auth();

  return canAccessConsumerSurfaceForRole(session?.user?.role, session?.user?.email);
}
