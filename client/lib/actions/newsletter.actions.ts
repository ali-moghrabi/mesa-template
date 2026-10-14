"use server";

import { headers } from "next/headers";
import { getUserSession } from "@/lib/auth/get-user";
import { adminFetch } from "@/admin/lib/menu/api";
import {
  newsletterSchema,
  TOKEN_PATTERN,
  type MyNewsletterStatus,
  type NewsletterSource,
  type SubscribeResult,
  type TokenResult,
  type UnsubscribeReason,
} from "@/lib/newsletter";

const base = () =>
  (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "").replace(
    /\/+$/,
    "",
  );
const REASONS: UnsubscribeReason[] = [
  "too_many",
  "not_relevant",
  "never_signed_up",
  "other",
];

async function call(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
): Promise<Response> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    undefined;
  return fetch(`${base()}${path}`, {
    method: init.method,
    headers: {
      ...(init.body !== undefined && { "Content-Type": "application/json" }),
      ...(ip && { "X-Forwarded-For": ip }),
      "User-Agent": h.get("user-agent") ?? "",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
}

const errorMessage = async (response: Response, fallback: string) => {
  const body = (await response.json().catch(() => null)) as {
    message?: string | string[];
  } | null;
  const message = Array.isArray(body?.message)
    ? body.message[0]
    : body?.message;
  return message || fallback;
};

export async function subscribeNewsletter(
  values: unknown,
  source: NewsletterSource = "website",
  page?: string,
): Promise<SubscribeResult> {
  const parsed = newsletterSchema.safeParse(values);
  if (!parsed.success)
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Enter a valid email",
    };
  if (!base())
    return { ok: false, message: "The newsletter isn't set up yet (API_URL)." };

  try {
    const response = await call("/newsletter/subscribe", {
      method: "POST",
      body: {
        email: parsed.data.email,
        source,
        ...(parsed.data.website && { website: parsed.data.website }),
        ...(page && { page: page.slice(0, 200) }),
      },
    });
    if (response.ok) {
      const data = (await response.json()) as { status: "pending" | "already" };
      return {
        ok: true,
        status: data.status === "already" ? "already" : "pending",
      };
    }
    if (response.status === 429)
      return {
        ok: false,
        message: "Too many tries. Please wait a minute and try again.",
      };
    if (response.status === 403)
      return { ok: false, message: "The newsletter is closed right now." };
    return {
      ok: false,
      message: await errorMessage(
        response,
        "That didn't work. Please try again.",
      ),
    };
  } catch (error) {
    console.error("[newsletter]", error);
    return {
      ok: false,
      message: "We couldn't reach the server. Please try again in a moment.",
    };
  }
}

export async function getNewsletterToken(
  type: "confirm" | "unsubscribe",
  token: string,
): Promise<TokenResult> {
  return tokenCall(
    `/newsletter/token?${new URLSearchParams({ type, token })}`,
    "GET",
  );
}

export async function confirmNewsletter(token: string): Promise<TokenResult> {
  return tokenCall("/newsletter/confirm", "POST", { token });
}

export async function unsubscribeNewsletter(
  token: string,
  reason?: string,
): Promise<TokenResult> {
  const valid = REASONS.includes(reason as UnsubscribeReason)
    ? (reason as UnsubscribeReason)
    : undefined;
  return tokenCall("/newsletter/unsubscribe", "POST", {
    token,
    ...(valid && { reason: valid }),
  });
}

export async function resubscribeNewsletter(
  token: string,
): Promise<TokenResult> {
  return tokenCall("/newsletter/resubscribe", "POST", { token });
}

export async function getMyNewsletterStatus(): Promise<MyNewsletterStatus | null> {
  if (!(await getUserSession())) return null;
  const result = await adminFetch<{ status: MyNewsletterStatus }>(
    "/newsletter/me",
  );
  return result.ok ? result.data.status : null;
}

export async function unsubscribeMe(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  if (!(await getUserSession()))
    return {
      ok: false,
      message: "Sign in again to change your newsletter settings.",
    };
  const result = await adminFetch<{ status: MyNewsletterStatus }>(
    "/newsletter/me/unsubscribe",
    { method: "POST" },
  );
  return result.ok ? { ok: true } : { ok: false, message: result.message };
}

async function tokenCall(
  path: string,
  method: "GET" | "POST",
  body?: { token: string },
): Promise<TokenResult> {
  const token =
    body?.token ?? new URLSearchParams(path.split("?")[1]).get("token") ?? "";
  if (!TOKEN_PATTERN.test(token))
    return {
      ok: false,
      gone: true,
      message: "This link is not valid. Check that you copied all of it.",
    };
  if (!base())
    return { ok: false, message: "The newsletter isn't set up yet (API_URL)." };
  try {
    const response = await call(path, { method, body });
    if (response.ok)
      return {
        ok: true,
        data: (await response.json()) as Extract<
          TokenResult,
          { ok: true }
        >["data"],
      };
    if (response.status === 404)
      return {
        ok: false,
        gone: true,
        message: await errorMessage(response, "This link is no longer valid."),
      };
    if (response.status === 429)
      return {
        ok: false,
        message: "Too many tries. Please wait a minute and try again.",
      };
    return {
      ok: false,
      message: await errorMessage(
        response,
        "That didn't work. Please try again.",
      ),
    };
  } catch (error) {
    console.error("[newsletter]", error);
    return {
      ok: false,
      message: "We couldn't reach the server. Please try again in a moment.",
    };
  }
}
