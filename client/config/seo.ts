import "server-only";
import type { Metadata, Viewport } from "next";
import { z } from "zod";
import { getConfig } from "@/config/loader";
import type { OpeningHours } from "@/lib/opening-hours";

const SCHEMA_TYPES = [
  "Restaurant",
  "CafeOrCoffeeShop",
  "BarOrPub",
  "Bakery",
  "FastFoodRestaurant",
  "IceCreamShop",
  "Winery",
  "Brewery",
] as const;

const seoSchema = z.object({
  siteName: z.string().optional().catch(undefined),
  titleTemplate: z
    .string()
    .refine((t) => t.includes("%s"))
    .optional()
    .catch(undefined),
  defaultTitle: z.string().optional().catch(undefined),
  defaultDescription: z.string().catch(""),
  keywords: z.array(z.string()).catch([]),
  siteUrl: z.string().catch("http://localhost:3000"),
  ogImage: z.string().optional().catch(undefined),
  ogImageAlt: z.string().optional().catch(undefined),
  twitterHandle: z.string().optional().catch(undefined),
  locale: z.string().catch("en_US"),
  noindex: z.boolean().catch(false),
  verification: z
    .object({
      google: z.string().optional(),
      bing: z.string().optional(),
      yandex: z.string().optional(),
    })
    .catch({}),
  structuredData: z
    .object({
      type: z.enum(SCHEMA_TYPES).catch("Restaurant"),
      servesCuisine: z.array(z.string()).optional().catch(undefined),
      acceptsReservations: z.boolean().optional().catch(undefined),
    })
    .catch({ type: "Restaurant" }),
});

type Seo = z.infer<typeof seoSchema>;

type LooseConfig = {
  brand: {
    name: string;
    description?: string;
    tagline?: string;
    logo?: { light?: string; dark?: string } | string;
    ogImage?: string;
  };
  seo?: unknown;
  business?: {
    priceRange?: string;
    cuisine?: string[];
    address?: {
      street?: string;
      city?: string;
      region?: string;
      postalCode?: string;
      country?: string;
    };
    geo?: { lat: number; lng: number };
    phone?: string;
    email?: string;
    socials?: { url: string }[];
  };
  pages?: Record<
    string,
    | { enabled?: boolean; seo?: { title?: string; description?: string } }
    | undefined
  >;
  features?: Record<string, boolean | undefined>;
  legal?: Record<string, unknown>;
  theme?: {
    colors?: {
      light?: { background?: string };
      dark?: { background?: string };
    };
  };
  locale?: { language?: string };
};

export function seoConfig(): {
  config: LooseConfig;
  seo: Seo;
  siteUrl: string;
  siteName: string;
} {
  const config = getConfig() as unknown as LooseConfig;
  const seo = seoSchema.parse(config.seo ?? {});
  return {
    config,
    seo,
    siteUrl: seo.siteUrl.replace(/\/+$/, ""),
    siteName: seo.siteName || config.brand.name,
  };
}

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return (
    `${seoConfig().siteUrl}/${path.replace(/^\/+/, "")}`.replace(/\/$/, "") ||
    "/"
  );
}

function fullTitle(title: string, seo: Seo, siteName: string): string {
  if (title.toLowerCase().includes(siteName.toLowerCase())) return title;
  return (seo.titleTemplate ?? `%s | ${siteName}`).replace("%s", title);
}

export function rootMetadata(): Metadata {
  const { config, seo, siteUrl, siteName } = seoConfig();
  const title =
    seo.defaultTitle ??
    `${siteName}${config.brand.tagline ? ` | ${config.brand.tagline}` : ""}`;
  const description = seo.defaultDescription || config.brand.description || "";
  const image = seo.ogImage ?? config.brand.ogImage;

  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    applicationName: siteName,
    keywords: seo.keywords.length ? seo.keywords : undefined,
    openGraph: {
      type: "website",
      siteName,
      locale: seo.locale,
      title,
      description,
      ...(image && {
        images: [
          {
            url: `/${image}`,
            width: 1200,
            height: 630,
            alt: seo.ogImageAlt ?? siteName,
          },
        ],
      }),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(seo.twitterHandle && {
        site: seo.twitterHandle,
        creator: seo.twitterHandle,
      }),
      ...(image && { images: [`/${image}`] }),
    },
    robots: seo.noindex
      ? {
          index: false,
          follow: false,
          googleBot: { index: false, follow: false },
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
          },
        },
    verification: {
      ...(seo.verification.google && { google: seo.verification.google }),
      ...(seo.verification.yandex && { yandex: seo.verification.yandex }),
      ...(seo.verification.bing && {
        other: { "msvalidate.01": seo.verification.bing },
      }),
    },
    formatDetection: { telephone: false, email: false, address: false },
  };
}

export function rootViewport(): Viewport {
  const { config } = seoConfig();
  const light = config.theme?.colors?.light?.background;
  const dark = config.theme?.colors?.dark?.background;
  return {
    width: "device-width",
    initialScale: 1,
    themeColor: [
      ...(light
        ? [{ media: "(prefers-color-scheme: light)", color: light }]
        : []),
      ...(dark ? [{ media: "(prefers-color-scheme: dark)", color: dark }] : []),
    ],
  };
}

type PageSeo = {
  title: string;
  description?: string;
  path: string;
  image?: string;
  noindex?: boolean;
};

export function pageMetadata({
  title,
  description,
  path,
  image,
  noindex,
}: PageSeo): Metadata {
  const { seo, siteName, config } = seoConfig();
  const full = fullTitle(title, seo, siteName);
  const text =
    description || seo.defaultDescription || config.brand.description || "";
  const shareImage = image ?? seo.ogImage ?? config.brand.ogImage;
  const images = shareImage
    ? [
        {
          url: /^https?:/.test(shareImage)
            ? shareImage
            : `/${shareImage.replace(/^\/+/, "")}`,
          alt: seo.ogImageAlt ?? siteName,
        },
      ]
    : undefined;
  return {
    title: { absolute: full },
    description: text,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName,
      locale: seo.locale,
      title: full,
      description: text,
      url: path,
      ...(images && { images }),
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: full,
      description: text,
      ...(images && { images: images.map((i) => i.url) }),
    },
    ...((noindex || seo.noindex) && {
      robots: { index: false, follow: !seo.noindex },
    }),
  };
}

export function configPageMetadata(
  key: string,
  path: string,
  fallback: { title: string; description?: string },
): Metadata {
  const page = seoConfig().config.pages?.[key];
  return pageMetadata({
    title: page?.seo?.title || fallback.title,
    description: page?.seo?.description || fallback.description,
    path,
  });
}

export function publicRoutes(): {
  path: string;
  priority: number;
  changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
}[] {
  const { config } = seoConfig();
  const on = (key: string) => config.pages?.[key]?.enabled === true;
  const feature = (key: string) => config.features?.[key] !== false;
  const routes: ReturnType<typeof publicRoutes> = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
  ];
  if (on("menu"))
    routes.push({ path: "/menu", priority: 0.9, changeFrequency: "daily" });
  if (on("reservations") && feature("reservations"))
    routes.push({
      path: "/reservations",
      priority: 0.8,
      changeFrequency: "monthly",
    });
  if (on("about"))
    routes.push({ path: "/about", priority: 0.6, changeFrequency: "monthly" });
  if (on("gallery"))
    routes.push({ path: "/gallery", priority: 0.5, changeFrequency: "weekly" });
  if (on("contact"))
    routes.push({ path: "/contact", priority: 0.6, changeFrequency: "yearly" });
  for (const doc of ["privacy", "terms"])
    if (config.legal?.[doc])
      routes.push({
        path: `/legal/${doc}`,
        priority: 0.2,
        changeFrequency: "yearly",
      });
  return routes;
}

export const PRIVATE_PATHS = [
  "/admin",
  "/account",
  "/payment",
  "/api",
  "/newsletter",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
];

const DAY_URL: Record<string, string> = {
  monday: "https://schema.org/Monday",
  tuesday: "https://schema.org/Tuesday",
  wednesday: "https://schema.org/Wednesday",
  thursday: "https://schema.org/Thursday",
  friday: "https://schema.org/Friday",
  saturday: "https://schema.org/Saturday",
  sunday: "https://schema.org/Sunday",
};

export function restaurantJsonLd(
  hours: OpeningHours | null,
): Record<string, unknown>[] {
  const { config, seo, siteUrl, siteName } = seoConfig();
  const b = config.business ?? {};
  const on = (key: string) => config.pages?.[key]?.enabled === true;
  const logoPath =
    typeof config.brand.logo === "string"
      ? config.brand.logo
      : config.brand.logo?.light;
  const image = seo.ogImage ?? config.brand.ogImage;
  const takesBookings =
    (seo.structuredData.acceptsReservations ?? true) &&
    on("reservations") &&
    config.features?.reservations === true;
  const ordersOnline = config.features?.onlineOrdering === true && on("menu");

  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 60 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const opening = hours
    ? [
        ...hours.weekly.flatMap((d) =>
          d.shifts.map((s) => ({
            "@type": "OpeningHoursSpecification",
            dayOfWeek: DAY_URL[d.day],
            opens: s.open,
            closes: s.close,
          })),
        ),
        ...hours.exceptions
          .filter((e) => e.date >= today && e.date <= soon)
          .flatMap((e) =>
            (e.shifts.length
              ? e.shifts
              : [{ open: "00:00", close: "00:00" }]
            ).map((s) => ({
              "@type": "OpeningHoursSpecification",
              validFrom: e.date,
              validThrough: e.date,
              opens: s.open,
              closes: s.close,
            })),
          ),
      ]
    : undefined;

  const restaurant: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": seo.structuredData.type,
    "@id": `${siteUrl}/#restaurant`,
    name: config.brand.name,
    description:
      config.brand.description || seo.defaultDescription || undefined,
    url: siteUrl,
    ...(image && { image: [absoluteUrl(image)] }),
    ...(logoPath && { logo: absoluteUrl(logoPath) }),
    ...(b.phone && { telephone: b.phone }),
    ...(b.email && { email: b.email }),
    ...(b.priceRange && { priceRange: b.priceRange }),
    servesCuisine: seo.structuredData.servesCuisine ?? b.cuisine,
    ...(b.address && {
      address: {
        "@type": "PostalAddress",
        streetAddress: b.address.street,
        addressLocality: b.address.city,
        ...(b.address.region && { addressRegion: b.address.region }),
        ...(b.address.postalCode && { postalCode: b.address.postalCode }),
        addressCountry: b.address.country,
      },
    }),
    ...(b.geo && {
      geo: {
        "@type": "GeoCoordinates",
        latitude: b.geo.lat,
        longitude: b.geo.lng,
      },
      hasMap: `https://www.google.com/maps/search/?api=1&query=${b.geo.lat},${b.geo.lng}`,
    }),
    ...(opening?.length && { openingHoursSpecification: opening }),
    ...(on("menu") && { hasMenu: `${siteUrl}/menu` }),
    acceptsReservations: takesBookings ? `${siteUrl}/reservations` : false,
    ...(b.socials?.length && { sameAs: b.socials.map((s) => s.url) }),
    potentialAction: [
      ...(takesBookings
        ? [
            {
              "@type": "ReserveAction",
              target: {
                "@type": "EntryPoint",
                urlTemplate: `${siteUrl}/reservations`,
                actionPlatform: [
                  "https://schema.org/DesktopWebPlatform",
                  "https://schema.org/MobileWebPlatform",
                ],
              },
              result: {
                "@type": "FoodEstablishmentReservation",
                name: "Book a table",
              },
            },
          ]
        : []),
      ...(ordersOnline
        ? [
            {
              "@type": "OrderAction",
              target: {
                "@type": "EntryPoint",
                urlTemplate: `${siteUrl}/menu`,
                actionPlatform: [
                  "https://schema.org/DesktopWebPlatform",
                  "https://schema.org/MobileWebPlatform",
                ],
              },
              deliveryMethod: [
                ...(config.features?.delivery
                  ? ["http://purl.org/goodrelations/v1#DeliveryModeOwnFleet"]
                  : []),
                ...(config.features?.pickup
                  ? ["http://purl.org/goodrelations/v1#DeliveryModePickUp"]
                  : []),
              ],
            },
          ]
        : []),
    ],
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    url: siteUrl,
    name: siteName,
    inLanguage: config.locale?.language ?? "en",
    publisher: { "@id": `${siteUrl}/#restaurant` },
  };

  return [restaurant, website];
}

export const jsonLd = (data: unknown) =>
  JSON.stringify(data).replace(/</g, "\\u003c");
