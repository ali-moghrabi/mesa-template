"use client";

import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  slides: string[];
  intervalMs: number;
};

export function HeroSliderBackground({ slides, intervalMs }: Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    watchDrag: false,
  });

  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  const count = slides.length;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const handleChange = () => {
      setReducedMotion(mediaQuery.matches);
    };

    handleChange();

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;

    setIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;

    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);

    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  useEffect(() => {
    if (!emblaApi || count <= 1 || reducedMotion) {
      return;
    }

    const timer = window.setTimeout(() => {
      emblaApi.scrollNext(true);
    }, intervalMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [emblaApi, index, intervalMs, count, reducedMotion]);

  const goTo = useCallback(
    (slideIndex: number) => {
      if (!emblaApi) return;

      emblaApi.scrollTo(slideIndex, true);
    },
    [emblaApi],
  );

  if (!slides.length) return null;

  return (
    <>
      <div
        ref={emblaRef}
        className="absolute inset-0 -z-10 overflow-hidden"
        aria-label="Hero image slider"
      >
        <div className="relative h-full w-full">
          {slides.map((src, i) => {
            const active = i === index;

            return (
              <div
                key={`${src}-${i}`}
                className={cn(
                  "absolute inset-0 h-full w-full",
                  "transition-opacity duration-1000 ease-in-out",
                  "motion-reduce:transition-none",
                  active ? "opacity-100" : "opacity-0",
                )}
                aria-hidden={!active}
              >
                <Image
                  src={`/${src}`}
                  alt=""
                  fill
                  priority={i === 0}
                  sizes="100vw"
                  className={cn(
                    "object-cover",
                    active && !reducedMotion && "animate-settle",
                  )}
                />
              </div>
            );
          })}
        </div>
      </div>

      {count > 1 && (
        <div
          role="group"
          aria-label="Choose image"
          className="absolute inset-x-0 -bottom-4 sm:-bottom-3 lg:bottom-0 z-20 flex gap-1.5 px-(--pad) pb-3"
        >
          {slides.map((src, i) => {
            const current = i === index;

            return (
              <button
                key={`${src}-${i}`}
                type="button"
                aria-label={`Show image ${i + 1} of ${count}`}
                aria-current={current}
                onClick={() => goTo(i)}
                className="flex-1 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent cursor-pointer hover:opacity-60 transition"
              >
                <span className="block h-0.75 md:h-1 overflow-hidden rounded-full bg-white/30">
                  <span
                    className={cn(
                      "block h-full origin-left bg-white",
                      i < index && "scale-x-100",
                      i > index && "scale-x-0",
                      current && reducedMotion && "scale-x-100",
                    )}
                    style={
                      current && !reducedMotion
                        ? {
                            animation: `mesa-progress ${intervalMs}ms linear forwards`,
                          }
                        : undefined
                    }
                  />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
