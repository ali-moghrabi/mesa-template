"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useHeroMedia } from "./HeroMedia";

type NavigatorWithConnection = Navigator & {
  connection?: { saveData?: boolean };
};

export function HeroVideoBackground() {
  const { video, webm, poster, setPlaying, videoRef: ref } = useHeroMedia();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.muted = true;
    const saveData =
      (navigator as NavigatorWithConnection).connection?.saveData === true;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still || saveData) return;
    const start = () => {
      el.preload = "auto";
      el.play().catch(() => {});
    };
    if (document.readyState === "complete") {
      start();
      return;
    }
    window.addEventListener("load", start, { once: true });
    return () => window.removeEventListener("load", start);
  }, [ref]);

  return (
    <>
      {poster && (
        <Image
          src={`/${poster}`}
          alt=""
          fill
          preload
          sizes="100vw"
          className="object-cover"
        />
      )}
      {video && (
        <video
          ref={ref}
          muted
          loop
          playsInline
          preload="none"
          tabIndex={-1}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onError={() => setPlaying(false)}
          onPlaying={() => setShown(true)}
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-1000 select-none",
            shown ? "opacity-100" : "opacity-0",
          )}
        >
          {webm && <source src={`/${webm}`} type="video/webm" />}
          <source src={`/${video}`} type="video/mp4" />
        </video>
      )}
    </>
  );
}
