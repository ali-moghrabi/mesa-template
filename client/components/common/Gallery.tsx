"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, Expand, ImageOff, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { canOptimize } from "@/admin/lib/menu/format";
import { ALBUM_LABELS, GALLERY_ALBUMS, type GalleryAlbum } from "@/lib/gallery";
import type { PublicGalleryPhoto } from "@/lib/gallery-server";

export type GalleryVariant = "grid" | "masonry";

type Props = {
  photos: PublicGalleryPhoto[];
  variant: GalleryVariant;
  lightbox: boolean;
  showFilters: boolean;
};

const PAGE = 24;
type Filter = GalleryAlbum | "all";

const altOf = (photo: PublicGalleryPhoto) =>
  photo.alt || photo.caption || `${ALBUM_LABELS[photo.album]} photo`;

export function Gallery({ photos, variant, lightbox, showFilters }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [opened, setOpened] = useState<{ filter: Filter; count: number }>({
    filter: "all",
    count: PAGE,
  });
  const [viewing, setViewing] = useState<number | null>(null);

  const albums = GALLERY_ALBUMS.map((album) => ({
    album,
    count: photos.filter((p) => p.album === album).length,
  })).filter((a) => a.count > 0);
  const list =
    filter === "all" ? photos : photos.filter((p) => p.album === filter);
  const count = opened.filter === filter ? opened.count : PAGE;
  const visible = list.slice(0, count);
  const left = list.length - visible.length;

  const choose = (next: Filter) => {
    setFilter(next);
    setViewing(null);
  };

  if (photos.length === 0) {
    return (
      <div className="px-(--pad) py-24 [--pad:clamp(1.1rem,4vw,3.5rem)]">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <span className="grid size-16 place-items-center rounded-full bg-foreground/5 text-foreground/45">
            <ImageOff className="size-7" />
          </span>
          <p className="mt-5 text-xl font-medium">Photos are on their way</p>
          <p className="mt-1.5 text-pretty text-foreground/60">
            We&apos;re choosing our favourite shots of the food and the room.
            Come back soon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-(--pad) pt-10 pb-24 [--pad:clamp(1.1rem,4vw,3.5rem)] sm:pt-14">
      <div className="mx-auto max-w-6xl">
        {showFilters && albums.length > 1 && (
          <div
            role="group"
            aria-label="Albums"
            className="-mx-(--pad) mb-8 flex gap-1.5 overflow-x-auto px-(--pad) pb-1 scrollbar-none sm:mb-10 sm:flex-wrap [&::-webkit-scrollbar]:hidden"
          >
            <Chip
              on={filter === "all"}
              onClick={() => choose("all")}
              label="All"
              count={photos.length}
            />
            {albums.map((a) => (
              <Chip
                key={a.album}
                on={filter === a.album}
                onClick={() => choose(a.album)}
                label={ALBUM_LABELS[a.album]}
                count={a.count}
              />
            ))}
          </div>
        )}

        {variant === "masonry" ? (
          <ul className="columns-2 gap-3 sm:gap-4 md:columns-3 xl:columns-4 [&>li]:mb-3 sm:[&>li]:mb-4">
            {visible.map((photo, i) => (
              <li key={photo.id} className="break-inside-avoid">
                <Tile
                  photo={photo}
                  index={i}
                  lightbox={lightbox}
                  onOpen={() => setViewing(i)}
                  sizes="(min-width: 1280px) 280px, (min-width: 768px) 33vw, 50vw"
                  natural
                />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="grid grid-flow-dense grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {visible.map((photo, i) => (
              <li
                key={photo.id}
                className={cn(photo.isFeatured && "col-span-2 row-span-2")}
              >
                <Tile
                  photo={photo}
                  index={i}
                  lightbox={lightbox}
                  onOpen={() => setViewing(i)}
                  sizes={
                    photo.isFeatured
                      ? "(min-width: 1024px) 570px, (min-width: 768px) 66vw, 100vw"
                      : "(min-width: 1024px) 280px, (min-width: 768px) 33vw, 50vw"
                  }
                />
              </li>
            ))}
          </ul>
        )}

        {left > 0 && (
          <div className="mt-12 flex flex-col items-center gap-3">
            <p className="text-sm text-foreground/55 tabular-nums">
              Showing {visible.length} of {list.length}
            </p>
            <button
              type="button"
              onClick={() => setOpened({ filter, count: count + PAGE })}
              className="h-12 rounded-full border border-foreground/20 px-7 font-semibold transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
            >
              Show {Math.min(left, PAGE)} more
            </button>
          </div>
        )}
      </div>

      {lightbox && viewing !== null && visible[viewing] && (
        <Lightbox
          photos={visible}
          index={viewing}
          onIndex={setViewing}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}

function Chip({
  on,
  onClick,
  label,
  count,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-[15px] font-medium whitespace-nowrap transition-all",
        on
          ? "border-foreground bg-foreground text-background"
          : "border-foreground/15 text-foreground/75 hover:border-foreground/35 hover:text-foreground",
      )}
    >
      {label}
      <span
        className={cn(
          "text-xs tabular-nums",
          on ? "text-background/60" : "text-foreground/40",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function Tile({
  photo,
  index,
  lightbox,
  onOpen,
  sizes,
  natural,
}: {
  photo: PublicGalleryPhoto;
  index: number;
  lightbox: boolean;
  onOpen: () => void;
  sizes: string;
  natural?: boolean;
}) {
  const style: CSSProperties | undefined = natural
    ? { aspectRatio: `${photo.width} / ${photo.height}` }
    : undefined;
  const inner = (
    <>
      <Image
        src={photo.url}
        alt={altOf(photo)}
        fill
        sizes={sizes}
        priority={index < 4}
        placeholder={photo.imageBlur ? "blur" : "empty"}
        blurDataURL={photo.imageBlur}
        unoptimized={!canOptimize(photo.url)}
        className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
      />
      <span className="absolute inset-0 bg-linear-to-t from-black/70 via-black/0 to-black/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100" />
      <span className="absolute inset-x-3 bottom-3 flex translate-y-1 items-end justify-between gap-3 text-left text-white opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 sm:inset-x-4 sm:bottom-4">
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold tracking-[0.16em] text-white/70 uppercase">
            {ALBUM_LABELS[photo.album]}
          </span>
          {photo.caption && (
            <span className="mt-0.5 line-clamp-2 block text-sm leading-snug font-medium">
              {photo.caption}
            </span>
          )}
        </span>
        {lightbox && (
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/20 backdrop-blur">
            <Expand className="size-4" />
          </span>
        )}
      </span>
    </>
  );

  const frame = cn(
    "group relative block w-full overflow-hidden rounded-[calc(var(--radius,0.75rem)*1.4)] bg-foreground/[0.06]",
    !natural && "aspect-square",
  );

  return lightbox ? (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open photo: ${altOf(photo)}`}
      style={style}
      className={cn(
        frame,
        "cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
      )}
    >
      {inner}
    </button>
  ) : (
    <figure style={style} className={frame}>
      {inner}
    </figure>
  );
}

function Lightbox({
  photos,
  index,
  onIndex,
  onClose,
}: {
  photos: PublicGalleryPhoto[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const photo = photos[index];
  const total = photos.length;
  const go = (step: number) => onIndex((index + step + total) % total);

  const dialog = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const goRef = useRef(go);
  const closeRef = useRef(onClose);
  useEffect(() => {
    goRef.current = go;
    closeRef.current = onClose;
  });
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      else if (event.key === "ArrowRight") goRef.current(1);
      else if (event.key === "ArrowLeft") goRef.current(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      opener?.focus();
    };
  }, []);

  useEffect(() => {
    const row = strip.current;
    const thumb = row?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    if (row && thumb)
      row.scrollTo({
        left: thumb.offsetLeft - row.clientWidth / 2 + thumb.offsetWidth / 2,
        behavior: "smooth",
      });
  }, [index]);

  const neighbours =
    total > 1
      ? [photos[(index + 1) % total], photos[(index - 1 + total) % total]]
      : [];
  const arrow =
    "absolute top-1/2 z-10 hidden size-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white sm:grid";

  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      tabIndex={-1}
      className="fixed inset-0 z-100 flex flex-col bg-neutral-950 text-white outline-none"
    >
      <div className="flex shrink-0 items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        <p className="text-sm text-white/70 tabular-nums">
          <span className="font-semibold text-white">{index + 1}</span> /{" "}
          {total}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid size-11 place-items-center rounded-full bg-white/10 transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
        >
          <X className="size-5" />
        </button>
      </div>

      <div
        className="relative min-h-0 flex-1 touch-pan-y select-none"
        onTouchStart={(event) =>
          (touch.current = {
            x: event.touches[0].clientX,
            y: event.touches[0].clientY,
          })
        }
        onTouchEnd={(event) => {
          const start = touch.current;
          touch.current = null;
          if (!start || total < 2) return;
          const dx = event.changedTouches[0].clientX - start.x;
          const dy = event.changedTouches[0].clientY - start.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy))
            go(dx < 0 ? 1 : -1);
          else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) onClose();
        }}
      >
        <div
          key={photo.id}
          className="absolute inset-0 mx-4 transition duration-300 ease-out starting:scale-[0.98] starting:opacity-0 sm:mx-20"
        >
          <Image
            src={photo.url}
            alt={altOf(photo)}
            fill
            sizes="100vw"
            priority
            placeholder={photo.imageBlur ? "blur" : "empty"}
            blurDataURL={photo.imageBlur}
            unoptimized={!canOptimize(photo.url)}
            className="object-contain"
          />
        </div>
        {neighbours.map((p) => (
          <Image
            key={`pre-${p.id}`}
            src={p.url}
            alt=""
            width={16}
            height={16}
            sizes="100vw"
            unoptimized={!canOptimize(p.url)}
            className="pointer-events-none absolute size-px opacity-0"
            aria-hidden
          />
        ))}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous photo"
              className={cn(arrow, "left-4 sm:left-6")}
            >
              <ChevronLeft className="size-6" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next photo"
              className={cn(arrow, "right-4 sm:right-6")}
            >
              <ChevronRight className="size-6" />
            </button>
          </>
        )}
      </div>

      <div className="shrink-0 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-white/55 uppercase">
            {ALBUM_LABELS[photo.album]}
          </p>
          {(photo.caption || photo.alt) && (
            <p className="mt-1 line-clamp-2 text-[15px] text-pretty text-white/90">
              {photo.caption || photo.alt}
            </p>
          )}
        </div>
        {total > 1 && (
          <div
            ref={strip}
            className="mx-auto mt-4 hidden max-w-4xl gap-2 overflow-x-auto px-1 py-1 scrollbar-none sm:flex [&::-webkit-scrollbar]:hidden"
          >
            {photos.map((p, i) => (
              <button
                key={p.id}
                type="button"
                data-index={i}
                onClick={() => onIndex(i)}
                aria-label={`Photo ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
                className={cn(
                  "relative size-14 shrink-0 overflow-hidden rounded-lg transition",
                  i === index
                    ? "opacity-100 ring-2 ring-white ring-offset-2 ring-offset-neutral-950"
                    : "opacity-45 hover:opacity-80",
                )}
              >
                <Image
                  src={p.url}
                  alt=""
                  fill
                  sizes="56px"
                  unoptimized={!canOptimize(p.url)}
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
