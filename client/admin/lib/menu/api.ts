import "server-only";
import { ACCESS_TOKEN_COOKIE } from "@/constants/constants";
import { getCurrentToken } from "@/lib/auth/server";
import { toApiQuery, type MenuFilters } from "./params";
import type {
  AdminMenuCategory,
  AdminMenuItem,
  AdminMenuItemDetail,
  MenuSummary,
  Paginated,
} from "./types";

export type ApiResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      status: number;
      message: string;
      fieldErrors?: Record<string, string>;
    };

const READ_TIMEOUT_MS = 8_000;
const WRITE_TIMEOUT_MS = 45_000;

function baseUrl(): string {
  const url = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!url)
    throw new Error(
      "Set API_URL or NEXT_PUBLIC_API_URL (e.g. http://localhost:4000/api/v1)",
    );
  return url.replace(/\/+$/, "");
}

type Request = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: URLSearchParams;
  body?: unknown;
};

export async function adminFetch<T>(
  path: string,
  { method = "GET", query, body }: Request = {},
): Promise<ApiResult<T>> {
  const token = await getCurrentToken();
  if (!token)
    return {
      ok: false,
      status: 401,
      message: "Your session has ended. Sign in again.",
    };

  const isForm = body instanceof FormData;
  try {
    const response = await fetch(
      `${baseUrl()}${path}${query ? `?${query}` : ""}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Cookie: `${ACCESS_TOKEN_COOKIE}=${token}`,
          ...(body !== undefined &&
            !isForm && { "Content-Type": "application/json" }),
        },
        body:
          body === undefined ? undefined : isForm ? body : JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(
          method === "GET" ? READ_TIMEOUT_MS : WRITE_TIMEOUT_MS,
        ),
      },
    );

    if (response.ok) return { ok: true, data: (await response.json()) as T };
    return {
      ok: false,
      status: response.status,
      ...(await readError(response)),
    };
  } catch (error) {
    console.error(`[admin] ${method} ${path} failed:`, error);
    const timedOut =
      error instanceof DOMException && error.name === "TimeoutError";
    return {
      ok: false,
      status: 0,
      message: timedOut
        ? "The server took too long to answer. Try again."
        : "Couldn't reach the server. Check that the API is running.",
    };
  }
}

async function readError(
  response: Response,
): Promise<{ message: string; fieldErrors?: Record<string, string> }> {
  const body = (await response.json().catch(() => null)) as {
    message?: string | string[];
    errors?: Record<string, string>;
  } | null;

  if (response.status === 403)
    return { message: "Your role isn't allowed to do this." };
  if (response.status === 413)
    return { message: body?.message?.toString() ?? "The photo is too large." };

  const message = Array.isArray(body?.message)
    ? body.message.join(" · ")
    : body?.message;
  return {
    message: message ?? `The server answered ${response.status}.`,
    ...(body?.errors && { fieldErrors: body.errors }),
  };
}

export function fetchAdminMenuItems(filters: MenuFilters) {
  return adminFetch<Paginated<AdminMenuItem>>("/admin/menu/items", {
    query: toApiQuery(filters),
  });
}

export function fetchMenuSummary() {
  return adminFetch<MenuSummary>("/admin/menu/summary");
}

export function fetchAdminCategories() {
  return adminFetch<AdminMenuCategory[]>("/admin/menu/categories");
}

export function fetchAdminMenuItem(slug: string) {
  return adminFetch<AdminMenuItemDetail>(
    `/admin/menu/items/${encodeURIComponent(slug)}`,
  );
}
