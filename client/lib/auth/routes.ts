export const PROTECTED_ROUTES: readonly string[] = ["/account", "/payment"];

export const GUEST_ONLY_ROUTES: readonly string[] = [
  "/forgot-password",
  "/reset-password",
];

export const ADMIN_ROUTE = "/admin";

export const FALLBACK_ROUTE = "/";

export function isMatch(pathname: string, routes: readonly string[]): boolean {
  return routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}
