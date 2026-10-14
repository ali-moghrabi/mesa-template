import { z } from "zod";
import { getConfig } from "@/config/loader";
import { CookieConsent, type CookieTexts } from "./CookieConsent";
import { ConsentScripts } from "./ConsentScripts";

const textsSchema = z.object({
  title: z.string().catch("Cookies on {brand}"),
  message: z
    .string()
    .catch(
      "We use cookies to keep the site working and, with your permission, to understand how it's used.",
    ),
  acceptLabel: z.string().catch("Accept all"),
  declineLabel: z.string().catch("Decline"),
  manageLabel: z.string().catch("Manage preferences"),
  policyHref: z.string().catch("/legal/privacy#cookies"),
});

export function Consent() {
  const config = getConfig() as unknown as {
    brand: { name: string };
    features?: { cookieBanner?: boolean };
    legal?: { cookies?: unknown; privacy?: unknown };
    integrations?: {
      googleAnalyticsId?: string;
      googleTagManagerId?: string;
      metaPixelId?: string;
    };
  };
  const banner = config.features?.cookieBanner === true;
  const ids = config.integrations ?? {};
  const parsed = textsSchema.parse(config.legal?.cookies ?? {});
  const texts: CookieTexts = {
    ...parsed,
    title: parsed.title.replace("{brand}", config.brand.name),
    policyHref: config.legal?.privacy ? parsed.policyHref : undefined,
  };

  const tools = {
    analytics: [
      ids.googleAnalyticsId && "Google Analytics",
      ids.googleTagManagerId && "Google Tag Manager",
    ].filter(Boolean) as string[],
    marketing: [ids.metaPixelId && "Meta Pixel"].filter(Boolean) as string[],
  };

  return (
    <>
      {banner && <CookieConsent texts={texts} tools={tools} />}
      <ConsentScripts
        requireConsent={banner}
        googleAnalyticsId={ids.googleAnalyticsId || undefined}
        googleTagManagerId={ids.googleTagManagerId || undefined}
        metaPixelId={ids.metaPixelId || undefined}
      />
    </>
  );
}
