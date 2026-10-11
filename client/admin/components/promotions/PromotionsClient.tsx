"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  useController,
  useForm,
  useWatch,
  type Control,
  type FieldPath,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import {
  ArrowRight,
  CalendarClock,
  Check,
  CircleAlert,
  Clock,
  EyeOff,
  LayoutGrid,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Percent,
  Plus,
  Search,
  Sparkles,
  Store,
  Trash2,
  UtensilsCrossed,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { DAYS, dayShort, type Day } from "@/lib/opening-hours";
import {
  appliesTo,
  MAX_PERCENT,
  MAX_WINDOWS,
  promotionState,
  ROUND_STEPS,
  salePrice,
} from "@/lib/promotions";
import { formatPrice } from "@/admin/lib/menu/format";
import { PRICE_DECIMALS } from "@/admin/lib/menu/item-schema";
import {
  deletePromotion,
  savePromotion,
  setPromotionActive,
} from "@/admin/lib/promotion-actions";
import {
  PROMOTIONS_PATH,
  promotionFormIssues,
  scheduleLabel,
  statusInfo,
  toPromotionPayload,
  WEEKDAYS,
  WEEKEND,
  type AdminPromotion,
  type PromotionCatalog,
  type PromotionFormValues,
} from "@/admin/lib/promotions";
import { DishThumb } from "../menu/MenuClient";
import { Section, Switch, TimeInput, inputClass } from "./FormParts";

type Values = PromotionFormValues;
type Catalog = PromotionCatalog;
type Dish = Catalog["dishes"][number];

const MINOR = 10 ** PRICE_DECIMALS;

export function StatusPill({
  label,
  tone,
  className,
}: {
  label: string;
  tone: "live" | "soon" | "off" | "ended";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        tone === "live" &&
          "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
        tone === "soon" && "bg-sky-500/12 text-sky-700 dark:text-sky-300",
        tone === "off" && "bg-amber-500/12 text-amber-700 dark:text-amber-300",
        tone === "ended" && "bg-foreground/8 text-muted-foreground",
        className,
      )}
    >
      {tone === "live" ? (
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-50 motion-reduce:hidden" />
          <span className="relative size-1.5 rounded-full bg-emerald-500" />
        </span>
      ) : (
        <span
          className={cn(
            "size-1.5 rounded-full",
            tone === "soon"
              ? "bg-sky-500"
              : tone === "off"
                ? "bg-amber-500"
                : "bg-muted-foreground/50",
          )}
        />
      )}
      {label}
    </span>
  );
}

function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

type FormProps = {
  promotion?: AdminPromotion;
  initial: Values;
  catalog: Catalog;
  currency: string;
  timezone: string;
};

export function PromotionForm({
  promotion,
  initial,
  catalog,
  currency,
  timezone,
}: FormProps) {
  const router = useRouter();
  const editing = !!promotion;
  const schema = useMemo(
    () =>
      z.custom<Values>().superRefine((values, ctx) => {
        for (const [path, message] of Object.entries(
          promotionFormIssues(values, timezone),
        ))
          ctx.addIssue({
            code: "custom",
            path: path.split(".").map((p) => (/^\d+$/.test(p) ? Number(p) : p)),
            message,
          });
      }),
    [timezone],
  );
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: initial,
  });
  const { control, formState, handleSubmit, setError, reset } = form;
  const values = useWatch({ control }) as Values;
  const issues = useMemo(
    () => promotionFormIssues(values, timezone),
    [values, timezone],
  );
  const shown = (path: string) =>
    formState.isSubmitted ? issues[path] : undefined;

  const save = useMutation({
    mutationFn: async (v: Values) => {
      const result = await savePromotion(promotion?.id ?? null, v);
      if (!result.ok)
        throw Object.assign(new Error(result.message), {
          fieldErrors: result.fieldErrors,
        });
      return result.data;
    },
    onSuccess: (saved) => {
      reset(values);
      toast.add({
        title: editing ? "Promotion saved" : `“${saved.name}” created`,
        description: "The menu shows the new prices now.",
        type: "success",
      });
      router.push(PROMOTIONS_PATH);
      router.refresh();
    },
    onError: (error: Error & { fieldErrors?: Record<string, string> }) => {
      Object.entries(error.fieldErrors ?? {}).forEach(([path, message], i) =>
        setError(
          path as FieldPath<Values>,
          { type: "server", message },
          { shouldFocus: i === 0 },
        ),
      );
      toast.add({
        title: "The promotion wasn't saved",
        description: error.message,
        type: "error",
      });
    },
  });

  const dirty = formState.isDirty && !save.isSuccess;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const issueCount = formState.isSubmitted ? Object.keys(issues).length : 0;

  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <OfferSection control={control} shown={shown} />
          <ScopeSection
            control={control}
            values={values}
            catalog={catalog}
            shown={shown}
          />
          <WhenSection control={control} shown={shown} timezone={timezone} />
        </div>
        <aside className="lg:sticky lg:top-6">
          <Preview
            values={values}
            catalog={catalog}
            currency={currency}
            timezone={timezone}
          />
        </aside>
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 mt-8 border-t border-border bg-background/85 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur-md sm:-mx-8 sm:px-8">
        <div className="flex items-center gap-3">
          <p
            className="hidden min-w-0 flex-1 truncate text-sm text-muted-foreground sm:block"
            aria-live="polite"
          >
            {issueCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-destructive">
                <CircleAlert className="size-4" />{" "}
                {issueCount === 1
                  ? "1 thing needs"
                  : `${issueCount} things need`}{" "}
                fixing
              </span>
            ) : dirty ? (
              <span className="inline-flex items-center gap-2">
                <span className="size-2 rounded-full bg-amber-500" /> Unsaved
                changes
              </span>
            ) : editing ? (
              "No changes yet"
            ) : (
              "Prices on the menu change as soon as it's created."
            )}
          </p>
          <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none">
            <Link
              href={PROMOTIONS_PATH}
              className="inline-flex h-11 items-center rounded-xl px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:h-10 sm:rounded-lg"
            >
              Cancel
            </Link>
            <Button
              type="submit"
              disabled={save.isPending || (editing && !formState.isDirty)}
              className="h-11 flex-1 rounded-xl px-5 text-[15px] font-semibold shadow-[0_6px_20px_-6px_color-mix(in_srgb,var(--primary)_70%,transparent)] sm:h-10 sm:flex-none sm:text-sm"
            >
              {save.isPending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              {save.isPending
                ? "Saving…"
                : editing
                  ? "Save changes"
                  : "Create promotion"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

type Shown = (path: string) => string | undefined;

const QUICK_PERCENTS = [10, 15, 20, 25, 30, 50];

function OfferSection({
  control,
  shown,
}: {
  control: Control<Values>;
  shown: Shown;
}) {
  const name = useController({ control, name: "name" });
  const percent = useController({ control, name: "percentOff" });
  const round = useController({ control, name: "roundTo" });
  const active = useController({ control, name: "isActive" });
  const [draft, setDraft] = useState(String(percent.field.value ?? ""));
  const [seen, setSeen] = useState(percent.field.value);
  if (percent.field.value !== seen) {
    setSeen(percent.field.value);
    setDraft(String(percent.field.value ?? ""));
  }

  return (
    <Section
      icon={<Percent className="size-4.5" />}
      title="The offer"
      description="What guests get, and the name they see next to the prices."
    >
      <div>
        <label htmlFor="promo-name" className="text-sm font-medium">
          Name
        </label>
        <input
          id="promo-name"
          {...name.field}
          maxLength={40}
          placeholder="Happy hour, Summer sale…"
          aria-invalid={shown("name") ? true : undefined}
          className={cn(inputClass, "mt-1.5 h-11 text-[15px]")}
        />
        <FieldNote error={shown("name") ?? name.fieldState.error?.message}>
          Shown on the menu as “{name.field.value?.trim() || "Happy hour"} ·{" "}
          {Number.isFinite(percent.field.value) ? percent.field.value : 20}%
          off”.
        </FieldNote>
      </div>

      <div>
        <p className="text-sm font-medium">Discount</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <div className="relative">
            <input
              inputMode="numeric"
              value={draft}
              onChange={(event) => {
                const text = event.target.value
                  .replace(/[^\d]/g, "")
                  .slice(0, 2);
                setDraft(text);
                percent.field.onChange(text === "" ? Number.NaN : Number(text));
              }}
              onBlur={percent.field.onBlur}
              aria-label="Percent off"
              aria-invalid={shown("percentOff") ? true : undefined}
              className={cn(
                inputClass,
                "h-12 w-24 pr-8 text-center text-xl font-semibold tabular-nums",
              )}
            />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-lg font-semibold text-muted-foreground">
              %
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PERCENTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => percent.field.onChange(p)}
                className={cn(
                  "h-9 rounded-lg border px-3 text-sm font-semibold tabular-nums transition-colors",
                  percent.field.value === p
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:border-foreground/25 hover:bg-muted",
                )}
              >
                {p}%
              </button>
            ))}
          </div>
        </div>
        <FieldNote
          error={shown("percentOff")}
        >{`Up to ${MAX_PERCENT}%. Extras and add-ons keep their price.`}</FieldNote>
      </div>

      <div>
        <p className="text-sm font-medium">Round sale prices</p>
        <div
          role="radiogroup"
          aria-label="Round sale prices"
          className="mt-1.5 inline-flex flex-wrap gap-1 rounded-xl border border-border bg-muted/50 p-1"
        >
          {ROUND_STEPS.map((step) => (
            <button
              key={step}
              type="button"
              role="radio"
              aria-checked={round.field.value === step}
              onClick={() => round.field.onChange(step)}
              className={cn(
                "h-8 rounded-lg px-3 text-sm font-medium tabular-nums transition-colors",
                round.field.value === step
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {step === 0 ? "Exact" : (step / MINOR).toFixed(2)}
            </button>
          ))}
        </div>
        <FieldNote>
          Always rounded down, so guests get at least the discount. 0.25 turns
          11.60 into 11.50.
        </FieldNote>
      </div>

      <div className="-mx-4 flex items-center gap-3 border-t border-border/70 px-4 pt-4 sm:-mx-6 sm:px-6">
        <div className="min-w-0 flex-1">
          <p id="promo-live" className="text-sm font-medium">
            {active.field.value ? "Live" : "Paused"}
          </p>
          <p className="text-xs text-muted-foreground">
            {active.field.value
              ? "Applies whenever its schedule says so."
              : "Never applies until you switch it back on."}
          </p>
        </div>
        <Switch
          checked={!!active.field.value}
          onChange={active.field.onChange}
          labelledBy="promo-live"
        />
      </div>
    </Section>
  );
}

function ScopeSection({
  control,
  values,
  catalog,
  shown,
}: {
  control: Control<Values>;
  values: Values;
  catalog: Catalog;
  shown: Shown;
}) {
  const scope = useController({ control, name: "scope" });
  const categoryIds = useController({ control, name: "categoryIds" });
  const dishIds = useController({ control, name: "dishIds" });
  const excluded = useController({ control, name: "excludedDishIds" });
  const [showExclusions, setShowExclusions] = useState(
    (values.excludedDishIds ?? []).length > 0,
  );

  const options = [
    {
      value: "menu",
      label: "Whole menu",
      hint: `${catalog.dishes.length} dishes`,
      icon: <Store className="size-4.5" />,
    },
    {
      value: "categories",
      label: "Categories",
      hint: "Drinks, Desserts…",
      icon: <LayoutGrid className="size-4.5" />,
    },
    {
      value: "dishes",
      label: "Some dishes",
      hint: "Pick them one by one",
      icon: <UtensilsCrossed className="size-4.5" />,
    },
  ] as const;

  // Dishes the exclusion list can pick from: the ones the scope covers
  const inScope = catalog.dishes.filter((d) =>
    scope.field.value === "menu"
      ? true
      : scope.field.value === "categories"
        ? (categoryIds.field.value ?? []).includes(d.categoryId)
        : false,
  );

  return (
    <Section
      icon={<UtensilsCrossed className="size-4.5" />}
      title="What's discounted"
      description="Dishes added later join automatically when the whole menu or their category is on sale."
    >
      <div
        role="radiogroup"
        aria-label="What's discounted"
        className="grid gap-2 sm:grid-cols-3"
      >
        {options.map((option) => {
          const active = scope.field.value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => scope.field.onChange(option.value)}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 text-left transition-all sm:flex-col sm:items-start sm:gap-2",
                active
                  ? "border-primary/60 bg-primary/6 ring-4 ring-primary/10"
                  : "border-border hover:border-foreground/25 hover:bg-muted/50",
              )}
            >
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-lg",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {option.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">
                  {option.label}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {option.hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {scope.field.value === "categories" && (
        <div>
          <p className="text-sm font-medium">Categories</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {catalog.categories.map((category) => {
              const on = (categoryIds.field.value ?? []).includes(category.id);
              return (
                <button
                  key={category.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    categoryIds.field.onChange(
                      on
                        ? categoryIds.field.value.filter(
                            (id) => id !== category.id,
                          )
                        : [...(categoryIds.field.value ?? []), category.id],
                    )
                  }
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-all",
                    on
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-card hover:border-foreground/25",
                  )}
                >
                  {on && <Check className="size-3.5" strokeWidth={3} />}
                  {!category.isActive && !on && (
                    <EyeOff className="size-3.5 text-muted-foreground" />
                  )}
                  {category.name}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[11px] tabular-nums",
                      on
                        ? "bg-primary-foreground/20"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {category.itemCount}
                  </span>
                </button>
              );
            })}
          </div>
          <FieldNote error={shown("categoryIds")} />
        </div>
      )}

      {scope.field.value === "dishes" && (
        <div>
          <p className="text-sm font-medium">Dishes on sale</p>
          <DishPicker
            dishes={catalog.dishes}
            categories={catalog.categories}
            selected={dishIds.field.value ?? []}
            onChange={dishIds.field.onChange}
          />
          <FieldNote error={shown("dishIds")} />
        </div>
      )}

      {scope.field.value !== "dishes" && (
        <div className="rounded-xl border border-border bg-background/60">
          <div className="flex w-full items-center gap-3 p-3">
            <span className="min-w-0 flex-1">
              <span id="promo-exclude" className="block text-sm font-medium">
                Leave some dishes out
              </span>
              <span className="block text-xs text-muted-foreground">
                {(excluded.field.value ?? []).length
                  ? `${excluded.field.value.length} ${excluded.field.value.length === 1 ? "dish keeps" : "dishes keep"} the full price`
                  : "Like alcohol, or a dish that's already a bargain"}
              </span>
            </span>
            <Switch
              checked={showExclusions}
              onChange={(on) => {
                if (!on) excluded.field.onChange([]);
                setShowExclusions(on);
              }}
              labelledBy="promo-exclude"
            />
          </div>
          {showExclusions && (
            <div className="border-t border-border p-3">
              <DishPicker
                dishes={inScope}
                categories={catalog.categories}
                selected={excluded.field.value ?? []}
                onChange={excluded.field.onChange}
                tone="exclude"
                empty={
                  scope.field.value === "categories"
                    ? "Pick categories first."
                    : "No dishes yet."
                }
              />
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

function DishPicker({
  dishes,
  categories,
  selected,
  onChange,
  tone = "include",
  empty = "No dishes yet.",
}: {
  dishes: Dish[];
  categories: Catalog["categories"];
  selected: string[];
  onChange: (ids: string[]) => void;
  tone?: "include" | "exclude";
  empty?: string;
}) {
  const [search, setSearch] = useState("");
  const terms = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = dishes.filter((d) =>
    terms.every((t) => d.name.toLowerCase().includes(t)),
  );
  const groups = categories
    .map((c) => ({
      category: c,
      dishes: matches.filter((d) => d.categoryId === c.id),
    }))
    .filter((g) => g.dishes.length > 0);
  const chosen = new Set(selected);
  const allShownOn =
    matches.length > 0 && matches.every((d) => chosen.has(d.id));

  const toggle = (id: string) =>
    onChange(
      chosen.has(id) ? selected.filter((x) => x !== id) : [...selected, id],
    );
  const toggleShown = () =>
    onChange(
      allShownOn
        ? selected.filter((id) => !matches.some((d) => d.id === id))
        : [...new Set([...selected, ...matches.map((d) => d.id)])],
    );

  if (dishes.length === 0)
    return (
      <p className="mt-2 rounded-lg bg-muted/50 px-3 py-6 text-center text-sm text-muted-foreground">
        {empty}
      </p>
    );

  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border p-2">
        <div className="group relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search dishes"
            aria-label="Search dishes"
            className="h-9 w-full rounded-lg bg-muted/60 pr-3 pl-9 text-sm outline-none transition focus:bg-background focus:ring-2 focus:ring-primary/30 [&::-webkit-search-cancel-button]:appearance-none"
          />
        </div>
        <span className="hidden text-xs font-medium text-muted-foreground tabular-nums sm:inline">
          {selected.length} picked
        </span>
        <button
          type="button"
          onClick={toggleShown}
          disabled={matches.length === 0}
          className="h-9 rounded-lg px-2.5 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-40"
        >
          {allShownOn ? "Clear" : terms.length ? "Pick these" : "Pick all"}
        </button>
      </div>
      <div className="max-h-80 overflow-y-auto overscroll-contain">
        {groups.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            No dish matches “{search}”.
          </p>
        )}
        {groups.map(({ category, dishes: list }) => (
          <div key={category.id}>
            <p className="sticky top-0 z-10 bg-card/95 px-3 pt-2.5 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase backdrop-blur">
              {category.name}
            </p>
            <ul className="px-1.5 pb-1.5">
              {list.map((dish) => {
                const on = chosen.has(dish.id);
                return (
                  <li key={dish.id}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggle(dish.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-muted",
                        on &&
                          (tone === "include"
                            ? "bg-primary/6"
                            : "bg-destructive/6"),
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "grid size-5 shrink-0 place-items-center rounded-md border-2 transition-colors",
                          on
                            ? tone === "include"
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-destructive bg-destructive text-white"
                            : "border-foreground/25",
                        )}
                      >
                        {on &&
                          (tone === "include" ? (
                            <Check className="size-3.5" strokeWidth={3} />
                          ) : (
                            <X className="size-3.5" strokeWidth={3} />
                          ))}
                      </span>
                      <DishThumb
                        image={dish.image}
                        blur={dish.imageBlur}
                        name={dish.name}
                        className="size-8 rounded-lg"
                        sizes="32px"
                      />
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-sm font-medium",
                          !dish.isVisible && "text-muted-foreground",
                        )}
                      >
                        {dish.name}
                      </span>
                      {!dish.isVisible && (
                        <EyeOff
                          className="size-3.5 shrink-0 text-muted-foreground"
                          aria-label="Hidden from guests"
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function WhenSection({
  control,
  shown,
  timezone,
}: {
  control: Control<Values>;
  shown: Shown;
  timezone: string;
}) {
  const startLater = useController({ control, name: "startLater" });
  const startDate = useController({ control, name: "startDate" });
  const startTime = useController({ control, name: "startTime" });
  const endOnDate = useController({ control, name: "endOnDate" });
  const endDate = useController({ control, name: "endDate" });
  const endTime = useController({ control, name: "endTime" });
  const onlyAtTimes = useController({ control, name: "onlyAtTimes" });
  const windows = useController({ control, name: "windows" });
  const list = windows.field.value ?? [];

  const setWindow = (i: number, change: Partial<(typeof list)[number]>) =>
    windows.field.onChange(
      list.map((w, k) => (k === i ? { ...w, ...change } : w)),
    );

  return (
    <Section
      icon={<CalendarClock className="size-4.5" />}
      title="When"
      description={`In the restaurant's time (${timezone.replace(/_/g, " ")}), like the opening hours.`}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <DateChoice
          label="Starts"
          options={["Right away", "Later"]}
          later={!!startLater.field.value}
          onLater={startLater.field.onChange}
          date={startDate.field}
          time={startTime.field}
          error={shown("startDate")}
        />
        <DateChoice
          label="Ends"
          options={["When I stop it", "On a date"]}
          later={!!endOnDate.field.value}
          onLater={endOnDate.field.onChange}
          date={endDate.field}
          time={endTime.field}
          error={shown("endDate")}
        />
      </div>

      <div>
        <p className="text-sm font-medium">During the day</p>
        <Segmented
          label="During the day"
          value={onlyAtTimes.field.value ? 1 : 0}
          options={["All day", "Only at certain times"]}
          onChange={(i) => {
            onlyAtTimes.field.onChange(i === 1);
            if (i === 1 && list.length === 0)
              windows.field.onChange([
                { days: [...WEEKDAYS], from: "17:00", to: "19:00" },
              ]);
          }}
        />
        {onlyAtTimes.field.value && (
          <div className="mt-3 space-y-2.5">
            {list.map((w, i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-background/60 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex gap-1" role="group" aria-label="Days">
                    {DAYS.map((day) => {
                      const on = w.days.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          aria-pressed={on}
                          aria-label={day}
                          onClick={() =>
                            setWindow(i, {
                              days: on
                                ? w.days.filter((d) => d !== day)
                                : DAYS.filter(
                                    (d) => d === day || w.days.includes(d),
                                  ),
                            })
                          }
                          className={cn(
                            "grid size-9 place-items-center rounded-lg text-xs font-semibold transition-colors",
                            on
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {dayShort(day).slice(0, 2)}
                        </button>
                      );
                    })}
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-background py-1 pr-1 pl-1 shadow-xs dark:bg-input/20">
                    <TimeInput
                      value={w.from}
                      onChange={(t) => setWindow(i, { from: t })}
                      invalid={!!shown(`windows.${i}.from`)}
                      label={`Time slot ${i + 1} starts`}
                    />
                    <span className="text-muted-foreground">–</span>
                    <TimeInput
                      value={w.to}
                      onChange={(t) => setWindow(i, { to: t })}
                      invalid={!!shown(`windows.${i}.to`)}
                      label={`Time slot ${i + 1} ends`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        windows.field.onChange(list.filter((_, k) => k !== i))
                      }
                      aria-label={`Remove time slot ${i + 1}`}
                      className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  {[
                    { label: "Weekdays", days: WEEKDAYS },
                    { label: "Weekend", days: WEEKEND },
                    { label: "Every day", days: [...DAYS] as Day[] },
                  ].map((quick) => (
                    <button
                      key={quick.label}
                      type="button"
                      onClick={() => setWindow(i, { days: quick.days })}
                      className="rounded-md px-2 py-1 font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      {quick.label}
                    </button>
                  ))}
                </div>
                {[
                  shown(`windows.${i}.days`),
                  shown(`windows.${i}.from`),
                  shown(`windows.${i}.to`),
                ]
                  .filter(Boolean)
                  .slice(0, 1)
                  .map((e) => (
                    <p
                      key={e}
                      className="mt-1.5 flex items-center gap-1 text-xs font-medium text-destructive"
                    >
                      <CircleAlert className="size-3.5" /> {e}
                    </p>
                  ))}
              </div>
            ))}
            {list.length < MAX_WINDOWS && (
              <button
                type="button"
                onClick={() =>
                  windows.field.onChange([
                    ...list,
                    { days: [...WEEKEND], from: "12:00", to: "15:00" },
                  ])
                }
                className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-primary hover:bg-primary/10"
              >
                <Plus className="size-4" /> Add a time slot
              </button>
            )}
            <FieldNote error={shown("windows")}>
              A slot ending before it starts runs past midnight (22:00–02:00).
            </FieldNote>
          </div>
        )}
      </div>
    </Section>
  );
}

function DateChoice({
  label,
  options,
  later,
  onLater,
  date,
  time,
  error,
}: {
  label: string;
  options: [string, string];
  later: boolean;
  onLater: (v: boolean) => void;
  date: {
    value: string;
    onChange: (v: string) => void;
    onBlur: () => void;
    name: string;
  };
  time: { value: string; onChange: (v: string) => void };
  error?: string;
}) {
  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      <Segmented
        label={label}
        value={later ? 1 : 0}
        options={options}
        onChange={(i) => onLater(i === 1)}
      />
      {later && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="date"
            value={date.value}
            onChange={(event) => date.onChange(event.target.value)}
            onBlur={date.onBlur}
            name={date.name}
            aria-label={`${label} on`}
            aria-invalid={error ? true : undefined}
            className={cn(
              inputClass,
              "min-w-0 flex-1 scheme-light dark:scheme-dark",
            )}
          />
          <div className="rounded-lg border border-input bg-background p-0.5 shadow-xs dark:bg-input/20">
            <TimeInput
              value={time.value}
              onChange={time.onChange}
              invalid={false}
              label={`${label} at`}
            />
          </div>
        </div>
      )}
      <FieldNote error={error} />
    </div>
  );
}

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number;
  options: readonly string[];
  onChange: (i: number) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="mt-1.5 flex rounded-xl border border-border bg-muted/50 p-1"
    >
      {options.map((option, i) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === i}
          onClick={() => onChange(i)}
          className={cn(
            "h-8 flex-1 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors",
            value === i
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function FieldNote({
  error,
  children,
}: {
  error?: string;
  children?: ReactNode;
}) {
  if (error)
    return (
      <p
        role="alert"
        className="mt-1.5 flex items-center gap-1 text-xs font-medium text-destructive"
      >
        <CircleAlert className="size-3.5 shrink-0" /> {error}
      </p>
    );
  return children ? (
    <p className="mt-1.5 text-xs text-muted-foreground">{children}</p>
  ) : null;
}

function Preview({
  values,
  catalog,
  currency,
  timezone,
}: {
  values: Values;
  catalog: Catalog;
  currency: string;
  timezone: string;
}) {
  const now = useNow();
  const rule = { id: "preview", ...toPromotionPayload(values, timezone) };
  const valid =
    Number.isInteger(rule.percentOff) &&
    rule.percentOff >= 1 &&
    rule.percentOff <= MAX_PERCENT;
  const affected = catalog.dishes.filter((d) => appliesTo(rule, d));
  const status =
    now && valid ? statusInfo(promotionState(rule, now), timezone, now) : null;
  const sample = affected.slice(0, 5);
  const money = (minor: number) => formatPrice(minor / MINOR, currency);

  return (
    <section
      aria-label="Preview"
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs"
    >
      <div className="relative overflow-hidden bg-primary px-5 py-5 text-primary-foreground">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-10 -right-8 size-36 rounded-full bg-white/10"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-14 left-10 size-28 rounded-full bg-black/10"
        />
        <p className="relative flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase opacity-80">
          <Sparkles className="size-3.5" /> Preview
        </p>
        <p className="relative mt-2 text-4xl font-bold tracking-tight tabular-nums">
          {valid ? `−${rule.percentOff}%` : "−?%"}
        </p>
        <p className="relative mt-0.5 truncate text-sm font-medium opacity-90">
          {rule.name || "Your promotion"}
        </p>
      </div>

      <div className="space-y-3 border-b border-border/70 px-5 py-4">
        {status ? <StatusPill {...status} /> : <span className="block h-5" />}
        <p className="flex items-center gap-2 text-sm">
          <UtensilsCrossed className="size-4 text-muted-foreground" />
          <span>
            <span className="font-semibold tabular-nums">
              {affected.length}
            </span>{" "}
            {affected.length === 1 ? "dish" : "dishes"} on sale
            {rule.excludedDishIds.length > 0 && (
              <span className="text-muted-foreground">
                {" "}
                · {rule.excludedDishIds.length} left out
              </span>
            )}
          </span>
        </p>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="size-4" />
          {scheduleLabel(rule)}
        </p>
      </div>

      {sample.length > 0 && valid ? (
        <ul className="divide-y divide-border/60 px-5">
          {sample.map((dish) => {
            const base = dish.variants.length
              ? Math.min(...dish.variants.map((v) => v.priceMinor))
              : dish.priceMinor;
            return (
              <li key={dish.id} className="flex items-center gap-3 py-2.5">
                <DishThumb
                  image={dish.image}
                  blur={dish.imageBlur}
                  name={dish.name}
                  className="size-9 rounded-lg"
                  sizes="36px"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {dish.name}
                </span>
                <span className="shrink-0 text-right leading-tight tabular-nums">
                  <span className="block text-sm font-semibold text-primary">
                    {dish.variants.length > 1 && (
                      <span className="mr-1 text-[11px] font-normal text-muted-foreground">
                        from
                      </span>
                    )}
                    {money(salePrice(base, rule))}
                  </span>
                  <span className="block text-[11px] text-muted-foreground line-through">
                    {money(base)}
                  </span>
                </span>
              </li>
            );
          })}
          {affected.length > sample.length && (
            <li className="py-2.5 text-center text-xs text-muted-foreground">
              and {affected.length - sample.length} more
            </li>
          )}
        </ul>
      ) : (
        <p className="px-5 py-6 text-center text-sm text-muted-foreground">
          {valid
            ? "No dishes picked yet."
            : "Enter a discount to see the prices."}
        </p>
      )}
    </section>
  );
}

export function PromotionActions({ promotion }: { promotion: AdminPromotion }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const ended = promotion.status.state === "ended";

  const toggle = useMutation({
    mutationFn: async (isActive: boolean) => {
      const result = await setPromotionActive(promotion.id, isActive);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: (saved) => {
      toast.add({
        title: saved.isActive
          ? `“${saved.name}” is live again`
          : `“${saved.name}” is paused`,
        description: "Menu prices are updated.",
        type: "success",
      });
      router.refresh();
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
      const result = await deletePromotion(promotion.id);
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: () => {
      setConfirming(false);
      toast.add({ title: `“${promotion.name}” deleted`, type: "success" });
      router.refresh();
    },
    onError: (error) =>
      toast.add({
        title: "Nothing was deleted",
        description: error.message,
        type: "error",
      }),
  });

  return (
    <div className="relative z-10 flex items-center gap-1">
      {!ended && (
        <span
          className={cn(
            "flex items-center",
            toggle.isPending && "pointer-events-none opacity-60",
          )}
        >
          <Switch
            checked={
              toggle.isPending ? !promotion.isActive : promotion.isActive
            }
            onChange={(on) => toggle.mutate(on)}
            label={promotion.isActive ? "Pause" : "Resume"}
          />
        </span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Actions for ${promotion.name}`}
          className="inline-grid size-9 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-popup-open:bg-muted data-popup-open:text-foreground"
        >
          <MoreHorizontal className="size-4.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={6}
          className="w-48 rounded-xl bg-card p-1.5 text-foreground shadow-lg"
        >
          <DropdownMenuItem
            onClick={() => router.push(`${PROMOTIONS_PATH}/${promotion.id}`)}
            className="cursor-pointer gap-2.5 rounded-lg px-2.5 py-2 focus:bg-muted focus:text-foreground data-highlighted:bg-muted data-highlighted:text-foreground"
          >
            <Pencil className="size-4" /> Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator className="my-1" />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirming(true)}
            className="cursor-pointer gap-2.5 rounded-lg px-2.5 py-2"
          >
            <Trash2 className="size-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={confirming}
        onOpenChange={(open) => !remove.isPending && setConfirming(open)}
      >
        <AlertDialogContent className="text-left sm:max-w-md">
          <AlertDialogHeader>
            <span className="mx-auto mb-1 grid size-11 place-items-center rounded-2xl bg-destructive/10 text-destructive sm:mx-0">
              <Trash2 className="size-5" />
            </span>
            <AlertDialogTitle>Delete “{promotion.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {promotion.status.state === "running"
                ? "It's running right now: prices go back to normal immediately."
                : "Prices aren't affected: it isn't running right now."}{" "}
              To keep it for later, pause it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
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
              {remove.isPending ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export const CardArrow = () => (
  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
);
