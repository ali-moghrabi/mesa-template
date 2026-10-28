"use client";

import { useEffect, useRef, useState, type SVGProps } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { loginWithGoogle } from "@/lib/actions/auth.actions";
import type { TwoFactorGate } from "@/lib/two-factor";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

type CodeResponse = {
  code?: string;
  error?: string;
  error_description?: string;
};
type CodeClient = { requestCode: () => void };
type GoogleOAuth2 = {
  initCodeClient: (config: {
    client_id: string;
    scope: string;
    ux_mode: "popup";
    select_account?: boolean;
    callback: (response: CodeResponse) => void;
    error_callback?: (error: {
      type: "popup_failed_to_open" | "popup_closed" | "unknown";
    }) => void;
  }) => CodeClient;
};
declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth2 } };
  }
}

let loading: Promise<GoogleOAuth2> | null = null;
function loadGoogle(): Promise<GoogleOAuth2> {
  const ready = window.google?.accounts?.oauth2;
  if (ready) return Promise.resolve(ready);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () =>
      window.google?.accounts?.oauth2
        ? resolve(window.google.accounts.oauth2)
        : reject(new Error("Google sign-in didn't load"));
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error("Couldn't reach Google. Check your connection."));
    };
    document.head.appendChild(script);
  });
  return loading;
}

type Props = {
  onSignedIn: () => void;
  onTwoFactor?: (gate: TwoFactorGate) => void;
  onError: (message: string) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
};

export function GoogleButton({
  onSignedIn,
  onTwoFactor,
  onError,
  disabled,
  label = "Continue with Google",
  className,
}: Props) {
  const client = useRef<CodeClient | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const handlers = useRef({ onSignedIn, onTwoFactor, onError });
  useEffect(() => {
    handlers.current = { onSignedIn, onTwoFactor, onError };
  });

  useEffect(() => {
    if (!CLIENT_ID) return;
    let alive = true;
    loadGoogle()
      .then((oauth2) => {
        if (!alive) return;
        client.current = oauth2.initCodeClient({
          client_id: CLIENT_ID,
          scope: "openid email profile",
          ux_mode: "popup",
          select_account: true,
          callback: async (response) => {
            if (!response.code) {
              setBusy(false);
              if (response.error !== "access_denied")
                handlers.current.onError(
                  "Google sign-in didn't finish. Please try again.",
                );
              return;
            }
            try {
              const result = await loginWithGoogle(response.code);
              if (
                result.status === "two-factor" &&
                handlers.current.onTwoFactor
              )
                handlers.current.onTwoFactor(result.gate);
              else if (result.status === "two-factor")
                handlers.current.onError(
                  "This account uses two-step sign-in. Sign in from the sign-in window.",
                );
              else handlers.current.onSignedIn();
            } catch (error) {
              handlers.current.onError(
                error instanceof Error
                  ? error.message
                  : "Google sign-in failed. Please try again.",
              );
            } finally {
              setBusy(false);
            }
          },
          error_callback: (error) => {
            setBusy(false);
            if (error.type === "popup_failed_to_open")
              handlers.current.onError(
                "Allow popups for this site to sign in with Google.",
              );
          },
        });
        setReady(true);
      })
      .catch(
        (error: Error) => alive && handlers.current.onError(error.message),
      );
    return () => {
      alive = false;
    };
  }, []);

  if (!CLIENT_ID) return null;

  return (
    <button
      type="button"
      onClick={() => {
        if (!client.current || busy) return;
        setBusy(true);
        client.current.requestCode();
      }}
      disabled={disabled || !ready || busy}
      aria-busy={busy}
      className={cn(
        "group relative isolate flex h-11 w-full cursor-pointer items-center justify-center gap-3 overflow-hidden rounded-md border px-4 text-[15px] font-medium transition-all duration-200",
        "border-neutral-300 bg-white text-neutral-800 shadow-[0_1px_2px_rgb(0_0_0/0.06)] hover:-translate-y-px hover:border-neutral-400 hover:shadow-[0_8px_20px_-10px_rgb(0_0_0/0.35)] active:translate-y-0 active:shadow-none",
        "dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:border-neutral-400",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500",
        "disabled:pointer-events-none disabled:opacity-60",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 -left-2/3 -z-10 w-1/2 -skew-x-12 bg-linear-to-r from-transparent via-neutral-900/5 to-transparent transition-[left] duration-700 ease-out group-hover:left-[120%] dark:via-white/8"
      />
      {busy ? (
        <Loader2
          className="size-4.5 animate-spin text-neutral-500"
          aria-hidden="true"
        />
      ) : (
        <GoogleMark className="size-4.5 transition-transform duration-300 group-hover:scale-110" />
      )}
      <span>{busy ? "Waiting for Google…" : label}</span>
    </button>
  );
}

export function GoogleMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

export function OrDivider({
  label = "or",
  className,
}: {
  label?: string;
  className?: string;
}) {
  if (!CLIENT_ID) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 text-xs font-medium tracking-wide text-muted-foreground uppercase",
        className,
      )}
    >
      <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
      {label}
      <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
    </div>
  );
}
