import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { PROMOTIONS_PATH } from "@/admin/lib/promotions";

export function PromotionPageShell({
  title,
  eyebrow = "Promotions",
  error,
  children,
}: {
  title: string;
  eyebrow?: string;
  error: string | null;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-8">
      <header className="pt-6 pb-6 lg:pt-10">
        <Link
          href={PROMOTIONS_PATH}
          className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Promotions
        </Link>
        <p className="mt-3 text-xs font-semibold tracking-[0.14em] text-primary uppercase">
          {eyebrow}
        </p>
        <h1 className="mt-1 truncate text-[28px] leading-tight font-semibold tracking-tight sm:text-3xl">
          {title}
        </h1>
      </header>
      {error ? (
        <div className="mb-16 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-destructive">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">This page didn&apos;t load</p>
            <p className="mt-0.5 text-sm">{error}</p>
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
