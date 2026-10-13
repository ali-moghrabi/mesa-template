"use client";

import { useSyncExternalStore } from "react";

const SELECTOR = "[data-nav-dark]";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

const hasDarkHero = () => document.querySelector(SELECTOR) !== null;

const onServer = () => false;

export function useDarkHero(): boolean {
  return useSyncExternalStore(subscribe, hasDarkHero, onServer);
}
