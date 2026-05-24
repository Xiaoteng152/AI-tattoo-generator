import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((request) => {
  const { pathname, search } = request.nextUrl;
  const isProtected =
    pathname.startsWith("/deepsearch") || pathname.startsWith("/api/deepsearch");

  if (isProtected && !request.auth) {
    const loginUrl = new URL("/login", request.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }
});

export const config = {
  matcher: ["/deepsearch/:path*", "/api/deepsearch/:path*"]
};
