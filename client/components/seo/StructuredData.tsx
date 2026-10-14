import { getOpeningHours } from "@/lib/opening-hours-server";
import { jsonLd, restaurantJsonLd } from "@/config/seo";

export async function StructuredData() {
  const hours = await getOpeningHours().catch(() => null);
  return restaurantJsonLd(hours).map((data, i) => (
    <script
      key={i}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLd(data) }}
    />
  ));
}
