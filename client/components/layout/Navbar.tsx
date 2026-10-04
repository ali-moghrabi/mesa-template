import { getConfig } from "@/config/loader";
import { NavbarClient } from "./layout_components/NavbarClient";

export function Navbar() {
  const { brand, layout, business, features } = getConfig();
  const { navbar, announcementBar: bar } = layout;

  return (
    <NavbarClient
      brandName={brand.name}
      variant={navbar.variant}
      sticky={navbar.sticky}
      links={navbar.links ?? []}
      isDarkModeEnabled={features.darkModeToggle}
      cta={navbar.cta}
      announcement={
        bar.enabled
          ? { text: bar.text, link: bar.link, dismissible: bar.dismissible }
          : undefined
      }
      info={{
        address: `${business.address.street}, ${business.address.city}`,
        phone: business.phone,
      }}
    />
  );
}
