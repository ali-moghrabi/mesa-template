"use client";

import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const SDK_URL = "https://tap-sdks.b-cdn.net/card/1.0.2/index.js";
const ELEMENT_ID = "tap-card-field";
const TOKENIZE_TIMEOUT_MS = 30_000;

type Enum = Record<string, string>;
type CardSdk = {
  renderTapCard: (
    id: string,
    config: Record<string, unknown>,
  ) => { unmount?: () => void };
  tokenize: () => void;
  resetCardInputs?: () => void;
  updateTheme?: (theme: string) => void;
  Theme?: Enum;
  Currencies?: Enum;
  Direction?: Enum;
  Edges?: Enum;
  Locale?: Enum;
};

declare global {
  interface Window {
    CardSDK?: CardSdk;
  }
}

let loading: Promise<CardSdk> | null = null;

/** Tap's script, loaded once, only on the checkout */
function loadSdk(): Promise<CardSdk> {
  if (window.CardSDK) return Promise.resolve(window.CardSDK);
  loading ??= new Promise<CardSdk>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () =>
      window.CardSDK
        ? resolve(window.CardSDK)
        : reject(new Error("Card payments didn't load"));
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error("Card payments didn't load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

const isDark = () =>
  document.documentElement.classList.contains("dark") ||
  document.documentElement.dataset.theme === "dark";

/** Tap's error payloads aren't documented: the first readable message */
function messageOf(data: unknown): string {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const key of ["message", "description", "error"]) {
      const v = d[key];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (v && typeof v === "object") {
        const inner = messageOf(v);
        if (inner) return inner;
      }
    }
  }
  return typeof data === "string" && data.trim() ? data.trim() : "";
}

export type TapCardHandle = {
  /** The typed card → a one-time token, or a message to show */
  tokenize: () => Promise<
    { ok: true; token: string } | { ok: false; message: string }
  >;
  /** Clears the inputs (after a declined card) */
  reset: () => void;
};

export function TapCardField({
  ref,
  publicKey,
  merchantId,
  amount,
  currency,
  customer,
}: {
  ref: Ref<TapCardHandle>;
  publicKey: string;
  merchantId?: string;
  amount: number;
  currency: string;
  customer: { name: string; email: string };
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const sdk = useRef<CardSdk | null>(null);
  const pending = useRef<
    | ((
        result: { ok: true; token: string } | { ok: false; message: string },
      ) => void)
    | null
  >(null);
  // The first values only: the field is drawn once (the amount is shown on the Pay button)
  const initial = useRef({ amount, currency, customer, publicKey, merchantId });

  useEffect(() => {
    let cancelled = false;
    let unmount: (() => void) | undefined;
    const settle = (
      result: { ok: true; token: string } | { ok: false; message: string },
    ) => {
      pending.current?.(result);
      pending.current = null;
    };

    loadSdk()
      .then((card) => {
        if (cancelled) return;
        sdk.current = card;
        const { amount, currency, customer, publicKey, merchantId } =
          initial.current;
        const [first, ...rest] = customer.name.trim().split(/\s+/);
        const en = card.Locale?.EN ?? "en";
        const rendered = card.renderTapCard(ELEMENT_ID, {
          publicKey,
          ...(merchantId && { merchant: { id: merchantId } }),
          transaction: {
            amount: Math.max(amount, 0.01),
            currency:
              card.Currencies?.[currency.toUpperCase()] ??
              currency.toUpperCase(),
          },
          customer: {
            name: [
              {
                lang: en,
                first: first ?? "",
                last: rest.join(" "),
                middle: "",
              },
            ],
            nameOnCard: customer.name,
            editable: true,
            contact: { email: customer.email },
          },
          acceptance: {
            supportedBrands: ["VISA", "MASTERCARD", "AMERICAN_EXPRESS", "MADA"],
            supportedCards: "ALL",
          },
          fields: { cardHolder: true },
          addons: { displayPaymentBrands: true, loader: true, saveCard: false },
          interface: {
            locale: en,
            theme: isDark()
              ? (card.Theme?.DARK ?? "dark")
              : (card.Theme?.LIGHT ?? "light"),
            edges: card.Edges?.CURVED ?? "curved",
            direction: card.Direction?.LTR ?? "ltr",
          },
          onReady: () => {
            if (!cancelled) setStatus("ready");
          },
          onSuccess: (data: unknown) => {
            const id = (data as { id?: unknown } | null)?.id;
            settle(
              typeof id === "string" && id.startsWith("tok_")
                ? { ok: true, token: id }
                : {
                    ok: false,
                    message:
                      "Your card couldn't be read. Check the details and try again.",
                  },
            );
          },
          onError: (data: unknown) => {
            settle({
              ok: false,
              message:
                messageOf(data) || "Check your card details and try again.",
            });
          },
        });
        unmount = rendered?.unmount;
        // onReady normally comes first; this keeps the field visible if it doesn't
        setTimeout(() => {
          if (!cancelled) setStatus((s) => (s === "loading" ? "ready" : s));
        }, 4000);
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    // Light / dark switches follow the site
    const observer = new MutationObserver(() =>
      sdk.current?.updateTheme?.(isDark() ? "dark" : "light"),
    );
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    return () => {
      cancelled = true;
      observer.disconnect();
      try {
        unmount?.();
      } catch {
        // already gone
      }
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      tokenize() {
        const card = sdk.current;
        if (!card || status !== "ready")
          return Promise.resolve({
            ok: false as const,
            message:
              status === "error"
                ? "Card payments didn't load. Refresh the page, or pay cash."
                : "Card payments are still loading. Try again in a second.",
          });
        return new Promise((resolve) => {
          const timer = setTimeout(() => {
            pending.current = null;
            resolve({
              ok: false,
              message: "The card check took too long. Try again.",
            });
          }, TOKENIZE_TIMEOUT_MS);
          pending.current = (result) => {
            clearTimeout(timer);
            resolve(result);
          };
          card.tokenize();
        });
      },
      reset() {
        sdk.current?.resetCardInputs?.();
      },
    }),
    [status],
  );

  return (
    <div className="relative min-h-36">
      {status === "loading" && (
        <div className="absolute inset-0 space-y-3" aria-hidden="true">
          <div className="h-12 animate-pulse rounded-xl bg-foreground/6" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-12 animate-pulse rounded-xl bg-foreground/6" />
            <div className="h-12 animate-pulse rounded-xl bg-foreground/6" />
          </div>
        </div>
      )}
      {status === "error" && (
        <p className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3.5 py-3 text-sm font-medium text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> Card payments
          didn&apos;t load. Refresh the page, or pay cash.
        </p>
      )}
      <div
        id={ELEMENT_ID}
        className={cn(
          "transition-opacity duration-300",
          status === "ready" ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
