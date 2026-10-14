import { z } from "zod";

export const MESSAGE_MAX = 3000;
export const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{5,22}$/;

export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter your name")
    .max(80, "Keep it under 80 characters"),
  email: z
    .string()
    .trim()
    .min(1, "Enter your email")
    .max(120)
    .pipe(z.email("Enter a valid email")),
  phone: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || PHONE_PATTERN.test(v),
      "Enter a valid phone number",
    ),
  subject: z.string().trim().max(80),
  message: z
    .string()
    .trim()
    .min(10, "Tell us a little more (10 characters at least)")
    .max(MESSAGE_MAX, `Keep it under ${MESSAGE_MAX} characters`),
  website: z.string().max(200),
});

export type ContactValues = z.infer<typeof contactSchema>;

export type ContactResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
      fieldErrors?: Partial<Record<keyof ContactValues, string>>;
    };
