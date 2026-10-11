"use server";

import { updateTag } from "next/cache";
import { requireTeam } from "@/lib/auth/get-user";
import { hoursIssues, type OpeningHours } from "@/lib/opening-hours";
import { OPENING_HOURS_TAG } from "@/lib/opening-hours-server";
import { adminFetch, type ApiResult } from "./menu/api";

export type AdminOpeningHours = {
  hours: OpeningHours | null;
  version: string | null;
  updatedAt: string | null;
  updatedBy: { id: string; name: string } | null;
};

export async function saveOpeningHours(
  hours: OpeningHours,
  version: string | null,
): Promise<ApiResult<AdminOpeningHours>> {
  await requireTeam("settings:manage");

  const issues = hoursIssues(hours);
  if (Object.keys(issues).length)
    return {
      ok: false,
      status: 400,
      message: "Please fix the highlighted hours",
      fieldErrors: issues,
    };

  const result = await adminFetch<AdminOpeningHours>(
    "/admin/settings/opening-hours",
    {
      method: "PATCH",
      body: { hours, version },
    },
  );
  if (result.ok) updateTag(OPENING_HOURS_TAG);
  return result;
}
