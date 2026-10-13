import { z } from "zod";

export const RESET_COOKIE = "mesa_reset";
export const RESET_COOKIE_PATH = "/reset-password";
export const RESET_DONE_COOKIE = "mesa_reset_done";
export const RESET_TTL_MINUTES = 30;
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,64}$/;

export const forgotSchema = z.object({
  email: z.email().trim().toLowerCase().min(1, "Enter your email").max(254),
});
export type ForgotValues = z.infer<typeof forgotSchema>;

export const resetSchema = z
  .object({
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(128, "That's too long"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "The passwords don't match",
  });
export type ResetValues = z.infer<typeof resetSchema>;
