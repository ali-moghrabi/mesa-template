import Link from "next/link";
import { ArrowLeft, Construction } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  title?: string;
  description?: string;
  eyebrow?: string;
  backHref?: string;
  backLabel?: string;
  variant?: "page" | "admin";
  className?: string;
};

export function UnderConstruction({
  title = "Coming soon",
  description = "We're putting the finishing touches on this. Check back shortly.",
  eyebrow = "Under construction",
  backHref = "/",
  backLabel = "Back to home",
  variant = "page",
  className,
}: Props) {
  return (
    <main
      className={cn(
        "grid place-items-center bg-background px-5 text-foreground",
        variant === "page"
          ? "min-h-svh pt-[calc(var(--nav-height,4.5rem)+2rem)] pb-20"
          : "min-h-[70svh] py-16",
        className,
      )}
    >
      <div className="w-full max-w-lg text-center">
        <div className="relative mx-auto w-fit">
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 scale-150 rounded-full bg-primary/15 blur-3xl"
          />
          <span className="grid size-24 place-items-center rounded-[1.75rem] bg-card shadow-[0_24px_60px_-28px_rgba(0,0,0,.45)] ring-1 ring-foreground/10">
            <Construction
              className="size-11 text-primary motion-safe:animate-[uc-tilt_3s_ease-in-out_infinite]"
              strokeWidth={1.75}
            />
          </span>
        </div>

        <div
          aria-hidden="true"
          className="mx-auto mt-8 h-2.5 w-44 overflow-hidden rounded-full bg-[repeating-linear-gradient(-45deg,var(--primary)_0_10px,transparent_10px_20px)] bg-size-[28px_100%] opacity-80 ring-1 ring-primary/30 motion-safe:animate-[uc-tape_1.2s_linear_infinite]"
        />

        <p className="mt-8 text-xs font-semibold tracking-[0.2em] text-primary uppercase">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-[clamp(2rem,6vw,3rem)] leading-[1.05] font-semibold tracking-[-0.03em] text-balance">
          {title}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-lg text-pretty text-foreground/65">
          {description}
        </p>

        <Link
          href={backHref}
          className="group mt-9 inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-6 font-semibold text-background transition-opacity hover:opacity-90"
        >
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
          {backLabel}
        </Link>
      </div>

      <style>{`
        @keyframes uc-tilt { 0%, 100% { transform: rotate(-6deg); } 50% { transform: rotate(6deg); } }
        @keyframes uc-tape { to { background-position: 28px 0; } }
      `}</style>
    </main>
  );
}
