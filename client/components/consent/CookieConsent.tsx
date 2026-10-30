"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { BarChart3, Cookie, Lock, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  consentSnapshot,
  onOpenCookieSettings,
  openCookieSettings,
  saveConsent,
  subscribeConsent,
  type Consent,
  type ConsentCategory,
} from "@/lib/consent";

export type CookieTexts = {
  title: string;
  message: string;
  acceptLabel: string;
  declineLabel: string;
  manageLabel: string;
  policyHref?: string;
};

type Props = {
  texts: CookieTexts;
  tools: Partial<Record<ConsentCategory, string[]>>;
};

const UNKNOWN = "unknown" as const;
type ConsentState = Consent | null | typeof UNKNOWN;
const serverSnapshot = (): ConsentState => UNKNOWN;

const CATEGORIES: {
  id: ConsentCategory;
  title: string;
  text: string;
  icon: typeof BarChart3;
}[] = [
  {
    id: "analytics",
    title: "Analytics",
    text: "Count visits and see which pages are useful, so we can improve the site. No personal profile is built.",
    icon: BarChart3,
  },
  {
    id: "marketing",
    title: "Marketing",
    text: "Measure our ads on social media and show them to people who might like them.",
    icon: Megaphone,
  },
];

export function CookieConsent({ texts, tools }: Props) {
  const consent = useSyncExternalStore<ConsentState>(
    subscribeConsent,
    consentSnapshot,
    serverSnapshot,
  );

  const [managing, setManaging] = useState(false);
  const [hidden, setHidden] = useState(false);
  const used = CATEGORIES.filter((c) => (tools[c.id]?.length ?? 0) > 0);
  const noticeOnly = used.length === 0;

  useEffect(() => onOpenCookieSettings(() => setManaging(true)), []);

  const choose = (choice: { analytics: boolean; marketing: boolean }) => {
    saveConsent(choice);
    setManaging(false);
    setHidden(true);
  };
  const acceptAll = () =>
    choose({
      analytics: used.some((c) => c.id === "analytics"),
      marketing: used.some((c) => c.id === "marketing"),
    });
  const declineAll = () => choose({ analytics: false, marketing: false });

  const showBanner = consent === null && !hidden && !managing;

  return (
    <>
      {showBanner && (
        <section
          role="region"
          aria-label="Cookie consent"
          className="fixed inset-x-3 bottom-3 z-60 animate-rise motion-reduce:animate-none sm:inset-x-auto sm:bottom-5 sm:left-5 sm:w-104 print:hidden"
        >
          <div className="rounded-[calc(var(--radius)*2)] border border-foreground/10 bg-background/95 p-5 text-foreground shadow-[0_30px_80px_-30px_rgba(0,0,0,.55)] backdrop-blur-xl">
            <div className="flex items-start gap-3.5">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/12 text-primary">
                <Cookie className="size-5.5" />
              </span>
              <div className="min-w-0">
                <h2 className="font-semibold tracking-tight">{texts.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-pretty text-foreground/70">
                  {texts.message}{" "}
                  {texts.policyHref && (
                    <Link
                      href={texts.policyHref}
                      className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
                    >
                      Learn more
                    </Link>
                  )}
                </p>
              </div>
            </div>

            {noticeOnly ? (
              <button
                type="button"
                onClick={declineAll}
                className={cn(
                  BUTTON,
                  "mt-4 w-full bg-foreground text-background hover:opacity-90",
                )}
              >
                {texts.acceptLabel === "Accept" ? "Got it" : texts.acceptLabel}
              </button>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={declineAll}
                    className={cn(
                      BUTTON,
                      "border border-foreground/15 hover:bg-muted",
                    )}
                  >
                    {texts.declineLabel}
                  </button>
                  <button
                    type="button"
                    onClick={acceptAll}
                    className={cn(
                      BUTTON,
                      "bg-primary text-white hover:brightness-110",
                    )}
                  >
                    {texts.acceptLabel}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setManaging(true)}
                  className="mt-2 w-full py-1.5 text-sm font-medium text-foreground/60 underline-offset-4 hover:text-foreground hover:underline"
                >
                  {texts.manageLabel}
                </button>
              </>
            )}
          </div>
        </section>
      )}

      <Preferences
        open={managing}
        onOpenChange={setManaging}
        used={used}
        tools={tools}
        current={consent === UNKNOWN ? null : consent}
        texts={texts}
        onSave={choose}
      />
    </>
  );
}

const BUTTON =
  "inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold transition";

function Preferences({
  open,
  onOpenChange,
  used,
  tools,
  current,
  texts,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  used: typeof CATEGORIES;
  tools: Props["tools"];
  current: { analytics: boolean; marketing: boolean } | null;
  texts: CookieTexts;
  onSave: (choice: { analytics: boolean; marketing: boolean }) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0! p-0! sm:max-w-lg!">
        {open && (
          <PreferencesBody
            used={used}
            tools={tools}
            current={current}
            texts={texts}
            onSave={onSave}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PreferencesBody({
  used,
  tools,
  current,
  texts,
  onSave,
}: {
  used: typeof CATEGORIES;
  tools: Props["tools"];
  current: { analytics: boolean; marketing: boolean } | null;
  texts: CookieTexts;
  onSave: (choice: { analytics: boolean; marketing: boolean }) => void;
}) {
  const [choice, setChoice] = useState({
    analytics: current?.analytics ?? false,
    marketing: current?.marketing ?? false,
  });
  const toggle = (id: ConsentCategory) =>
    setChoice((c) => ({ ...c, [id]: !c[id] }));

  return (
    <>
      <DialogHeader className="border-b border-border p-5 text-left sm:p-6">
        <DialogTitle className="flex items-center gap-2.5 text-lg">
          <Cookie className="size-5 text-primary" /> Cookie preferences
        </DialogTitle>
        <DialogDescription className="text-pretty">
          Choose which cookies we may use. You can change this at any time from
          “Cookie settings” at the bottom of every page.
          {texts.policyHref && (
            <>
              {" "}
              <Link
                href={texts.policyHref}
                className="font-medium text-foreground underline underline-offset-4"
              >
                Read our privacy policy
              </Link>
              .
            </>
          )}
        </DialogDescription>
      </DialogHeader>

      <ul className="max-h-[55svh] divide-y divide-border overflow-y-auto">
        <li className="flex gap-4 p-5 sm:px-6">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
            <Lock className="size-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">Necessary</p>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                Always on
              </span>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Keep you signed in, remember your cart and this choice, and
              protect the site. The site can&apos;t work without them.
            </p>
          </div>
        </li>
        {used.map((c) => (
          <li key={c.id} className="flex gap-4 p-5 sm:px-6">
            <span
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-xl transition-colors",
                choice[c.id]
                  ? "bg-primary/12 text-primary"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <c.icon className="size-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor={`consent-${c.id}`}
                  className="cursor-pointer font-semibold"
                >
                  {c.title}
                </label>
                <Switch
                  id={`consent-${c.id}`}
                  on={choice[c.id]}
                  onToggle={() => toggle(c.id)}
                />
              </div>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {c.text}
              </p>
              {tools[c.id] && (
                <p className="mt-1.5 text-xs text-muted-foreground/80">
                  Used by: {tools[c.id]!.join(", ")}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-2 gap-2 border-t border-border p-4 sm:flex sm:justify-end sm:p-5">
        <button
          type="button"
          onClick={() => onSave({ analytics: false, marketing: false })}
          className={cn(BUTTON, "border border-border hover:bg-muted")}
        >
          {texts.declineLabel}
        </button>
        <button
          type="button"
          onClick={() =>
            onSave({
              analytics: used.some((c) => c.id === "analytics"),
              marketing: used.some((c) => c.id === "marketing"),
            })
          }
          className={cn(BUTTON, "border border-border hover:bg-muted")}
        >
          {texts.acceptLabel}
        </button>
        <button
          type="button"
          onClick={() => onSave(choice)}
          className={cn(
            BUTTON,
            "col-span-2 bg-primary text-white hover:brightness-110",
          )}
        >
          Save my choices
        </button>
      </div>
    </>
  );
}

function Switch({
  id,
  on,
  onToggle,
}: {
  id: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors outline-none focus-visible:ring-3 focus-visible:ring-primary/40",
        on ? "bg-primary" : "bg-foreground/20",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform",
          on && "translate-x-5",
        )}
      />
    </button>
  );
}

export function CookieSettingsLink({
  className,
  children = "Cookie settings",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={openCookieSettings}
      className={cn(
        "cursor-pointer underline-offset-4 hover:underline",
        className,
      )}
    >
      {children}
    </button>
  );
}
