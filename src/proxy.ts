import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "pos_session";

function secretKey() {
  return new TextEncoder().encode(process.env.SESSION_SECRET);
}

type Role = "admin" | "server" | "kitchen";

function homeFor(role: Role) {
  if (role === "kitchen") return "/kitchen";
  return "/tables";
}

function isAllowed(pathname: string, role: Role) {
  if (role === "admin") return true;
  if (pathname.startsWith("/admin")) return false;
  if (role === "kitchen") return pathname.startsWith("/kitchen");
  // server
  return pathname.startsWith("/tables") || pathname.startsWith("/pos") || pathname.startsWith("/kitchen");
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  let role: Role | null = null;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, secretKey());
      role = payload.role as Role;
    } catch {
      role = null;
    }
  }

  if (!role) {
    if (pathname === "/login") return NextResponse.next();
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login" || pathname === "/") {
    return NextResponse.redirect(new URL(homeFor(role), request.url));
  }

  if (!isAllowed(pathname, role)) {
    return NextResponse.redirect(new URL(homeFor(role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
