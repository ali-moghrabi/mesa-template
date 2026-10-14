"use server";

import { requireTeam } from "@/lib/auth/get-user";
import { DATE_PATTERN } from "@/lib/reservations";
import type { ReservationStatus } from "@/lib/reservations";
import { adminFetch, type ApiResult } from "./menu/api";
import type {
  AdminReservationDetail,
  CreatePayload,
  DayView,
  ListFilters,
  RequestsView,
  ReservationsPage,
  UpdatePayload,
} from "./reservations";

const OBJECT_ID = /^[0-9a-f]{24}$/i;
const STATUSES: ReservationStatus[] = [
  "pending",
  "confirmed",
  "seated",
  "completed",
  "no_show",
  "declined",
  "cancelled",
];
const notFound = {
  ok: false as const,
  status: 404,
  message: "This booking no longer exists.",
};

export async function fetchDay(date: string): Promise<ApiResult<DayView>> {
  await requireTeam("reservations:view");
  const query = new URLSearchParams();
  if (DATE_PATTERN.test(date)) query.set("date", date);
  return adminFetch<DayView>("/admin/reservations/day", { query });
}

export async function fetchRequests(): Promise<ApiResult<RequestsView>> {
  await requireTeam("reservations:view");
  return adminFetch<RequestsView>("/admin/reservations/requests");
}

export async function fetchReservationsPage(
  filters: ListFilters,
): Promise<ApiResult<ReservationsPage>> {
  await requireTeam("reservations:view");
  const query = new URLSearchParams();
  if (
    filters.status &&
    (filters.status === "upcoming" ||
      STATUSES.includes(filters.status as ReservationStatus))
  )
    query.set("status", filters.status);
  if (filters.q?.trim()) query.set("q", filters.q.trim().slice(0, 80));
  if (filters.from && DATE_PATTERN.test(filters.from))
    query.set("from", filters.from);
  if (filters.to && DATE_PATTERN.test(filters.to)) query.set("to", filters.to);
  if (filters.page && filters.page > 1)
    query.set("page", String(Math.min(1000, Math.floor(filters.page))));
  return adminFetch<ReservationsPage>("/admin/reservations", { query });
}

export async function fetchReservation(
  id: string,
): Promise<ApiResult<AdminReservationDetail>> {
  await requireTeam("reservations:view");
  if (!OBJECT_ID.test(id)) return notFound;
  return adminFetch<AdminReservationDetail>(`/admin/reservations/${id}`);
}

export async function changeReservationStatus(
  id: string,
  input: {
    status: ReservationStatus;
    version: string;
    reason?: string;
    notify?: boolean;
  },
): Promise<ApiResult<AdminReservationDetail>> {
  await requireTeam("reservations:manage");
  if (!OBJECT_ID.test(id)) return notFound;
  if (!STATUSES.includes(input.status))
    return { ok: false, status: 400, message: "Unknown status." };
  return adminFetch<AdminReservationDetail>(
    `/admin/reservations/${id}/status`,
    {
      method: "PATCH",
      body: {
        status: input.status,
        version: String(input.version),
        ...(input.reason?.trim() && {
          reason: input.reason.trim().slice(0, 200),
        }),
        notify: input.notify !== false,
      },
    },
  );
}

export async function updateReservation(
  id: string,
  input: UpdatePayload,
): Promise<ApiResult<AdminReservationDetail>> {
  await requireTeam("reservations:manage");
  if (!OBJECT_ID.test(id)) return notFound;
  return adminFetch<AdminReservationDetail>(`/admin/reservations/${id}`, {
    method: "PATCH",
    body: details(input),
  });
}

export async function createReservation(
  input: CreatePayload,
): Promise<ApiResult<AdminReservationDetail>> {
  await requireTeam("reservations:manage");
  return adminFetch<AdminReservationDetail>("/admin/reservations", {
    method: "POST",
    body: {
      ...details(input),
      source: input.source === "walk_in" ? "walk_in" : "phone",
      seatNow: input.seatNow === true,
    },
  });
}

export async function saveReservationNote(
  id: string,
  note: string,
): Promise<ApiResult<AdminReservationDetail>> {
  await requireTeam("reservations:manage");
  if (!OBJECT_ID.test(id)) return notFound;
  return adminFetch<AdminReservationDetail>(`/admin/reservations/${id}/note`, {
    method: "PATCH",
    body: { note: String(note).slice(0, 1000) },
  });
}

function details(input: Partial<UpdatePayload>) {
  const text = (v: unknown, max: number) =>
    String(v ?? "")
      .trim()
      .slice(0, max);
  return {
    ...(input.version && { version: String(input.version) }),
    date: text(input.date, 10),
    time: text(input.time, 5),
    partySize: Number(input.partySize),
    name: text(input.name, 80),
    phone: text(input.phone, 30),
    email: text(input.email, 120),
    occasion: text(input.occasion, 40),
    notes: text(input.notes, 500),
    table: text(input.table, 30),
    notify: input.notify === true,
  };
}
