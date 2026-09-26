import { auth } from "@/auth";
import { handleAdminDoor, isAdminDoorHandoffSlug } from "@/lib/engine/admin-door-handoff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Platform-owner session only. The email gate is APP_ENGINE_OWNER_EMAIL /
// APP_ENGINE_PLATFORM_ADMIN_EMAIL (isPlatformOwnerEmail). No dev-admin bypass:
// the JWT has to name the signed-in owner. Unknown slugs 404 before any session
// read, so we never mint for an app that is not in the map.
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;

  if (!isAdminDoorHandoffSlug(slug)) {
    return handleAdminDoor({ slug, requestUrl: request.url });
  }

  const session = await auth();

  return handleAdminDoor({
    slug,
    requestUrl: request.url,
    email: session?.user?.email
  });
}
