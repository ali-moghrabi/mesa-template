"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { ArrowUpIcon, X, Menu } from "lucide-react";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { AnnouncementBar } from "./AnnouncementBar";
import Image from "next/image";
import type { CurrencyConfig } from "@/lib/menu/money";
import { SIGN_IN_EVENT } from "@/lib/cart";
import { useSessionUser } from "@/hooks/use-session-user";

const loadAuthDialogs = () => import("./AuthDialogs");
const AuthDialogs = dynamic(loadAuthDialogs, { ssr: false });
const SignedInControls = dynamic(() => import("./SignedInControls"), {
  ssr: false,
  loading: () => <span aria-hidden="true" className="block size-9" />,
});
const preloadAuth = () => void loadAuthDialogs();

type NavLink = { label: string; href: string };

export type NavbarClientProps = {
  brandName: string;
  lightLogo: string;
  darkLogo: string;
  variant: string;
  sticky: boolean;
  links: NavLink[];
  reservationsEnabled: boolean;
  orderingEnabled: boolean;
  isDarkModeEnabled: boolean;
  cta: NavLink;
  announcement?: { text: string; link?: NavLink; dismissible: boolean };
  info: { address: string; phone: string };
  currency: CurrencyConfig;
  pricingNote?: string;
};

const PAD = "px-(--pad)";
const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent";

export function NavbarClient({
  brandName,
  lightLogo,
  darkLogo,
  variant,
  sticky,
  links,
  reservationsEnabled,
  orderingEnabled,
  isDarkModeEnabled,
  cta,
  announcement,
  info,
  currency,
  pricingNote,
}: NavbarClientProps) {
  const pathname = usePathname();
  const { user } = useSessionUser();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [signInDialogOpen, setSignInDialogOpen] = useState(false);
  const [signUpDialogOpen, setSignUpDialogOpen] = useState(false);
  // the dialogs' code is fetched the first time they're wanted, then they stay mounted
  const [authWanted, setAuthWanted] = useState(false);
  const openSignIn = () => {
    setAuthWanted(true);
    setSignInDialogOpen(true);
  };
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const el = headerRef.current;
    if (!el || !sticky) {
      root.style.setProperty("--nav-offset", "0px");
      return () => root.style.removeProperty("--nav-offset");
    }
    const update = () =>
      root.style.setProperty(
        "--nav-offset",
        `${Math.round(el.getBoundingClientRect().height)}px`,
      );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--nav-offset");
    };
  }, [sticky]);

  useEffect(() => {
    const open = () => {
      setAuthWanted(true);
      setSignInDialogOpen(true);
    };
    window.addEventListener(SIGN_IN_EVENT, open);
    return () => window.removeEventListener(SIGN_IN_EVENT, open);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onResize = () => window.innerWidth >= 900 && setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  const collapseBar = scrolled || open;
  const solid = variant === "solid" || scrolled;

  return (
    <>
      <header
        ref={headerRef}
        className={cn(
          "fixed inset-x-0 top-0 z-50 pt-[env(safe-area-inset-top,0px)] [--pad:clamp(1.1rem,4vw,3.5rem)]",
          !sticky && "absolute",
        )}
      >
        {announcement && (
          <AnnouncementBar
            text={announcement.text}
            link={announcement.link}
            dismissible={announcement.dismissible}
            collapsed={collapseBar}
          />
        )}

        <div
          className={cn(
            "flex items-center gap-4 border-b border-transparent transition-[background-color,padding,color,border-color] duration-300",
            PAD,
            open
              ? "py-4 text-foreground"
              : solid
                ? "border-border bg-background/85 py-2.5 text-foreground backdrop-blur-md"
                : // white over a dark photo at the top of the page. Plain CSS, so it's right
                  // from the first paint (before, it switched only after the JS had loaded)
                  "py-4 text-foreground [body:has([data-nav-dark])_&]:text-white",
          )}
        >
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className={cn(
              "mr-auto flex items-center gap-2.5 text-lg font-bold tracking-tight",
              FOCUS,
            )}
          >
            <Image
              src={`/${darkLogo}`}
              alt={brandName}
              width={60}
              height={60}
              loading="eager"
              className="size-10 dark:hidden rounded-lg"
            />
            <Image
              src={`/${lightLogo}`}
              alt={brandName}
              width={60}
              height={60}
              loading="eager"
              className="hidden size-10 dark:block rounded-lg"
            />
            <span className="hidden min-[900px]:block">{brandName}</span>
          </Link>

          <ul className="mr-4 hidden gap-8 min-[900px]:flex">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={isActive(l.href) ? "page" : undefined}
                  className={cn(
                    "relative py-1.5 text-[0.93rem] font-medium opacity-90 hover:opacity-100",
                    "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:origin-left after:scale-x-0 after:bg-primary after:transition-transform after:duration-300",
                    "hover:after:scale-x-100 aria-[current=page]:after:scale-x-100",
                    FOCUS,
                  )}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3 max-[900px]:flex-row-reverse">
            {user ? (
              <SignedInControls
                user={user}
                orderingEnabled={orderingEnabled}
                reservationsEnabled={reservationsEnabled}
                currency={currency}
                pricingNote={pricingNote}
              />
            ) : (
              <button
                type="button"
                onClick={openSignIn}
                onPointerEnter={preloadAuth}
                onFocus={preloadAuth}
                onTouchStart={preloadAuth}
                className={cn(
                  "rounded-lg bg-primary text-white px-4 py-2.5 text-sm font-semibold whitespace-nowrap hover:bg-primary/80 backdrop-blur-3xl transition cursor-pointer",
                  "min-[900px]:px-5 min-[900px]:py-3 max-[360px]:hidden",
                  // a member's page: keep the space, but don't flash "Sign in" before their menu loads
                  "[html[data-signed-in]_&]:invisible",
                  FOCUS,
                )}
              >
                {cta.label}
              </button>
            )}

            {isDarkModeEnabled && <ModeToggle />}
          </div>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
            className={cn(
              "relative size-8 rounded-full border border-current/35 min-[900px]:hidden hover:bg-primary/5 transition cursor-pointer",
              FOCUS,
            )}
          >
            <Menu
              aria-hidden="true"
              className={cn(
                "absolute inset-0 m-auto size-4 transition-all duration-300 motion-reduce:transition-none",
                open
                  ? "scale-50 rotate-90 opacity-0"
                  : "scale-100 rotate-0 opacity-100",
              )}
            />
            <X
              aria-hidden="true"
              className={cn(
                "absolute inset-0 m-auto size-4 transition-all duration-300 motion-reduce:transition-none",
                open
                  ? "scale-100 rotate-0 opacity-100"
                  : "scale-50 -rotate-90 opacity-0",
              )}
            />
          </button>
        </div>
      </header>

      <div
        id="mobile-menu"
        aria-hidden={!open}
        className={cn(
          "fixed inset-0 z-40 flex flex-col justify-between overflow-y-auto bg-background text-foreground [--pad:clamp(1.1rem,4vw,3.5rem)]",
          "pt-[calc(6.2rem+env(safe-area-inset-top,0px))] pb-[calc(1.6rem+env(safe-area-inset-bottom,0px))]",
          PAD,
          "transition-[clip-path,visibility] duration-650 ease-[cubic-bezier(.7,0,.2,1)] motion-reduce:transition-none",
          open
            ? "visible [clip-path:circle(160%_at_calc(100%-3rem)_3rem)]"
            : "invisible [clip-path:circle(0_at_calc(100%-3rem)_3rem)]",
        )}
      >
        <div>
          <nav aria-label="Mobile">
            {links.map((l, i) => (
              <Link
                key={l.href}
                href={l.href}
                style={{ "--i": i } as CSSProperties}
                aria-current={isActive(l.href) ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={cn(
                  "w-fit block text-[clamp(2.2rem,10vw,3.4rem)] leading-tight font-semibold tracking-[-0.04em] transition-all aria-[current=page]:text-primary motion-reduce:transition-none hover:opacity-75",
                  open
                    ? "translate-y-0 opacity-100"
                    : "translate-y-6 opacity-0",
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          {!user && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                openSignIn();
              }}
              onTouchStart={preloadAuth}
              className="[html[data-signed-in]_&]:invisible mt-6 flex w-full min-h-13 items-center justify-between rounded-lg bg-primary py-2 pr-2 pl-6 font-semibold backdrop-blur-3xl hover:bg-primary/80 transition text-white cursor-pointer"
            >
              {cta.label}
              <span className="grid size-9.5 place-items-center rounded-md bg-white/20">
                <ArrowUpIcon />
              </span>
            </button>
          )}
        </div>

        <div className="mt-6 grid gap-1 border-t border-border pt-4 text-sm text-foreground/65">
          <span>{info.address}</span>
          <a href={`tel:${info.phone.replace(/[^+\d]/g, "")}`}>{info.phone}</a>
        </div>
      </div>

      {authWanted && !user && (
        <AuthDialogs
          brandName={brandName}
          lightLogo={lightLogo}
          darkLogo={darkLogo}
          signInOpen={signInDialogOpen}
          setSignInOpen={setSignInDialogOpen}
          signUpOpen={signUpDialogOpen}
          setSignUpOpen={setSignUpDialogOpen}
        />
      )}
    </>
  );
}
