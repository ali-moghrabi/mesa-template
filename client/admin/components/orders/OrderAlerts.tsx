"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, BellOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { fetchOrdersFeed } from "@/admin/lib/orders.actions";
import {
  BOARD_KEY,
  FEED_KEY,
  ORDERS_PATH,
  type OrdersFeed,
} from "@/admin/lib/orders";

const POLL_MS = 10_000;
const REMIND_MS = 2 * 60_000;
const MAX_REMINDERS = 3;
const CHIME_GAP_MS = 8_000;
const VOLUME = 0.09;
const STORAGE_KEY = "mesa-order-alerts";

const listeners = new Set<() => void>();
const readPref = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};
function writePref(value: "on" | "off") {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* private mode: works for this visit */
  }
  listeners.forEach((l) => l());
}
const subscribePref = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useAlertsPref(): "on" | "off" | "unset" | null {
  return useSyncExternalStore(
    subscribePref,
    () => (readPref() as "on" | "off" | null) ?? "unset",
    () => null,
  );
}

let audio: AudioContext | null = null;
const announced = new Set<string>();
let lastChime = 0;

export function chime(force = false) {
  const now = Date.now();
  if (!force && now - lastChime < CHIME_GAP_MS) return;
  lastChime = now;
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
    const t0 = audio.currentTime + 0.02;

    const master = audio.createGain();
    master.gain.value = VOLUME;
    const soften = audio.createBiquadFilter();
    soften.type = "lowpass";
    soften.frequency.value = 2400;
    master.connect(soften).connect(audio.destination);

    [
      { freq: 659.25, at: 0 },
      { freq: 554.37, at: 0.22 },
    ].forEach(({ freq, at }) => {
      const start = t0 + at;
      [
        { mult: 1, level: 1 },
        { mult: 2, level: 0.18 },
      ].forEach(({ mult, level }) => {
        const osc = audio!.createOscillator();
        const gain = audio!.createGain();
        osc.type = "sine";
        osc.frequency.value = freq * mult;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(level, start + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.4);
        osc.connect(gain).connect(master);
        osc.start(start);
        osc.stop(start + 1.5);
      });
    });
  } catch {
    /* no audio on this device */
  }
}

export async function enableAlerts() {
  writePref("on");
  chime(true);
  if ("Notification" in window && Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch {
      /* older Safari */
    }
  }
}

export const disableAlerts = () => writePref("off");

export function useWaitingOrders(): number | null {
  const feed = useQuery<OrdersFeed>({ queryKey: FEED_KEY, queryFn: skipToken });
  return feed.data ? feed.data.waiting : null;
}

export function OrderAlerts() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const pref = useAlertsPref();
  const after = useRef<string | undefined>(undefined);
  const title = useRef<string | null>(null);

  const feed = useQuery({
    queryKey: FEED_KEY,
    queryFn: async () => {
      const result = await fetchOrdersFeed(after.current);
      if (!result.ok) throw new Error(result.message);
      const first = after.current === undefined;
      after.current = result.data.serverTime;
      return { ...result.data, orders: first ? [] : result.data.orders };
    },
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: true,
    retry: false,
  });

  const fresh = feed.data?.orders;
  const waiting = feed.data?.waiting ?? 0;

  useEffect(() => {
    const news = (fresh ?? []).filter((o) => !announced.has(o.id));
    if (news.length === 0) return;
    news.forEach((o) => announced.add(o.id));
    void queryClient.invalidateQueries({ queryKey: BOARD_KEY });
    if (pref === "on") chime();
    for (const order of news.slice(0, 3)) {
      const what = `${order.type === "delivery" ? "Delivery" : "Pickup"} · ${order.itemCount} ${order.itemCount === 1 ? "item" : "items"} · ${order.customer.name}`;
      toast.add({
        title: `New order #${order.number}`,
        description: what,
        type: "info",
      });
      if (
        pref === "on" &&
        "Notification" in window &&
        Notification.permission === "granted" &&
        document.visibilityState !== "visible"
      ) {
        const n = new Notification(`New order #${order.number}`, {
          body: what,
          tag: `order-${order.id}`,
        });
        n.onclick = () => {
          window.focus();
          router.push(`${ORDERS_PATH}?order=${order.id}`);
          n.close();
        };
      }
    }
  }, [fresh, pref, queryClient, router]);

  useEffect(() => {
    if (pref !== "on" || waiting === 0) return;
    let count = 0;
    const id = setInterval(() => {
      count += 1;
      if (count > MAX_REMINDERS) return clearInterval(id);
      chime();
    }, REMIND_MS);
    return () => clearInterval(id);
  }, [pref, waiting]);

  useEffect(() => {
    title.current ??= document.title.replace(/^\(\d+\) New orders? · /, "");
    document.title =
      waiting > 0
        ? `(${waiting}) New order${waiting === 1 ? "" : "s"} · ${title.current}`
        : title.current;
  }, [waiting]);
  useEffect(
    () => () => {
      if (title.current) document.title = title.current;
    },
    [],
  );

  if (pref !== "unset" && pref !== "off") return null;
  if (pref === "off" && waiting === 0) return null;

  return (
    <button
      type="button"
      onClick={() => void enableAlerts()}
      className={cn(
        "fixed right-4 bottom-4 z-50 inline-flex items-center gap-2.5 rounded-full bg-foreground py-2.5 pr-4 pl-3 text-sm font-semibold text-background shadow-2xl transition hover:-translate-y-0.5",
        waiting > 0 && "animate-bounce",
      )}
    >
      <span className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground">
        {pref === "off" ? (
          <BellOff className="size-4" />
        ) : (
          <BellRing className="size-4" />
        )}
      </span>
      {waiting > 0
        ? `${waiting} new order${waiting === 1 ? "" : "s"}. Turn on sound`
        : "Turn on new-order alerts"}
    </button>
  );
}
