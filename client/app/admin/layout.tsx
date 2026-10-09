import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { getConfig } from "@/config/loader";
import { requireTeam } from "@/lib/auth/get-user";
import { buildAdminNav, SIDEBAR_COOKIE } from "@/admin/lib/nav";
import { AdminShell } from "@/admin/components/layout/AdminShell";

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

  return (
    <AdminShell
      brandName={config.brand.name}
      user={user}
      groups={groups}
      business={{
        hours: config.business.hours,
        specialHours: config.business.specialHours,
        timezone: config.business.timezone,
      }}
      initialCollapsed={collapsed}
      counts={{}}
    >
      {children}
    </AdminShell>
  );
}
