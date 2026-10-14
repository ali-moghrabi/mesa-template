"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Check, Loader2, RotateCcw, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { sendContactMessage } from "@/lib/actions/contact.actions";
import { MESSAGE_MAX, contactSchema, type ContactValues } from "@/lib/contact";

type Props = {
  subjects: string[];
  prefill?: { name: string; email: string; phone: string };
  responseNote: string;
  className?: string;
};

const FIELD =
  "w-full rounded-2xl border border-foreground/12 bg-background px-4 text-[15px] outline-none transition placeholder:text-foreground/40 focus:border-primary/60 focus:ring-4 focus:ring-primary/15 aria-invalid:border-destructive aria-invalid:focus:ring-destructive/15";

export function ContactForm({
  subjects,
  prefill,
  responseNote,
  className,
}: Props) {
  const empty: ContactValues = {
    name: prefill?.name ?? "",
    email: prefill?.email ?? "",
    phone: prefill?.phone ?? "",
    subject: subjects[0] ?? "",
    message: "",
    website: "",
  };
  const form = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: empty,
    mode: "onTouched",
  });
  const [subject, message] = useWatch({
    control: form.control,
    name: ["subject", "message"],
  });
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errors = form.formState.errors;
  const sending = form.formState.isSubmitting;

  const submit = async (values: ContactValues) => {
    setError(null);
    const result = await sendContactMessage(values);
    if (result.ok) {
      setSentTo(values.email);
      return;
    }
    for (const [field, text] of Object.entries(result.fieldErrors ?? {}))
      form.setError(field as keyof ContactValues, { message: text });
    setError(result.message);
  };

  if (sentTo) {
    return (
      <div
        role="status"
        className={cn(
          "flex flex-col items-center px-2 py-10 text-center animate-rise motion-reduce:animate-none",
          className,
        )}
      >
        <span className="relative grid size-18 place-items-center">
          <span
            aria-hidden="true"
            className="absolute inset-0 animate-ping rounded-full bg-emerald-500/20 repeat-2"
          />
          <span className="relative grid size-18 place-items-center rounded-full bg-emerald-500 text-white shadow-[0_16px_40px_-14px_rgb(16_185_129)]">
            <Check className="size-9" strokeWidth={2.5} />
          </span>
        </span>
        <h3 className="mt-6 text-2xl font-semibold tracking-tight">
          Message sent!
        </h3>
        <p className="mt-2 max-w-sm text-pretty text-foreground/65">
          Thank you for writing to us. {responseNote} We&apos;ll answer at{" "}
          <span className="font-medium text-foreground">{sentTo}</span>.
        </p>
        <button
          type="button"
          onClick={() => {
            form.reset({
              ...empty,
              name: form.getValues("name"),
              email: form.getValues("email"),
              phone: form.getValues("phone"),
            });
            setSentTo(null);
          }}
          className="mt-7 inline-flex h-11 items-center gap-2 rounded-xl border border-foreground/15 px-5 font-semibold transition hover:bg-muted"
        >
          <RotateCcw className="size-4" /> Send another message
        </button>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(e) => void form.handleSubmit(submit)(e)}
      className={cn("space-y-5", className)}
    >
      {subjects.length > 0 && (
        <fieldset>
          <legend className="mb-2.5 text-sm font-medium text-foreground/70">
            What&apos;s it about?
          </legend>
          <div role="radiogroup" className="flex flex-wrap gap-2">
            {subjects.map((s) => {
              const on = subject === s;
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => form.setValue("subject", s)}
                  className={cn(
                    "inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-all",
                    on
                      ? "border-primary bg-primary text-white shadow-[0_8px_20px_-10px_var(--primary)]"
                      : "border-foreground/12 hover:border-foreground/30",
                  )}
                >
                  {on && <Check className="size-3.5" />}
                  {s}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" error={errors.name?.message}>
          <input
            type="text"
            autoComplete="name"
            aria-invalid={errors.name ? true : undefined}
            {...form.register("name")}
            className={cn(FIELD, "h-12")}
          />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <input
            type="email"
            autoComplete="email"
            inputMode="email"
            aria-invalid={errors.email ? true : undefined}
            {...form.register("email")}
            className={cn(FIELD, "h-12")}
          />
        </Field>
        <Field
          label="Phone"
          hint="Optional"
          error={errors.phone?.message}
          className="sm:col-span-2"
        >
          <input
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="If you'd like us to call you back"
            aria-invalid={errors.phone ? true : undefined}
            {...form.register("phone")}
            className={cn(FIELD, "h-12")}
          />
        </Field>
      </div>

      <Field
        label="Message"
        error={errors.message?.message}
        counter={`${message.length}/${MESSAGE_MAX}`}
      >
        <textarea
          rows={6}
          maxLength={MESSAGE_MAX}
          placeholder="How can we help?"
          aria-invalid={errors.message ? true : undefined}
          {...form.register("message")}
          className={cn(FIELD, "min-h-40 resize-y py-3.5 leading-relaxed")}
        />
      </Field>

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
            {...form.register("website")}
          />
        </label>
      </div>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-destructive/25 bg-destructive/6 px-4 py-3 text-sm"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />{" "}
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse items-stretch gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-foreground/50">{responseNote}</p>
        <button
          type="submit"
          disabled={sending}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-7 font-semibold text-white shadow-[0_12px_30px_-14px_var(--primary)] transition hover:brightness-110 active:scale-[.98] disabled:opacity-60"
        >
          {sending ? (
            <Loader2 className="size-4.5 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          {sending ? "Sending…" : "Send message"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  counter,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  counter?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-medium text-foreground/70">
        {label}
        {hint && (
          <span className="text-xs font-normal text-foreground/45">{hint}</span>
        )}
      </span>
      {children}
      {(error || counter) && (
        <span className="mt-1.5 flex justify-between gap-3 text-sm">
          <span className="text-destructive">{error}</span>
          {counter && (
            <span className="shrink-0 text-xs text-foreground/40 tabular-nums">
              {counter}
            </span>
          )}
        </span>
      )}
    </label>
  );
}
