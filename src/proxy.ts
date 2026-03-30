import { NextRequest, NextResponse } from "next/server";

const publicRoutes = ["/login"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const sessionToken = req.cookies.get("session_token")?.value;
  const isPublic = publicRoutes.includes(pathname);

  if (!sessionToken && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (sessionToken && isPublic) {
    return NextResponse.redirect(new URL("/home", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
