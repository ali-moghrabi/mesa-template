import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Info,
  MailWarning,
  Power,
  SearchX,
  TriangleAlert,
  UsersRound,
  X,
} from "lucide-react";
import { getConfig } from "@/config/loader";
import { requireTeam } from "@/lib/auth/get-user";
import { cn } from "@/lib/utils";
import { adminFetch } from "@/admin/lib/menu/api";
import {
  fullName,
  parseTeamFilters,
  PERMISSION_LABELS,
  ROLE_INFO,
  roleHighlights,
  TEAM_PAGE_PATH,
  TEAM_ROLES,
  teamHref,
  toTeamQuery,
  type TeamFilters,
  type TeamList,
  type TeamMember,
} from "@/admin/lib/team/team";
import {
  AddMemberButton,
  MemberActions,
  MemberAvatar,
  RoleBadge,
  TeamToolbar,
} from "@/admin/components/team/TeamClient";
import QueryWrapper from "@/components/providers/query-wrapper";

export function generateMetadata(): Metadata {
  const { brand } = getConfig();
  return { title: `Team | ${brand.name} Admin` };
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TeamPage({ searchParams }: Props) {
  const user = await requireTeam("users:manage");
  const filters = parseTeamFilters(await searchParams);
  const { business } = getConfig();
  const result = await adminFetch<TeamList>("/admin/team", {
    query: toTeamQuery(filters),
  });

  if (
    result.ok &&
    result.data.items.length === 0 &&
    result.data.meta.total > 0 &&
    filters.page > result.data.meta.totalPages
  ) {
    redirect(teamHref(filters, { page: result.data.meta.totalPages }));
  }

  const totals = result.ok
    ? result.data.totals
    : { all: 0, admin: 0, manager: 0, staff: 0, disabled: 0 };
  const dates = new Dates(business.timezone);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-8">
      <header className="flex flex-col gap-4 pt-6 pb-6 sm:flex-row sm:items-end sm:justify-between lg:pt-10">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            Administration
          </p>
          <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-tight sm:text-3xl">
            Team
          </h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-[15px]">
            {totals.all === 0
              ? "Everyone who can open the admin panel, and what they can do."
              : `${totals.all} ${totals.all === 1 ? "person" : "people"} can open the admin panel${totals.disabled ? ` · ${totals.disabled} disabled` : ""}.`}
          </p>
        </div>
        <QueryWrapper>
          <AddMemberButton actorRole={user.role} className="w-full sm:w-auto" />
        </QueryWrapper>
      </header>

      <RoleCards totals={totals} filters={filters} />

      <div className="mt-6">
        <TeamToolbar filters={filters} disabledCount={totals.disabled} />
      </div>

      <div className="mt-4">
        {!result.ok ? (
          <StateCard
            icon={<TriangleAlert className="size-6" />}
            tone="bg-destructive/10 text-destructive"
            title="The team didn't load"
            text={result.message}
            action={
              <Link
                href={teamHref(filters, { page: filters.page })}
                className={secondaryButton}
              >
                Try again
              </Link>
            }
          />
        ) : result.data.items.length === 0 ? (
          <EmptyResults filters={filters} />
        ) : (
          <MemberList data={result.data} filters={filters} dates={dates} />
        )}
      </div>

      <aside className="mt-8 flex gap-3 rounded-2xl border border-border bg-card/60 p-4 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          Role changes apply on the person&apos;s next click. Disabling an
          account signs it out of every device. Nobody can change their own
          account or give a role above their own, and there is always at least
          one active admin.
        </p>
      </aside>
    </div>
  );
}

function RoleCards({
  totals,
  filters,
}: {
  totals: TeamList["totals"];
  filters: TeamFilters;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {TEAM_ROLES.map((role) => {
        const info = ROLE_INFO[role];
        const Icon = info.icon;
        const active = filters.role === role;
        const count = totals[role];
        return (
          <Link
            key={role}
            href={teamHref(filters, { role: active ? "" : role })}
            scroll={false}
            aria-current={active ? "true" : undefined}
            className={cn(
              "group relative flex flex-col overflow-hidden rounded-2xl border bg-card p-3 transition-all sm:p-4",
              "hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              active
                ? cn("border-transparent shadow-sm ring-2", info.ring)
                : "border-border",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span
                className={cn(
                  "grid size-9 place-items-center rounded-xl sm:size-10",
                  info.bubble,
                )}
              >
                <Icon className="size-4.5 sm:size-5" />
              </span>
              {active && (
                <span className="hidden rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold tracking-wide text-background uppercase sm:inline">
                  Showing
                </span>
              )}
            </div>
            <p className="mt-3 text-xl leading-tight font-semibold tracking-tight tabular-nums sm:text-[28px]">
              {count}
            </p>
            <p className="text-xs font-medium text-muted-foreground sm:text-sm sm:text-foreground">
              {count === 1 || role === "staff" ? info.label : `${info.label}s`}
            </p>
            <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">
              {info.tagline}
            </p>
            <ul className="mt-3 hidden flex-wrap gap-1 sm:flex">
              {role !== "staff" && (
                <li className="py-px text-[11px] text-muted-foreground">
                  Everything below, plus
                </li>
              )}
              {roleHighlights(role).map((permission) => (
                <li
                  key={permission}
                  className="rounded-md bg-muted px-1.5 py-px text-[11px] font-medium text-foreground/75"
                >
                  {PERMISSION_LABELS[permission]}
                </li>
              ))}
            </ul>
          </Link>
        );
      })}
    </div>
  );
}

function MemberList({
  data,
  filters,
  dates,
}: {
  data: TeamList;
  filters: TeamFilters;
  dates: Dates;
}) {
  const { items, meta } = data;
  return (
    <section aria-label="Team members">
      <div className="mb-3 flex min-h-8 flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          <span className="font-semibold text-foreground tabular-nums">
            {meta.total}
          </span>{" "}
          {meta.total === 1 ? "person" : "people"}
          {filters.search && (
            <>
              {" "}
              matching{" "}
              <span className="font-medium text-foreground">
                “{filters.search}”
              </span>
            </>
          )}
        </p>
        {filters.role && (
          <Link
            href={teamHref(filters, { role: "" })}
            scroll={false}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card py-1 pr-2 pl-3 text-xs font-medium transition-colors hover:bg-muted"
          >
            Only {ROLE_INFO[filters.role].label.toLowerCase()}
            <X className="size-3.5 text-muted-foreground" />
            <span className="sr-only">Show every role</span>
          </Link>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
        <table className="hidden w-full text-sm lg:table">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              <th scope="col" className="py-2.5 pr-3 pl-5 font-semibold">
                Member
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold">
                Role
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold">
                Status
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold">
                Last sign-in
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold">
                Joined
              </th>
              <th scope="col" className="w-14 py-2.5 pr-5 pl-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((member) => (
              <tr
                key={member.id}
                className={cn(
                  "transition-colors hover:bg-muted/40",
                  member.isYou && "bg-primary/3",
                )}
              >
                <td className="py-3 pr-3 pl-5">
                  <div className="flex min-w-0 items-center gap-3.5">
                    <MemberAvatar
                      person={member}
                      role={member.role}
                      isActive={member.isActive}
                    />
                    <MemberName member={member} />
                  </div>
                </td>
                <td className="px-3 py-3">
                  <RoleBadge role={member.role} />
                </td>
                <td className="px-3 py-3">
                  <StatusPill member={member} />
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                  <LastSeen member={member} dates={dates} />
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-muted-foreground tabular-nums">
                  {dates.day(member.createdAt)}
                </td>
                <td className="py-3 pr-5 pl-3 text-right">
                  <QueryWrapper>
                    <MemberActions member={member} />
                  </QueryWrapper>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <ul className="divide-y divide-border lg:hidden">
          {items.map((member) => (
            <li
              key={member.id}
              className={cn("flex gap-3.5 p-4", member.isYou && "bg-primary/3")}
            >
              <MemberAvatar
                person={member}
                role={member.role}
                isActive={member.isActive}
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <MemberName member={member} />
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <RoleBadge role={member.role} />
                  <StatusPill member={member} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  <LastSeen member={member} dates={dates} /> · Joined{" "}
                  {dates.day(member.createdAt)}
                </p>
              </div>
              <div className="-mt-1 -mr-2 shrink-0">
                <QueryWrapper>
                  <MemberActions member={member} />
                </QueryWrapper>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <Pagination filters={filters} meta={meta} />
    </section>
  );
}

function MemberName({ member }: { member: TeamMember }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-2">
        <span
          className={cn(
            "truncate font-semibold",
            !member.isActive && "text-muted-foreground",
          )}
        >
          {fullName(member)}
        </span>
        {member.isYou && (
          <span className="shrink-0 rounded-md bg-foreground px-1.5 py-px text-[10px] font-semibold tracking-wide text-background uppercase">
            You
          </span>
        )}
      </p>
      <p className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
        <span className="truncate">{member.email}</span>
        {!member.isEmailVerified && (
          <span
            title="Email not verified yet"
            className="shrink-0 text-amber-600 dark:text-amber-400"
          >
            <MailWarning className="size-3.5" />
            <span className="sr-only">Email not verified yet</span>
          </span>
        )}
      </p>
    </div>
  );
}

function StatusPill({ member }: { member: TeamMember }) {
  if (!member.isActive) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/12 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-amber-700 dark:text-amber-300">
        <Power className="size-3" />
        Disabled
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-emerald-700 dark:text-emerald-300">
      <span className="size-1.5 rounded-full bg-emerald-500" />
      Active
    </span>
  );
}

function LastSeen({ member, dates }: { member: TeamMember; dates: Dates }) {
  if (!member.lastLoginAt)
    return <span className="italic">Never signed in</span>;
  return (
    <time dateTime={member.lastLoginAt} title={dates.full(member.lastLoginAt)}>
      {dates.ago(member.lastLoginAt)}
    </time>
  );
}

function EmptyResults({ filters }: { filters: TeamFilters }) {
  if (filters.search) {
    return (
      <StateCard
        icon={<SearchX className="size-6" />}
        title={`Nobody matches “${filters.search}”`}
        text="Check the spelling or search by email. To add someone new, use Add member."
        action={
          <Link
            href={teamHref(filters, { search: "" })}
            scroll={false}
            className={secondaryButton}
          >
            Clear search
          </Link>
        }
      />
    );
  }
  return (
    <StateCard
      icon={<UsersRound className="size-6" />}
      title={
        filters.status === "disabled" ? "No disabled accounts" : "Nobody here"
      }
      text={
        filters.status === "disabled"
          ? "Everyone on the team can sign in."
          : "Nobody fits these filters right now."
      }
      action={
        <Link href={TEAM_PAGE_PATH} scroll={false} className={secondaryButton}>
          Show the whole team
        </Link>
      }
    />
  );
}

const secondaryButton =
  "inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3.5 text-sm font-medium shadow-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50";

function StateCard({
  icon,
  tone = "bg-muted text-muted-foreground",
  title,
  text,
  action,
}: {
  icon: ReactNode;
  tone?: string;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center">
      <span className={cn("grid size-14 place-items-center rounded-2xl", tone)}>
        {icon}
      </span>
      <h2 className="mt-4 text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function Pagination({
  filters,
  meta,
}: {
  filters: TeamFilters;
  meta: TeamList["meta"];
}) {
  if (meta.totalPages <= 1) return null;
  const step =
    "inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-3 text-sm font-medium shadow-xs transition-colors";
  return (
    <nav
      aria-label="Pages"
      className="mt-5 flex items-center justify-between gap-2"
    >
      {meta.hasPreviousPage ? (
        <Link
          href={teamHref(filters, { page: meta.page - 1 })}
          scroll={false}
          rel="prev"
          className={cn(step, "hover:bg-muted")}
        >
          <ChevronLeft className="size-4" /> Previous
        </Link>
      ) : (
        <span
          aria-disabled
          className={cn(step, "cursor-not-allowed opacity-45")}
        >
          <ChevronLeft className="size-4" /> Previous
        </span>
      )}
      <span className="text-sm text-muted-foreground tabular-nums">
        Page <span className="font-semibold text-foreground">{meta.page}</span>{" "}
        of {meta.totalPages}
      </span>
      {meta.hasNextPage ? (
        <Link
          href={teamHref(filters, { page: meta.page + 1 })}
          scroll={false}
          rel="next"
          className={cn(step, "hover:bg-muted")}
        >
          Next <ChevronRight className="size-4" />
        </Link>
      ) : (
        <span
          aria-disabled
          className={cn(step, "cursor-not-allowed opacity-45")}
        >
          Next <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}

class Dates {
  private readonly dayFormat: Intl.DateTimeFormat;
  private readonly fullFormat: Intl.DateTimeFormat;
  private readonly relative = new Intl.RelativeTimeFormat("en", {
    numeric: "auto",
  });
  private readonly now = Date.now();

  constructor(timeZone: string) {
    this.dayFormat = new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeZone,
    });
    this.fullFormat = new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone,
    });
  }

  day = (iso: string) => this.dayFormat.format(new Date(iso));
  full = (iso: string) => this.fullFormat.format(new Date(iso));

  ago = (iso: string) => {
    const seconds = (new Date(iso).getTime() - this.now) / 1000;
    if (Math.abs(seconds) < 60) return "Just now";
    const units: [Intl.RelativeTimeFormatUnit, number][] = [
      ["minute", 60],
      ["hour", 3600],
      ["day", 86400],
      ["week", 604800],
      ["month", 2629800],
      ["year", 31557600],
    ];
    let unit = units[0];
    for (const candidate of units)
      if (Math.abs(seconds) >= candidate[1]) unit = candidate;
    const text = this.relative.format(Math.round(seconds / unit[1]), unit[0]);
    return text.charAt(0).toUpperCase() + text.slice(1);
  };
}
