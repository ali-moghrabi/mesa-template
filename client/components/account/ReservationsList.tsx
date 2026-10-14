"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  CalendarX2,
  Loader2,
  NotebookPen,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cancelReservation } from "@/lib/actions/reservations.actions";
import {
  RESERVATIONS_ROUTE,
  STATUS_META,
  downloadCalendar,
  formatDay,
  formatTime,
  guestsLabel,
  type MyReservations,
  type Reservation,
} from "@/lib/reservations";

type Props = {
  initial: MyReservations;
  bookingOn: boolean;
  timeFormat: "12h" | "24h";
  restaurant: { name: string; address: string };
};

export function ReservationsList({
  initial,
  bookingOn,
  timeFormat,
  restaurant,
}: Props) {
  const router = useRouter();
  const [cancelled, setCancelled] = useState<Reservation[]>([]);
  const [asking, setAsking] = useState<Reservation | null>(null);

  const gone = new Set(cancelled.map((r) => r.id));
  const upcoming = initial.upcoming.filter((r) => !gone.has(r.id));
  const past = [...cancelled, ...initial.past.filter((r) => !gone.has(r.id))];
  const empty = upcoming.length === 0 && past.length === 0;

  const onCancelled = (r: Reservation) => {
    setCancelled((list) => [r, ...list.filter((x) => x.id !== r.id)]);
    setAsking(null);
    toast.add({
      title: "Booking cancelled",
      description: `${formatDay(r.date)} at ${formatTime(r.time, timeFormat)}. Hope to see you another time!`,
      type: "success",
    });
    router.refresh();
  };

  return (
    <main className="min-h-svh bg-background pb-24 text-foreground [--pad:clamp(1rem,4vw,3rem)]">
      <div className="mx-auto max-w-4xl px-(--pad) pt-[calc(var(--nav-height,4.5rem)+1.75rem)]">
        <Link
          href="/account"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/60 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Your account
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Your reservations
            </h1>
            <p className="mt-1 text-foreground/60">
              Tables coming up, and the times you joined us.
            </p>
          </div>
          {bookingOn && !empty && (
            <Link
              href={RESERVATIONS_ROUTE}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90"
            >
              <CalendarDays className="size-4" /> Book a table
            </Link>
          )}
        </div>

        {empty ? (
          <div className="mt-10 flex flex-col items-center rounded-[calc(var(--radius)*2)] border border-dashed border-foreground/15 px-6 py-16 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-primary/10 text-primary">
              <CalendarDays className="size-7" />
            </span>
            <h2 className="mt-5 text-xl font-semibold">No bookings yet</h2>
            <p className="mt-1.5 max-w-sm text-pretty text-foreground/60">
              When you book a table, it shows up here so you can keep track of
              it or change your plans.
            </p>
            {bookingOn && (
              <Link
                href={RESERVATIONS_ROUTE}
                className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 font-semibold text-white"
              >
                Book a table <ArrowRight className="size-4" />
              </Link>
            )}
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-3 text-sm font-semibold tracking-wide text-foreground/55 uppercase">
                  Coming up
                </h2>
                <ul className="space-y-4">
                  {upcoming.map((r) => (
                    <li key={r.id}>
                      <UpcomingCard
                        reservation={r}
                        timeFormat={timeFormat}
                        onCalendar={() =>
                          downloadCalendar(
                            r,
                            restaurant.name,
                            restaurant.address,
                          )
                        }
                        onCancel={() => setAsking(r)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {past.length > 0 && (
              <section className="mt-10">
                <h2 className="mb-3 text-sm font-semibold tracking-wide text-foreground/55 uppercase">
                  Past
                </h2>
                <ul className="divide-y divide-foreground/8 overflow-hidden rounded-[calc(var(--radius)*2)] border border-foreground/10">
                  {past.map((r) => (
                    <PastRow
                      key={r.id}
                      reservation={r}
                      timeFormat={timeFormat}
                    />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>

      <CancelDialog
        reservation={asking}
        timeFormat={timeFormat}
        onClose={() => setAsking(null)}
        onDone={onCancelled}
      />
    </main>
  );
}

function DateTile({
  date,
  tone = "default",
}: {
  date: string;
  tone?: "default" | "muted";
}) {
  return (
    <span
      className={cn(
        "flex w-16 shrink-0 flex-col items-center self-start overflow-hidden rounded-2xl border text-center",
        tone === "default"
          ? "border-primary/25 bg-background"
          : "border-foreground/10 bg-muted/60 text-foreground/60",
      )}
    >
      <span
        className={cn(
          "w-full py-1 text-[11px] font-bold tracking-wider uppercase",
          tone === "default" ? "bg-primary text-white" : "bg-foreground/10",
        )}
      >
        {formatDay(date, { month: "short" })}
      </span>
      <span className="pt-1 text-2xl leading-none font-semibold tabular-nums">
        {Number(date.slice(8))}
      </span>
      <span className="pb-1.5 text-[11px] text-foreground/55">
        {formatDay(date, { weekday: "short" })}
      </span>
    </span>
  );
}

function StatusPill({ reservation: r }: { reservation: Reservation }) {
  const meta = STATUS_META[r.status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        meta.pill,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          meta.dot,
          r.status === "pending" && "animate-pulse",
        )}
      />
      {meta.label}
    </span>
  );
}

function UpcomingCard({
  reservation: r,
  timeFormat,
  onCalendar,
  onCancel,
}: {
  reservation: Reservation;
  timeFormat: "12h" | "24h";
  onCalendar: () => void;
  onCancel: () => void;
}) {
  const confirmed = r.status === "confirmed";
  return (
    <article
      className={cn(
        "overflow-hidden rounded-[calc(var(--radius)*2)] border bg-card transition-colors",
        confirmed
          ? "border-emerald-500/30 shadow-[0_18px_50px_-32px_rgb(16_185_129)]"
          : "border-primary/25 shadow-[0_18px_50px_-32px_var(--primary)]",
      )}
    >
      <div className="flex gap-4 p-5 sm:gap-5 sm:p-6">
        <DateTile date={r.date} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <p className="text-xl font-semibold tracking-tight tabular-nums">
              {formatTime(r.time, timeFormat)}
            </p>
            <StatusPill reservation={r} />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground/60">
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4" /> {guestsLabel(r.partySize)}
            </span>
            {r.occasion && (
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="size-4" /> {r.occasion}
              </span>
            )}
            <span>Booking #{r.number}</span>
          </p>
          {r.notes && (
            <p className="mt-2.5 flex items-start gap-1.5 text-sm text-foreground/70">
              <NotebookPen className="mt-0.5 size-4 shrink-0 text-foreground/45" />{" "}
              <span className="line-clamp-2">{r.notes}</span>
            </p>
          )}
          {r.status === "pending" && (
            <p className="mt-2.5 text-sm text-pretty text-foreground/55">
              We&apos;ll email you as soon as the team confirms your table.
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-foreground/8 bg-muted/40 px-5 py-3 sm:px-6">
        <button
          type="button"
          onClick={onCalendar}
          className="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium text-foreground/70 transition hover:bg-background hover:text-foreground"
        >
          <CalendarPlus className="size-4" /> Add to calendar
        </button>
        {r.canCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium text-destructive transition hover:bg-destructive/10"
          >
            <CalendarX2 className="size-4" /> Cancel booking
          </button>
        )}
      </div>
    </article>
  );
}

function PastRow({
  reservation: r,
  timeFormat,
}: {
  reservation: Reservation;
  timeFormat: "12h" | "24h";
}) {
  return (
    <li className="flex items-center gap-4 bg-card px-4 py-3.5 sm:px-5">
      <DateTile date={r.date} tone="muted" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {formatDay(r.date, {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          <span className="text-foreground/55">
            {" "}
            · {formatTime(r.time, timeFormat)}
          </span>
        </p>
        <p className="mt-0.5 truncate text-sm text-foreground/55">
          {guestsLabel(r.partySize)}
          {r.occasion && ` · ${r.occasion}`}
          {r.statusNote && ` · “${r.statusNote}”`}
        </p>
      </div>
      <StatusPill reservation={r} />
    </li>
  );
}

function CancelDialog({
  reservation: r,
  timeFormat,
  onClose,
  onDone,
}: {
  reservation: Reservation | null;
  timeFormat: "12h" | "24h";
  onClose: () => void;
  onDone: (r: Reservation) => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!r) return;
    setBusy(true);
    const result = await cancelReservation(r.id, reason);
    setBusy(false);
    if (!result.ok) {
      toast.add({
        title: "Couldn't cancel",
        description: result.message,
        type: "error",
      });
      return;
    }
    setReason("");
    onDone(result.data);
  };

  return (
    <AlertDialog
      open={r !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <AlertDialogContent className="text-left sm:max-w-md">
        <AlertDialogHeader>
          <span className="mx-auto mb-1 grid size-11 place-items-center rounded-2xl bg-destructive/10 text-destructive sm:mx-0">
            <CalendarX2 className="size-5" />
          </span>
          <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
          <AlertDialogDescription>
            {r && (
              <>
                Your table for {guestsLabel(r.partySize)} on{" "}
                <span className="font-medium text-foreground">
                  {formatDay(r.date, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </span>{" "}
                at {formatTime(r.time, timeFormat)} will be released.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground/70">
            Want to tell us why?{" "}
            <span className="font-normal text-foreground/45">Optional</span>
          </span>
          <textarea
            rows={2}
            maxLength={200}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Plans changed…"
            className="w-full resize-none rounded-xl border border-foreground/12 bg-background px-3.5 py-2.5 text-[15px] outline-none transition focus:border-primary/60 focus:ring-4 focus:ring-primary/15"
          />
        </label>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Keep it</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={() => void confirm()}
            disabled={busy}
            className="min-w-36"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {busy ? "Cancelling…" : "Cancel booking"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
