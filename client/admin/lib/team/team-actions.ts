"use server";

import { requireTeam } from "@/lib/auth/get-user";
import { ROLES, type Role } from "@/lib/auth/user-roles";
import { adminFetch, type ApiResult } from "../menu/api";
import { cleanTeamSearch, type TeamCandidate, type TeamMember } from "./team";

const OBJECT_ID = /^[0-9a-f]{24}$/i;
const isRole = (value: unknown): value is Role =>
  (ROLES as readonly unknown[]).includes(value);
const invalid = (message: string) => ({
  ok: false as const,
  status: 400,
  message,
});

export async function searchTeamCandidates(
  search: string,
): Promise<ApiResult<TeamCandidate[]>> {
  await requireTeam("users:manage");
  const clean = cleanTeamSearch(String(search ?? ""));
  if (clean.length < 2) return { ok: true, data: [] };
  return adminFetch<TeamCandidate[]>("/admin/team/candidates", {
    query: new URLSearchParams({ search: clean }),
  });
}

export async function changeMemberRole(
  id: string,
  role: Role,
  from: Role,
): Promise<ApiResult<TeamMember>> {
  await requireTeam("users:manage");
  if (!OBJECT_ID.test(id)) return invalid("This account no longer exists.");
  if (!isRole(role) || !isRole(from)) return invalid("Pick a role.");
  return adminFetch<TeamMember>(`/admin/team/${id}/role`, {
    method: "PATCH",
    body: { role, from },
  });
}

export async function changeMemberStatus(
  id: string,
  isActive: boolean,
): Promise<ApiResult<TeamMember>> {
  await requireTeam("users:manage");
  if (!OBJECT_ID.test(id)) return invalid("This account no longer exists.");
  return adminFetch<TeamMember>(`/admin/team/${id}/status`, {
    method: "PATCH",
    body: { isActive: isActive === true },
  });
}
