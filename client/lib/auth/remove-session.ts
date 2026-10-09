"use server";

import { cookies } from "next/headers";
import { sessionOptions } from "./session-options";

export async function removeSessionOnLogout() {
  (await cookies()).delete(sessionOptions.cookieName);

  return { success: true };
}
