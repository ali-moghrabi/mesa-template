"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  Lock,
  LoaderCircle,
  Minus,
  MoreHorizontal,
  Plus,
  Power,
  Search,
  ShieldAlert,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { ROLE_RANK, type Role } from "@/lib/auth/user-roles";
import {
  changeMemberRole,
  changeMemberStatus,
  searchTeamCandidates,
} from "@/admin/lib/team/team-actions";
import {
  assignableTeamRoles,
  cleanTeamSearch,
  fullName,
  PERMISSION_LABELS,
  permissionDiff,
  ROLE_INFO,
  roleHighlights,
  TEAM_ROLES,
  teamHref,
  type TeamCandidate,
  type TeamFilters,
  type TeamMember,
  type TeamRole,
} from "@/admin/lib/team/team";

export function MemberAvatar({
  person,
  role,
  isActive = true,
  className,
}: {
  person: { firstName: string; lastName: string };
  role: Role;
  isActive?: boolean;
  className?: string;
}) {
  const initials =
    `${person.firstName.charAt(0)}${person.lastName.charAt(0)}`.toUpperCase() ||
    "?";
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_30%_20%,color-mix(in_srgb,var(--primary)_22%,transparent),transparent_70%)] bg-muted text-sm font-semibold text-foreground/80 ring-2 ring-offset-2 ring-offset-card",
        isActive
          ? ROLE_INFO[role].ring
          : "opacity-60 ring-foreground/15 grayscale",
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function RoleBadge({
  role,
  className,
}: {
  role: Role;
  className?: string;
}) {
  const info = ROLE_INFO[role];
  const Icon = info.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset",
        info.badge,
        className,
      )}
    >
      <Icon className="size-3.5" />
      {info.label}
    </span>
  );
}

const SEARCH_DELAY_MS = 300;

export function TeamToolbar({
  filters,
  disabledCount,
}: {
  filters: TeamFilters;
  disabledCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState(filters.search);
  const [seen, setSeen] = useState(filters.search);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (filters.search !== seen) {
    setSeen(filters.search);
    setDraft(filters.search);
  }

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const go = (href: string) =>
    startTransition(() => router.replace(href, { scroll: false }));
  const submit = (value: string) => {
    if (timer.current) clearTimeout(timer.current);
    const search = cleanTeamSearch(value);
    if (search !== filters.search) go(teamHref(filters, { search }));
  };

  const statuses = [
    { value: "", label: "Everyone" },
    { value: "active", label: "Active" },
    { value: "disabled", label: "Disabled", count: disabledCount },
  ] as const;

  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
      <form
        role="search"
        className="group relative flex-1"
        onSubmit={(event) => {
          event.preventDefault();
          submit(draft);
        }}
      >
        <label htmlFor="team-search" className="sr-only">
          Search the team
        </label>
        <span className="pointer-events-none absolute inset-y-0 left-3.5 grid place-items-center text-muted-foreground transition-colors group-focus-within:text-primary">
          {isPending ? (
            <LoaderCircle className="size-4.5 animate-spin" />
          ) : (
            <Search className="size-4.5" />
          )}
        </span>
        <input
          id="team-search"
          type="search"
          autoComplete="off"
          spellCheck={false}
          maxLength={80}
          value={draft}
          onChange={(event) => {
            const value = event.target.value;
            setDraft(value);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => submit(value), SEARCH_DELAY_MS);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && draft) {
              event.preventDefault();
              setDraft("");
              submit("");
            }
          }}
          placeholder="Search by name or email…"
          className="h-11 w-full rounded-xl border border-border bg-card pr-10 pl-11 text-[15px] shadow-xs outline-none transition placeholder:text-muted-foreground/80 hover:border-foreground/20 focus:border-primary/60 focus:ring-4 focus:ring-primary/15 [&::-webkit-search-cancel-button]:appearance-none"
        />
        {draft && (
          <button
            type="button"
            onClick={() => {
              setDraft("");
              submit("");
            }}
            className="absolute inset-y-0 right-2 my-auto grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
            <span className="sr-only">Clear search</span>
          </button>
        )}
      </form>

      <div
        role="radiogroup"
        aria-label="Account status"
        className="flex h-11 shrink-0 items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-xs"
      >
        {statuses.map((status) => {
          const active = filters.status === status.value;
          return (
            <button
              key={status.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => go(teamHref(filters, { status: status.value }))}
              className={cn(
                "inline-flex h-full flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors sm:flex-none",
                active
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {status.label}
              {"count" in status && status.count > 0 && (
                <span
                  className={cn(
                    "min-w-5 rounded-full px-1.5 text-center text-[11px] font-semibold tabular-nums",
                    active
                      ? "bg-background/15"
                      : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
                  )}
                >
                  {status.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type Change =
  | { kind: "role"; role: Role }
  | { kind: "status"; isActive: boolean };

function useMemberChange(
  member: { id: string; firstName: string; role: Role },
  onDone: () => void,
) {
  const router = useRouter();
  return useMutation({
    mutationFn: async (change: Change) => {
      const result =
        change.kind === "role"
          ? await changeMemberRole(member.id, change.role, member.role)
          : await changeMemberStatus(member.id, change.isActive);
      if (!result.ok) throw new Error(result.message);
      return { change };
    },
    onSuccess: ({ change }) => {
      toast.add({
        title: successMessage(member.firstName, change, member.role),
        type: "success",
      });
      onDone();
      router.refresh();
    },
    onError: (error) =>
      toast.add({
        title: "Nothing changed",
        description: error.message,
        type: "error",
      }),
  });
}

function successMessage(name: string, change: Change, from: Role): string {
  if (change.kind === "status")
    return change.isActive
      ? `${name} can sign in again`
      : `${name}'s account is disabled`;
  if (change.role === "customer") return `${name} was removed from the team`;
  if (from === "customer")
    return `${name} joined the team as ${ROLE_INFO[change.role].article}`;
  return `${name} is now ${ROLE_INFO[change.role].article}`;
}

export function MemberActions({ member }: { member: TeamMember }) {
  const [pending, setPending] = useState<Change | null>(null);
  const change = useMemberChange(member, () => setPending(null));
  const name = member.firstName;

  if (member.lockedReason) {
    return (
      <span
        title={member.lockedReason}
        className="inline-grid size-9 place-items-center rounded-lg text-muted-foreground/60"
      >
        <Lock className="size-4" />
        <span className="sr-only">{member.lockedReason}</span>
      </span>
    );
  }

  const canRemove = member.can.roles.includes("customer");
  const rank = ROLE_RANK[member.role];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-grid size-9 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 data-popup-open:bg-muted data-popup-open:text-foreground"
          aria-label={`Actions for ${fullName(member)}`}
        >
          <MoreHorizontal className="size-4.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={6}
          className="w-64 rounded-xl bg-card p-1.5 text-foreground shadow-lg"
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Role
            </DropdownMenuLabel>
            {TEAM_ROLES.map((role) => {
              const info = ROLE_INFO[role];
              const Icon = info.icon;
              const current = member.role === role;
              const allowed = member.can.roles.includes(role);
              const direction = ROLE_RANK[role] > rank ? "up" : "down";
              return (
                <DropdownMenuItem
                  key={role}
                  disabled={current || !allowed}
                  onClick={() => setPending({ kind: "role", role })}
                  className="group/role h-auto cursor-pointer gap-2.5 rounded-lg px-2 py-1.5 focus:bg-muted focus:text-foreground data-highlighted:bg-muted data-highlighted:text-foreground data-disabled:opacity-100"
                >
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-md",
                      info.bubble,
                      !current && !allowed && "opacity-40",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1",
                      !current && !allowed && "opacity-40",
                    )}
                  >
                    <span className="block text-sm font-medium">
                      {info.label}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {current
                        ? "Current role"
                        : allowed
                          ? direction === "up"
                            ? "Promote"
                            : "Demote"
                          : "Above your role"}
                    </span>
                  </span>
                  {current ? (
                    <Check className="size-4 text-primary" />
                  ) : allowed ? (
                    direction === "up" ? (
                      <ArrowUp className="size-4 text-muted-foreground opacity-0 transition-opacity group-data-highlighted/role:opacity-100" />
                    ) : (
                      <ArrowDown className="size-4 text-muted-foreground opacity-0 transition-opacity group-data-highlighted/role:opacity-100" />
                    )
                  ) : null}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>

          {(member.can.changeStatus || canRemove) && (
            <DropdownMenuSeparator className="my-1.5" />
          )}

          {member.can.changeStatus && (
            <DropdownMenuItem
              onClick={() =>
                setPending({ kind: "status", isActive: !member.isActive })
              }
              className="cursor-pointer gap-2.5 rounded-lg px-2.5 py-2 focus:bg-muted focus:text-foreground data-highlighted:bg-muted data-highlighted:text-foreground"
            >
              <Power
                className={cn(
                  "size-4",
                  member.isActive
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-emerald-600 dark:text-emerald-400",
                )}
              />
              {member.isActive ? "Disable account" : "Enable account"}
            </DropdownMenuItem>
          )}
          {canRemove && (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setPending({ kind: "role", role: "customer" })}
              className="cursor-pointer gap-2.5 rounded-lg px-2.5 py-2"
            >
              <UserMinus className="size-4" />
              Remove from team
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmChange
        member={member}
        change={pending}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && change.mutate(pending)}
        busy={change.isPending}
        name={name}
      />
    </>
  );
}

function ConfirmChange({
  member,
  change,
  onCancel,
  onConfirm,
  busy,
  name,
}: {
  member: TeamMember;
  change: Change | null;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
  name: string;
}) {
  const [shown, setShown] = useState<Change | null>(change);
  if (change && change !== shown) setShown(change);
  const c = change ?? shown;
  if (!c) return null;

  let title: string;
  let description: string;
  let confirmLabel: string;
  let danger = false;
  let body: ReactNode = null;

  if (c.kind === "status") {
    danger = !c.isActive;
    title = c.isActive
      ? `Enable ${name}'s account?`
      : `Disable ${name}'s account?`;
    description = c.isActive
      ? `${name} can sign in again, with the same role as before (${ROLE_INFO[member.role].label}).`
      : `${name} is signed out of every device right away and can't sign in until you enable the account again. Nothing they made is deleted.`;
    confirmLabel = c.isActive ? "Enable account" : "Disable account";
  } else {
    const diff = permissionDiff(member.role, c.role);
    const up = ROLE_RANK[c.role] > ROLE_RANK[member.role];
    danger = !up;
    if (c.role === "customer") {
      title = `Remove ${name} from the team?`;
      description = `${name} loses access to the admin panel on their next click. Their account stays, so they can still book and order on the website.`;
      confirmLabel = "Remove from team";
    } else {
      title = `Make ${name} ${ROLE_INFO[c.role].article}?`;
      description = up
        ? "It takes effect on their next click."
        : "It takes effect on their next click. Nothing they made is deleted.";
      confirmLabel = up
        ? `Promote to ${ROLE_INFO[c.role].label}`
        : `Change to ${ROLE_INFO[c.role].label}`;
    }
    body = (
      <>
        <div className="flex items-center justify-center gap-3 rounded-xl border border-border bg-muted/40 p-3 sm:justify-start">
          <RoleBadge role={member.role} />
          <ArrowRight className="size-4 text-muted-foreground" />
          <RoleBadge role={c.role} />
        </div>
        {(diff.gains.length > 0 || diff.loses.length > 0) && (
          <div className="grid gap-2 text-sm">
            {diff.gains.length > 0 && (
              <PermissionList
                tone="gain"
                title="Gets access to"
                items={diff.gains.map((p) => PERMISSION_LABELS[p])}
              />
            )}
            {diff.loses.length > 0 && (
              <PermissionList
                tone="lose"
                title="Loses access to"
                items={diff.loses.map((p) => PERMISSION_LABELS[p])}
              />
            )}
          </div>
        )}
        {c.role === "admin" && (
          <p className="flex gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            <ShieldAlert className="size-4 shrink-0" />
            Admins can manage the whole team, including you, and change the
            restaurant&apos;s settings.
          </p>
        )}
      </>
    );
  }

  return (
    <AlertDialog
      open={change !== null}
      onOpenChange={(open) => !open && !busy && onCancel()}
    >
      <AlertDialogContent className="text-left sm:max-w-md">
        <AlertDialogHeader>
          <div className="mx-auto mb-1 flex items-center gap-3 sm:mx-0">
            <MemberAvatar
              person={member}
              role={member.role}
              isActive={member.isActive}
              className="size-11 text-base"
            />
          </div>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {body}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button
            variant={danger ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={busy}
            className="min-w-36"
          >
            {busy && <LoaderCircle className="size-4 animate-spin" />}
            {busy ? "Saving…" : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function PermissionList({
  tone,
  title,
  items,
}: {
  tone: "gain" | "lose";
  title: string;
  items: string[];
}) {
  const gain = tone === "gain";
  return (
    <div
      className={cn(
        "rounded-xl px-3 py-2.5",
        gain ? "bg-emerald-500/8" : "bg-destructive/8",
      )}
    >
      <p
        className={cn(
          "text-[11px] font-semibold tracking-wider uppercase",
          gain ? "text-emerald-700 dark:text-emerald-300" : "text-destructive",
        )}
      >
        {title}
      </p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li
            key={item}
            className="inline-flex items-center gap-1 rounded-md bg-card px-2 py-0.5 text-xs font-medium ring-1 ring-border"
          >
            {gain ? (
              <Plus className="size-3 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Minus className="size-3 text-destructive" />
            )}
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

const CANDIDATE_DELAY_MS = 250;

export function AddMemberButton({
  actorRole,
  className,
}: {
  actorRole: Role;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold whitespace-nowrap text-primary-foreground shadow-[0_6px_20px_-6px_color-mix(in_srgb,var(--primary)_70%,transparent)] transition hover:-translate-y-px hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          className,
        )}
      >
        <UserPlus className="size-4.5" />
        Add member
      </button>
      {open && (
        <AddMemberDialog actorRole={actorRole} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function AddMemberDialog({
  actorRole,
  onClose,
}: {
  actorRole: Role;
  onClose: () => void;
}) {
  const roles = assignableTeamRoles(actorRole);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<TeamCandidate | null>(null);
  const [role, setRole] = useState<TeamRole>("staff");

  useEffect(() => {
    const timer = setTimeout(
      () => setQuery(cleanTeamSearch(search)),
      CANDIDATE_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [search]);

  const results = useQuery({
    queryKey: ["team", "candidates", query],
    enabled: query.length >= 2 && !picked,
    staleTime: 30_000,
    queryFn: async () => {
      const result = await searchTeamCandidates(query);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  });

  const add = useMemberChange(
    {
      id: picked?.id ?? "",
      firstName: picked?.firstName ?? "",
      role: "customer",
    },
    onClose,
  );

  const typing = cleanTeamSearch(search) !== query;
  const loading = query.length >= 2 && (typing || results.isFetching);

  return (
    <Dialog open onOpenChange={(open) => !open && !add.isPending && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 text-left sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b border-border p-5 pb-4 pr-12 text-left">
          <DialogTitle className="flex items-center gap-2.5 text-lg">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/12 text-primary">
              <UserPlus className="size-4.5" />
            </span>
            Add a team member
          </DialogTitle>
          <DialogDescription>
            {picked
              ? "Choose what they can do. You can change it any time."
              : "Find someone who already has an account on the website."}
          </DialogDescription>
        </DialogHeader>

        {!picked ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="group relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary" />
              <input
                autoFocus
                type="search"
                autoComplete="off"
                spellCheck={false}
                maxLength={80}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name or email"
                aria-label="Search accounts by name or email"
                className="h-11 w-full rounded-xl border border-border bg-background pr-10 pl-11 text-[15px] outline-none transition placeholder:text-muted-foreground/80 focus:border-primary/60 focus:ring-4 focus:ring-primary/15 [&::-webkit-search-cancel-button]:appearance-none"
              />
              {loading && (
                <LoaderCircle className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>

            <div className="mt-3 min-h-52" aria-live="polite">
              {query.length < 2 ? (
                <Hint
                  icon={<Search className="size-5" />}
                  title="Search by name or email"
                  text="Type at least 2 letters."
                />
              ) : results.isError ? (
                <Hint
                  icon={<ShieldAlert className="size-5" />}
                  title="The search didn't work"
                  text={results.error.message}
                />
              ) : results.data && results.data.length === 0 && !loading ? (
                <Hint
                  icon={<UserPlus className="size-5" />}
                  title={`No account matches “${query}”`}
                  text="Ask them to sign up on the website with their email first, then add them here. People already on the team aren't listed."
                />
              ) : (
                <ul className="space-y-1">
                  {(results.data ?? []).map((person) => (
                    <li key={person.id}>
                      <button
                        type="button"
                        onClick={() => setPicked(person)}
                        className="group flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                      >
                        <MemberAvatar
                          person={person}
                          role="customer"
                          className="size-9 text-xs ring-offset-background"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">
                            {fullName(person)}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {person.email}
                          </span>
                        </span>
                        <span className="rounded-lg px-2 py-1 text-xs font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                          Choose
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
              <MemberAvatar
                person={picked}
                role={role}
                className="size-10 ring-offset-muted"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {fullName(picked)}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {picked.email}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setPicked(null)}
                disabled={add.isPending}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              >
                Change
              </button>
            </div>

            <div role="radiogroup" aria-label="Role" className="grid gap-2">
              {roles.map((option) => {
                const info = ROLE_INFO[option];
                const Icon = info.icon;
                const active = role === option;
                return (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setRole(option)}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-left transition-all",
                      active
                        ? "border-primary/60 bg-primary/6 ring-4 ring-primary/10"
                        : "border-border hover:border-foreground/25 hover:bg-muted/50",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-lg",
                        info.bubble,
                      )}
                    >
                      <Icon className="size-4.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">
                        {info.label}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {info.tagline}
                      </span>
                      <span className="mt-1.5 flex flex-wrap gap-1">
                        {option !== "staff" && (
                          <span className="text-[11px] text-muted-foreground">
                            Everything below, plus
                          </span>
                        )}
                        {roleHighlights(option).map((p) => (
                          <span
                            key={p}
                            className="rounded-md bg-background px-1.5 py-px text-[11px] font-medium ring-1 ring-border"
                          >
                            {PERMISSION_LABELS[p]}
                          </span>
                        ))}
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-foreground/25",
                      )}
                    >
                      {active && <Check className="size-3" strokeWidth={3} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none border-t border-border bg-muted/40 p-4">
          <Button variant="outline" onClick={onClose} disabled={add.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => add.mutate({ kind: "role", role })}
            disabled={!picked || add.isPending}
            className="min-w-36"
          >
            {add.isPending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            {add.isPending ? "Adding…" : `Add as ${ROLE_INFO[role].label}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Hint({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <span className="grid size-11 place-items-center rounded-2xl bg-muted text-muted-foreground">
        {icon}
      </span>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-0.5 max-w-xs text-xs text-muted-foreground">{text}</p>
    </div>
  );
}
