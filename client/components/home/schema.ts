import { z } from "zod";
import { SiteConfig } from "@/config/schema";

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

export const aboutSchema = z
  .object({
    source: z.literal("content.about"),
    imagePosition: z.enum(["start", "end"]).default("start"),
    showCta: z.boolean().default(false),
  })
  .strict();

export const reservationCtaSchema = z
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
    imagePosition: z
      .string()
      .regex(
        /^(100|\d{1,2})% (100|\d{1,2})%$/,
        'Use "x% y%" with values from 0 to 100, e.g. "50% 50%"',
      )
      .default("50% 50%"),
    overlay: z.number().min(0).max(1).default(0.45),
    cta: z
      .object({
        label: z.string().trim().min(1),
        href: z
          .string()
          .min(1)
          .refine(
            (v) => /^(\/|#|https?:\/\/|tel:)/.test(v),
            "Must start with /, #, http(s):// or tel:",
          ),
      })
      .strict(),
  })
  .strict();

export const newsletterSchema = z
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
      .refine((v) => !v.includes(".."), "'..' is not allowed in paths")
      .optional(),
    placeholder: z.string().trim().min(1).default("Your email address"),
    buttonLabel: z.string().trim().min(1).default("Subscribe"),
  })
  .strict();

export type AboutProps = z.infer<typeof aboutSchema>;
export type HeroProps = z.infer<typeof heroSchema>;
export type AboutContent = NonNullable<SiteConfig["content"]["about"]>;
export type ReservationCtaProps = z.infer<typeof reservationCtaSchema>;
export type NewsletterProps = z.infer<typeof newsletterSchema>;

export type AboutVariantProps = {
  id: string;
  props: AboutProps;
  content: AboutContent;
};
