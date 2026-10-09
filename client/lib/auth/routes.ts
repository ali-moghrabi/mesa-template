export const PROTECTED_ROUTES: readonly string[] = ["/account"];

export const ADMIN_ROUTE = "/admin";

export const FALLBACK_ROUTE = "/";

export function isMatch(pathname: string, routes: readonly string[]): boolean {
  return routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}
