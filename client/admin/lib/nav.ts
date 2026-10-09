import {
  hasPermission,
  type Permission,
  type Role,
} from "@/lib/auth/user-roles";

export type AdminIcon =
  | "overview"
  | "reservations"
  | "orders"
  | "menu"
  | "events"
  | "gallery"
  | "content"
  | "blog"
  | "giftCards"
  | "messages"
  | "subscribers"
  | "team"
  | "settings";

export type AdminNavItem = {
  id: AdminIcon;
  label: string;
  href: string;
  icon: AdminIcon;
};

export type AdminNavGroup = {
  id: string;
  label: string;
  items: AdminNavItem[];
};

export type NavContext = {
  features: Partial<Record<string, boolean>>;
  pages: Partial<Record<string, { enabled: boolean } | undefined>>;
};

type ItemDefinition = AdminNavItem & {
  anyOf: Permission[];
  when?: (ctx: NavContext) => boolean;
};

const page = (name: string) => (ctx: NavContext) =>
  ctx.pages[name]?.enabled === true;
const feature = (name: string) => (ctx: NavContext) =>
  ctx.features[name] === true;

const STRUCTURE: { id: string; label: string; items: ItemDefinition[] }[] = [
  {
    id: "service",
    label: "Service",
    items: [
      {
        id: "overview",
        label: "Overview",
        href: "/admin",
        icon: "overview",
        anyOf: [
          "menu:availability",
          "reservations:manage",
          "orders:manage",
          "menu:manage",
          "content:manage",
          "users:manage",
          "settings:manage",
        ],
      },
      {
        id: "reservations",
        label: "Reservations",
        href: "/admin/reservations",
        icon: "reservations",
        anyOf: ["reservations:manage"],
        when: page("reservations"),
      },
      {
        id: "orders",
        label: "Orders",
        href: "/admin/orders",
        icon: "orders",
        anyOf: ["orders:manage"],
        when: feature("onlineOrdering"),
      },
    ],
  },
  {
    id: "restaurant",
    label: "Restaurant",
    items: [
      {
        id: "menu",
        label: "Menu",
        href: "/admin/menu",
        icon: "menu",
        anyOf: ["menu:manage", "menu:availability"],
        when: page("menu"),
      },
      {
        id: "events",
        label: "Events",
        href: "/admin/events",
        icon: "events",
        anyOf: ["content:manage"],
        when: page("events"),
      },
      {
        id: "gallery",
        label: "Gallery",
        href: "/admin/gallery",
        icon: "gallery",
        anyOf: ["content:manage"],
        when: page("gallery"),
      },
      {
        id: "content",
        label: "Pages & content",
        href: "/admin/content",
        icon: "content",
        anyOf: ["content:manage"],
      },
      {
        id: "blog",
        label: "Journal",
        href: "/admin/blog",
        icon: "blog",
        anyOf: ["content:manage"],
        when: feature("blog"),
      },
    ],
  },
  {
    id: "guests",
    label: "Guests",
    items: [
      {
        id: "messages",
        label: "Messages",
        href: "/admin/messages",
        icon: "messages",
        anyOf: ["content:manage"],
        when: feature("contactForm"),
      },
      {
        id: "subscribers",
        label: "Newsletter",
        href: "/admin/newsletter",
        icon: "subscribers",
        anyOf: ["content:manage"],
        when: feature("newsletter"),
      },
      {
        id: "giftCards",
        label: "Gift cards",
        href: "/admin/gift-cards",
        icon: "giftCards",
        anyOf: ["orders:manage"],
        when: feature("giftCards"),
      },
    ],
  },
  {
    id: "admin",
    label: "Administration",
    items: [
      {
        id: "team",
        label: "Team",
        href: "/admin/team",
        icon: "team",
        anyOf: ["users:manage"],
      },
      {
        id: "settings",
        label: "Settings",
        href: "/admin/settings",
        icon: "settings",
        anyOf: ["settings:manage"],
      },
    ],
  },
];

export function buildAdminNav(
  role: Role | undefined,
  ctx: NavContext,
): AdminNavGroup[] {
  return STRUCTURE.map((group) => ({
    id: group.id,
    label: group.label,
    items: group.items
      .filter((item) =>
        item.anyOf.some((permission) => hasPermission(role, permission)),
      )
      .filter((item) => !item.when || item.when(ctx))
      .map(({ id, label, href, icon }) => ({ id, label, href, icon })),
  })).filter((group) => group.items.length > 0);
}

export function isActiveHref(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export const SIDEBAR_COOKIE = "mesa-admin-sidebar";
