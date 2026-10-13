"use server";

import { requireTeam } from "@/lib/auth/get-user";
import { adminFetch, type ApiResult } from "./menu/api";
import type {
  AdminOrder,
  Board,
  EditPayload,
  HistoryFilters,
  OrdersFeed,
  OrdersPage,
} from "./orders";
import type { OrderStatus } from "@/lib/checkout";

const OBJECT_ID = /^[0-9a-f]{24}$/i;
const STATUSES: OrderStatus[] = [
  "placed",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
  "cancelled",
];
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const notFound = {
  ok: false as const,
  status: 404,
  message: "This order no longer exists.",
};
const invalid = (message: string) => ({
  ok: false as const,
  status: 400,
  message,
});

export async function fetchBoard(): Promise<ApiResult<Board>> {
  await requireTeam("orders:manage");
  return adminFetch<Board>("/admin/orders/board");
}

export async function fetchOrdersFeed(
  after?: string,
): Promise<ApiResult<OrdersFeed>> {
  await requireTeam("orders:manage");
  const query = new URLSearchParams();
  if (after && !Number.isNaN(Date.parse(after))) query.set("after", after);
  return adminFetch<OrdersFeed>("/admin/orders/feed", { query });
}

export async function fetchOrdersPage(
  filters: HistoryFilters,
): Promise<ApiResult<OrdersPage>> {
  await requireTeam("orders:manage");
  const query = new URLSearchParams();
  if (
    filters.status &&
    (filters.status === "active" ||
      STATUSES.includes(filters.status as OrderStatus))
  )
    query.set("status", filters.status);
  if (filters.type === "delivery" || filters.type === "pickup")
    query.set("type", filters.type);
  if (filters.q?.trim()) query.set("q", filters.q.trim().slice(0, 60));
  if (filters.from && DAY.test(filters.from)) query.set("from", filters.from);
  if (filters.to && DAY.test(filters.to)) query.set("to", filters.to);
  if (filters.page && filters.page > 1)
    query.set("page", String(Math.min(1000, Math.trunc(filters.page))));
  return adminFetch<OrdersPage>("/admin/orders", { query });
}

export async function fetchOrder(id: string): Promise<ApiResult<AdminOrder>> {
  await requireTeam("orders:manage");
  if (!OBJECT_ID.test(String(id))) return notFound;
  return adminFetch<AdminOrder>(`/admin/orders/${id}`);
}

export async function changeOrderStatus(
  id: string,
  input: {
    status: OrderStatus;
    version: string;
    reason?: string;
    refund?: boolean;
  },
): Promise<ApiResult<AdminOrder>> {
  await requireTeam("orders:manage");
  if (!OBJECT_ID.test(String(id))) return notFound;
  if (!STATUSES.includes(input.status)) return invalid("Pick a status.");
  if (input.status === "cancelled" && !input.reason?.trim())
    return invalid("Say why the order is cancelled.");
  return adminFetch<AdminOrder>(`/admin/orders/${id}/status`, {
    method: "PATCH",
    body: {
      status: input.status,
      version: String(input.version),
      reason: input.reason?.trim().slice(0, 240) || undefined,
      refund: input.refund === true,
    },
  });
}

export async function saveStaffNote(
  id: string,
  note: string,
): Promise<ApiResult<AdminOrder>> {
  await requireTeam("orders:manage");
  if (!OBJECT_ID.test(String(id))) return notFound;
  return adminFetch<AdminOrder>(`/admin/orders/${id}/note`, {
    method: "PATCH",
    body: { note: String(note ?? "").slice(0, 500) },
  });
}

export async function editOrderItems(
  id: string,
  payload: EditPayload,
): Promise<ApiResult<AdminOrder>> {
  await requireTeam("orders:edit");
  if (!OBJECT_ID.test(String(id))) return notFound;
  if (!Array.isArray(payload.lines) || payload.lines.length === 0)
    return invalid("An order needs at least one dish. Cancel it instead.");
  if (!payload.reason?.trim()) return invalid("Say why the order changed.");
  return adminFetch<AdminOrder>(`/admin/orders/${id}/items`, {
    method: "PATCH",
    body: payload,
  });
}

export async function refundOrder(
  id: string,
  amount: number,
  reason: string,
): Promise<ApiResult<AdminOrder>> {
  await requireTeam("orders:edit");
  if (!OBJECT_ID.test(String(id))) return notFound;
  if (!(amount > 0)) return invalid("Enter an amount to refund.");
  if (!reason?.trim()) return invalid("Say why you refund.");
  return adminFetch<AdminOrder>(`/admin/orders/${id}/refund`, {
    method: "POST",
    body: { amount: Math.round(amount * 100) / 100, reason: reason.trim() },
  });
}
