"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useSessionUser } from "@/hooks/use-session-user";
import {
  getMyNewsletterStatus,
  unsubscribeMe,
} from "@/lib/actions/newsletter.actions";

type Step =
  | "hidden"
  | "subscribed"
  | "confirming"
  | "working"
  | "done"
  | "error";

export function NewsletterFooterLink({ className }: { className?: string }) {
  const [step, setStep] = useState<Step>("hidden");
  const { user } = useSessionUser();
  const userId = user?._id;

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    getMyNewsletterStatus()
      .then((status) => {
        if (alive && status === "subscribed") setStep("subscribed");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId]);

  const leave = async () => {
    setStep("working");
    const result = await unsubscribeMe().catch(() => ({
      ok: false as const,
      message: "",
    }));
    setStep(result.ok ? "done" : "error");
  };

  if (!userId || step === "hidden") return null;
  if (step === "done")
    return (
      <span className={cn("text-foreground/50", className)}>
        Unsubscribed from the newsletter
      </span>
    );

  if (step === "confirming" || step === "working" || step === "error") {
    return (
      <span
        className={cn("inline-flex items-center gap-2", className)}
        role="group"
        aria-label="Unsubscribe from the newsletter"
      >
        <span className="text-foreground/60">
          {step === "error"
            ? "That didn't work. Try again?"
            : "Stop getting our newsletter?"}
        </span>
        <button
          type="button"
          disabled={step === "working"}
          onClick={leave}
          className="font-semibold text-foreground underline-offset-4 hover:underline disabled:opacity-60"
        >
          {step === "working" ? "Unsubscribing…" : "Yes"}
        </button>
        {step !== "working" && (
          <button
            type="button"
            onClick={() => setStep("subscribed")}
            className="text-foreground/60 underline-offset-4 hover:text-foreground hover:underline"
          >
            No
          </button>
        )}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setStep("confirming")}
      className={cn(
        "cursor-pointer underline-offset-4 hover:underline",
        className,
      )}
    >
      Unsubscribe from newsletter
    </button>
  );
}
