"use client";

import { useEffect, useRef } from "react";

const DURATION_MS = 1800;

type Parts = {
  prefix: string;
  number: number;
  decimals: number;
  grouped: boolean;
  suffix: string;
};

function parse(value: string): Parts | null {
  const match = /^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/.exec(value.trim());
  if (!match) return null;
  const [, prefix, raw, suffix] = match;
  return {
    prefix,
    number: Number(raw.replace(/,/g, "")),
    decimals: raw.includes(".") ? raw.split(".")[1].length : 0,
    grouped: raw.includes(","),
    suffix,
  };
}

const formatter = (parts: Parts) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: parts.decimals,
    maximumFractionDigits: parts.decimals,
    useGrouping: parts.grouped,
  });

export function StatValue({
  value,
  className,
  suffixClassName,
}: {
  value: string;
  className?: string;
  suffixClassName?: string;
}) {
  const numberRef = useRef<HTMLSpanElement>(null);
  const parts = parse(value);

  useEffect(() => {
    const el = numberRef.current;
    const p = parse(value);
    if (!el || !p) return;
    const format = formatter(p);
    const final = format.format(p.number);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = final;
      return;
    }

    el.textContent = format.format(0);
    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / DURATION_MS);
          const eased = 1 - Math.pow(1 - t, 4);
          el.textContent = t < 1 ? format.format(p.number * eased) : final;
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);

  if (!parts) return <span className={className}>{value}</span>;
  return (
    <span className={className}>
      <span className="sr-only">{value}</span>
      <span aria-hidden="true">
        {parts.prefix}
        <span ref={numberRef}>{formatter(parts).format(0)}</span>
        {parts.suffix && (
          <span className={suffixClassName}>{parts.suffix}</span>
        )}
      </span>
    </span>
  );
}
