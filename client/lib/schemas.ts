import * as z from "zod";

export const RegisterUserSchema = z.object({
  firstName: z
    .string()
    .min(1, "First name is required")
    .regex(/^[A-Za-zÀ-ÿ '-]+$/, "First name must contain only letters")
    .min(2, "First name is too short")
    .max(30, "First name is too long"),
  lastName: z
    .string()
    .min(1, "Last name is required")
    .regex(/^[A-Za-zÀ-ÿ '-]+$/, "Last name must contain only letters")
    .min(2, "Last name is too short")
    .max(30, "Last name is too long"),
  username: z
    .string()
    .min(1, "Username is required")
    .min(5, "Username is too short")
    .max(30, "Username is too long"),
  email: z.email("Invalid email address").min(1, "Email is required"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(8, "Password must be at least 8 characters long")
    .regex(/(?=.*[a-z])/, "Password must contain at least one lowercase letter")
    .regex(/(?=.*[A-Z])/, "Password must contain at least one uppercase letter")
    .regex(/(?=.*\d)/, "Password must contain at least one number")
    .regex(
      /(?=.*[@$!%*?&])/,
      "Password must contain at least one special character",
    ),
});

export const LoginUserSchema = z.object({
  identifier: z.string().min(1, "Email or Username is required"),
  password: z.string().min(1, "Password is required"),
});

export type RegisterUserForm = z.infer<typeof RegisterUserSchema>;
export type LoginUserForm = z.infer<typeof LoginUserSchema>;
