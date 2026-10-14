import { z } from "zod";

export const newsletterSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email")
    .max(120, "That email is too long")
    .pipe(z.email("Enter a valid email")),
  website: z.string().max(200),
});
export type NewsletterValues = z.infer<typeof newsletterSchema>;

export type NewsletterSource = "website" | "footer" | "popup";

export type SubscribeResult =
  | { ok: true; status: "pending" | "already" }
  | { ok: false; message: string };

export type SubscriberStatus = "pending" | "subscribed" | "unsubscribed";
export type MyNewsletterStatus = SubscriberStatus | "none";
export type TokenInfo = {
  email: string;
  status: SubscriberStatus;
  expired: boolean;
};
export type TokenResult =
  | { ok: true; data: TokenInfo }
  | { ok: false; message: string; gone?: boolean };

export const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

export const UNSUBSCRIBE_REASONS = [
  { value: "too_many", label: "Too many emails" },
  { value: "not_relevant", label: "Not interested anymore" },
  { value: "never_signed_up", label: "I never signed up" },
  { value: "other", label: "Something else" },
] as const;
export type UnsubscribeReason = (typeof UNSUBSCRIBE_REASONS)[number]["value"];
