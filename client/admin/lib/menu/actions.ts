"use server";

import { requireTeam } from "@/lib/auth/get-user";
import { adminFetch, type ApiResult } from "./api";
import {
  categoryFormSchema,
  toCategoryPayload,
  type CategoryFormValues,
} from "./category-schema";
import {
  menuItemFormSchema,
  toCreatePayload,
  toUpdatePayload,
  type EditOrigin,
  type MenuItemFormValues,
} from "./item-schema";
import type { AdminMenuCategory, AdminMenuItem, UploadedImage } from "./types";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export async function uploadMenuImage(
  formData: FormData,
): Promise<ApiResult<UploadedImage>> {
  await requireTeam("menu:manage");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, status: 400, message: "Choose a photo first." };
  if (file.size > MAX_UPLOAD_BYTES)
    return {
      ok: false,
      status: 413,
      message: "The photo is larger than 15 MB.",
    };
  if (!file.type.startsWith("image/"))
    return { ok: false, status: 415, message: "This file isn't a photo." };

  const body = new FormData();
  body.append("file", file, file.name || "photo");
  return adminFetch<UploadedImage>("/admin/media/menu-images", {
    method: "POST",
    body,
  });
}

export async function createMenuItem(
  values: MenuItemFormValues,
): Promise<ApiResult<AdminMenuItem>> {
  await requireTeam("menu:manage");

  const parsed = menuItemFormSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fieldErrors[issue.path.join(".")] ??= issue.message;
    return {
      ok: false,
      status: 400,
      message: "Please fix the highlighted fields",
      fieldErrors,
    };
  }

  return adminFetch<AdminMenuItem>("/admin/menu/items", {
    method: "POST",
    body: toCreatePayload(parsed.data),
  });
}

export async function createMenuCategory(
  values: CategoryFormValues,
): Promise<ApiResult<AdminMenuCategory>> {
  await requireTeam("menu:manage");

  const parsed = categoryFormSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fieldErrors[issue.path.join(".")] ??= issue.message;
    return {
      ok: false,
      status: 400,
      message: "Please fix the highlighted fields",
      fieldErrors,
    };
  }

  return adminFetch<AdminMenuCategory>("/admin/menu/categories", {
    method: "POST",
    body: toCategoryPayload(parsed.data),
  });
}

export async function updateMenuItem(
  id: string,
  values: MenuItemFormValues,
  origin: EditOrigin,
): Promise<ApiResult<AdminMenuItem>> {
  await requireTeam("menu:manage");

  const parsed = menuItemFormSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fieldErrors[issue.path.join(".")] ??= issue.message;
    return {
      ok: false,
      status: 400,
      message: "Please fix the highlighted fields",
      fieldErrors,
    };
  }

  return adminFetch<AdminMenuItem>(
    `/admin/menu/items/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: toUpdatePayload(parsed.data, origin),
    },
  );
}

const OBJECT_ID = /^[0-9a-f]{24}$/i;

export async function deleteMenuItems(
  ids: string[],
): Promise<ApiResult<{ deleted: number; photosDeleted: number }>> {
  await requireTeam("menu:manage");
  const unique = [...new Set(ids)];
  if (
    unique.length === 0 ||
    unique.length > 100 ||
    !unique.every((id) => OBJECT_ID.test(id))
  ) {
    return {
      ok: false,
      status: 400,
      message: "Pick between 1 and 100 dishes.",
    };
  }
  return adminFetch("/admin/menu/items/delete", {
    method: "POST",
    body: { ids: unique },
  });
}

export async function deleteMenuCategories(
  ids: string[],
  deleteDishes: boolean,
): Promise<
  ApiResult<{ deleted: number; dishesDeleted: number; photosDeleted: number }>
> {
  await requireTeam("menu:manage");
  const unique = [...new Set(ids)];
  if (
    unique.length === 0 ||
    unique.length > 50 ||
    !unique.every((id) => OBJECT_ID.test(id))
  ) {
    return {
      ok: false,
      status: 400,
      message: "Pick between 1 and 50 categories.",
    };
  }
  return adminFetch("/admin/menu/categories/delete", {
    method: "POST",
    body: { ids: unique, deleteDishes: deleteDishes === true },
  });
}
