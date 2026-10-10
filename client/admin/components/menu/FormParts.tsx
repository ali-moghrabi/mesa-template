"use client";

import { useId, type ReactNode } from "react";
import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground/70 hover:border-foreground/25 focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-primary/15 dark:bg-input/20 aria-invalid:border-destructive aria-invalid:ring-destructive/15";

export function Section({
  icon,
  title,
  description,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="rounded-2xl border border-border bg-card shadow-xs"
    >
      <header className="flex items-start gap-3 border-b border-border/70 px-4 py-4 sm:px-6">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={id} className="text-[15px] font-semibold tracking-tight">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {action}
      </header>
      <div className="space-y-5 px-4 py-5 sm:px-6">{children}</div>
    </section>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  labelledBy,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  labelledBy?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      onClick={() => onChange(!checked)}
      className="group inline-flex shrink-0 items-center rounded-full focus-visible:outline-none"
    >
      <span
        className={cn(
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
          "group-focus-visible:ring-2 group-focus-visible:ring-primary/50 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background",
          checked ? "bg-emerald-500" : "bg-foreground/15",
        )}
      >
        <span
          className={cn(
            "inline-block size-5 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-5.5" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

export function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <p id={id} className="text-sm font-medium">
          {title}
        </p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onChange={onChange} labelledBy={id} />
    </div>
  );
}

export function PhotoAction({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className="grid size-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-50"
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
}

export function SaveBar({
  status,
  cancel,
  onSaveAnother,
  busy,
  saving,
  createLabel,
}: {
  status: "errors" | "uploading" | "unsaved" | "idle";
  cancel: ReactNode;
  onSaveAnother: () => void;
  busy: boolean;
  saving: boolean;
  createLabel: string;
}) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-8 border-t border-border bg-background/85 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur-md sm:-mx-8 sm:px-8">
      <div className="flex items-center gap-3">
        <p
          className="hidden min-w-0 flex-1 truncate text-sm text-muted-foreground sm:block"
          aria-live="polite"
        >
          {status === "errors" ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-destructive">
              <CircleAlert className="size-4" /> Some fields need attention
            </span>
          ) : status === "uploading" ? (
            <span className="inline-flex items-center gap-1.5">
              <LoaderCircle className="size-4 animate-spin" /> Optimizing the
              photo…
            </span>
          ) : status === "unsaved" ? (
            <span className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full bg-amber-500" /> Unsaved
              changes
              <kbd className="ml-1 hidden rounded border border-border bg-muted px-1.5 py-px font-sans text-[11px] lg:inline">
                ⌘ Enter
              </kbd>
            </span>
          ) : (
            "Fill in the details, then create it."
          )}
        </p>
        <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none">
          {cancel}
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onSaveAnother}
            className="hidden h-10 rounded-lg px-4 md:inline-flex"
          >
            Save & add another
          </Button>
          <Button
            type="submit"
            disabled={busy}
            className="h-11 flex-1 rounded-xl px-5 text-[15px] font-semibold shadow-[0_6px_20px_-6px_color-mix(in_srgb,var(--primary)_70%,transparent)] sm:h-10 sm:flex-none sm:text-sm"
          >
            {saving ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            {saving ? "Creating…" : createLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
