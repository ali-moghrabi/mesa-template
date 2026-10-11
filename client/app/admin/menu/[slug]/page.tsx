import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  CircleSlash,
  Clock,
  Eye,
  EyeOff,
  Flame,
  Hash,
  Layers,
  ListChecks,
  Pencil,
  ShieldAlert,
  ShieldCheck,
  Tag,
  TriangleAlert,
  Utensils,
  Zap,
  Percent,
} from "lucide-react";
import { getConfig } from "@/config/loader";
import { requireTeam } from "@/lib/auth/get-user";
import { hasPermission } from "@/lib/auth/user-roles";
import { cn } from "@/lib/utils";
import { fetchAdminMenuItem } from "@/admin/lib/menu/api";
import { displayPrice, formatPrice, tagLabel } from "@/admin/lib/menu/format";
import { SPICE_LEVELS } from "@/admin/lib/menu/item-schema";
import { whenLabel } from "@/lib/promotions";
import {
  DEFAULT_FILTERS,
  MENU_PAGE_PATH,
  menuHref,
} from "@/admin/lib/menu/params";
import type {
  AdminMenuItemDetail,
  MenuModifierGroup,
} from "@/admin/lib/menu/types";
import {
  Badges,
  DeleteDishButton,
  DishThumb,
} from "@/admin/components/menu/MenuClient";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { brand } = getConfig();
  const result = await fetchAdminMenuItem(slug);
  return {
    title: `${result.ok ? result.data.name : "Dish"} | ${brand.name} Admin`,
  };
}

export default async function MenuItemPage({ params }: Props) {
  const user = await requireTeam("menu:availability");
  const canManage = hasPermission(user.role, "menu:manage");
  const { slug } = await params;
  const config = getConfig();
  const currency = config.menu.currency.primary.code;

  const result = await fetchAdminMenuItem(slug);
  if (!result.ok && (result.status === 404 || result.status === 400))
    notFound();
  if (!result.ok) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8">
        <BackLink />
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-destructive">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">The dish didn&apos;t load</p>
            <p className="mt-0.5 text-sm">{result.message}</p>
          </div>
        </div>
      </div>
    );
  }

  const item = result.data;
  const { amount, from, was, percentOff } = displayPrice(item);
  const categoryHref = menuHref(DEFAULT_FILTERS, {
    category: item.category.slug,
  });
  const date = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: config.business.timezone,
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-8">
      <nav
        className="flex items-center justify-between gap-3 pt-6 lg:pt-10"
        aria-label="Breadcrumb"
      >
        <ol className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
          <li>
            <Link
              href={MENU_PAGE_PATH}
              className="inline-flex items-center gap-1.5 rounded-md font-medium hover:text-foreground"
            >
              <ArrowLeft className="size-4" /> Menu
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="min-w-0 truncate">
            <Link
              href={categoryHref}
              className="font-medium hover:text-foreground"
            >
              {item.category.name}
            </Link>
          </li>
        </ol>
        <Pager item={item} />
      </nav>

      <section className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-10">
        <div className="relative aspect-4/3 overflow-hidden rounded-3xl border border-border bg-muted shadow-sm">
          {item.image ? (
            <DishThumb
              image={item.image}
              blur={item.imageBlur}
              name={item.name}
              sizes="(min-width: 1024px) 560px, 100vw"
              className={cn(
                "absolute inset-0 size-full rounded-none ring-0",
                !item.isVisible && "grayscale-60",
              )}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_25%_20%,color-mix(in_srgb,var(--primary)_28%,transparent),transparent_60%),radial-gradient(circle_at_80%_85%,color-mix(in_srgb,var(--primary)_16%,transparent),transparent_55%)]">
              <div className="text-center text-primary/60">
                <ChefHat className="mx-auto size-12" />
                <p className="mt-2 text-sm font-medium">No photo yet</p>
              </div>
            </div>
          )}
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            {!item.isVisible && (
              <span className="inline-flex items-center gap-1 rounded-full bg-foreground px-2.5 py-1 text-xs font-semibold text-background">
                <EyeOff className="size-3.5" />{" "}
                {item.isActive ? "Category hidden" : "Hidden"}
              </span>
            )}
            {!item.isAvailable && (
              <span className="rounded-full bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white">
                Sold out
              </span>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={categoryHref}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase transition-colors hover:border-primary/40 hover:text-primary"
            >
              {!item.category.isActive && <EyeOff className="size-3" />}
              {item.category.name}
            </Link>
            <Badges badges={item.badges} />
          </div>

          <h1 className="mt-3 text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">
            {item.name}
          </h1>
          {item.description ? (
            <p className="mt-3 text-base leading-relaxed text-pretty text-muted-foreground">
              {item.description}
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground/70 italic">
              No description yet.
            </p>
          )}

          <div className="mt-5 flex items-end gap-3">
            <p
              className={cn(
                "text-3xl font-semibold tracking-tight tabular-nums",
                item.sale && "text-primary",
              )}
            >
              {from && (
                <span className="mr-1.5 text-base font-normal text-muted-foreground">
                  from
                </span>
              )}
              {formatPrice(amount, currency)}
            </p>
            {was !== undefined && (
              <p className="pb-1 text-lg text-muted-foreground tabular-nums line-through">
                {formatPrice(was, currency)}
              </p>
            )}
            {percentOff !== undefined && (
              <span
                className={cn(
                  "mb-1.5 rounded-md px-1.5 py-0.5 text-xs font-semibold",
                  item.sale
                    ? "bg-primary text-primary-foreground"
                    : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
                )}
              >
                −{percentOff}%
              </span>
            )}
          </div>
          {item.sale && (
            <Link
              href={`${MENU_PAGE_PATH}/promotions`}
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.07] px-3 py-2 text-sm transition-colors hover:bg-primary/12"
            >
              <Percent className="size-4 text-primary" />
              <span>
                On sale with{" "}
                <span className="font-semibold">{item.sale.name}</span>
                {item.sale.endsAt && (
                  <span className="text-muted-foreground">
                    {" "}
                    · until{" "}
                    {whenLabel(
                      item.sale.endsAt,
                      item.sale.timezone,
                      undefined,
                      "end",
                    )}
                  </span>
                )}
              </span>
            </Link>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <StatusChip
              tone={item.isVisible ? "good" : "muted"}
              icon={
                item.isVisible ? (
                  <Eye className="size-3.5" />
                ) : (
                  <EyeOff className="size-3.5" />
                )
              }
              label={
                item.isVisible
                  ? "On the menu"
                  : item.isActive
                    ? `Hidden with ${item.category.name}`
                    : "Hidden from guests"
              }
            />
            <StatusChip
              tone={item.isAvailable ? "good" : "warn"}
              icon={
                item.isAvailable ? (
                  <Zap className="size-3.5" />
                ) : (
                  <CircleSlash className="size-3.5" />
                )
              }
              label={item.isAvailable ? "In stock" : "Sold out"}
            />
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            <Fact icon={<Flame className="size-4" />} label="Spice">
              {item.spiceLevel === 0 ? (
                <span className="text-muted-foreground">None</span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-flex text-red-500">
                    {Array.from({ length: item.spiceLevel }, (_, i) => (
                      <Flame key={i} className="-mx-px size-4" />
                    ))}
                  </span>
                  {SPICE_LEVELS[item.spiceLevel]}
                </span>
              )}
            </Fact>
            <Fact icon={<Utensils className="size-4" />} label="Calories">
              {item.calories != null ? `${item.calories} kcal` : <Unset />}
            </Fact>
            <Fact icon={<Clock className="size-4" />} label="Prep time">
              {item.prepTimeMinutes != null ? (
                `${item.prepTimeMinutes} min`
              ) : (
                <Unset />
              )}
            </Fact>
            <Fact icon={<Hash className="size-4" />} label="Position">
              {item.neighbors.position} of {item.neighbors.total}
            </Fact>
          </dl>

          <div className="mt-6 flex flex-wrap gap-2 lg:mt-auto lg:pt-6">
            {canManage && (
              <Link
                href={`${MENU_PAGE_PATH}/${item.slug}/edit`}
                className="group inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_6px_20px_-6px_color-mix(in_srgb,var(--primary)_70%,transparent)] transition hover:-translate-y-px hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:flex-none"
              >
                <Pencil className="size-4 transition-transform group-hover:-rotate-12" />{" "}
                Edit dish
              </Link>
            )}
            <Link
              href={categoryHref}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium shadow-xs transition-colors hover:bg-muted sm:flex-none"
            >
              More in {item.category.name}
            </Link>
            {canManage && (
              <DeleteDishButton
                dish={{
                  id: item.id,
                  name: item.name,
                  image: item.image,
                  imageBlur: item.imageBlur,
                  isVisible: item.isVisible,
                }}
                className="w-full sm:ml-auto sm:w-auto"
              />
            )}
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        {item.variants.length > 0 && (
          <Card
            icon={<Tag className="size-4" />}
            title="Sizes"
            subtitle={`${item.variants.length} sizes, each with its own price`}
          >
            <ul className="divide-y divide-border">
              {item.variants.map((variant) => (
                <li
                  key={variant.id}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{variant.name}</span>
                    {variant.isDefault && (
                      <span className="ml-2 rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                        Default
                      </span>
                    )}
                  </span>
                  {variant.isAvailable === false && <SoldOutTag />}
                  <span className="text-right leading-tight tabular-nums">
                    <span
                      className={cn(
                        "block font-semibold",
                        variant.salePrice !== undefined && "text-primary",
                      )}
                    >
                      {formatPrice(
                        variant.salePrice ?? variant.price,
                        currency,
                      )}
                    </span>
                    {variant.salePrice !== undefined && (
                      <span className="block text-xs text-muted-foreground line-through">
                        {formatPrice(variant.price, currency)}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {item.modifierGroups.length > 0 && (
          <Card
            icon={<ListChecks className="size-4" />}
            title="Choices & extras"
            subtitle={`${item.modifierGroups.length} ${item.modifierGroups.length === 1 ? "group" : "groups"} guests choose from`}
            className={item.variants.length === 0 ? "lg:col-span-2" : undefined}
          >
            <div className="space-y-4">
              {item.modifierGroups.map((group) => (
                <div
                  key={group.id}
                  className="rounded-xl border border-border bg-background/50"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-border px-3.5 py-2.5">
                    <p className="font-semibold">{group.name}</p>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
                        group.minSelect > 0
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {groupRule(group)}
                    </span>
                  </div>
                  <ul className="divide-y divide-border/70">
                    {group.options.map((option) => (
                      <li
                        key={option.id}
                        className="flex items-center gap-3 px-3.5 py-2.5 text-sm"
                      >
                        <span className="min-w-0 flex-1">
                          {option.name}
                          {option.isDefault && (
                            <span className="ml-2 text-[11px] font-semibold text-primary">
                              Pre-selected
                            </span>
                          )}
                        </span>
                        {option.isAvailable === false && <SoldOutTag />}
                        <span
                          className={cn(
                            "tabular-nums",
                            option.priceDelta
                              ? "font-medium"
                              : "text-muted-foreground",
                          )}
                        >
                          {option.priceDelta
                            ? `+${formatPrice(option.priceDelta, currency)}`
                            : "Free"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card
          icon={<ShieldCheck className="size-4" />}
          title="Dietary & allergens"
          subtitle="What guests see before ordering"
        >
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Suitable for
              </p>
              {item.dietaryTags.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {item.dietaryTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-emerald-600/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-300"
                    >
                      {tagLabel(tag)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No dietary labels.
                </p>
              )}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Contains
              </p>
              {item.allergens.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {item.allergens.map((allergen) => (
                    <span
                      key={allergen}
                      className="inline-flex items-center gap-1 rounded-full border border-amber-600/25 bg-amber-500/12 px-2.5 py-1 text-xs font-medium text-amber-800 dark:text-amber-300"
                    >
                      <ShieldAlert className="size-3.5" />
                      {tagLabel(allergen)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No allergens declared. Double-check before service.
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card
          icon={<Layers className="size-4" />}
          title="Details"
          subtitle="For the team"
        >
          <dl className="divide-y divide-border text-sm">
            <Row label="URL id">
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                {item.slug}
              </code>
            </Row>
            <Row label="Category">
              <Link
                href={categoryHref}
                className="font-medium hover:text-primary"
              >
                {item.category.name}
              </Link>
              {!item.category.isActive && (
                <span className="ml-1.5 text-xs text-muted-foreground">
                  (hidden)
                </span>
              )}
            </Row>
            <Row label="Created">{date.format(new Date(item.createdAt))}</Row>
            <Row label="Last change">
              {date.format(new Date(item.updatedAt))}
            </Row>
            <Row label="ID">
              <code className="font-mono text-xs text-muted-foreground">
                {item.id}
              </code>
            </Row>
          </dl>
        </Card>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href={MENU_PAGE_PATH}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> Menu
    </Link>
  );
}

function Pager({ item }: { item: AdminMenuItemDetail }) {
  const { previous, next, position, total } = item.neighbors;
  const button =
    "grid size-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground";
  const disabled =
    "grid size-9 place-items-center rounded-lg border border-border text-muted-foreground/40";
  return (
    <div className="flex shrink-0 items-center gap-2">
      {previous ? (
        <Link
          href={`${MENU_PAGE_PATH}/${previous.slug}`}
          title={previous.name}
          className={button}
        >
          <ChevronLeft className="size-4" />
          <span className="sr-only">Previous: {previous.name}</span>
        </Link>
      ) : (
        <span aria-hidden className={disabled}>
          <ChevronLeft className="size-4" />
        </span>
      )}
      <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">
        {position} / {total}
      </span>
      {next ? (
        <Link
          href={`${MENU_PAGE_PATH}/${next.slug}`}
          title={next.name}
          className={button}
        >
          <ChevronRight className="size-4" />
          <span className="sr-only">Next: {next.name}</span>
        </Link>
      ) : (
        <span aria-hidden className={disabled}>
          <ChevronRight className="size-4" />
        </span>
      )}
    </div>
  );
}

function Card({
  icon,
  title,
  subtitle,
  className,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-5",
        className,
      )}
    >
      <header className="mb-4 flex items-center gap-3">
        <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <div>
          <h2 className="text-[15px] leading-tight font-semibold">{title}</h2>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </header>
      {children}
    </section>
  );
}

function Fact({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-card p-3.5 sm:p-4">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold tabular-nums">{children}</dd>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right">{children}</dd>
    </div>
  );
}

function StatusChip({
  tone,
  icon,
  label,
}: {
  tone: "good" | "warn" | "muted";
  icon: ReactNode;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
        tone === "good" &&
          "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
        tone === "warn" && "bg-amber-500/14 text-amber-700 dark:text-amber-300",
        tone === "muted" &&
          "border border-dashed border-foreground/20 text-muted-foreground",
      )}
    >
      {icon}
      {label}
    </span>
  );
}

const Unset = () => (
  <span className="font-normal text-muted-foreground">Not set</span>
);

const SoldOutTag = () => (
  <span className="rounded-md bg-amber-500/12 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
    Sold out
  </span>
);

function groupRule(group: Pick<MenuModifierGroup, "minSelect" | "maxSelect">) {
  if (group.minSelect === 0) return `Optional · up to ${group.maxSelect}`;
  if (group.minSelect === group.maxSelect)
    return `Required · pick ${group.minSelect}`;
  return `Required · ${group.minSelect} to ${group.maxSelect}`;
}
