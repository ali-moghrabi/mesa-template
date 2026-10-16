"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import {
  CalendarDays,
  Check,
  ChefHat,
  Copy,
  Download,
  Globe,
  Hash,
  Link2,
  Printer,
  QrCode,
  Square,
  StickyNote,
  TabletSmartphone,
} from "lucide-react";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export type QrTarget = {
  id: "menu" | "home" | "reservations";
  label: string;
  path: string;
};

type Props = {
  siteUrl: string;
  brandName: string;
  logo?: string;
  primary: string;
  targets: QrTarget[];
  ordering: boolean;
};

type Style = "card" | "sticker" | "poster";

const STYLES: {
  id: Style;
  label: string;
  hint: string;
  perPage: number;
  icon: ReactNode;
}[] = [
  {
    id: "card",
    label: "Table card",
    hint: "A6, 4 per page",
    perPage: 4,
    icon: <TabletSmartphone className="size-5" />,
  },
  {
    id: "sticker",
    label: "Sticker",
    hint: "Small, 9 per page",
    perPage: 9,
    icon: <StickyNote className="size-5" />,
  },
  {
    id: "poster",
    label: "Poster",
    hint: "A4, for the window",
    perPage: 1,
    icon: <Square className="size-5" />,
  },
];

const TARGET_ICONS: Record<QrTarget["id"] | "custom", ReactNode> = {
  menu: <ChefHat className="size-4.5" />,
  home: <Globe className="size-4.5" />,
  reservations: <CalendarDays className="size-4.5" />,
  custom: <Link2 className="size-4.5" />,
};

const MAX_CODES = 200;

type Pattern = { size: number; path: string };

function pattern(text: string): Pattern | null {
  try {
    const qr = QRCode.create(text, { errorCorrectionLevel: "Q" });
    const { size, data } = qr.modules;
    const inFinder = (r: number, c: number) =>
      (r < 7 && c < 7) || (r < 7 && c >= size - 7) || (r >= size - 7 && c < 7);
    let path = "";
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++)
        if (data[r * size + c] && !inFinder(r, c)) path += `M${c} ${r}h1v1h-1z`;
    return { size, path };
  } catch {
    return null;
  }
}

function Finder({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g>
      <path
        fillRule="evenodd"
        fill={color}
        d={`M${x + 2} ${y}h3a2 2 0 0 1 2 2v3a2 2 0 0 1 -2 2h-3a2 2 0 0 1 -2 -2v-3a2 2 0 0 1 2 -2z M${x + 2.2} ${y + 1}h2.6a1.2 1.2 0 0 1 1.2 1.2v2.6a1.2 1.2 0 0 1 -1.2 1.2h-2.6a1.2 1.2 0 0 1 -1.2 -1.2v-2.6a1.2 1.2 0 0 1 1.2 -1.2z`}
      />
      <rect x={x + 2} y={y + 2} width={3} height={3} rx={0.9} fill={color} />
    </g>
  );
}

function QrSvg({
  p,
  color,
  margin = 2,
  className,
}: {
  p: Pattern;
  color: string;
  margin?: number;
  className?: string;
}) {
  const s = p.size;
  return (
    <svg
      viewBox={`${-margin} ${-margin} ${s + margin * 2} ${s + margin * 2}`}
      className={className}
      shapeRendering="crispEdges"
      role="img"
      aria-label="QR code"
    >
      <rect
        x={-margin}
        y={-margin}
        width={s + margin * 2}
        height={s + margin * 2}
        fill="#fff"
      />
      <path d={p.path} fill={color} />
      <g shapeRendering="geometricPrecision">
        <Finder x={0} y={0} color={color} />
        <Finder x={s - 7} y={0} color={color} />
        <Finder x={0} y={s - 7} color={color} />
      </g>
    </svg>
  );
}

function svgFile(p: Pattern, color: string): string {
  const m = 4;
  const s = p.size + m * 2;
  const finder = (x: number, y: number) =>
    `<path fill-rule="evenodd" fill="${color}" d="M${x + 2} ${y}h3a2 2 0 0 1 2 2v3a2 2 0 0 1 -2 2h-3a2 2 0 0 1 -2 -2v-3a2 2 0 0 1 2 -2z M${x + 2.2} ${y + 1}h2.6a1.2 1.2 0 0 1 1.2 1.2v2.6a1.2 1.2 0 0 1 -1.2 1.2h-2.6a1.2 1.2 0 0 1 -1.2 -1.2v-2.6a1.2 1.2 0 0 1 1.2 -1.2z"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="0.9" fill="${color}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-m} ${-m} ${s} ${s}" width="1024" height="1024"><rect x="${-m}" y="${-m}" width="${s}" height="${s}" fill="#fff"/><path shape-rendering="crispEdges" d="${p.path}" fill="${color}"/>${finder(0, 0)}${finder(p.size - 7, 0)}${finder(0, p.size - 7)}</svg>`;
}

function printable(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#111111";
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3 ? "#111111" : `#${m[1]}`;
}

export function QrCodes({
  siteUrl,
  brandName,
  logo,
  primary,
  targets,
  ordering,
}: Props) {
  const [target, setTarget] = useState<QrTarget["id"] | "custom">(
    targets[0]?.id ?? "custom",
  );
  const [custom, setCustom] = useState("");
  const [track, setTrack] = useState(true);
  const [style, setStyle] = useState<Style>("card");
  const [numbered, setNumbered] = useState(true);
  const [from, setFrom] = useState("1");
  const [to, setTo] = useState("12");
  const [copies, setCopies] = useState("4");
  const [brandColour, setBrandColour] = useState(true);
  const [logoOk, setLogoOk] = useState(!!logo);
  const [texts, setTexts] = useState<
    Record<string, { title: string; line: string }>
  >({});

  const defaults = useMemo(
    () => ({
      menu: {
        title: "Scan for our menu",
        line: ordering
          ? "See every dish, and order online"
          : "Dishes, prices and allergens",
      },
      home: {
        title: "Scan to visit us online",
        line: "Menu, opening hours and bookings",
      },
      reservations: {
        title: "Scan to book a table",
        line: "Pick a time, we confirm it",
      },
      custom: { title: "Scan me", line: "" },
    }),
    [ordering],
  );
  const text = texts[target] ?? defaults[target];
  const setText = (patch: Partial<{ title: string; line: string }>) =>
    setTexts((t) => ({ ...t, [target]: { ...text, ...patch } }));

  const url = useMemo(() => {
    let raw =
      target === "custom"
        ? custom.trim()
        : `${siteUrl}${targets.find((t) => t.id === target)?.path ?? "/"}`;
    if (!raw) return "";
    if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
    try {
      const u = new URL(raw);
      if (track && target !== "custom") {
        u.searchParams.set("utm_source", "qr");
        u.searchParams.set(
          "utm_medium",
          style === "poster" ? "poster" : "table",
        );
      }
      return u.toString();
    } catch {
      return "";
    }
  }, [target, custom, siteUrl, targets, track, style]);

  const p = useMemo(() => (url ? pattern(url) : null), [url]);
  const color = brandColour ? printable(primary) : "#111111";
  const brandWarning = brandColour && color === "#111111";

  const labels = useMemo(() => {
    if (numbered) {
      const a = Math.max(0, Math.floor(Number(from) || 0));
      const b = Math.max(a, Math.floor(Number(to) || a));
      return Array.from({ length: Math.min(MAX_CODES, b - a + 1) }, (_, i) =>
        String(a + i),
      );
    }
    return Array.from(
      { length: Math.min(MAX_CODES, Math.max(1, Number(copies) || 1)) },
      () => null,
    );
  }, [numbered, from, to, copies]);

  const perPage = STYLES.find((s) => s.id === style)!.perPage;
  const pages = useMemo(() => {
    const out: (string | null)[][] = [];
    for (let i = 0; i < labels.length; i += perPage)
      out.push(labels.slice(i, i + perPage));
    return out;
  }, [labels, perPage]);

  const look: Look = {
    style,
    color,
    primary: printable(primary),
    brandName,
    logo: logoOk ? logo : undefined,
    title: text.title,
    line: text.line,
    url,
    pattern: p,
  };

  const print = () => {
    if (!p) return;
    window.print();
  };
  const download = () => {
    if (!p) return;
    const blob = new Blob([svgFile(p, color)], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `qr-${target}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  useEffect(() => {
    if (!logo) return;
    const img = new Image();
    img.onload = () => setLogoOk(true);
    img.onerror = () => setLogoOk(false);
    img.src = logo;
  }, [logo]);

  return (
    <div className="mx-auto w-full max-w-6xl py-12 px-4">
      <header className="mb-6">
        <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
          Restaurant
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">QR codes</h1>
        <p className="mt-1 text-muted-foreground">
          Print codes for the tables, the counter or the window. Guests scan
          them with their phone camera.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-5">
          <Panel title="What it opens" step={1}>
            <div className="grid grid-cols-2 gap-2">
              {[
                ...targets.map((t) => ({ id: t.id, label: t.label })),
                { id: "custom" as const, label: "Other link" },
              ].map((t) => (
                <Choice
                  key={t.id}
                  active={target === t.id}
                  onClick={() => setTarget(t.id)}
                  icon={TARGET_ICONS[t.id]}
                >
                  {t.label}
                </Choice>
              ))}
            </div>
            {target === "custom" && (
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="https://… (Instagram, a Google review link, the Wi-Fi page…)"
                inputMode="url"
                className={cn(INPUT, "mt-3")}
              />
            )}
            {url ? (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-xs break-all text-muted-foreground">
                <Link2 className="mt-px size-3.5 shrink-0" /> {url}
              </p>
            ) : (
              target === "custom" &&
              custom && (
                <p className="mt-2 text-sm text-destructive">
                  That doesn&apos;t look like a link.
                </p>
              )
            )}
            {target !== "custom" && (
              <Toggle
                checked={track}
                onChange={setTrack}
                label="Count scans in analytics"
                hint="Adds a tag to the link, so Google Analytics shows visits from QR codes."
              />
            )}
          </Panel>

          <Panel title="Style" step={2}>
            <div className="grid grid-cols-3 gap-2">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setStyle(s.id);
                    setNumbered(s.id !== "poster");
                    if (s.id === "poster") setCopies("1");
                  }}
                  aria-pressed={style === s.id}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-colors",
                    style === s.id
                      ? "border-primary bg-primary/[0.07] text-foreground ring-1 ring-primary"
                      : "border-border hover:bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      style === s.id ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {s.icon}
                  </span>
                  <span className="text-sm font-semibold">{s.label}</span>
                  <span className="text-[11px] leading-tight text-muted-foreground">
                    {s.hint}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-4 space-y-3">
              <Labelled label="Headline">
                <input
                  value={text.title}
                  onChange={(e) => setText({ title: e.target.value })}
                  maxLength={40}
                  className={INPUT}
                />
              </Labelled>
              <Labelled label="Line under it" hint="Optional">
                <input
                  value={text.line}
                  onChange={(e) => setText({ line: e.target.value })}
                  maxLength={60}
                  className={INPUT}
                />
              </Labelled>
              <Toggle
                checked={brandColour}
                onChange={setBrandColour}
                label="Code in the brand colour"
                hint={
                  brandWarning
                    ? "Your brand colour is too light to scan well: black is used."
                    : "Dark colours only, so every phone can read it."
                }
              />
            </div>
          </Panel>

          <Panel title="How many" step={3}>
            <Toggle
              checked={numbered}
              onChange={setNumbered}
              label="Number them by table"
              hint="Prints “Table 7” on each one, so staff know where a guest sits."
            />
            <div className="mt-3 grid grid-cols-2 gap-3">
              {numbered ? (
                <>
                  <Labelled label="From table">
                    <input
                      value={from}
                      onChange={(e) =>
                        setFrom(e.target.value.replace(/\D/g, ""))
                      }
                      inputMode="numeric"
                      className={INPUT}
                    />
                  </Labelled>
                  <Labelled label="To table">
                    <input
                      value={to}
                      onChange={(e) => setTo(e.target.value.replace(/\D/g, ""))}
                      inputMode="numeric"
                      className={INPUT}
                    />
                  </Labelled>
                </>
              ) : (
                <Labelled label="Copies">
                  <input
                    value={copies}
                    onChange={(e) =>
                      setCopies(e.target.value.replace(/\D/g, ""))
                    }
                    inputMode="numeric"
                    className={INPUT}
                  />
                </Labelled>
              )}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              <strong className="font-semibold text-foreground">
                {labels.length}
              </strong>{" "}
              {labels.length === 1 ? "code" : "codes"} on{" "}
              <strong className="font-semibold text-foreground">
                {pages.length}
              </strong>{" "}
              A4 {pages.length === 1 ? "page" : "pages"}
              {labels.length >= MAX_CODES && ` (${MAX_CODES} at most)`}
            </p>
          </Panel>

          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
            <button
              type="button"
              onClick={print}
              disabled={!p}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground shadow-[0_12px_28px_-14px_var(--primary)] transition hover:brightness-110 disabled:opacity-50"
            >
              <Printer className="size-4.5" /> Print{" "}
              {pages.length > 1 ? `${pages.length} pages` : ""}
            </button>
            <button
              type="button"
              onClick={download}
              disabled={!p}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border px-4 font-semibold transition-colors hover:bg-muted disabled:opacity-50"
            >
              <Download className="size-4.5" /> SVG
            </button>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(url);
                toast.add({ title: "Link copied", type: "success" });
              }}
              disabled={!url}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border px-4 font-semibold transition-colors hover:bg-muted disabled:opacity-50"
            >
              <Copy className="size-4.5" /> Link
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            In the print window, choose A4, scale 100% (“Actual size”) and turn
            on “Background graphics”. Test one code with your phone before
            printing them all.
          </p>
        </div>

        <div className="lg:sticky lg:top-6">
          <div className="rounded-2xl border border-border bg-muted/60 p-3 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3 text-sm">
              <span className="inline-flex items-center gap-2 font-semibold">
                <QrCode className="size-4 text-primary" /> Preview
              </span>
              <span className="text-muted-foreground">
                {pages.length > 1
                  ? `${pages.length} pages, scroll to see them all`
                  : "A4"}
              </span>
            </div>
            {p ? (
              <div className="max-h-[78vh] space-y-4 overflow-y-auto pr-1">
                {pages.map((labels, i) => (
                  <Scaled key={i}>
                    <Page look={look} labels={labels} />
                  </Scaled>
                ))}
              </div>
            ) : (
              <div className="grid aspect-210/297 place-items-center rounded-lg bg-background text-center text-muted-foreground">
                <span>
                  <Hash className="mx-auto mb-2 size-6" />
                  Add a link to see the codes
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {p && <PrintSheets look={look} pages={pages} />}
    </div>
  );
}

/* ───────────── printed pages ───────────── */

type Look = {
  style: Style;
  color: string;
  primary: string;
  brandName: string;
  logo?: string;
  title: string;
  line: string;
  url: string;
  pattern: Pattern | null;
};

const MM = 96 / 25.4; // CSS px per mm
const PAGE_W = 210 * MM;
const PAGE_H = 297 * MM;

// document.body exists on the client only: render the portal there, nothing on the server
const noSubscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;

/** Only the sheets are printed: they live at the end of <body>, everything else is hidden */
function PrintSheets({
  look,
  pages,
}: {
  look: Look;
  pages: (string | null)[][];
}) {
  const mounted = useSyncExternalStore(noSubscribe, onClient, onServer);
  if (!mounted) return null;
  return createPortal(
    <div id="qr-print">
      <style>{`
        #qr-print { display: none; }
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body { background: #fff !important; }
          body > *:not(#qr-print) { display: none !important; }
          #qr-print { display: block; }
          #qr-print .qr-page { break-after: page; page-break-after: always; }
          #qr-print .qr-page:last-child { break-after: auto; page-break-after: auto; }
          #qr-print * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      {pages.map((labels, i) => (
        <Page key={i} look={look} labels={labels} />
      ))}
    </div>,
    document.body,
  );
}

function Page({ look, labels }: { look: Look; labels: (string | null)[] }) {
  const grid =
    look.style === "card"
      ? "grid-cols-2 grid-rows-2"
      : look.style === "sticker"
        ? "grid-cols-3 grid-rows-3"
        : "grid-cols-1 grid-rows-1";
  return (
    <div
      className={cn(
        "qr-page grid overflow-hidden bg-white text-[#1a1714]",
        grid,
      )}
      style={{ width: "210mm", height: "297mm" }}
    >
      {labels.map((label, i) => (
        <div
          key={i}
          className="relative overflow-hidden"
          style={{
            outline:
              look.style === "poster" ? undefined : "0.2mm dashed #d6d0c8",
            outlineOffset: "-0.1mm",
          }}
        >
          {look.style === "card" ? (
            <Card look={look} label={label} />
          ) : look.style === "sticker" ? (
            <Sticker look={look} label={label} />
          ) : (
            <Poster look={look} label={label} />
          )}
        </div>
      ))}
    </div>
  );
}

const heading = { fontFamily: "var(--font-heading, inherit)" } as const;

function Brand({ look, height }: { look: Look; height: string }) {
  return look.logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={look.logo}
      alt={look.brandName}
      style={{ height, maxWidth: "80%", objectFit: "contain" }}
    />
  ) : (
    <span
      className="font-semibold tracking-tight"
      style={{ ...heading, fontSize: `calc(${height} * 0.8)` }}
    >
      {look.brandName}
    </span>
  );
}

function Code({ look, size }: { look: Look; size: string }) {
  if (!look.pattern) return null;
  return (
    <div
      className="rounded-[4mm] bg-white p-[2.2mm]"
      style={{
        width: size,
        height: size,
        boxShadow: `0 0 0 0.6mm ${look.primary}`,
      }}
    >
      <QrSvg
        p={look.pattern}
        color={look.color}
        margin={1.5}
        className="size-full"
      />
    </div>
  );
}

function TableTag({
  look,
  label,
  size,
}: {
  look: Look;
  label: string;
  size: "sm" | "md" | "lg";
}) {
  const font = size === "lg" ? "16pt" : size === "md" ? "12pt" : "9pt";
  return (
    <span
      className="inline-flex items-baseline gap-[1.5mm] rounded-full font-semibold text-white"
      style={{
        background: look.primary,
        fontSize: font,
        padding: size === "sm" ? "0.8mm 3mm" : "1.4mm 5mm",
      }}
    >
      <span
        style={{
          fontSize: "0.7em",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          opacity: 0.85,
        }}
      >
        Table
      </span>
      <span className="tabular-nums" style={{ fontSize: "1.25em" }}>
        {label}
      </span>
    </span>
  );
}

const shortUrl = (url: string) =>
  url
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/[?#].*$/, "")
    .replace(/\/$/, "");

function Card({ look, label }: { look: Look; label: string | null }) {
  return (
    <div className="flex h-full flex-col items-center px-[9mm] pt-[9mm] pb-[7mm] text-center">
      <Brand look={look} height="9mm" />
      <p
        className="mt-[5mm] leading-[1.1] font-semibold tracking-tight text-balance"
        style={{ ...heading, fontSize: "19pt" }}
      >
        {look.title}
      </p>
      {look.line && (
        <p
          className="mt-[1.5mm] leading-snug text-balance text-[#5e554d]"
          style={{ fontSize: "9.5pt" }}
        >
          {look.line}
        </p>
      )}
      <div className="mt-[5mm]">
        <Code look={look} size="58mm" />
      </div>
      <div className="mt-auto flex flex-col items-center gap-[1.5mm]">
        {label && <TableTag look={look} label={label} size="md" />}
        <span className="text-[#8a8077]" style={{ fontSize: "7.5pt" }}>
          {shortUrl(look.url)}
        </span>
      </div>
    </div>
  );
}

function Sticker({ look, label }: { look: Look; label: string | null }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-[5mm] text-center">
      <p
        className="leading-tight font-semibold tracking-tight"
        style={{ ...heading, fontSize: "11pt" }}
      >
        {look.title}
      </p>
      <div className="mt-[3mm]">
        <Code look={look} size="46mm" />
      </div>
      <div className="mt-[3mm] flex items-center gap-[2mm]">
        {label ? (
          <TableTag look={look} label={label} size="sm" />
        ) : (
          <span style={{ fontSize: "8pt", fontWeight: 600 }}>
            {look.brandName}
          </span>
        )}
      </div>
    </div>
  );
}

function Poster({ look, label }: { look: Look; label: string | null }) {
  return (
    <div className="flex h-full flex-col items-center px-[18mm] pt-[20mm] pb-[16mm] text-center">
      <Brand look={look} height="16mm" />
      <p
        className="mt-[12mm] leading-[1.02] font-semibold tracking-tight text-balance"
        style={{ ...heading, fontSize: "44pt" }}
      >
        {look.title}
      </p>
      {look.line && (
        <p
          className="mt-[4mm] text-balance text-[#5e554d]"
          style={{ fontSize: "17pt" }}
        >
          {look.line}
        </p>
      )}
      <div className="mt-[12mm]">
        <Code look={look} size="118mm" />
      </div>
      <div className="mt-auto flex flex-col items-center gap-[3mm]">
        {label && <TableTag look={look} label={label} size="lg" />}
        <span
          className="font-medium text-[#8a8077]"
          style={{ fontSize: "13pt" }}
        >
          {shortUrl(look.url)}
        </span>
      </div>
    </div>
  );
}

/** An A4 page, shrunk to the preview's width */
function Scaled({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    // Fires once right away, then on every resize
    const observer = new ResizeObserver(() =>
      setScale(el.clientWidth / PAGE_W),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={box}
      className="relative w-full overflow-hidden rounded-md bg-white shadow-[0_10px_30px_-12px_rgb(0_0_0/0.35)] ring-1 ring-black/5"
      style={{ height: PAGE_H * scale }}
    >
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{ transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}

/* ───────────── small pieces ───────────── */

const INPUT =
  "h-11 w-full rounded-xl border border-border bg-background px-3.5 text-[15px] outline-none transition placeholder:font-normal placeholder:text-foreground/30 focus-visible:border-foreground/40 focus-visible:ring-2 focus-visible:ring-primary/20";

function Panel({
  title,
  step,
  children,
}: {
  title: string;
  step: number;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <h2 className="mb-3 flex items-center gap-2.5 font-semibold">
        <span className="grid size-6 place-items-center rounded-full bg-primary/12 text-xs font-bold text-primary tabular-nums">
          {step}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Choice({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-12 items-center gap-2.5 rounded-xl border px-3 text-left text-sm font-semibold transition-colors",
        active
          ? "border-primary bg-primary/[0.07] ring-1 ring-primary"
          : "border-border hover:bg-muted",
      )}
    >
      <span className={active ? "text-primary" : "text-muted-foreground"}>
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {active && <Check className="size-4 text-primary" />}
    </button>
  );
}

function Labelled({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-sm font-medium">
        {label}
        {hint && (
          <span className="text-xs font-normal text-muted-foreground">
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="mt-3 flex w-full items-start gap-3 text-left"
    >
      <span
        className={cn(
          "relative mt-0.5 inline-flex h-6 w-10 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-foreground/15",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-4.5" : "translate-x-0.5",
          )}
        />
      </span>
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && (
          <span className="block text-xs text-muted-foreground">{hint}</span>
        )}
      </span>
    </button>
  );
}
