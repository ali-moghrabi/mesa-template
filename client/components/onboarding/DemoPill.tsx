"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { ArrowRight, X } from "lucide-react";

const KEY = "mesa:demo-pill-closed";
const EVENT = "mesa:demo-pill";

const subscribe = (onChange: () => void) => {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
};
const isClosed = () => {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

const closedOnServer = () => true;

function close() {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export function DemoPill() {
  const pathname = usePathname();
  const closed = useSyncExternalStore(subscribe, isClosed, closedOnServer);

  if (closed || pathname.startsWith("/start") || pathname.startsWith("/admin"))
    return null;

  return (
    <aside
      aria-label="About this demo"
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-40 flex items-center gap-1 rounded-full bg-[#1C1512]/95 p-1.5 pr-1.5 text-white shadow-[0_18px_40px_-14px_rgba(0,0,0,0.55)] ring-1 ring-white/10 backdrop-blur animate-[mesa-pill-in_0.5s_cubic-bezier(0.2,0.8,0.2,1)_1.2s_both] motion-reduce:animate-none"
    >
      <Link
        href="/start"
        className="group flex items-center gap-2.5 rounded-full py-1 pr-2 pl-1 outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-full bg-[#B4532A] text-sm font-extrabold"
        >
          M
        </span>
        <span className="leading-tight">
          <span className="hidden text-[11px] font-medium text-white/60 sm:block">
            This is a MESA demo
          </span>
          <span className="flex items-center gap-1 text-sm font-semibold">
            <span className="sm:hidden">Get MESA</span>
            <span className="hidden sm:inline">
              Get this for your restaurant
            </span>
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </span>
      </Link>
      <button
        type="button"
        onClick={close}
        aria-label="Hide"
        className="grid size-8 place-items-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
      >
        <X className="size-4" />
      </button>
      <style>{`@keyframes mesa-pill-in{from{opacity:0;transform:translateY(16px) scale(.96)}to{opacity:1;transform:none}}`}</style>
    </aside>
  );
}
