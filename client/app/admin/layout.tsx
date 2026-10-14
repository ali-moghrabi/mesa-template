import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { ThemeProvider } from "next-themes";
import { getConfig } from "@/config/loader";
import { getOpeningHours } from "@/lib/opening-hours-server";
import { requireTeam } from "@/lib/auth/get-user";
import { AdminShell } from "@/admin/components/layout/AdminShell";
import { buildAdminNav, SIDEBAR_COOKIE } from "@/admin/lib/nav";
import { hasPermission } from "@/lib/auth/user-roles";
import { OrderAlerts } from "@/admin/components/orders/OrderAlerts";
import QueryWrapper from "@/components/providers/query-wrapper";
import { adminFetch } from "@/admin/lib/menu/api";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireTeam();
  const config = getConfig();
  const collapsed =
    (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";

  const groups = buildAdminNav(user.role, {
    features: config.features,
    pages: config.pages as Record<string, { enabled: boolean } | undefined>,
  });

  const pending =
    config.pages?.reservations?.enabled &&
    hasPermission(user.role, "reservations:view")
      ? await adminFetch<{ count: number }>("/admin/reservations/pending-count")
      : null;

  const unread =
    config.features?.contactForm && hasPermission(user.role, "content:manage")
      ? await adminFetch<{ count: number }>("/admin/messages/unread-count")
      : null;

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="mesa-admin-theme"
      disableTransitionOnChange
    >
      <QueryWrapper>
        <AdminShell
          brandName={config.brand.name}
          user={user}
          groups={groups}
          business={{ hours: await getOpeningHours() }}
          initialCollapsed={collapsed}
          counts={{
            ...(pending?.ok &&
              pending.data.count > 0 && { reservations: pending.data.count }),
            ...(unread?.ok &&
              unread.data.count > 0 && { messages: unread.data.count }),
          }}
        >
          {children}
          {config.features?.onlineOrdering &&
            hasPermission(user.role, "orders:manage") && <OrderAlerts />}
        </AdminShell>
      </QueryWrapper>
    </ThemeProvider>
  );
}
