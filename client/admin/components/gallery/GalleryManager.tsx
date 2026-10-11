"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Eye,
  EyeOff,
  FolderInput,
  GripVertical,
  ImagePlus,
  Images,
  ListChecks,
  LoaderCircle,
  RotateCw,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  ALBUM_LABELS,
  GALLERY_ALBUMS,
  MAX_ALT,
  MAX_CAPTION,
  MAX_GALLERY_PHOTOS,
  type GalleryAlbum,
} from "@/lib/gallery";
import { canOptimize } from "@/admin/lib/menu/format";
import { MAX_PICK_BYTES, prepareImage } from "@/admin/lib/prepare-image";
import {
  addGalleryPhotos,
  bulkUpdateGallery,
  deleteGalleryPhotos,
  reorderGallery,
  updateGalleryPhoto,
  uploadGalleryImage,
  type AdminGalleryPhoto,
  type GalleryChanges,
} from "@/admin/lib/gallery-actions";
import { Switch, inputClass } from "@/admin/components/menu/FormParts";

type Photo = AdminGalleryPhoto;
type Tab = "all" | GalleryAlbum;
type Filter = "everything" | "featured" | "hidden" | "no-alt";

/* ───────────── the page ───────────── */

export function GalleryManager({ photos: fromServer }: { photos: Photo[] }) {
  const router = useRouter();

  const [photos, setPhotos] = useState(fromServer);
  const [seen, setSeen] = useState(fromServer);
  if (fromServer !== seen) {
    setSeen(fromServer);
    setPhotos(fromServer);
  }

  const [tab, setTab] = useState<Tab>("all");
  const [filter, setFilter] = useState<Filter>("everything");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const uploads = useUploads(
    (added) => setPhotos((current) => [...added, ...current]),
    () => router.refresh(),
  );

  const counts = useMemo(() => {
    const byAlbum = Object.fromEntries(
      GALLERY_ALBUMS.map((a) => [a, 0]),
    ) as Record<GalleryAlbum, number>;
    for (const p of photos) byAlbum[p.album]++;
    return {
      byAlbum,
      featured: photos.filter((p) => p.isFeatured).length,
      hidden: photos.filter((p) => !p.isVisible).length,
      noAlt: photos.filter((p) => !p.alt.trim()).length,
    };
  }, [photos]);

  const shown = photos.filter(
    (p) =>
      (tab === "all" || p.album === tab) &&
      (filter === "everything" ||
        (filter === "featured" && p.isFeatured) ||
        (filter === "hidden" && !p.isVisible) ||
        (filter === "no-alt" && !p.alt.trim())),
  );
  const canReorder =
    tab === "all" && filter === "everything" && !selecting && photos.length > 1;
  const editingIndex = shown.findIndex((p) => p.id === editingId);
  const editing = editingIndex >= 0 ? shown[editingIndex] : null;

  const patch = (id: string, changes: Partial<Photo>) =>
    setPhotos((list) =>
      list.map((p) => (p.id === id ? { ...p, ...changes } : p)),
    );
  const quick = useMutation({
    mutationFn: async ({
      id,
      changes,
    }: {
      id: string;
      changes: GalleryChanges;
      before: Photo;
    }) => {
      const result = await updateGalleryPhoto(id, changes);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onMutate: ({ id, changes }) => patch(id, changes),
    onError: (error, { id, before }) => {
      patch(id, before);
      toast.add({
        title: "Nothing changed",
        description: error.message,
        type: "error",
      });
    },
  });
  const toggle = (photo: Photo, key: "isVisible" | "isFeatured") =>
    quick.mutate({
      id: photo.id,
      changes: { [key]: !photo[key] },
      before: photo,
    });

  const reorder = useMutation({
    mutationFn: async ({ ids }: { ids: string[]; before: Photo[] }) => {
      const result = await reorderGallery(ids);
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: () => toast.add({ title: "New order saved", type: "success" }),
    onError: (error, { before }) => {
      setPhotos(before);
      toast.add({
        title: "The order wasn't saved",
        description: error.message,
        type: "error",
      });
    },
  });
  const move = (id: string, to: number) => {
    const from = photos.findIndex((p) => p.id === id);
    if (from < 0 || to < 0 || to >= photos.length || from === to) return;
    const next = [...photos];
    const [photo] = next.splice(from, 1);
    next.splice(to, 0, photo);
    setPhotos(next);
    reorder.mutate({ ids: next.map((p) => p.id), before: photos });
  };
  const drag = useDragSort(photos, setPhotos, (next, before) =>
    reorder.mutate({ ids: next.map((p) => p.id), before }),
  );

  const pick = (files: FileList | File[] | null) => {
    const list = Array.from(files ?? []).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (list.length === 0) return;
    const room = MAX_GALLERY_PHOTOS - photos.length - uploads.pending;
    if (room <= 0) {
      toast.add({
        title: "The gallery is full",
        description: `It holds ${MAX_GALLERY_PHOTOS} photos. Delete a few old ones first.`,
        type: "error",
      });
      return;
    }
    const tooBig = list.filter((f) => f.size > MAX_PICK_BYTES).length;
    const ok = list.filter((f) => f.size <= MAX_PICK_BYTES).slice(0, room);
    if (tooBig)
      toast.add({
        title: `${tooBig} ${tooBig === 1 ? "photo is" : "photos are"} over 40 MB and ${tooBig === 1 ? "was" : "were"} skipped`,
        type: "error",
      });
    if (list.length - tooBig > room)
      toast.add({
        title: `Only ${room} more ${room === 1 ? "photo fits" : "photos fit"} in the gallery`,
        type: "error",
      });
    uploads.start(ok, tab === "all" ? "general" : tab);
  };

  const isFiles = (event: DragEvent) =>
    Array.from(event.dataTransfer.types).includes("Files");

  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  return (
    <div
      className="relative"
      onDragEnter={(event) => {
        if (isFiles(event)) setDropping(true);
      }}
    >
      <header className="flex flex-col gap-4 pt-6 pb-6 sm:flex-row sm:items-end sm:justify-between lg:pt-10">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            Restaurant
          </p>
          <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-tight sm:text-3xl">
            Gallery
          </h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-[15px]">
            {photos.length === 0
              ? "The photos guests see on the website: your room, your plates, your team."
              : `${photos.length} ${photos.length === 1 ? "photo" : "photos"}${counts.hidden ? ` · ${counts.hidden} hidden` : ""}${
                  counts.featured
                    ? ` · ${counts.featured} on the home page`
                    : ""
                }`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {photos.length > 0 && (
            <button
              type="button"
              onClick={selecting ? stopSelecting : () => setSelecting(true)}
              aria-pressed={selecting}
              className={cn(
                "inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border px-3.5 text-sm font-medium shadow-xs transition-colors sm:flex-none",
                selecting
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card hover:bg-muted",
              )}
            >
              <ListChecks className="size-4" />
              {selecting ? "Done" : "Select"}
            </button>
          )}
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="group inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold whitespace-nowrap text-primary-foreground shadow-[0_6px_20px_-6px_color-mix(in_srgb,var(--primary)_70%,transparent)] transition hover:-translate-y-px hover:brightness-110 sm:flex-none"
          >
            <Upload className="size-4.5" />
            Upload photos
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => {
              pick(event.target.files);
              event.target.value = "";
            }}
          />
        </div>
      </header>

      {photos.length === 0 && uploads.items.length === 0 ? (
        <EmptyState onPick={() => fileInput.current?.click()} />
      ) : (
        <>
          <nav
            aria-label="Albums"
            className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden"
          >
            <Chip
              active={tab === "all"}
              onClick={() => setTab("all")}
              label="All"
              count={photos.length}
            />
            {GALLERY_ALBUMS.map((album) => (
              <Chip
                key={album}
                active={tab === album}
                onClick={() => setTab(album)}
                label={ALBUM_LABELS[album]}
                count={counts.byAlbum[album]}
                muted={counts.byAlbum[album] === 0}
              />
            ))}
          </nav>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div
              role="radiogroup"
              aria-label="Show"
              className="flex flex-wrap gap-1.5"
            >
              {(
                [
                  {
                    value: "everything",
                    label: "Everything",
                    count: null,
                    icon: null,
                  },
                  {
                    value: "featured",
                    label: "Home page",
                    count: counts.featured,
                    icon: <Star className="size-3.5" />,
                  },
                  {
                    value: "hidden",
                    label: "Hidden",
                    count: counts.hidden,
                    icon: <EyeOff className="size-3.5" />,
                  },
                  {
                    value: "no-alt",
                    label: "No description",
                    count: counts.noAlt,
                    icon: <CircleAlert className="size-3.5" />,
                  },
                ] as const
              ).map((f) => (
                <button
                  key={f.value}
                  type="button"
                  role="radio"
                  aria-checked={filter === f.value}
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors",
                    filter === f.value
                      ? "bg-foreground/8 text-foreground ring-1 ring-foreground/15"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    f.value === "no-alt" && f.count
                      ? "text-amber-700 dark:text-amber-300"
                      : "",
                  )}
                >
                  {f.icon}
                  {f.label}
                  {f.count !== null && (
                    <span className="tabular-nums opacity-70">{f.count}</span>
                  )}
                </button>
              ))}
            </div>
            <p className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              {canReorder ? (
                <>
                  <GripVertical className="size-3.5" /> Drag photos to change
                  their order
                </>
              ) : tab !== "all" || filter !== "everything" ? (
                "Open “All” to change the order"
              ) : null}
            </p>
          </div>

          {shown.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center">
              <p className="font-semibold">Nothing here</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {tab !== "all"
                  ? `No photos in ${ALBUM_LABELS[tab]}${filter !== "everything" ? " with this filter" : ""} yet.`
                  : "No photo matches this filter."}
              </p>
            </div>
          ) : (
            <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
              {shown.map((photo) => (
                <PhotoTile
                  key={photo.id}
                  photo={photo}
                  position={photos.indexOf(photo) + 1}
                  selecting={selecting}
                  selected={selected.has(photo.id)}
                  draggable={canReorder}
                  dragging={drag.dragId === photo.id}
                  dragProps={canReorder ? drag.props(photo.id) : undefined}
                  onOpen={() => {
                    if (selecting) {
                      setSelected((s) => {
                        const next = new Set(s);
                        if (next.has(photo.id)) next.delete(photo.id);
                        else next.add(photo.id);
                        return next;
                      });
                    } else setEditingId(photo.id);
                  }}
                  onToggle={(key) => toggle(photo, key)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {selecting && (
        <SelectionBar
          photos={photos}
          shown={shown}
          selected={selected}
          setSelected={setSelected}
          onStop={stopSelecting}
          onChanged={(ids, changes) =>
            setPhotos((list) =>
              list.map((p) => (ids.includes(p.id) ? { ...p, ...changes } : p)),
            )
          }
          onDeleted={(ids) => {
            setPhotos((list) => list.filter((p) => !ids.includes(p.id)));
            stopSelecting();
            router.refresh();
          }}
        />
      )}

      {editing && (
        <PhotoDialog
          key={editing.id}
          photo={editing}
          index={editingIndex}
          total={shown.length}
          position={photos.indexOf(editing)}
          count={photos.length}
          canMove={tab === "all" && filter === "everything"}
          onClose={() => setEditingId(null)}
          onGo={(step) =>
            setEditingId(
              shown[(editingIndex + step + shown.length) % shown.length].id,
            )
          }
          onSaved={(saved) => patch(saved.id, saved)}
          onMove={(to) => move(editing.id, to)}
          onDeleted={() => {
            setPhotos((list) => list.filter((p) => p.id !== editing.id));
            setEditingId(null);
            router.refresh();
          }}
        />
      )}

      {uploads.items.length > 0 && <UploadTray uploads={uploads} />}

      {dropping && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-6 backdrop-blur-sm"
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }}
          onDragLeave={(event) => {
            if (event.currentTarget === event.target) setDropping(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDropping(false);
            pick(event.dataTransfer.files);
          }}
        >
          <div className="pointer-events-none flex w-full max-w-md flex-col items-center rounded-3xl border-2 border-dashed border-primary bg-card/90 px-8 py-14 text-center shadow-2xl">
            <span className="grid size-16 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <ImagePlus className="size-8" />
            </span>
            <p className="mt-4 text-lg font-semibold">Drop to upload</p>
            <p className="mt-1 text-sm text-muted-foreground">
              They&apos;ll be added to{" "}
              {tab === "all" ? ALBUM_LABELS.general : ALBUM_LABELS[tab]}. You
              can move them later.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
  count,
  muted,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap transition-all",
        active
          ? "border-foreground bg-foreground text-background shadow-sm"
          : cn(
              "border-border bg-card hover:border-foreground/25 hover:text-foreground",
              muted ? "text-muted-foreground" : "text-foreground/80",
            ),
      )}
    >
      {label}
      <span
        className={cn(
          "min-w-5 rounded-full px-1.5 text-center text-[11px] tabular-nums",
          active ? "bg-background/15" : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function PhotoTile({
  photo,
  position,
  selecting,
  selected,
  draggable,
  dragging,
  dragProps,
  onOpen,
  onToggle,
}: {
  photo: Photo;
  position: number;
  selecting: boolean;
  selected: boolean;
  draggable: boolean;
  dragging: boolean;
  dragProps?: ReturnType<ReturnType<typeof useDragSort>["props"]>;
  onOpen: () => void;
  onToggle: (key: "isVisible" | "isFeatured") => void;
}) {
  const label = photo.alt.trim() || `Photo ${position}`;
  return (
    <li
      {...dragProps}
      draggable={draggable}
      className={cn(
        "group relative aspect-square overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/5 transition-all",
        dragging && "scale-95 opacity-40",
        selected && "ring-4 ring-primary",
        draggable && "cursor-grab active:cursor-grabbing",
      )}
    >
      <PhotoImage
        photo={photo}
        sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
        className={cn(!photo.isVisible && "opacity-45 grayscale")}
      />

      <button
        type="button"
        onClick={onOpen}
        aria-label={
          selecting
            ? `${selected ? "Unselect" : "Select"} ${label}`
            : `Edit ${label}`
        }
        className="absolute inset-0 z-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/60 focus-visible:ring-inset"
      />

      <div className="pointer-events-none absolute inset-x-2 top-2 z-2 flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {selecting && (
            <span
              className={cn(
                "grid size-6 place-items-center rounded-md border-2 shadow-sm",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-white/80 bg-black/25 backdrop-blur",
              )}
            >
              {selected && <Check className="size-4" strokeWidth={3} />}
            </span>
          )}
          {!photo.isVisible && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
              <EyeOff className="size-3" /> Hidden
            </span>
          )}
          {photo.isFeatured && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-semibold text-amber-950 shadow-sm">
              <Star className="size-3 fill-current" /> Home
            </span>
          )}
        </div>
        {draggable && (
          <span className="grid size-7 place-items-center rounded-md bg-black/45 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
            <GripVertical className="size-4" />
          </span>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-2 flex items-end gap-2 bg-linear-to-t from-black/70 via-black/25 to-transparent p-2 pt-8">
        <p
          className={cn(
            "min-w-0 flex-1 truncate text-xs",
            photo.alt.trim() ? "text-white/90" : "font-medium text-amber-300",
          )}
        >
          {photo.alt.trim() || (
            <span className="inline-flex items-center gap-1">
              <CircleAlert className="size-3.5" /> No description
            </span>
          )}
        </p>
        {!selecting && (
          <span className="pointer-events-auto flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            <QuickButton
              label={
                photo.isFeatured
                  ? "Remove from the home page"
                  : "Show on the home page"
              }
              onClick={() => onToggle("isFeatured")}
              active={photo.isFeatured}
            >
              <Star
                className={cn("size-4", photo.isFeatured && "fill-current")}
              />
            </QuickButton>
            <QuickButton
              label={
                photo.isVisible
                  ? "Hide from the website"
                  : "Show on the website"
              }
              onClick={() => onToggle("isVisible")}
            >
              {photo.isVisible ? (
                <Eye className="size-4" />
              ) : (
                <EyeOff className="size-4" />
              )}
            </QuickButton>
          </span>
        )}
      </div>
    </li>
  );
}

function QuickButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "grid size-8 place-items-center rounded-lg backdrop-blur transition-colors",
        active
          ? "bg-amber-400 text-amber-950"
          : "bg-black/45 text-white hover:bg-black/65",
      )}
    >
      {children}
    </button>
  );
}

function PhotoImage({
  photo,
  sizes,
  className,
  fit = "cover",
}: {
  photo: Photo;
  sizes: string;
  className?: string;
  fit?: "cover" | "contain";
}) {
  return (
    <Image
      src={photo.url}
      alt={photo.alt}
      fill
      sizes={sizes}
      quality={90}
      placeholder={photo.imageBlur ? "blur" : "empty"}
      blurDataURL={photo.imageBlur}
      unoptimized={!canOptimize(photo.url)}
      draggable={false}
      className={cn(
        fit === "cover" ? "object-cover" : "object-contain",
        "transition-[opacity,filter] select-none",
        className,
      )}
    />
  );
}

function useDragSort(
  photos: Photo[],
  setPhotos: (p: Photo[]) => void,
  onDone: (next: Photo[], before: Photo[]) => void,
) {
  const [dragId, setDragId] = useState<string | null>(null);
  const before = useRef<Photo[]>([]);

  return {
    dragId,
    props: (id: string) => ({
      onDragStart: (event: DragEvent) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", id);
        before.current = photos;
        setDragId(id);
      },
      onDragEnter: (event: DragEvent) => {
        if (!dragId || dragId === id) return;
        event.preventDefault();
        const list = [...photos];
        const from = list.findIndex((p) => p.id === dragId);
        const to = list.findIndex((p) => p.id === id);
        if (from < 0 || to < 0) return;
        const [moved] = list.splice(from, 1);
        list.splice(to, 0, moved);
        setPhotos(list);
      },
      onDragOver: (event: DragEvent) => {
        if (dragId) event.preventDefault();
      },
      onDrop: (event: DragEvent) => {
        if (dragId) event.preventDefault();
      },
      onDragEnd: () => {
        setDragId(null);
        if (photos.some((p, i) => p.id !== before.current[i]?.id))
          onDone(photos, before.current);
      },
    }),
  };
}

type UploadItem = {
  id: string;
  name: string;
  preview: string;
  file: File;
  album: GalleryAlbum;
  status: "waiting" | "uploading" | "saving" | "done" | "error";
  note?: string;
};

const PARALLEL = 2;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function useUploads(
  onAdded: (photos: Photo[]) => void,
  onFinished: () => void,
) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const queue = useRef<UploadItem[]>([]);
  const running = useRef(0);
  const callbacks = useRef({ onAdded, onFinished });
  useEffect(() => {
    callbacks.current = { onAdded, onFinished };
  });

  const update = (id: string, changes: Partial<UploadItem>) => {
    queue.current = queue.current.map((item) =>
      item.id === id ? { ...item, ...changes } : item,
    );
    setItems(queue.current);
  };

  const run = async (item: UploadItem) => {
    update(item.id, { status: "uploading", note: undefined });
    try {
      const file = await prepareImage(item.file);
      const form = new FormData();
      form.append("file", file);
      let result = await uploadGalleryImage(form);
      for (
        let attempt = 1;
        !result.ok && result.status === 429 && attempt <= 5;
        attempt++
      ) {
        update(item.id, { note: "Waiting a moment…" });
        await sleep(12_000 * attempt);
        update(item.id, { note: undefined });
        result = await uploadGalleryImage(form);
      }
      if (!result.ok) throw new Error(result.message);

      update(item.id, { status: "saving" });
      const added = await addGalleryPhotos([
        {
          image: result.data.key,
          width: result.data.width,
          height: result.data.height,
          album: item.album,
        },
      ]);
      if (!added.ok) throw new Error(added.message);
      if (added.data.failed > 0 || added.data.added.length === 0)
        throw new Error("The upload expired. Try again.");
      callbacks.current.onAdded(added.data.added);
      update(item.id, { status: "done" });
    } catch (error) {
      update(item.id, {
        status: "error",
        note: error instanceof Error ? error.message : "Something went wrong",
      });
    }
  };

  const pump = () => {
    while (running.current < PARALLEL) {
      const next = queue.current.find((item) => item.status === "waiting");
      if (!next) break;
      running.current++;
      queue.current = queue.current.map((item) =>
        item.id === next.id ? { ...item, status: "uploading" } : item,
      );
      void run(next).finally(() => {
        running.current--;
        pump();
        if (
          running.current === 0 &&
          !queue.current.some((i) => i.status === "waiting")
        ) {
          const ok = queue.current.filter((i) => i.status === "done").length;
          const failed = queue.current.filter(
            (i) => i.status === "error",
          ).length;
          if (ok)
            toast.add({
              title: `${ok} ${ok === 1 ? "photo" : "photos"} added`,
              description: failed
                ? `${failed} didn't upload: retry them from the list.`
                : undefined,
              type: failed ? "error" : "success",
            });
          callbacks.current.onFinished();
        }
      });
    }
  };

  useEffect(
    () => () => {
      for (const item of queue.current) URL.revokeObjectURL(item.preview);
    },
    [],
  );

  return {
    items,
    pending: items.filter((i) => i.status !== "done" && i.status !== "error")
      .length,
    start(files: File[], album: GalleryAlbum) {
      const added = files.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        preview: URL.createObjectURL(file),
        file,
        album,
        status: "waiting" as const,
      }));
      queue.current = [...queue.current, ...added];
      setItems(queue.current);
      pump();
    },
    retry() {
      queue.current = queue.current.map((item) =>
        item.status === "error"
          ? { ...item, status: "waiting", note: undefined }
          : item,
      );
      setItems(queue.current);
      pump();
    },
    clear() {
      for (const item of queue.current)
        if (item.status === "done" || item.status === "error")
          URL.revokeObjectURL(item.preview);
      queue.current = queue.current.filter(
        (item) => item.status !== "done" && item.status !== "error",
      );
      setItems(queue.current);
    },
  };
}

function UploadTray({ uploads }: { uploads: ReturnType<typeof useUploads> }) {
  const [open, setOpen] = useState(true);
  const { items } = uploads;
  const done = items.filter((i) => i.status === "done").length;
  const failed = items.filter((i) => i.status === "error").length;
  const busy = uploads.pending > 0;
  const progress = Math.round(((done + failed) / items.length) * 100);

  return (
    <section
      aria-label="Uploads"
      className="fixed inset-x-3 bottom-3 z-40 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-xl",
            busy
              ? "bg-primary/12 text-primary"
              : failed
                ? "bg-destructive/10 text-destructive"
                : "bg-emerald-500/12 text-emerald-600",
          )}
        >
          {busy ? (
            <LoaderCircle className="size-4.5 animate-spin" />
          ) : failed ? (
            <CircleAlert className="size-4.5" />
          ) : (
            <Check className="size-4.5" />
          )}
        </span>
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="text-sm font-semibold">
            {busy
              ? `Uploading · ${done} of ${items.length} done`
              : failed
                ? `${failed} didn't upload`
                : `${done} ${done === 1 ? "photo" : "photos"} added`}
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                failed && !busy ? "bg-destructive" : "bg-primary",
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {open ? "Hide" : "Show"}
        </button>
        {!busy && (
          <button
            type="button"
            onClick={uploads.clear}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      {open && (
        <>
          <ul className="max-h-64 space-y-1 overflow-y-auto border-t border-border p-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-lg px-2 py-1.5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.preview}
                  alt=""
                  className="size-9 shrink-0 rounded-md object-cover"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{item.name}</span>
                  <span
                    className={cn(
                      "block truncate text-xs",
                      item.status === "error"
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {item.note ??
                      {
                        waiting: "Waiting",
                        uploading: "Optimizing…",
                        saving: "Adding to the gallery…",
                        done: "Added",
                        error: "Failed",
                      }[item.status]}
                  </span>
                </span>
                {item.status === "done" ? (
                  <Check className="size-4 text-emerald-600" />
                ) : item.status === "error" ? (
                  <CircleAlert className="size-4 text-destructive" />
                ) : item.status === "waiting" ? null : (
                  <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
                )}
              </li>
            ))}
          </ul>
          {failed > 0 && !busy && (
            <div className="border-t border-border p-2">
              <Button
                variant="outline"
                onClick={uploads.retry}
                className="h-9 w-full rounded-lg"
              >
                <RotateCw className="size-4" /> Retry{" "}
                {failed === 1 ? "it" : `all ${failed}`}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

const photoSchema = z.object({
  alt: z.string().trim().max(MAX_ALT, `${MAX_ALT} characters at most`),
  caption: z
    .string()
    .trim()
    .max(MAX_CAPTION, `${MAX_CAPTION} characters at most`),
  album: z.enum(GALLERY_ALBUMS),
  isVisible: z.boolean(),
  isFeatured: z.boolean(),
});
type PhotoValues = z.infer<typeof photoSchema>;

function PhotoDialog({
  photo,
  index,
  total,
  position,
  count,
  canMove,
  onClose,
  onGo,
  onSaved,
  onMove,
  onDeleted,
}: {
  photo: Photo;
  index: number;
  total: number;
  position: number;
  count: number;
  canMove: boolean;
  onClose: () => void;
  onGo: (step: 1 | -1) => void;
  onSaved: (photo: Photo) => void;
  onMove: (to: number) => void;
  onDeleted: () => void;
}) {
  const form = useForm<PhotoValues>({
    resolver: zodResolver(photoSchema),
    defaultValues: {
      alt: photo.alt,
      caption: photo.caption,
      album: photo.album,
      isVisible: photo.isVisible,
      isFeatured: photo.isFeatured,
    },
  });
  const { control, formState, handleSubmit, reset } = form;
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = useMutation({
    mutationFn: async (values: PhotoValues) => {
      const result = await updateGalleryPhoto(photo.id, values);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: (saved) => {
      onSaved(saved);
      reset({
        alt: saved.alt,
        caption: saved.caption,
        album: saved.album,
        isVisible: saved.isVisible,
        isFeatured: saved.isFeatured,
      });
      toast.add({ title: "Photo saved", type: "success" });
    },
    onError: (error) =>
      toast.add({
        title: "The photo wasn't saved",
        description: error.message,
        type: "error",
      }),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const result = await deleteGalleryPhotos([photo.id]);
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: () => {
      toast.add({ title: "Photo deleted", type: "success" });
      onDeleted();
    },
    onError: (error) =>
      toast.add({
        title: "The photo wasn't deleted",
        description: error.message,
        type: "error",
      }),
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = (event.target as HTMLElement | null)?.closest(
        "input, textarea",
      );
      if (typing || formState.isDirty) return;
      if (event.key === "ArrowRight") onGo(1);
      if (event.key === "ArrowLeft") onGo(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onGo, formState.isDirty]);

  const busy = save.isPending || remove.isPending;

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent
        className="flex max-h-[calc(100dvh-1.5rem)] flex-col gap-0 overflow-hidden p-0 text-left sm:max-w-4xl md:flex-row"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Edit photo</DialogTitle>
        {/* The photo */}
        <div className="relative h-64 shrink-0 bg-neutral-950 sm:h-80 md:h-auto md:min-h-128 md:flex-1">
          <PhotoImage
            photo={photo}
            fit="contain"
            sizes="(min-width: 768px) 60vw, 100vw"
          />
          {total > 1 && (
            <>
              <NavButton
                side="left"
                label="Previous photo"
                onClick={() => onGo(-1)}
                disabled={formState.isDirty}
              />
              <NavButton
                side="right"
                label="Next photo"
                onClick={() => onGo(1)}
                disabled={formState.isDirty}
              />
            </>
          )}
          <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white tabular-nums backdrop-blur">
            {index + 1} / {total} · {photo.width}×{photo.height}
          </span>
        </div>

        <form
          onSubmit={handleSubmit((values) => save.mutate(values))}
          className="flex min-h-0 w-full flex-col md:w-88 md:shrink-0"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3.5">
            <p className="font-semibold">Photo details</p>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="Close"
              className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
            <Controller
              control={control}
              name="alt"
              render={({ field, fieldState }) => (
                <div>
                  <label
                    htmlFor="photo-alt"
                    className="flex items-center justify-between text-sm font-medium"
                  >
                    Description
                    <span className="text-xs font-normal text-muted-foreground tabular-nums">
                      {field.value.length}/{MAX_ALT}
                    </span>
                  </label>
                  <textarea
                    id="photo-alt"
                    {...field}
                    rows={3}
                    maxLength={MAX_ALT}
                    placeholder="Grilled sea bass with lemon on a terrace table at sunset"
                    className={cn(
                      inputClass,
                      "mt-1.5 h-auto resize-none py-2 leading-relaxed",
                    )}
                  />
                  <p
                    className={cn(
                      "mt-1 text-xs",
                      fieldState.error
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {fieldState.error?.message ??
                      "What's in the photo. Read aloud to blind guests, and helps Google show it."}
                  </p>
                </div>
              )}
            />

            <Controller
              control={control}
              name="caption"
              render={({ field }) => (
                <div>
                  <label
                    htmlFor="photo-caption"
                    className="text-sm font-medium"
                  >
                    Caption{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </label>
                  <input
                    id="photo-caption"
                    {...field}
                    maxLength={MAX_CAPTION}
                    placeholder="Our terrace, summer evenings"
                    className={cn(inputClass, "mt-1.5")}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Shown under the photo when a guest opens it.
                  </p>
                </div>
              )}
            />

            <Controller
              control={control}
              name="album"
              render={({ field }) => (
                <div>
                  <p className="text-sm font-medium">Album</p>
                  <div
                    role="radiogroup"
                    aria-label="Album"
                    className="mt-1.5 flex flex-wrap gap-1.5"
                  >
                    {GALLERY_ALBUMS.map((album) => (
                      <button
                        key={album}
                        type="button"
                        role="radio"
                        aria-checked={field.value === album}
                        onClick={() => field.onChange(album)}
                        className={cn(
                          "h-8 rounded-full border px-3 text-[13px] font-medium transition-colors",
                          field.value === album
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border hover:border-foreground/25 hover:bg-muted",
                        )}
                      >
                        {ALBUM_LABELS[album]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            />

            <div className="divide-y divide-border rounded-xl border border-border">
              <Controller
                control={control}
                name="isVisible"
                render={({ field }) => (
                  <SwitchRow
                    id="photo-visible"
                    title="Show on the website"
                    text="Hidden photos stay here, guests don't see them."
                    checked={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <Controller
                control={control}
                name="isFeatured"
                render={({ field }) => (
                  <SwitchRow
                    id="photo-featured"
                    title="Show on the home page"
                    text="A few of your best, in the home page strip."
                    checked={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>

            {canMove && count > 1 && (
              <div>
                <p className="text-sm font-medium">Position</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={position === 0}
                    onClick={() => onMove(0)}
                    className="h-8 rounded-lg px-2.5 text-xs"
                  >
                    First
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={position === 0}
                    onClick={() => onMove(position - 1)}
                    aria-label="Move earlier"
                    className="h-8 rounded-lg px-2"
                  >
                    <ArrowLeft className="size-4" />
                  </Button>
                  <span className="px-1 text-sm text-muted-foreground tabular-nums">
                    {position + 1} of {count}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={position === count - 1}
                    onClick={() => onMove(position + 1)}
                    aria-label="Move later"
                    className="h-8 rounded-lg px-2"
                  >
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-border bg-muted/40 px-5 py-3">
            {confirmDelete ? (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => remove.mutate()}
                  className="h-9 rounded-lg"
                >
                  {remove.isPending ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  Delete for good
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setConfirmDelete(false)}
                  className="h-9 rounded-lg"
                >
                  Keep
                </Button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  aria-label="Delete this photo"
                  className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
                <span className="flex-1" />
                {formState.isDirty && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => reset()}
                    className="h-9 rounded-lg"
                  >
                    Undo
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={busy || !formState.isDirty}
                  className="h-9 min-w-24 rounded-lg"
                >
                  {save.isPending ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  Save
                </Button>
              </>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NavButton({
  side,
  label,
  onClick,
  disabled,
}: {
  side: "left" | "right";
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={disabled ? "Save or undo your changes first" : label}
      className={cn(
        "absolute top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/70 disabled:opacity-30",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      {side === "left" ? (
        <ChevronLeft className="size-5" />
      ) : (
        <ChevronRight className="size-5" />
      )}
    </button>
  );
}

function SwitchRow({
  id,
  title,
  text,
  checked,
  onChange,
}: {
  id: string;
  title: string;
  text: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <p id={id} className="text-sm font-medium">
          {title}
        </p>
        <p className="text-xs text-muted-foreground">{text}</p>
      </div>
      <Switch checked={checked} onChange={onChange} labelledBy={id} />
    </div>
  );
}

function SelectionBar({
  photos,
  shown,
  selected,
  setSelected,
  onStop,
  onChanged,
  onDeleted,
}: {
  photos: Photo[];
  shown: Photo[];
  selected: ReadonlySet<string>;
  setSelected: (s: ReadonlySet<string>) => void;
  onStop: () => void;
  onChanged: (ids: string[], changes: Partial<Photo>) => void;
  onDeleted: (ids: string[]) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const ids = [...selected];
  const chosen = photos.filter((p) => selected.has(p.id));
  const allShown = shown.length > 0 && shown.every((p) => selected.has(p.id));
  const anyHidden = chosen.some((p) => !p.isVisible);
  const allFeatured = chosen.length > 0 && chosen.every((p) => p.isFeatured);

  const bulk = useMutation({
    mutationFn: async ({ set }: { set: GalleryChanges; label: string }) => {
      const result = await bulkUpdateGallery(ids, set);
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: (_, { set, label }) => {
      onChanged(ids, set);
      toast.add({ title: label, type: "success" });
    },
    onError: (error) =>
      toast.add({
        title: "Nothing changed",
        description: error.message,
        type: "error",
      }),
  });
  const remove = useMutation({
    mutationFn: async () => {
      const result = await deleteGalleryPhotos(ids);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: ({ deleted }) => {
      setConfirming(false);
      toast.add({
        title: deleted === 1 ? "Photo deleted" : `${deleted} photos deleted`,
        type: "success",
      });
      onDeleted(ids);
    },
    onError: (error) =>
      toast.add({
        title: "Nothing was deleted",
        description: error.message,
        type: "error",
      }),
  });
  const n = ids.length;
  const plural = n === 1 ? "photo" : "photos";
  const busy = bulk.isPending || remove.isPending;

  return (
    <>
      <div className="pointer-events-none sticky bottom-4 z-30 mt-4 flex justify-center">
        <div
          role="toolbar"
          aria-label="Selected photos"
          className="pointer-events-auto flex max-w-full items-center gap-0.5 overflow-x-auto rounded-2xl bg-foreground p-1.5 pl-4 text-background shadow-2xl ring-1 ring-black/10 scrollbar-none"
        >
          <span className="mr-1 text-sm font-semibold whitespace-nowrap tabular-nums">
            {n === 0 ? "Pick photos" : `${n} selected`}
          </span>
          <BarButton
            onClick={() =>
              setSelected(
                allShown ? new Set() : new Set(shown.map((p) => p.id)),
              )
            }
          >
            {allShown ? "None" : "All"}
          </BarButton>
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={n === 0 || busy}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-sm font-medium whitespace-nowrap text-background/80 transition-colors hover:bg-background/10 hover:text-background disabled:opacity-40"
            >
              <FolderInput className="size-4" />
              <span className="hidden sm:inline">Move</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="center"
              sideOffset={10}
              className="w-44 rounded-xl bg-card p-1.5 text-foreground shadow-lg"
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Move to
                </DropdownMenuLabel>
                {GALLERY_ALBUMS.map((album) => (
                  <DropdownMenuItem
                    key={album}
                    onClick={() =>
                      bulk.mutate({
                        set: { album },
                        label: `${n} ${plural} moved to ${ALBUM_LABELS[album]}`,
                      })
                    }
                    className="cursor-pointer rounded-lg px-2.5 py-2 text-sm focus:bg-muted focus:text-foreground data-highlighted:bg-muted data-highlighted:text-foreground"
                  >
                    {ALBUM_LABELS[album]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <BarButton
            disabled={n === 0 || busy}
            onClick={() =>
              bulk.mutate({
                set: { isVisible: anyHidden },
                label: anyHidden
                  ? `${n} ${plural} shown on the website`
                  : `${n} ${plural} hidden`,
              })
            }
          >
            {anyHidden ? (
              <Eye className="size-4" />
            ) : (
              <EyeOff className="size-4" />
            )}
            <span className="hidden sm:inline">
              {anyHidden ? "Show" : "Hide"}
            </span>
          </BarButton>
          <BarButton
            disabled={n === 0 || busy}
            onClick={() =>
              bulk.mutate({
                set: { isFeatured: !allFeatured },
                label: allFeatured
                  ? `${n} ${plural} off the home page`
                  : `${n} ${plural} on the home page`,
              })
            }
          >
            <Star className={cn("size-4", allFeatured && "fill-current")} />
            <span className="hidden sm:inline">
              {allFeatured ? "Unfeature" : "Feature"}
            </span>
          </BarButton>
          <BarButton onClick={onStop}>Cancel</BarButton>
          <button
            type="button"
            disabled={n === 0 || busy}
            onClick={() => setConfirming(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-destructive px-3.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
          >
            <Trash2 className="size-4" />
            <span className="hidden sm:inline">Delete</span>
          </button>
        </div>
      </div>

      <AlertDialog
        open={confirming}
        onOpenChange={(open) => !remove.isPending && setConfirming(open)}
      >
        <AlertDialogContent className="text-left sm:max-w-md">
          <AlertDialogHeader>
            <span className="mx-auto mb-1 grid size-11 place-items-center rounded-2xl bg-destructive/10 text-destructive sm:mx-0">
              <Trash2 className="size-5" />
            </span>
            <AlertDialogTitle>
              Delete {n === 1 ? "this photo" : `${n} photos`}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {n === 1
                ? "It's removed from the website and the file is deleted."
                : "They're removed from the website and the files are deleted."}{" "}
              <span className="font-medium text-foreground">
                This can&apos;t be undone.
              </span>{" "}
              To take {n === 1 ? "it" : "them"} down for a while, hide{" "}
              {n === 1 ? "it" : "them"} instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="grid grid-cols-6 gap-1.5">
            {chosen.slice(0, 6).map((p) => (
              <li
                key={p.id}
                className="relative aspect-square overflow-hidden rounded-lg bg-muted"
              >
                <PhotoImage photo={p} sizes="64px" />
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
              className="min-w-32"
            >
              {remove.isPending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {remove.isPending
                ? "Deleting…"
                : n === 1
                  ? "Delete photo"
                  : `Delete ${n} photos`}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function BarButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium whitespace-nowrap text-background/80 transition-colors hover:bg-background/10 hover:text-background disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function EmptyState({ onPick }: { onPick: () => void }) {
  const ideas = [
    {
      title: "The room",
      text: "Tables set, the bar, the terrace at golden hour",
    },
    {
      title: "The plates",
      text: "Your signatures, shot from above in daylight",
    },
    {
      title: "The people",
      text: "The kitchen at work, the team, a busy night",
    },
  ];
  return (
    <div className="relative overflow-hidden rounded-3xl border-2 border-dashed border-border bg-card px-6 py-14 text-center sm:py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,color-mix(in_srgb,var(--primary)_14%,transparent),transparent_60%)]"
      />
      <div className="relative">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_8px_24px_-8px_color-mix(in_srgb,var(--primary)_80%,transparent)]">
          <Images className="size-8" />
        </span>
        <h2 className="mt-4 text-xl font-semibold tracking-tight">
          Show guests what it&apos;s like
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Drop photos here or pick them from your phone or computer. Big photos
          are shrunk and optimized automatically.
        </p>
        <button
          type="button"
          onClick={onPick}
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_6px_20px_-6px_color-mix(in_srgb,var(--primary)_70%,transparent)] transition hover:-translate-y-px hover:brightness-110"
        >
          <Upload className="size-4.5" /> Upload photos
        </button>
        <ul className="mx-auto mt-8 grid max-w-2xl gap-3 text-left sm:grid-cols-3">
          {ideas.map((idea) => (
            <li
              key={idea.title}
              className="rounded-xl border border-border bg-background/70 p-3.5"
            >
              <p className="text-sm font-semibold">{idea.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {idea.text}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
