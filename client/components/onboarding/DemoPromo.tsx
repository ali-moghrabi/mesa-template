import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DemoPill } from "./DemoPill";

export const onboardingEnabled = () =>
  process.env.ONBOARDING_ENABLED === "true";

export function DemoPromo() {
  if (!onboardingEnabled()) return null;
  return <DemoPill />;
}

export function MesaCredit({ centered = false }: { centered?: boolean }) {
  if (!onboardingEnabled()) return null;
  return (
    <p
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-foreground/10 py-4 text-[13px] text-foreground/55 ${centered ? "justify-center text-center" : ""}`}
    >
      <span>
        Built with{" "}
        <strong className="font-semibold text-foreground/80">MESA</strong>
      </span>
      <span aria-hidden="true">·</span>
      <Link
        href="/start"
        className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline"
      >
        Get your restaurant website <ArrowRight className="size-3.5" />
      </Link>
    </p>
  );
}
