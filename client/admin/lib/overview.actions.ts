"use server";

import { requireTeam } from "@/lib/auth/get-user";
import { adminFetch, type ApiResult } from "./menu/api";
import { parseRange, type Overview } from "./overview";

export async function fetchOverview(
  range: number,
): Promise<ApiResult<Overview>> {
  await requireTeam();
  return adminFetch<Overview>("/admin/overview", {
    query: new URLSearchParams({ range: String(parseRange(range)) }),
  });
}
