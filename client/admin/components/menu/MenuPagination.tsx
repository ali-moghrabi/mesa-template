import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  menuHref,
  pageWindow,
  type MenuFilters,
} from "@/admin/lib/menu/params";
import type { PaginationMeta } from "@/admin/lib/menu/types";

export function MenuPagination({
  filters,
  meta,
}: {
  filters: MenuFilters;
  meta: PaginationMeta;
}) {
  if (meta.totalPages <= 1) return null;
  const href = (page: number) => menuHref(filters, { page });

  return (
    <nav
      aria-label="Pages"
      className="mt-5 flex items-center justify-between gap-2 sm:justify-center"
    >
      <StepLink
        href={meta.hasPreviousPage ? href(meta.page - 1) : null}
        direction="previous"
      />

      <span className="text-sm text-muted-foreground tabular-nums sm:hidden">
        Page <span className="font-semibold text-foreground">{meta.page}</span>{" "}
        of {meta.totalPages}
      </span>

      <ol className="hidden items-center gap-1 sm:flex">
        {pageWindow(meta.page, meta.totalPages).map((page, index) =>
          page === "…" ? (
            <li
              key={`gap-${index}`}
              aria-hidden
              className="grid w-7 place-items-center text-muted-foreground"
            >
              …
            </li>
          ) : (
            <li key={page}>
              <Link
                href={href(page)}
                scroll={false}
                aria-current={page === meta.page ? "page" : undefined}
                aria-label={`Page ${page}`}
                className={cn(
                  "grid h-9 min-w-9 place-items-center rounded-lg px-2 text-sm font-medium tabular-nums transition-all",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                  page === meta.page
                    ? "bg-foreground text-background shadow-sm"
                    : "text-foreground/75 hover:bg-muted hover:text-foreground",
                )}
              >
                {page}
              </Link>
            </li>
          ),
        )}
      </ol>

      <StepLink
        href={meta.hasNextPage ? href(meta.page + 1) : null}
        direction="next"
      />
    </nav>
  );
}

function StepLink({
  href,
  direction,
}: {
  href: string | null;
  direction: "previous" | "next";
}) {
  const label = direction === "previous" ? "Previous" : "Next";
  const content = (
    <>
      {direction === "previous" && <ChevronLeft className="size-4" />}
      <span>{label}</span>
      {direction === "next" && <ChevronRight className="size-4" />}
    </>
  );
  const classes = cn(
    "inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-3 text-sm font-medium shadow-xs transition-colors",
    direction === "previous" ? "sm:mr-2" : "sm:ml-2",
  );

  if (!href) {
    return (
      <span
        aria-disabled
        className={cn(classes, "cursor-not-allowed opacity-45")}
      >
        {content}
      </span>
    );
  }
  return (
    <Link
      href={href}
      scroll={false}
      rel={direction === "previous" ? "prev" : "next"}
      className={cn(
        classes,
        "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
      )}
    >
      {content}
    </Link>
  );
}
