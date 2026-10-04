"use client";

import { useEffect, useState } from "react";
import type { SiteConfig } from "@/config/schema";
import { getOpenStatus, type OpenStatus as Status } from "@/lib/open-status";
import { cn } from "@/lib/utils";

type Props = {
  hours: NonNullable<SiteConfig["business"]["hours"]>;
  specialHours: SiteConfig["business"]["specialHours"];
  timezone: SiteConfig["business"]["timezone"];
  className?: string;
};

export function OpenStatus({
  hours,
  specialHours,
  timezone,
  className,
}: Props) {
  // Computed after mount so server and client markup match (no hydration warning)
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    const tick = () =>
      setStatus(getOpenStatus({ hours, specialHours, timezone }));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [hours, specialHours, timezone]);

  const closed = status !== null && !status.open;

  return (
    <div
      className={cn("flex items-center gap-2 font-medium", className)}
      aria-live="polite"
    >
      <i
        aria-hidden="true"
        className={cn(
          "size-2 rounded-full",
          closed ? "bg-amber-400" : "bg-green-400",
        )}
      />
      <span>{status?.label ?? "\u00A0"}</span>
    </div>
  );
}
