"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Link2Off,
  Loader2,
  MailCheck,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { passwordStrength } from "@/lib/account";
import {
  forgotSchema,
  resetSchema,
  RESET_TTL_MINUTES,
  type ForgotValues,
  type ResetValues,
} from "@/lib/password-reset";
import {
  requestPasswordReset,
  resetPassword,
} from "@/lib/actions/password-reset.actions";

const INPUT =
  "h-11 border-neutral-300 transition placeholder:text-neutral-500 hover:border-neutral-500 focus-visible:ring-1 focus-visible:ring-neutral-500 dark:border-neutral-600 dark:hover:border-neutral-400 dark:focus-visible:ring-neutral-300";

export function AuthCard({
  icon,
  title,
  description,
  children,
  footer,
}: {
  icon: ReactNode;
  title: string;
  description: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="relative isolate flex min-h-svh items-center justify-center overflow-hidden bg-muted px-4 pt-[calc(var(--nav-height,4.5rem)+2rem)] pb-16">
      <div
        aria-hidden="true"
        className="absolute -top-40 -left-32 -z-10 size-120 rounded-full bg-primary/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -right-32 -bottom-40 -z-10 size-104 rounded-full bg-primary/10 blur-3xl"
      />
      <div className="w-full max-w-md">
        <div className="rounded-[calc(var(--radius,0.75rem)*2)] border border-foreground/10 bg-background p-7 shadow-[0_24px_60px_-30px_rgb(0_0_0/0.35)] sm:p-9">
          <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            {icon}
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-balance sm:text-[1.75rem]">
            {title}
          </h1>
          <div className="mt-2 text-[15px] text-pretty text-muted-foreground">
            {description}
          </div>
          {children && <div className="mt-7">{children}</div>}
        </div>
        {footer && (
          <div className="mt-6 text-center text-sm text-muted-foreground">
            {footer}
          </div>
        )}
      </div>
    </main>
  );
}

const BackHome = () => (
  <Link
    href="/"
    className="inline-flex items-center gap-1.5 font-medium text-foreground/70 underline-offset-4 transition-colors hover:text-foreground hover:underline"
  >
    <ArrowLeft className="size-4" /> Back to the website
  </Link>
);

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const form = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(id);
  }, [wait]);

  const send = useMutation({
    mutationFn: async (values: ForgotValues) => {
      const result = await requestPasswordReset(values);
      if (!result.ok) throw new Error(result.message);
      return values.email;
    },
    onMutate: () => setError(null),
    onSuccess: (email) => {
      setSentTo(email);
      setWait(60);
    },
    onError: (e) => setError(e.message),
  });

  if (sentTo) {
    return (
      <AuthCard
        icon={<MailCheck className="size-6" />}
        title="Check your inbox"
        description={
          <>
            If an account uses{" "}
            <span className="font-medium text-foreground">{sentTo}</span>,
            we&apos;ve sent it a link to choose a new password. The link works
            for {RESET_TTL_MINUTES} minutes.
          </>
        }
        footer={<BackHome />}
      >
        <ul className="space-y-2.5 rounded-2xl bg-foreground/4 p-4 text-sm text-foreground/70">
          {[
            "Open the email on this device or any other.",
            "Can't find it? Look in spam or promotions.",
            "Only the newest link works.",
          ].map((tip) => (
            <li key={tip} className="flex gap-2.5">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" /> {tip}
            </li>
          ))}
        </ul>
        {error && (
          <p
            role="alert"
            className="mt-4 text-center text-sm font-medium text-red-600 dark:text-red-400"
          >
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1 cursor-pointer"
            onClick={() => setSentTo(null)}
          >
            Use another email
          </Button>
          <Button
            type="button"
            className="h-11 flex-1 cursor-pointer"
            disabled={wait > 0 || send.isPending}
            onClick={() => send.mutate({ email: sentTo })}
          >
            {send.isPending ? (
              <Loader2 className="animate-spin" />
            ) : wait > 0 ? (
              `Send again in ${wait}s`
            ) : (
              "Send again"
            )}
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      icon={<KeyRound className="size-6" />}
      title="Forgot your password?"
      description="Enter the email of your account and we'll send you a link to choose a new one."
      footer={
        <>
          Remembered it?{" "}
          <Link
            href="/"
            className="font-medium text-foreground underline underline-offset-4 transition-colors hover:text-primary"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form
        onSubmit={form.handleSubmit((values) => send.mutate(values))}
        noValidate
        className="grid gap-4"
      >
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="gap-1">
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                {...field}
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                placeholder="you@example.com"
                aria-invalid={fieldState.invalid}
                className={INPUT}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        {error && (
          <p
            role="alert"
            className="text-center text-sm font-medium text-red-600 dark:text-red-400"
          >
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={send.isPending}
          className="h-11 w-full cursor-pointer"
        >
          {send.isPending ? (
            <Loader2 className="animate-spin" />
          ) : (
            "Send reset link"
          )}
        </Button>
      </form>
    </AuthCard>
  );
}

export function ResetPasswordForm({
  firstName,
  email,
}: {
  firstName: string;
  email: string;
}) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const form = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });
  const password = useWatch({ control: form.control, name: "password" });
  const strength = passwordStrength(password);
  const bar = [
    "bg-red-500",
    "bg-red-500",
    "bg-amber-500",
    "bg-emerald-500",
    "bg-emerald-600",
  ][strength.score];

  const save = useMutation({
    mutationFn: async (values: ResetValues) => {
      const result = await resetPassword(values);
      if (!result.ok) {
        if (result.expired) router.refresh();
        throw new Error(result.message);
      }
    },
    onMutate: () => setError(null),
    onSuccess: () => setDone(true),
    onError: (e) => setError(e.message),
  });

  if (done) return <ResetDone />;

  const toggle = (
    <button
      type="button"
      onClick={() => setShow((s) => !s)}
      aria-label={show ? "Hide passwords" : "Show passwords"}
      className="absolute top-0 right-0 flex h-11 w-11 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
    >
      {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </button>
  );

  return (
    <AuthCard
      icon={<KeyRound className="size-6" />}
      title={`Choose a new password${firstName ? `, ${firstName}` : ""}`}
      description={
        <>
          For <span className="font-medium text-foreground">{email}</span>. Use
          at least 8 characters; a longer one with numbers and symbols is safer.
        </>
      }
      footer={<BackHome />}
    >
      <form
        onSubmit={form.handleSubmit((values) => save.mutate(values))}
        noValidate
        className="grid gap-4"
      >
        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="gap-1">
              <FieldLabel htmlFor="password">New password</FieldLabel>
              <div className="relative">
                <Input
                  {...field}
                  id="password"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  autoFocus
                  aria-invalid={fieldState.invalid}
                  className={cn(INPUT, "pr-11")}
                />
                {toggle}
              </div>
              {fieldState.invalid ? (
                <FieldError errors={[fieldState.error]} />
              ) : (
                password && (
                  <div
                    className="mt-1 flex items-center gap-2.5"
                    aria-live="polite"
                  >
                    <div className="flex flex-1 gap-1">
                      {[1, 2, 3, 4].map((step) => (
                        <span
                          key={step}
                          className={cn(
                            "h-1 flex-1 rounded-full transition-colors",
                            strength.score >= step ? bar : "bg-foreground/10",
                          )}
                        />
                      ))}
                    </div>
                    <span className="w-16 text-right text-xs font-medium text-muted-foreground">
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
            <Field data-invalid={fieldState.invalid} className="gap-1">
              <FieldLabel htmlFor="confirmPassword">
                Repeat new password
              </FieldLabel>
              <Input
                {...field}
                id="confirmPassword"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                aria-invalid={fieldState.invalid}
                className={INPUT}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        {error && (
          <p
            role="alert"
            className="text-center text-sm font-medium text-red-600 dark:text-red-400"
          >
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={save.isPending}
          className="mt-1 h-11 w-full cursor-pointer"
        >
          {save.isPending ? (
            <Loader2 className="animate-spin" />
          ) : (
            "Save new password"
          )}
        </Button>
      </form>
    </AuthCard>
  );
}

export function ResetDone() {
  return (
    <AuthCard
      icon={<ShieldCheck className="size-6" />}
      title="Your password is changed"
      description="For your safety we signed you out on every device. Sign in with your new password."
      footer={<BackHome />}
    >
      <Link
        href="/"
        className="flex h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
      >
        Back to the website to sign in
      </Link>
    </AuthCard>
  );
}

export function LinkProblem() {
  return (
    <AuthCard
      icon={<Link2Off className="size-6" />}
      title="This link doesn't work anymore"
      description={`Reset links work once, for ${RESET_TTL_MINUTES} minutes, and only the newest one. Ask for a new link and open it from the email.`}
      footer={<BackHome />}
    >
      <Link
        href="/forgot-password"
        className="flex h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
      >
        Ask for a new link
      </Link>
    </AuthCard>
  );
}
