"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { ArrowUpIcon, X, Menu } from "lucide-react";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import AuthenticationDialog from "./AuthenticationDialog";
import Image from "next/image";
import SignUpForm from "@/components/auth/SignUpForm";
import QueryWrapper from "@/components/providers/query-wrapper";
import UserDropMenu from "@/components/shared/UserDropMenu";

type NavLink = { label: string; href: string };

export type NavbarClientProps = {
  user: IUser | null;
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
};

const PAD = "px-(--pad)";
const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent";

export function NavbarClient({
  user,
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
}: NavbarClientProps) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [signInDialogOpen, setSignInDialogOpen] = useState(false);
  const [signUpDialogOpen, setSignUpDialogOpen] = useState(false);
  const [barDismissed, setBarDismissed] = useState(false);

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
  const showBar = announcement && !barDismissed;
  const collapseBar = scrolled || open;
  const solid = variant === "solid" || scrolled;

  return (
    <QueryWrapper>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 pt-[env(safe-area-inset-top,0px)] [--pad:clamp(1.1rem,4vw,3.5rem)]",
          !sticky && "absolute",
        )}
      >
        {showBar && (
          <div
            className={cn(
              "relative flex items-center justify-center gap-3 overflow-hidden bg-white dark:bg-neutral-900 px-10 text-xs text-neutral-900 dark:text-gray-50 transition-all duration-300",
              collapseBar ? "max-h-0 py-0" : "max-h-16 py-2",
            )}
          >
            <p className="text-center font-medium">{announcement.text}</p>
            {announcement.link && (
              <Link
                href={announcement.link.href}
                className={cn(
                  "font-bold whitespace-nowrap underline underline-offset-4 hover:opacity-80 transition",
                  FOCUS,
                )}
              >
                {announcement.link.label}
              </Link>
            )}
            {announcement.dismissible && (
              <button
                type="button"
                aria-label="Dismiss announcement"
                onClick={() => setBarDismissed(true)}
                className={cn(
                  "absolute top-1/2 right-2 size-8 -translate-y-1/2 text-xl opacity-70 hover:opacity-100 cursor-pointer transition bg-gray-100 dark:bg-neutral-900",
                  FOCUS,
                )}
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        <div
          className={cn(
            "flex items-center gap-4 border-b border-transparent transition-[background-color,padding,color,border-color] duration-300",
            PAD,
            open
              ? "py-4 text-foreground"
              : solid
                ? "border-border bg-background/85 py-2.5 text-foreground backdrop-blur-md"
                : "py-4 text-white",
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
              className="size-10 dark:hidden rounded-full"
            />
            <Image
              src={`/${lightLogo}`}
              alt={brandName}
              width={60}
              height={60}
              className="hidden size-10 dark:block rounded-full"
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
                    "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:origin-left after:scale-x-0 after:bg-accent after:transition-transform after:duration-300",
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
              <UserDropMenu
                user={user}
                reservationsEnabled={reservationsEnabled}
                orderingEnabled={orderingEnabled}
              />
            ) : (
              <Dialog
                open={signInDialogOpen}
                onOpenChange={setSignInDialogOpen}
              >
                <DialogTrigger>
                  <span
                    className={cn(
                      "rounded-lg bg-primary text-white px-4 py-2.5 text-sm font-semibold whitespace-nowrap hover:bg-primary/80 backdrop-blur-3xl transition cursor-pointer",
                      "min-[900px]:px-5 min-[900px]:py-3 max-[360px]:hidden",
                      FOCUS,
                    )}
                  >
                    {cta.label}
                  </span>
                </DialogTrigger>
                <AuthenticationDialog
                  brandName={brandName}
                  lightLogo={lightLogo}
                  darkLogo={darkLogo}
                  setSignInDialogOpen={setSignInDialogOpen}
                  setSignUpDialogOpen={setSignUpDialogOpen}
                />
              </Dialog>
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

          {user ? null : (
            <Dialog open={signInDialogOpen} onOpenChange={setSignInDialogOpen}>
              <DialogTrigger className="w-full">
                <span
                  onClick={() => setOpen(false)}
                  className="mt-6 flex min-h-13 items-center justify-between rounded-lg bg-primary py-2 pr-2 pl-6 font-semibold backdrop-blur-3xl hover:bg-primary/80 transition text-white cursor-pointer"
                >
                  {cta.label}
                  <span className="grid size-9.5 place-items-center rounded-md bg-white/20">
                    <ArrowUpIcon />
                  </span>
                </span>
              </DialogTrigger>
              <AuthenticationDialog
                brandName={brandName}
                lightLogo={lightLogo}
                darkLogo={darkLogo}
                setSignInDialogOpen={setSignInDialogOpen}
                setSignUpDialogOpen={setSignUpDialogOpen}
              />
            </Dialog>
          )}
        </div>

        <div className="mt-6 grid gap-1 border-t border-border pt-4 text-sm text-foreground/65">
          <span>{info.address}</span>
          <a href={`tel:${info.phone.replace(/[^+\d]/g, "")}`}>{info.phone}</a>
        </div>
      </div>

      {!user ? (
        <Dialog open={signUpDialogOpen} onOpenChange={setSignUpDialogOpen}>
          <SignUpForm
            brandName={brandName}
            lightLogo={lightLogo}
            darkLogo={darkLogo}
            setSignInDialogOpen={setSignInDialogOpen}
            setSignUpDialogOpen={setSignUpDialogOpen}
          />
        </Dialog>
      ) : null}
    </QueryWrapper>
  );
}
