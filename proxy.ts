import { NextResponse, type NextRequest } from "next/server";

/**
 * Remembers which page was asked for, as a request header, so a page that needs a signed-in person can send them back to it after they
 * sign in (requireUser in lib/auth.ts). It sets the header itself on every page request, so a value the browser sends is never used as is,
 * and the value is checked again before use (lib/nextPath.ts: only a path inside this site is ever followed).
 */
export function proxy(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-return-to", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

// pages only: not static files, images or the API
export const config = { matcher: ["/((?!_next/|api/|favicon.ico|.*\\..*).*)"] };
