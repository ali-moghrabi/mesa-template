import type { Metadata } from "next";
import { TriangleAlert } from "lucide-react";
import { getConfig } from "@/config/loader";
import { requireTeam } from "@/lib/auth/get-user";
import { DAYS, fromLegacyConfig, type OpeningHours } from "@/lib/opening-hours";
import { adminFetch } from "@/admin/lib/menu/api";
import type { AdminOpeningHours } from "@/admin/lib/settings-actions";
import { OpeningHoursForm } from "@/admin/components/settings/OpeningHoursForm";
import QueryWrapper from "@/components/providers/query-wrapper";

export function generateMetadata(): Metadata {
  const { brand } = getConfig();
  return { title: `Opening hours | ${brand.name} Admin` };
}

const suggestedWeek = (timezone: string): OpeningHours => ({
  timezone,
  weekly: DAYS.map((day) => ({
    day,
    shifts: day === "monday" ? [] : [{ open: "12:00", close: "23:00" }],
  })),
  exceptions: [],
});

export default async function SettingsPage() {
  await requireTeam("settings:manage");
  const { business } = getConfig();
  const result = await adminFetch<AdminOpeningHours>(
    "/admin/settings/opening-hours",
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-8">
      <header className="pt-6 pb-6 lg:pt-10">
        <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
          Settings
        </p>
        <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-tight sm:text-3xl">
          Opening hours
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-[15px]">
          Shown on the website, in “Open now”, and used for reservations.
          Changes go live as soon as you save.
        </p>
      </header>

      {!result.ok ? (
        <div className="mb-16 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-destructive">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">The opening hours didn&apos;t load</p>
            <p className="mt-0.5 text-sm">{result.message}</p>
          </div>
        </div>
      ) : (
        <QueryWrapper>
          <OpeningHoursForm
            key={result.data.version ?? "unsaved"}
            saved={result.data}
            starting={
              result.data.hours ??
              (business.hours
                ? fromLegacyConfig(business)
                : suggestedWeek(business.timezone))
            }
            source={
              result.data.hours
                ? "saved"
                : business.hours
                  ? "config"
                  : "suggested"
            }
            lastChanged={lastChanged(result.data, business.timezone)}
          />
        </QueryWrapper>
      )}
    </div>
  );
}

function lastChanged(
  saved: AdminOpeningHours,
  timeZone: string,
): string | undefined {
  if (!saved.updatedAt) return undefined;
  const name = saved.updatedBy?.name || "an admin";
  const days = Math.floor(
    (Date.now() - Date.parse(saved.updatedAt)) / 86_400_000,
  );
  const when =
    days <= 0
      ? `today at ${new Intl.DateTimeFormat("en-GB", { timeStyle: "short", timeZone }).format(new Date(saved.updatedAt))}`
      : days === 1
        ? "yesterday"
        : days < 30
          ? `${days} days ago`
          : `on ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone }).format(new Date(saved.updatedAt))}`;
  return `${name}, ${when}`;
}
