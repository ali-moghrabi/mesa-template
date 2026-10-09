"use client";

import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";
import { refetchSessionCookie } from "@/lib/auth/session-updates";

type SyncOptions = {
  refetchUser?: boolean;
  then?: () => void;
};

export function useSessionRefresh() {
  const router = useRouter();
  const [isSyncing, startTransition] = useTransition();

  const syncSession = useCallback(
    async ({ refetchUser = false, then }: SyncOptions = {}) => {
      if (refetchUser) await refetchSessionCookie();
      startTransition(() => {
        router.refresh();
        then?.();
      });
    },
    [router],
  );

  return { syncSession, isSyncing };
}
