"use client";

import { useState, type ReactNode } from "react";
import { Loader2, Monitor, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const unwrap = async <T,>(
  p: Promise<{ ok: true; data: T } | { ok: false; message: string }>,
): Promise<T> => {
  const result = await p;
  if (!result.ok) throw new Error(result.message);
  return result.data;
};

export const BUTTON =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-60";
export const PRIMARY = cn(
  BUTTON,
  "bg-primary text-white shadow-[0_10px_24px_-14px_var(--primary)] hover:brightness-110",
);
export const SECONDARY = cn(
  BUTTON,
  "border border-border bg-card text-foreground shadow-xs hover:bg-muted",
);
export const GHOST = cn(
  BUTTON,
  "text-muted-foreground hover:bg-muted hover:text-foreground",
);
export const FIELD =
  "w-full rounded-xl border border-border bg-background px-3.5 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/60 focus:ring-4 focus:ring-primary/15 aria-invalid:border-destructive";

export function Card({
  title,
  subtitle,
  icon: Icon,
  actions,
  children,
  className,
}: {
  title?: string;
  subtitle?: ReactNode;
  icon?: typeof Loader2;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-5",
        className,
      )}
    >
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {Icon && (
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-4.5" />
              </span>
            )}
            <div className="min-w-0">
              {title && (
                <h2 className="leading-tight font-semibold">{title}</h2>
              )}
              {subtitle && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function Pill({
  meta,
  className,
}: {
  meta: { label: string; pill: string; dot: string };
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        meta.pill,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

export function Empty({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: typeof Loader2;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </span>
      <p className="mt-4 font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-pretty text-muted-foreground">
        {text}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Loading({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "grid place-items-center py-16 text-muted-foreground",
        className,
      )}
    >
      <Loader2 className="size-6 animate-spin" />
    </div>
  );
}

export function Confirm({
  open,
  title,
  text,
  action,
  danger,
  busy,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  text: ReactNode;
  action: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md!">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-pretty">{text}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={SECONDARY}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cn(
              BUTTON,
              danger
                ? "bg-destructive text-white hover:brightness-110"
                : "bg-primary text-white hover:brightness-110",
            )}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {action}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EmailFrame({
  html,
  subject,
  loading,
  className,
}: {
  html: string | null;
  subject?: string;
  loading?: boolean;
  className?: string;
}) {
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [height, setHeight] = useState(640);

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-muted/40",
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-border bg-card px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted-foreground">Subject</p>
          <p className="truncate text-sm font-semibold">
            {subject || (
              <span className="text-muted-foreground">No subject yet</span>
            )}
          </p>
        </div>
        {loading && (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        )}
        <div
          className="inline-flex rounded-lg bg-muted p-0.5"
          role="tablist"
          aria-label="Preview size"
        >
          {(
            [
              ["desktop", Monitor],
              ["phone", Smartphone],
            ] as const
          ).map(([id, Icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={device === id}
              aria-label={id === "desktop" ? "Desktop" : "Phone"}
              onClick={() => setDevice(id)}
              className={cn(
                "grid size-7 place-items-center rounded-md transition-colors",
                device === id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-3 sm:p-4">
        <div
          className={cn(
            "mx-auto overflow-hidden rounded-xl bg-white shadow-sm transition-[max-width] duration-300",
            device === "phone" ? "max-w-97.5" : "max-w-170",
          )}
        >
          {html ? (
            <iframe
              title="Email preview"
              onLoad={(e) => {
                const doc = e.currentTarget.contentDocument;
                if (doc?.documentElement)
                  setHeight(Math.max(420, doc.documentElement.scrollHeight));
              }}
              srcDoc={html.replace("<head>", '<head><base target="_blank">')}
              sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              className="block w-full border-0"
              style={{ height }}
            />
          ) : (
            <div className="grid h-96 place-items-center text-sm text-zinc-500">
              {loading ? "Building the preview…" : "Nothing to preview yet"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors outline-none focus-visible:ring-3 focus-visible:ring-primary/40 disabled:opacity-50",
        checked ? "bg-primary" : "bg-foreground/20",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}
