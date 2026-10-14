"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Lock,
  Minus,
  NotebookPen,
  Phone,
  Plus,
  RotateCcw,
  Sparkles,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { requestSignIn } from "@/lib/cart";
import {
  bookTable,
  refreshAvailability,
} from "@/lib/actions/reservations.actions";
import {
  MY_RESERVATIONS_ROUTE,
  NOTES_MAX,
  STATUS_META,
  bookingSchema,
  downloadCalendar,
  formatDay,
  formatTime,
  groupTimes,
  guestsLabel,
  relativeDay,
  type Availability,
  type AvailabilityDay,
  type BookingPrefill,
  type BookingValues,
  type Reservation,
} from "@/lib/reservations";

type Account = {
  firstName: string;
  name: string;
  email: string;
  phone: string;
};

type Props = {
  availability: Availability;
  signedIn: boolean;
  account: Account | null;
  prefill?: BookingPrefill;
  timeFormat: "12h" | "24h";
  restaurant: { name: string; phone: string; address: string };
  layout?: "inline" | "split";
};

const STALE_MS = 60_000;
const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const fits = (t: { left: number | null }, party: number) =>
  t.left === null || t.left >= party;
const bookable = (day: AvailabilityDay | undefined, party: number) =>
  Boolean(day?.times.some((t) => fits(t, party)));

function startingValues(
  a: Availability,
  prefill: BookingPrefill | undefined,
  phone: string,
): BookingValues {
  const { minPartySize: min, maxPartySize: max } = a.rules;
  const partySize = Math.min(
    max,
    Math.max(min, prefill?.party ?? Math.min(2, max)),
  );
  const asked = a.days.find((d) => d.date === prefill?.date);
  const day =
    asked && bookable(asked, partySize)
      ? asked
      : (a.days.find(
          (d) =>
            prefill?.date !== undefined &&
            d.date > prefill.date &&
            bookable(d, partySize),
        ) ?? a.days.find((d) => bookable(d, partySize)));
  const time =
    day &&
    prefill?.time &&
    day.times.some((t) => t.time === prefill.time && fits(t, partySize))
      ? prefill.time
      : "";
  return {
    partySize,
    date: day?.date ?? "",
    time,
    phone,
    occasion: "",
    notes: "",
  };
}

export function BookingForm({
  availability,
  signedIn,
  account,
  prefill,
  timeFormat,
  restaurant,
  layout = "inline",
}: Props) {
  const [fresh, setFresh] = useState<Availability | null>(null);
  const data = fresh ?? availability;
  const { rules } = data;

  const schema = useMemo(
    () => bookingSchema(rules.requirePhone),
    [rules.requirePhone],
  );
  const [start] = useState(() =>
    startingValues(availability, prefill, account?.phone ?? ""),
  );
  const [missed, setMissed] = useState(() =>
    prefill?.date && prefill.date !== start.date ? prefill.date : null,
  );
  const form = useForm<BookingValues>({
    resolver: zodResolver(schema),
    defaultValues: start,
    mode: "onTouched",
  });
  const [partySize, date, time, notes, occasion] = useWatch({
    control: form.control,
    name: ["partySize", "date", "time", "notes", "occasion"],
  });

  const [key, setKey] = useState(newKey);
  const [banner, setBanner] = useState<{
    message: string;
    conflict: boolean;
  } | null>(null);
  const [done, setDone] = useState<Reservation | null>(null);
  const submitting = form.formState.isSubmitting;
  const errors = form.formState.errors;

  const day = data.days.find((d) => d.date === date);

  const reload = async () => {
    const result = await refreshAvailability();
    if (result.ok) setFresh(result.data);
  };

  const hiddenAt = useRef<number | null>(null);
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt.current = Date.now();
      else if (hiddenAt.current && Date.now() - hiddenAt.current > STALE_MS) {
        hiddenAt.current = null;
        void refreshAvailability().then(
          (result) => result.ok && setFresh(result.data),
        );
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (account?.phone && !form.getValues("phone"))
      form.setValue("phone", account.phone);
  }, [account?.phone, form]);

  const pickParty = (n: number) => {
    form.setValue("partySize", n, { shouldValidate: true });
    const slot = day?.times.find((t) => t.time === time);
    if (slot && !fits(slot, n)) form.setValue("time", "");
    setBanner(null);
  };

  const pickDate = (next: string) => {
    form.setValue("date", next, { shouldValidate: true });
    setMissed(null);
    const same = data.days
      .find((d) => d.date === next)
      ?.times.find((t) => t.time === time);
    if (!same || !fits(same, partySize)) form.setValue("time", "");
    setBanner(null);
  };

  const pickTime = (next: string) => {
    form.setValue("time", next, { shouldValidate: true });
    setBanner(null);
  };

  const submit = async (values: BookingValues) => {
    if (!signedIn) return requestSignIn();
    setBanner(null);
    const result = await bookTable({ ...values, idempotencyKey: key });
    if (result.ok) {
      setDone(result.data);
      setKey(newKey());
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (result.status === 401) return requestSignIn();

    const fieldErrors = result.fieldErrors ?? {};
    for (const [field, message] of Object.entries(fieldErrors)) {
      if (
        field === "partySize" ||
        field === "date" ||
        field === "time" ||
        field === "phone" ||
        field === "occasion" ||
        field === "notes"
      )
        form.setError(field, { message });
    }
    if (fieldErrors.time) {
      await reload();
      form.setValue("time", "");
    }
    setBanner({ message: result.message, conflict: result.status === 409 });
  };

  const startOver = () => {
    setDone(null);
    setBanner(null);
    form.reset(
      startingValues(
        data,
        undefined,
        account?.phone ?? form.getValues("phone"),
      ),
    );
    void reload();
  };

  if (done)
    return (
      <Booked
        reservation={done}
        message={rules.confirmationMessage}
        timeFormat={timeFormat}
        restaurant={restaurant}
        onAgain={startOver}
        layout={layout}
      />
    );

  const anyDay = data.days.some((d) => bookable(d, partySize));
  const summary =
    date && time
      ? `${relativeDay(date, data.today)} · ${formatTime(time, timeFormat)} · ${guestsLabel(partySize)}`
      : null;

  return (
    <form
      noValidate
      onSubmit={(e) => void form.handleSubmit(submit)(e)}
      className={cn(
        "relative",
        layout === "inline" &&
          "rounded-[calc(var(--radius)*2.2)] border border-foreground/10 bg-card shadow-[0_30px_80px_-50px_rgba(0,0,0,.45)]",
      )}
    >
      <div
        className={cn("space-y-9", layout === "inline" ? "p-5 sm:p-8" : "py-1")}
      >
        <Step n={1} title="How many guests?" error={errors.partySize?.message}>
          <PartyPicker
            value={partySize}
            min={rules.minPartySize}
            max={rules.maxPartySize}
            onChange={pickParty}
          />
          <p className="mt-3 text-sm text-foreground/55">
            More than {rules.maxPartySize}?{" "}
            <a
              href={`tel:${restaurant.phone.replace(/[^+\d]/g, "")}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Call us
            </a>{" "}
            and we&apos;ll set something up.
          </p>
        </Step>

        <Step n={2} title="Pick a day" error={errors.date?.message}>
          {anyDay ? (
            <>
              <DayStrip
                days={data.days}
                today={data.today}
                party={partySize}
                value={date}
                onChange={pickDate}
                fade={layout === "inline" ? "from-card" : "from-background"}
              />
              {missed && (
                <MissedDay
                  date={missed}
                  data={data}
                  party={partySize}
                  shown={date}
                />
              )}
            </>
          ) : (
            <Empty>
              No tables for {guestsLabel(partySize)} in the next{" "}
              {rules.advanceDays} days. Try fewer guests, or call us at{" "}
              <a
                className="font-semibold text-foreground"
                href={`tel:${restaurant.phone.replace(/[^+\d]/g, "")}`}
              >
                {restaurant.phone}
              </a>
              .
            </Empty>
          )}
        </Step>

        <Step
          n={3}
          title="Choose a time"
          hint={
            day
              ? formatDay(day.date, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })
              : undefined
          }
          error={errors.time?.message}
        >
          {!day ? (
            <Empty>Pick a day first.</Empty>
          ) : day.closed ? (
            <Empty>
              We&apos;re closed on{" "}
              {formatDay(day.date, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
              . Pick another day.
            </Empty>
          ) : !bookable(day, partySize) ? (
            <Empty>
              No tables left for {guestsLabel(partySize)} that day. Try another
              day or fewer guests.
            </Empty>
          ) : (
            <TimeGrid
              times={day.times}
              party={partySize}
              value={time}
              format={timeFormat}
              onChange={pickTime}
            />
          )}
        </Step>

        <Step
          n={4}
          title={signedIn ? "Your details" : "Almost there"}
          muted={signedIn && !time}
        >
          {signedIn && account ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-2xl bg-muted/70 px-4 py-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/12 text-primary">
                    <UserRound className="size-5" />
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate font-semibold">
                      {account.name}
                    </span>
                    <span className="block truncate text-sm text-foreground/55">
                      {account.email}
                    </span>
                  </span>
                </div>
                <label className="block">
                  <span className="sr-only">Phone number</span>
                  <span className="relative block">
                    <Phone
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-foreground/45"
                    />
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder={
                        rules.requirePhone
                          ? "Phone number"
                          : "Phone number (optional)"
                      }
                      aria-invalid={errors.phone ? true : undefined}
                      {...form.register("phone")}
                      className={cn(
                        FIELD,
                        "h-full min-h-16 pl-11",
                        errors.phone &&
                          "border-destructive focus:ring-destructive/25",
                      )}
                    />
                  </span>
                  {errors.phone && (
                    <span className="mt-1.5 block text-sm text-destructive">
                      {errors.phone.message}
                    </span>
                  )}
                </label>
              </div>

              {rules.occasions.length > 0 && (
                <fieldset>
                  <legend className="mb-2.5 flex items-center gap-2 text-sm font-medium text-foreground/70">
                    <Sparkles className="size-4 text-primary" /> Celebrating
                    something?{" "}
                    <span className="font-normal text-foreground/45">
                      Optional
                    </span>
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {rules.occasions.map((o) => {
                      const on = occasion === o;
                      return (
                        <button
                          key={o}
                          type="button"
                          aria-pressed={on}
                          onClick={() => form.setValue("occasion", on ? "" : o)}
                          className={cn(
                            "inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-all",
                            on
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-foreground/12 hover:border-foreground/30",
                          )}
                        >
                          {on && <Check className="size-3.5" />}
                          {o}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              {rules.allowSpecialRequests && (
                <label className="block">
                  <span className="mb-2.5 flex items-center gap-2 text-sm font-medium text-foreground/70">
                    <NotebookPen className="size-4 text-primary" /> Anything we
                    should know?{" "}
                    <span className="font-normal text-foreground/45">
                      Optional
                    </span>
                  </span>
                  <textarea
                    rows={3}
                    maxLength={NOTES_MAX}
                    placeholder="Allergies, a high chair, a quiet corner…"
                    {...form.register("notes")}
                    className={cn(
                      FIELD,
                      "min-h-24 resize-y py-3",
                      errors.notes && "border-destructive",
                    )}
                  />
                  <span className="mt-1 flex justify-between text-xs text-foreground/45">
                    <span className="text-destructive">
                      {errors.notes?.message}
                    </span>
                    <span className="tabular-nums">
                      {notes.length}/{NOTES_MAX}
                    </span>
                  </span>
                </label>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-start gap-4 rounded-2xl border border-dashed border-primary/35 bg-primary/4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/12 text-primary">
                  <Lock className="size-4.5" />
                </span>
                <div>
                  <p className="font-semibold">Sign in to send your request</p>
                  <p className="mt-0.5 text-sm text-pretty text-foreground/60">
                    So we can confirm by email and you can manage your booking.
                    Your choices stay as they are.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={requestSignIn}
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
              >
                Sign in <ArrowRight className="size-4" />
              </button>
            </div>
          )}
        </Step>

        {banner && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-destructive/25 bg-destructive/6 p-4 text-sm"
          >
            <AlertTriangle className="mt-0.5 size-4.5 shrink-0 text-destructive" />
            <div>
              <p className="font-medium">{banner.message}</p>
              {banner.conflict && (
                <Link
                  href={MY_RESERVATIONS_ROUTE}
                  className="mt-1 inline-flex items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline"
                >
                  Open My reservations <ArrowRight className="size-3.5" />
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      <div
        className={cn(
          "sticky bottom-3 z-10 mt-2 sm:static",
          layout === "inline"
            ? "px-3 pb-3 sm:border-t sm:border-foreground/10 sm:px-8 sm:py-5"
            : "pb-1 sm:mt-8 sm:border-t sm:border-foreground/10 sm:pt-6",
        )}
      >
        <div className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-background/90 p-2.5 pl-4 shadow-[0_18px_40px_-20px_rgba(0,0,0,.5)] backdrop-blur-md sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none">
          <div className="min-w-0 flex-1 leading-tight">
            <p
              className={cn(
                "flex items-center gap-2 truncate font-semibold",
                !summary && "text-foreground/45",
              )}
            >
              <CalendarCheck
                className={cn(
                  "size-4.5 shrink-0",
                  summary ? "text-primary" : "text-foreground/35",
                )}
              />
              <span className="truncate">{summary ?? "Pick a time"}</span>
            </p>
            <p className="mt-0.5 hidden text-sm text-foreground/50 sm:block">
              We confirm every booking by email. Free to cancel online.
            </p>
          </div>
          <button
            type="submit"
            disabled={submitting || (signedIn && !time)}
            className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-white shadow-[0_10px_30px_-12px_var(--primary)] transition-all hover:brightness-110 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none sm:h-13 sm:px-7"
          >
            {submitting ? (
              <Loader2 className="size-4.5 animate-spin" />
            ) : !signedIn ? (
              <Lock className="size-4" />
            ) : null}
            {submitting
              ? "Sending…"
              : signedIn
                ? "Request table"
                : "Sign in to book"}
          </button>
        </div>
      </div>
    </form>
  );
}

const FIELD =
  "w-full rounded-2xl border border-foreground/12 bg-background px-4 text-[15px] outline-none transition placeholder:text-foreground/40 focus:border-primary/60 focus:ring-4 focus:ring-primary/15";

function Step({
  n,
  title,
  hint,
  error,
  muted,
  children,
}: {
  n: number;
  title: string;
  hint?: string;
  error?: string;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`step-${n}`}
      className={cn("transition-opacity duration-300", muted && "opacity-55")}
    >
      <header className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          aria-hidden="true"
          className="grid size-7 -translate-y-px place-items-center self-center rounded-full bg-foreground text-[13px] font-bold text-background"
        >
          {n}
        </span>
        <h3 id={`step-${n}`} className="text-lg font-semibold tracking-tight">
          {title}
        </h3>
        {hint && <span className="text-sm text-foreground/50">{hint}</span>}
      </header>
      {children}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </section>
  );
}

function MissedDay({
  date,
  data,
  party,
  shown,
}: {
  date: string;
  data: Availability;
  party: number;
  shown: string;
}) {
  const asked = data.days.find((d) => d.date === date);
  const reason = !asked
    ? date < data.today
      ? "That date has passed."
      : `We take bookings up to ${data.rules.advanceDays} days ahead.`
    : asked.closed
      ? "We're closed that day."
      : asked.times.length === 0
        ? "There are no times left that day."
        : `No tables left for ${guestsLabel(party)} that day.`;
  return (
    <p
      role="status"
      className="mt-2 flex items-start gap-2.5 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-pretty text-amber-900 dark:text-amber-200"
    >
      <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>
        <span className="font-semibold">
          {formatDay(date, { weekday: "long", day: "numeric", month: "long" })}
        </span>{" "}
        isn&apos;t available. {reason}
        {shown && (
          <>
            {" "}
            We picked the closest day with a table,{" "}
            {formatDay(shown, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
            .
          </>
        )}
      </span>
    </p>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl bg-muted/70 px-4 py-5 text-[15px] text-pretty text-foreground/65">
      {children}
    </p>
  );
}

function PartyPicker({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const count = max - min + 1;
  if (count > 12) {
    return (
      <div className="inline-flex items-center gap-2 rounded-2xl border border-foreground/12 p-1.5">
        <button
          type="button"
          aria-label="Fewer guests"
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
          className="grid size-11 place-items-center rounded-xl transition hover:bg-muted disabled:opacity-35"
        >
          <Minus className="size-4" />
        </button>
        <span
          className="min-w-28 text-center text-lg font-semibold tabular-nums"
          aria-live="polite"
        >
          {guestsLabel(value)}
        </span>
        <button
          type="button"
          aria-label="More guests"
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
          className="grid size-11 place-items-center rounded-xl transition hover:bg-muted disabled:opacity-35"
        >
          <Plus className="size-4" />
        </button>
      </div>
    );
  }
  return (
    <div
      role="radiogroup"
      aria-label="Guests"
      className="grid grid-cols-5 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(3.25rem,1fr))]"
    >
      {Array.from({ length: count }, (_, i) => min + i).map((n) => {
        const on = n === value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={guestsLabel(n)}
            onClick={() => onChange(n)}
            className={cn(
              "relative grid h-13 place-items-center rounded-2xl border text-lg font-semibold tabular-nums transition-all",
              on
                ? "border-primary bg-primary text-white shadow-[0_10px_24px_-12px_var(--primary)]"
                : "border-foreground/12 hover:-translate-y-0.5 hover:border-foreground/30",
            )}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

function DayStrip({
  days,
  today,
  party,
  value,
  onChange,
  fade,
}: {
  days: AvailabilityDay[];
  today: string;
  party: number;
  value: string;
  onChange: (d: string) => void;
  fade: string;
}) {
  const strip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = strip.current;
    const chosen = box?.querySelector<HTMLElement>("[data-chosen]");
    if (!box || !chosen) return;
    const target =
      chosen.offsetLeft - box.clientWidth / 2 + chosen.clientWidth / 2;
    box.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [value]);

  const scroll = (direction: 1 | -1) =>
    strip.current?.scrollBy({
      left: direction * strip.current.clientWidth * 0.8,
      behavior: "smooth",
    });

  return (
    <div className="relative -mx-1">
      <div
        ref={strip}
        role="radiogroup"
        aria-label="Day"
        className="flex snap-x gap-2 overflow-x-auto scroll-smooth px-1 pt-1 pb-3 scrollbar-none [&::-webkit-scrollbar]:hidden"
      >
        {days.map((d, i) => {
          const open = bookable(d, party);
          const on = d.date === value;
          const label = relativeDay(d.date, today);
          const weekday =
            label === "Today" || label === "Tomorrow"
              ? label
              : formatDay(d.date, { weekday: "short" });
          const newMonth = i === 0 || d.date.endsWith("-01");
          return (
            <button
              key={d.date}
              type="button"
              role="radio"
              aria-checked={on}
              data-chosen={on ? "" : undefined}
              disabled={!open}
              aria-label={`${formatDay(d.date, { weekday: "long", day: "numeric", month: "long" })}${open ? "" : d.closed ? ", closed" : ", no tables"}`}
              onClick={() => onChange(d.date)}
              className={cn(
                "flex w-[4.9rem] shrink-0 snap-start flex-col items-center rounded-2xl border px-1 pt-2.5 pb-2 transition-all",
                on
                  ? "border-foreground bg-foreground text-background"
                  : open
                    ? "border-foreground/12 hover:-translate-y-0.5 hover:border-foreground/30"
                    : "cursor-not-allowed border-transparent bg-muted/60 text-foreground/35",
              )}
            >
              <span
                className={cn(
                  "text-[11px] font-semibold uppercase",
                  weekday.length > 5 ? "tracking-normal" : "tracking-wide",
                  on ? "text-background/70" : "text-foreground/50",
                  !open && "text-foreground/30",
                )}
              >
                {weekday}
              </span>
              <span className="mt-0.5 text-2xl leading-none font-semibold tabular-nums">
                {Number(d.date.slice(8))}
              </span>
              <span
                className={cn(
                  "mt-1 text-[11px]",
                  on ? "text-background/70" : "text-foreground/45",
                )}
              >
                {open
                  ? newMonth
                    ? formatDay(d.date, { month: "short" })
                    : " "
                  : d.closed
                    ? "Closed"
                    : "Full"}
              </span>
            </button>
          );
        })}
      </div>
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l to-transparent",
          fade,
        )}
      />
      <div className="absolute -top-12 right-1 hidden gap-1.5 sm:flex">
        <button
          type="button"
          aria-label="Earlier days"
          onClick={() => scroll(-1)}
          className="grid size-9 place-items-center rounded-full border border-foreground/12 transition hover:bg-muted"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Later days"
          onClick={() => scroll(1)}
          className="grid size-9 place-items-center rounded-full border border-foreground/12 transition hover:bg-muted"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

function TimeGrid({
  times,
  party,
  value,
  format,
  onChange,
}: {
  times: AvailabilityDay["times"];
  party: number;
  value: string;
  format: "12h" | "24h";
  onChange: (t: string) => void;
}) {
  return (
    <div className="space-y-5">
      {groupTimes(times).map((group) => (
        <div key={group.label}>
          <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-foreground/45 uppercase">
            {group.label}
          </p>
          <div
            role="radiogroup"
            aria-label={group.label}
            className="grid grid-cols-3 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))]"
          >
            {group.times.map((t) => {
              const ok = fits(t, party);
              const on = t.time === value;
              const few = ok && t.left !== null && t.left - party < 4;
              return (
                <button
                  key={t.time}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={!ok}
                  aria-label={`${formatTime(t.time, format)}${!ok ? ", full" : few ? ", few seats left" : ""}`}
                  onClick={() => onChange(t.time)}
                  className={cn(
                    "relative h-12 rounded-xl border text-[15px] font-semibold tabular-nums transition-all",
                    on
                      ? "border-primary bg-primary text-white shadow-[0_10px_24px_-12px_var(--primary)]"
                      : ok
                        ? "border-foreground/12 hover:border-primary/50 hover:text-primary"
                        : "cursor-not-allowed border-transparent bg-muted/60 text-foreground/30 line-through",
                  )}
                >
                  {formatTime(t.time, format)}
                  {few && !on && (
                    <span
                      aria-hidden="true"
                      className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-amber-500"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Booked({
  reservation: r,
  message,
  timeFormat,
  restaurant,
  onAgain,
  layout,
}: {
  reservation: Reservation;
  message: string;
  timeFormat: "12h" | "24h";
  restaurant: Props["restaurant"];
  onAgain: () => void;
  layout: "inline" | "split";
}) {
  const status = STATUS_META[r.status];
  return (
    <div
      role="status"
      className={cn(
        "animate-rise text-center motion-reduce:animate-none",
        layout === "inline" &&
          "rounded-[calc(var(--radius)*2.2)] border border-foreground/10 bg-card p-6 shadow-[0_30px_80px_-50px_rgba(0,0,0,.45)] sm:p-10",
      )}
    >
      <span className="relative mx-auto grid size-18 place-items-center">
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-ping rounded-full bg-emerald-500/20 repeat-2"
        />
        <span className="relative grid size-18 place-items-center rounded-full bg-emerald-500 text-white shadow-[0_16px_40px_-14px_rgb(16_185_129)]">
          <Check className="size-9" strokeWidth={2.5} />
        </span>
      </span>
      <p className="mt-6 text-xs font-semibold tracking-[0.18em] text-primary uppercase">
        Booking #{r.number}
      </p>
      <h3 className="mt-2 text-3xl font-semibold tracking-tight">
        Request sent!
      </h3>
      <p className="mx-auto mt-2 max-w-md text-pretty text-foreground/65">
        {message}
      </p>

      <div className="mx-auto mt-8 max-w-md overflow-hidden rounded-3xl border border-foreground/10 text-left">
        <div className="flex items-center justify-between gap-3 bg-muted/70 px-5 py-4">
          <div>
            <p className="text-sm text-foreground/55">
              {formatDay(r.date, { weekday: "long" })}
            </p>
            <p className="text-xl font-semibold">
              {formatDay(r.date, {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <p className="text-3xl font-semibold tabular-nums">
            {formatTime(r.time, timeFormat)}
          </p>
        </div>
        <dl className="divide-y divide-foreground/8 px-5 text-[15px]">
          <Row label="Guests" value={guestsLabel(r.partySize)} />
          {r.occasion && <Row label="Occasion" value={r.occasion} />}
          <Row label="Name" value={r.name} />
          <Row
            label="Status"
            value={
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                  status.pill,
                )}
              >
                <span className={cn("size-1.5 rounded-full", status.dot)} />{" "}
                {status.label}
              </span>
            }
          />
        </dl>
      </div>

      <div className="mt-8 flex flex-col justify-center gap-2.5 sm:flex-row">
        <Link
          href={MY_RESERVATIONS_ROUTE}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 font-semibold text-white transition hover:brightness-110"
        >
          My reservations <ArrowRight className="size-4" />
        </Link>
        <button
          type="button"
          onClick={() =>
            downloadCalendar(r, restaurant.name, restaurant.address)
          }
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-foreground/15 px-5 font-semibold transition hover:bg-muted"
        >
          <CalendarPlus className="size-4" /> Add to calendar
        </button>
        <button
          type="button"
          onClick={onAgain}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl px-4 font-medium text-foreground/65 transition hover:text-foreground"
        >
          <RotateCcw className="size-4" /> Book another
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-foreground/55">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
