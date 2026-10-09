"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { isRemote, mediaSrc } from "@/admin/lib/menu/format";

const SMALL_WORDS = new Set([
  "a",
  "an",
  "and",
  "the",
  "of",
  "with",
  "in",
  "on",
  "de",
  "la",
  "le",
  "al",
  "el",
]);

export function DishThumb({
  image,
  name,
  className,
}: {
  image?: string;
  name: string;
  className?: string;
}) {
  const src = mediaSrc(image);
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = src && failed !== src;

  const initials =
    name
      .split(/\s+/)
      .filter(
        (word) =>
          /^[\p{L}\p{N}]/u.test(word) && !SMALL_WORDS.has(word.toLowerCase()),
      )
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join("") || "?";

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/5 ring-inset",
        className,
      )}
    >
      {showImage ? (
        <Image
          src={src}
          alt=""
          fill
          sizes="80px"
          unoptimized={isRemote(src)}
          onError={() => setFailed(src)}
          className="object-cover"
        />
      ) : (
        <div className="grid size-full place-items-center bg-[radial-gradient(circle_at_30%_20%,color-mix(in_srgb,var(--primary)_22%,transparent),transparent_70%)] text-sm font-semibold text-primary">
          {initials}
        </div>
      )}
    </div>
  );
}
