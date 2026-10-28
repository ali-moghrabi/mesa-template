"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { useHeroMedia } from "./HeroMedia";

export function HeroSliderBackground() {
  const { slides, index, previous, interval, paused, reducedMotion } =
    useHeroMedia();
  const drift = { "--kb": `${interval + 2000}ms` } as CSSProperties;

  return (
    <>
      {slides.map((src, i) => {
        const active = i === index;
        const moving = active || i === previous;
        return (
          <div
            key={`${src}-${i}`}
            className={cn(
              "absolute inset-0 transition-opacity duration-1400 ease-in-out motion-reduce:duration-300",
              active ? "z-10 opacity-100" : "z-0 opacity-0",
            )}
          >
            <div
              key={active ? `on-${index}` : `off-${i}`}
              style={drift}
              className={cn(
                "absolute inset-0",
                moving &&
                  !reducedMotion &&
                  (i % 2 === 0 ? "hero-kb-a" : "hero-kb-b"),
                paused && "paused",
              )}
            >
              <Image
                src={`/${src}`}
                alt=""
                fill
                preload={i === 0}
                loading={i === 0 ? undefined : "eager"}
                sizes="100vw"
                className="object-cover"
              />
            </div>
          </div>
        );
      })}
    </>
  );
}
