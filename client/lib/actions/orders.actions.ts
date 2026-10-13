"use server";

import { getUserSession } from "@/lib/auth/get-user";
import { adminFetch, type ApiResult } from "@/admin/lib/menu/api";
import type { MyOrders, ReorderResult } from "@/lib/checkout";

const OBJECT_ID = /^[0-9a-f]{24}$/i;
const signedOut = {
  ok: false as const,
  status: 401,
  message: "Sign in to see your orders.",
};

export async function loadMoreOrders(
  before: string,
): Promise<ApiResult<MyOrders>> {
  if (!(await getUserSession())) return signedOut;
  if (Number.isNaN(Date.parse(String(before))))
    return { ok: false, status: 400, message: "Couldn't load more orders." };
  return adminFetch<MyOrders>("/orders/mine", {
    query: new URLSearchParams({ before: String(before) }),
  });
}

export async function reorder(
  orderId: string,
): Promise<ApiResult<ReorderResult>> {
  if (!(await getUserSession())) return signedOut;
  if (!OBJECT_ID.test(String(orderId)))
    return { ok: false, status: 404, message: "Order not found." };
  return adminFetch<ReorderResult>(`/orders/${orderId}/reorder`, {
    method: "POST",
  });
}

export async function fetchActiveOrdersCount(): Promise<number> {
  if (!(await getUserSession())) return 0;
  const result = await adminFetch<{ count: number }>("/orders/active-count");
  return result.ok ? Math.max(0, Number(result.data.count) || 0) : 0;
}
