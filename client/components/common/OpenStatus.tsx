"use client";

import { useEffect, useState } from "react";
import {
  getOpenStatus,
  type OpenStatus as Status,
  type OpeningHours,
} from "@/lib/opening-hours";
import { cn } from "@/lib/utils";

type Props = {
  hours: OpeningHours;
  className?: string;
};

export function OpenStatus({ hours, className }: Props) {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    const tick = () => setStatus(getOpenStatus(hours));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [hours]);

  const tone =
    status === null
      ? "bg-transparent"
      : status.open && !status.closingSoon
        ? "bg-green-400"
        : "bg-amber-400";

  return (
    <div
      className={cn("flex items-center gap-2 font-medium", className)}
      aria-live="polite"
    >
      <i aria-hidden="true" className={cn("size-2 rounded-full", tone)} />
      <span>
        {status?.label ?? " "}
        {status?.special && (
          <span className="font-normal opacity-80"> · {status.special}</span>
        )}
      </span>
    </div>
  );
}
