import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { ThemeProvider } from "next-themes";
import { getConfig } from "@/config/loader";
import { getOpeningHours } from "@/lib/opening-hours-server";
import { requireTeam } from "@/lib/auth/get-user";
import { AdminShell } from "@/admin/components/layout/AdminShell";
import { buildAdminNav, SIDEBAR_COOKIE } from "@/admin/lib/nav";

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
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="mesa-admin-theme"
      disableTransitionOnChange
    >
      <AdminShell
        brandName={config.brand.name}
        user={user}
        groups={groups}
        business={{ hours: await getOpeningHours() }}
        initialCollapsed={collapsed}
        counts={{}}
      >
        {children}
      </AdminShell>
    </ThemeProvider>
  );
}
