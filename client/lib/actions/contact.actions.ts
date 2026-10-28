"use server";

import { headers } from "next/headers";
import { forwardIpHeaders, visitorIp } from "@/lib/api-forward";
import {
  contactSchema,
  type ContactResult,
  type ContactValues,
} from "@/lib/contact";

const FIELDS = ["name", "email", "phone", "subject", "message"] as const;

export async function sendContactMessage(
  values: unknown,
): Promise<ContactResult> {
  const parsed = contactSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof ContactValues, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof ContactValues;
      fieldErrors[key] ??= issue.message;
    }
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      fieldErrors,
    };
  }

  const base = (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    ""
  ).replace(/\/+$/, "");
  if (!base)
    return {
      ok: false,
      message: "The contact form isn't set up yet (API_URL).",
    };

  const h = await headers();
  const ip = visitorIp(h);
  const { phone, subject, ...rest } = parsed.data;

  try {
    const response = await fetch(`${base}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...forwardIpHeaders(ip),
        "User-Agent": h.get("user-agent") ?? "",
      },
      body: JSON.stringify({
        ...rest,
        ...(phone && { phone }),
        ...(subject && { subject }),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) return { ok: true };

    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
      errors?: Record<string, string>;
    } | null;
    if (response.status === 429)
      return {
        ok: false,
        message:
          "You've sent a few messages already. Please wait a minute and try again.",
      };
    if (response.status === 403)
      return {
        ok: false,
        message:
          "The contact form is off right now. Please call or email us instead.",
      };

    const fieldErrors: Partial<Record<keyof ContactValues, string>> = {};
    for (const field of FIELDS)
      if (body?.errors?.[field]) fieldErrors[field] = body.errors[field];
    const message = Array.isArray(body?.message)
      ? body.message[0]
      : body?.message;
    return {
      ok: false,
      message: message || "Your message didn't go through. Please try again.",
      ...(Object.keys(fieldErrors).length > 0 && { fieldErrors }),
    };
  } catch (error) {
    console.error("[contact]", error);
    return {
      ok: false,
      message: "We couldn't reach the server. Please try again in a moment.",
    };
  }
}
