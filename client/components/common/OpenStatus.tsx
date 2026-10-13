"use client";

import { useSyncExternalStore } from "react";
import { getOpenStatus, type OpeningHours } from "@/lib/opening-hours";
import { cn } from "@/lib/utils";

type Props = {
  hours: OpeningHours;
  className?: string;
};

const subscribe = (onChange: () => void) => {
  const id = setInterval(onChange, 30_000);
  return () => clearInterval(id);
};
const currentMinute = () => Math.floor(Date.now() / 60_000);
const noClock = () => null;

export function OpenStatus({ hours, className }: Props) {
  const minute = useSyncExternalStore(subscribe, currentMinute, noClock);
  const status =
    minute === null ? null : getOpenStatus(hours, new Date(minute * 60_000));

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
        {status?.label ?? " "}
        {status?.special && (
          <span className="font-normal opacity-80"> · {status.special}</span>
        )}
      </span>
    </div>
  );
}
