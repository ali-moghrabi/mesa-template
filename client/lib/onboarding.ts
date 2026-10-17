/**
 * The onboarding form for new restaurants (/start): the answers' shape, the checks for each step,
 * and the draft config.json built from the answers. The API checks the answers again
 * (mesa-api: src/features/onboarding/onboarding.schema.ts) and emails everything to the team.
 */

export const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
export type Day = (typeof DAYS)[number];

export type Shift = { open: string; close: string };
export type DayHours = { closed: boolean; shifts: Shift[] };

export const RESTAURANT_TYPES = [
  { id: "Restaurant", label: "Restaurant" },
  { id: "Cafe", label: "Café" },
  { id: "Bar", label: "Bar" },
  { id: "Bakery", label: "Bakery" },
  { id: "FastFood", label: "Fast food" },
  { id: "Other", label: "Other" },
] as const;

export const CUISINES = [
  "Lebanese",
  "Mediterranean",
  "Italian",
  "Pizza",
  "Burgers",
  "Grill",
  "Seafood",
  "Sushi",
  "Asian",
  "Healthy",
  "Breakfast",
  "Desserts",
  "Coffee",
];

export const PRICE_RANGES = [
  { id: "$", hint: "Budget" },
  { id: "$$", hint: "Mid-range" },
  { id: "$$$", hint: "Upscale" },
  { id: "$$$$", hint: "Fine dining" },
] as const;

export const CURRENCIES = ["USD", "LBP", "EUR", "AED", "SAR"] as const;

export const PLANS = [
  {
    id: "essential",
    label: "Essential",
    hint: "Website, menu, gallery, reservations",
  },
  { id: "pro", label: "Pro", hint: "+ online ordering, payments, promotions" },
  {
    id: "signature",
    label: "Signature",
    hint: "+ several branches, custom sections",
  },
  { id: "unsure", label: "Not sure yet", hint: "We'll help you choose" },
] as const;

/** Colours that work well as a restaurant's main colour (dark enough for white text on buttons) */
export const COLOR_PRESETS = [
  "#B4532A",
  "#9A3412",
  "#B91C1C",
  "#9D174D",
  "#7C2D12",
  "#A16207",
  "#3F6212",
  "#166534",
  "#0F766E",
  "#1D4ED8",
  "#4338CA",
  "#1F2937",
];

export type OnboardingAnswers = {
  restaurant: {
    name: string;
    type: (typeof RESTAURANT_TYPES)[number]["id"];
    cuisine: string[];
    priceRange: (typeof PRICE_RANGES)[number]["id"];
    description: string;
    tagline: string;
    since: string;
  };
  contact: {
    mapsLink: string;
    street: string;
    area: string;
    city: string;
    country: string;
    phone: string;
    whatsapp: string;
    email: string;
    instagram: string;
    facebook: string;
    tiktok: string;
    legalName: string;
  };
  brand: { primaryColor: string; mode: "light" | "dark" };
  hours: Record<Day, DayHours>;
  services: {
    reservations: boolean;
    maxPartySize?: number;
    delivery: boolean;
    deliveryFee?: number;
    deliveryMinimum?: number;
    deliveryFreeOver?: number;
    deliveryAreas: string;
    pickup: boolean;
    whatsappOrdering: boolean;
    payments: ("cash" | "card" | "whish")[];
    currency: (typeof CURRENCIES)[number];
  };
  extras: {
    menuLink: string;
    domain: string;
    plan: (typeof PLANS)[number]["id"];
    notes: string;
  };
  person: { name: string; role: string; phone: string };
};

const lunchDinner = (): DayHours => ({
  closed: false,
  shifts: [{ open: "12:00", close: "23:00" }],
});

export function emptyAnswers(plan?: string): OnboardingAnswers {
  return {
    restaurant: {
      name: "",
      type: "Restaurant",
      cuisine: [],
      priceRange: "$$",
      description: "",
      tagline: "",
      since: "",
    },
    contact: {
      mapsLink: "",
      street: "",
      area: "",
      city: "",
      country: "Lebanon",
      phone: "",
      whatsapp: "",
      email: "",
      instagram: "",
      facebook: "",
      tiktok: "",
      legalName: "",
    },
    brand: { primaryColor: COLOR_PRESETS[0], mode: "light" },
    hours: Object.fromEntries(DAYS.map((d) => [d, lunchDinner()])) as Record<
      Day,
      DayHours
    >,
    services: {
      reservations: true,
      maxPartySize: 8,
      delivery: false,
      deliveryAreas: "",
      pickup: false,
      whatsappOrdering: true,
      payments: ["cash"],
      currency: "USD",
    },
    extras: {
      menuLink: "",
      domain: "",
      plan: PLANS.some((p) => p.id === plan)
        ? (plan as OnboardingAnswers["extras"]["plan"])
        : "unsure",
      notes: "",
    },
    person: { name: "", role: "", phone: "" },
  };
}

/* ───────────── checks per step ───────────── */

export type Errors = Record<string, string>;

const isUrl = (v: string) => v === "" || /^https?:\/\/\S+\.\S+/i.test(v.trim());
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
const isPhone = (v: string) => v.replace(/\D/g, "").length >= 7;
const isTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

/** The steps, in order, with what each one needs before moving on */
export const STEPS = [
  "restaurant",
  "contact",
  "look",
  "hours",
  "services",
  "final",
  "review",
] as const;
export type Step = (typeof STEPS)[number];

export function validateStep(step: Step, a: OnboardingAnswers): Errors {
  const e: Errors = {};
  if (step === "restaurant") {
    if (a.restaurant.name.trim().length < 2)
      e["restaurant.name"] = "Add the restaurant's name";
    if (a.restaurant.cuisine.length === 0)
      e["restaurant.cuisine"] = "Pick or type at least one";
    if (a.restaurant.description.trim().length < 20)
      e["restaurant.description"] = "A sentence or two, at least 20 characters";
    if (a.restaurant.since && !/^(19|20)\d{2}$/.test(a.restaurant.since))
      e["restaurant.since"] = "Use a year, like 2015";
  }
  if (step === "contact") {
    const c = a.contact;
    if (c.city.trim().length < 2) e["contact.city"] = "Add the city";
    if (c.country.trim().length < 2) e["contact.country"] = "Add the country";
    if (!isPhone(c.phone))
      e["contact.phone"] = "Add a phone number guests can call";
    if (c.whatsapp && !isPhone(c.whatsapp))
      e["contact.whatsapp"] = "This number looks incomplete";
    if (!isEmail(c.email)) e["contact.email"] = "Add a valid email";
    for (const key of ["mapsLink", "instagram", "facebook", "tiktok"] as const)
      if (!isUrl(c[key]))
        e[`contact.${key}`] = "Paste the full link, starting with https://";
  }
  if (step === "look") {
    if (!/^#[0-9a-f]{6}$/i.test(a.brand.primaryColor))
      e["brand.primaryColor"] = "Pick a colour";
  }
  if (step === "hours") {
    const open = DAYS.filter((d) => !a.hours[d].closed);
    if (open.length === 0) e["hours"] = "Open at least one day";
    for (const d of open)
      a.hours[d].shifts.forEach((s, i) => {
        if (!isTime(s.open) || !isTime(s.close))
          e[`hours.${d}.${i}`] = "Add both times";
        else if (s.open === s.close)
          e[`hours.${d}.${i}`] = "Opening and closing can't be the same";
      });
  }
  if (step === "services") {
    const s = a.services;
    if ((s.delivery || s.pickup) && s.payments.length === 0)
      e["services.payments"] = "Choose at least one way to pay";
    if (s.delivery && s.deliveryFee === undefined)
      e["services.deliveryFee"] = "Add the delivery fee (0 if free)";
  }
  if (step === "final") {
    if (!isUrl(a.extras.menuLink))
      e["extras.menuLink"] = "Paste the full link, starting with https://";
    if (a.person.name.trim().length < 2) e["person.name"] = "Add your name";
    if (!isPhone(a.person.phone))
      e["person.phone"] = "Add a number we can reach you on";
  }
  return e;
}

/* ───────────── colours ───────────── */

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};
const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b]
    .map((c) =>
      Math.round(Math.max(0, Math.min(255, c)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`.toUpperCase();

/** Mixed toward white (amount > 0) or black (amount < 0) */
export function mix(hex: string, amount: number) {
  const [r, g, b] = hexToRgb(hex);
  const t = amount > 0 ? 255 : 0;
  const a = Math.abs(amount);
  return rgbToHex(r + (t - r) * a, g + (t - g) * a, b + (t - b) * a);
}

/** WCAG contrast of white text on this colour */
export function contrastWithWhite(hex: string) {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = hexToRgb(hex);
  const l = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return 1.05 / (l + 0.05);
}

/** The logo's main colours (most used first), skipping white, black, greys and transparency */
export async function logoColors(file: File): Promise<string[]> {
  if (!file.type.startsWith("image/")) return [];
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return [];
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    const buckets = new Map<
      string,
      { n: number; r: number; g: number; b: number }
    >();
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b, alpha] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
      if (alpha < 128) continue;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max > 235 && min > 225) continue; // white
      if (max < 30) continue; // black
      if (max - min < 25) continue; // grey
      const key = `${r >> 4},${g >> 4},${b >> 4}`;
      const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      bucket.n++;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      buckets.set(key, bucket);
    }
    return [...buckets.values()]
      .sort((x, y) => y.n - x.n)
      .slice(0, 4)
      .map((c) => rgbToHex(c.r / c.n, c.g / c.n, c.b / c.n));
  } catch {
    return [];
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ───────────── photos ───────────── */

/** Phone photos are 3–12 MB: shrink to 2000px JPEG before uploading. Falls back to the original. */
export async function shrinkPhoto(file: File, maxSide = 2000): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 400_000)
    return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas
      .getContext("2d")
      ?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.86),
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}

/* ───────────── the draft config.json ───────────── */

const slug = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "restaurant";

const TIMEZONES: Record<string, string> = {
  lebanon: "Asia/Beirut",
  "united arab emirates": "Asia/Dubai",
  uae: "Asia/Dubai",
  "saudi arabia": "Asia/Riyadh",
  ksa: "Asia/Riyadh",
  qatar: "Asia/Qatar",
  kuwait: "Asia/Kuwait",
  jordan: "Asia/Amman",
  egypt: "Africa/Cairo",
  cyprus: "Asia/Nicosia",
  france: "Europe/Paris",
  "united kingdom": "Europe/London",
  uk: "Europe/London",
};

const STRUCTURED_TYPE: Record<OnboardingAnswers["restaurant"]["type"], string> =
  {
    Restaurant: "Restaurant",
    Cafe: "CafeOrCoffeeShop",
    Bar: "BarOrPub",
    Bakery: "Bakery",
    FastFood: "FastFoodRestaurant",
    Other: "Restaurant",
  };

/** "+961 71 234 567" → "+96171234567" (the format config.json wants) */
const intl = (phone: string, country: string) => {
  const digits = phone.replace(/\D/g, "");
  if (phone.trim().startsWith("+")) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (/lebanon/i.test(country)) return `+961${digits.replace(/^0/, "")}`;
  return `+${digits}`;
};

/** "…/@33.8938,35.5018,17z…" → coordinates, when the Maps link has them */
function coordinates(link: string) {
  const m =
    /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/.exec(link) ??
    /[?&]q=(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/.exec(link);
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : undefined;
}

/** "Lebanese bakery in Beirut" */
const KIND: Record<OnboardingAnswers["restaurant"]["type"], string> = {
  Restaurant: "restaurant",
  Cafe: "café",
  Bar: "bar",
  Bakery: "bakery",
  FastFood: "food",
  Other: "food",
};

type Json = Record<string, unknown>;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const cut = (s: string, n: number) =>
  s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;

/**
 * The website's config.json for this restaurant, starting from the current one (`base`).
 * A DRAFT for the team: colours other than the primary, sections, photos' paths and texts get
 * a finishing pass before launch.
 */
export function buildConfig(a: OnboardingAnswers, base: Json): Json {
  const name = a.restaurant.name.trim();
  const oldName = String((base.brand as Json | undefined)?.name ?? "");
  // The demo's name inside page titles and texts becomes the new one
  const cfg = JSON.parse(
    oldName
      ? JSON.stringify(base).split(oldName).join(name.replace(/"/g, '\\"'))
      : JSON.stringify(base),
  ) as Json;

  const city = a.contact.city.trim();
  const cuisine = a.restaurant.cuisine;
  const s = a.services;
  const geo = coordinates(a.contact.mapsLink);
  const address = [a.contact.street, a.contact.area, city, a.contact.country]
    .filter(Boolean)
    .join(", ");
  const tagline =
    a.restaurant.tagline.trim() ||
    `${cuisine[0]} ${KIND[a.restaurant.type]} in ${city}`;
  // "myplace.com" → https://www.myplace.com; a subdomain ("order.myplace.com") stays as it is
  const host = a.extras.domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  const siteUrl = host
    ? `https://${host.split(".").length === 2 ? `www.${host}` : host}`
    : String((cfg.seo as Json).siteUrl);

  cfg.id = slug(name);

  const brand = cfg.brand as Json;
  brand.name = name;
  brand.tagline = cut(tagline, 120);
  brand.description = cut(a.restaurant.description.trim(), 300);
  brand.monogram = name.charAt(0).toUpperCase();

  // Only the primary is the client's choice; the team tunes the rest before launch
  const theme = cfg.theme as Json;
  theme.mode = a.brand.mode;
  const colors = theme.colors as { light: Json; dark?: Json };
  colors.light.primary = a.brand.primaryColor;
  if (colors.dark) colors.dark.primary = mix(a.brand.primaryColor, 0.18);

  const layout = cfg.layout as Json;
  (layout.footer as Json).copyright = `© {year} ${name}. All rights reserved.`;
  (layout.announcementBar as Json).enabled = false;
  if (layout.promoPopup) (layout.promoPopup as Json).enabled = false;

  // Content the client fills in the admin panel later: start empty, hide what needs it
  const content = cfg.content as Json;
  content.about = {
    ...(content.about as Json),
    title: a.restaurant.since
      ? `Serving ${city} since ${a.restaurant.since}`
      : `About ${name}`,
    body: [a.restaurant.description.trim()],
    highlights: [],
  };
  delete content.team;
  delete content.stats;
  delete content.faqs;
  const pages = cfg.pages as Record<string, Json>;
  const hide = (page: string, type: string) => {
    for (const section of (pages[page]?.sections as Json[] | undefined) ?? [])
      if (section.type === type) section.enabled = false;
  };
  hide("home", "stats");
  hide("about", "team");
  hide("about", "faq");
  if (pages.events) pages.events.enabled = false;
  if (pages.blog) pages.blog.enabled = false;
  if (pages.reservations) pages.reservations.enabled = s.reservations;
  if (!s.reservations) {
    hide("home", "reservationCta");
    for (const section of (pages.home?.sections as Json[] | undefined) ?? [])
      if (section.type === "hero") (section.props as Json).booking = false;
  }
  if (pages.about) {
    const header = (pages.about.sections as Json[]).find(
      (x) => x.type === "pageHeader",
    );
    if (header)
      (header.props as Json).subtitle = a.restaurant.since
        ? `Since ${a.restaurant.since}`
        : tagline;
  }

  const menu = cfg.menu as Json;
  const currency = menu.currency as { primary: Json; secondary?: Json };
  currency.primary.code = s.currency;
  if (currency.secondary)
    currency.secondary.enabled =
      s.currency === "USD" && /lebanon/i.test(a.contact.country);

  const business = cfg.business as Json;
  business.legalName = a.contact.legalName.trim() || name;
  business.cuisine = cuisine;
  business.priceRange = a.restaurant.priceRange;
  business.address = {
    street: a.contact.street.trim() || a.contact.area.trim() || city,
    city,
    ...(a.contact.area && { region: a.contact.area.trim() }),
    country: a.contact.country.trim(),
  };
  if (geo) business.geo = geo;
  else delete business.geo;
  business.mapEmbedUrl = geo
    ? `https://www.google.com/maps?q=${geo.lat},${geo.lng}&output=embed`
    : `https://www.google.com/maps?q=${encodeURIComponent(`${name}, ${address}`)}&output=embed`;
  business.phone = a.contact.phone.trim();
  business.email = a.contact.email.trim();
  const whatsapp = a.contact.whatsapp.trim();
  if (whatsapp)
    business.whatsapp = { number: intl(whatsapp, a.contact.country) };
  else delete business.whatsapp;
  business.socials = (["instagram", "facebook", "tiktok"] as const)
    .filter((p) => a.contact[p].trim())
    .map((platform) => ({ platform, url: a.contact[platform].trim() }));
  business.timezone =
    TIMEZONES[a.contact.country.trim().toLowerCase()] ?? business.timezone;
  business.specialHours = [];
  if (business.reservations) {
    const r = business.reservations as Json;
    r.maxPartySize = s.maxPartySize ?? r.maxPartySize;
  }

  const ordering = s.delivery || s.pickup;
  const features = cfg.features as Json;
  Object.assign(features, {
    reservations: s.reservations,
    onlineOrdering: ordering,
    delivery: s.delivery,
    pickup: s.pickup,
    whatsappOrdering: s.whatsappOrdering && !!whatsapp,
    whatsappButton: !!whatsapp,
    events: false,
    blog: false,
  });

  const order = cfg.ordering as Json | undefined;
  if (order) {
    (order.payments as Json).methods = s.payments.map(
      (p) => ({ cash: "cod", card: "stripe", whish: "whish" })[p],
    );
    if (s.delivery) {
      const d = (order.delivery as Json | undefined) ?? {
        etaMinutes: [35, 50],
        areas: [],
      };
      order.delivery = {
        ...d,
        fee: s.deliveryFee ?? 0,
        minimumOrder: s.deliveryMinimum ?? 0,
        ...(s.deliveryFreeOver ? { freeOver: s.deliveryFreeOver } : {}),
      };
      if (!s.deliveryFreeOver) delete (order.delivery as Json).freeOver;
    }
  }

  const seo = cfg.seo as Json;
  seo.siteName = name;
  seo.titleTemplate = `%s | ${name}`;
  seo.defaultTitle = cut(
    `${name} | ${cuisine[0]} ${KIND[a.restaurant.type]} in ${city}`,
    70,
  );
  seo.defaultDescription = cut(a.restaurant.description.trim(), 200);
  seo.keywords = [
    ...new Set([
      name.toLowerCase(),
      ...cuisine.map((c) => c.toLowerCase()),
      city.toLowerCase(),
      "restaurant",
    ]),
  ];
  seo.siteUrl = siteUrl;
  seo.ogImageAlt = `${name} in ${city}`;
  delete seo.twitterHandle;
  seo.structuredData = {
    type: STRUCTURED_TYPE[a.restaurant.type],
    servesCuisine: cuisine,
    acceptsReservations: s.reservations,
  };

  const integrations = cfg.integrations as Json;
  integrations.googleAnalyticsId = "";
  integrations.metaPixelId = "";
  integrations.googleTagManagerId = "";
  integrations.customDomain = a.extras.domain.trim();
  if (integrations.emailProvider)
    (integrations.emailProvider as Json).formsRecipient =
      a.contact.email.trim();

  return clone(cfg);
}
