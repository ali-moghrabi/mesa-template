import "server-only";
import { cache } from "react";
import { getConfig } from "@/config/loader";
import { fromLegacyConfig, type OpeningHours } from "@/lib/opening-hours";

export const OPENING_HOURS_TAG = "opening-hours";

export const getOpeningHours = cache(async (): Promise<OpeningHours | null> => {
  const base = (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    ""
  ).replace(/\/+$/, "");
  if (base) {
    try {
      const response = await fetch(`${base}/settings/opening-hours`, {
        next: { tags: [OPENING_HOURS_TAG], revalidate: 3600 },
        signal: AbortSignal.timeout(4_000),
      });
      if (response.ok) {
        const body = (await response.json()) as { hours: OpeningHours | null };
        if (body.hours) return body.hours;
      }
    } catch (error) {
      console.error(
        "[opening-hours] API unavailable, using config.json:",
        error,
      );
    }
  }
  const { business } = getConfig();
  return business.hours ? fromLegacyConfig(business) : null;
});
