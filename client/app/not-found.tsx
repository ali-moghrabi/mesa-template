import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, UtensilsCrossed } from "lucide-react";
import { getConfig } from "@/config/loader";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

export default function NotFound() {
  const config = getConfig() as unknown as {
    brand: { name: string };
    layout?: { navbar?: { links?: { label: string; href: string }[] } };
    business?: { phone?: string };
  };
  const links = (config.layout?.navbar?.links ?? [])
    .filter((l) => l.href !== "/" && l.href.startsWith("/"))
    .slice(0, 5);
  const phone = config.business?.phone;

  return (
    <main className="relative isolate flex min-h-svh items-center overflow-hidden bg-background px-(--pad) pt-[calc(var(--nav-height,4.5rem)+3rem)] pb-20 text-foreground [--pad:clamp(1.1rem,4vw,3.5rem)]">
      <style>{`
        @keyframes mesa-steam { 0% { transform: translateY(6px) scaleY(.9); opacity: 0 } 30% { opacity: .55 } 100% { transform: translateY(-22px) scaleY(1.1); opacity: 0 } }
        @keyframes mesa-float { 0%, 100% { transform: translateY(0) rotate(-2deg) } 50% { transform: translateY(-8px) rotate(2deg) } }
        @keyframes mesa-rise { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
        .mesa-steam { animation: mesa-steam 2.8s ease-in-out infinite; transform-box: fill-box; transform-origin: bottom }
        .mesa-float { animation: mesa-float 6s ease-in-out infinite }
        .mesa-rise { animation: mesa-rise .7s cubic-bezier(.2,.7,.2,1) both }
        @media (prefers-reduced-motion: reduce) { .mesa-steam, .mesa-float, .mesa-rise { animation: none } }
      `}</style>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 size-168 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-52 -left-40 -z-10 size-120 rounded-full bg-accent/15 blur-3xl"
      />

      <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
        {/* 4 [plate] 4 */}
        <div
          className="mesa-rise flex items-center justify-center gap-[clamp(0.25rem,2vw,1.25rem)] text-[clamp(7rem,24vw,13rem)] leading-none font-semibold tracking-[-0.06em] select-none"
          aria-hidden="true"
        >
          <span>4</span>
          <Plate />
          <span>4</span>
        </div>

        <p className="mesa-rise mt-6 text-xs font-semibold tracking-[0.22em] text-primary uppercase [animation-delay:.08s]">
          Error 404 · Page not found
        </p>
        <h1 className="mesa-rise mt-3 text-[clamp(2rem,5vw,3.25rem)] leading-[1.05] font-medium tracking-[-0.04em] text-balance [animation-delay:.14s]">
          This page is off the menu
        </h1>
        <p className="mesa-rise mt-4 max-w-md text-lg text-pretty text-foreground/65 [animation-delay:.2s]">
          The link may be old, or the page has moved. Let&apos;s get you back to
          something delicious.
        </p>

        <div className="mesa-rise mt-9 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row [animation-delay:.26s]">
          <Link
            href="/"
            className="group inline-flex h-13 w-full items-center justify-center gap-2 rounded-full bg-primary px-7 font-semibold text-primary-foreground shadow-[0_14px_30px_-14px_color-mix(in_srgb,var(--primary)_90%,transparent)] transition-all hover:-translate-y-0.5 hover:brightness-105 sm:w-auto"
          >
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />{" "}
            Back to {config.brand.name}
          </Link>
          <Link
            href="/menu"
            className="group inline-flex h-13 w-full items-center justify-center gap-2 rounded-full border border-foreground/15 px-7 font-semibold transition-colors hover:border-foreground hover:bg-foreground hover:text-background sm:w-auto"
          >
            <UtensilsCrossed className="size-4" /> See the menu
          </Link>
        </div>

        {links.length > 0 && (
          <nav
            aria-label="Popular pages"
            className="mesa-rise mt-12 w-full max-w-xl border-t border-foreground/10 pt-6 [animation-delay:.32s]"
          >
            <p className="text-sm text-foreground/50">Or try one of these</p>
            <ul className="mt-3 flex flex-wrap justify-center gap-2">
              {links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="group inline-flex h-10 items-center gap-1.5 rounded-full bg-foreground/5 px-4 text-sm font-medium transition-colors hover:bg-primary/10 hover:text-primary"
                  >
                    {l.label}
                    <ArrowRight className="-ml-1.5 h-3.5 w-0 opacity-0 transition-all group-hover:ml-0 group-hover:w-3.5 group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {phone && (
          <p className="mesa-rise mt-8 text-sm text-foreground/50 [animation-delay:.38s]">
            Looking for something specific? Call us on{" "}
            <a
              href={`tel:${phone.replace(/[^\d+]/g, "")}`}
              className="font-semibold whitespace-nowrap text-foreground/75 underline-offset-4 hover:text-primary hover:underline"
            >
              {phone}
            </a>
          </p>
        )}
      </div>
    </main>
  );
}

function Plate() {
  return (
    <svg
      viewBox="0 0 200 220"
      className="mesa-float h-[1.05em] w-[0.95em] shrink-0 overflow-visible"
      fill="none"
    >
      <g
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        className="text-foreground/30"
      >
        <path className="mesa-steam" d="M80 46c-8-10 8-16 0-28" />
        <path
          className="mesa-steam [animation-delay:.6s]"
          d="M100 42c-8-10 8-16 0-30"
        />
        <path
          className="mesa-steam [animation-delay:1.2s]"
          d="M120 46c-8-10 8-16 0-28"
        />
      </g>
      <circle
        cx="100"
        cy="140"
        r="74"
        className="fill-card stroke-foreground/15"
        strokeWidth="3"
      />
      <circle
        cx="100"
        cy="140"
        r="54"
        className="fill-primary/[0.07] stroke-primary/40"
        strokeWidth="3"
        strokeDasharray="4 8"
        strokeLinecap="round"
      />
      <circle cx="100" cy="140" r="30" className="fill-primary/10" />
      <g className="fill-foreground/70">
        <rect x="6" y="96" width="5" height="34" rx="2.5" />
        <rect x="15" y="96" width="5" height="34" rx="2.5" />
        <rect x="24" y="96" width="5" height="34" rx="2.5" />
        <rect x="9" y="122" width="17" height="10" rx="5" />
        <rect x="14.5" y="128" width="6" height="64" rx="3" />
      </g>
      <g className="fill-foreground/70">
        <path d="M186 96c8 6 9 30 3 44h-8V96z" />
        <rect x="181" y="136" width="6" height="56" rx="3" />
      </g>
    </svg>
  );
}
