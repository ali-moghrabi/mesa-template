"use client";

import { useId } from "react";
import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  placeholder: string;
  buttonLabel: string;
  tone: "light" | "onPrimary";
  className?: string;
};

export function NewsletterForm({
  placeholder,
  buttonLabel,
  tone,
  className,
}: Props) {
  const inputId = useId();
  const onPrimary = tone === "onPrimary";

  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-[calc(var(--radius)*1.6)] p-1.5 focus-within:ring-2",
        onPrimary
          ? "bg-background text-foreground focus-within:ring-white/70"
          : "border border-foreground/20 bg-background focus-within:ring-primary/40",
        className,
      )}
    >
      <label htmlFor={inputId} className="sr-only">
        {placeholder}
      </label>
      <Mail
        aria-hidden="true"
        className="ml-3 size-5 shrink-0 text-foreground/50"
      />
      <input
        id={inputId}
        type="email"
        name="email"
        required
        autoComplete="email"
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent px-2 py-3 text-base outline-none placeholder:text-foreground/50"
      />
      <button
        type="submit"
        className={cn(
          "inline-flex min-h-12 shrink-0 items-center justify-center rounded-[calc(var(--radius)*1.1)] px-6 font-semibold transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent cursor-pointer hover:bg-primary/75",
          onPrimary
            ? "bg-foreground text-background"
            : "bg-primary text-primary-foreground",
        )}
      >
        {buttonLabel}
      </button>
    </form>
  );
}
