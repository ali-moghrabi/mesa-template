"use client";

import { useEffect, useRef } from "react";
import { ExternalLink, ShieldCheck, X } from "lucide-react";

export const THREE_DS_DONE = "mesa:3ds-done";

export function ThreeDsWindow({
  url,
  orderId,
  onDone,
  onCancel,
}: {
  url: string;
  orderId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== frame.current?.contentWindow) return;
      const data = event.data as { type?: unknown; order?: unknown } | null;
      if (data?.type === THREE_DS_DONE && data.order === orderId) onDone();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [orderId, onDone]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-70 grid place-items-center bg-background/75 p-3 backdrop-blur-sm transition-opacity starting:opacity-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="three-ds-title"
    >
      <div className="flex h-[min(42rem,100%)] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-card shadow-2xl ring-1 ring-foreground/10">
        <div className="flex items-center gap-3 border-b border-foreground/10 px-5 py-3.5">
          <ShieldCheck className="size-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p id="three-ds-title" className="font-semibold leading-tight">
              Confirm with your bank
            </p>
            <p className="text-xs text-foreground/55">
              Your bank asks you to approve this payment.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel the payment"
            className="grid size-9 place-items-center rounded-full text-foreground/60 transition-colors hover:bg-foreground/8 hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>
        <iframe
          ref={frame}
          src={url}
          title="Your bank's security check"
          className="w-full flex-1 bg-white"
          allow="payment"
        />
        <div className="flex items-center justify-between gap-3 border-t border-foreground/10 px-5 py-3 text-xs text-foreground/55">
          <span>Page not loading?</span>
          <button
            type="button"
            onClick={() => window.location.assign(url)}
            className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
          >
            Open the bank&apos;s page <ExternalLink className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
