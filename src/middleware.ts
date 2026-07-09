import { NextResponse, type NextRequest } from "next/server";

// Host-based routing for the public apps showcase (owner directive 2026-07-09:
// "apps.unitedundergod.org is going to be a unified page that displays all our
// apps"). On that host this deployment serves EXACTLY ONE thing — the showcase:
//
//   apps.unitedundergod.org/            -> rewrite to /apps-showcase (URL stays "/")
//   apps.unitedundergod.org/<anything>  -> 308 back to "/" on the same host, so
//                                          no cockpit page, intake, or API is
//                                          ever reachable there. The factory's
//                                          AUTH_URL pins sign-in to
//                                          www.we-succeed.org; this host never
//                                          offers it.
//
// The showcase is public BY CONSTRUCTION: the route lives outside the (cockpit)
// group whose layout enforces the APP_ENGINE_PUBLIC_ACCESS consumer gate, so
// that gate keeps governing the factory on every host while this page stays
// viewable by anyone. On factory hosts, /apps-showcase 308s to the canonical
// apps.unitedundergod.org home (allowed on localhost for development).
const SHOWCASE_HOST = "apps.unitedundergod.org";
const SHOWCASE_PATH = "/apps-showcase";

function isLocalHost(host: string) {
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost");
}

export function middleware(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").toLowerCase().split(":")[0];
  const { pathname } = request.nextUrl;

  if (host === SHOWCASE_HOST) {
    // Framework internals and metadata files pass through so the page renders.
    if (pathname.startsWith("/_next/") || pathname === "/favicon.ico" || pathname === "/robots.txt") {
      return NextResponse.next();
    }
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = SHOWCASE_PATH;
      return NextResponse.rewrite(url);
    }
    // Everything else on this host — cockpit paths, APIs, even /apps-showcase
    // itself — collapses to the one public page.
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url, 308);
  }

  // One canonical home for the showcase: factory hosts send it to the apps host.
  if ((pathname === SHOWCASE_PATH || pathname.startsWith(`${SHOWCASE_PATH}/`)) && !isLocalHost(host)) {
    return NextResponse.redirect(`https://${SHOWCASE_HOST}/`, 308);
  }

  return NextResponse.next();
}

export const config = {
  // Static assets are excluded up front; everything else flows through the
  // host check above (non-showcase hosts fall straight through untouched).
  matcher: ["/((?!_next/static|_next/image).*)"]
};
