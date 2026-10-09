import "server-only";
import { ACCESS_TOKEN_COOKIE } from "@/constants/constants";
import { getCurrentToken } from "@/lib/auth/server";
import { toApiQuery, type MenuFilters } from "./params";
import type { AdminMenuItem, MenuSummary, Paginated } from "./types";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string };

const TIMEOUT_MS = 8_000;

function baseUrl(): string {
  const url = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!url)
    throw new Error(
      "Set API_URL or NEXT_PUBLIC_API_URL (e.g. http://localhost:4000/api/v1)",
    );
  return url.replace(/\/+$/, "");
}

async function adminGet<T>(
  path: string,
  query?: URLSearchParams,
): Promise<ApiResult<T>> {
  const token = await getCurrentToken();
  if (!token)
    return {
      ok: false,
      status: 401,
      message: "Your session has ended. Sign in again.",
    };

  try {
    const response = await fetch(
      `${baseUrl()}${path}${query ? `?${query}` : ""}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Cookie: `${ACCESS_TOKEN_COOKIE}=${token}`,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );

    if (response.ok) return { ok: true, data: (await response.json()) as T };

    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(", ")
      : body?.message;
    return {
      ok: false,
      status: response.status,
      message:
        response.status === 403
          ? "Your role can't open the menu."
          : (message ?? `The server answered ${response.status}.`),
    };
  } catch (error) {
    console.error(`[admin] GET ${path} failed:`, error);
    return {
      ok: false,
      status: 0,
      message: "Couldn't reach the server. Check that the API is running.",
    };
  }
}

export function fetchAdminMenuItems(filters: MenuFilters) {
  return adminGet<Paginated<AdminMenuItem>>(
    "/admin/menu/items",
    toApiQuery(filters),
  );
}

export function fetchMenuSummary() {
  return adminGet<MenuSummary>("/admin/menu/summary");
}
