"use client";

import { Toast as ToastPrimitive } from "@base-ui/react/toast";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import {
  XIcon,
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  CircleXIcon,
  Loader2Icon,
} from "lucide-react";

const toast = ToastPrimitive.createToastManager();

function ToastProvider({ ...props }: ToastPrimitive.Provider.Props) {
  return <ToastPrimitive.Provider {...props} />;
}

function ToastPortal({ ...props }: ToastPrimitive.Portal.Props) {
  return <ToastPrimitive.Portal data-slot="toast-portal" {...props} />;
}

function ToastViewport({ className, ...props }: ToastPrimitive.Viewport.Props) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn(
        "pointer-events-none fixed inset-x-4 bottom-4 z-50 mx-auto w-auto max-w-sm outline-none sm:right-4 sm:left-auto sm:mx-0 sm:w-full",
        className,
      )}
      {...props}
    />
  );
}

function Toast({ className, ...props }: ToastPrimitive.Root.Props) {
  return (
    <ToastPrimitive.Root
      data-slot="toast"
      className={cn(
        "group/toast pointer-events-auto absolute right-0 bottom-0 z-[calc(1000-var(--toast-index))] w-full origin-bottom overflow-hidden rounded-2xl border border-foreground/10 bg-popover text-popover-foreground shadow-[0_18px_40px_-18px_rgb(0_0_0/0.45),0_2px_6px_-2px_rgb(0_0_0/0.08)] will-change-transform outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:shadow-[0_18px_40px_-18px_rgb(0_0_0/0.8)]",
        "[--gap:0.75rem] [--height:var(--toast-frontmost-height,var(--toast-height))] [--offset-y:calc(var(--toast-offset-y)*-1+calc(var(--toast-index)*var(--gap)*-1)+var(--toast-swipe-movement-y))] [--peek:0.75rem] [--scale:calc(max(0,1-(var(--toast-index)*0.1)))] [--shrink:calc(1-var(--scale))]",
        "h-(--height) [transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--peek))-(var(--shrink)*var(--height))))_scale(var(--scale))] [transition:transform_500ms_cubic-bezier(0.22,1,0.36,1),opacity_500ms,height_150ms]",
        "after:absolute after:top-full after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-['']",
        "data-expanded:h-(--toast-height) data-expanded:[transform:translateX(var(--toast-swipe-movement-x))_translateY(var(--offset-y))]",
        "data-limited:opacity-0 data-starting-style:[transform:translateY(150%)]",
        "[&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:[transform:translateY(150%)]",
        "data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]",
        "data-ending-style:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))]",
        "data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]",
        "data-ending-style:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))]",
        "data-expanded:data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]",
        "data-expanded:data-ending-style:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))]",
        "data-expanded:data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]",
        "data-expanded:data-ending-style:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))]",
        className,
      )}
      {...props}
    />
  );
}

function ToastContent({ className, ...props }: ToastPrimitive.Content.Props) {
  return (
    <ToastPrimitive.Content
      data-slot="toast-content"
      className={cn(
        "relative flex h-full items-center gap-3.5 overflow-hidden py-3.5 pr-3 pl-4 transition-opacity duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] data-behind:opacity-0 data-expanded:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

function ToastTitle({ className, ...props }: ToastPrimitive.Title.Props) {
  return (
    <ToastPrimitive.Title
      data-slot="toast-title"
      className={cn(
        "text-[15px] leading-snug font-semibold tracking-[-0.01em] text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function ToastDescription({
  className,
  ...props
}: ToastPrimitive.Description.Props) {
  return (
    <ToastPrimitive.Description
      data-slot="toast-description"
      className={cn(
        "text-[13.5px] leading-snug text-pretty text-muted-foreground empty:hidden",
        className,
      )}
      {...props}
    />
  );
}

function ToastAction({
  className,
  render = <Button variant="outline" size="sm" />,
  ...props
}: ToastPrimitive.Action.Props) {
  return (
    <ToastPrimitive.Action
      data-slot="toast-action"
      render={render}
      className={cn("relative shrink-0", className)}
      {...props}
    />
  );
}

function ToastClose({
  className,
  children,
  render = <Button variant="ghost" size="icon-sm" />,
  ...props
}: ToastPrimitive.Close.Props) {
  return (
    <ToastPrimitive.Close
      data-slot="toast-close"
      aria-label="Close toast"
      render={render}
      className={cn(
        "relative size-7 shrink-0 self-start rounded-full text-muted-foreground opacity-70 transition after:absolute after:-inset-2 after:content-[''] hover:bg-foreground/6 hover:text-foreground hover:opacity-100 [&_svg]:size-4",
        className,
      )}
      {...props}
    >
      {children ?? <XIcon aria-hidden="true" />}
    </ToastPrimitive.Close>
  );
}

const TONES = {
  success: {
    icon: <CircleCheckIcon aria-hidden="true" />,
    badge:
      "bg-emerald-500/15 text-emerald-600 ring-emerald-500/25 dark:text-emerald-400",
    bar: "bg-emerald-500",
    wash: "from-emerald-500/[0.09]",
    border: "border-emerald-500/25",
  },
  error: {
    icon: <CircleXIcon aria-hidden="true" />,
    badge: "bg-red-500/15 text-red-600 ring-red-500/25 dark:text-red-400",
    bar: "bg-red-500",
    wash: "from-red-500/[0.09]",
    border: "border-red-500/30",
  },
  warning: {
    icon: <TriangleAlertIcon aria-hidden="true" />,
    badge:
      "bg-amber-500/15 text-amber-600 ring-amber-500/30 dark:text-amber-400",
    bar: "bg-amber-500",
    wash: "from-amber-500/[0.1]",
    border: "border-amber-500/30",
  },
  info: {
    icon: <InfoIcon aria-hidden="true" />,
    badge: "bg-sky-500/15 text-sky-600 ring-sky-500/25 dark:text-sky-400",
    bar: "bg-sky-500",
    wash: "from-sky-500/[0.08]",
    border: "border-sky-500/25",
  },
  loading: {
    icon: <Loader2Icon className="animate-spin" aria-hidden="true" />,
    badge: "bg-foreground/[0.06] text-foreground/70 ring-foreground/10",
    bar: "bg-foreground/30",
    wash: "from-foreground/[0.04]",
    border: "",
  },
} as const;

type Tone = keyof typeof TONES;
const toneOf = (type: string | undefined): Tone | null =>
  type && type in TONES ? (type as Tone) : null;

function ToastIcon({ type }: { type: string | undefined }) {
  const tone = toneOf(type);
  if (!tone) return null;
  return (
    <span
      data-slot="toast-icon"
      className={cn(
        "relative grid size-9 shrink-0 place-items-center rounded-full ring-1 ring-inset [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4.5",
        TONES[tone].badge,
      )}
    >
      {TONES[tone].icon}
    </span>
  );
}

/** The coloured bar and wash behind a toast's content */
function ToastAccent({ type }: { type: string | undefined }) {
  const tone = toneOf(type);
  if (!tone) return null;
  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-1",
          TONES[tone].bar,
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 bg-linear-to-r to-transparent to-60%",
          TONES[tone].wash,
        )}
      />
    </>
  );
}

function ToastList() {
  const { toasts } = ToastPrimitive.useToastManager();

  return toasts.map((toastItem) => {
    const tone = toneOf(toastItem.type);
    return (
      <Toast
        key={toastItem.id}
        toast={toastItem}
        className={cn(tone && TONES[tone].border)}
      >
        <ToastContent>
          <ToastAccent type={toastItem.type} />
          <ToastIcon type={toastItem.type} />
          <div className="relative flex min-w-0 flex-1 flex-col gap-0.5">
            <ToastTitle />
            <ToastDescription />
          </div>
          <ToastAction />
          <ToastClose />
        </ToastContent>
      </Toast>
    );
  });
}

function Toaster({
  children,
  toastManager = toast,
  ...props
}: ToastPrimitive.Provider.Props) {
  return (
    <ToastProvider toastManager={toastManager} {...props}>
      {children}
      <ToastPortal>
        <ToastViewport>
          <ToastList />
        </ToastViewport>
      </ToastPortal>
    </ToastProvider>
  );
}

const createToastManager = ToastPrimitive.createToastManager;
const useToastManager = ToastPrimitive.useToastManager;

export {
  Toaster,
  Toast,
  ToastAction,
  ToastClose,
  ToastContent,
  ToastDescription,
  ToastPortal,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  createToastManager,
  toast,
  useToastManager,
};
