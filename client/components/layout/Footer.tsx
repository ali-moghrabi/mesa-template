import Link from "next/link";
import { CookieSettingsLink } from "@/components/consent/CookieConsent";
import { NewsletterFooterLink } from "@/components/shared/NewsletterFooterLink";

type FooterProps = {
  footer: {
    variant: "columns" | "minimal" | "centered";
    copyright?: string | undefined;
    links?: { label: string; href: string }[] | undefined;
  };
  newsletter?: boolean;
  cookieSettings?: boolean;
};

const LINK =
  "text-sm text-foreground/60 transition-colors hover:text-foreground";

function Extras({
  newsletter,
  cookieSettings,
  className,
}: {
  newsletter: boolean;
  cookieSettings: boolean;
  className?: string;
}) {
  if (!newsletter && !cookieSettings) return null;
  return (
    <span className={className}>
      {cookieSettings && (
        <CookieSettingsLink className="hover:text-foreground" />
      )}
      {newsletter && <NewsletterFooterLink className="hover:text-foreground" />}
    </span>
  );
}

export function Footer({
  footer,
  newsletter = false,
  cookieSettings = false,
}: FooterProps) {
  const { variant, copyright, links = [] } = footer;

  if (variant === "centered") {
    return (
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center px-6 py-16 text-center min-[900px]:py-20">
          <Link href="/" className="text-2xl font-semibold tracking-[-0.04em]">
            Mesa
          </Link>

          {links.length > 0 && (
            <nav className="mt-8 flex flex-wrap justify-center gap-x-7 gap-y-3">
              {links.map((link) => (
                <Link key={link.href} href={link.href} className={LINK}>
                  {link.label}
                </Link>
              ))}
            </nav>
          )}

          <p className="mt-8 text-sm text-foreground/45">{copyright}</p>
          <Extras
            newsletter={newsletter}
            cookieSettings={cookieSettings}
            className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-foreground/45"
          />
        </div>
      </footer>
    );
  }

  if (variant === "minimal") {
    return (
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 min-[700px]:flex-row min-[700px]:items-center min-[700px]:justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-foreground/50">{copyright}</p>
            <Extras
              newsletter={newsletter}
              cookieSettings={cookieSettings}
              className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-foreground/45"
            />
          </div>

          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className={LINK}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-7xl px-6 py-14 min-[900px]:py-20">
        <div className="grid gap-12 min-[700px]:grid-cols-2 min-[900px]:grid-cols-[1.5fr_1fr]">
          <div>
            <Link
              href="/"
              className="inline-block text-3xl font-semibold tracking-tighter"
            >
              Mesa
            </Link>

            <p className="mt-4 max-w-xs text-sm leading-6 text-foreground/55">
              Good food, warm tables, and something worth staying for.
            </p>
          </div>

          <div className="min-[700px]:justify-self-end">
            <p className="text-xs font-semibold tracking-[0.14em] text-foreground/40 uppercase">
              Explore
            </p>

            <nav className="mt-5 flex flex-col items-start gap-3">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group relative text-sm transition-colors"
                >
                  <span className="transition-colors group-hover:text-primary">
                    {link.label}
                  </span>
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-border pt-6 min-[700px]:mt-20 min-[700px]:flex-row min-[700px]:items-center min-[700px]:justify-between">
          <div className="flex flex-col gap-2 min-[700px]:flex-row min-[700px]:items-center min-[700px]:gap-5">
            <p className="text-xs text-foreground/45">{copyright}</p>
            <Extras
              newsletter={newsletter}
              cookieSettings={cookieSettings}
              className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-foreground/45"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-foreground/40">
            <span className="size-1.5 rounded-full bg-primary" />
            <span>Made with care</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
