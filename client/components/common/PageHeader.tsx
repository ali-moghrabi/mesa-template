import Image from "next/image";
import { cn } from "@/lib/utils";

type Props = {
  variant: "image" | "simple";
  eyebrow: string;
  title: string;
  subtitle?: string;
  image?: string;
  stats?: { label: string; value: string | number }[];
};

export function PageHeader({
  variant,
  eyebrow,
  title,
  subtitle,
  image,
  stats = [],
}: Props) {
  const photo = variant === "image" && image;

  if (photo) {
    return (
      <header
        data-nav-dark=""
        className="relative isolate flex min-h-[min(60svh,500px)] items-end overflow-hidden bg-neutral-900 px-(--pad) pt-[calc(var(--nav-height,4.5rem)+4rem)] pb-12 text-white [--pad:clamp(1.1rem,4vw,3.5rem)] sm:pb-16"
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
          className="absolute inset-0 -z-10 bg-linear-to-t from-black/85 via-black/40 to-black/25"
        />
        <div className="mx-auto w-full max-w-6xl">
          <p className="text-xs font-semibold tracking-[0.2em] text-white/70 uppercase">
            {eyebrow}
          </p>
          <h1 className="mt-3 max-w-3xl text-[clamp(2.8rem,8vw,6rem)] leading-[0.95] font-medium tracking-[-0.045em] text-balance">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-5 max-w-xl text-lg text-pretty text-white/80 sm:text-xl">
              {subtitle}
            </p>
          )}
          {stats.length > 0 && (
            <p className="mt-7 flex flex-wrap gap-x-5 gap-y-1 text-[15px] text-white/85 tabular-nums">
              {stats.map((s) => (
                <span key={s.label}>
                  {s.value} {s.label.toLowerCase()}
                </span>
              ))}
            </p>
          )}
        </div>
      </header>
    );
  }

  return (
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
            {eyebrow}
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

        {stats.length > 0 && (
          <dl
            className={cn(
              "grid gap-px overflow-hidden rounded-[calc(var(--radius)*1.8)] border border-foreground/10 bg-foreground/10 sm:max-w-md lg:w-88",
              stats.length === 1 ? "grid-cols-1" : "grid-cols-2",
            )}
          >
            {stats.map((s) => (
              <div
                key={s.label}
                className="bg-background/80 px-5 py-4 backdrop-blur"
              >
                <dt className="text-xs font-medium tracking-wide text-foreground/55 uppercase">
                  {s.label}
                </dt>
                <dd className="mt-1 text-3xl font-medium tracking-tight tabular-nums">
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </header>
  );
}
