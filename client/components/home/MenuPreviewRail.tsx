"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function MenuPreviewRail({
  header,
  children,
}: {
  header: ReactNode;
  children: ReactNode;
}) {
  const rail = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const update = () =>
      setEdges({
        start: el.scrollLeft <= 4,
        end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
      });

    const observer = new ResizeObserver(update);
    observer.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, []);

  const move = (direction: 1 | -1) => {
    const el = rail.current;
    if (!el) return;
    const card = el.querySelector("li");
    const step = card
      ? card.getBoundingClientRect().width + 20
      : el.clientWidth * 0.8;
    el.scrollBy({
      left: direction * step,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  };

  const button =
    "grid size-12 place-items-center rounded-full border border-foreground/15 bg-background text-foreground transition hover:border-foreground hover:bg-foreground hover:text-background disabled:pointer-events-none disabled:opacity-35";

  return (
    <>
      <div className="flex items-end justify-between gap-6">
        {header}
        <div className="hidden shrink-0 gap-2 sm:flex">
          <button
            type="button"
            onClick={() => move(-1)}
            disabled={edges.start}
            aria-label="Previous dishes"
            className={button}
          >
            <ArrowLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            disabled={edges.end}
            aria-label="More dishes"
            className={button}
          >
            <ArrowRight className="size-5" />
          </button>
        </div>
      </div>
      <ul
        ref={rail}
        className={cn(
          "-mx-(--pad) mt-10 flex snap-x snap-mandatory scroll-px-(--pad) gap-5 overflow-x-auto px-(--pad) pb-2 sm:mt-12",
          "scrollbar-none [&::-webkit-scrollbar]:hidden",
        )}
      >
        {children}
      </ul>
    </>
  );
}
