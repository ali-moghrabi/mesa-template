"use server";

import { updateTag } from "next/cache";
import { requireTeam } from "@/lib/auth/get-user";
import {
  GALLERY_ALBUMS,
  MAX_ALT,
  MAX_CAPTION,
  MAX_PHOTOS_PER_ADD,
  type GalleryAlbum,
} from "@/lib/gallery";
import { adminFetch, type ApiResult } from "./menu/api";
import type { UploadedImage } from "./menu/types";

export type AdminGalleryPhoto = {
  id: string;
  url: string;
  imageBlur?: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
  album: GalleryAlbum;
  isVisible: boolean;
  isFeatured: boolean;
  sortOrder: number;
  createdAt: string;
};

export type GalleryChanges = Partial<
  Pick<
    AdminGalleryPhoto,
    "alt" | "caption" | "album" | "isVisible" | "isFeatured"
  >
>;

const GALLERY_TAG = "gallery";
const OBJECT_ID = /^[0-9a-f]{24}$/i;
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

const invalid = (message: string) => ({
  ok: false as const,
  status: 400,
  message,
});
const validIds = (ids: string[]) =>
  Array.isArray(ids) &&
  ids.length > 0 &&
  ids.length <= 300 &&
  ids.every((id) => OBJECT_ID.test(id));

function cleanChanges(changes: GalleryChanges): GalleryChanges | null {
  const out: GalleryChanges = {};
  if (changes.alt !== undefined)
    out.alt = String(changes.alt).trim().slice(0, MAX_ALT);
  if (changes.caption !== undefined)
    out.caption = String(changes.caption).trim().slice(0, MAX_CAPTION);
  if (changes.album !== undefined) {
    if (!(GALLERY_ALBUMS as readonly string[]).includes(changes.album))
      return null;
    out.album = changes.album;
  }
  if (changes.isVisible !== undefined)
    out.isVisible = changes.isVisible === true;
  if (changes.isFeatured !== undefined)
    out.isFeatured = changes.isFeatured === true;
  return out;
}

const done = <T>(result: ApiResult<T>) => {
  if (result.ok) updateTag(GALLERY_TAG);
  return result;
};

export async function uploadGalleryImage(
  formData: FormData,
): Promise<ApiResult<UploadedImage>> {
  await requireTeam("content:manage");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return invalid("Choose a photo first.");
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

export async function addGalleryPhotos(
  photos: {
    image: string;
    width: number;
    height: number;
    alt?: string;
    album?: GalleryAlbum;
  }[],
): Promise<ApiResult<{ added: AdminGalleryPhoto[]; failed: number }>> {
  await requireTeam("content:manage");
  if (
    !Array.isArray(photos) ||
    photos.length === 0 ||
    photos.length > MAX_PHOTOS_PER_ADD
  )
    return invalid("Add between 1 and 30 photos at a time.");
  const body = photos.map((p) => ({
    image: String(p.image),
    width: Math.round(Number(p.width)),
    height: Math.round(Number(p.height)),
    ...(p.alt && { alt: String(p.alt).trim().slice(0, MAX_ALT) }),
    ...(p.album &&
      (GALLERY_ALBUMS as readonly string[]).includes(p.album) && {
        album: p.album,
      }),
  }));
  return done(
    await adminFetch("/admin/gallery", {
      method: "POST",
      body: { photos: body },
    }),
  );
}

export async function updateGalleryPhoto(
  id: string,
  changes: GalleryChanges,
): Promise<ApiResult<AdminGalleryPhoto>> {
  await requireTeam("content:manage");
  const clean = cleanChanges(changes);
  if (!OBJECT_ID.test(id) || !clean)
    return invalid("This photo can't be changed like that.");
  return done(
    await adminFetch<AdminGalleryPhoto>(`/admin/gallery/${id}`, {
      method: "PATCH",
      body: clean,
    }),
  );
}

export async function bulkUpdateGallery(
  ids: string[],
  set: GalleryChanges,
): Promise<ApiResult<{ updated: number }>> {
  await requireTeam("content:manage");
  const clean = cleanChanges({
    album: set.album,
    isVisible: set.isVisible,
    isFeatured: set.isFeatured,
  });
  if (!validIds(ids) || !clean || Object.keys(clean).length === 0)
    return invalid("Pick photos and what to change.");
  return done(
    await adminFetch("/admin/gallery/bulk", {
      method: "POST",
      body: { ids, set: clean },
    }),
  );
}

export async function reorderGallery(
  ids: string[],
): Promise<ApiResult<{ ok: true }>> {
  await requireTeam("content:manage");
  if (!validIds(ids) || new Set(ids).size !== ids.length)
    return invalid("The order couldn't be read.");
  return done(
    await adminFetch("/admin/gallery/reorder", {
      method: "POST",
      body: { ids },
    }),
  );
}

export async function deleteGalleryPhotos(
  ids: string[],
): Promise<ApiResult<{ deleted: number; filesDeleted: number }>> {
  await requireTeam("content:manage");
  if (!validIds(ids)) return invalid("Pick between 1 and 300 photos.");
  return done(
    await adminFetch("/admin/gallery/delete", {
      method: "POST",
      body: { ids },
    }),
  );
}
