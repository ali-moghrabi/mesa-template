"use client";

import { useEffect, useId, useState } from "react";
import QRCode from "qrcode";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AUTHENTICATOR_APPS, type SetupInfo } from "@/lib/two-factor";

export function CodeInput({
  value,
  onChange,
  onComplete,
  backup = false,
  invalid,
  disabled,
  autoFocus,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (code: string) => void;
  backup?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  id?: string;
}) {
  return (
    <input
      id={id}
      value={value}
      disabled={disabled}
      autoFocus={autoFocus}
      aria-invalid={invalid || undefined}
      autoComplete="one-time-code"
      inputMode={backup ? "text" : "numeric"}
      spellCheck={false}
      autoCapitalize="none"
      maxLength={backup ? 11 : 7}
      placeholder={backup ? "xxxxx-xxxxx" : "000000"}
      onChange={(e) => {
        const next = backup
          ? e.target.value.replace(/[^a-z0-9-]/gi, "").toLowerCase()
          : e.target.value.replace(/\D/g, "").slice(0, 6);
        onChange(next);
        if (!backup && next.length === 6 && value.length !== 6)
          onComplete?.(next);
      }}
      className={cn(
        "h-14 w-full rounded-xl border bg-background text-center font-mono text-2xl font-semibold tabular-nums outline-none transition",
        backup ? "tracking-[0.18em]" : "tracking-[0.55em] indent-[0.55em]",
        "placeholder:font-normal placeholder:text-foreground/20",
        "border-foreground/20 hover:border-foreground/40 focus:border-primary/70 focus:ring-4 focus:ring-primary/15",
        invalid &&
          "border-destructive/70 ring-4 ring-destructive/15 focus:border-destructive/70 focus:ring-destructive/15",
        disabled && "opacity-60",
      )}
    />
  );
}

export function AuthenticatorSetup({
  info,
  loading,
  className,
}: {
  info: SetupInfo | null;
  loading?: boolean;
  className?: string;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (!info) return;
    let alive = true;
    QRCode.toDataURL(info.uri, {
      margin: 1,
      width: 232,
      errorCorrectionLevel: "M",
      color: { dark: "#111111", light: "#ffffff" },
    })
      .then((url) => alive && setQr(url))
      .catch(() => alive && setShowKey(true));
    return () => {
      alive = false;
    };
  }, [info]);

  return (
    <div className={cn("grid gap-4", className)}>
      <Step n={1} title="Get an authenticator app">
        Any free one works: {AUTHENTICATOR_APPS.join(", ")}.
      </Step>

      <Step n={2} title="Add this account to the app">
        <div className="@container mt-3">
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-foreground/10 bg-foreground/2.5 p-4 @lg:flex-row @lg:items-start">
            <div className="grid size-44 shrink-0 place-items-center overflow-hidden rounded-xl bg-white p-2 shadow-sm ring-1 ring-black/5">
              {qr && info ? (
                // eslint-disable-next-line @next/next/no-img-element -- a generated data: URL
                <img
                  src={qr}
                  alt={`QR code to add ${info.account} to your authenticator app`}
                  className="size-full [image-rendering:pixelated]"
                />
              ) : (
                <LoaderCircle
                  className={cn(
                    "size-6 text-neutral-400",
                    (loading || !qr) && "animate-spin",
                  )}
                />
              )}
            </div>
            <div className="w-full min-w-0 flex-1 text-center text-sm text-foreground/65 @lg:text-left">
              <p>
                In the app, tap <strong className="text-foreground">+</strong>{" "}
                and scan the QR code.
              </p>
              {info && (
                <a
                  href={info.uri}
                  className="mt-3 inline-flex h-9 items-center gap-2 rounded-full border border-foreground/15 px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5 sm:hidden"
                >
                  <Smartphone className="size-4" /> Open in your app{" "}
                  <ExternalLink className="size-3.5 opacity-60" />
                </a>
              )}
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="mx-auto mt-3 flex items-center gap-1.5 font-medium text-primary hover:underline @lg:mx-0"
              >
                <KeyRound className="size-3.5" />
                {showKey ? "Hide the key" : "Can’t scan? Type a key instead"}
              </button>
              {showKey && info && (
                <div className="mt-2.5 grid gap-1.5 text-left">
                  <p className="text-xs text-foreground/55">
                    Account: {info.issuer} ({info.account}) · Time-based
                  </p>
                  <div className="flex items-center gap-2 rounded-lg border border-foreground/12 bg-background py-1.5 pr-1.5 pl-3">
                    <code className="min-w-0 flex-1 font-mono text-[13px] font-semibold tracking-wide text-foreground">
                      {info.secret}
                    </code>
                    <CopyButton
                      text={info.secret.replace(/\s/g, "")}
                      label="Copy key"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Step>

      <Step n={3} title="Enter the 6-digit code the app shows" />
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/12 text-xs font-bold text-primary">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold leading-6">{title}</p>
        {children && (
          <div className="text-sm text-pretty text-foreground/60">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

export function RecoveryCodes({
  codes,
  brand,
  onDone,
  doneLabel = "Continue",
}: {
  codes: string[];
  brand: string;
  onDone: () => void;
  doneLabel?: string;
}) {
  const [saved, setSaved] = useState(false);
  const check = useId();
  const text = [
    `${brand}: backup codes for two-step sign-in`,
    "Each code works once. Keep them somewhere safe, away from your phone.",
    "",
    ...codes,
    "",
    `Made ${new Date().toLocaleString()}`,
  ].join("\n");

  const download = () => {
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${brand.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-backup-codes.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="grid gap-4">
      <p className="text-sm text-pretty text-foreground/65">
        If you lose your phone, sign in with one of these instead. Each works
        once.{" "}
        <strong className="font-semibold text-foreground">
          They won&apos;t be shown again.
        </strong>
      </p>
      <ol className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-2xl border border-foreground/10 bg-foreground/2.5 p-4 font-mono text-[15px] font-semibold tracking-wide">
        {codes.map((code, i) => (
          <li key={code} className="flex items-baseline gap-2">
            <span className="w-4 text-right text-xs font-normal text-foreground/35 tabular-nums">
              {i + 1}
            </span>
            {code}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <CopyButton text={codes.join("\n")} label="Copy all" wide />
        <button
          type="button"
          onClick={download}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-foreground/15 px-3.5 text-sm font-medium transition-colors hover:bg-foreground/5"
        >
          <Download className="size-4" /> Download
        </button>
      </div>
      <label
        htmlFor={check}
        className="flex cursor-pointer items-start gap-3 rounded-xl border border-foreground/10 p-3 text-sm transition-colors hover:bg-foreground/3"
      >
        <input
          id={check}
          type="checkbox"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-primary"
        />
        <span>I saved my backup codes somewhere safe</span>
      </label>
      <button
        type="button"
        disabled={!saved}
        onClick={onDone}
        className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-4 font-semibold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {doneLabel}
      </button>
    </div>
  );
}

export function CopyButton({
  text,
  label,
  wide,
}: {
  text: string;
  label: string;
  wide?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          /* clipboard blocked: the text is on screen to select */
        }
      }}
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-full text-sm font-medium transition-colors",
        wide
          ? "h-9 border border-foreground/15 px-3.5 hover:bg-foreground/5"
          : "size-8 justify-center text-foreground/55 hover:bg-foreground/6 hover:text-foreground",
      )}
    >
      {copied ? (
        <Check className="size-4 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Copy className="size-4" />
      )}
      {wide && (copied ? "Copied" : label)}
    </button>
  );
}

export function TrustDevice({
  checked,
  onChange,
  days,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  days: number;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 text-sm text-foreground/75"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-primary"
      />
      <span>
        Trust this device for {days} days
        <span className="block text-xs text-foreground/50">
          Don&apos;t tick this on a shared or public computer.
        </span>
      </span>
    </label>
  );
}
