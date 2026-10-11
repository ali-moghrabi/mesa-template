"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import type { OpeningHours } from "@/lib/opening-hours";
import { OpenStatus } from "@/components/common/OpenStatus";

type Props = {
  hours: OpeningHours | null;
};

export function ServiceStatus({ hours }: Props) {
  const timezone = hours?.timezone ?? "UTC";
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    const format = () =>
      setToday(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: timezone,
          weekday: "long",
          day: "numeric",
          month: "long",
        }).format(new Date()),
      );
    format();
    const id = setInterval(format, 60_000);
    return () => clearInterval(id);
  }, [timezone]);

  return (
    <div className="rounded-xl border border-sidebar-border bg-background/70 p-3 shadow-xs dark:bg-background/40">
      <p className="text-[13px] font-semibold text-sidebar-foreground">
        {today ?? " "}
      </p>
      {hours ? (
        <OpenStatus
          hours={hours}
          className="mt-1 text-xs text-muted-foreground"
        />
      ) : (
        <Link
          href="/admin/settings"
          className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <Clock aria-hidden="true" className="size-3.5" />
          Add your opening hours
        </Link>
      )}
    </div>
  );
}
