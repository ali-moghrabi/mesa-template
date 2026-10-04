import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionProps = {
  id?: string;
  className?: string;
  children: ReactNode;
};

export function Section({ id, className, children }: SectionProps) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-24 px-(--pad) py-20 [--pad:clamp(1.1rem,4vw,3.5rem)] min-[900px]:py-28",
        className,
      )}
    >
      {children}
    </section>
  );
}
