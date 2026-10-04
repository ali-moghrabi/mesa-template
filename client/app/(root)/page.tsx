import React from "react";
import type { Metadata } from "next";
import { getConfig } from "@/config/loader";
import { heroSchema } from "@/components/home/schema";
import { HeroFullscreen } from "@/components/home/HeroFullscreen";

export function generateMetadata(): Metadata {
  const { pages } = getConfig();
  return {
    title: `${pages.home.seo.title}`,
    description: pages.home.seo.description,
  };
}

const HomePage: React.FC = () => {
  const config = getConfig();
  const hero = config.pages.home.sections.find(
    (s) => s.type === "hero" && s.enabled,
  );

  return (
    <>
      {hero && (
        <HeroFullscreen
          props={heroSchema.parse(hero.props)}
          business={config.business}
          reservationsEnabled={config.features.reservations}
        />
      )}
    </>
  );
};

export default HomePage;
