"use client";

import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BellOff,
  Check,
  Loader2,
  MailCheck,
  MailX,
  PartyPopper,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  confirmNewsletter,
  resubscribeNewsletter,
  unsubscribeNewsletter,
} from "@/lib/actions/newsletter.actions";
import {
  UNSUBSCRIBE_REASONS,
  type TokenInfo,
  type TokenResult,
} from "@/lib/newsletter";

type Props = {
  mode: "confirm" | "unsubscribe";
  token: string;
  info: TokenInfo;
  brandName: string;
};

export function NewsletterManage({
  mode,
  token,
  info: initial,
  brandName,
}: Props) {
  const [info, setInfo] = useState(initial);
  const [justChanged, setJustChanged] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (action: () => Promise<TokenResult>) =>
    start(async () => {
      setError(null);
      const result = await action();
      if (result.ok) {
        setInfo(result.data);
        setJustChanged(true);
      } else setError(result.message);
    });

  const email = (
    <span className="font-semibold break-all text-foreground">
      {info.email}
    </span>
  );

  if (mode === "confirm") {
    if (info.status === "subscribed") {
      return (
        <State
          icon={<PartyPopper />}
          tone="success"
          title={justChanged ? "You're on the list!" : "Already confirmed"}
        >
          <p>
            {email}{" "}
            {justChanged
              ? "is confirmed. A welcome email is on its way."
              : "is already getting our newsletter."}{" "}
            Seasonal menus, events and offers from {brandName}, a few times a
            month at most.
          </p>
          <Actions>
            <Primary href="/">Back to the website</Primary>
            <Secondary href="/menu">See the menu</Secondary>
          </Actions>
        </State>
      );
    }
    if (info.expired) {
      return (
        <State
          icon={<AlertTriangle />}
          tone="warning"
          title="This link has expired"
        >
          <p>
            Confirmation links work for 7 days. Sign up again below and
            we&apos;ll send you a fresh one.
          </p>
        </State>
      );
    }
    return (
      <State icon={<MailCheck />} tone="brand" title="One last step">
        <p>
          Confirm that {email} should get the {brandName} newsletter.
        </p>
        {error && <ErrorLine>{error}</ErrorLine>}
        <Actions>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => confirmNewsletter(token))}
            className={PRIMARY}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            {pending ? "Confirming…" : "Confirm my subscription"}
          </button>
        </Actions>
      </State>
    );
  }

  if (info.status === "unsubscribed") {
    return (
      <State
        icon={<BellOff />}
        tone="neutral"
        title={justChanged ? "You're unsubscribed" : "Already unsubscribed"}
      >
        <p>
          {email} won&apos;t get our newsletter anymore.{" "}
          {justChanged && "Sorry to see you go!"} Emails about your orders and
          bookings still arrive as usual.
        </p>
        {error && <ErrorLine>{error}</ErrorLine>}
        <Actions>
          <Primary href="/">Back to the website</Primary>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => resubscribeNewsletter(token))}
            className={SECONDARY}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Changed your mind? Resubscribe
          </button>
        </Actions>
      </State>
    );
  }

  if (justChanged && info.status === "subscribed") {
    return (
      <State icon={<PartyPopper />} tone="success" title="Welcome back!">
        <p>{email} is back on the list. Good to have you.</p>
        <Actions>
          <Primary href="/">Back to the website</Primary>
        </Actions>
      </State>
    );
  }

  return (
    <State
      icon={<MailX />}
      tone="brand"
      title="Unsubscribe from the newsletter?"
    >
      <p>
        {email} will stop getting the {brandName} newsletter. Emails about your
        orders and bookings aren&apos;t affected.
      </p>
      <fieldset className="mt-6 text-left">
        <legend className="mb-2.5 text-sm font-semibold text-foreground">
          Mind telling us why?{" "}
          <span className="font-normal text-foreground/50">(optional)</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {UNSUBSCRIBE_REASONS.map((r) => (
            <label
              key={r.value}
              className={cn(
                "cursor-pointer rounded-full border px-3.5 py-2 text-sm font-medium transition has-focus-visible:ring-4 has-focus-visible:ring-primary/20",
                reason === r.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-foreground/12 text-foreground/70 hover:border-foreground/25 hover:text-foreground",
              )}
            >
              <input
                type="radio"
                name="reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
                className="sr-only"
              />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>
      {error && <ErrorLine>{error}</ErrorLine>}
      <Actions>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() => unsubscribeNewsletter(token, reason || undefined))
          }
          className={PRIMARY}
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          {pending ? "Unsubscribing…" : "Unsubscribe"}
        </button>
        <Secondary href="/">
          <ArrowLeft className="size-4" /> Keep me subscribed
        </Secondary>
      </Actions>
    </State>
  );
}

const PRIMARY =
  "inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-6 font-semibold text-white shadow-[0_14px_30px_-16px_var(--primary)] transition hover:brightness-110 disabled:opacity-70";
const SECONDARY =
  "inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-foreground/15 px-6 font-semibold transition hover:bg-muted disabled:opacity-70";

const Primary = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link href={href} className={PRIMARY}>
    {children}
  </Link>
);
const Secondary = ({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) => (
  <Link href={href} className={SECONDARY}>
    {children}
  </Link>
);
const Actions = ({ children }: { children: ReactNode }) => (
  <div className="mt-7 flex flex-col justify-center gap-2.5 min-[480px]:flex-row">
    {children}
  </div>
);
const ErrorLine = ({ children }: { children: ReactNode }) => (
  <p
    role="alert"
    className="mt-5 flex items-center justify-center gap-2 text-sm font-medium text-destructive"
  >
    <AlertTriangle className="size-4 shrink-0" /> {children}
  </p>
);

const TONES = {
  brand: "bg-primary text-white shadow-[0_18px_40px_-16px_var(--primary)]",
  success:
    "bg-emerald-500 text-white shadow-[0_18px_40px_-16px_rgb(16_185_129)]",
  warning: "bg-amber-500 text-white shadow-[0_18px_40px_-16px_rgb(245_158_11)]",
  neutral: "bg-foreground/10 text-foreground/70",
};

export function State({
  icon,
  tone,
  title,
  children,
}: {
  icon: ReactNode;
  tone: keyof typeof TONES;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="animate-rise text-center motion-reduce:animate-none">
      <span className="relative mx-auto grid size-18 place-items-center">
        {tone === "success" && (
          <span
            aria-hidden="true"
            className="absolute inset-0 animate-ping rounded-full bg-emerald-500/20 repeat-2"
          />
        )}
        <span
          className={cn(
            "relative grid size-18 place-items-center rounded-[1.4rem] [&_svg]:size-8",
            TONES[tone],
          )}
        >
          {icon}
        </span>
      </span>
      <h1 className="mt-6 text-[clamp(1.75rem,4vw,2.25rem)] leading-tight font-medium tracking-[-0.03em] text-balance">
        {title}
      </h1>
      <div className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-pretty text-foreground/65">
        {children}
      </div>
    </div>
  );
}
