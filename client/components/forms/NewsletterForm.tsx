"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState, type SubmitEvent } from "react";
import {
  ArrowRight,
  Loader2,
  Mail,
  MailCheck,
  PartyPopper,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { subscribeNewsletter } from "@/lib/actions/newsletter.actions";
import type { NewsletterSource } from "@/lib/newsletter";

type Props = {
  tone?: "light" | "onPrimary";
  placeholder?: string;
  buttonLabel?: string;
  privacyHref?: string;
  source?: NewsletterSource;
  className?: string;
};

type Done = { status: "pending" | "already"; email: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function checkEmail(raw: string): string | null {
  const email = raw.trim();
  if (!email) return "Enter your email";
  if (email.length > 120) return "That email is too long";
  if (!EMAIL.test(email)) return "Enter a valid email";
  return null;
}

export function NewsletterForm({
  tone = "light",
  placeholder = "Your email address",
  buttonLabel = "Subscribe",
  privacyHref,
  source = "website",
  className,
}: Props) {
  const pathname = usePathname();
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [sending, setSending] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onPrimary = tone === "onPrimary";
  const errorId = useId();

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending) return;
    setError(null);
    const problem = checkEmail(email);
    setFieldError(problem);
    if (problem) return;
    setSending(true);
    try {
      const result = await subscribeNewsletter(
        { email: email.trim(), website },
        source,
        pathname,
      );
      if (result.ok) setDone({ status: result.status, email: email.trim() });
      else setError(result.message);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (done) {
    const already = done.status === "already";
    const Icon = already ? PartyPopper : MailCheck;
    return (
      <div
        role="status"
        className={cn("animate-rise motion-reduce:animate-none", className)}
      >
        <div
          className={cn(
            "flex gap-4 rounded-[calc(var(--radius)*2)] border p-5",
            onPrimary
              ? "border-white/20 bg-white/10 text-white backdrop-blur"
              : "border-border bg-card shadow-[0_20px_50px_-30px_rgba(0,0,0,.35)]",
          )}
        >
          <span
            className={cn(
              "grid size-12 shrink-0 place-items-center rounded-2xl",
              onPrimary ? "bg-white text-primary" : "bg-primary text-white",
            )}
          >
            <Icon className="size-6" />
          </span>
          <div className="min-w-0">
            <p className="text-lg font-semibold tracking-tight">
              {already ? "You're already on the list" : "Check your inbox"}
            </p>
            <p
              className={cn(
                "mt-1 text-sm leading-relaxed text-pretty",
                onPrimary ? "text-white/80" : "text-foreground/65",
              )}
            >
              {already ? (
                <>
                  <span
                    className={cn(
                      "font-medium break-all",
                      onPrimary ? "text-white" : "text-foreground",
                    )}
                  >
                    {done.email}
                  </span>{" "}
                  already gets our newsletter. See you in your inbox!
                </>
              ) : (
                <>
                  We sent a link to{" "}
                  <span
                    className={cn(
                      "font-medium break-all",
                      onPrimary ? "text-white" : "text-foreground",
                    )}
                  >
                    {done.email}
                  </span>
                  . Click it to confirm and you&apos;re in. Can&apos;t see it?
                  Check your spam folder.
                </>
              )}
            </p>
            <button
              type="button"
              onClick={() => {
                setEmail("");
                setWebsite("");
                setDone(null);
              }}
              className={cn(
                "mt-3 inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline",
                onPrimary ? "text-white" : "text-primary",
              )}
            >
              <RotateCcw className="size-3.5" /> Use another email
            </button>
          </div>
        </div>
      </div>
    );
  }

  const message = fieldError ?? error;

  return (
    <form onSubmit={submit} noValidate className={cn("w-full", className)}>
      <div
        className={cn(
          "flex flex-col gap-2 rounded-[calc(var(--radius)*2)] p-1.5 transition min-[420px]:flex-row min-[420px]:items-center",
          onPrimary
            ? "bg-white/12 ring-1 ring-white/25 backdrop-blur focus-within:bg-white/18 focus-within:ring-white/60"
            : "border border-foreground/12 bg-background shadow-[0_14px_40px_-28px_rgba(0,0,0,.4)] focus-within:border-primary/60 focus-within:ring-4 focus-within:ring-primary/15",
          message &&
            (onPrimary
              ? "ring-white/80"
              : "border-destructive focus-within:border-destructive focus-within:ring-destructive/15"),
        )}
      >
        <label className="flex min-w-0 flex-1 items-center gap-2.5 pl-3">
          <Mail
            className={cn(
              "size-4.5 shrink-0",
              onPrimary ? "text-white/70" : "text-foreground/40",
            )}
            aria-hidden="true"
          />
          <span className="sr-only">Email address</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={placeholder}
            aria-invalid={!!message}
            aria-describedby={message ? errorId : undefined}
            disabled={sending}
            name="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldError) setFieldError(null);
            }}
            className={cn(
              "h-11 w-full min-w-0 bg-transparent text-[15px] outline-none",
              onPrimary
                ? "text-white placeholder:text-white/60"
                : "placeholder:text-foreground/40",
            )}
          />
        </label>
        <button
          type="submit"
          disabled={sending}
          className={cn(
            "group inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[calc(var(--radius)*1.5)] px-5 text-[15px] font-semibold transition disabled:opacity-70",
            onPrimary
              ? "bg-white text-primary hover:bg-white/90"
              : "bg-primary text-white shadow-[0_10px_24px_-14px_var(--primary)] hover:brightness-110",
          )}
        >
          {sending ? <Loader2 className="size-4 animate-spin" /> : null}
          {sending ? "Subscribing…" : buttonLabel}
          {!sending && (
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
          )}
        </button>
      </div>

      <div
        aria-hidden="true"
        className="absolute left-[-9999px] h-px w-px overflow-hidden"
      >
        <label>
          Website
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      <p
        id={errorId}
        role={message ? "alert" : undefined}
        className={cn(
          "mt-2 min-h-5 pl-1 text-sm font-medium",
          onPrimary ? "text-white" : "text-destructive",
          !message && "sr-only",
        )}
      >
        {message}
      </p>
      <p
        className={cn(
          "pl-1 text-xs leading-relaxed text-pretty",
          onPrimary ? "text-white/65" : "text-foreground/55",
        )}
      >
        A few emails a month, no spam. Unsubscribe in one click.
        {privacyHref && (
          <>
            {" "}
            See our{" "}
            <Link
              href={privacyHref}
              className={cn(
                "underline underline-offset-4",
                onPrimary ? "hover:text-white" : "hover:text-foreground",
              )}
            >
              privacy policy
            </Link>
            .
          </>
        )}
      </p>
    </form>
  );
}
