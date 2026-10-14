"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { cn } from "@/lib/utils";
import { hourLabel } from "@/admin/lib/overview";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.round(entry.contentRect.width)),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function niceMax(value: number): number {
  const raw = Math.max(value, 1) / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const n = raw / power;
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => n <= s) ?? 10;
  return step * power * 4;
}

export type TrendPoint = { date: string; value: number; previous: number };

type TrendProps = {
  data: TrendPoint[];
  label: string;
  previousLabel: string;
  format: (value: number) => string;
  axisFormat: (value: number) => string;
  tickLabel: (date: string) => string;
  dateLabel: (date: string) => string;
  height?: number;
};

const PAD = { top: 14, right: 10, bottom: 28, left: 52 };

export function TrendChart({
  data,
  label,
  previousLabel,
  format,
  axisFormat,
  tickLabel,
  dateLabel,
  height = 240,
}: TrendProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const gradient = `trend-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  const n = data.length;
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const max = niceMax(Math.max(...data.flatMap((d) => [d.value, d.previous])));
  const x = (i: number) =>
    PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const path = (key: "value" | "previous") =>
    data
      .map(
        (d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`,
      )
      .join("");
  const area = n
    ? `${path("value")}L${x(n - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`
    : "";

  const tickCount = width < 420 ? 4 : width < 720 ? 6 : 8;
  const ticks = [
    ...new Set(
      Array.from({ length: Math.min(tickCount, n) }, (_, k) =>
        Math.round((k * (n - 1)) / Math.max(1, Math.min(tickCount, n) - 1)),
      ),
    ),
  ];

  const pick = (event: PointerEvent<SVGSVGElement>) => {
    if (!innerW || !n) return;
    const left =
      event.clientX - event.currentTarget.getBoundingClientRect().left;
    setActive(
      Math.min(
        n - 1,
        Math.max(0, Math.round(((left - PAD.left) / innerW) * (n - 1))),
      ),
    );
  };
  const keys = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    setActive((i) =>
      Math.min(
        n - 1,
        Math.max(0, (i ?? n - 1) + (event.key === "ArrowRight" ? 1 : -1)),
      ),
    );
  };

  const point = active === null ? null : data[active];
  const onRight = active !== null && x(active) < width / 2;

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${label} by day, with the ${previousLabel.toLowerCase()} for comparison. Use the arrow keys to read each day.`}
          tabIndex={0}
          className="overflow-visible rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          onPointerMove={pick}
          onPointerDown={pick}
          onPointerLeave={() => setActive(null)}
          onKeyDown={keys}
          onBlur={() => setActive(null)}
        >
          <defs>
            <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(max * t)}
                y2={y(max * t)}
                stroke="currentColor"
                className="text-border"
                strokeWidth={1}
                strokeDasharray={t === 0 ? undefined : "2 4"}
              />
              <text
                x={PAD.left - 10}
                y={y(max * t)}
                dy="0.32em"
                textAnchor="end"
                fill="currentColor"
                className="text-[11px] text-muted-foreground tabular-nums"
              >
                {axisFormat(max * t)}
              </text>
            </g>
          ))}

          {ticks.map((i) => (
            <text
              key={i}
              x={x(i)}
              y={height - 8}
              textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
              fill="currentColor"
              className="text-[11px] text-muted-foreground"
            >
              {tickLabel(data[i].date)}
            </text>
          ))}

          <path d={area} fill={`url(#${gradient})`} />
          <path
            d={path("previous")}
            fill="none"
            stroke="currentColor"
            className="text-foreground/30"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d={path("value")}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {point && active !== null && (
            <g>
              <line
                x1={x(active)}
                x2={x(active)}
                y1={PAD.top}
                y2={y(0)}
                stroke="currentColor"
                className="text-foreground/25"
                strokeWidth={1}
              />
              <circle
                cx={x(active)}
                cy={y(point.previous)}
                r={4}
                fill="var(--card)"
                stroke="currentColor"
                className="text-foreground/45"
                strokeWidth={2}
              />
              <circle
                cx={x(active)}
                cy={y(point.value)}
                r={5}
                fill="var(--primary)"
                stroke="var(--card)"
                strokeWidth={2}
              />
            </g>
          )}
        </svg>
      )}

      {point && active !== null && (
        <div
          className="pointer-events-none absolute top-1 z-10 w-max min-w-40 rounded-xl border border-border bg-popover/95 px-3 py-2.5 text-popover-foreground shadow-lg backdrop-blur"
          style={{
            left: x(active),
            transform: onRight
              ? "translateX(14px)"
              : "translateX(calc(-100% - 14px))",
          }}
        >
          <p className="text-xs font-semibold">{dateLabel(point.date)}</p>
          <p className="mt-1.5 flex items-center justify-between gap-4 text-sm">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className="h-0.5 w-3 rounded-full bg-primary" /> {label}
            </span>
            <span className="font-semibold tabular-nums">
              {format(point.value)}
            </span>
          </p>
          <p className="mt-0.5 flex items-center justify-between gap-4 text-sm">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className="w-3 border-t-[1.5px] border-dashed border-foreground/45" />{" "}
              Before
            </span>
            <span className="text-muted-foreground tabular-nums">
              {format(point.previous)}
            </span>
          </p>
        </div>
      )}

      <table className="sr-only">
        <caption>{label} by day</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>{label}</th>
            <th>{previousLabel}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{dateLabel(d.date)}</td>
              <td>{format(d.value)}</td>
              <td>{format(d.previous)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type HourlyProps = {
  hourly: { hour: number; today: number; lastWeek: number }[];
  nowHour: number;
  lastWeekLabel: string;
  timeFormat: "12h" | "24h";
};

export function HourlyChart({
  hourly,
  nowHour,
  lastWeekLabel,
  timeFormat,
}: HourlyProps) {
  const used = hourly.filter((h) => h.today || h.lastWeek).map((h) => h.hour);
  let from = used.length
    ? Math.min(...used, nowHour)
    : Math.max(0, nowHour - 6);
  let to = used.length ? Math.max(...used, nowHour) : Math.min(23, nowHour + 5);
  while (to - from < 9 && (from > 0 || to < 23)) {
    if (from > 0) from--;
    if (to - from < 9 && to < 23) to++;
  }
  const hours = hourly.filter((h) => h.hour >= from && h.hour <= to);
  const max = Math.max(1, ...hours.map((h) => Math.max(h.today, h.lastWeek)));
  const every = hours.length > 14 ? 3 : 2;

  return (
    <div>
      <div
        className="flex h-32 items-end gap-0.75 sm:gap-1"
        role="img"
        aria-label={`Orders per hour today, compared with ${lastWeekLabel.toLowerCase()}`}
      >
        {hours.map((h) => {
          const future = h.hour > nowHour;
          const now = h.hour === nowHour;
          return (
            <div
              key={h.hour}
              tabIndex={0}
              className="group relative flex h-full min-w-0 flex-1 flex-col justify-end outline-none"
            >
              {h.today > 0 && (
                <div
                  className={cn(
                    "w-full rounded-t-lg transition-[filter] group-hover:brightness-110",
                    now ? "bg-primary" : "bg-primary/75",
                  )}
                  style={{ height: `${(h.today / max) * 100}%` }}
                />
              )}
              {h.today === 0 && !future && (
                <div className="h-0.5 w-full rounded-full bg-foreground/10" />
              )}
              {h.lastWeek > 0 && (
                <span
                  className="pointer-events-none absolute inset-x-0 h-0.5 rounded-full bg-foreground/45 ring-2 ring-card"
                  style={{ bottom: `calc(${(h.lastWeek / max) * 100}% - 1px)` }}
                />
              )}
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-max -translate-x-1/2 rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md group-hover:block group-focus-visible:block">
                <span className="block font-semibold">
                  {hourLabel(h.hour, timeFormat)}
                </span>
                <span className="block tabular-nums">
                  Today:{" "}
                  {future
                    ? "still to come"
                    : `${h.today} ${h.today === 1 ? "order" : "orders"}`}
                </span>
                <span className="block text-muted-foreground tabular-nums">
                  {lastWeekLabel}: {h.lastWeek}
                </span>
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-0.75 border-t border-border pt-1.5 sm:gap-1">
        {hours.map((h, i) => (
          <span
            key={h.hour}
            className={cn(
              "min-w-0 flex-1 text-center text-[10px] text-muted-foreground tabular-nums",
              h.hour === nowHour && "font-semibold text-foreground",
            )}
          >
            {(i % every === 0 || h.hour === nowHour) &&
              hourLabel(h.hour, timeFormat).replace(":00", "")}
          </span>
        ))}
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] bg-primary/75" /> Today
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded-full bg-foreground/45" />{" "}
          {lastWeekLabel}
        </span>
      </p>
    </div>
  );
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type HeatmapProps = {
  cells: { day: number; hour: number; orders: number }[];
  timeFormat: "12h" | "24h";
};

export function Heatmap({ cells, timeFormat }: HeatmapProps) {
  const [active, setActive] = useState<{ day: number; hour: number } | null>(
    null,
  );
  const hoursUsed = cells.map((c) => c.hour);
  let from = Math.min(...hoursUsed);
  let to = Math.max(...hoursUsed);
  while (to - from < 7 && (from > 0 || to < 23)) {
    if (from > 0) from--;
    if (to - from < 7 && to < 23) to++;
  }
  const hours = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const max = Math.max(1, ...cells.map((c) => c.orders));
  const value = (day: number, hour: number) =>
    cells.find((c) => c.day === day && c.hour === hour)?.orders ?? 0;
  const busiest = cells.reduce<HeatmapProps["cells"][number] | null>(
    (best, c) => (!best || c.orders > best.orders ? c : best),
    null,
  );
  const shown = active ?? busiest;
  const every = hours.length > 12 ? 3 : 2;

  return (
    <div>
      <p className="mb-3 min-h-5 text-sm" aria-live="polite">
        {shown && (
          <>
            <span className="text-muted-foreground">
              {active ? "" : "Busiest: "}
            </span>
            <span className="font-semibold">
              {WEEKDAYS[shown.day - 1]} {hourLabel(shown.hour, timeFormat)}
            </span>
            <span className="text-muted-foreground">
              {" "}
              · {value(shown.day, shown.hour)}{" "}
              {value(shown.day, shown.hour) === 1 ? "order" : "orders"}
            </span>
          </>
        )}
      </p>
      <div
        className="grid gap-0.75"
        style={{
          gridTemplateColumns: `2.25rem repeat(${hours.length}, minmax(0, 1fr))`,
        }}
        onPointerLeave={() => setActive(null)}
      >
        {WEEKDAYS.map((name, d) => (
          <div key={name} className="contents">
            <span className="self-center text-[11px] text-muted-foreground">
              {name}
            </span>
            {hours.map((hour) => {
              const orders = value(d + 1, hour);
              const pct = orders ? Math.round(14 + (orders / max) * 86) : 0;
              return (
                <button
                  key={hour}
                  type="button"
                  aria-label={`${name} ${hourLabel(hour, timeFormat)}: ${orders} orders`}
                  onPointerEnter={() => setActive({ day: d + 1, hour })}
                  onFocus={() => setActive({ day: d + 1, hour })}
                  onBlur={() => setActive(null)}
                  className={cn(
                    "h-6 rounded-lg sm:h-7 outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-primary/50",
                    !orders && "bg-muted",
                    active?.day === d + 1 &&
                      active.hour === hour &&
                      "ring-2 ring-foreground/60",
                  )}
                  style={
                    orders
                      ? {
                          backgroundColor: `color-mix(in oklab, var(--primary) ${pct}%, transparent)`,
                        }
                      : undefined
                  }
                />
              );
            })}
          </div>
        ))}
        <span />
        {hours.map((hour, i) => (
          <span
            key={hour}
            className="pt-1 text-center text-[10px] text-muted-foreground tabular-nums"
          >
            {i % every === 0 && hourLabel(hour, timeFormat).replace(":00", "")}
          </span>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
        Fewer
        {[14, 36, 58, 80, 100].map((pct) => (
          <span
            key={pct}
            className="size-2.5 rounded-[3px]"
            style={{
              backgroundColor: `color-mix(in oklab, var(--primary) ${pct}%, transparent)`,
            }}
          />
        ))}
        More
      </div>
    </div>
  );
}
