"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import "./announcement.css";

type Props = {
  text: string;
  link?: { label: string; href: string };
  dismissible: boolean;
  collapsed: boolean;
};

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

const storageKey = (text: string) => {
  let h = 0;
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) | 0;
  return `mesa-announcement-closed:${(h >>> 0).toString(36)}`;
};

export function AnnouncementBar({ text, link, dismissible, collapsed }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let closed = false;
    try {
      closed = localStorage.getItem(storageKey(text)) === "1";
    } catch {
      /* storage blocked: just show it */
    }
    if (closed) return;
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [text]);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(storageKey(text), "1");
    } catch {
      /* fine: it stays closed until the next page load */
    }
  };

  const open = visible && !collapsed;

  return (
    <div
      role="region"
      aria-label="Announcement"
      aria-hidden={!open || undefined}
      inert={!open || undefined}
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(.2,.7,.2,1)] motion-reduce:transition-none",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
    >
      <div className="overflow-hidden">
        <div className="relative isolate overflow-hidden bg-[color-mix(in_oklab,var(--primary)_78%,black)] text-white">
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-[radial-gradient(60%_140%_at_50%_0%,color-mix(in_oklab,var(--primary)_100%,white_8%)_0%,transparent_70%)] opacity-90"
          />
          <div
            aria-hidden="true"
            className="announce-sheen absolute inset-y-0 left-0 -z-10 w-1/4 translate-x-[-120%] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.16),transparent)]"
          />

          <div className="mx-auto flex min-h-10 max-w-6xl items-center justify-center gap-3 py-2 pr-12 pl-4 sm:min-h-11 sm:gap-4 sm:px-14">
            {link ? (
              <>
                <Link
                  href={link.href}
                  className={cn(
                    "group flex min-w-0 items-center gap-2.5 text-[13px] leading-snug sm:hidden",
                    FOCUS,
                  )}
                >
                  <Dot />
                  <span className="line-clamp-2 font-medium text-pretty">
                    {text}{" "}
                    <span className="font-semibold underline decoration-white/50 underline-offset-[3px]">
                      {link.label}
                    </span>
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 shrink-0 transition-transform group-active:translate-x-0.5"
                  />
                </Link>

                <p className="hidden min-w-0 items-center gap-2.5 text-sm font-medium sm:flex">
                  <Dot />
                  <span className="truncate">{text}</span>
                </p>
                <Link
                  href={link.href}
                  className={cn(
                    "group hidden h-7 shrink-0 items-center gap-1 rounded-full bg-white/15 pr-2 pl-3.5 text-[13px] font-semibold ring-1 ring-white/30 backdrop-blur-sm transition-colors ring-inset hover:bg-white hover:text-[color-mix(in_oklab,var(--primary)_78%,black)] sm:inline-flex",
                    FOCUS,
                  )}
                >
                  {link.label}
                  <ChevronRight
                    aria-hidden="true"
                    className="size-3.5 transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              </>
            ) : (
              <p className="flex min-w-0 items-center gap-2.5 text-[13px] font-medium sm:text-sm">
                <Dot />
                <span className="line-clamp-2 text-pretty sm:line-clamp-1">
                  {text}
                </span>
              </p>
            )}
          </div>

          {dismissible && (
            <button
              type="button"
              aria-label="Close the announcement"
              onClick={dismiss}
              className={cn(
                "absolute top-1/2 right-2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-white/75 transition-colors hover:bg-white/15 hover:text-white sm:right-3",
                FOCUS,
              )}
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Dot() {
  return (
    <span
      aria-hidden="true"
      className="announce-dot relative size-1.5 shrink-0 rounded-full bg-white text-white"
    />
  );
}
