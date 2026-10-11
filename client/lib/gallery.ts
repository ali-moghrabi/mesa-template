export const GALLERY_ALBUMS = [
  "general",
  "food",
  "drinks",
  "interior",
  "events",
  "team",
] as const;
export type GalleryAlbum = (typeof GALLERY_ALBUMS)[number];

export const ALBUM_LABELS: Record<GalleryAlbum, string> = {
  general: "General",
  food: "Food",
  drinks: "Drinks",
  interior: "Interior",
  events: "Events",
  team: "Team",
};

export const MAX_GALLERY_PHOTOS = 300;
export const MAX_PHOTOS_PER_ADD = 30;
export const MAX_ALT = 160;
export const MAX_CAPTION = 200;
