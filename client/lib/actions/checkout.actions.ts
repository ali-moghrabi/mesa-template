"use server";

import { z } from "zod";
import { getUserSession } from "@/lib/auth/get-user";
import { adminFetch, type ApiResult } from "@/admin/lib/menu/api";
import {
  PHONE_PATTERN,
  type OrderView,
  type PlacedOrder,
} from "@/lib/checkout";

const OBJECT_ID = /^[0-9a-f]{24}$/i;
const signedOut = {
  ok: false as const,
  status: 401,
  message: "Sign in to place your order.",
};

const orderSchema = z.object({
  type: z.enum(["delivery", "pickup"]),
  paymentMethod: z.enum(["card", "cash"]),
  address: z
    .object({
      areaId: z.string().max(60).optional(),
      street: z.string().trim().min(3).max(120),
      building: z.string().trim().max(60).optional(),
      floor: z.string().trim().max(20).optional(),
      apartment: z.string().trim().max(20).optional(),
      directions: z.string().trim().max(240).optional(),
    })
    .optional(),
  phone: z.string().trim().regex(PHONE_PATTERN),
  notes: z.string().trim().max(300).optional(),
  cutlery: z.boolean().optional(),
  scheduledFor: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    .optional(),
  tipPercent: z.number().int().min(0).max(50).optional(),
  cashChangeFor: z.number().min(0).max(1_000_000).optional(),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9-]{16,64}$/),
  expectedTotal: z.number().min(0),
  cardToken: z
    .string()
    .regex(/^tok_[A-Za-z0-9]{6,64}$/)
    .optional(),
});

export type PlaceOrderInput = z.infer<typeof orderSchema>;

export async function placeOrder(
  input: PlaceOrderInput,
): Promise<ApiResult<PlacedOrder>> {
  if (!(await getUserSession())) return signedOut;
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      status: 400,
      message: "Some details don't look right. Check the form and try again.",
    };
  return adminFetch<PlacedOrder>("/orders", {
    method: "POST",
    body: parsed.data,
  });
}

export async function confirmOrderPayment(
  orderId: string,
): Promise<ApiResult<OrderView>> {
  if (!(await getUserSession())) return signedOut;
  if (!OBJECT_ID.test(String(orderId)))
    return { ok: false, status: 404, message: "Order not found." };
  return adminFetch<OrderView>(`/orders/${orderId}/confirm-payment`, {
    method: "POST",
  });
}
