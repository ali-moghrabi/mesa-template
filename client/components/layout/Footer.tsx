import Link from "next/link";

type FooterProps = {
  footer: {
    variant: "columns" | "minimal" | "centered";
    copyright?: string | undefined;
    links?: { label: string; href: string }[] | undefined;
  };
};

export function Footer({ footer }: FooterProps) {
  const { variant, copyright, links } = footer;

  if (variant === "centered") {
    return (
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center px-6 py-16 text-center min-[900px]:py-20">
          <Link href="/" className="text-2xl font-semibold tracking-[-0.04em]">
            Mesa
          </Link>

          <div className="mt-8 flex flex-wrap justify-center gap-x-7 gap-y-3">
            {!links || links.length === 0
              ? null
              : links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-sm text-foreground/60 transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                ))}
          </div>

          <p className="mt-8 text-sm text-foreground/45">{copyright}</p>
        </div>
      </footer>
    );
  }

  if (variant === "minimal") {
    return (
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 min-[700px]:flex-row min-[700px]:items-center min-[700px]:justify-between">
          <p className="text-sm text-foreground/50">{copyright}</p>

          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {!links || links.length === 0
              ? null
              : links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-sm text-foreground/60 transition-colors hover:text-foreground"
                  >
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
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/40">
              Explore
            </p>

            <nav className="mt-5 flex flex-col items-start gap-3">
              {!links || links.length === 0
                ? null
                : links.map((link) => (
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
          <p className="text-xs text-foreground/45">{copyright}</p>

          <div className="flex items-center gap-2 text-xs text-foreground/40">
            <span className="size-1.5 rounded-full bg-primary" />
            <span>Made with care</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
