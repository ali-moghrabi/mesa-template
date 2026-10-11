"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import {
  Controller,
  useController,
  useFieldArray,
  useForm,
  useFormState,
  useWatch,
  type Control,
  type FieldPath,
  type UseFormReturn,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useIsMutating, useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  CircleAlert,
  ClipboardPaste,
  CloudUpload,
  EyeOff,
  FileText,
  Flame,
  ImagePlus,
  Leaf,
  ListChecks,
  LoaderCircle,
  Minus,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Tag,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  createMenuItem,
  updateMenuItem,
  uploadMenuImage,
} from "@/admin/lib/menu/actions";
import {
  canOptimize,
  formatPrice,
  mediaSrc,
  tagLabel,
} from "@/admin/lib/menu/format";
import {
  ALLERGENS,
  DIETARY_TAGS,
  emptyMenuItem,
  MAX_GROUPS,
  MAX_OPTIONS,
  MAX_VARIANTS,
  MENU_BADGES,
  menuItemFormSchema,
  newGroup,
  newOption,
  newVariant,
  previewSlug,
  SPICE_LEVELS,
  toItemFormValues,
  type MenuItemFormValues,
  type ModifierGroupValues,
} from "@/admin/lib/menu/item-schema";
import {
  DEFAULT_FILTERS,
  MENU_PAGE_PATH,
  menuHref,
} from "@/admin/lib/menu/params";
import type { AdminMenuItem, MenuSummary } from "@/admin/lib/menu/types";
import { Badges, DietIcons } from "./MenuClient";

type Category = MenuSummary["categories"][number];
type Values = MenuItemFormValues;

type Props = {
  categories: Category[];
  currency: string;
  initialCategoryId?: string;
  categoriesError?: string;
  item?: AdminMenuItem;
};

const PHOTO_MUTATION = ["menu", "photo-upload"] as const;

class SaveError extends Error {
  constructor(
    message: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

export function MenuItemForm({
  categories,
  currency,
  initialCategoryId,
  categoriesError,
  item,
}: Props) {
  const editing = item !== undefined;
  const router = useRouter();
  const firstCategory =
    categories.find((c) => c.id === initialCategoryId)?.id ??
    categories.find((c) => c.isActive)?.id ??
    categories[0]?.id ??
    "";

  const form = useForm<Values>({
    resolver: zodResolver(menuItemFormSchema),
    defaultValues: item
      ? toItemFormValues(item, firstCategory)
      : emptyMenuItem(firstCategory),
    mode: "onTouched",
  });
  const { control, formState } = form;

  const afterSave = useRef<"list" | "another">("list");
  const [photoKey, setPhotoKey] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const photoUploading = useIsMutating({ mutationKey: PHOTO_MUTATION }) > 0;

  const save = useMutation({
    mutationFn: async (values: Values) => {
      const result = item
        ? await updateMenuItem(item.id, values, {
            image: item.image ?? null,
            version: item.updatedAt,
          })
        : await createMenuItem(values);
      if (!result.ok) throw new SaveError(result.message, result.fieldErrors);
      return result.data;
    },
    onSuccess: (saved) => {
      if (editing) {
        toast.add({
          title: "Changes saved",
          description: saved.name,
          type: "success",
        });
        setLeaving(true);
        router.push(`${MENU_PAGE_PATH}/${saved.slug}`);
        router.refresh();
        return;
      }
      toast.add({
        title: `${saved.name} is on the menu`,
        description: saved.isActive
          ? `Added to ${saved.category.name}.`
          : "Saved as a hidden draft.",
        type: "success",
      });
      if (afterSave.current === "another") {
        form.reset(emptyMenuItem(form.getValues("categoryId")));
        setPhotoKey((k) => k + 1);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setLeaving(true);
        router.push(
          menuHref(DEFAULT_FILTERS, {
            category: saved.category.slug,
            sort: "newest",
          }),
        );
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
        title: editing ? "The changes weren't saved" : "The dish wasn't saved",
        description: error.message,
        type: "error",
      });
    },
  });

  const submit = form.handleSubmit(
    (values) => save.mutate(values),
    () => toast.add({ title: "Check the highlighted fields", type: "error" }),
  );

  const unsaved = formState.isDirty && !leaving;
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  const busy = save.isPending || photoUploading;
  const backHref = item ? `${MENU_PAGE_PATH}/${item.slug}` : MENU_PAGE_PATH;
  const errorCount = Object.keys(formState.errors).length;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        afterSave.current = "list";
        void submit(event);
      }}
      onKeyDown={(event) => {
        if (
          event.key === "Enter" &&
          (event.metaKey || event.ctrlKey) &&
          !busy
        ) {
          event.preventDefault();
          afterSave.current = "list";
          void submit();
        }
      }}
      className="mx-auto w-full max-w-6xl px-4 sm:px-8"
    >
      <header className="pt-6 pb-6 lg:pt-10">
        <Link
          href={backHref}
          className="inline-flex max-w-full items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <ArrowLeft className="size-4 shrink-0" />
          <span className="truncate">{item ? item.name : "Menu"}</span>
        </Link>
        <h1 className="mt-3 text-[28px] leading-tight font-semibold tracking-tight sm:text-3xl">
          {editing ? "Edit dish" : "New menu item"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-[15px]">
          {editing
            ? item.isVisible
              ? "This dish is on the menu: guests see your changes as soon as you save."
              : "This dish is hidden from guests, so you can change it freely."
            : "Add the photo, name and price. Everything else is optional and can be changed later."}
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
        <aside className="space-y-5 lg:sticky lg:top-6 lg:order-last">
          <PreviewCard
            key={photoKey}
            control={control}
            currency={currency}
            categories={categories}
            currentPhoto={item?.image}
          />
          <VisibilityCard control={control} />
        </aside>

        <div className="min-w-0 space-y-5">
          <BasicsSection
            control={control}
            categories={categories}
            categoriesError={categoriesError}
            currentSlug={item?.slug}
          />
          <PricingSection form={form} currency={currency} />
          <ChoicesSection control={control} currency={currency} />
          <DietSection control={control} />
          <DetailsSection control={control} />
        </div>
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 mt-8 border-t border-border bg-background/85 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur-md sm:-mx-8 sm:px-8">
        <div className="flex items-center gap-3">
          <p
            className="hidden min-w-0 flex-1 truncate text-sm text-muted-foreground sm:block"
            aria-live="polite"
          >
            {formState.submitCount > 0 && errorCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-destructive">
                <CircleAlert className="size-4" /> Some fields need attention
              </span>
            ) : photoUploading ? (
              <span className="inline-flex items-center gap-1.5">
                <LoaderCircle className="size-4 animate-spin" /> Optimizing the
                photo…
              </span>
            ) : unsaved ? (
              <span className="inline-flex items-center gap-2">
                <span className="size-2 rounded-full bg-amber-500" /> Unsaved
                changes
                <kbd className="ml-1 hidden rounded border border-border bg-muted px-1.5 py-px font-sans text-[11px] lg:inline">
                  ⌘ Enter
                </kbd>
              </span>
            ) : editing ? (
              "No changes yet."
            ) : (
              "Fill in the dish, then create it."
            )}
          </p>
          <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none">
            <Link
              href={backHref}
              onClick={(event) => {
                if (
                  unsaved &&
                  !window.confirm(
                    editing
                      ? "Leave without saving your changes?"
                      : "Leave without saving this dish?",
                  )
                )
                  event.preventDefault();
              }}
              className="hidden h-10 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
            >
              Cancel
            </Link>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                afterSave.current = "another";
                void submit();
              }}
              className={cn(
                "hidden h-10 rounded-lg px-4",
                !editing && "md:inline-flex",
              )}
            >
              Save & add another
            </Button>
            <Button
              type="submit"
              disabled={busy || (editing && !formState.isDirty)}
              className="h-11 flex-1 rounded-xl px-5 text-[15px] font-semibold shadow-[0_6px_20px_-6px_color-mix(in_srgb,var(--primary)_70%,transparent)] sm:h-10 sm:flex-none sm:text-sm"
            >
              {save.isPending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              {editing
                ? save.isPending
                  ? "Saving…"
                  : "Save changes"
                : save.isPending
                  ? "Creating…"
                  : "Create item"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

function Section({
  icon,
  title,
  description,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="rounded-2xl border border-border bg-card shadow-xs"
    >
      <header className="flex items-start gap-3 border-b border-border/70 px-4 py-4 sm:px-6">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={id} className="text-[15px] font-semibold tracking-tight">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {action}
      </header>
      <div className="space-y-5 px-4 py-5 sm:px-6">{children}</div>
    </section>
  );
}

function BasicsSection({
  control,
  categories,
  categoriesError,
  currentSlug,
}: {
  control: Control<Values>;
  categories: Category[];
  categoriesError?: string;
  currentSlug?: string;
}) {
  const name = useWatch({ control, name: "name" });
  const autoSlug = previewSlug(name) || "dish-name";

  return (
    <Section
      icon={<FileText className="size-4.5" />}
      title="Basics"
      description="What guests read first."
    >
      <Controller
        name="name"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid} className="gap-2">
            <FieldLabel htmlFor="item-name">Name</FieldLabel>
            <Input
              {...field}
              id="item-name"
              aria-invalid={fieldState.invalid}
              placeholder="Burrata & heirloom tomato"
              autoComplete="off"
              maxLength={80}
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
              <FieldLabel htmlFor="item-description">Description</FieldLabel>
              <span
                className={cn(
                  "text-xs tabular-nums",
                  field.value.length > 450
                    ? "text-amber-600"
                    : "text-muted-foreground",
                )}
              >
                {field.value.length}/500
              </span>
            </div>
            <textarea
              {...field}
              id="item-description"
              aria-invalid={fieldState.invalid}
              rows={3}
              maxLength={500}
              placeholder="Creamy burrata, basil oil, aged balsamic, grilled sourdough."
              className={cn(
                inputClass,
                "min-h-24 resize-y py-2.5 leading-relaxed",
              )}
            />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <Controller
        name="categoryId"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid} className="gap-2">
            <FieldLabel id="item-category-label">Category</FieldLabel>
            {categories.length === 0 ? (
              <p className="flex items-start gap-2 rounded-xl border border-dashed border-border px-3.5 py-3 text-sm text-muted-foreground">
                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                {categoriesError
                  ? `The categories didn't load: ${categoriesError}`
                  : "There are no categories yet. Run the menu seed or add a category first."}
              </p>
            ) : (
              <div
                role="radiogroup"
                aria-labelledby="item-category-label"
                className="flex flex-wrap gap-2"
              >
                {categories.map((category) => {
                  const selected = field.value === category.id;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => field.onChange(category.id)}
                      onBlur={field.onBlur}
                      title={
                        category.isActive
                          ? undefined
                          : "This category is hidden from guests"
                      }
                      className={cn(chipClass, selected ? chipOn : chipOff)}
                    >
                      {selected ? (
                        <Check className="size-3.5" />
                      ) : (
                        !category.isActive && (
                          <EyeOff className="size-3.5 opacity-60" />
                        )
                      )}
                      {category.name}
                    </button>
                  );
                })}
              </div>
            )}
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <Controller
        name="slug"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid} className="gap-2">
            <FieldLabel htmlFor="item-slug">URL id</FieldLabel>
            <div className="flex">
              <span className="inline-flex items-center rounded-l-lg border border-r-0 border-input bg-muted px-3 font-mono text-xs text-muted-foreground">
                /menu/
              </span>
              <Input
                {...field}
                id="item-slug"
                aria-invalid={fieldState.invalid}
                onChange={(event) =>
                  field.onChange(
                    event.target.value.toLowerCase().replace(/\s+/g, "-"),
                  )
                }
                placeholder={currentSlug ?? autoSlug}
                autoComplete="off"
                spellCheck={false}
                maxLength={100}
                className={cn(inputClass, "rounded-l-none font-mono text-sm")}
              />
            </div>
            {currentSlug ? (
              field.value && field.value !== currentSlug ? (
                <p className="flex items-start gap-1.5 text-sm text-amber-700 dark:text-amber-300">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" />
                  Links to /menu/{currentSlug} will stop working (including the
                  homepage dish picks in config.json).
                </p>
              ) : (
                <FieldDescription>
                  Renaming the dish keeps this id, so existing links keep
                  working.
                </FieldDescription>
              )
            ) : (
              <FieldDescription>
                Leave empty to use{" "}
                <span className="font-mono text-foreground/80">{autoSlug}</span>
                . It can&apos;t change once the dish is live.
              </FieldDescription>
            )}
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
    </Section>
  );
}

function PricingSection({
  form,
  currency,
}: {
  form: UseFormReturn<Values>;
  currency: string;
}) {
  const { control, getValues, setValue } = form;
  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "variants",
  });
  const variants = useWatch({ control, name: "variants" });
  const { errors } = useFormState({ control, name: "variants" });
  const hasSizes = fields.length > 0;

  const switchToSizes = () => {
    replace([
      { ...newVariant("Regular", true), price: getValues("price") ?? 0 },
      newVariant("Large"),
    ]);
    setValue("compareAtPrice", undefined);
  };
  const switchToOnePrice = () => {
    const fallback = variants.find((v) => v.isDefault) ?? variants[0];
    if (getValues("price") === undefined && fallback)
      setValue("price", fallback.price, { shouldDirty: true });
    replace([]);
  };
  const setDefault = (index: number) =>
    variants.forEach((_, i) =>
      setValue(`variants.${i}.isDefault`, i === index, { shouldDirty: true }),
    );

  const rootError = errors.variants?.message ?? errors.variants?.root?.message;

  return (
    <Section
      icon={<Tag className="size-4.5" />}
      title="Price"
      description={
        hasSizes
          ? "Each size has its own price. The menu shows “from” the cheapest."
          : "What guests pay."
      }
      action={
        <Segmented
          label="Pricing"
          value={hasSizes ? "sizes" : "one"}
          options={[
            { value: "one", label: "One price" },
            { value: "sizes", label: "Sizes" },
          ]}
          onChange={(value) =>
            value === "sizes" ? switchToSizes() : switchToOnePrice()
          }
        />
      }
    >
      {!hasSizes ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            name="price"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-2">
                <FieldLabel htmlFor="item-price">Price</FieldLabel>
                <MoneyInput
                  id="item-price"
                  currency={currency}
                  field={field}
                  invalid={fieldState.invalid}
                  large
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            name="compareAtPrice"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-2">
                <FieldLabel htmlFor="item-compare">
                  Was{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </FieldLabel>
                <MoneyInput
                  id="item-compare"
                  currency={currency}
                  field={field}
                  invalid={fieldState.invalid}
                  large
                />
                <FieldDescription>
                  Shown crossed out, for a promotion.
                </FieldDescription>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="hidden grid-cols-[auto_minmax(0,1fr)_9rem_auto_auto] gap-3 px-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase sm:grid">
            <span className="w-14">Default</span>
            <span>Size</span>
            <span>Price</span>
            <span className="w-16 text-center whitespace-nowrap">In stock</span>
            <span className="w-9" />
          </div>
          {fields.map((row, index) => (
            <div
              key={row.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 rounded-xl border border-border bg-background/50 p-3 sm:grid-cols-[auto_minmax(0,1fr)_9rem_auto_auto] sm:border-0 sm:bg-transparent sm:p-0"
            >
              <div className="flex h-10 w-14 items-center justify-center">
                <RadioDot
                  checked={variants[index]?.isDefault ?? false}
                  onClick={() => setDefault(index)}
                  label={`Open on ${variants[index]?.name || "this size"}`}
                />
              </div>
              <Controller
                name={`variants.${index}.name`}
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="gap-1">
                    <Input
                      {...field}
                      aria-label="Size name"
                      aria-invalid={fieldState.invalid}
                      placeholder={index === 0 ? "Glass" : "Bottle"}
                      maxLength={40}
                      className={inputClass}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <RemoveButton
                label="Remove size"
                onClick={() => remove(index)}
                className="sm:order-last"
              />
              <Controller
                name={`variants.${index}.price`}
                control={control}
                render={({ field, fieldState }) => (
                  <Field
                    data-invalid={fieldState.invalid}
                    className="col-span-2 gap-1 sm:col-span-1"
                  >
                    <MoneyInput
                      currency={currency}
                      field={field}
                      invalid={fieldState.invalid}
                      ariaLabel="Size price"
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <Controller
                name={`variants.${index}.isAvailable`}
                control={control}
                render={({ field }) => (
                  <div className="col-start-3 row-start-2 flex h-10 w-14 items-center justify-center sm:col-start-auto sm:row-start-auto sm:w-16">
                    <Switch
                      checked={field.value}
                      onChange={field.onChange}
                      label="In stock"
                      small
                    />
                  </div>
                )}
              />
            </div>
          ))}
          {rootError && (
            <p className="text-sm font-medium text-destructive">{rootError}</p>
          )}
          <AddButton
            disabled={fields.length >= MAX_VARIANTS}
            onClick={() => append(newVariant())}
          >
            Add size
          </AddButton>
        </div>
      )}
    </Section>
  );
}

const GROUP_PRESETS: {
  label: string;
  hint: string;
  make: () => ModifierGroupValues;
}[] = [
  {
    label: "Cooking",
    hint: "Guest picks 1",
    make: () => ({
      ...newGroup("Cooking"),
      minSelect: 1,
      maxSelect: 1,
      options: ["Rare", "Medium", "Well done"].map((n) => newOption(n)),
    }),
  },
  {
    label: "Extras",
    hint: "Up to 3, paid",
    make: () => ({
      ...newGroup("Extras"),
      minSelect: 0,
      maxSelect: 3,
      options: [newOption(), newOption(), newOption()],
    }),
  },
  { label: "Custom", hint: "Start empty", make: () => newGroup() },
];

function ChoicesSection({
  control,
  currency,
}: {
  control: Control<Values>;
  currency: string;
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "modifierGroups",
  });

  return (
    <Section
      icon={<ListChecks className="size-4.5" />}
      title="Choices & extras"
      description="Optional. Cooking, sides, sauces, add-ons."
    >
      {fields.map((group, index) => (
        <GroupEditor
          key={group.id}
          control={control}
          index={index}
          currency={currency}
          onRemove={() => remove(index)}
        />
      ))}

      {fields.length < MAX_GROUPS && (
        <div
          className={cn(
            "grid gap-2 sm:grid-cols-3",
            fields.length > 0 && "border-t border-dashed border-border pt-5",
          )}
        >
          {GROUP_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => append(preset.make())}
              className="group flex items-center gap-3 rounded-xl border border-dashed border-border px-3.5 py-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/15 group-hover:text-primary">
                <Plus className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  {preset.label}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {preset.hint}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </Section>
  );
}

function GroupEditor({
  control,
  index,
  currency,
  onRemove,
}: {
  control: Control<Values>;
  index: number;
  currency: string;
  onRemove: () => void;
}) {
  const base = `modifierGroups.${index}` as const;
  const { fields, append, remove } = useFieldArray({
    control,
    name: `${base}.options`,
  });
  const group = useWatch({ control, name: base });
  const { errors } = useFormState({ control, name: base });
  const groupErrors = errors.modifierGroups?.[index];
  const optionsError =
    groupErrors?.options?.message ?? groupErrors?.options?.root?.message;
  const ruleError =
    groupErrors?.minSelect?.message ?? groupErrors?.maxSelect?.message;

  const rule =
    group.minSelect === 0
      ? `Optional · up to ${group.maxSelect}`
      : group.minSelect === group.maxSelect
        ? `Required · pick ${group.minSelect}`
        : `Required · ${group.minSelect} to ${group.maxSelect}`;

  return (
    <div className="rounded-xl border border-border bg-background/40">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-2.5 border-b border-border/70 p-3 sm:p-4">
        <Controller
          name={`${base}.name`}
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="min-w-0 gap-1">
              <Input
                {...field}
                aria-label="Group name"
                aria-invalid={fieldState.invalid}
                placeholder="Group name, e.g. Sauce"
                maxLength={40}
                className={cn(inputClass, "font-medium")}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <RemoveButton label="Remove group" onClick={onRemove} />
        <div className="col-span-2 grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <Controller
            name={`${base}.minSelect`}
            control={control}
            render={({ field, fieldState }) => (
              <Stepper
                label="At least"
                value={field.value}
                onChange={field.onChange}
                min={0}
                max={MAX_OPTIONS}
                invalid={fieldState.invalid}
              />
            )}
          />
          <Controller
            name={`${base}.maxSelect`}
            control={control}
            render={({ field, fieldState }) => (
              <Stepper
                label="At most"
                value={field.value}
                onChange={field.onChange}
                min={1}
                max={MAX_OPTIONS}
                invalid={fieldState.invalid}
              />
            )}
          />
        </div>
        {ruleError && (
          <p className="col-span-2 w-full text-sm font-medium text-destructive">
            {ruleError}
          </p>
        )}
        <p className="col-span-2 w-full text-xs font-medium text-muted-foreground">
          {rule}
        </p>
      </div>

      <div className="space-y-2 p-3 sm:p-4">
        {fields.map((option, o) => (
          <div
            key={option.id}
            className="grid grid-cols-[minmax(0,1fr)_7.5rem_auto] items-start gap-2 border-b border-dashed border-border pb-3 last-of-type:border-0 sm:grid-cols-[minmax(0,1fr)_8.5rem_auto_auto] sm:border-0 sm:pb-0"
          >
            <Controller
              name={`${base}.options.${o}.name`}
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="gap-1">
                  <Input
                    {...field}
                    aria-label="Option name"
                    aria-invalid={fieldState.invalid}
                    placeholder={["Fries", "Side salad", "Extra cheese"][o % 3]}
                    maxLength={40}
                    className={inputClass}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              name={`${base}.options.${o}.priceDelta`}
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="gap-1">
                  <MoneyInput
                    currency={currency}
                    field={field}
                    invalid={fieldState.invalid}
                    ariaLabel="Extra price"
                    prefix="+"
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <RemoveButton
              label="Remove option"
              onClick={() => remove(o)}
              className="sm:order-last"
            />
            <div className="col-span-3 flex items-center gap-5 pl-1 sm:col-span-1 sm:h-10 sm:gap-3 sm:pl-0">
              <Controller
                name={`${base}.options.${o}.isDefault`}
                control={control}
                render={({ field }) => (
                  <MiniCheck
                    checked={field.value}
                    onChange={field.onChange}
                    label="Pre-selected"
                  />
                )}
              />
              <Controller
                name={`${base}.options.${o}.isAvailable`}
                control={control}
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onChange={field.onChange}
                    label="In stock"
                    small
                    showLabel
                  />
                )}
              />
            </div>
          </div>
        ))}
        {optionsError && (
          <p className="text-sm font-medium text-destructive">{optionsError}</p>
        )}
        <AddButton
          disabled={fields.length >= MAX_OPTIONS}
          onClick={() => append(newOption())}
        >
          Add option
        </AddButton>
      </div>
    </div>
  );
}

function DietSection({ control }: { control: Control<Values> }) {
  return (
    <Section
      icon={<Leaf className="size-4.5" />}
      title="Dietary & allergens"
      description="Helps guests choose safely."
    >
      <Controller
        name="dietaryTags"
        control={control}
        render={({ field }) => (
          <ChipGroup
            label="Suitable for"
            options={DIETARY_TAGS}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
      <Controller
        name="allergens"
        control={control}
        render={({ field }) => (
          <ChipGroup
            label="Contains"
            hint="The 14 allergens restaurants must declare in the EU and UK."
            options={ALLERGENS}
            value={field.value}
            onChange={field.onChange}
            tone="warning"
            icon={<ShieldAlert className="size-3.5" />}
          />
        )}
      />
      <Controller
        name="spiceLevel"
        control={control}
        render={({ field }) => (
          <div>
            <p className="mb-2 text-sm font-medium">Spice</p>
            <div
              role="radiogroup"
              aria-label="Spice level"
              className="grid grid-cols-4 gap-1.5 rounded-xl bg-muted p-1 sm:max-w-md"
            >
              {SPICE_LEVELS.map((label, level) => {
                const on = field.value === level;
                return (
                  <button
                    key={label}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => field.onChange(level)}
                    className={cn(
                      "flex h-9 items-center justify-center gap-1 rounded-lg text-[13px] font-medium transition-all",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                      on
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {level > 0 && (
                      <span
                        className={cn(
                          "inline-flex",
                          on ? "text-red-500" : "opacity-60",
                        )}
                      >
                        {Array.from({ length: level }, (_, i) => (
                          <Flame key={i} className="-mx-0.5 size-3.5" />
                        ))}
                      </span>
                    )}
                    <span className={cn(level > 0 && "hidden sm:inline")}>
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      />
    </Section>
  );
}

function DetailsSection({ control }: { control: Control<Values> }) {
  return (
    <Section
      icon={<Sparkles className="size-4.5" />}
      title="Highlights & details"
      description="Optional extras for the menu card."
    >
      <Controller
        name="badges"
        control={control}
        render={({ field }) => (
          <ChipGroup
            label="Badges"
            options={MENU_BADGES}
            value={field.value}
            onChange={field.onChange}
            tone="primary"
          />
        )}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          name="calories"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="gap-2">
              <FieldLabel htmlFor="item-calories">Calories</FieldLabel>
              <NumberInput
                id="item-calories"
                field={field}
                invalid={fieldState.invalid}
                suffix="kcal"
                placeholder="620"
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          name="prepTimeMinutes"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="gap-2">
              <FieldLabel htmlFor="item-prep">Preparation time</FieldLabel>
              <NumberInput
                id="item-prep"
                field={field}
                invalid={fieldState.invalid}
                suffix="min"
                placeholder="15"
              />
              <FieldDescription>
                Used for “ready in” times on online orders.
              </FieldDescription>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </div>
    </Section>
  );
}

type Picked = {
  url: string;
  originalBytes: number;
  result?: { bytes: number; width: number; height: number };
  current?: boolean;
};

function PreviewCard({
  control,
  currency,
  categories,
  currentPhoto,
}: {
  control: Control<Values>;
  currency: string;
  categories: Category[];
  currentPhoto?: string;
}) {
  const { field, fieldState } = useController({ control, name: "image" });
  const values = useWatch({ control });
  const inputRef = useRef<HTMLInputElement>(null);
  const showCurrent = (): Picked | null =>
    currentPhoto
      ? {
          url: mediaSrc(currentPhoto) ?? currentPhoto,
          originalBytes: 0,
          current: true,
        }
      : null;
  const [picked, setPicked] = useState<Picked | null>(showCurrent);
  const [dragging, setDragging] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const upload = useMutation({
    mutationKey: PHOTO_MUTATION,
    mutationFn: async (file: File) => {
      const prepared = await prepareImage(file);
      if (prepared.size > 15 * 1024 * 1024)
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
    () => () =>
      void (picked && !picked.current && URL.revokeObjectURL(picked.url)),
    [picked],
  );

  const choose = (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/"))
      return setProblem("That file isn't a photo.");
    if (file.size > 40 * 1024 * 1024)
      return setProblem("That photo is over 40 MB.");
    setProblem(null);
    field.onChange(null);
    setPicked({ url: URL.createObjectURL(file), originalBytes: file.size });

    upload.mutate(file, {
      onSuccess: (image) => {
        field.onChange(image.key);
        setPicked(
          (current) =>
            current && {
              ...current,
              result: {
                bytes: image.bytes,
                width: image.width,
                height: image.height,
              },
            },
        );
      },
      onError: (error) => {
        setProblem(error.message || "The photo couldn't be uploaded.");
        setPicked(showCurrent());
        field.onChange(currentPhoto ?? null);
      },
    });
  };

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      const file = Array.from(event.clipboardData?.files ?? []).find((f) =>
        f.type.startsWith("image/"),
      );
      if (file) {
        event.preventDefault();
        choose(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  const clear = () => {
    field.onChange(null);
    setPicked(null);
    setProblem(null);
    upload.reset();
  };

  const keepCurrent = () => {
    field.onChange(currentPhoto ?? null);
    setPicked(showCurrent());
    setProblem(null);
    upload.reset();
  };
  const photoChanged =
    currentPhoto !== undefined &&
    field.value !== currentPhoto &&
    !upload.isPending;

  const error = problem ?? fieldState.error?.message;
  const variants = values.variants ?? [];
  const priceShown = variants.length
    ? Math.min(...variants.map((v) => v?.price ?? 0))
    : values.price;
  const category = categories.find((c) => c.id === values.categoryId);

  return (
    <section
      aria-label="Photo and preview"
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
        className="relative aspect-16/10 bg-muted lg:aspect-4/3"
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
          <>
            <Image
              src={picked.url}
              alt=""
              fill
              unoptimized={!picked.current || !canOptimize(picked.url)}
              quality={90}
              sizes="340px"
              className="object-cover"
            />
            {upload.isPending && (
              <div className="absolute inset-0 grid place-items-center bg-black/35 backdrop-blur-[2px]">
                <span className="inline-flex items-center gap-2 rounded-full bg-black/60 px-3.5 py-1.5 text-xs font-medium text-white">
                  <LoaderCircle className="size-3.5 animate-spin" /> Optimizing…
                </span>
              </div>
            )}
            {picked.result && (
              <span
                className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur"
                title={`${picked.result.width} × ${picked.result.height} WebP`}
              >
                <Zap className="size-3 text-amber-300" />
                {formatBytes(picked.originalBytes)} →{" "}
                {formatBytes(picked.result.bytes)}
              </span>
            )}
            <div className="absolute top-2.5 right-2.5 flex gap-1.5">
              <PhotoAction
                label="Replace photo"
                onClick={() => inputRef.current?.click()}
                disabled={upload.isPending}
              >
                <RefreshCw className="size-4" />
              </PhotoAction>
              <PhotoAction label="Remove photo" onClick={clear}>
                <Trash2 className="size-4" />
              </PhotoAction>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={cn(
              "absolute inset-2 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-center transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              dragging
                ? "border-primary bg-primary/10"
                : "border-foreground/15 hover:border-primary/50 hover:bg-primary/5",
            )}
          >
            <span className="grid size-12 place-items-center rounded-2xl bg-card text-primary shadow-sm">
              {dragging ? (
                <CloudUpload className="size-6" />
              ) : (
                <ImagePlus className="size-6" />
              )}
            </span>
            <span className="text-sm font-semibold">
              {dragging ? "Drop it here" : "Add a photo"}
            </span>
            <span className="px-6 text-xs text-muted-foreground">
              Drag, <span className="hidden sm:inline">paste </span>or browse.
              Big photos are fine, we&apos;ll shrink them.
            </span>
            <span className="mt-1 hidden items-center gap-1 text-[11px] text-muted-foreground/80 sm:inline-flex">
              <ClipboardPaste className="size-3" /> ⌘V works too
            </span>
          </button>
        )}

        <div className="pointer-events-none absolute top-2.5 left-2.5 flex flex-col items-start gap-1.5">
          {values.isActive === false && (
            <span className="inline-flex items-center gap-1 rounded-full bg-foreground px-2.5 py-1 text-[11px] font-semibold text-background">
              <EyeOff className="size-3" /> Hidden draft
            </span>
          )}
          {values.isAvailable === false && (
            <span className="rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-white">
              Sold out
            </span>
          )}
        </div>
      </div>

      {photoChanged && (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
          <span>
            {field.value === null
              ? "The photo will be removed when you save."
              : "The new photo replaces the current one when you save."}
          </span>
          <button
            type="button"
            onClick={keepCurrent}
            className="shrink-0 font-semibold text-foreground underline-offset-4 hover:underline"
          >
            Keep current
          </button>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 border-b border-destructive/20 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}

      <div className="hidden p-4 lg:block">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          Preview{category ? ` · ${category.name}` : ""}
        </p>
        <div className="mt-2 flex items-start justify-between gap-3">
          <h3
            className={cn(
              "text-base leading-snug font-semibold",
              !values.name && "text-muted-foreground/60",
            )}
          >
            {values.name || "Dish name"}
          </h3>
          <div className="shrink-0 text-right leading-tight">
            <p className="font-semibold tabular-nums">
              {variants.length > 1 && (
                <span className="mr-1 text-xs font-normal text-muted-foreground">
                  from
                </span>
              )}
              {priceShown !== undefined
                ? formatPrice(priceShown, currency)
                : "—"}
            </p>
            {!variants.length && values.compareAtPrice !== undefined && (
              <p className="text-xs text-muted-foreground tabular-nums line-through">
                {formatPrice(values.compareAtPrice, currency)}
              </p>
            )}
          </div>
        </div>
        <p
          className={cn(
            "mt-1 line-clamp-3 text-[13px] leading-relaxed",
            values.description
              ? "text-muted-foreground"
              : "text-muted-foreground/50",
          )}
        >
          {values.description || "A short, tasty description goes here."}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badges badges={(values.badges ?? []) as string[]} />
          <DietIcons
            item={{
              dietaryTags: (values.dietaryTags ?? []) as string[],
              spiceLevel: values.spiceLevel ?? 0,
            }}
          />
        </div>
        {(values.allergens?.length ?? 0) > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">Contains:</span>{" "}
            {values.allergens!.map((a) => tagLabel(a!)).join(", ")}
          </p>
        )}
      </div>
    </section>
  );
}

function PhotoAction({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className="grid size-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-50"
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
}

function VisibilityCard({ control }: { control: Control<Values> }) {
  return (
    <section
      aria-label="Visibility"
      className="divide-y divide-border rounded-2xl border border-border bg-card shadow-xs"
    >
      <Controller
        name="isActive"
        control={control}
        render={({ field }) => (
          <ToggleRow
            title="Show on the menu"
            description={
              field.value
                ? "Guests see it on the menu."
                : "Saved as a hidden draft."
            }
            checked={field.value}
            onChange={field.onChange}
          />
        )}
      />
      <Controller
        name="isAvailable"
        control={control}
        render={({ field }) => (
          <ToggleRow
            title="In stock"
            description={
              field.value ? "Guests can order it." : "Shown as sold out."
            }
            checked={field.value}
            onChange={field.onChange}
          />
        )}
      />
    </section>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <p id={id} className="text-sm font-medium">
          {title}
        </p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onChange={onChange} labelledBy={id} />
    </div>
  );
}

const inputClass =
  "h-10 w-full rounded-lg border-input bg-background px-3 text-sm shadow-xs transition-colors placeholder:text-muted-foreground/70 hover:border-foreground/25 focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-primary/15 dark:bg-input/20 aria-invalid:border-destructive aria-invalid:ring-destructive/15 border outline-none";

const chipClass =
  "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50";
const chipOn = "border-foreground bg-foreground text-background shadow-sm";
const chipOff =
  "border-border bg-background text-foreground/80 hover:border-foreground/25 hover:text-foreground";

type NumberField = {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  onBlur: () => void;
  name: string;
  ref: Ref<HTMLInputElement>;
};

const toNumber = (raw: string) => (raw.trim() === "" ? undefined : Number(raw));

function MoneyInput({
  id,
  currency,
  field,
  invalid,
  ariaLabel,
  large,
  prefix = "",
}: {
  id?: string;
  currency: string;
  field: NumberField;
  invalid: boolean;
  ariaLabel?: string;
  large?: boolean;
  prefix?: string;
}) {
  const symbol = currencySymbol(currency);
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
        {prefix}
        {symbol}
      </span>
      <Input
        {...field}
        id={id}
        type="number"
        inputMode="decimal"
        step="0.01"
        min={0}
        aria-label={ariaLabel}
        aria-invalid={invalid}
        value={field.value ?? ""}
        onChange={(event) => field.onChange(toNumber(event.target.value))}
        onWheel={(event) => event.currentTarget.blur()}
        placeholder="0.00"
        className={cn(
          inputClass,
          "tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          prefix || symbol.length > 1 ? "pl-11" : "pl-7",
          large && "h-11 text-base font-semibold",
        )}
      />
    </div>
  );
}

function NumberInput({
  id,
  field,
  invalid,
  suffix,
  placeholder,
}: {
  id: string;
  field: NumberField;
  invalid: boolean;
  suffix: string;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Input
        {...field}
        id={id}
        type="number"
        inputMode="numeric"
        step={1}
        min={0}
        aria-invalid={invalid}
        value={field.value ?? ""}
        onChange={(event) => field.onChange(toNumber(event.target.value))}
        onWheel={(event) => event.currentTarget.blur()}
        placeholder={placeholder}
        className={cn(
          inputClass,
          "pr-14 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none",
        )}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
        {suffix}
      </span>
    </div>
  );
}

function Switch({
  checked,
  onChange,
  label,
  labelledBy,
  small,
  showLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  labelledBy?: string;
  small?: boolean;
  showLabel?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      onClick={() => onChange(!checked)}
      className="group inline-flex items-center gap-2 rounded-full focus-visible:outline-none"
    >
      <span
        className={cn(
          "relative inline-flex shrink-0 items-center rounded-full transition-colors group-focus-visible:ring-2 group-focus-visible:ring-primary/50 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background",
          small ? "h-5 w-9" : "h-6 w-11",
          checked ? "bg-emerald-500" : "bg-foreground/15",
        )}
      >
        <span
          className={cn(
            "inline-block rounded-full bg-white shadow-sm transition-transform",
            small ? "size-4" : "size-5",
            checked
              ? small
                ? "translate-x-4.5"
                : "translate-x-5.5"
              : "translate-x-0.5",
          )}
        />
      </span>
      {showLabel && (
        <span className="text-xs text-muted-foreground">{label}</span>
      )}
    </button>
  );
}

function MiniCheck({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 rounded-md text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      <span
        className={cn(
          "grid size-4 place-items-center rounded-[5px] border transition-colors",
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-foreground/25 bg-background",
        )}
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      {label}
    </button>
  );
}

function RadioDot({
  checked,
  onClick,
  label,
}: {
  checked: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={label}
      title="Pre-selected size"
      onClick={onClick}
      className="grid size-5 place-items-center rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 data-[on=true]:border-primary data-[on=false]:border-foreground/25"
      data-on={checked}
    >
      <span
        className={cn(
          "size-2 rounded-full bg-primary transition-transform",
          checked ? "scale-100" : "scale-0",
        )}
      />
    </button>
  );
}

function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  invalid,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  invalid?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "flex h-10 items-center rounded-lg border bg-background",
        invalid ? "border-destructive" : "border-input",
      )}
    >
      <span className="flex-1 pr-1 pl-2.5 text-[11px] font-medium whitespace-nowrap text-muted-foreground">
        {label}
      </span>
      <button
        type="button"
        aria-label={`${label}: less`}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
      >
        <Minus className="size-3.5" />
      </button>
      <span
        className="w-5 text-center text-sm font-semibold tabular-nums"
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        aria-label={`${label}: more`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex shrink-0 rounded-lg bg-muted p-0.5"
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => !on && onChange(option.value)}
            className={cn(
              "h-8 rounded-md px-3 text-[13px] font-medium whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              on
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function ChipGroup<T extends string>({
  label,
  hint,
  options,
  value,
  onChange,
  tone = "neutral",
  icon,
}: {
  label: string;
  hint?: string;
  options: readonly T[];
  value: T[];
  onChange: (value: T[]) => void;
  tone?: "neutral" | "warning" | "primary";
  icon?: ReactNode;
}) {
  const id = useId();
  const on = {
    neutral:
      "border-emerald-600/30 bg-emerald-500/12 text-emerald-800 dark:text-emerald-300",
    warning:
      "border-amber-600/30 bg-amber-500/15 text-amber-800 dark:text-amber-300",
    primary: "border-primary/30 bg-primary/12 text-primary",
  }[tone];

  return (
    <div role="group" aria-labelledby={id}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p id={id} className="text-sm font-medium">
          {label}
        </p>
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const selected = value.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                onChange(
                  selected
                    ? value.filter((v) => v !== option)
                    : [...value, option],
                )
              }
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                selected
                  ? on
                  : "border-border bg-background text-foreground/75 hover:border-foreground/25 hover:text-foreground",
              )}
            >
              {selected ? (icon ?? <Check className="size-3.5" />) : null}
              {tagLabel(option)}
            </button>
          );
        })}
      </div>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function AddButton({
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
      className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-40"
    >
      <Plus className="size-4" /> {children}
    </button>
  );
}

function RemoveButton({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        className,
      )}
    >
      <X className="size-4" />
      <span className="sr-only">{label}</span>
    </button>
  );
}

function currencySymbol(code: string): string {
  try {
    return (
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: code,
        currencyDisplay: "narrowSymbol",
      })
        .formatToParts(0)
        .find((part) => part.type === "currency")?.value ?? code
    );
  } catch {
    return code;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const UPLOAD_MAX_SIDE = 2400;
const SEND_AS_IS_BYTES = 1.5 * 1024 * 1024;

async function prepareImage(file: File): Promise<File> {
  const webFriendly = ["image/jpeg", "image/png", "image/webp"].includes(
    file.type,
  );
  if (webFriendly && file.size <= SEND_AS_IS_BYTES) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  const scale = Math.min(
    1,
    UPLOAD_MAX_SIDE / Math.max(bitmap.width, bitmap.height),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const mayHaveAlpha =
    file.type === "image/png" ||
    file.type === "image/webp" ||
    file.type === "image/gif";
  const encode = (type: string, quality?: number) =>
    new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, type, quality),
    );

  let blob = mayHaveAlpha
    ? await encode("image/webp", 0.95)
    : await encode("image/jpeg", 0.95);
  if (mayHaveAlpha && blob?.type !== "image/webp")
    blob = await encode("image/png");
  if (!blob || (webFriendly && blob.size >= file.size)) return file;

  const extension = blob.type.split("/")[1] ?? "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${baseName}.${extension}`, {
    type: blob.type,
    lastModified: Date.now(),
  });
}
