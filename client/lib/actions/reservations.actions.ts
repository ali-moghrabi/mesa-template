"use server";

import { getUserSession } from "@/lib/auth/get-user";
import { adminFetch, type ApiResult } from "@/admin/lib/menu/api";
import {
  getAvailability,
  reservationsEnabled,
} from "@/lib/reservations-server";
import {
  DATE_PATTERN,
  NOTES_MAX,
  PHONE_PATTERN,
  TIME_PATTERN,
  type Availability,
  type BookingInput,
  type Reservation,
} from "@/lib/reservations";

const OBJECT_ID = /^[0-9a-f]{24}$/i;
const signedOut = {
  ok: false as const,
  status: 401,
  message: "Sign in to book a table.",
};
const off = {
  ok: false as const,
  status: 403,
  message: "Online booking is off right now. Please call us.",
};

export async function refreshAvailability(): Promise<ApiResult<Availability>> {
  if (!reservationsEnabled()) return off;
  return getAvailability();
}

export async function bookTable(
  input: BookingInput,
): Promise<ApiResult<Reservation>> {
  if (!reservationsEnabled()) return off;
  if (!(await getUserSession())) return signedOut;

  const body = {
    date: String(input.date),
    time: String(input.time),
    partySize: Number(input.partySize),
    phone: String(input.phone ?? "").trim(),
    occasion: String(input.occasion ?? "").trim() || undefined,
    notes:
      String(input.notes ?? "")
        .trim()
        .slice(0, NOTES_MAX) || undefined,
    idempotencyKey: String(input.idempotencyKey ?? ""),
  };
  if (!DATE_PATTERN.test(body.date))
    return {
      ok: false,
      status: 400,
      message: "Choose a date.",
      fieldErrors: { date: "Choose a date" },
    };
  if (!TIME_PATTERN.test(body.time))
    return {
      ok: false,
      status: 400,
      message: "Choose a time.",
      fieldErrors: { time: "Choose a time" },
    };
  if (!Number.isInteger(body.partySize) || body.partySize < 1)
    return {
      ok: false,
      status: 400,
      message: "Choose how many guests.",
      fieldErrors: { partySize: "Choose how many guests" },
    };
  if (body.phone && !PHONE_PATTERN.test(body.phone))
    return {
      ok: false,
      status: 400,
      message: "Check your phone number.",
      fieldErrors: { phone: "Enter a phone number we can call" },
    };

  return adminFetch<Reservation>("/reservations", { method: "POST", body });
}

export async function cancelReservation(
  id: string,
  reason?: string,
): Promise<ApiResult<Reservation>> {
  if (!(await getUserSession())) return signedOut;
  if (!OBJECT_ID.test(String(id)))
    return { ok: false, status: 404, message: "Booking not found." };
  const note = String(reason ?? "")
    .trim()
    .slice(0, 200);
  return adminFetch<Reservation>(`/reservations/${id}/cancel`, {
    method: "POST",
    body: note ? { reason: note } : {},
  });
}
