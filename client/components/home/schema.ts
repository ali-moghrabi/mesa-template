import { z } from "zod";

const cta = z
  .object({
    label: z.string().trim().min(1),
    href: z
      .string()
      .min(1)
      .refine(
        (v) => /^(\/|#|https?:\/\/|mailto:|tel:)/.test(v),
        "Must start with /, #, http(s)://, mailto: or tel:",
      ),
  })
  .strict();

export type HeroCta = z.infer<typeof cta>;

export const heroSchema = z
  .object({
    title: z.string().trim().min(1),
    subtitle: z.string().trim().min(1).optional(),
    image: z
      .string()
      .min(1)
      .refine(
        (v) => !/^([a-z]+:)?\/\//i.test(v) && !v.startsWith("/"),
        "Use a path relative to the client's public folder",
      )
      .refine((v) => !v.includes(".."), "'..' is not allowed in paths"),
    overlay: z.number().min(0).max(1).default(0.4),
    booking: z.boolean().default(true),
    primaryCta: cta.optional(),
    secondaryCta: cta.optional(),
  })
  .strict();

export type HeroProps = z.infer<typeof heroSchema>;
