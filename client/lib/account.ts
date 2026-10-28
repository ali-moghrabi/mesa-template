import { z } from "zod";
import type { Role } from "@/lib/auth/user-roles";
import type { TwoFactorState } from "@/lib/two-factor";

export type Account = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: Role;
  isEmailVerified: boolean;
  hasPassword: boolean;
  googleLinked: boolean;
  lastLoginAt?: string;
  createdAt: string;
  verification?: VerificationState;
  twoFactor?: TwoFactorState;
};

export type VerificationState = {
  status: "sent" | "cooldown" | "verified";
  sentTo?: string;
  sentAt?: string;
  resendAt?: string;
};

export type VerifyLinkInfo = { email: string; status: "pending" | "verified" };
export type VerifyLinkResult =
  | { ok: true; data: VerifyLinkInfo }
  | { ok: false; message: string; gone: boolean };

export const VERIFY_TOKEN_PATTERN = /^[0-9a-f]{64}$/;

export const NAME_MAX = 50;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

const name = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter your ${label}`)
    .max(NAME_MAX, `Keep it under ${NAME_MAX} characters`);

export const profileSchema = z.object({
  firstName: name("first name"),
  lastName: name("last name"),
  phone: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || /^\+?[0-9][0-9 ()-]{5,22}$/.test(v),
      "Enter a valid phone number, like +961 71 234 567",
    ),
});
export type ProfileValues = z.infer<typeof profileSchema>;

export const passwordSchemaFor = (hasPassword: boolean) =>
  z
    .object({
      currentPassword: hasPassword
        ? z.string().min(1, "Enter your current password").max(PASSWORD_MAX)
        : z.string().max(PASSWORD_MAX),
      newPassword: z
        .string()
        .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
        .max(PASSWORD_MAX, "That's too long"),
      confirmPassword: z.string(),
    })
    .refine((v) => v.newPassword === v.confirmPassword, {
      path: ["confirmPassword"],
      message: "The passwords don't match",
    })
    .refine(
      (v) => v.newPassword !== v.currentPassword || v.newPassword === "",
      {
        path: ["newPassword"],
        message: "Choose a new password, not the current one",
      },
    );
export const passwordSchema = passwordSchemaFor(true);
export type PasswordValues = z.infer<typeof passwordSchema>;

export const deleteSchemaFor = (hasPassword: boolean) =>
  z.object({
    password: hasPassword
      ? z.string().min(1, "Enter your password").max(PASSWORD_MAX)
      : z.string().max(PASSWORD_MAX),
    confirm: z
      .string()
      .refine(
        (v) => v.trim().toUpperCase() === "DELETE",
        "Type DELETE to confirm",
      ),
  });
export const deleteSchema = deleteSchemaFor(true);
export type DeleteValues = z.infer<typeof deleteSchema>;

export function passwordStrength(password: string): {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
} {
  if (!password) return { score: 0, label: "" };
  let score = 0;
  if (password.length >= PASSWORD_MIN) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  if (password.length < PASSWORD_MIN) score = Math.min(score, 1);
  const s = score as 0 | 1 | 2 | 3 | 4;
  return {
    score: s,
    label: ["Too short", "Weak", "Fair", "Good", "Strong"][s],
  };
}
