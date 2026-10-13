import { NextResponse, type NextRequest } from "next/server";
import {
  RESET_COOKIE,
  RESET_COOKIE_PATH,
  RESET_DONE_COOKIE,
  RESET_TTL_MINUTES,
  TOKEN_PATTERN,
} from "@/lib/password-reset";

export function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const target = new URL(RESET_COOKIE_PATH, request.url);
  const response = NextResponse.redirect(target, 303);

  if (TOKEN_PATTERN.test(token)) {
    response.cookies.set(RESET_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax", // sent when the email link opens the site
      path: RESET_COOKIE_PATH,
      maxAge: RESET_TTL_MINUTES * 60,
    });
  } else {
    response.cookies.delete({ name: RESET_COOKIE, path: RESET_COOKIE_PATH });
  }

  // A new link starts fresh: forget an earlier "password changed"
  response.cookies.delete({ name: RESET_DONE_COOKIE, path: RESET_COOKIE_PATH });
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Cache-Control", "no-store");
  return response;
}
