"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  MailCheck,
  MailWarning,
  MonitorSmartphone,
  Receipt,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/toast";
import { useSessionRefresh } from "@/hooks/use-session-refresh";
import { cn } from "@/lib/utils";
import type { ApiResult } from "@/admin/lib/menu/api";
import {
  deleteSchemaFor,
  passwordSchemaFor,
  passwordStrength,
  profileSchema,
  type Account,
  type DeleteValues,
  type PasswordValues,
  type ProfileValues,
  type VerificationState,
} from "@/lib/account";
import {
  changePassword,
  deleteAccount,
  disableTwoFactor,
  enableTwoFactor,
  forgetTrustedDevices,
  newRecoveryCodes,
  sendVerificationEmail,
  signOutEverywhere,
  startTwoFactor,
  updateProfile,
} from "@/lib/actions/account.actions";
import { GoogleMark } from "@/components/auth/GoogleButton";
import {
  AuthenticatorSetup,
  CodeInput,
  RecoveryCodes,
} from "@/components/auth/TwoFactorParts";
import {
  cleanCode,
  looksLikeBackupCode,
  type SetupInfo,
  type TwoFactorState,
} from "@/lib/two-factor";

type Props = {
  account: Account;
  memberSince: string;
  lastSignIn?: string;
  features: { reservations: boolean; ordering: boolean };
  team: { roleLabel: string } | null;
  brandName?: string;
  setupTwoFactor?: boolean;
};

class FormFailure extends Error {
  constructor(
    message: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

async function unwrap<T>(promise: Promise<ApiResult<T>>): Promise<T> {
  const result = await promise;
  if (!result.ok) throw new FormFailure(result.message, result.fieldErrors);
  return result.data;
}

const INPUT =
  "h-11 border-foreground/20 bg-background transition placeholder:text-foreground/40 hover:border-foreground/40 focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:border-primary/60";

export function AccountView({
  account,
  memberSince,
  lastSignIn,
  features,
  team,
  brandName = "Account",
  setupTwoFactor = false,
}: Props) {
  const twoFactor: TwoFactorState = account.twoFactor ?? {
    enabled: false,
    required: false,
    recoveryCodesLeft: 0,
    trustedDevices: 0,
  };
  const twoFactorNeeded = twoFactor.required && !twoFactor.enabled;
  const sections = [
    { id: "profile", label: "Profile", icon: UserRound },
    {
      id: "verification",
      label: "Email",
      icon: account.isEmailVerified ? BadgeCheck : MailWarning,
      dot: !account.isEmailVerified,
    },
    { id: "password", label: "Password", icon: KeyRound },
    {
      id: "two-step",
      label: "Two-step sign-in",
      icon: ShieldCheck,
      dot: twoFactorNeeded,
    },
    { id: "devices", label: "Devices", icon: MonitorSmartphone },
    ...(features.reservations || features.ordering
      ? [
          {
            id: "activity",
            label: features.reservations ? "Bookings & orders" : "Orders",
            icon: CalendarDays,
          },
        ]
      : []),
    ...(team ? [{ id: "team", label: "Team", icon: LayoutDashboard }] : []),
    { id: "close", label: "Close account", icon: ShieldAlert },
  ];
  const [active, setActive] = useState("profile");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const seen = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0];
        if (seen) setActive(seen.target.id);
      },
      { rootMargin: "-25% 0px -65% 0px" },
    );
    document
      .querySelectorAll<HTMLElement>("[data-account-section]")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const fullName = `${account.firstName} ${account.lastName}`.trim();

  return (
    <main className="min-h-svh bg-background text-foreground">
      <header className="relative isolate overflow-hidden border-b border-foreground/10 bg-muted px-(--pad) pt-[calc(var(--nav-height,4.5rem)+2.5rem)] pb-10 [--pad:clamp(1.1rem,4vw,3.5rem)] sm:pt-[calc(var(--nav-height,4.5rem)+3.5rem)] sm:pb-12">
        <div
          aria-hidden="true"
          className="absolute -top-40 -right-40 -z-10 size-120 rounded-full bg-primary/12 blur-3xl"
        />
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-primary uppercase">
              <span aria-hidden="true" className="h-px w-6 bg-primary" />
              Your account
            </p>
            <h1 className="mt-3 text-[clamp(2.2rem,5.5vw,3.75rem)] leading-[1.02] font-medium tracking-[-0.04em] text-balance">
              Hello, {account.firstName}
            </h1>
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[15px] text-foreground/65">
              <span className="truncate">{account.email}</span>
              <span
                aria-hidden="true"
                className="hidden h-4 w-px bg-foreground/15 sm:block"
              />
              <span>Member since {memberSince}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill ok={account.isEmailVerified} />
            {team && (
              <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-foreground/15 bg-background/70 px-3.5 text-sm font-medium backdrop-blur">
                <LayoutDashboard className="size-4 text-primary" />{" "}
                {team.roleLabel}
              </span>
            )}
          </div>
        </div>
      </header>

      <nav
        aria-label="Account sections"
        className="sticky top-(--nav-offset,4.5rem) z-20 border-b border-foreground/10 bg-background lg:hidden"
      >
        <ul className="flex gap-1 overflow-x-auto px-(--pad) py-2.5 [--pad:clamp(1.1rem,4vw,3.5rem)] scrollbar-none [&::-webkit-scrollbar]:hidden">
          {sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={active === s.id ? "true" : undefined}
                className={cn(
                  "relative inline-flex h-9 items-center rounded-full px-3.5 text-sm font-medium whitespace-nowrap transition-colors",
                  active === s.id
                    ? "bg-foreground text-background"
                    : "text-foreground/65 hover:bg-foreground/5 hover:text-foreground",
                )}
              >
                {s.label}
                {s.dot && (
                  <span
                    aria-hidden="true"
                    className="ml-1.5 size-1.5 rounded-full bg-amber-500"
                  />
                )}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="px-(--pad) pt-8 pb-24 [--pad:clamp(1.1rem,4vw,3.5rem)] sm:pt-12">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-14">
          <aside className="hidden lg:block">
            <nav
              aria-label="Account sections"
              className="sticky top-[calc(var(--nav-height,4.5rem)+2rem)]"
            >
              <p className="mb-3 px-3 text-sm font-semibold">{fullName}</p>
              <ul className="space-y-0.5">
                {sections.map((s) => {
                  const on = active === s.id;
                  return (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        aria-current={on ? "true" : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-[calc(var(--radius,0.75rem)*1.1)] px-3 py-2.5 text-[15px] transition-colors",
                          on
                            ? "bg-foreground/6 font-semibold text-foreground"
                            : "text-foreground/65 hover:bg-foreground/4 hover:text-foreground",
                          s.id === "close" && !on && "text-foreground/50",
                        )}
                      >
                        <s.icon
                          className={cn(
                            "size-4.5 shrink-0",
                            on ? "text-primary" : "text-foreground/45",
                          )}
                        />
                        <span className="flex-1 truncate">{s.label}</span>
                        {s.dot && (
                          <span
                            aria-label="Needs attention"
                            className="size-2 rounded-full bg-amber-500"
                          />
                        )}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </aside>

          <div className="min-w-0 space-y-6 sm:space-y-8">
            <ProfileSection account={account} />
            <VerificationSection account={account} />
            <PasswordSection
              hasPassword={account.hasPassword}
              googleLinked={account.googleLinked}
            />
            <TwoFactorSection
              state={twoFactor}
              hasPassword={account.hasPassword}
              brandName={brandName}
              autoStart={setupTwoFactor && twoFactorNeeded}
            />
            <DevicesSection lastSignIn={lastSignIn} />
            {(features.reservations || features.ordering) && (
              <ActivitySection features={features} />
            )}
            {team && <TeamSection roleLabel={team.roleLabel} />}
            <CloseSection
              isTeam={team !== null}
              hasPassword={account.hasPassword}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

function Section({
  id,
  title,
  description,
  children,
  footer,
  tone,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  tone?: "danger";
}) {
  return (
    <section
      id={id}
      data-account-section
      aria-labelledby={`${id}-title`}
      className={cn(
        "scroll-mt-[calc(var(--nav-height,4.5rem)+4.5rem)] overflow-hidden rounded-[calc(var(--radius,0.75rem)*1.8)] border bg-background lg:scroll-mt-[calc(var(--nav-height,4.5rem)+2rem)]",
        tone === "danger" ? "border-destructive/30" : "border-foreground/10",
      )}
    >
      <div className="px-5 pt-5 sm:px-7 sm:pt-6">
        <h2
          id={`${id}-title`}
          className={cn(
            "text-xl font-semibold tracking-tight",
            tone === "danger" && "text-destructive",
          )}
        >
          {title}
        </h2>
        {description && (
          <p className="mt-1 max-w-2xl text-[15px] text-pretty text-foreground/60">
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className="px-5 pt-5 pb-6 sm:px-7 sm:pb-7">{children}</div>
      )}
      {footer && (
        <div className="flex flex-col-reverse gap-3 border-t border-foreground/10 bg-foreground/2.5 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          {footer}
        </div>
      )}
    </section>
  );
}

function StatusPill({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-emerald-500/12 px-3.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
      <BadgeCheck className="size-4" /> Verified
    </span>
  ) : (
    <a
      href="#verification"
      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-amber-500/15 px-3.5 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-500/25 dark:text-amber-300"
    >
      <MailWarning className="size-4" /> Not verified
    </a>
  );
}

function PasswordInput({
  id,
  show,
  onToggle,
  ...rest
}: ComponentProps<typeof Input> & {
  id: string;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="relative">
      <Input
        {...rest}
        id={id}
        type={show ? "text" : "password"}
        className={cn(INPUT, "pr-11")}
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute top-0 right-0 grid h-11 w-11 place-items-center text-foreground/45 transition-colors hover:text-foreground"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function applyFieldErrors<T extends Record<string, unknown>>(
  error: unknown,
  setError: (name: keyof T & string, e: { message: string }) => void,
  fields: readonly (keyof T & string)[],
) {
  if (!(error instanceof FormFailure) || !error.fieldErrors) return false;
  let placed = false;
  for (const [name, message] of Object.entries(error.fieldErrors)) {
    if ((fields as readonly string[]).includes(name)) {
      setError(name as keyof T & string, { message });
      placed = true;
    }
  }
  return placed;
}

function ProfileSection({ account }: { account: Account }) {
  const { syncSession } = useSessionRefresh();
  const defaults: ProfileValues = {
    firstName: account.firstName,
    lastName: account.lastName,
    phone: account.phone ?? "",
  };
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: defaults,
  });
  const dirty = form.formState.isDirty;

  const save = useMutation({
    mutationFn: (values: ProfileValues) => unwrap(updateProfile(values)),
    onSuccess: (saved) => {
      form.reset({
        firstName: saved.firstName,
        lastName: saved.lastName,
        phone: saved.phone ?? "",
      });
      toast.add({ title: "Your details are saved", type: "success" });
      void syncSession();
    },
    onError: (error) => {
      if (
        !applyFieldErrors<ProfileValues>(error, form.setError, [
          "firstName",
          "lastName",
          "phone",
        ])
      )
        toast.add({
          title: "Nothing changed",
          description: error.message,
          type: "error",
        });
    },
  });

  return (
    <form
      onSubmit={form.handleSubmit((values) => save.mutate(values))}
      noValidate
    >
      <Section
        id="profile"
        title="Profile"
        description="Your name and phone number, for bookings and orders."
        footer={
          <>
            <p className="text-sm text-foreground/55" aria-live="polite">
              {dirty ? "You have unsaved changes" : "Everything is up to date"}
            </p>
            <div className="flex gap-2 max-sm:*:flex-1">
              {dirty && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => form.reset()}
                  disabled={save.isPending}
                >
                  Discard
                </Button>
              )}
              <Button
                type="submit"
                disabled={!dirty || save.isPending}
                className="min-w-32 text-white"
              >
                {save.isPending && (
                  <LoaderCircle className="size-4 animate-spin" />
                )}
                {save.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          {(["firstName", "lastName"] as const).map((name) => (
            <Controller
              key={name}
              name={name}
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="gap-1.5">
                  <FieldLabel htmlFor={name}>
                    {name === "firstName" ? "First name" : "Last name"}
                  </FieldLabel>
                  <Input
                    {...field}
                    id={name}
                    autoComplete={
                      name === "firstName" ? "given-name" : "family-name"
                    }
                    aria-invalid={fieldState.invalid}
                    className={INPUT}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          ))}

          <Field className="gap-1.5">
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <div className="relative">
              <Input
                id="email"
                value={account.email}
                readOnly
                disabled
                className={cn(
                  INPUT,
                  "pr-28 disabled:opacity-100 disabled:bg-foreground/3",
                )}
              />
              <span
                className={cn(
                  "absolute top-1/2 right-2 inline-flex -translate-y-1/2 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                  account.isEmailVerified
                    ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                    : "bg-amber-500/15 text-amber-800 dark:text-amber-300",
                )}
              >
                {account.isEmailVerified ? (
                  <Check className="size-3" />
                ) : (
                  <MailWarning className="size-3" />
                )}
                {account.isEmailVerified ? "Verified" : "Unverified"}
              </span>
            </div>
            <FieldDescription>
              Changing your email comes soon, with a check of the new address.
            </FieldDescription>
          </Field>

          <Controller
            name="phone"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1.5">
                <FieldLabel htmlFor="phone">
                  Phone{" "}
                  <span className="font-normal text-foreground/45">
                    (optional)
                  </span>
                </FieldLabel>
                <Input
                  {...field}
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+961 71 234 567"
                  aria-invalid={fieldState.invalid}
                  className={INPUT}
                />
                {fieldState.invalid ? (
                  <FieldError errors={[fieldState.error]} />
                ) : (
                  <FieldDescription>
                    So we can reach you about a booking.
                  </FieldDescription>
                )}
              </Field>
            )}
          />
        </div>
      </Section>
    </form>
  );
}

const INBOXES: Record<string, { label: string; url: string }> = {
  "gmail.com": { label: "Gmail", url: "https://mail.google.com" },
  "googlemail.com": { label: "Gmail", url: "https://mail.google.com" },
  "outlook.com": { label: "Outlook", url: "https://outlook.live.com/mail" },
  "hotmail.com": { label: "Outlook", url: "https://outlook.live.com/mail" },
  "live.com": { label: "Outlook", url: "https://outlook.live.com/mail" },
  "yahoo.com": { label: "Yahoo Mail", url: "https://mail.yahoo.com" },
  "icloud.com": { label: "iCloud Mail", url: "https://www.icloud.com/mail" },
  "proton.me": { label: "Proton Mail", url: "https://mail.proton.me" },
};

const countdown = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function VerificationSection({ account }: { account: Account }) {
  const { syncSession, isSyncing } = useSessionRefresh();
  const [sent, setSent] = useState<VerificationState | null>(
    account.verification ?? null,
  );
  const [now, setNow] = useState(() => Date.now());
  const resendAt = sent?.resendAt ? new Date(sent.resendAt).getTime() : 0;
  const waitMs = Math.max(0, resendAt - now);
  const inbox = INBOXES[account.email.split("@")[1]?.toLowerCase() ?? ""];

  useEffect(() => {
    if (resendAt <= Date.now()) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= resendAt) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendAt]);

  const waiting = !account.isEmailVerified && sent !== null;
  useEffect(() => {
    if (!waiting) return;
    const onFocus = () => void syncSession({ refetchUser: true });
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [waiting, syncSession]);

  const [verifiedOnLoad] = useState(account.isEmailVerified);
  useEffect(() => {
    if (account.isEmailVerified && !verifiedOnLoad)
      toast.add({
        title: "Your email is verified",
        description: "Thanks for confirming it.",
        type: "success",
      });
  }, [account.isEmailVerified, verifiedOnLoad]);

  const send = useMutation({
    mutationFn: () => unwrap(sendVerificationEmail()),
    onSuccess: (state) => {
      setNow(Date.now());
      if (state.status === "verified") {
        void syncSession({ refetchUser: true });
        return;
      }
      setSent(state);
      if (state.status === "sent")
        toast.add({
          title: "Link sent",
          description: `Check ${state.sentTo ?? "your inbox"}. It works for 24 hours.`,
          type: "success",
        });
      else
        toast.add({
          title: "A link is already on its way",
          description: "Give it a minute, and check your spam folder too.",
        });
    },
    onError: (error) =>
      toast.add({
        title: "No email sent",
        description: error.message,
        type: "error",
      }),
  });

  const sendButton = (label: string) => (
    <Button
      type="button"
      variant="outline"
      disabled={send.isPending || waitMs > 0}
      onClick={() => send.mutate()}
      className="shrink-0 border-amber-600/30 bg-background tabular-nums"
    >
      {send.isPending ? (
        <LoaderCircle className="size-4 animate-spin" />
      ) : (
        <RotateCw className="size-4" />
      )}
      {send.isPending
        ? "Sending…"
        : waitMs > 0
          ? `${label} in ${countdown(waitMs)}`
          : label}
    </Button>
  );

  return (
    <Section
      id="verification"
      title="Email verification"
      description="A verified email keeps your account safe and lets us send booking confirmations."
    >
      {account.isEmailVerified ? (
        <div className="flex items-center gap-4 rounded-[calc(var(--radius,0.75rem)*1.3)] bg-emerald-500/8 p-4 sm:p-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            <BadgeCheck className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold">Your email is verified</p>
            <p className="truncate text-sm text-foreground/60">
              {account.email}
            </p>
          </div>
        </div>
      ) : sent ? (
        <div className="overflow-hidden rounded-[calc(var(--radius,0.75rem)*1.3)] border border-primary/25 bg-primary/5">
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:p-5">
            <span className="relative grid size-11 shrink-0 place-items-center rounded-full bg-primary/12 text-primary">
              <span
                aria-hidden="true"
                className="absolute inset-0 animate-ping rounded-full bg-primary/15 repeat-2 motion-reduce:hidden"
              />
              <MailCheck className="relative size-5" />
            </span>
            <div className="min-w-0 flex-1" role="status">
              <p className="font-semibold">Check your inbox</p>
              <p className="text-sm text-pretty text-foreground/65">
                We sent a link to{" "}
                <span className="font-medium break-all text-foreground">
                  {account.email}
                </span>
                . Open it and press{" "}
                <span className="font-medium text-foreground">
                  Verify my email
                </span>
                . It works for 24 hours, on any device.
              </p>
              <p className="mt-2 text-xs text-foreground/50">
                Nothing yet? Look in spam or promotions, or resend in a minute.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 border-t border-primary/15 bg-background/60 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
            {inbox && (
              <a
                href={inbox.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-semibold text-white transition hover:brightness-110"
              >
                Open {inbox.label} <ArrowUpRight className="size-4" />
              </a>
            )}
            <Button
              type="button"
              variant="ghost"
              disabled={isSyncing}
              onClick={() => void syncSession({ refetchUser: true })}
              className="justify-center"
            >
              {isSyncing ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              I&apos;ve verified it
            </Button>
            <span className="hidden flex-1 sm:block" />
            {sendButton("Resend")}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded-[calc(var(--radius,0.75rem)*1.3)] border border-amber-500/30 bg-amber-500/[0.07] p-4 sm:flex-row sm:items-center sm:p-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
            <MailWarning className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Verify your email</p>
            <p className="text-sm text-pretty text-foreground/65">
              We&apos;ll send a link to{" "}
              <span className="font-medium break-all text-foreground">
                {account.email}
              </span>
              . Open it to confirm the address is yours.
            </p>
          </div>
          {sendButton("Send verification link")}
        </div>
      )}
    </Section>
  );
}

function PasswordSection({
  hasPassword,
  googleLinked,
}: {
  hasPassword: boolean;
  googleLinked: boolean;
}) {
  const router = useRouter();
  const empty: PasswordValues = {
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  };
  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchemaFor(hasPassword)),
    defaultValues: empty,
  });
  const [show, setShow] = useState({ current: false, next: false });

  const newPassword = useWatch({ control: form.control, name: "newPassword" });
  const strength = passwordStrength(newPassword);

  const save = useMutation({
    mutationFn: (values: PasswordValues) => unwrap(changePassword(values)),
    onSuccess: () => {
      form.reset(empty);
      setShow({ current: false, next: false });
      toast.add({
        title: hasPassword
          ? "Your password is changed"
          : "Your password is set",
        description: hasPassword
          ? "Use it the next time you sign in."
          : "You can now sign in with your email too.",
        type: "success",
      });
      if (!hasPassword) router.refresh();
    },
    onError: (error) => {
      if (
        !applyFieldErrors<PasswordValues>(error, form.setError, [
          "currentPassword",
          "newPassword",
          "confirmPassword",
        ])
      )
        toast.add({
          title: "Your password didn't change",
          description: error.message,
          type: "error",
        });
    },
  });

  const bar = [
    "bg-destructive",
    "bg-destructive",
    "bg-amber-500",
    "bg-emerald-500",
    "bg-emerald-600",
  ][strength.score];

  return (
    <form
      onSubmit={form.handleSubmit((values) => save.mutate(values))}
      noValidate
    >
      <Section
        id="password"
        title={hasPassword ? "Password" : "Set a password"}
        description={
          hasPassword
            ? "Use at least 8 characters. A longer password with a mix of letters, numbers and symbols is harder to guess."
            : "You joined with Google. Add a password to also sign in with your email, on any device."
        }
        footer={
          <>
            <p className="text-sm text-foreground/55">
              You stay signed in on this device.
            </p>
            <Button
              type="submit"
              disabled={save.isPending}
              className="min-w-40 max-sm:w-full text-white"
            >
              {save.isPending && (
                <LoaderCircle className="size-4 animate-spin" />
              )}
              {save.isPending
                ? "Saving…"
                : hasPassword
                  ? "Update password"
                  : "Set password"}
            </Button>
          </>
        }
      >
        <div className="grid max-w-xl gap-5">
          {googleLinked && (
            <p className="inline-flex items-center gap-2.5 self-start rounded-full border border-foreground/10 bg-foreground/3 py-1.5 pr-3.5 pl-2 text-sm text-foreground/70">
              <GoogleMark className="size-4" /> Google sign-in is on for this
              account
            </p>
          )}
          {hasPassword && (
            <Controller
              name="currentPassword"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="gap-1.5">
                  <FieldLabel htmlFor="currentPassword">
                    Current password
                  </FieldLabel>
                  <PasswordInput
                    {...field}
                    id="currentPassword"
                    autoComplete="current-password"
                    aria-invalid={fieldState.invalid}
                    show={show.current}
                    onToggle={() =>
                      setShow((s) => ({ ...s, current: !s.current }))
                    }
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <Controller
              name="newPassword"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="gap-1.5">
                  <FieldLabel htmlFor="newPassword">New password</FieldLabel>
                  <PasswordInput
                    {...field}
                    id="newPassword"
                    autoComplete="new-password"
                    aria-invalid={fieldState.invalid}
                    show={show.next}
                    onToggle={() => setShow((s) => ({ ...s, next: !s.next }))}
                  />
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : (
                    newPassword && (
                      <div
                        className="flex items-center gap-2.5"
                        aria-live="polite"
                      >
                        <div className="flex flex-1 gap-1">
                          {[1, 2, 3, 4].map((step) => (
                            <span
                              key={step}
                              className={cn(
                                "h-1 flex-1 rounded-full transition-colors",
                                strength.score >= step
                                  ? bar
                                  : "bg-foreground/10",
                              )}
                            />
                          ))}
                        </div>
                        <span className="w-16 text-right text-xs font-medium text-foreground/60">
                          {strength.label}
                        </span>
                      </div>
                    )
                  )}
                </Field>
              )}
            />
            <Controller
              name="confirmPassword"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="gap-1.5">
                  <FieldLabel htmlFor="confirmPassword">
                    Repeat new password
                  </FieldLabel>
                  <PasswordInput
                    {...field}
                    id="confirmPassword"
                    autoComplete="new-password"
                    aria-invalid={fieldState.invalid}
                    show={show.next}
                    onToggle={() => setShow((s) => ({ ...s, next: !s.next }))}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </div>
        </div>
      </Section>
    </form>
  );
}

function DevicesSection({ lastSignIn }: { lastSignIn?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const signOut = useMutation({
    mutationFn: () => unwrap(signOutEverywhere()),
    onSuccess: () => {
      toast.add({
        title: "Signed out everywhere",
        description: "Sign in again to continue.",
        type: "success",
      });
      router.replace("/");
      router.refresh();
    },
    onError: (error) =>
      toast.add({
        title: "Nothing changed",
        description: error.message,
        type: "error",
      }),
  });

  return (
    <Section
      id="devices"
      title="Devices"
      description="Where your account is signed in."
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-foreground/6 text-foreground/70">
            <MonitorSmartphone className="size-5" />
          </span>
          <div>
            <p className="font-semibold">This device</p>
            <p className="text-sm text-foreground/60">
              {lastSignIn ? `Last sign-in ${lastSignIn}` : "Signed in now"}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(true)}
          className="shrink-0"
        >
          <LogOut className="size-4" /> Sign out of every device
        </Button>
      </div>
      <p className="mt-4 text-sm text-pretty text-foreground/55">
        Lost a phone, or signed in on a shared computer? This ends every
        session, this one included.
      </p>

      <AlertDialog
        open={open}
        onOpenChange={(next) => !signOut.isPending && setOpen(next)}
      >
        <AlertDialogContent className="text-left sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of every device?</AlertDialogTitle>
            <AlertDialogDescription>
              Every browser and phone signed in to your account is signed out,
              this one too. You can sign in again right after.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={signOut.isPending}>
              Cancel
            </AlertDialogCancel>
            <Button
              onClick={() => signOut.mutate()}
              disabled={signOut.isPending}
              className="min-w-40"
            >
              {signOut.isPending && (
                <LoaderCircle className="size-4 animate-spin" />
              )}
              {signOut.isPending ? "Signing out…" : "Sign out everywhere"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Section>
  );
}

function ActivitySection({ features }: { features: Props["features"] }) {
  const tiles = [
    features.reservations && {
      icon: CalendarDays,
      title: "Your reservations",
      text: "Upcoming tables and past visits.",
      action: { label: "Book a table", href: "/reservations" },
    },
    features.ordering && {
      icon: Receipt,
      title: "Your orders",
      text: "Track an order, or order a favourite again.",
      action: { label: "See the menu", href: "/menu" },
    },
  ].filter(Boolean) as {
    icon: typeof Receipt;
    title: string;
    text: string;
    action: { label: string; href: string };
  }[];

  return (
    <Section
      id="activity"
      title={features.reservations ? "Bookings & orders" : "Orders"}
      description="Your history with us will live here."
    >
      <div className={cn("grid gap-3", tiles.length > 1 && "sm:grid-cols-2")}>
        {tiles.map((tile) => (
          <div
            key={tile.title}
            className="flex flex-col rounded-[calc(var(--radius,0.75rem)*1.3)] border border-dashed border-foreground/15 p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
                <tile.icon className="size-5" />
              </span>
              <span className="rounded-full bg-foreground/6 px-2.5 py-1 text-xs font-semibold text-foreground/60">
                Coming soon
              </span>
            </div>
            <p className="mt-4 font-semibold">{tile.title}</p>
            <p className="mt-0.5 text-sm text-foreground/60">{tile.text}</p>
            <Link
              href={tile.action.href}
              className="mt-4 inline-flex items-center gap-1 self-start text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              {tile.action.label} <ArrowUpRight className="size-4" />
            </Link>
          </div>
        ))}
      </div>
    </Section>
  );
}

function TeamSection({ roleLabel }: { roleLabel: string }) {
  return (
    <Section
      id="team"
      title="Team access"
      description={`You're on the restaurant's team as ${roleLabel.toLowerCase()}. Your role is managed by an admin.`}
    >
      <Link
        href="/admin"
        className="group flex items-center justify-between gap-4 rounded-[calc(var(--radius,0.75rem)*1.3)] bg-foreground px-5 py-4 text-background transition-opacity hover:opacity-90"
      >
        <span className="flex items-center gap-3">
          <LayoutDashboard className="size-5" />
          <span>
            <span className="block font-semibold">Open the admin panel</span>
            <span className="block text-sm text-background/65">
              Menu, bookings, gallery and more
            </span>
          </span>
        </span>
        <ArrowUpRight className="size-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </Link>
    </Section>
  );
}

function CloseSection({
  isTeam,
  hasPassword,
}: {
  isTeam: boolean;
  hasPassword: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [show, setShow] = useState(false);
  const form = useForm<DeleteValues>({
    resolver: zodResolver(deleteSchemaFor(hasPassword)),
    defaultValues: { password: "", confirm: "" },
  });

  const remove = useMutation({
    mutationFn: (values: DeleteValues) => unwrap(deleteAccount(values)),
    onSuccess: () => {
      toast.add({
        title: "Your account is closed",
        description: "Thank you for dining with us.",
        type: "success",
      });
      router.replace("/");
      router.refresh();
    },
    onError: (error) => {
      if (!applyFieldErrors<DeleteValues>(error, form.setError, ["password"]))
        toast.add({
          title: "Your account is still open",
          description: error.message,
          type: "error",
        });
    },
  });

  const close = (next: boolean) => {
    if (remove.isPending) return;
    setOpen(next);
    if (!next) {
      form.reset();
      setShow(false);
    }
  };

  return (
    <Section
      id="close"
      tone="danger"
      title="Close your account"
      description={
        isTeam
          ? "Team accounts are closed by an admin, from the Team page. Ask an admin if you're leaving the restaurant."
          : "Your name, email and phone are deleted for good, and you're signed out everywhere."
      }
    >
      <Button
        type="button"
        variant="destructive"
        onClick={() => setOpen(true)}
        disabled={isTeam}
      >
        <Trash2 className="size-4" /> Close my account
      </Button>

      <AlertDialog open={open} onOpenChange={close}>
        <AlertDialogContent className="text-left sm:max-w-md">
          <form
            onSubmit={form.handleSubmit((values) => remove.mutate(values))}
            noValidate
            className="grid gap-5"
          >
            <AlertDialogHeader>
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive sm:mx-0">
                <ShieldAlert className="size-6" />
              </span>
              <AlertDialogTitle>Close your account?</AlertDialogTitle>
              <AlertDialogDescription>
                This can&apos;t be undone. Your name, email and phone are
                deleted and you&apos;re signed out everywhere.
              </AlertDialogDescription>
            </AlertDialogHeader>

            {hasPassword && (
              <Controller
                name="password"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="gap-1.5">
                    <FieldLabel htmlFor="close-password">
                      Your password
                    </FieldLabel>
                    <PasswordInput
                      {...field}
                      id="close-password"
                      autoComplete="current-password"
                      aria-invalid={fieldState.invalid}
                      show={show}
                      onToggle={() => setShow((s) => !s)}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            )}
            <Controller
              name="confirm"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="gap-1.5">
                  <FieldLabel htmlFor="close-confirm">
                    Type <span className="font-mono font-semibold">DELETE</span>{" "}
                    to confirm
                  </FieldLabel>
                  <Input
                    {...field}
                    id="close-confirm"
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={fieldState.invalid}
                    className={cn(INPUT, "font-mono uppercase")}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <AlertDialogFooter>
              <AlertDialogCancel type="button" disabled={remove.isPending}>
                Keep my account
              </AlertDialogCancel>
              <Button
                type="submit"
                variant="destructive"
                disabled={remove.isPending}
                className="min-w-40"
              >
                {remove.isPending && (
                  <LoaderCircle className="size-4 animate-spin" />
                )}
                {remove.isPending ? "Closing…" : "Close account"}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </Section>
  );
}

/* ───────────── two-step sign-in ───────────── */

type TwoFactorPanel =
  | { kind: "setup"; info: SetupInfo; moving: boolean }
  | { kind: "codes"; codes: string[]; title: string };

type CodeAsk = "move" | "codes" | "disable";

function TwoFactorSection({
  state,
  hasPassword,
  brandName,
  autoStart,
}: {
  state: TwoFactorState;
  hasPassword: boolean;
  brandName: string;
  /** Came from the admin panel, which needs it: open the setup right away */
  autoStart: boolean;
}) {
  const router = useRouter();
  const { syncSession } = useSessionRefresh();
  const [panel, setPanel] = useState<TwoFactorPanel | null>(null);
  const [ask, setAsk] = useState<CodeAsk | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

  const start = useMutation({
    mutationFn: (current?: string) => unwrap(startTwoFactor(current)),
    onSuccess: (info, current) => {
      setPanel({ kind: "setup", info, moving: current !== undefined });
      setAsk(null);
      setCode("");
      setCodeError(null);
    },
    onError: (error) =>
      toast.add({
        title: "Setup didn't start",
        description: error.message,
        type: "error",
      }),
  });

  const started = useRef(false);
  const { mutate: begin } = start;
  useEffect(() => {
    if (autoStart && !state.enabled && !started.current) {
      started.current = true;
      begin(undefined);
    }
  }, [autoStart, state.enabled, begin]);

  const enable = useMutation({
    mutationFn: (value: string) => unwrap(enableTwoFactor(value)),
    onSuccess: ({ recoveryCodes }) => {
      setPanel({
        kind: "codes",
        codes: recoveryCodes,
        title: "Two-step sign-in is on",
      });
      setCode("");
    },
    onError: (error) => {
      setCodeError(
        error instanceof FormFailure && error.fieldErrors?.code
          ? error.fieldErrors.code
          : error.message,
      );
      setCode("");
    },
  });

  const forget = useMutation({
    mutationFn: () => unwrap(forgetTrustedDevices()),
    onSuccess: () => {
      toast.add({
        title: "Trusted devices forgotten",
        description: "Every device asks for a code at the next sign-in.",
        type: "success",
      });
      router.refresh();
    },
    onError: (error) =>
      toast.add({
        title: "Nothing changed",
        description: error.message,
        type: "error",
      }),
  });

  const finish = () => {
    setPanel(null);
    void syncSession({ refetchUser: true });
  };

  const since = state.enabledAt
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(state.enabledAt))
    : null;
  const needed = state.required && !state.enabled;

  return (
    <Section
      id="two-step"
      title="Two-step sign-in"
      description="After your password, you also enter a 6-digit code from an authenticator app on your phone. Someone who learns your password still can't get in."
    >
      {needed && !panel && (
        <div
          role="status"
          className="mb-5 flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200"
        >
          <ShieldAlert className="mt-0.5 size-5 shrink-0" />
          <p className="text-pretty">
            <strong className="font-semibold">Needed for your role.</strong> Set
            it up to keep using the admin panel. It takes about a minute.
          </p>
        </div>
      )}

      {panel?.kind === "codes" ? (
        <div className="max-w-xl">
          <p className="mb-4 inline-flex items-center gap-2 text-[15px] font-semibold text-emerald-700 dark:text-emerald-300">
            <BadgeCheck className="size-5" /> {panel.title}
          </p>
          <RecoveryCodes
            codes={panel.codes}
            brand={brandName}
            onDone={finish}
            doneLabel="Done"
          />
        </div>
      ) : panel?.kind === "setup" ? (
        <form
          className="grid max-w-xl gap-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!cleanCode(code))
              return setCodeError("Enter the 6-digit code from your app.");
            enable.mutate(code);
          }}
        >
          {panel.moving && (
            <p className="text-sm text-foreground/65">
              Add the account to the app on your new phone. Your old phone stops
              working once you confirm.
            </p>
          )}
          <AuthenticatorSetup info={panel.info} />
          <div className="grid gap-2">
            <CodeInput
              id="enable-code"
              value={code}
              onChange={(v) => {
                setCode(v);
                if (codeError) setCodeError(null);
              }}
              onComplete={(v) => enable.mutate(v)}
              invalid={!!codeError}
              disabled={enable.isPending}
            />
            {codeError && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {codeError}
              </p>
            )}
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={enable.isPending}
              onClick={() => {
                setPanel(null);
                setCode("");
                setCodeError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={enable.isPending}
              className="min-w-40 text-white"
            >
              {enable.isPending && (
                <LoaderCircle className="size-4 animate-spin" />
              )}
              {enable.isPending
                ? "Checking…"
                : panel.moving
                  ? "Use this phone"
                  : "Turn on"}
            </Button>
          </div>
        </form>
      ) : state.enabled ? (
        <div className="grid gap-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-emerald-500/12 px-3.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="size-4" /> On
            </span>
            {since && (
              <span className="text-sm text-foreground/60">Since {since}</span>
            )}
            {state.required && (
              <span className="text-sm text-foreground/60">
                · Needed for your role
              </span>
            )}
          </div>

          <ul className="divide-y divide-foreground/10 overflow-hidden rounded-2xl border border-foreground/10">
            <TwoFactorRow
              icon={<Smartphone className="size-5" />}
              title="Authenticator app"
              text="Lost or changed your phone? Move the codes to the new one."
              action={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAsk("move")}
                >
                  Move to a new phone
                </Button>
              }
            />
            <TwoFactorRow
              icon={<KeyRound className="size-5" />}
              title="Backup codes"
              text={
                state.recoveryCodesLeft > 0
                  ? `${state.recoveryCodesLeft} of 10 left. Each works once, when your phone isn't at hand.`
                  : "None left. Make new ones, so you can still sign in without your phone."
              }
              warn={state.recoveryCodesLeft <= 2}
              action={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAsk("codes")}
                >
                  New backup codes
                </Button>
              }
            />
            <TwoFactorRow
              icon={<MonitorSmartphone className="size-5" />}
              title="Trusted devices"
              text={
                state.trustedDevices > 0
                  ? `${state.trustedDevices} ${state.trustedDevices === 1 ? "device skips" : "devices skip"} the code for 30 days.`
                  : "No device skips the code."
              }
              action={
                state.trustedDevices > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={forget.isPending}
                    onClick={() => forget.mutate()}
                  >
                    {forget.isPending && (
                      <LoaderCircle className="size-4 animate-spin" />
                    )}
                    Forget all
                  </Button>
                ) : null
              }
            />
          </ul>

          {!state.required && (
            <div>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setAsk("disable")}
              >
                Turn off two-step sign-in
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-foreground/6 text-foreground/70">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <p className="font-semibold">Off</p>
              <p className="text-sm text-foreground/60">
                Free authenticator apps: Google Authenticator, Microsoft
                Authenticator, 2FAS.
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => start.mutate(undefined)}
            disabled={start.isPending}
            className="shrink-0 text-white"
          >
            {start.isPending && (
              <LoaderCircle className="size-4 animate-spin" />
            )}
            Set up
          </Button>
        </div>
      )}

      <CodeDialog
        open={ask === "move"}
        onClose={() => setAsk(null)}
        title="Move to a new phone"
        description="First, confirm it's you with a code from your current app, or a backup code."
        confirmLabel="Continue"
        onSubmit={async (value) => {
          const info = await unwrap(startTwoFactor(value));
          setAsk(null);
          setCode("");
          setCodeError(null);
          setPanel({ kind: "setup", info, moving: true });
        }}
      />
      <CodeDialog
        open={ask === "codes"}
        onClose={() => setAsk(null)}
        title="Make new backup codes?"
        description="Your old backup codes stop working. Enter a code from your app to continue."
        confirmLabel="Make new codes"
        onSubmit={async (value) => {
          const { recoveryCodes } = await unwrap(newRecoveryCodes(value));
          setAsk(null);
          setPanel({
            kind: "codes",
            codes: recoveryCodes,
            title: "New backup codes are ready",
          });
        }}
      />
      <CodeDialog
        open={ask === "disable"}
        onClose={() => setAsk(null)}
        title="Turn off two-step sign-in?"
        description="Your password alone will open your account again, and trusted devices are forgotten."
        confirmLabel="Turn off"
        danger
        needPassword={hasPassword}
        onSubmit={async (value, password) => {
          await unwrap(disableTwoFactor({ code: value, password }));
          setAsk(null);
          toast.add({ title: "Two-step sign-in is off", type: "success" });
          void syncSession({ refetchUser: true });
        }}
      />
    </Section>
  );
}

function TwoFactorRow({
  icon,
  title,
  text,
  action,
  warn,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action: ReactNode;
  warn?: boolean;
}) {
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex min-w-0 items-start gap-3.5">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full",
            warn
              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
              : "bg-foreground/6 text-foreground/70",
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-pretty text-foreground/60">{text}</p>
        </div>
      </div>
      {action && <div className="shrink-0 max-sm:pl-13.5">{action}</div>}
    </li>
  );
}

/** Asks for a code (from the app, or a backup code), and the password when needed */
function CodeDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  danger,
  needPassword,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  needPassword?: boolean;
  onSubmit: (code: string, password?: string) => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [backup, setBackup] = useState(false);
  const [errors, setErrors] = useState<{ code?: string; password?: string }>(
    {},
  );
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setCode("");
    setPassword("");
    setShow(false);
    setBackup(false);
    setErrors({});
  };

  const submit = async (value = code) => {
    if (busy) return;
    const ok = backup ? looksLikeBackupCode(value) : cleanCode(value);
    const next: typeof errors = {};
    if (!ok)
      next.code = backup
        ? "Enter a backup code, like abcde-12345"
        : "Enter the 6-digit code from your app";
    if (needPassword && !password) next.password = "Enter your password";
    setErrors(next);
    if (next.code || next.password) return;

    setBusy(true);
    try {
      await onSubmit(value, needPassword ? password : undefined);
      reset();
    } catch (error) {
      const fields =
        error instanceof FormFailure ? error.fieldErrors : undefined;
      setErrors(
        fields?.code || fields?.password
          ? { code: fields.code, password: fields.password }
          : { code: (error as Error).message },
      );
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (busy || next) return;
        reset();
        onClose();
      }}
    >
      <AlertDialogContent className="text-left sm:max-w-md">
        <form
          noValidate
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <AlertDialogHeader>
            <span
              className={cn(
                "mx-auto grid size-12 place-items-center rounded-full sm:mx-0",
                danger
                  ? "bg-destructive/10 text-destructive"
                  : "bg-primary/10 text-primary",
              )}
            >
              <ShieldCheck className="size-6" />
            </span>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>

          {needPassword && (
            <Field data-invalid={!!errors.password} className="gap-1.5">
              <FieldLabel htmlFor="two-step-password">Your password</FieldLabel>
              <PasswordInput
                id="two-step-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                show={show}
                onToggle={() => setShow((s) => !s)}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
            </Field>
          )}

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <FieldLabel htmlFor="two-step-dialog-code">
                {backup ? "Backup code" : "Code from your app"}
              </FieldLabel>
              <button
                type="button"
                onClick={() => {
                  setBackup((b) => !b);
                  setCode("");
                  setErrors((e) => ({ ...e, code: undefined }));
                }}
                className="text-xs font-medium text-primary hover:underline"
              >
                {backup ? "Use the app instead" : "Use a backup code"}
              </button>
            </div>
            <CodeInput
              id="two-step-dialog-code"
              value={code}
              onChange={(v) => {
                setCode(v);
                if (errors.code) setErrors((e) => ({ ...e, code: undefined }));
              }}
              onComplete={needPassword ? undefined : (v) => void submit(v)}
              backup={backup}
              invalid={!!errors.code}
              disabled={busy}
              autoFocus={!needPassword}
            />
            {errors.code && (
              <p role="alert" className="text-sm text-destructive">
                {errors.code}
              </p>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={busy}>
              Cancel
            </AlertDialogCancel>
            <Button
              type="submit"
              variant={danger ? "destructive" : "default"}
              disabled={busy}
              className={cn("min-w-36", !danger && "text-white")}
            >
              {busy && <LoaderCircle className="size-4 animate-spin" />}
              {busy ? "Checking…" : confirmLabel}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
