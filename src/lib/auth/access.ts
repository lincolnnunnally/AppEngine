import { auth } from "@/auth";
import { canAccessAdmin, canAccessCustomerArea } from "./roles";

export function hasAuthProvider() {
  return Boolean(
    (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) ||
      (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET)
  );
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
