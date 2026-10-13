"use server";

import { z } from "zod";
import { getUserSession } from "@/lib/auth/get-user";
import { adminFetch, type ApiResult } from "@/admin/lib/menu/api";
import {
  MAX_LINE_NOTE,
  MAX_LINE_QUANTITY,
  type AddToCartInput,
  type Cart,
} from "@/lib/cart";

const OBJECT_ID = /^[0-9a-f]{24}$/i;
const objectId = z.string().regex(OBJECT_ID);
const signedOut = {
  ok: false as const,
  status: 401,
  message: "Sign in to start your order.",
};
const invalid = (message: string) => ({
  ok: false as const,
  status: 400,
  message,
});

const addSchema = z.object({
  itemId: objectId,
  variantId: objectId.optional(),
  optionIds: z.array(objectId).max(40).default([]),
  quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
  note: z.string().trim().max(MAX_LINE_NOTE).optional(),
});

export async function getCart(): Promise<ApiResult<Cart>> {
  if (!(await getUserSession())) return signedOut;
  return adminFetch<Cart>("/cart");
}

export async function addToCart(
  input: AddToCartInput,
): Promise<ApiResult<Cart>> {
  if (!(await getUserSession())) return signedOut;
  const parsed = addSchema.safeParse(input);
  if (!parsed.success)
    return invalid("Something about this dish didn't add up. Open it again.");
  return adminFetch<Cart>("/cart/lines", { method: "POST", body: parsed.data });
}

export async function setCartQuantity(
  lineId: string,
  quantity: number,
): Promise<ApiResult<Cart>> {
  if (!(await getUserSession())) return signedOut;
  if (!OBJECT_ID.test(String(lineId)))
    return invalid("This dish is no longer in your cart.");
  const q = Math.trunc(Number(quantity));
  if (!(q >= 0 && q <= MAX_LINE_QUANTITY))
    return invalid(`Up to ${MAX_LINE_QUANTITY} of one dish.`);
  return adminFetch<Cart>(`/cart/lines/${lineId}`, {
    method: "PATCH",
    body: { quantity: q },
  });
}

export async function removeCartLine(lineId: string): Promise<ApiResult<Cart>> {
  if (!(await getUserSession())) return signedOut;
  if (!OBJECT_ID.test(String(lineId)))
    return invalid("This dish is no longer in your cart.");
  return adminFetch<Cart>(`/cart/lines/${lineId}`, { method: "DELETE" });
}

export async function clearCart(): Promise<ApiResult<Cart>> {
  if (!(await getUserSession())) return signedOut;
  return adminFetch<Cart>("/cart", { method: "DELETE" });
}
