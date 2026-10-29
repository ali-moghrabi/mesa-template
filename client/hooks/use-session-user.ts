"use client";

import { useSyncExternalStore } from "react";
import { SIGNED_IN_HINT_COOKIE } from "@/constants/constants";

export type SessionState =
  | { status: "loading"; user: null }
  | { status: "ready"; user: IUser | null };

const GUEST: SessionState = { status: "ready", user: null };
const LOADING: SessionState = { status: "loading", user: null };
const STALE_MS = 60_000;
const CHANGED_EVENT = "mesa:session-changed";
export const SIGNED_IN_ATTR = "data-signed-in";

const hinted = () =>
  document.cookie
    .split(";")
    .some((part) => part.trim().startsWith(`${SIGNED_IN_HINT_COOKIE}=`));

let state: SessionState | null = null;
let fetchedAt = 0;
let inflight: Promise<void> | null = null;
let wired = false;
const listeners = new Set<() => void>();

function set(next: SessionState) {
  state = next;
  if (next.status === "ready")
    document.documentElement.toggleAttribute(SIGNED_IN_ATTR, !!next.user);
  listeners.forEach((listener) => listener());
}

export function refreshSessionUser(): Promise<void> {
  if (inflight) return inflight;
  inflight = fetch("/api/session", {
    cache: "no-store",
    credentials: "same-origin",
  })
    .then((response) =>
      response.ok
        ? (response.json() as Promise<{ user: IUser | null }>)
        : Promise.reject(new Error(String(response.status))),
    )
    .then(({ user }) => {
      fetchedAt = Date.now();
      set({ status: "ready", user: user ?? null });
    })
    .catch(() => {
      if (state?.status !== "ready") set(GUEST);
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function notifySessionChanged() {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(CHANGED_EVENT));
}

function current(): SessionState {
  if (state) return state;
  if (hinted()) {
    state = LOADING;
    void refreshSessionUser();
  } else state = GUEST;
  return state;
}

function wire() {
  if (wired) return;
  wired = true;
  window.addEventListener(CHANGED_EVENT, () => void refreshSessionUser());
  document.addEventListener("visibilitychange", () => {
    if (
      document.visibilityState === "visible" &&
      hinted() &&
      Date.now() - fetchedAt > STALE_MS
    )
      void refreshSessionUser();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  wire();
  return () => listeners.delete(listener);
}

const serverSnapshot = () => GUEST;

export function useSessionUser(): SessionState {
  return useSyncExternalStore(subscribe, current, serverSnapshot);
}

if (typeof window !== "undefined") current();
