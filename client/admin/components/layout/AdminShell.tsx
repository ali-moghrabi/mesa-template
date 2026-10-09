"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  CalendarDays,
  ChefHat,
  ExternalLink,
  FileText,
  Gift,
  Images,
  LayoutDashboard,
  Loader2,
  LogOut,
  Mail,
  Menu as MenuIcon,
  MessageSquare,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  PartyPopper,
  Receipt,
  Settings,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import type { SiteConfig } from "@/config/schema";
import { logoutUser } from "@/lib/actions/auth.actions";
import { cn } from "@/lib/utils";
import {
  isActiveHref,
  SIDEBAR_COOKIE,
  type AdminIcon,
  type AdminNavGroup,
} from "../../lib/nav";
import { ServiceStatus } from "../shared/ServiceStatus";
import { ModeToggle } from "@/components/ui/mode-toggle";

const ICONS: Record<AdminIcon, LucideIcon> = {
  overview: LayoutDashboard,
  reservations: CalendarDays,
  orders: Receipt,
  menu: ChefHat,
  events: PartyPopper,
  gallery: Images,
  content: FileText,
  blog: Newspaper,
  giftCards: Gift,
  messages: MessageSquare,
  subscribers: Mail,
  team: Users,
  settings: Settings,
};

export type AdminShellProps = {
  brandName: string;
  user: Pick<IUser, "firstName" | "lastName" | "email" | "role">;
  groups: AdminNavGroup[];
  business: Pick<SiteConfig["business"], "hours" | "specialHours" | "timezone">;
  initialCollapsed: boolean;
  counts?: Partial<Record<AdminIcon, number>>;
  children: ReactNode;
};

const initials = (u: AdminShellProps["user"]) =>
  `${u.firstName?.charAt(0) ?? ""}${u.lastName?.charAt(0) ?? ""}`.toUpperCase() ||
  "?";

const roleLabel = (role?: string) =>
  role ? role.charAt(0).toUpperCase() + role.slice(1) : "";

export function AdminShell({
  brandName,
  user,
  groups,
  business,
  initialCollapsed,
  counts = {},
  children,
}: AdminShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  const [drawerOpenedOn, setDrawerOpenedOn] = useState<string | null>(null);
  const mobileOpen = drawerOpenedOn === pathname;
  const openDrawer = () => setDrawerOpenedOn(pathname);
  const closeDrawer = useCallback(() => setDrawerOpenedOn(null), []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((value) => {
      const next = !value;
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/admin; max-age=31536000; samesite=lax`;
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggleCollapsed();
      }
      if (event.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleCollapsed, closeDrawer]);

  useEffect(() => {
    document.documentElement.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [mobileOpen]);

  const content = (compact: boolean, onCollapse?: () => void) => (
    <SidebarContent
      compact={compact}
      onToggleCollapse={onCollapse}
      brandName={brandName}
      user={user}
      groups={groups}
      business={business}
      counts={counts}
      pathname={pathname}
    />
  );

  return (
    <div
      className={cn(
        "min-h-svh bg-background text-foreground lg:flex",
        "[--sidebar:color-mix(in_srgb,var(--background),var(--text,var(--foreground))_4%)]",
        "[--sidebar-accent:color-mix(in_srgb,var(--background),var(--text,var(--foreground))_8%)]",
        "[--sidebar-foreground:var(--text,var(--foreground))] [--sidebar-border:var(--border)]",
      )}
    >
      <aside
        aria-label="Admin"
        className={cn(
          "sticky top-0 z-20 hidden h-svh shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
          "transition-[width] duration-300 ease-out motion-reduce:transition-none lg:flex",
          collapsed ? "w-19" : "w-68",
        )}
      >
        {content(collapsed, toggleCollapsed)}
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md lg:hidden">
        <button
          type="button"
          onClick={openDrawer}
          aria-label="Open admin menu"
          aria-expanded={mobileOpen}
          aria-controls="admin-drawer"
          className="-ml-1.5 grid size-10 place-items-center rounded-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 cursor-pointer"
        >
          <MenuIcon aria-hidden="true" className="size-5" />
        </button>
        <BrandMark name={brandName} />
        <span className="truncate font-semibold">{brandName}</span>
      </header>

      <div
        aria-hidden="true"
        onClick={closeDrawer}
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        id="admin-drawer"
        aria-label="Admin"
        inert={!mobileOpen}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a")) closeDrawer();
        }}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[288px] max-w-[85vw] flex-col bg-sidebar text-sidebar-foreground shadow-2xl",
          "transition-transform duration-300 ease-out motion-reduce:transition-none lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <button
          type="button"
          onClick={closeDrawer}
          aria-label="Close admin menu"
          className="absolute top-4 right-3 grid size-9 place-items-center rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
        {content(false)}
      </aside>

      <main id="admin-main" className="flex-1">
        {children}
      </main>
    </div>
  );
}

type SidebarContentProps = Omit<
  AdminShellProps,
  "initialCollapsed" | "children"
> & {
  compact: boolean;
  onToggleCollapse?: () => void;
  pathname: string;
  counts: Partial<Record<AdminIcon, number>>;
};

function SidebarContent({
  compact,
  onToggleCollapse,
  brandName,
  user,
  groups,
  business,
  counts,
  pathname,
}: SidebarContentProps) {
  return (
    <>
      <div
        className={cn(
          "flex h-16 shrink-0 items-center gap-3",
          compact ? "justify-center px-2" : "px-4",
        )}
      >
        <BrandMark name={brandName} />
        {!compact && (
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold">{brandName}</p>
            <p className="text-xs text-muted-foreground">Restaurant admin</p>
          </div>
        )}
        {!compact && onToggleCollapse && (
          <CollapseButton collapsed={false} onClick={onToggleCollapse} />
        )}
      </div>

      {compact && onToggleCollapse && (
        <div className="flex justify-center pb-2">
          <CollapseButton collapsed onClick={onToggleCollapse} />
        </div>
      )}

      {!compact && (
        <div className="px-3 pb-3">
          <ServiceStatus
            hours={business.hours}
            specialHours={business.specialHours}
            timezone={business.timezone}
          />
        </div>
      )}

      <nav
        aria-label="Admin sections"
        className={cn(
          "flex-1 px-3 pb-3",
          compact ? "overflow-visible" : "overflow-y-auto overscroll-contain",
        )}
      >
        {groups.map((group, index) => (
          <div
            key={group.id}
            className={cn(
              index > 0 &&
                (compact
                  ? "mt-2.5 border-t border-sidebar-border pt-2.5"
                  : "mt-4"),
            )}
          >
            {!compact && (
              <p className="mb-1 px-3 text-xs font-medium text-muted-foreground">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.id}>
                  <NavLink
                    href={item.href}
                    label={item.label}
                    Icon={ICONS[item.icon]}
                    active={isActiveHref(pathname, item.href)}
                    count={counts[item.id]}
                    compact={compact}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div
        className={cn(
          "shrink-0 space-y-2 border-t border-sidebar-border p-3",
          compact && "flex flex-col items-center",
        )}
      >
        <div className={cn("flex items-center gap-1", compact && "flex-col")}>
          <Link
            href="/"
            className={cn(
              "group/site relative flex h-9 items-center gap-3 rounded-lg text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              compact ? "w-9 justify-center" : "flex-1 px-3",
            )}
          >
            <ExternalLink aria-hidden="true" className="size-4.5 shrink-0" />
            <span className={cn(compact && "sr-only")}>View website</span>
            {compact && <Tooltip label="View website" group="site" />}
          </Link>
          <ModeToggle />
        </div>

        <UserCard user={user} compact={compact} />
      </div>
    </>
  );
}

function NavLink({
  href,
  label,
  Icon,
  active,
  count,
  compact,
}: {
  href: string;
  label: string;
  Icon: LucideIcon;
  active: boolean;
  count?: number;
  compact: boolean;
}) {
  const badge =
    count && count > 0 ? (count > 99 ? "99+" : String(count)) : null;

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group/item relative flex h-9 items-center gap-3 rounded-lg text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        compact ? "mx-auto w-9 justify-center" : "px-3",
        active
          ? "bg-primary/10 text-primary dark:bg-primary/15"
          : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground",
      )}
    >
      {active && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-2 bottom-2 w-0.75 rounded-r-full bg-primary",
            compact ? "-left-4.75" : "-left-3",
          )}
        />
      )}

      <Icon aria-hidden="true" className="size-4.5 shrink-0" />
      <span className={cn("truncate", compact && "sr-only")}>{label}</span>

      {badge && !compact && (
        <span className="ml-auto min-w-5 rounded-full bg-primary px-1.5 py-px text-center text-[11px] font-semibold text-primary-foreground tabular-nums">
          {badge}
          <span className="sr-only"> waiting</span>
        </span>
      )}
      {badge && compact && (
        <span
          aria-hidden="true"
          className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary ring-2 ring-sidebar"
        />
      )}
      {compact && (
        <Tooltip label={badge ? `${label} · ${badge}` : label} group="item" />
      )}
    </Link>
  );
}

function Tooltip({ label, group }: { label: string; group: "item" | "site" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute left-full z-50 ml-3 rounded-md bg-foreground px-2 py-1 text-xs font-medium whitespace-nowrap text-background shadow-lg",
        "translate-x-1 opacity-0 transition-all duration-150",
        group === "item"
          ? "group-hover/item:translate-x-0 group-hover/item:opacity-100 group-focus-visible/item:translate-x-0 group-focus-visible/item:opacity-100"
          : "group-hover/site:translate-x-0 group-hover/site:opacity-100 group-focus-visible/site:translate-x-0 group-focus-visible/site:opacity-100",
      )}
    >
      {label}
    </span>
  );
}

function BrandMark({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-primary text-[15px] font-bold text-white shadow-sm ring-1 ring-black/5"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function CollapseButton({
  collapsed,
  onClick,
}: {
  collapsed: boolean;
  onClick: () => void;
}) {
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={
        collapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"
      }
      className="cursor-pointer grid size-8 shrink-0 place-items-center rounded-lg text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      <Icon aria-hidden="true" className="size-4.5" />
    </button>
  );
}

function UserCard({
  user,
  compact,
}: {
  user: AdminShellProps["user"];
  compact: boolean;
}) {
  const [signingOut, setSigningOut] = useState(false);
  const fullName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();

  const signOut = async () => {
    setSigningOut(true);
    try {
      await logoutUser();
    } finally {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    }
  };

  const avatar = (
    <span
      aria-hidden="true"
      className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground text-[13px] font-semibold text-background"
    >
      {initials(user)}
    </span>
  );

  const signOutButton = (
    <button
      type="button"
      onClick={signOut}
      disabled={signingOut}
      aria-label="Sign out"
      className="cursor-pointer grid size-9 shrink-0 place-items-center rounded-lg text-sidebar-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-60"
    >
      {signingOut ? (
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
      ) : (
        <LogOut aria-hidden="true" className="size-4" />
      )}
    </button>
  );

  if (compact) {
    return (
      <div
        className="flex flex-col items-center gap-1 pt-1"
        title={`${fullName} (${roleLabel(user.role)})`}
      >
        {avatar}
        {signOutButton}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent/60 p-2 pr-1">
      {avatar}
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-semibold">{fullName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {roleLabel(user.role)}
        </p>
      </div>
      {signOutButton}
    </div>
  );
}
