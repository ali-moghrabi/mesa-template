"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Controller,
  useController,
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type FieldPath,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useIsMutating, useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  CircleAlert,
  Clock,
  CloudUpload,
  EyeOff,
  FileText,
  ImagePlus,
  LoaderCircle,
  Plus,
  RefreshCw,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { createMenuCategory, uploadMenuImage } from "@/admin/lib/menu/actions";
import {
  categoryFormSchema,
  DAY_SHORT,
  daysLabel,
  emptyCategory,
  MAX_SERVING_WINDOWS,
  previewCategorySlug,
  SERVING_PRESETS,
  servingLabel,
  WEEK_DAYS,
  type CategoryFormValues,
} from "@/admin/lib/menu/category-schema";
import { MENU_PAGE_PATH } from "@/admin/lib/menu/params";
import {
  formatBytes,
  MAX_PICK_BYTES,
  MAX_UPLOAD_BYTES,
  prepareImage,
} from "@/admin/lib/prepare-image";
import {
  inputClass,
  PhotoAction,
  SaveBar,
  Section,
  ToggleRow,
} from "./FormParts";

type Values = CategoryFormValues;

const CATEGORIES_PATH = `${MENU_PAGE_PATH}/categories`;
const COVER_MUTATION = ["menu", "category-cover-upload"] as const;

class SaveError extends Error {
  constructor(
    message: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

type Props = {
  initialName?: string;
  position: number;
};

export function CategoryForm({ initialName = "", position }: Props) {
  const router = useRouter();
  const form = useForm<Values>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: { ...emptyCategory(), name: initialName },
    mode: "onTouched",
  });
  const { control, formState } = form;

  const afterSave = useRef<"list" | "another">("list");
  const [coverKey, setCoverKey] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [created, setCreated] = useState(0);
  const uploading = useIsMutating({ mutationKey: COVER_MUTATION }) > 0;

  const save = useMutation({
    mutationFn: async (values: Values) => {
      const result = await createMenuCategory(values);
      if (!result.ok) throw new SaveError(result.message, result.fieldErrors);
      return result.data;
    },
    onSuccess: (category) => {
      toast.add({
        title: `${category.name} created`,
        description: category.isActive
          ? "Now add its dishes."
          : "Saved hidden: switch it on when it's ready.",
        type: "success",
      });
      if (afterSave.current === "another") {
        form.reset(emptyCategory());
        setCoverKey((k) => k + 1);
        setCreated((n) => n + 1);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setLeaving(true);
        router.push(CATEGORIES_PATH);
      }
    },
    onError: (error) => {
      const fields = error instanceof SaveError ? error.fieldErrors : undefined;
      if (fields) {
        Object.entries(fields).forEach(([path, message], index) =>
          form.setError(
            path as FieldPath<Values>,
            { type: "server", message },
            { shouldFocus: index === 0 },
          ),
        );
      }
      toast.add({
        title: "The category wasn't saved",
        description: error.message,
        type: "error",
      });
    },
  });

  const submit = form.handleSubmit(
    (values) => save.mutate(values),
    () => toast.add({ title: "Check the highlighted fields", type: "error" }),
  );
  const submitAs = (mode: "list" | "another") => {
    afterSave.current = mode;
    void submit();
  };

  const unsaved = formState.isDirty && !leaving;
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  const busy = save.isPending || uploading;
  const status =
    formState.submitCount > 0 && Object.keys(formState.errors).length > 0
      ? "errors"
      : uploading
        ? "uploading"
        : unsaved
          ? "unsaved"
          : "idle";

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submitAs("list");
      }}
      onKeyDown={(event) => {
        if (
          event.key === "Enter" &&
          (event.metaKey || event.ctrlKey) &&
          !busy
        ) {
          event.preventDefault();
          submitAs("list");
        }
      }}
      className="mx-auto w-full max-w-6xl px-4 sm:px-8"
    >
      <header className="pt-6 pb-6 lg:pt-10">
        <Link
          href={CATEGORIES_PATH}
          className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Categories
        </Link>
        <h1 className="mt-3 text-[28px] leading-tight font-semibold tracking-tight sm:text-3xl">
          New category
        </h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-[15px]">
          A section of your menu, like Starters or Drinks. Dishes are added to
          it afterwards.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
        <aside className="space-y-5 lg:sticky lg:top-6 lg:order-last">
          <CoverCard
            key={coverKey}
            control={control}
            position={position + created}
          />
          <section
            aria-label="Visibility"
            className="rounded-2xl border border-border bg-card shadow-xs"
          >
            <Controller
              name="isActive"
              control={control}
              render={({ field }) => (
                <ToggleRow
                  title="Show on the menu"
                  description={
                    field.value
                      ? "Guests see it as soon as it has dishes."
                      : "Saved hidden, e.g. a seasonal menu for later."
                  }
                  checked={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </section>
        </aside>

        <div className="min-w-0 space-y-5">
          <BasicsSection control={control} />
          <ServingSection control={control} />
        </div>
      </div>

      <SaveBar
        status={status}
        busy={busy}
        saving={save.isPending}
        createLabel="Create category"
        onSaveAnother={() => submitAs("another")}
        cancel={
          <Link
            href={CATEGORIES_PATH}
            onClick={(event) => {
              if (
                unsaved &&
                !window.confirm("Leave without saving this category?")
              )
                event.preventDefault();
            }}
            className="hidden h-10 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
          >
            Cancel
          </Link>
        }
      />
    </form>
  );
}

function BasicsSection({ control }: { control: Control<Values> }) {
  const name = useWatch({ control, name: "name" });
  const autoSlug = previewCategorySlug(name) || "category-name";

  return (
    <Section
      icon={<FileText className="size-4.5" />}
      title="Basics"
      description="How the section is titled on the menu."
    >
      <Controller
        name="name"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid} className="gap-2">
            <FieldLabel htmlFor="category-name">Name</FieldLabel>
            <Input
              {...field}
              id="category-name"
              aria-invalid={fieldState.invalid}
              placeholder="Starters"
              autoComplete="off"
              maxLength={60}
              className={cn(inputClass, "h-11 text-base")}
            />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <Controller
        name="description"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid} className="gap-2">
            <div className="flex items-baseline justify-between">
              <FieldLabel htmlFor="category-description">
                Description{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </FieldLabel>
              <span
                className={cn(
                  "text-xs tabular-nums",
                  field.value.length > 270
                    ? "text-amber-600"
                    : "text-muted-foreground",
                )}
              >
                {field.value.length}/300
              </span>
            </div>
            <textarea
              {...field}
              id="category-description"
              aria-invalid={fieldState.invalid}
              rows={2}
              maxLength={300}
              placeholder="To share, or not."
              className={cn(
                inputClass,
                "min-h-20 resize-y py-2.5 leading-relaxed",
              )}
            />
            <FieldDescription>
              A short line under the title on the menu.
            </FieldDescription>
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <Controller
        name="slug"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid} className="gap-2">
            <FieldLabel htmlFor="category-slug">URL id</FieldLabel>
            <div className="flex">
              <span className="inline-flex items-center rounded-l-lg border border-r-0 border-input bg-muted px-3 font-mono text-xs text-muted-foreground">
                /menu#
              </span>
              <Input
                {...field}
                id="category-slug"
                aria-invalid={fieldState.invalid}
                onChange={(event) =>
                  field.onChange(
                    event.target.value.toLowerCase().replace(/\s+/g, "-"),
                  )
                }
                placeholder={autoSlug}
                autoComplete="off"
                spellCheck={false}
                maxLength={80}
                className={cn(inputClass, "rounded-l-none font-mono text-sm")}
              />
            </div>
            <FieldDescription>
              Leave empty to use{" "}
              <span className="font-mono text-foreground/80">{autoSlug}</span>.
            </FieldDescription>
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
    </Section>
  );
}

function ServingSection({ control }: { control: Control<Values> }) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "servingHours",
  });
  const full = fields.length >= MAX_SERVING_WINDOWS;

  return (
    <Section
      icon={<Clock className="size-4.5" />}
      title="Serving hours"
      description="Optional. Leave empty if it's served whenever you're open."
    >
      {fields.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl bg-muted/60 px-3.5 py-3 text-sm text-muted-foreground">
          <Clock className="size-4 shrink-0" /> Served all day, every day
          you&apos;re open.
        </p>
      ) : (
        <ul className="space-y-3">
          {fields.map((row, index) => (
            <li key={row.id}>
              <ServingWindowRow
                control={control}
                index={index}
                onRemove={() => remove(index)}
              />
            </li>
          ))}
        </ul>
      )}

      {!full && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => append({ days: [], from: "12:00", to: "15:00" })}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <Plus className="size-4" /> Add serving time
          </button>
          <span className="text-xs text-muted-foreground">or</span>
          {SERVING_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() =>
                append({ ...preset.window, days: [...preset.window.days] })
              }
              title={servingLabel(preset.window)}
              className="inline-flex h-8 items-center rounded-full border border-dashed border-border px-3 text-[13px] font-medium text-foreground/80 transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
    </Section>
  );
}

function ServingWindowRow({
  control,
  index,
  onRemove,
}: {
  control: Control<Values>;
  index: number;
  onRemove: () => void;
}) {
  const days = useWatch({ control, name: `servingHours.${index}.days` });

  return (
    <div className="rounded-xl border border-border bg-background/40 p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <Controller
          name={`servingHours.${index}.days`}
          control={control}
          render={({ field }) => (
            <div
              role="group"
              aria-label="Days"
              className="grid flex-1 grid-cols-7 gap-1 sm:flex sm:flex-none sm:flex-wrap"
            >
              {WEEK_DAYS.map((day) => {
                const on = field.value.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      field.onChange(
                        on
                          ? field.value.filter((d) => d !== day)
                          : [...field.value, day],
                      )
                    }
                    className={cn(
                      "h-8 min-w-0 rounded-lg border px-0 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:min-w-10 sm:px-2",
                      on
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-muted-foreground hover:border-foreground/25 hover:text-foreground",
                    )}
                  >
                    {DAY_SHORT[day]}
                  </button>
                );
              })}
            </div>
          )}
        />
        <button
          type="button"
          onClick={onRemove}
          title="Remove serving time"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <X className="size-4" />
          <span className="sr-only">Remove serving time</span>
        </button>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-start gap-2 sm:max-w-sm">
        <Controller
          name={`servingHours.${index}.from`}
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="gap-1">
              <Input
                {...field}
                type="time"
                aria-label="From"
                aria-invalid={fieldState.invalid}
                className={cn(inputClass, "tabular-nums dark:scheme-dark")}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <span className="grid h-10 place-items-center text-sm text-muted-foreground">
          to
        </span>
        <Controller
          name={`servingHours.${index}.to`}
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="gap-1">
              <Input
                {...field}
                type="time"
                aria-label="To"
                aria-invalid={fieldState.invalid}
                className={cn(inputClass, "tabular-nums dark:scheme-dark")}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {daysLabel(days ?? [])}
        {!days?.length && " · pick days to limit it"}
      </p>
    </div>
  );
}

type Picked = {
  url: string;
  originalBytes: number;
  result?: { bytes: number };
};

function CoverCard({
  control,
  position,
}: {
  control: Control<Values>;
  position: number;
}) {
  const { field, fieldState } = useController({ control, name: "image" });
  const values = useWatch({ control });
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [dragging, setDragging] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const upload = useMutation({
    mutationKey: COVER_MUTATION,
    mutationFn: async (file: File) => {
      const prepared = await prepareImage(file);
      if (prepared.size > MAX_UPLOAD_BYTES)
        throw new Error(
          "This photo is too large. Export it as a JPG under 15 MB.",
        );
      const body = new FormData();
      body.append("file", prepared, prepared.name);
      const result = await uploadMenuImage(body);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  });

  useEffect(
    () => () => void (picked && URL.revokeObjectURL(picked.url)),
    [picked],
  );

  const choose = (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/"))
      return setProblem("That file isn't a photo.");
    if (file.size > MAX_PICK_BYTES)
      return setProblem("That photo is over 40 MB.");
    setProblem(null);
    field.onChange(null);
    setPicked({ url: URL.createObjectURL(file), originalBytes: file.size });
    upload.mutate(file, {
      onSuccess: (image) => {
        field.onChange(image.key);
        setPicked(
          (current) =>
            current && { ...current, result: { bytes: image.bytes } },
        );
      },
      onError: (error) => {
        setProblem(error.message || "The photo couldn't be uploaded.");
        setPicked(null);
      },
    });
  };

  const clear = () => {
    field.onChange(null);
    setPicked(null);
    setProblem(null);
    upload.reset();
  };

  const error = problem ?? fieldState.error?.message;
  const name = values.name?.trim() || "Category name";
  const windows = (values.servingHours ?? []).filter(
    (w) => w?.from && w?.to,
  ) as { days: string[]; from: string; to: string }[];

  return (
    <section
      aria-label="Cover photo and preview"
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs"
    >
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          choose(event.dataTransfer.files?.[0]);
        }}
        className="relative aspect-video overflow-hidden"
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            choose(event.target.files?.[0]);
            event.target.value = "";
          }}
        />

        {picked ? (
          <Image
            src={picked.url}
            alt=""
            fill
            unoptimized
            sizes="340px"
            className={cn(
              "object-cover",
              values.isActive === false && "grayscale",
            )}
          />
        ) : (
          <div
            aria-hidden
            className="absolute inset-0 grid place-items-center bg-muted bg-[radial-gradient(circle_at_20%_15%,color-mix(in_srgb,var(--primary)_32%,transparent),transparent_60%),radial-gradient(circle_at_85%_90%,color-mix(in_srgb,var(--primary)_18%,transparent),transparent_55%)]"
          >
            <span className="text-7xl font-bold text-primary/25 select-none">
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/75 via-black/15 to-transparent" />

        <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-1.5">
          <span className="rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-semibold text-white tabular-nums backdrop-blur">
            #{position}
          </span>
          {values.isActive === false && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-neutral-900">
              <EyeOff className="size-3" /> Hidden
            </span>
          )}
        </div>
        <div className="pointer-events-none absolute inset-x-4 bottom-3">
          <p
            className={cn(
              "truncate text-lg leading-tight font-semibold text-white",
              !values.name?.trim() && "text-white/60",
            )}
          >
            {name}
          </p>
          <p className="text-[13px] text-white/80">No dishes yet</p>
        </div>

        {picked ? (
          <>
            {upload.isPending && (
              <div className="absolute inset-0 grid place-items-center bg-black/35 backdrop-blur-[2px]">
                <span className="inline-flex items-center gap-2 rounded-full bg-black/60 px-3.5 py-1.5 text-xs font-medium text-white">
                  <LoaderCircle className="size-3.5 animate-spin" /> Optimizing…
                </span>
              </div>
            )}
            <div className="absolute top-2.5 right-2.5 flex gap-1.5">
              {picked.result && (
                <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 text-[11px] font-medium text-white backdrop-blur">
                  <Zap className="size-3 text-amber-300" />
                  {formatBytes(picked.originalBytes)} →{" "}
                  {formatBytes(picked.result.bytes)}
                </span>
              )}
              <PhotoAction
                label="Replace cover"
                onClick={() => inputRef.current?.click()}
                disabled={upload.isPending}
              >
                <RefreshCw className="size-4" />
              </PhotoAction>
              <PhotoAction label="Remove cover" onClick={clear}>
                <Trash2 className="size-4" />
              </PhotoAction>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={cn(
              "absolute top-2.5 right-2.5 inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold backdrop-blur transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
              dragging
                ? "bg-primary text-primary-foreground"
                : "bg-black/55 text-white hover:bg-black/75",
            )}
          >
            {dragging ? (
              <CloudUpload className="size-4" />
            ) : (
              <ImagePlus className="size-4" />
            )}
            {dragging ? "Drop it here" : "Add cover"}
          </button>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 border-b border-destructive/20 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}

      <div className="space-y-3 p-4">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          Preview
        </p>
        <p
          className={cn(
            "line-clamp-2 text-sm",
            values.description
              ? "text-muted-foreground"
              : "text-muted-foreground/50 italic",
          )}
        >
          {values.description || "No description"}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {windows.length === 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
              <Clock className="size-3.5" /> Whenever you&apos;re open
            </span>
          ) : (
            windows.map((w, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary tabular-nums"
              >
                <Clock className="size-3.5" /> {servingLabel(w)}
              </span>
            ))
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          A wide photo works best (16:9). Optional.
        </p>
      </div>
    </section>
  );
}
