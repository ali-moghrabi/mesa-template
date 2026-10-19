"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { THREE_DS_DONE } from "@/components/checkout/ThreeDsWindow";
import { CHECKOUT_SUCCESS_ROUTE } from "@/lib/checkout";

export function ThreeDsReturn({ orderId }: { orderId: string | null }) {
  useEffect(() => {
    const inWindow = window.parent !== window;
    if (inWindow && orderId) {
      window.parent.postMessage(
        { type: THREE_DS_DONE, order: orderId },
        window.location.origin,
      );
      return;
    }
    window.location.replace(
      orderId ? `${CHECKOUT_SUCCESS_ROUTE}?order=${orderId}` : "/menu",
    );
  }, [orderId]);

  return (
    <main className="grid min-h-svh place-items-center bg-background text-foreground">
      <p className="flex items-center gap-2 text-sm text-foreground/60">
        <Loader2 className="size-4 animate-spin" /> Confirming your payment…
      </p>
    </main>
  );
}
