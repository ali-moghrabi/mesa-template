"use client";

import {
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  CornerDownRight,
  ExternalLink,
  Inbox,
  Loader2,
  Mail,
  MailOpen,
  MessageCircle,
  NotebookPen,
  Phone,
  Reply,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Star,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DEFAULT_FILTERS,
  MESSAGES_PATH,
  MESSAGES_ROOT,
  QUICK_REPLIES,
  REPLY_MAX,
  VIEWS,
  fullWhen,
  initials,
  listKey,
  messageKey,
  shortWhen,
  toneFor,
  type BulkAction,
  type MessageDetail,
  type MessageFilters,
  type MessageFolder,
  type MessagesPage,
  type MessageSummary,
  type MessageView,
} from "@/admin/lib/messages";
import {
  bulkMessages,
  deleteMessage,
  fetchMessage,
  fetchMessages,
  replyToMessage,
  saveMessageNote,
  updateMessage,
} from "@/admin/lib/messages.actions";

type Props = {
  initial: MessagesPage | null;
  loadError: string | null;
  timezone: string;
  brandName: string;
  initialId: string | null;
};

const REFRESH_MS = 60_000;
const noSubscribe = () => () => {};
const minuteSubscribe = (fn: () => void) => {
  const id = setInterval(fn, 60_000);
  return () => clearInterval(id);
};
const currentMinute = () => Math.floor(Date.now() / 60_000) * 60_000;
const noClock = () => null;

const unwrap = async <T,>(
  p: Promise<{ ok: true; data: T } | { ok: false; message: string }>,
): Promise<T> => {
  const r = await p;
  if (!r.ok) throw new Error(r.message);
  return r.data;
};
const sameFilters = (a: MessageFilters, b: MessageFilters) =>
  a.view === b.view &&
  (a.q ?? "") === (b.q ?? "") &&
  (a.subject ?? "") === (b.subject ?? "") &&
  (a.page ?? 1) === (b.page ?? 1);

export function MessagesInbox({
  initial,
  loadError,
  timezone,
  brandName,
  initialId,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<MessageFilters>(DEFAULT_FILTERS);
  const [search, setSearch] = useState("");
  const q = useDeferredValue(search.trim());
  const effective: MessageFilters = { ...filters, q: q || undefined };
  const [selected, setSelected] = useState<string | null>(initialId);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<string[] | null>(null);
  const now = useSyncExternalStore(minuteSubscribe, currentMinute, noClock);

  const list = useQuery({
    queryKey: listKey(effective),
    queryFn: () => unwrap(fetchMessages(effective)),
    initialData:
      initial && sameFilters(effective, DEFAULT_FILTERS) ? initial : undefined,
    placeholderData: keepPreviousData,
    refetchInterval: REFRESH_MS,
  });
  const hydrated = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  const page = hydrated ? (list.data ?? initial) : initial;
  const counts = page?.counts;

  const set = (patch: Partial<MessageFilters>) => {
    setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
    setChecked(new Set());
  };

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: MESSAGES_ROOT });
    router.refresh();
  };

  const open = (id: string | null) => {
    setSelected(id);
    router.replace(id ? `${MESSAGES_PATH}?message=${id}` : MESSAGES_PATH, {
      scroll: false,
    });
  };

  const bulk = useMutation({
    mutationFn: ({ ids, action }: { ids: string[]; action: BulkAction }) =>
      unwrap(bulkMessages(ids, action)),
    onSuccess: ({ changed }, { ids, action }) => {
      setChecked(new Set());
      setDeleting(null);
      if (
        selected &&
        ids.includes(selected) &&
        (action === "delete" ||
          action === "archive" ||
          action === "spam" ||
          action === "inbox")
      )
        open(null);
      refreshAll();
      toast.add({
        title: `${changed} ${changed === 1 ? "message" : "messages"} ${BULK_DONE[action]}`,
        type: "success",
      });
    },
    onError: (e) =>
      toast.add({
        title: "Couldn't update the messages",
        description: e.message,
        type: "error",
      }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => unwrap(deleteMessage(id)),
    onSuccess: (_, id) => {
      setDeleting(null);
      setChecked((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
      if (selected === id) open(null);
      refreshAll();
      toast.add({ title: "Message deleted", type: "success" });
    },
    onError: (e) =>
      toast.add({
        title: "Couldn't delete the message",
        description: e.message,
        type: "error",
      }),
  });
  const deletingNow = bulk.isPending || remove.isPending;

  const items = page?.items ?? [];
  const allChecked = items.length > 0 && items.every((m) => checked.has(m.id));
  const toggle = (id: string) =>
    setChecked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const view = filters.view;
  const viewMeta = VIEWS.find((v) => v.id === view)!;

  return (
    <div className="mx-auto w-full max-w-375 px-4 pb-10 sm:px-8">
      <header className="flex flex-col gap-1 pt-6 pb-5 lg:pt-10">
        <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
          Guests
        </p>
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight sm:text-3xl">
          Messages
        </h1>
        <p className="text-sm text-muted-foreground sm:text-[15px]">
          {counts
            ? counts.unread > 0
              ? `${counts.unread} unread ${counts.unread === 1 ? "message" : "messages"} from the contact page.`
              : "Everything is read. Nice work."
            : " "}
        </p>
      </header>

      {loadError && !page && (
        <p
          role="alert"
          className="mb-4 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertTriangle className="size-4" /> {loadError}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs lg:grid lg:h-[calc(100svh-13rem)] lg:min-h-140 lg:grid-cols-[minmax(340px,420px)_minmax(0,1fr)]">
        <section
          aria-label="Messages"
          className="flex min-h-0 flex-col lg:border-r lg:border-border"
        >
          <div className="space-y-3 border-b border-border p-3">
            <div
              role="tablist"
              aria-label="Folders"
              className="-mx-1 flex gap-1 overflow-x-auto px-1 scrollbar-none [&::-webkit-scrollbar]:hidden"
            >
              {VIEWS.map((v) => {
                const on = view === v.id;
                const n = counts?.[v.id] ?? 0;
                return (
                  <button
                    key={v.id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => set({ view: v.id })}
                    className={cn(
                      "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors",
                      on
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {v.label}
                    {n > 0 &&
                      (v.id === "unread" ||
                        v.id === "inbox" ||
                        v.id === "spam") && (
                        <span
                          className={cn(
                            "rounded-full px-1.5 text-[11px] font-bold tabular-nums",
                            on
                              ? "bg-background/20"
                              : v.id === "unread"
                                ? "bg-primary text-white"
                                : "bg-muted text-muted-foreground",
                          )}
                        >
                          {n}
                        </span>
                      )}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <label className="relative block flex-1">
                <span className="sr-only">Search messages</span>
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    set({});
                  }}
                  placeholder="Search name, email, words…"
                  className="h-9 w-full rounded-lg border border-input bg-transparent pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </label>
              {(page?.subjects.length ?? 0) > 1 && (
                <select
                  aria-label="Subject"
                  value={filters.subject ?? ""}
                  onChange={(e) =>
                    set({ subject: e.target.value || undefined })
                  }
                  className="h-9 max-w-36 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="">All subjects</option>
                  {page?.subjects.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {items.length > 0 && (
            <div className="flex h-11 items-center gap-2 border-b border-border px-3 text-sm">
              <input
                type="checkbox"
                aria-label="Select all"
                checked={allChecked}
                onChange={() =>
                  setChecked(
                    allChecked ? new Set() : new Set(items.map((m) => m.id)),
                  )
                }
                className="size-4 accent-primary"
              />
              {checked.size === 0 ? (
                <span className="text-muted-foreground tabular-nums">
                  {page?.total ?? 0}{" "}
                  {page?.total === 1 ? "message" : "messages"}
                  {list.isFetching && (
                    <Loader2 className="ml-2 inline size-3.5 animate-spin" />
                  )}
                </span>
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto scrollbar-none">
                  <span className="mr-1.5 font-semibold tabular-nums">
                    {checked.size}
                  </span>
                  {bulkActionsFor(view).map((a) => (
                    <IconButton
                      key={a}
                      label={BULK_LABEL[a]}
                      danger={a === "delete"}
                      disabled={bulk.isPending}
                      onClick={() =>
                        a === "delete"
                          ? setDeleting([...checked])
                          : bulk.mutate({ ids: [...checked], action: a })
                      }
                    >
                      <BulkIcon action={a} />
                    </IconButton>
                  ))}
                  <IconButton
                    label="Clear selection"
                    onClick={() => setChecked(new Set())}
                    className="ml-auto"
                  >
                    <X className="size-4" />
                  </IconButton>
                </div>
              )}
            </div>
          )}

          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto overscroll-contain",
              list.isPlaceholderData && "opacity-60",
            )}
          >
            {!page ? (
              list.isError ? (
                <ErrorState
                  message={list.error.message}
                  onRetry={() => void list.refetch()}
                />
              ) : (
                <div className="grid place-items-center py-20">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              )
            ) : items.length === 0 ? (
              <EmptyState
                view={view}
                text={
                  q || filters.subject
                    ? "No messages match your search."
                    : viewMeta.empty
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {items.map((m) => (
                  <ListItem
                    key={m.id}
                    message={m}
                    active={m.id === selected}
                    checked={checked.has(m.id)}
                    now={now}
                    timezone={timezone}
                    onOpen={() => open(m.id)}
                    onCheck={() => toggle(m.id)}
                  />
                ))}
              </ul>
            )}
          </div>

          {page && page.pages > 1 && (
            <footer className="flex items-center justify-between border-t border-border px-3 py-2 text-sm text-muted-foreground">
              <span className="tabular-nums">
                Page {page.page} of {page.pages}
              </span>
              <div className="flex gap-1">
                <IconButton
                  label="Newer"
                  disabled={page.page <= 1}
                  onClick={() => set({ page: page.page - 1 })}
                >
                  <ChevronLeft className="size-4" />
                </IconButton>
                <IconButton
                  label="Older"
                  disabled={page.page >= page.pages}
                  onClick={() => set({ page: page.page + 1 })}
                >
                  <ChevronRight className="size-4" />
                </IconButton>
              </div>
            </footer>
          )}
        </section>

        <section
          aria-label="Message"
          className={cn(
            "min-h-0 flex-col bg-background lg:flex lg:bg-transparent",
            selected ? "fixed inset-0 z-50 flex lg:static lg:z-auto" : "hidden",
          )}
        >
          {selected ? (
            <Reader
              key={selected}
              id={selected}
              timezone={timezone}
              brandName={brandName}
              onClose={() => open(null)}
              onOpen={open}
              onDelete={() => setDeleting([selected])}
              onChanged={refreshAll}
            />
          ) : (
            <div className="grid flex-1 place-items-center p-10 text-center">
              <div>
                <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-muted text-muted-foreground">
                  <MailOpen className="size-7" />
                </span>
                <p className="mt-4 font-semibold">Pick a message to read it</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Replies you send here go to the guest by email.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>

      <Dialog
        open={deleting !== null}
        onOpenChange={(o) => !o && !deletingNow && setDeleting(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Delete{" "}
              {deleting?.length === 1
                ? "this message"
                : `${deleting?.length} messages`}
              ?
            </DialogTitle>
            <DialogDescription>
              They&apos;re removed for good, with their replies and notes. To
              keep them out of the way, archive them instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setDeleting(null)}
              disabled={deletingNow}
              className="h-10 rounded-lg border border-border px-4 text-sm font-medium"
            >
              Keep
            </button>
            <button
              type="button"
              disabled={deletingNow}
              onClick={() => {
                if (!deleting) return;
                if (deleting.length === 1) remove.mutate(deleting[0]);
                else bulk.mutate({ ids: deleting, action: "delete" });
              }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-destructive px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {deletingNow && <Loader2 className="size-4 animate-spin" />}{" "}
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const BULK_LABEL: Record<BulkAction, string> = {
  read: "Mark as read",
  unread: "Mark as unread",
  star: "Star",
  unstar: "Remove star",
  archive: "Archive",
  inbox: "Move to inbox",
  spam: "Mark as spam",
  delete: "Delete",
};
const BULK_DONE: Record<BulkAction, string> = {
  read: "marked as read",
  unread: "marked as unread",
  star: "starred",
  unstar: "unstarred",
  archive: "archived",
  inbox: "moved to the inbox",
  spam: "moved to spam",
  delete: "deleted",
};

function bulkActionsFor(view: MessageView): BulkAction[] {
  if (view === "spam") return ["inbox", "delete"];
  if (view === "archived") return ["inbox", "star", "delete"];
  return ["read", "unread", "star", "archive", "spam", "delete"];
}

function BulkIcon({ action }: { action: BulkAction }) {
  const Icon = {
    read: MailOpen,
    unread: Mail,
    star: Star,
    unstar: Star,
    archive: Archive,
    inbox: ArchiveRestore,
    spam: ShieldAlert,
    delete: Trash2,
  }[action];
  return <Icon className="size-4" />;
}

function ViewIcon({
  view,
  className,
}: {
  view: MessageView;
  className?: string;
}) {
  const Icon = {
    inbox: Inbox,
    unread: Mail,
    starred: Star,
    archived: Archive,
    spam: ShieldAlert,
  }[view];
  return <Icon aria-hidden="true" className={className} />;
}

function ListItem({
  message: m,
  active,
  checked,
  now,
  timezone,
  onOpen,
  onCheck,
}: {
  message: MessageSummary;
  active: boolean;
  checked: boolean;
  now: number | null;
  timezone: string;
  onOpen: () => void;
  onCheck: () => void;
}) {
  const unread = m.status === "new";
  return (
    <li
      className={cn(
        "relative flex gap-3 px-3 py-3 transition-colors",
        active
          ? "bg-primary/[0.07]"
          : checked
            ? "bg-muted/70"
            : "hover:bg-muted/50",
      )}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-0.5 bg-primary"
        />
      )}
      <div className="flex flex-col items-center gap-2 pt-0.5">
        <input
          type="checkbox"
          aria-label={`Select message from ${m.name}`}
          checked={checked}
          onChange={onCheck}
          className="size-4 accent-primary"
        />
        {m.starred && (
          <Star
            aria-label="Starred"
            className="size-3.5 fill-amber-400 text-amber-400"
          />
        )}
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 gap-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-lg"
      >
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold",
            toneFor(m.email),
          )}
        >
          {initials(m.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span
              className={cn(
                "truncate",
                unread ? "font-semibold" : "font-medium text-foreground/85",
              )}
            >
              {m.name}
            </span>
            {m.replies > 0 && (
              <CornerDownRight
                aria-label="Replied"
                className="size-3.5 shrink-0 text-emerald-600"
              />
            )}
            <span
              className={cn(
                "ml-auto shrink-0 text-xs tabular-nums",
                unread ? "font-semibold text-primary" : "text-muted-foreground",
              )}
            >
              {shortWhen(m.createdAt, timezone, now)}
            </span>
          </span>
          <span
            className={cn(
              "mt-0.5 flex items-center gap-1.5 truncate text-sm",
              unread ? "font-medium text-foreground" : "text-foreground/75",
            )}
          >
            {unread && (
              <span
                aria-label="Unread"
                className="size-2 shrink-0 rounded-full bg-primary"
              />
            )}
            <span className="truncate">{m.subject}</span>
          </span>
          <span className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
            {m.preview}
          </span>
        </span>
      </button>
    </li>
  );
}

function EmptyState({ view, text }: { view: MessageView; text: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <ViewIcon view={view} className="size-6" />
      </span>
      <p className="mt-4 max-w-xs text-sm text-pretty text-muted-foreground">
        {text}
      </p>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <AlertTriangle className="size-6 text-destructive" />
      <p className="mt-3 font-medium">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 h-9 rounded-lg border border-border px-4 text-sm font-medium"
      >
        Try again
      </button>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  active,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  active?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40",
        danger && "hover:bg-destructive/10 hover:text-destructive",
        active && "text-amber-500 hover:text-amber-500",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Reader({
  id,
  timezone,
  brandName,
  onClose,
  onOpen,
  onDelete,
  onChanged,
}: {
  id: string;
  timezone: string;
  brandName: string;
  onClose: () => void;
  onOpen: (id: string) => void;
  onDelete: () => void;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const announced = useRef(false);
  const message = useQuery({
    queryKey: messageKey(id),
    queryFn: () => unwrap(fetchMessage(id)),
  });
  const m = message.data;

  useEffect(() => {
    if (m && !announced.current) {
      announced.current = true;
      onChanged();
    }
  }, [m, onChanged]);

  const change = useMutation({
    mutationFn: (patch: {
      starred?: boolean;
      read?: boolean;
      folder?: MessageFolder;
    }) => unwrap(updateMessage(id, patch)),
    onSuccess: (detail, patch) => {
      queryClient.setQueryData(messageKey(id), detail);
      onChanged();
      if (patch.folder) {
        toast.add({
          title:
            patch.folder === "archived"
              ? "Archived"
              : patch.folder === "spam"
                ? "Moved to spam"
                : "Moved to the inbox",
          type: "success",
        });
        onClose();
      }
      if (patch.read === false) {
        toast.add({ title: "Marked as unread", type: "success" });
        onClose();
      }
    },
    onError: (e) =>
      toast.add({
        title: "Couldn't update the message",
        description: e.message,
        type: "error",
      }),
  });

  if (!m) {
    return (
      <div className="grid flex-1 place-items-center p-8 text-center">
        {message.isError ? (
          <div>
            <AlertTriangle className="mx-auto size-7 text-destructive" />
            <p className="mt-3 font-medium">{message.error.message}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 h-9 rounded-lg border border-border px-4 text-sm font-medium"
            >
              Back to the list
            </button>
          </div>
        ) : (
          <Loader2 className="size-7 animate-spin text-muted-foreground" />
        )}
      </div>
    );
  }

  const firstName = m.name.split(" ")[0] || m.name;
  const tel = m.phone.replace(/[^+\d]/g, "");
  const digits = m.phone.replace(/[^\d]/g, "");

  return (
    <>
      <div className="flex h-14 shrink-0 items-center gap-1 border-b border-border px-2 sm:px-3">
        <IconButton
          label="Back to the list"
          onClick={onClose}
          className="lg:hidden"
        >
          <ArrowLeft className="size-5" />
        </IconButton>
        <IconButton
          label={m.starred ? "Remove star" : "Star"}
          active={m.starred}
          disabled={change.isPending}
          onClick={() => change.mutate({ starred: !m.starred })}
        >
          <Star className={cn("size-4", m.starred && "fill-amber-400")} />
        </IconButton>
        <IconButton
          label="Mark as unread"
          disabled={change.isPending}
          onClick={() => change.mutate({ read: false })}
        >
          <Mail className="size-4" />
        </IconButton>
        {m.folder === "inbox" ? (
          <IconButton
            label="Archive"
            disabled={change.isPending}
            onClick={() => change.mutate({ folder: "archived" })}
          >
            <Archive className="size-4" />
          </IconButton>
        ) : (
          <IconButton
            label="Move to inbox"
            disabled={change.isPending}
            onClick={() => change.mutate({ folder: "inbox" })}
          >
            <ArchiveRestore className="size-4" />
          </IconButton>
        )}
        {m.folder === "spam" ? (
          <IconButton
            label="Not spam"
            disabled={change.isPending}
            onClick={() => change.mutate({ folder: "inbox" })}
          >
            <ShieldCheck className="size-4" />
          </IconButton>
        ) : (
          <IconButton
            label="Mark as spam"
            disabled={change.isPending}
            onClick={() => change.mutate({ folder: "spam" })}
          >
            <ShieldAlert className="size-4" />
          </IconButton>
        )}
        <IconButton label="Delete" danger onClick={onDelete}>
          <Trash2 className="size-4" />
        </IconButton>
        <span className="ml-auto pr-1 text-xs text-muted-foreground">
          {change.isPending && <Loader2 className="size-4 animate-spin" />}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <article className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-8">
          {m.folder === "spam" && (
            <p className="flex items-start gap-2.5 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" /> This message is
              in spam. Be careful with links in it.
            </p>
          )}

          <header>
            <p className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              {m.subject}
            </p>
            <div className="mt-4 flex items-start gap-3.5">
              <span
                className={cn(
                  "grid size-12 shrink-0 place-items-center rounded-full text-base font-bold",
                  toneFor(m.email),
                )}
              >
                {initials(m.name)}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight">
                  {m.name}
                  {m.hasAccount && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      <UserCheck className="size-3" /> Has an account
                    </span>
                  )}
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {fullWhen(m.createdAt, timezone)}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject}`)}`}
                className={CHIP}
              >
                <Mail className="size-4" /> {m.email}
              </a>
              {m.phone && (
                <a href={`tel:${tel}`} className={CHIP}>
                  <Phone className="size-4" /> {m.phone}
                </a>
              )}
              {digits.length >= 7 && (
                <a
                  href={`https://wa.me/${digits}`}
                  target="_blank"
                  rel="noreferrer"
                  className={CHIP}
                >
                  <MessageCircle className="size-4" /> WhatsApp
                </a>
              )}
            </div>
          </header>

          <div className="rounded-2xl border border-border bg-card p-5 text-[15px] leading-relaxed whitespace-pre-wrap shadow-xs sm:p-6">
            {m.body}
          </div>
          {m.readBy && m.readAt && (
            <p className="-mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Check className="size-3.5" /> Opened by {m.readBy} ·{" "}
              {fullWhen(m.readAt, timezone)}
            </p>
          )}

          {m.thread.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Your replies
              </h3>
              {m.thread.map((r, i) => (
                <div
                  key={`${r.at}-${i}`}
                  className="ml-6 rounded-2xl rounded-tl-md border border-primary/20 bg-primary/5 p-4 sm:ml-12"
                >
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <Reply className="size-3.5 text-primary" />
                    <span className="font-semibold text-foreground">
                      {r.by}
                    </span>{" "}
                    · {fullWhen(r.at, timezone)} · sent by email
                  </p>
                  <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-wrap">
                    {r.body}
                  </p>
                </div>
              ))}
            </section>
          )}

          {m.others.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                Other messages from {firstName} ({m.others.length})
              </h3>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {m.others.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(o.id)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted/60"
                    >
                      {o.status === "new" ? (
                        <span className="size-2 rounded-full bg-primary" />
                      ) : (
                        <MailOpen className="size-4 text-muted-foreground" />
                      )}
                      <span className="min-w-0 flex-1 truncate">
                        {o.subject}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {shortWhen(o.createdAt, timezone, null)}
                      </span>
                      <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <TeamNote message={m} />
        </article>
      </div>

      <Composer message={m} brandName={brandName} onSent={onChanged} />
    </>
  );
}

const CHIP =
  "inline-flex h-9 max-w-full items-center gap-2 truncate rounded-full border border-border px-3.5 text-sm font-medium transition-colors hover:bg-muted";

function TeamNote({ message: m }: { message: MessageDetail }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (note: string) => unwrap(saveMessageNote(m.id, note)),
    onSuccess: (detail) => {
      queryClient.setQueryData(messageKey(m.id), detail);
      setDraft(null);
      toast.add({ title: "Note saved", type: "success" });
    },
    onError: (e) =>
      toast.add({
        title: "Couldn't save the note",
        description: e.message,
        type: "error",
      }),
  });
  const value = draft ?? m.staffNote;
  const dirty = draft !== null && draft !== m.staffNote;

  return (
    <section className="rounded-2xl border border-dashed border-border p-4">
      <label
        htmlFor={`note-${m.id}`}
        className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"
      >
        <NotebookPen className="size-4" /> Team note{" "}
        <span className="font-normal">· only the team sees it</span>
      </label>
      <textarea
        id={`note-${m.id}`}
        rows={2}
        maxLength={1000}
        value={value}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Called back on Tuesday, sent the events menu…"
        className="mt-2 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
            {save.isPending && <Loader2 className="size-3.5 animate-spin" />}{" "}
            Save note
          </button>
        </div>
      )}
    </section>
  );
}

function Composer({
  message: m,
  brandName,
  onSent,
}: {
  message: MessageDetail;
  brandName: string;
  onSent: () => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const firstName = m.name.split(" ")[0] || m.name;
  const send = useMutation({
    mutationFn: () => unwrap(replyToMessage(m.id, text)),
    onSuccess: (detail) => {
      queryClient.setQueryData(messageKey(m.id), detail);
      setText("");
      setOpen(false);
      onSent();
      toast.add({
        title: "Reply sent",
        description: `Emailed to ${m.email}`,
        type: "success",
      });
    },
    onError: (e) =>
      toast.add({
        title: "Couldn't send the reply",
        description: e.message,
        type: "error",
      }),
  });

  if (!open) {
    return (
      <div className="shrink-0 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-3xl">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-[0_10px_24px_-14px_var(--primary)] transition hover:brightness-110 sm:flex-none"
          >
            <Reply className="size-4" /> Reply to {firstName}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-t border-border bg-background px-4 py-3 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted-foreground">
            To {m.email} · Start with:
          </span>
          {QUICK_REPLIES.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => setText(t.text(firstName, brandName))}
              className="h-7 rounded-full border border-border px-2.5 text-xs font-medium transition-colors hover:bg-muted"
            >
              {t.label}
            </button>
          ))}
        </div>
        <textarea
          autoFocus
          rows={5}
          maxLength={REPLY_MAX}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (
              (e.metaKey || e.ctrlKey) &&
              e.key === "Enter" &&
              text.trim().length >= 2
            )
              send.mutate();
          }}
          placeholder={`Write to ${firstName}…`}
          className="max-h-[40svh] min-h-28 w-full resize-y rounded-xl border border-input bg-transparent px-3.5 py-3 text-[15px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <div className="mt-2 flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Ctrl + Enter to send · their message is quoted below your reply
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={send.isPending}
            className="ml-auto h-10 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={send.isPending || text.trim().length < 2}
            onClick={() => send.mutate()}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {send.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}{" "}
            Send reply
          </button>
        </div>
      </div>
    </div>
  );
}
