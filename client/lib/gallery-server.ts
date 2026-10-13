import "server-only";
import { cache } from "react";
import type { GalleryAlbum } from "@/lib/gallery";

export const GALLERY_TAG = "gallery";

export type PublicGalleryPhoto = {
  id: string;
  url: string;
  imageBlur?: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
  album: GalleryAlbum;
  isFeatured: boolean;
};

export type GalleryResult =
  | { ok: true; photos: PublicGalleryPhoto[] }
  | { ok: false; message: string };

export const getPublicGallery = cache(async (): Promise<GalleryResult> => {
  const base = (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    ""
  ).replace(/\/+$/, "");
  if (!base)
    return {
      ok: false,
      message: "The gallery isn't connected yet (API_URL is not set).",
    };
  try {
    const response = await fetch(`${base}/gallery`, {
      next: { tags: [GALLERY_TAG], revalidate: 3600 },
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok)
      return { ok: false, message: "The photos couldn't be loaded right now." };
    return {
      ok: true,
      photos: (await response.json()) as PublicGalleryPhoto[],
    };
  } catch (error) {
    console.error("[gallery] API unavailable:", error);
    return { ok: false, message: "The photos couldn't be loaded right now." };
  }
});
