import React from "react";
import type { Metadata } from "next";
import { getConfig } from "@/config/loader";
import { heroSchema } from "@/components/home/schema";
import { AboutSection } from "@/components/common/Index";
import MenuPreview from "@/components/home/MenuPreview";
import StatsPreview from "@/components/home/StatsPreview";
import Hours from "@/components/home/Hours";
import { ReservationCta } from "@/components/home/ReservationCta";
import { Newsletter } from "@/components/home/Newsletter";
import HeroLayout from "@/components/home/HeroLayout";

export function generateMetadata(): Metadata {
  const { pages } = getConfig();
  return {
    title: `${pages.home.seo.title}`,
    description: pages.home.seo.description,
  };
}

const HomePage: React.FC = async () => {
  const config = getConfig();

  return (
    <>
      {config.pages.home.sections
        .filter((section) => section.enabled)
        .map((section) => {
          switch (section.type) {
            case "hero":
              return (
                <HeroLayout
                  key={section.id}
                  props={heroSchema.parse(section.props)}
                  variant={section.variant}
                  business={config.business}
                  reservationsEnabled={
                    config.pages.reservations?.enabled === true
                  }
                />
              );
            case "about":
              return (
                <AboutSection
                  key={section.id}
                  section={section}
                  content={config.content.about}
                />
              );
            case "menuPreview":
              return <MenuPreview key={section.id} />;
            case "stats":
              return <StatsPreview key={section.id} />;
            case "hoursLocation":
              return <Hours key={section.id} />;
            case "reservationCta":
              if (config.features.reservations) {
                return <ReservationCta key={section.id} section={section} />;
              }
            case "newsletter":
              return <Newsletter key={section.id} section={section} />;
            default:
              return null;
          }
        })}
    </>
  );
};

export default HomePage;
