"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChefHat,
  CircleUserRound,
  FileText,
  Gift,
  Images,
  Keyboard,
  LayoutDashboard,
  Lightbulb,
  Lock,
  Mail,
  MessageSquare,
  Newspaper,
  PartyPopper,
  Receipt,
  Search,
  Settings,
  Sparkles,
  Users,
  X,
  QrCode,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { hasPermission, type Role } from "@/lib/auth/user-roles";
import { isActiveHref, type AdminNavGroup } from "@/admin/lib/nav";
import {
  GUIDE_ACCOUNT,
  GUIDE_SHORTCUTS,
  GUIDE_START,
  GUIDE_TOPICS,
  normalize,
  searchText,
  type GuideTopic,
} from "@/admin/lib/guide";

type GuideState = { open: boolean; topic: string | null };
let state: GuideState = { open: false, topic: null };
const listeners = new Set<() => void>();
const emit = (next: GuideState) => {
  state = next;
  listeners.forEach((listener) => listener());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const CLOSED: GuideState = { open: false, topic: null };

export const openGuide = (topic?: string) =>
  emit({ open: true, topic: topic ?? null });
export const closeGuide = () => emit({ ...state, open: false });
const useGuideState = () =>
  useSyncExternalStore(
    subscribe,
    () => state,
    () => CLOSED,
  );

export function GuideButton({ compact }: { compact: boolean }) {
  return (
    <button
      type="button"
      onClick={() => openGuide()}
      aria-haspopup="dialog"
      aria-keyshortcuts="?"
      className={cn(
        "group/guide relative flex h-9 items-center gap-3 rounded-lg text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        compact ? "w-9 justify-center" : "w-full px-3",
      )}
    >
      <BookOpen aria-hidden="true" className="size-4.5 shrink-0" />
      <span className={cn(compact && "sr-only")}>Guide</span>
      {!compact && (
        <kbd className="ml-auto grid size-5 place-items-center rounded border border-sidebar-border bg-background/60 font-sans text-[11px] text-muted-foreground">
          ?
        </kbd>
      )}
      {compact && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-full z-50 ml-3 translate-x-1 rounded-md bg-foreground px-2 py-1 text-xs font-medium whitespace-nowrap text-background opacity-0 shadow-lg transition-all duration-150 group-hover/guide:translate-x-0 group-hover/guide:opacity-100 group-focus-visible/guide:translate-x-0 group-focus-visible/guide:opacity-100"
        >
          Guide · ?
        </span>
      )}
    </button>
  );
}

const ICONS: Record<GuideTopic["id"], LucideIcon> = {
  start: Sparkles,
  overview: LayoutDashboard,
  reservations: CalendarDays,
  orders: Receipt,
  menu: ChefHat,
  qr: QrCode,
  events: PartyPopper,
  gallery: Images,
  content: FileText,
  blog: Newspaper,
  giftCards: Gift,
  messages: MessageSquare,
  subscribers: Mail,
  team: Users,
  settings: Settings,
  account: CircleUserRound,
  shortcuts: Keyboard,
};

type Entry = {
  topic: GuideTopic;
  group: string;
  href?: string;
  label?: string;
};

export function AdminGuide({
  groups,
  role,
}: {
  groups: AdminNavGroup[];
  role?: Role;
}) {
  const pathname = usePathname();
  const { open, topic: requested } = useGuideState();
  const [chosen, setChosen] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const article = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const chips = useRef<HTMLUListElement>(null);
  const searchId = useId();

  const entries = useMemo<Entry[]>(() => {
    const pages = groups.flatMap((group) =>
      group.items.flatMap((item) => {
        const topic = GUIDE_TOPICS[item.id];
        return topic
          ? [{ topic, group: group.label, href: item.href, label: item.label }]
          : [];
      }),
    );
    return [
      { topic: GUIDE_START, group: "Getting started" },
      ...pages,
      { topic: GUIDE_ACCOUNT, group: "More" },
      { topic: GUIDE_SHORTCUTS, group: "More" },
    ];
  }, [groups]);

  const here =
    entries.find((e) => e.href && isActiveHref(pathname, e.href))?.topic.id ??
    null;

  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const index = useMemo(
    () => new Map(entries.map((e) => [e.topic.id, searchText(e.topic)])),
    [entries],
  );
  const shown = terms.length
    ? entries.filter((e) =>
        terms.every((t) => index.get(e.topic.id)!.includes(t)),
      )
    : entries;

  const wanted = chosen ?? requested ?? here ?? "start";
  const current = shown.find((e) => e.topic.id === wanted) ?? shown[0] ?? null;
  const position = current ? entries.indexOf(current) : -1;
  const previous = position > 0 ? entries[position - 1] : null;
  const next =
    position >= 0 && position < entries.length - 1
      ? entries[position + 1]
      : null;

  const pick = (id: string) => {
    setChosen(id);
    article.current?.scrollTo({ top: 0 });
  };

  const [openedFor, setOpenedFor] = useState<GuideState | null>(null);
  if (open && openedFor?.open !== true) {
    setOpenedFor({ open, topic: requested });
    setChosen(null);
    setQuery("");
  } else if (!open && openedFor?.open) {
    setOpenedFor(null);
  }

  const currentId = current?.topic.id;
  useEffect(() => {
    const row = chips.current;
    const chip = row?.querySelector<HTMLElement>(`[data-topic="${currentId}"]`);
    if (!open || !row || !chip) return;
    row.scrollTo({
      left: chip.offsetLeft - row.clientWidth / 2 + chip.offsetWidth / 2,
    });
  }, [open, currentId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.closest(
        "input, textarea, select, [contenteditable='true']",
      );
      if (
        event.key === "?" &&
        !typing &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        event.preventDefault();
        if (state.open) closeGuide();
        else openGuide();
      }
      if (event.key === "Escape" && state.open) closeGuide();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const before = root.style.overflow;
    returnFocus.current = document.activeElement as HTMLElement | null;
    panel.current?.focus({ preventScroll: true });
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = before;
      returnFocus.current?.focus?.({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    if (state.open) closeGuide();
  }, [pathname]);

  const limited =
    current?.topic.limited &&
    !hasPermission(role, current.topic.limited.missing)
      ? current.topic.limited.note
      : null;

  return (
    <>
      <div
        aria-hidden="true"
        onClick={closeGuide}
        className={cn(
          "fixed inset-0 z-60 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 motion-reduce:transition-none",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Admin guide"
        tabIndex={-1}
        inert={!open}
        className={cn(
          "fixed inset-y-0 right-0 z-70 flex w-full max-w-220 flex-col bg-background text-foreground shadow-2xl outline-none sm:w-[calc(100%-3rem)] sm:rounded-l-2xl",
          "transition-transform duration-300 ease-out motion-reduce:transition-none",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
            <BookOpen className="size-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base leading-tight font-semibold">
              Admin guide
            </h2>
            <p className="truncate text-xs text-muted-foreground">
              What each page does, and how to use it
            </p>
          </div>
          <button
            type="button"
            onClick={closeGuide}
            aria-label="Close the guide"
            className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <X className="size-4.5" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[240px_minmax(0,1fr)] md:grid-rows-1">
          {/* topics */}
          <aside className="flex min-h-0 min-w-0 flex-col border-b border-border md:border-r md:border-b-0">
            <div className="p-3">
              <label htmlFor={searchId} className="sr-only">
                Search the guide
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id={searchId}
                  type="search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setChosen(null);
                  }}
                  placeholder="Search: sold out, refund…"
                  autoComplete="off"
                  className="h-9 w-full rounded-lg border border-input bg-background pr-3 pl-9 text-sm outline-none transition placeholder:font-normal placeholder:text-foreground/35 focus:border-primary/60 focus:ring-4 focus:ring-primary/15 [&::-webkit-search-cancel-button]:appearance-none"
                />
              </div>
            </div>

            <nav
              aria-label="Guide topics"
              className="min-h-0 md:flex-1 md:overflow-y-auto md:overscroll-contain md:px-3 md:pb-4"
            >
              {shown.length === 0 ? (
                <p className="px-4 pb-3 text-sm text-muted-foreground md:px-1">
                  Nothing matches “{query}”. Try another word.
                </p>
              ) : (
                <>
                  <ul
                    ref={chips}
                    className="flex gap-1.5 overflow-x-auto px-3 pb-3 scrollbar-none md:hidden [&::-webkit-scrollbar]:hidden"
                  >
                    {shown.map((e) => (
                      <li
                        key={e.topic.id}
                        data-topic={e.topic.id}
                        className="shrink-0"
                      >
                        <TopicChip
                          entry={e}
                          active={current === e}
                          here={here === e.topic.id}
                          onPick={pick}
                        />
                      </li>
                    ))}
                  </ul>
                  <div className="hidden md:block">
                    {groupBy(shown).map(([group, items]) => (
                      <div key={group} className="mt-3 first:mt-0">
                        <p className="mb-1 px-2.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                          {group}
                        </p>
                        <ul className="space-y-0.5">
                          {items.map((e) => (
                            <li key={e.topic.id}>
                              <TopicRow
                                entry={e}
                                active={current === e}
                                here={here === e.topic.id}
                                onPick={pick}
                              />
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </nav>
          </aside>

          <div
            ref={article}
            className="min-h-0 overflow-y-auto overscroll-contain"
          >
            {current && (
              <article
                key={current.topic.id}
                className="mx-auto max-w-2xl px-5 pt-6 pb-10 transition-[opacity,translate] duration-300 ease-out motion-reduce:transition-none starting:translate-y-1 starting:opacity-0 sm:px-8 sm:pt-8"
              >
                <TopicHeader entry={current} here={here === current.topic.id} />

                {limited && (
                  <p className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
                    <Lock className="mt-0.5 size-4 shrink-0" />
                    <span>
                      <span className="font-semibold">For your role: </span>
                      {limited}
                    </span>
                  </p>
                )}

                <div className="mt-7 space-y-7">
                  {current.topic.sections
                    .filter(
                      (section) =>
                        !section.needs || hasPermission(role, section.needs),
                    )
                    .map((section) => (
                      <section key={section.heading}>
                        <h4 className="text-[15px] font-semibold tracking-tight">
                          {section.heading}
                        </h4>
                        {section.text && (
                          <p className="mt-2 text-[15px] leading-relaxed text-pretty text-foreground/75">
                            {section.text}
                          </p>
                        )}
                        {section.points && (
                          <ul className="mt-2.5 space-y-2">
                            {section.points.map((point) => (
                              <li
                                key={point}
                                className="flex gap-3 text-[15px] leading-relaxed text-foreground/80"
                              >
                                <span
                                  aria-hidden="true"
                                  className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-primary/70"
                                />
                                <span className="text-pretty">{point}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {section.steps && (
                          <ol className="mt-3 space-y-0">
                            {section.steps.map((step, i) => (
                              <li
                                key={step}
                                className="relative flex gap-3.5 pb-3.5 last:pb-0"
                              >
                                {i < section.steps!.length - 1 && (
                                  <span
                                    aria-hidden="true"
                                    className="absolute top-7 bottom-0 left-3.25 w-px bg-border"
                                  />
                                )}
                                <span className="relative grid size-7 shrink-0 place-items-center rounded-full border border-border bg-card text-xs font-semibold tabular-nums shadow-xs">
                                  {i + 1}
                                </span>
                                <span className="pt-0.5 text-[15px] leading-relaxed text-pretty text-foreground/80">
                                  {step}
                                </span>
                              </li>
                            ))}
                          </ol>
                        )}
                      </section>
                    ))}
                </div>

                {current.topic.tips && current.topic.tips.length > 0 && (
                  <aside className="mt-8 rounded-2xl border border-primary/20 bg-primary/6 p-4 sm:p-5">
                    <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                      <Lightbulb className="size-4" /> Good to know
                    </p>
                    <ul className="mt-2.5 space-y-2">
                      {current.topic.tips.map((tip) => (
                        <li
                          key={tip}
                          className="text-sm leading-relaxed text-pretty text-foreground/80"
                        >
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </aside>
                )}

                {!terms.length && (previous || next) && (
                  <nav
                    aria-label="More topics"
                    className="mt-10 grid gap-3 border-t border-border pt-6 sm:grid-cols-2"
                  >
                    {previous ? (
                      <StepCard
                        entry={previous}
                        direction="previous"
                        onPick={pick}
                      />
                    ) : (
                      <span className="hidden sm:block" />
                    )}
                    {next && (
                      <StepCard entry={next} direction="next" onPick={pick} />
                    )}
                  </nav>
                )}
              </article>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ───────────── pieces ───────────── */

function groupBy(entries: Entry[]): [string, Entry[]][] {
  const groups = new Map<string, Entry[]>();
  for (const e of entries)
    groups.set(e.group, [...(groups.get(e.group) ?? []), e]);
  return [...groups];
}

function TopicHeader({ entry, here }: { entry: Entry; here: boolean }) {
  const Icon = ICONS[entry.topic.id];
  return (
    <header>
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/12 text-primary">
          <Icon className="size-6" />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-2xl leading-tight font-semibold tracking-tight">
              {entry.topic.title}
            </h3>
            {here && (
              <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                This page
              </span>
            )}
          </div>
          <p className="mt-1 text-[15px] text-pretty text-muted-foreground">
            {entry.topic.summary}
          </p>
        </div>
      </div>
      {entry.href && !here && (
        <Link
          href={entry.href}
          className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 text-sm font-medium shadow-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          Open {entry.label ?? entry.topic.title}{" "}
          <ArrowRight className="size-4" />
        </Link>
      )}
    </header>
  );
}

function TopicRow({
  entry,
  active,
  here,
  onPick,
}: {
  entry: Entry;
  active: boolean;
  here: boolean;
  onPick: (id: string) => void;
}) {
  const Icon = ICONS[entry.topic.id];
  return (
    <button
      type="button"
      onClick={() => onPick(entry.topic.id)}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        active
          ? "bg-primary/10 font-semibold text-primary"
          : "text-foreground/75 hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">
        {entry.label ?? entry.topic.title}
      </span>
      {here && (
        <span
          aria-label="This page"
          className="size-1.5 shrink-0 rounded-full bg-emerald-500"
        />
      )}
    </button>
  );
}

function TopicChip({
  entry,
  active,
  here,
  onPick,
}: {
  entry: Entry;
  active: boolean;
  here: boolean;
  onPick: (id: string) => void;
}) {
  const Icon = ICONS[entry.topic.id];
  return (
    <button
      type="button"
      onClick={() => onPick(entry.topic.id)}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-foreground/75 hover:border-foreground/25",
      )}
    >
      <Icon className="size-3.5" />
      {entry.label ?? entry.topic.title}
      {here && !active && (
        <span
          aria-label="This page"
          className="size-1.5 rounded-full bg-emerald-500"
        />
      )}
    </button>
  );
}

function StepCard({
  entry,
  direction,
  onPick,
}: {
  entry: Entry;
  direction: "previous" | "next";
  onPick: (id: string) => void;
}): ReactNode {
  const Arrow = direction === "previous" ? ArrowLeft : ArrowRight;
  return (
    <button
      type="button"
      onClick={() => onPick(entry.topic.id)}
      className={cn(
        "group flex items-center gap-3 rounded-xl border border-border px-4 py-3 text-left transition-colors hover:border-foreground/20 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        direction === "next" && "sm:flex-row-reverse sm:text-right",
      )}
    >
      <Arrow className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:text-foreground" />
      <span className="min-w-0">
        <span className="block text-xs text-muted-foreground">
          {direction === "previous" ? "Previous" : "Next"}
        </span>
        <span className="block truncate text-sm font-semibold">
          {entry.label ?? entry.topic.title}
        </span>
      </span>
    </button>
  );
}
