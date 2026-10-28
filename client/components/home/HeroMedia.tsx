"use client";

import Image from "next/image";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { ChevronDown, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { HeroFullscreen } from "./HeroFullscreen";
import { HeroSliderBackground } from "./HeroSliderBackground";
import { HeroVideoBackground } from "./HeroVideoBackground";

export type HeroVariant = "fullscreen" | "video" | "slider";

type Media = {
  variant: HeroVariant;
  image?: string;
  slides: string[];
  interval: number;
  video?: string;
  webm?: string;
  poster?: string;
};

type HeroMediaState = Media & {
  index: number;
  previous: number | null;
  goTo: (i: number) => void;
  paused: boolean;
  togglePaused: () => void;
  videoRef: RefObject<HTMLVideoElement | null>;
  playing: boolean;
  setPlaying: (v: boolean) => void;
  reducedMotion: boolean;
};

const HeroMediaContext = createContext<HeroMediaState | null>(null);

export function useHeroMedia() {
  const value = useContext(HeroMediaContext);
  if (!value) throw new Error("useHeroMedia must be used inside <HeroMedia>");
  return value;
}

const motionQuery = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (onChange: () => void) => {
  const media = window.matchMedia(motionQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
};
const readMotion = () => window.matchMedia(motionQuery).matches;
const serverMotion = () => false;

const MIN_INTERVAL = 4000;

export function HeroMedia({
  children,
  ...media
}: Media & { children: ReactNode }) {
  const reducedMotion = useSyncExternalStore(
    subscribeMotion,
    readMotion,
    serverMotion,
  );
  const count = media.slides.length;
  const interval = Math.max(media.interval || 8000, MIN_INTERVAL);
  const [index, setIndex] = useState(0);
  const [previous, setPrevious] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const goTo = useCallback(
    (next: number) => {
      if (next === index) return;
      setPrevious(index);
      setIndex(next);
    },
    [index],
  );

  useEffect(() => {
    if (media.variant !== "slider" || count <= 1 || paused || reducedMotion)
      return;
    const timer = window.setTimeout(() => goTo((index + 1) % count), interval);
    return () => window.clearTimeout(timer);
  }, [media.variant, count, paused, reducedMotion, index, interval, goTo]);

  const togglePaused = useCallback(() => setPaused((p) => !p), []);

  const value = useMemo<HeroMediaState>(
    () => ({
      ...media,
      interval,
      index,
      previous,
      goTo,
      paused,
      togglePaused,
      videoRef,
      playing,
      setPlaying,
      reducedMotion,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      media.variant,
      media.image,
      media.slides,
      media.video,
      media.webm,
      media.poster,
      interval,
      index,
      previous,
      goTo,
      paused,
      togglePaused,
      playing,
      reducedMotion,
    ],
  );

  return (
    <HeroMediaContext.Provider value={value}>
      <div
        aria-hidden="true"
        className="hero-aperture absolute inset-0 -z-10 overflow-hidden bg-neutral-900"
      >
        <div className="hero-drift absolute inset-0">
          <div className="hero-zoom absolute inset-0">
            {media.variant === "video" ? (
              <HeroVideoBackground />
            ) : media.variant === "slider" && count > 0 ? (
              <HeroSliderBackground />
            ) : (
              <HeroFullscreen src={media.image ?? media.slides[0]} />
            )}
          </div>
        </div>
      </div>
      {children}
    </HeroMediaContext.Provider>
  );
}

const ROUND_BUTTON =
  "grid size-10 shrink-0 cursor-pointer place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/20 backdrop-blur-md transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

export function HeroMediaControls() {
  const media = useHeroMedia();
  if (media.variant === "slider" && media.slides.length > 1)
    return <SliderControls />;
  if (media.variant === "video") return <VideoControl />;
  return <ScrollCue />;
}

function SliderControls() {
  const { slides, index, goTo, paused, togglePaused, interval, reducedMotion } =
    useHeroMedia();
  const count = slides.length;
  const stopped = paused || reducedMotion;

  return (
    <div className="flex items-center gap-3">
      <div
        role="group"
        aria-label="Choose a photo"
        className="flex items-center gap-2"
      >
        {slides.map((src, i) => {
          const current = i === index;
          return (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Photo ${i + 1} of ${count}`}
              aria-current={current || undefined}
              className={cn(
                "group relative cursor-pointer rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
              )}
            >
              <span
                className={cn(
                  "relative hidden h-11 w-16 overflow-hidden rounded-xl ring-1 transition duration-500 sm:block",
                  current
                    ? "ring-white/80"
                    : "opacity-55 ring-white/15 group-hover:opacity-90",
                )}
              >
                <Image
                  src={`/${src}`}
                  alt=""
                  fill
                  sizes="64px"
                  className={cn(
                    "object-cover transition-transform duration-700",
                    current ? "scale-100" : "scale-110 group-hover:scale-100",
                  )}
                />
              </span>
              <span className="mt-2 block h-0.75 w-10 overflow-hidden rounded-full bg-white/25 sm:w-16">
                <span
                  key={current ? `on-${index}` : "off"}
                  className={cn(
                    "block h-full origin-left rounded-full bg-white",
                    !current && (i < index ? "scale-x-100" : "scale-x-0"),
                    current && (stopped ? "scale-x-100" : "hero-bar"),
                  )}
                  style={
                    current && !stopped
                      ? ({ "--kb": `${interval}ms` } as CSSProperties)
                      : undefined
                  }
                />
              </span>
            </button>
          );
        })}
      </div>
      {!reducedMotion && (
        <button
          type="button"
          onClick={togglePaused}
          aria-label={paused ? "Play the photos" : "Pause the photos"}
          className={ROUND_BUTTON}
        >
          {paused ? (
            <Play aria-hidden="true" className="ml-0.5 size-4" />
          ) : (
            <Pause aria-hidden="true" className="size-4" />
          )}
        </button>
      )}
    </div>
  );
}

function VideoControl() {
  const { playing, videoRef } = useHeroMedia();
  return (
    <button
      type="button"
      onClick={() => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) video.play().catch(() => {});
        else video.pause();
      }}
      aria-label={playing ? "Pause the video" : "Play the video"}
      className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-white/10 pr-4 pl-3 text-sm font-medium text-white ring-1 ring-white/20 backdrop-blur-md transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      {playing ? (
        <Pause aria-hidden="true" className="size-4" />
      ) : (
        <Play aria-hidden="true" className="size-4" />
      )}
      {playing ? "Pause" : "Play"}
    </button>
  );
}

function ScrollCue() {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => {
        const hero = ref.current?.closest("section");
        if (!hero) return;
        window.scrollTo({
          top: hero.offsetTop + hero.offsetHeight,
          behavior: readMotion() ? "auto" : "smooth",
        });
      }}
      aria-label="Scroll to the rest of the page"
      className={ROUND_BUTTON}
    >
      <ChevronDown aria-hidden="true" className="hero-cue size-4.5" />
    </button>
  );
}
