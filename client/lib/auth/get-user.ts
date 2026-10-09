import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionOptions } from "@/lib/auth/session-options";
import { readCachedUser } from "@/lib/auth/user-cache";
import { FALLBACK_ROUTE } from "@/lib/auth/routes";
import {
  canAccessAdmin,
  hasPermission,
  type Permission,
} from "@/lib/auth/user-roles";

export const getUserSession = cache(async (): Promise<IUser | null> => {
  const sealed = (await cookies()).get(sessionOptions.cookieName)?.value;
  return (await readCachedUser(sealed))?.user ?? null;
});

export async function requireUser(): Promise<IUser> {
  const user = await getUserSession();
  if (!user) redirect(FALLBACK_ROUTE);
  return user;
}

export async function requireTeam(permission?: Permission): Promise<IUser> {
  const user = await requireUser();
  if (!canAccessAdmin(user.role)) redirect(FALLBACK_ROUTE);
  if (permission && !hasPermission(user.role, permission)) redirect("/admin");
  return user;
}
