"use client";

import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";
import { refetchSessionCookie } from "@/lib/auth/session-updates";
import { notifySessionChanged } from "@/hooks/use-session-user";

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
      notifySessionChanged();
      startTransition(() => {
        router.refresh();
        then?.();
      });
    },
    [router],
  );

  return { syncSession, isSyncing };
}
