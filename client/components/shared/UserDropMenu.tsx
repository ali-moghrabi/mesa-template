"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  LayoutDashboard,
  Loader2,
  LogOut,
  Receipt,
  Settings,
  Store,
  UserRound,
  UtensilsCrossed,
} from "lucide-react";
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
import { logoutUser } from "@/lib/actions/auth.actions";
import { ADMIN_ROUTE, isMatch, PROTECTED_ROUTES } from "@/lib/auth/routes";
import { canAccessAdmin } from "@/lib/auth/user-roles";
import { useSessionRefresh } from "@/hooks/use-session-refresh";
import { cn } from "@/lib/utils";

export const ACCOUNT_ROUTES = {
  profile: "/account",
  reservations: "/account/reservations",
  orders: "/account/orders",
  settings: "/account/settings",
  bookTable: "/reservations",
} as const;

type UserDropMenuProps = {
  user: IUser;
  reservationsEnabled: boolean;
  orderingEnabled: boolean;
};

const initials = (user: IUser) =>
  `${user.firstName?.charAt(0) ?? ""}${user.lastName?.charAt(0) ?? ""}`.toUpperCase() ||
  "?";

function Avatar({ user, className }: { user: IUser; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-primary font-semibold text-white",
        className,
      )}
    >
      {initials(user)}
    </span>
  );
}

const roleLabel = (role?: string) =>
  role ? role.charAt(0).toUpperCase() + role.slice(1) : "";

function AdminPanelLink({
  role,
  inAdmin,
}: {
  role?: string;
  inAdmin: boolean;
}) {
  const Icon = inAdmin ? Store : LayoutDashboard;
  return (
    <DropdownMenuItem
      render={<Link href={inAdmin ? "/" : ADMIN_ROUTE} />}
      className={cn(
        "group/admin mb-1.5 flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2.5",
        "bg-neutral-700 dark:bg-neutral-200 text-background transition-colors",
        "hover:bg-foreground/90 hover:text-background",
        "focus:bg-foreground/90 focus:text-background data-highlighted:bg-foreground/90 data-highlighted:text-background",
      )}
    >
      <span
        aria-hidden="true"
        className="grid size-9 shrink-0 place-items-center rounded-md bg-background/12 ring-1 ring-background/15"
      >
        <Icon className="size-4.5 text-background" />
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-sm font-semibold">
          {inAdmin ? "View website" : "Admin panel"}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-background/70">
          <span
            className="size-1.5 rounded-full bg-primary"
            aria-hidden="true"
          />
          {inAdmin
            ? "Back to what guests see"
            : `Signed in as ${roleLabel(role)}`}
        </span>
      </span>
      <ArrowUpRight
        aria-hidden="true"
        className="size-4 shrink-0 text-background/60 transition-transform duration-200 group-hover/admin:translate-x-0.5 group-hover/admin:-translate-y-0.5 group-data-highlighted/admin:translate-x-0.5 group-data-highlighted/admin:-translate-y-0.5"
      />
    </DropdownMenuItem>
  );
}

const ITEM =
  "gap-3 rounded-md px-2.5 py-2 text-sm cursor-pointer [&_svg]:size-4 [&_svg]:text-muted-foreground";

const UserDropMenu: React.FC<UserDropMenuProps> = ({
  user,
  reservationsEnabled,
  orderingEnabled,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const { syncSession } = useSessionRefresh();
  const [signingOut, setSigningOut] = useState(false);

  const fullName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  const isTeam = canAccessAdmin(user.role);
  const inAdmin = isMatch(pathname, [ADMIN_ROUTE]);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await logoutUser();
      toast.add({ title: "Signed out. See you soon!", type: "success" });

      if (inAdmin || isMatch(pathname, PROTECTED_ROUTES)) {
        router.push("/");
        router.refresh();
      } else {
        await syncSession();
      }
    } catch {
      toast.add({
        title: "Could not sign out. Please try again.",
        type: "error",
      });
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${fullName}`}
        className={cn(
          "group flex cursor-pointer items-center gap-1.5 bg-neutral-50/10 rounded-full p-0.5 pr-2 outline-none transition-colors backdrop-blur-sm",
          "hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-primary/50 data-popup-open:bg-primary/25",
        )}
      >
        <Avatar
          user={user}
          className="size-8 text-[13px] ring-2 ring-primary/70"
        />
        <ChevronDown
          aria-hidden="true"
          className="size-3.5 opacity-70 transition-transform duration-200 group-data-popup-open:rotate-180"
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={10}
        side="bottom"
        className="w-72 overflow-hidden p-0"
      >
        <div className="flex items-center gap-3 bg-primary/8 px-4 py-4">
          <Avatar user={user} className="size-11 text-base" />
          <div className="min-w-0">
            <p className="truncate font-semibold leading-tight">{fullName}</p>
            {user.email && (
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            )}
          </div>
        </div>

        <div className="p-1.5">
          {isTeam && <AdminPanelLink role={user.role} inAdmin={inAdmin} />}

          {reservationsEnabled && (
            <DropdownMenuItem
              render={<Link href={ACCOUNT_ROUTES.bookTable} />}
              className={cn(
                ITEM,
                "mb-1 justify-center bg-primary font-medium text-white hover:bg-primary/90 focus:bg-primary/90 transition hover:text-white focus:text-white",
              )}
            >
              <UtensilsCrossed aria-hidden="true" />
              Book a table
            </DropdownMenuItem>
          )}

          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-2.5 pt-2 pb-1 text-xs font-medium text-muted-foreground">
              Your account
            </DropdownMenuLabel>
            <DropdownMenuItem
              render={<Link href={ACCOUNT_ROUTES.profile} />}
              className={ITEM}
            >
              <UserRound aria-hidden="true" />
              Profile
            </DropdownMenuItem>
            {reservationsEnabled && (
              <DropdownMenuItem
                render={<Link href={ACCOUNT_ROUTES.reservations} />}
                className={ITEM}
              >
                <CalendarDays aria-hidden="true" />
                My reservations
              </DropdownMenuItem>
            )}
            {orderingEnabled && (
              <DropdownMenuItem
                render={<Link href={ACCOUNT_ROUTES.orders} />}
                className={ITEM}
              >
                <Receipt aria-hidden="true" />
                My orders
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              render={<Link href={ACCOUNT_ROUTES.settings} />}
              className={ITEM}
            >
              <Settings aria-hidden="true" />
              Settings
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator className="my-1.5" />

          <DropdownMenuItem
            variant="destructive"
            disabled={signingOut}
            closeOnClick={false}
            onClick={signOut}
            className={ITEM}
          >
            <LogOut aria-hidden="true" />
            {signingOut ? (
              <Loader2 aria-hidden="true" className="animate-spin" />
            ) : (
              "Sign out"
            )}
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserDropMenu;
