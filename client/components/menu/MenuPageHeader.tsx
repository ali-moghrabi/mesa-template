import Image from "next/image";
import { BadgePercent, Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { whenLabel } from "@/lib/promotions";
import type { OpeningHours } from "@/lib/opening-hours";
import type {
  PublicMenuCategory,
  PublicDishSale,
} from "@/lib/menu/public-menu";
import { OpenStatus } from "@/components/common/OpenStatus";

type Props = {
  variant: "image" | "simple";
  title: string;
  subtitle?: string;
  image?: string;
  categories: PublicMenuCategory[];
  hours: OpeningHours | null;
};

function runningSales(categories: PublicMenuCategory[]): PublicDishSale[] {
  const sales = new Map<string, PublicDishSale>();
  for (const category of categories)
    for (const dish of category.items)
      if (dish.sale) sales.set(dish.sale.id, dish.sale);
  return [...sales.values()].sort((a, b) => b.percentOff - a.percentOff);
}

export function MenuPageHeader({
  variant,
  title,
  subtitle,
  image,
  categories,
  hours,
}: Props) {
  const dishes = categories.reduce((sum, c) => sum + c.items.length, 0);
  const sales = runningSales(categories);
  const photo = variant === "image" && image;

  const facts = (
    <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[15px] text-white/85">
      {dishes > 0 && (
        <span className="tabular-nums">
          {dishes} {dishes === 1 ? "dish" : "dishes"} · {categories.length}{" "}
          {categories.length === 1 ? "category" : "categories"}
        </span>
      )}
      {hours && (
        <>
          <i
            aria-hidden="true"
            className="hidden h-4 w-px bg-white/30 sm:block"
          />
          <OpenStatus hours={hours} />
        </>
      )}
    </div>
  );

  return (
    <>
      {photo ? (
        <header
          data-nav-dark=""
          className="relative isolate flex min-h-[min(68svh,560px)] items-end overflow-hidden bg-neutral-900 px-(--pad) pt-[calc(var(--nav-height,4.5rem)+4rem)] pb-12 text-white [--pad:clamp(1.1rem,4vw,3.5rem)] sm:pb-16"
        >
          <Image
            src={photo}
            alt=""
            fill
            priority
            sizes="100vw"
            className="-z-20 object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-linear-to-t from-black/85 via-black/45 to-black/25"
          />
          <div className="mx-auto w-full max-w-6xl">
            <p className="text-xs font-semibold tracking-[0.2em] text-white/70 uppercase">
              Menu
            </p>
            <h1 className="mt-3 max-w-3xl text-[clamp(2.8rem,8vw,6rem)] leading-[0.95] font-medium tracking-[-0.045em] text-balance">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-5 max-w-xl text-lg text-pretty text-white/80 sm:text-xl">
                {subtitle}
              </p>
            )}
            {facts}
          </div>
        </header>
      ) : (
        <header className="relative isolate overflow-hidden border-b border-foreground/10 bg-muted px-(--pad) pt-[calc(var(--nav-height,4.5rem)+3rem)] pb-12 [--pad:clamp(1.1rem,4vw,3.5rem)] sm:pt-[calc(var(--nav-height,4.5rem)+4.5rem)] sm:pb-16">
          <div
            aria-hidden="true"
            className="absolute -top-40 -right-40 -z-10 size-136 rounded-full bg-primary/15 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-[radial-gradient(currentColor_1px,transparent_1px)] bg-size-[22px_22px] text-foreground/[0.07] mask-[linear-gradient(to_left,black,transparent_70%)]"
          />
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-primary uppercase">
                <span aria-hidden="true" className="h-px w-6 bg-primary" />
                Menu
              </p>
              <h1 className="mt-4 max-w-3xl text-[clamp(2.8rem,8vw,5.5rem)] leading-[0.95] font-medium tracking-[-0.045em] text-balance">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-5 max-w-xl text-lg text-pretty text-foreground/70 sm:text-xl">
                  {subtitle}
                </p>
              )}
            </div>

            {(dishes > 0 || hours) && (
              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[calc(var(--radius)*1.8)] border border-foreground/10 bg-foreground/10 sm:max-w-md lg:w-88">
                {dishes > 0 && (
                  <>
                    <div className="bg-background/80 px-5 py-4 backdrop-blur">
                      <dt className="text-xs font-medium tracking-wide text-foreground/55 uppercase">
                        Dishes
                      </dt>
                      <dd className="mt-1 text-3xl font-medium tracking-tight tabular-nums">
                        {dishes}
                      </dd>
                    </div>
                    <div className="bg-background/80 px-5 py-4 backdrop-blur">
                      <dt className="text-xs font-medium tracking-wide text-foreground/55 uppercase">
                        Categories
                      </dt>
                      <dd className="mt-1 text-3xl font-medium tracking-tight tabular-nums">
                        {categories.length}
                      </dd>
                    </div>
                  </>
                )}
                {hours && (
                  <div className="col-span-2 bg-background/80 px-5 py-3.5 backdrop-blur">
                    <dt className="sr-only">Opening hours</dt>
                    <dd>
                      <OpenStatus hours={hours} className="text-[15px]" />
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </div>
        </header>
      )}

      {sales.length > 0 && (
        <div
          className={cn("px-(--pad) [--pad:clamp(1.1rem,4vw,3.5rem)]", "pt-6")}
        >
          <ul className="mx-auto flex max-w-6xl flex-col gap-2.5 sm:flex-row sm:flex-wrap">
            {sales.map((sale) => (
              <li
                key={sale.id}
                className="flex min-w-0 items-center gap-3 rounded-[calc(var(--radius)*1.6)] border border-primary/25 bg-primary/[0.07] py-2.5 pr-4 pl-2.5 sm:flex-1 sm:basis-80"
              >
                <span className="grid h-11 shrink-0 place-items-center rounded-[calc(var(--radius)*1.1)] bg-primary px-3 text-[15px] font-bold text-primary-foreground tabular-nums">
                  −{sale.percentOff}%
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate font-semibold">
                    <BadgePercent className="size-4 shrink-0 text-primary" />
                    <span className="truncate">{sale.name}</span>
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-foreground/65">
                    <Clock3 className="size-3.5 shrink-0" />
                    {sale.endsAt
                      ? `Until ${whenLabel(sale.endsAt, sale.timezone, undefined, "end")}`
                      : "On now"}{" "}
                    · prices below already reduced
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
