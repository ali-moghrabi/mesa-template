import {
  Briefcase,
  ChefHat,
  Crown,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import {
  ROLE_PERMISSIONS,
  ROLE_RANK,
  type Permission,
  type Role,
} from "@/lib/auth/user-roles";
import type { PaginationMeta } from "@/admin/lib/menu/types";

export const TEAM_PAGE_PATH = "/admin/team";

export const TEAM_ROLES = [
  "admin",
  "manager",
  "staff",
] as const satisfies readonly Role[];
export type TeamRole = (typeof TEAM_ROLES)[number];

export type TeamMember = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: Role;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLoginAt?: string;
  createdAt: string;
  isYou: boolean;
  can: { roles: Role[]; changeStatus: boolean };
  lockedReason?: string;
};

export type TeamList = {
  items: TeamMember[];
  meta: PaginationMeta;
  totals: {
    all: number;
    admin: number;
    manager: number;
    staff: number;
    disabled: number;
  };
};

export type TeamCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: string;
};

export type TeamFilters = {
  search: string;
  role: TeamRole | "";
  status: "" | "active" | "disabled";
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? "";

export const cleanTeamSearch = (value: string) =>
  value.replace(/\s+/g, " ").trim().slice(0, 80);

export function parseTeamFilters(params: RawParams): TeamFilters {
  const role = first(params.role);
  const status = first(params.status);
  const page = Number.parseInt(first(params.page), 10);
  return {
    search: cleanTeamSearch(first(params.q)),
    role: (TEAM_ROLES as readonly string[]).includes(role)
      ? (role as TeamRole)
      : "",
    status: status === "active" || status === "disabled" ? status : "",
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 1000) : 1,
  };
}

export function teamHref(
  filters: TeamFilters,
  changes: Partial<TeamFilters> = {},
): string {
  const next = { ...filters, page: 1, ...changes };
  const query = new URLSearchParams();
  if (next.search) query.set("q", next.search);
  if (next.role) query.set("role", next.role);
  if (next.status) query.set("status", next.status);
  if (next.page > 1) query.set("page", String(next.page));
  const qs = query.toString();
  return qs ? `${TEAM_PAGE_PATH}?${qs}` : TEAM_PAGE_PATH;
}

export function toTeamQuery(filters: TeamFilters): URLSearchParams {
  const query = new URLSearchParams({ page: String(filters.page) });
  if (filters.search) query.set("search", filters.search);
  if (filters.role) query.set("role", filters.role);
  if (filters.status) query.set("status", filters.status);
  return query;
}

export type RoleInfo = {
  label: string;
  article: string;
  tagline: string;
  icon: LucideIcon;
  badge: string;
  bubble: string;
  ring: string;
};

export const ROLE_INFO: Record<Role, RoleInfo> = {
  admin: {
    label: "Admin",
    article: "an admin",
    tagline: "Runs everything, including the team and settings.",
    icon: Crown,
    badge: "bg-primary/12 text-primary ring-primary/25",
    bubble: "bg-primary/12 text-primary",
    ring: "ring-primary/45",
  },
  manager: {
    label: "Manager",
    article: "a manager",
    tagline: "Edits the menu, events and website content.",
    icon: Briefcase,
    badge: "bg-sky-500/12 text-sky-700 ring-sky-500/25 dark:text-sky-300",
    bubble: "bg-sky-500/12 text-sky-600 dark:text-sky-400",
    ring: "ring-sky-500/45",
  },
  staff: {
    label: "Staff",
    article: "staff",
    tagline: "Runs service: bookings, orders, sold-out dishes.",
    icon: ChefHat,
    badge:
      "bg-emerald-500/12 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300",
    bubble: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/45",
  },
  customer: {
    label: "Guest",
    article: "a guest",
    tagline: "A website account, no access to the admin panel.",
    icon: UserRound,
    badge: "bg-foreground/8 text-muted-foreground ring-foreground/15",
    bubble: "bg-foreground/8 text-muted-foreground",
    ring: "ring-foreground/20",
  },
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  "menu:availability": "Mark dishes sold out",
  "menu:manage": "Edit the menu",
  "reservations:manage": "Reservations",
  "orders:manage": "Online orders",
  "content:manage": "Events, gallery & pages",
  "users:manage": "Manage the team",
  "settings:manage": "Restaurant settings",
};

export function roleHighlights(role: Role): Permission[] {
  const below = TEAM_ROLES.find((r) => ROLE_RANK[r] === ROLE_RANK[role] - 1);
  const base = below ? ROLE_PERMISSIONS[below] : [];
  return ROLE_PERMISSIONS[role].filter((p) => !base.includes(p));
}

export function permissionDiff(
  from: Role,
  to: Role,
): { gains: Permission[]; loses: Permission[] } {
  const before = ROLE_PERMISSIONS[from];
  const after = ROLE_PERMISSIONS[to];
  return {
    gains: after.filter((p) => !before.includes(p)),
    loses: before.filter((p) => !after.includes(p)),
  };
}

export const assignableTeamRoles = (role: Role): TeamRole[] =>
  TEAM_ROLES.filter((r) => ROLE_RANK[r] <= ROLE_RANK[role]);

export const fullName = (person: { firstName: string; lastName: string }) =>
  `${person.firstName} ${person.lastName}`.trim();
