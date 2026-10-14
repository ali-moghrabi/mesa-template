"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Clock,
  Footprints,
  Globe,
  History,
  Loader2,
  Mail,
  MessageCircle,
  NotebookPen,
  Pencil,
  Phone,
  PhoneCall,
  Sparkles,
  Table2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatDay,
  formatTime,
  guestsLabel,
  type ReservationStatus,
} from "@/lib/reservations";
import {
  ADMIN_STATUS,
  CLOSING,
  FIELD_FROM_API,
  PRIMARY_MOVE,
  RESERVATIONS_ROOT,
  SOURCE_LABEL,
  dayLabel,
  detailsSchema,
  initials,
  isUndo,
  moveLabel,
  reservationKey,
  type AdminReservation,
  type AdminReservationDetail,
  type DetailsValues,
} from "@/admin/lib/reservations";
import {
  changeReservationStatus,
  createReservation,
  fetchReservation,
  saveReservationNote,
  updateReservation,
} from "@/admin/lib/reservations.actions";

export type Shared = {
  timeFormat: "12h" | "24h";
  timezone: string;
  today: string;
  occasions: string[];
  canManage: boolean;
};

const unwrap = async <T,>(
  p: Promise<{ ok: true; data: T } | { ok: false; message: string }>,
): Promise<T> => {
  const r = await p;
  if (!r.ok) throw new Error(r.message);
  return r.data;
};

export type MoveInput = {
  reservation: Pick<AdminReservation, "id" | "version" | "name">;
  status: ReservationStatus;
  reason?: string;
  notify?: boolean;
};

export function useMoveReservation(
  onDone?: (r: AdminReservationDetail) => void,
) {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: ({ reservation, status, reason, notify }: MoveInput) =>
      unwrap(
        changeReservationStatus(reservation.id, {
          status,
          version: reservation.version,
          reason,
          notify,
        }),
      ),
    onSuccess: (detail, { status }) => {
      queryClient.setQueryData(reservationKey(detail.id), detail);
      void queryClient.invalidateQueries({ queryKey: RESERVATIONS_ROOT });
      router.refresh(); // the sidebar's request count
      toast.add({
        title: `${detail.name}: ${ADMIN_STATUS[status].label.toLowerCase()}`,
        type: "success",
      });
      onDone?.(detail);
    },
    onError: (error) => {
      toast.add({
        title: "Couldn't update the booking",
        description: error.message,
        type: "error",
      });
      void queryClient.invalidateQueries({ queryKey: RESERVATIONS_ROOT });
    },
  });
}

type Props = {
  open: string | null;
  onClose: () => void;
  onOpened: (id: string) => void;
  onAskReason: (r: AdminReservation, status: ReservationStatus) => void;
  shared: Shared;
};

export function ReservationPanel({
  open,
  onClose,
  onOpened,
  onAskReason,
  shared,
}: Props) {
  const [editing, setEditing] = useState(false);
  const creating = open === "new";
  const id = open && !creating ? open : null;

  const query = useQuery({
    queryKey: reservationKey(id ?? "none"),
    queryFn: () => unwrap(fetchReservation(id!)),
    enabled: id !== null,
    refetchInterval: 60_000,
  });
  const move = useMoveReservation();
  const data = query.data;

  const close = () => {
    setEditing(false);
    onClose();
  };

  return (
    <Sheet open={open !== null} onOpenChange={(o) => !o && close()}>
      <SheetContent
        side="right"
        className="flex w-full! max-w-none! flex-col gap-0 p-0 data-[side=right]:w-full! sm:w-[min(640px,92vw)]! sm:max-w-[min(640px,92vw)]! data-[side=right]:sm:max-w-[min(640px,92vw)]!"
      >
        {creating ? (
          <Editor
            mode="create"
            shared={shared}
            onCancel={close}
            onSaved={(r) => onOpened(r.id)}
          />
        ) : !data ? (
          <div className="grid flex-1 place-items-center p-8 text-center">
            <SheetHeader className="sr-only">
              <SheetTitle>Booking</SheetTitle>
              <SheetDescription>Loading the booking</SheetDescription>
            </SheetHeader>
            {query.isError ? (
              <div>
                <AlertTriangle className="mx-auto size-8 text-destructive" />
                <p className="mt-3 font-medium">{query.error.message}</p>
                <button
                  type="button"
                  onClick={() => void query.refetch()}
                  className="mt-4 h-9 rounded-lg border border-border px-4 text-sm font-medium"
                >
                  Try again
                </button>
              </div>
            ) : (
              <Loader2 className="size-7 animate-spin text-muted-foreground" />
            )}
          </div>
        ) : editing ? (
          <Editor
            mode="edit"
            reservation={data}
            shared={shared}
            onCancel={() => setEditing(false)}
            onSaved={() => setEditing(false)}
          />
        ) : (
          <>
            <PanelHeader
              reservation={data}
              shared={shared}
              onEdit={shared.canManage ? () => setEditing(true) : undefined}
            />
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="space-y-4 p-5 sm:p-6">
                {data.statusNote &&
                  (data.status === "declined" ||
                    data.status === "cancelled") && (
                    <p className="flex items-start gap-2.5 rounded-xl bg-muted px-4 py-3 text-sm">
                      <X className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span>
                        <span className="font-medium">
                          {ADMIN_STATUS[data.status].label}:
                        </span>{" "}
                        {data.statusNote}
                      </span>
                    </p>
                  )}
                <BookingCard reservation={data} shared={shared} />
                <GuestCard reservation={data} />
                {data.notes && (
                  <Card
                    title="From the guest"
                    icon={<NotebookPen className="size-4" />}
                  >
                    <p className="rounded-lg bg-amber-500/12 px-3 py-2 text-[15px] font-medium text-amber-900 dark:text-amber-200">
                      “{data.notes}”
                    </p>
                  </Card>
                )}
                <StaffNote reservation={data} canEdit={shared.canManage} />
                <Timeline reservation={data} shared={shared} />
              </div>
            </div>
            {shared.canManage && data.moves.length > 0 && (
              <ActionBar
                reservation={data}
                pending={move.isPending}
                onMove={(status) =>
                  CLOSING.includes(status)
                    ? onAskReason(data, status)
                    : move.mutate({ reservation: data, status })
                }
              />
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function PanelHeader({
  reservation: r,
  shared,
  onEdit,
}: {
  reservation: AdminReservationDetail;
  shared: Shared;
  onEdit?: () => void;
}) {
  const status = ADMIN_STATUS[r.status];
  return (
    <SheetHeader className="border-b border-border px-5 py-4 text-left sm:px-6">
      <div className="flex items-start gap-3.5 pr-8">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/12 text-base font-bold text-primary">
          {initials(r.name)}
        </span>
        <div className="min-w-0 flex-1">
          <SheetTitle className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight">
            <span className="truncate">{r.name}</span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-normal",
                status.pill,
              )}
            >
              <span className={cn("size-1.5 rounded-full", status.dot)} />
              {status.label}
            </span>
          </SheetTitle>
          <SheetDescription className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="tabular-nums">#{r.number}</span>
            <span className="inline-flex items-center gap-1">
              <SourceIcon source={r.source} className="size-3.5" />{" "}
              {SOURCE_LABEL[r.source]}
            </span>
            <span>
              {dayLabel(r.date, shared.today, {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </span>
          </SheetDescription>
        </div>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Pencil className="size-3.5" /> Edit
          </button>
        )}
      </div>
    </SheetHeader>
  );
}

export function SourceIcon({
  source,
  className,
}: {
  source: AdminReservation["source"];
  className?: string;
}) {
  const Icon =
    source === "phone" ? PhoneCall : source === "walk_in" ? Footprints : Globe;
  return <Icon aria-hidden="true" className={className} />;
}

function Card({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          {icon}
          {title}
        </h3>
        {action}
      </header>
      {children}
    </section>
  );
}

function BookingCard({
  reservation: r,
  shared,
}: {
  reservation: AdminReservationDetail;
  shared: Shared;
}) {
  const tiles = [
    { icon: CalendarDays, label: "Date", value: formatDay(r.date) },
    {
      icon: Clock,
      label: "Time",
      value: formatTime(r.time, shared.timeFormat),
    },
    { icon: Users, label: "Guests", value: String(r.partySize) },
    { icon: Table2, label: "Table", value: r.table || "Not set" },
  ];
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="bg-card px-4 py-3.5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <t.icon className="size-3.5" /> {t.label}
            </p>
            <p
              className={cn(
                "mt-1 truncate text-lg font-semibold tabular-nums",
                t.value === "Not set" &&
                  "text-base font-medium text-muted-foreground",
              )}
            >
              {t.value}
            </p>
          </div>
        ))}
      </div>
      {r.occasion && (
        <p className="flex items-center gap-2 border-t border-border bg-primary/5 px-4 py-2.5 text-sm font-medium">
          <Sparkles className="size-4 text-primary" /> {r.occasion}
        </p>
      )}
    </section>
  );
}

function GuestCard({
  reservation: r,
}: {
  reservation: AdminReservationDetail;
}) {
  const g = r.guest;
  const digits = r.phone.replace(/[^\d]/g, "");
  return (
    <Card title="Guest" icon={<UserRound className="size-4" />}>
      <div className="flex flex-wrap gap-1.5">
        {g.total <= 1 ? (
          <Badge tone="primary">First booking</Badge>
        ) : (
          <Badge tone={g.visits >= 3 ? "primary" : "muted"}>
            {g.visits} {g.visits === 1 ? "visit" : "visits"}
            {g.visits >= 3 && " · regular"}
          </Badge>
        )}
        {g.noShows > 0 && (
          <Badge tone="danger">
            {g.noShows} {g.noShows === 1 ? "no-show" : "no-shows"}
          </Badge>
        )}
        {g.cancelled > 0 && <Badge tone="muted">{g.cancelled} cancelled</Badge>}
        {g.lastVisit && (
          <Badge tone="muted">
            Last visit{" "}
            {new Intl.DateTimeFormat("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
              timeZone: "UTC",
            }).format(new Date(`${g.lastVisit}T12:00:00Z`))}
          </Badge>
        )}
        {!r.hasAccount && <Badge tone="muted">No account</Badge>}
      </div>
      <dl className="mt-3 space-y-2 text-[15px]">
        {r.phone && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <dt className="sr-only">Phone</dt>
            <dd className="flex items-center gap-2 font-medium tabular-nums">
              <Phone className="size-4 text-muted-foreground" /> {r.phone}
            </dd>
            <dd className="flex gap-1.5">
              <a
                href={`tel:${r.phone.replace(/[^+\d]/g, "")}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-semibold transition-colors hover:bg-muted"
              >
                <PhoneCall className="size-3.5" /> Call
              </a>
              {digits.length >= 7 && (
                <a
                  href={`https://wa.me/${digits}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-semibold transition-colors hover:bg-muted"
                >
                  <MessageCircle className="size-3.5" /> WhatsApp
                </a>
              )}
            </dd>
          </div>
        )}
        {r.email && (
          <div className="flex items-center gap-2">
            <dt className="sr-only">Email</dt>
            <dd className="flex min-w-0 items-center gap-2">
              <Mail className="size-4 shrink-0 text-muted-foreground" />
              <a
                href={`mailto:${r.email}`}
                className="truncate underline-offset-4 hover:underline"
              >
                {r.email}
              </a>
            </dd>
          </div>
        )}
        {!r.phone && !r.email && (
          <p className="text-sm text-muted-foreground">No contact details.</p>
        )}
      </dl>
    </Card>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "primary" | "muted" | "danger";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        tone === "primary" && "bg-primary/12 text-primary",
        tone === "muted" && "bg-muted text-muted-foreground",
        tone === "danger" && "bg-rose-500/12 text-rose-700 dark:text-rose-300",
      )}
    >
      {children}
    </span>
  );
}

function StaffNote({
  reservation: r,
  canEdit,
}: {
  reservation: AdminReservationDetail;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (note: string) => unwrap(saveReservationNote(r.id, note)),
    onSuccess: (detail) => {
      queryClient.setQueryData(reservationKey(detail.id), detail);
      void queryClient.invalidateQueries({ queryKey: RESERVATIONS_ROOT });
      setDraft(null);
      toast.add({ title: "Note saved", type: "success" });
    },
    onError: (error) =>
      toast.add({
        title: "Couldn't save the note",
        description: error.message,
        type: "error",
      }),
  });

  if (!canEdit && !r.staffNote) return null;
  const value = draft ?? r.staffNote;
  const dirty = draft !== null && draft !== r.staffNote;

  return (
    <Card title="Team note" icon={<NotebookPen className="size-4" />}>
      {canEdit ? (
        <>
          <textarea
            rows={2}
            maxLength={1000}
            value={value}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Only the team sees this. Allergy confirmed, prefers the terrace…"
            className="w-full resize-y rounded-xl border border-input bg-transparent px-3 py-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          {dirty && (
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="h-8 rounded-lg px-3 text-sm text-muted-foreground hover:text-foreground"
              >
                Discard
              </button>
              <button
                type="button"
                disabled={save.isPending}
                onClick={() => save.mutate(value)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-foreground px-3 text-sm font-semibold text-background disabled:opacity-60"
              >
                {save.isPending && (
                  <Loader2 className="size-3.5 animate-spin" />
                )}{" "}
                Save note
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="text-[15px] whitespace-pre-wrap">{r.staffNote}</p>
      )}
    </Card>
  );
}

const EVENT_LABEL: Record<string, string> = { edited: "Details changed" };

function Timeline({
  reservation: r,
  shared,
}: {
  reservation: AdminReservationDetail;
  shared: Shared;
}) {
  const clock = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: shared.timezone,
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: shared.timeFormat === "12h" ? "h12" : "h23",
    }).format(new Date(iso));
  const events = [...r.history].reverse();
  return (
    <Card title="History" icon={<History className="size-4" />}>
      <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-1.25 before:w-px before:bg-border">
        {events.map((e, i) => {
          const meta = ADMIN_STATUS[e.status as ReservationStatus];
          return (
            <li key={`${e.at}-${i}`} className="relative flex gap-3 pl-0">
              <span
                className={cn(
                  "relative z-10 mt-1.5 size-2.75 shrink-0 rounded-full ring-4 ring-card",
                  meta?.dot ?? "bg-foreground/40",
                )}
              />
              <div className="min-w-0 text-sm">
                <p className="font-medium">
                  {EVENT_LABEL[e.status] ?? meta?.label ?? e.status}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · {clock(e.at)}
                    {e.by
                      ? ` · ${e.by}`
                      : e.status === "pending"
                        ? " · guest"
                        : ""}
                  </span>
                </p>
                {e.note && (
                  <p className="mt-0.5 text-muted-foreground">{e.note}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function ActionBar({
  reservation: r,
  pending,
  onMove,
}: {
  reservation: AdminReservationDetail;
  pending: boolean;
  onMove: (s: ReservationStatus) => void;
}) {
  const primary = PRIMARY_MOVE[r.status];
  const main =
    primary && r.moves.includes(primary)
      ? primary
      : r.moves.find((m) => !isUndo(r.status, m) && !CLOSING.includes(m));
  const others = r.moves.filter((m) => m !== main);
  return (
    <div className="border-t border-border bg-background/95 px-5 py-3.5 backdrop-blur sm:px-6">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        {others.map((m) => (
          <button
            key={m}
            type="button"
            disabled={pending}
            onClick={() => onMove(m)}
            className={cn(
              "inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border px-4 text-sm font-semibold transition-colors disabled:opacity-60",
              CLOSING.includes(m) || m === "no_show"
                ? "border-destructive/25 text-destructive hover:bg-destructive/8"
                : isUndo(r.status, m)
                  ? "border-transparent text-muted-foreground hover:text-foreground"
                  : "border-border hover:bg-muted",
            )}
          >
            {moveLabel(r.status, m)}
          </button>
        ))}
        {main && (
          <button
            type="button"
            disabled={pending}
            onClick={() => onMove(main)}
            className="col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-white shadow-[0_10px_24px_-14px_var(--primary)] transition hover:brightness-110 disabled:opacity-60 sm:ml-auto"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            {moveLabel(r.status, main)}
          </button>
        )}
      </div>
    </div>
  );
}

export function ReasonDialog({
  target,
  onClose,
}: {
  target: { reservation: AdminReservation; status: ReservationStatus } | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const move = useMoveReservation(() => {
    setReason("");
    onClose();
  });
  const r = target?.reservation;
  const declining = target?.status === "declined";

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(o) => !o && !move.isPending && onClose()}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {declining ? "Decline this request?" : "Cancel this booking?"}
          </DialogTitle>
          <DialogDescription>
            {r && (
              <>
                {r.name}, {guestsLabel(r.partySize)} on{" "}
                {formatDay(r.date, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}{" "}
                at {r.time}.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">
            Reason for the guest{" "}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </span>
          <textarea
            rows={3}
            maxLength={200}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              declining
                ? "We're fully booked at that time. Could you come at 21:00?"
                : "The kitchen is closed for a private event."
            }
            className="w-full resize-none rounded-xl border border-input bg-transparent px-3 py-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
        {r?.email ? (
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
              className="size-4 accent-primary"
            />
            Email {r.email} about it
          </label>
        ) : (
          <p className="text-sm text-muted-foreground">
            No email on this booking: let the guest know by phone.
          </p>
        )}
        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={move.isPending}
            className="h-10 rounded-lg border border-border px-4 text-sm font-medium"
          >
            Keep it
          </button>
          <button
            type="button"
            disabled={move.isPending || !target}
            onClick={() =>
              target &&
              move.mutate({
                reservation: target.reservation,
                status: target.status,
                reason,
                notify,
              })
            }
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-destructive px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {move.isPending && <Loader2 className="size-4 animate-spin" />}
            {declining ? "Decline request" : "Cancel booking"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Editor({
  mode,
  reservation,
  shared,
  onCancel,
  onSaved,
}: {
  mode: "create" | "edit";
  reservation?: AdminReservationDetail;
  shared: Shared;
  onCancel: () => void;
  onSaved: (r: AdminReservationDetail) => void;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [source, setSource] = useState<"phone" | "walk_in">("phone");
  const [seatNow, setSeatNow] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<DetailsValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: reservation
      ? {
          date: reservation.date,
          time: reservation.time,
          partySize: reservation.partySize,
          name: reservation.name,
          phone: reservation.phone,
          email: reservation.email,
          occasion: reservation.occasion ?? "",
          notes: reservation.notes ?? "",
          table: reservation.table ?? "",
          notify: true,
        }
      : {
          date: shared.today,
          time: nowRounded(shared.timezone),
          partySize: 2,
          name: "",
          phone: "",
          email: "",
          occasion: "",
          notes: "",
          table: "",
          notify: true,
        },
  });
  const [email, occasion] = useWatch({
    control: form.control,
    name: ["email", "occasion"],
  });
  const errors = form.formState.errors;

  const save = useMutation({
    mutationFn: (values: DetailsValues) =>
      mode === "edit" && reservation
        ? updateReservation(reservation.id, {
            ...values,
            version: reservation.version,
          })
        : createReservation({
            ...values,
            source,
            seatNow: source === "walk_in" && seatNow,
          }),
    onSuccess: (result) => {
      if (!result.ok) {
        for (const [field, message] of Object.entries(
          result.fieldErrors ?? {},
        )) {
          const name = FIELD_FROM_API[field];
          if (name) form.setError(name, { message });
        }
        setError(result.message);
        if (result.status === 409)
          void queryClient.invalidateQueries({ queryKey: RESERVATIONS_ROOT });
        return;
      }
      queryClient.setQueryData(reservationKey(result.data.id), result.data);
      void queryClient.invalidateQueries({ queryKey: RESERVATIONS_ROOT });
      router.refresh();
      toast.add({
        title:
          mode === "edit" ? "Booking updated" : `Booked: ${result.data.name}`,
        type: "success",
      });
      onSaved(result.data);
    },
    onError: (e) => setError(e.message),
  });

  const submit = (values: DetailsValues) => {
    setError(null);
    save.mutate(values);
  };

  const walkIn = mode === "create" && source === "walk_in";

  return (
    <form
      noValidate
      onSubmit={(e) => void form.handleSubmit(submit)(e)}
      className="flex min-h-0 flex-1 flex-col"
    >
      <SheetHeader className="border-b border-border px-5 py-4 text-left sm:px-6">
        <SheetTitle className="text-xl font-semibold tracking-tight">
          {mode === "edit"
            ? `Edit booking #${reservation?.number}`
            : "New booking"}
        </SheetTitle>
        <SheetDescription>
          {mode === "edit"
            ? "Change anything; it's all written to the booking's history."
            : "A booking taken by phone, or a guest at the door. It's confirmed straight away."}
        </SheetDescription>
      </SheetHeader>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-5 sm:p-6">
        {mode === "create" && (
          <div
            role="radiogroup"
            aria-label="How they booked"
            className="grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1.5"
          >
            {(["phone", "walk_in"] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={source === s}
                onClick={() => setSource(s)}
                className={cn(
                  "inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all",
                  source === s
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s === "phone" ? (
                  <PhoneCall className="size-4" />
                ) : (
                  <Footprints className="size-4" />
                )}
                {s === "phone" ? "Phone booking" : "Walk-in"}
              </button>
            ))}
          </div>
        )}

        <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <legend className="mb-2 text-sm font-semibold">
            When & how many
          </legend>
          <Field
            label="Date"
            error={errors.date?.message}
            className="col-span-2 sm:col-span-1"
          >
            <input type="date" {...form.register("date")} className={INPUT} />
          </Field>
          <Field label="Time" error={errors.time?.message}>
            <input
              type="time"
              step={300}
              {...form.register("time")}
              className={INPUT}
            />
          </Field>
          <Field label="Guests" error={errors.partySize?.message}>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              {...form.register("partySize", { valueAsNumber: true })}
              className={INPUT}
            />
          </Field>
          <Field
            label="Table"
            error={errors.table?.message}
            className="col-span-2 sm:col-span-1"
          >
            <input
              type="text"
              placeholder="e.g. 12, Terrace"
              {...form.register("table")}
              className={INPUT}
            />
          </Field>
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold">Guest</legend>
          <Field
            label="Name"
            error={errors.name?.message}
            className="sm:col-span-2"
          >
            <input
              type="text"
              autoComplete="off"
              {...form.register("name")}
              className={INPUT}
            />
          </Field>
          <Field label="Phone" error={errors.phone?.message}>
            <input
              type="tel"
              inputMode="tel"
              placeholder="+961 …"
              {...form.register("phone")}
              className={INPUT}
            />
          </Field>
          <Field
            label="Email"
            hint={
              mode === "edit" && reservation?.hasAccount
                ? "From their account"
                : "Optional"
            }
            error={errors.email?.message}
          >
            <input
              type="email"
              placeholder="For the confirmation"
              {...form.register("email")}
              className={INPUT}
            />
          </Field>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-semibold">Extras</legend>
          {shared.occasions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {shared.occasions.map((o) => {
                const on = occasion === o;
                return (
                  <button
                    key={o}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      form.setValue("occasion", on ? "" : o, {
                        shouldDirty: true,
                      })
                    }
                    className={cn(
                      "inline-flex h-8 items-center gap-1 rounded-full border px-3 text-sm transition-colors",
                      on
                        ? "border-primary bg-primary/10 font-medium text-primary"
                        : "border-border hover:bg-muted",
                    )}
                  >
                    {on && <Check className="size-3.5" />}
                    {o}
                  </button>
                );
              })}
            </div>
          )}
          <Field label="Guest's note" error={errors.notes?.message}>
            <textarea
              rows={3}
              maxLength={500}
              placeholder="Allergies, high chair, a quiet corner…"
              {...form.register("notes")}
              className={cn(INPUT, "h-auto resize-y py-2.5")}
            />
          </Field>
        </fieldset>

        {walkIn && (
          <label className="flex items-center gap-2.5 rounded-xl bg-violet-500/8 px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={seatNow}
              onChange={(e) => setSeatNow(e.target.checked)}
              className="size-4 accent-primary"
            />
            They&apos;re here: seat them now
          </label>
        )}
        {email && !(walkIn && seatNow) && (
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              {...form.register("notify")}
              className="size-4 accent-primary"
            />
            {mode === "edit"
              ? "Email the guest if the date, time or guests change"
              : "Email the guest a confirmation"}
          </label>
        )}

        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3.5 sm:px-6">
        <button
          type="button"
          onClick={onCancel}
          disabled={save.isPending}
          className="h-11 rounded-xl px-4 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={save.isPending}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {save.isPending && <Loader2 className="size-4 animate-spin" />}
          {mode === "edit"
            ? "Save changes"
            : walkIn && seatNow
              ? "Seat guests"
              : "Add booking"}
        </button>
      </div>
    </form>
  );
}

const INPUT =
  "h-10 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 text-[15px] tabular-nums outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive";

function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="mb-1 flex items-baseline justify-between gap-2 text-xs font-medium text-muted-foreground">
        {label}
        {hint && <span className="font-normal">{hint}</span>}
      </span>
      {children}
      {error && (
        <span className="mt-1 block text-xs text-destructive">{error}</span>
      )}
    </label>
  );
}

function nowRounded(timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? 19);
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    const total = Math.min(23 * 60 + 45, Math.ceil((h * 60 + m) / 15) * 15);
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  } catch {
    return "19:00";
  }
}
