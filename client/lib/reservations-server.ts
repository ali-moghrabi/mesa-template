import "server-only";
import { getConfig } from "@/config/loader";
import type { ApiResult } from "@/admin/lib/menu/api";
import type { Availability } from "@/lib/reservations";

export function reservationsEnabled(): boolean {
  const config = getConfig() as unknown as {
    features?: { reservations?: boolean };
    pages?: { reservations?: { enabled?: boolean } };
  };
  return (
    config.features?.reservations === true &&
    config.pages?.reservations?.enabled === true
  );
}

export async function getAvailability(): Promise<ApiResult<Availability>> {
  const base = (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    ""
  ).replace(/\/+$/, "");
  if (!base)
    return {
      ok: false,
      status: 0,
      message: "Set API_URL (e.g. http://localhost:4000/api/v1).",
    };
  try {
    const response = await fetch(`${base}/reservations/availability`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6_000),
    });
    if (response.ok)
      return { ok: true, data: (await response.json()) as Availability };
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    return {
      ok: false,
      status: response.status,
      message: body?.message ?? "Booking isn't available right now.",
    };
  } catch (error) {
    console.error("[reservations] availability failed:", error);
    return {
      ok: false,
      status: 0,
      message: "We couldn't load the free tables.",
    };
  }
}
