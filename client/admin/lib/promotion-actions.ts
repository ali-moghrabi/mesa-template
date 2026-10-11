"use server";

import { updateTag } from "next/cache";
import { requireTeam } from "@/lib/auth/get-user";
import { getOpeningHours } from "@/lib/opening-hours-server";
import {
  formPath,
  promotionFormIssues,
  toPromotionPayload,
  type AdminPromotion,
  type PromotionFormValues,
} from "./promotions";
import { adminFetch, ApiResult } from "./menu/api";

const MENU_TAG = "menu";
const OBJECT_ID = /^[0-9a-f]{24}$/i;

const restaurantTimezone = async () =>
  (await getOpeningHours())?.timezone ?? "UTC";

export async function savePromotion(
  id: string | null,
  values: PromotionFormValues,
): Promise<ApiResult<AdminPromotion>> {
  await requireTeam("menu:manage");
  if (id !== null && !OBJECT_ID.test(id))
    return {
      ok: false,
      status: 404,
      message: "This promotion no longer exists.",
    };

  const timezone = await restaurantTimezone();
  const issues = promotionFormIssues(values, timezone);
  if (Object.keys(issues).length)
    return {
      ok: false,
      status: 400,
      message: "Please fix the highlighted fields",
      fieldErrors: issues,
    };

  const body = toPromotionPayload(values, timezone);
  const result = id
    ? await adminFetch<AdminPromotion>(`/admin/menu/promotions/${id}`, {
        method: "PATCH",
        body,
      })
    : await adminFetch<AdminPromotion>("/admin/menu/promotions", {
        method: "POST",
        body,
      });
  if (!result.ok && result.fieldErrors) {
    result.fieldErrors = Object.fromEntries(
      Object.entries(result.fieldErrors).map(([path, message]) => [
        formPath(path),
        message,
      ]),
    );
  }
  if (result.ok) updateTag(MENU_TAG);
  return result;
}

export async function setPromotionActive(
  id: string,
  isActive: boolean,
): Promise<ApiResult<AdminPromotion>> {
  await requireTeam("menu:manage");
  if (!OBJECT_ID.test(id))
    return {
      ok: false,
      status: 404,
      message: "This promotion no longer exists.",
    };
  const result = await adminFetch<AdminPromotion>(
    `/admin/menu/promotions/${id}/active`,
    { method: "PATCH", body: { isActive: isActive === true } },
  );
  if (result.ok) updateTag(MENU_TAG);
  return result;
}

export async function deletePromotion(
  id: string,
): Promise<ApiResult<{ deleted: true }>> {
  await requireTeam("menu:manage");
  if (!OBJECT_ID.test(id))
    return {
      ok: false,
      status: 404,
      message: "This promotion no longer exists.",
    };
  const result = await adminFetch<{ deleted: true }>(
    `/admin/menu/promotions/${id}`,
    { method: "DELETE" },
  );
  if (result.ok) updateTag(MENU_TAG);
  return result;
}
