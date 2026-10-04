import { z } from "zod";

export const SECTION_VARIANTS = {
  hero: ["fullscreen", "split", "video", "slider"],
  about: ["split", "centered", "stacked"],
  menuPreview: ["grid", "list", "carousel"],
  fullMenu: ["tabs", "list", "grid"],
  stats: ["inline", "cards"],
  testimonials: ["carousel", "grid"],
  hoursLocation: ["map", "simple"],
  reservationCta: ["banner", "inline"],
  reservationForm: ["inline", "split"],
  newsletter: ["simple", "split"],
  pageHeader: ["image", "simple"],
  team: ["grid", "carousel"],
  faq: ["accordion", "columns"],
  gallery: ["masonry", "grid", "slider"],
  events: ["cards", "list"],
  contact: ["split", "simple"],
} as const;

export type SectionType = keyof typeof SECTION_VARIANTS;
const SECTION_TYPES = Object.keys(SECTION_VARIANTS) as [
  SectionType,
  ...SectionType[],
];

const SECTION_SOURCE: Partial<Record<SectionType, string>> = {
  about: "about",
  stats: "stats",
  gallery: "gallery",
  faq: "faqs",
  events: "events",
};

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const APP_ROUTES = ["sign-in"] as const;

const obj = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict();

const text = z.string().trim().min(1, "Cannot be empty");

const hexColor = z
  .string()
  .regex(
    /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/,
    "Must be a hex color like #B4532A",
  );

const time24 = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24h format HH:MM");

const isRealDate = (d: string) => {
  const dt = new Date(`${d}T00:00:00Z`);
  return !Number.isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === d;
};
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine(isRealDate, "Not a real calendar date");

const imagePath = z
  .string()
  .min(1)
  .refine(
    (v) => !/^([a-z]+:)?\/\//i.test(v) && !v.startsWith("/"),
    "Use a path relative to the client's public folder (no leading / and no http)",
  )
  .refine((v) => !v.includes(".."), "'..' is not allowed in paths");

const href = z
  .string()
  .min(1)
  .refine(
    (v) => /^(\/|#|https?:\/\/|mailto:|tel:)/.test(v),
    "Must start with /, #, http(s)://, mailto: or tel:",
  );

const cta = obj({ label: text, href });

const currencyCode = z
  .string()
  .regex(/^[A-Z]{3}$/, "Use a 3-letter ISO code like USD");

const phone = z.string().regex(/^\+?[\d\s().-]{6,20}$/, "Invalid phone number");

const isValidTimezone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const emptyOr = (re: RegExp, msg: string) =>
  z.union([z.literal(""), z.string().regex(re, msg)]);

const luminance = (hex: string) => {
  let h = hex.slice(1);
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const uniqueIds =
  <T extends { id: string }>(label: string) =>
  (items: T[], ctx: z.RefinementCtx) => {
    const seen = new Set<string>();
    items.forEach((item, i) => {
      if (seen.has(item.id))
        ctx.addIssue({
          code: "custom",
          path: [i, "id"],
          message: `Duplicate ${label} id "${item.id}"`,
        });
      seen.add(item.id);
    });
  };

const brand = obj({
  name: text,
  tagline: text,
  logo: obj({ light: imagePath, dark: imagePath.optional() }),
  description: text.optional(),
  favicon: imagePath.optional(),
  ogImage: imagePath.optional(),
});

const colorSet = obj({
  primary: hexColor,
  accent: hexColor,
  background: hexColor,
  text: hexColor,
  muted: hexColor,
  secondary: hexColor.optional(),
  border: hexColor.optional(),
}).superRefine((c, ctx) => {
  if (contrast(c.text, c.background) < 4.5)
    ctx.addIssue({
      code: "custom",
      path: ["text"],
      message: "Text vs background contrast is below 4.5:1 (WCAG AA)",
    });
  if (contrast(c.muted, c.background) < 3)
    ctx.addIssue({
      code: "custom",
      path: ["muted"],
      message: "Muted text vs background contrast is below 3:1",
    });
});

const theme = obj({
  mode: z.enum(["light", "dark", "both"]),
  colors: obj({ light: colorSet, dark: colorSet.optional() }),
  radius: z.enum(["sharp", "soft", "pill"]),
  buttonStyle: z.enum(["solid", "outline"]),
  allowModeToggle: z.boolean().optional(),
  shadow: z.enum(["none", "soft", "strong"]).optional(),
  density: z.enum(["compact", "airy"]).optional(),
}).superRefine((t, ctx) => {
  if ((t.mode === "dark" || t.mode === "both") && !t.colors.dark)
    ctx.addIssue({
      code: "custom",
      path: ["colors", "dark"],
      message: `mode "${t.mode}" requires a dark color set`,
    });
});

const navLink = obj({ label: text, href });

const layout = obj({
  navbar: obj({
    variant: z.enum(["transparent", "solid", "centered", "hamburger"]),
    sticky: z.boolean(),
    cta: cta.default({ label: "Sign in", href: "/sign-in" }),
    links: z.array(navLink).optional(),
  }),
  footer: obj({
    variant: z.enum(["columns", "minimal", "centered"]),
    showNewsletter: z.boolean(),
    showSocials: z.boolean(),
    showHours: z.boolean(),
    copyright: text.optional(),
    links: z.array(navLink).optional(),
  }),
  announcementBar: obj({
    enabled: z.boolean(),
    text: z.string(),
    link: cta.optional(),
    dismissible: z.boolean(),
  }).superRefine((a, ctx) => {
    if (a.enabled && !a.text.trim())
      ctx.addIssue({
        code: "custom",
        path: ["text"],
        message: "Text is required when the bar is enabled",
      });
  }),
  promoPopup: obj({
    enabled: z.boolean(),
    title: text,
    body: text,
    image: imagePath.optional(),
    delaySeconds: z.number().int().min(0).max(120),
  }).optional(),
});

const section = obj({
  id: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use kebab-case, e.g. home-hero"),
  type: z.enum(SECTION_TYPES),
  variant: text,
  enabled: z.boolean().default(true),
  props: z.record(z.string(), z.unknown()).default({}),
}).superRefine((s, ctx) => {
  const allowed = SECTION_VARIANTS[s.type] as readonly string[];
  if (!allowed.includes(s.variant))
    ctx.addIssue({
      code: "custom",
      path: ["variant"],
      message: `"${s.variant}" is not a variant of ${s.type}. Allowed: ${allowed.join(", ")}`,
    });

  const key = SECTION_SOURCE[s.type];
  if (key && s.props.source !== `content.${key}`)
    ctx.addIssue({
      code: "custom",
      path: ["props", "source"],
      message: `${s.type} must use "content.${key}"`,
    });

  if (s.type === "menuPreview") {
    const ids = s.props.itemIds;
    if (
      !Array.isArray(ids) ||
      ids.length === 0 ||
      !ids.every((i) => typeof i === "string")
    )
      ctx.addIssue({
        code: "custom",
        path: ["props", "itemIds"],
        message: "itemIds must be a non-empty array of item ids",
      });
  }
});

const page = obj({
  enabled: z.boolean(),
  seo: obj({
    title: text.max(70, "Keep titles under 70 characters"),
    description: text.max(200, "Keep descriptions under 200 characters"),
  }),
  sections: z.array(section),
}).superRefine((p, ctx) => {
  if (p.enabled && p.sections.length === 0)
    ctx.addIssue({
      code: "custom",
      path: ["sections"],
      message: "An enabled page needs at least one section",
    });
});

const pages = obj({
  home: page,
  menu: page.optional(),
  about: page.optional(),
  gallery: page.optional(),
  contact: page.optional(),
  reservations: page.optional(),
  events: page.optional(),
  blog: page.optional(),
});

const content = obj({
  about: obj({
    eyebrow: text.optional(),
    title: text,
    body: z.array(text).min(1),
    image: imagePath,
    highlights: z.array(obj({ icon: text, title: text, text })).optional(),
    cta: cta.optional(),
  }),
  stats: z.array(obj({ value: text, label: text })).min(1),
  gallery: z
    .array(
      obj({ id: text, image: imagePath, alt: text, category: text.optional() }),
    )
    .min(1)
    .superRefine(uniqueIds("gallery image")),
  faqs: z.array(obj({ question: text, answer: text })).min(1),
  events: z
    .array(
      obj({
        id: text,
        title: text,
        date: text,
        time: time24.optional(),
        description: text,
        image: imagePath.optional(),
        cta: cta.optional(),
      }),
    )
    .min(1)
    .superRefine(uniqueIds("event")),
}).partial();

const menu = obj({
  currency: obj({
    primary: obj({ enabled: z.boolean(), code: currencyCode }),
    secondary: obj({
      enabled: z.boolean(),
      code: currencyCode,
      rate: z
        .number()
        .positive(
          "Rate must be greater than 0 (units of secondary per 1 primary)",
        ),
      roundTo: z.number().int().positive(),
    }).optional(),
  }).superRefine((c, ctx) => {
    const secondaryOn = c.secondary?.enabled === true;
    if (!c.primary.enabled && !secondaryOn)
      ctx.addIssue({
        code: "custom",
        path: ["primary", "enabled"],
        message: "At least one currency must be enabled",
      });
    if (c.secondary && c.secondary.code === c.primary.code)
      ctx.addIssue({
        code: "custom",
        path: ["secondary", "code"],
        message: "Secondary currency must differ from primary",
      });
  }),
  pricing: obj({
    taxIncluded: z.boolean(),
    vatRate: z.number().min(0).max(1, "Use a fraction: 0.11 means 11%"),
    serviceChargeRate: z.number().min(0).max(1).optional(),
    note: text.optional(),
  }),
  unavailableItems: z.enum(["hide", "show-sold-out"]),
});

const hourRule = (
  ctx: z.RefinementCtx,
  h: { open?: string; close?: string; closed?: boolean },
) => {
  if (h.closed) {
    if (h.open || h.close)
      ctx.addIssue({
        code: "custom",
        path: ["closed"],
        message: "A closed day cannot have open/close times",
      });
  } else {
    if (!h.open || !h.close)
      ctx.addIssue({
        code: "custom",
        path: ["open"],
        message: "Provide open and close, or set closed: true",
      });
    else if (h.open === h.close)
      ctx.addIssue({
        code: "custom",
        path: ["close"],
        message: "Open and close times are identical",
      });
  }
};

const dayHours = obj({
  day: z.enum(DAYS),
  open: time24.optional(),
  close: time24.optional(),
  closed: z.boolean().optional(),
}).superRefine((h, ctx) => hourRule(ctx, h));

const specialDay = obj({
  date: isoDate,
  label: text,
  open: time24.optional(),
  close: time24.optional(),
  closed: z.boolean().optional(),
}).superRefine((h, ctx) => hourRule(ctx, h));

const business = obj({
  cuisine: z.array(text).min(1).optional(),
  priceRange: z.enum(["$", "$$", "$$$", "$$$$"]).optional(),
  address: obj({
    street: text,
    city: text,
    region: text.optional(),
    postalCode: text.optional(),
    country: text,
  }),
  geo: obj({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }).optional(),
  phone,
  email: z.string().email(),
  whatsapp: obj({
    number: z
      .string()
      .regex(
        /^\+\d{8,15}$/,
        "Use international format without spaces, e.g. +96171234567",
      ),
    message: text.optional(),
  }).optional(),
  socials: z.array(
    obj({
      platform: z.enum([
        "instagram",
        "facebook",
        "tripadvisor",
        "tiktok",
        "x",
        "youtube",
        "linkedin",
      ]),
      url: z.url(),
      handle: text.optional(),
    }),
  ),
  timezone: z
    .string()
    .refine(isValidTimezone, "Not a valid IANA timezone, e.g. Asia/Beirut"),
  hours: z
    .array(dayHours)
    .length(7, "Provide exactly 7 days")
    .superRefine((hours, ctx) => {
      const seen = new Set<string>();
      hours.forEach((h, i) => {
        if (seen.has(h.day))
          ctx.addIssue({
            code: "custom",
            path: [i, "day"],
            message: `Duplicate day "${h.day}"`,
          });
        seen.add(h.day);
      });
    })
    .optional(),
  specialHours: z.array(specialDay).superRefine((rows, ctx) => {
    const seen = new Set<string>();
    rows.forEach((r, i) => {
      if (seen.has(r.date))
        ctx.addIssue({
          code: "custom",
          path: [i, "date"],
          message: `Duplicate date ${r.date}`,
        });
      seen.add(r.date);
    });
  }),
  reservations: obj({
    maxPartySize: z.number().int().min(1).max(100),
    slotIntervalMinutes: z.union([
      z.literal(15),
      z.literal(20),
      z.literal(30),
      z.literal(45),
      z.literal(60),
    ]),
    advanceDays: z.number().int().min(1).max(365),
    minNoticeHours: z.number().int().min(0).max(72),
    confirmationMessage: text.optional(),
    minPartySize: z.number().int().min(1).default(1),
    requirePhone: z.boolean().default(true),
    allowSpecialRequests: z.boolean().default(true),
    occasions: z.array(text).min(1).optional(),
  }).superRefine((r, ctx) => {
    if (r.minPartySize > r.maxPartySize)
      ctx.addIssue({
        code: "custom",
        path: ["minPartySize"],
        message: "minPartySize cannot exceed maxPartySize",
      });
  }),
  legalName: text.optional(),
  mapEmbedUrl: z.url().optional(),
});

const flag = z.boolean().default(false);

const features = obj({
  newsletter: flag,
  contactForm: flag,
  whatsappButton: flag,
  cookieBanner: flag,
  reservations: z.boolean().default(false),
  events: z.boolean().default(false),
  blog: z.boolean().default(false),
  darkModeToggle: z.boolean().default(true),
  onlineOrdering: flag,
  delivery: flag,
  pickup: flag,
  giftCards: flag,
  loyalty: flag,
  instagramFeed: flag,
});

const seo = obj({
  defaultDescription: text.max(200),
  siteUrl: z
    .url()
    .refine(
      (u) => /^https?:\/\//.test(u) && !u.endsWith("/"),
      "Use http(s) and no trailing slash",
    ),
  ogImage: imagePath,
  siteName: text.optional(),
  titleTemplate: z
    .string()
    .refine((t) => t.includes("%s"), 'Must contain "%s"')
    .optional(),
  defaultTitle: text.optional(),
  keywords: z.array(text).optional(),
  twitterHandle: z
    .string()
    .regex(/^@\w{1,15}$/, "Use @handle")
    .optional(),
  structuredData: obj({
    type: z.literal("Restaurant"),
    servesCuisine: z.array(text).min(1),
    acceptsReservations: z.boolean(),
  }).optional(),
});

const locale = obj({
  language: z.enum(["en"]),
  timeFormat: z.enum(["12h", "24h"]),
  direction: z.enum(["ltr", "rtl"]).optional(),
  dateFormat: text.optional(),
});

const integrations = obj({
  googleAnalyticsId: emptyOr(
    /^G-[A-Z0-9]{6,}$/,
    "Use a GA4 id like G-XXXXXXXXXX",
  ),
  metaPixelId: emptyOr(/^\d{10,20}$/, "Meta Pixel ids are 10 to 20 digits"),
  googleTagManagerId: emptyOr(
    /^GTM-[A-Z0-9]+$/,
    "Use an id like GTM-XXXXXXX",
  ).optional(),
  customDomain: emptyOr(
    /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/i,
    "Use a bare domain like example.com",
  ).optional(),
  emailProvider: obj({
    newsletter: z.enum(["none", "mailchimp", "brevo", "resend"]),
    formsRecipient: z.email(),
  }).optional(),
});

const legalDoc = obj({ title: text, updated: isoDate, body: text });

const legal = obj({
  privacy: legalDoc.optional(),
  terms: legalDoc.optional(),
  cookies: obj({
    message: text,
    acceptLabel: text,
    declineLabel: text,
  }).optional(),
});

export const configSchema = obj({
  id: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use kebab-case, e.g. pizza-roma"),
  version: z.number().int().positive().optional(),
  brand,
  theme,
  layout,
  pages,
  content,
  menu,
  business,
  features,
  seo,
  locale,
  integrations,
  legal: legal.optional(),
}).superRefine((cfg, ctx) => {
  const add = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: "custom", path, message });
  const pageMap = cfg.pages as Record<string, z.infer<typeof page> | undefined>;

  if (!cfg.pages.home.enabled)
    add(["pages", "home", "enabled"], "The home page cannot be disabled");

  const seenIds = new Map<string, string>();
  for (const [pageKey, p] of Object.entries(pageMap)) {
    p?.sections.forEach((s, i) => {
      const at = ["pages", pageKey, "sections", i];

      const prev = seenIds.get(s.id);
      if (prev)
        add(
          [...at, "id"],
          `Section id "${s.id}" is already used in pages.${prev}`,
        );
      seenIds.set(s.id, pageKey);

      if (!s.enabled || !p.enabled) return;

      const key = SECTION_SOURCE[s.type];
      const data = key
        ? (cfg.content as Record<string, unknown>)[key]
        : undefined;
      if (key && !data)
        add(
          [...at, "props", "source"],
          `content.${key} is missing but ${s.type} needs it`,
        );

      if (s.type === "newsletter" && !cfg.features.newsletter)
        add(
          [...at, "type"],
          "A newsletter section needs features.newsletter = true",
        );
      if (s.type === "contact" && !cfg.features.contactForm)
        add(
          [...at, "type"],
          "A contact section needs features.contactForm = true",
        );
      if (
        (s.type === "reservationForm" || s.type === "reservationCta") &&
        !pageMap.reservations?.enabled
      )
        add(
          [...at, "type"],
          "Reservation sections need pages.reservations.enabled = true",
        );
      if (
        s.type === "hoursLocation" &&
        s.props.showMap === true &&
        !cfg.business.geo
      )
        add(
          [...at, "props", "showMap"],
          "showMap needs business.geo (lat/lng)",
        );
    });
  }

  const legalDocs = (cfg.legal ?? {}) as Record<string, unknown>;
  const checkHref = (value: string, path: (string | number)[]) => {
    if (!value.startsWith("/")) return;
    const [first, second] = value.split(/[?#]/)[0].split("/").filter(Boolean);
    if (!first) return;
    if ((APP_ROUTES as readonly string[]).includes(first)) return;
    if (first === "legal") {
      if (!second || !legalDocs[second])
        add(path, `No legal document "${second ?? ""}" is defined`);
      return;
    }
    if (!pageMap[first]?.enabled)
      add(path, `"${value}" points to a page that is missing or disabled`);
  };
  cfg.layout.navbar.links?.forEach((l, i) =>
    checkHref(l.href, ["layout", "navbar", "links", i, "href"]),
  );
  cfg.layout.footer.links?.forEach((l, i) =>
    checkHref(l.href, ["layout", "footer", "links", i, "href"]),
  );
  if (cfg.layout.navbar.cta)
    checkHref(cfg.layout.navbar.cta.href, ["layout", "navbar", "cta", "href"]);
  if (cfg.layout.announcementBar.enabled && cfg.layout.announcementBar.link)
    checkHref(cfg.layout.announcementBar.link.href, [
      "layout",
      "announcementBar",
      "link",
      "href",
    ]);

  const mirror = [
    ["reservations", pageMap.reservations],
    ["events", pageMap.events],
    ["blog", pageMap.blog],
  ] as const;
  for (const [flagName, p] of mirror) {
    const flagValue = cfg.features[flagName];
    if (flagValue !== undefined && flagValue !== (p?.enabled ?? false))
      add(
        ["features", flagName],
        `features.${flagName} (${flagValue}) disagrees with pages.${flagName}.enabled`,
      );
  }
  if (cfg.features.whatsappButton && !cfg.business.whatsapp)
    add(
      ["features", "whatsappButton"],
      "whatsappButton needs business.whatsapp",
    );
  if (cfg.layout.footer.showSocials && cfg.business.socials.length === 0)
    add(
      ["layout", "footer", "showSocials"],
      "showSocials is on but business.socials is empty",
    );
});

export type SiteConfig = z.infer<typeof configSchema>;
export type Page = z.infer<typeof page>;
export type Section = z.infer<typeof section>;
export type ColorSet = z.infer<typeof colorSet>;
