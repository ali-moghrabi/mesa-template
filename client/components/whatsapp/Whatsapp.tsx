"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { ArrowUpRight, Check, Copy, MessageCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  placedOrderMessage,
  whatsappLink,
  whatsappNumber,
  type Template,
} from "@/lib/whatsapp";

type Settings = { countryCode: string; brandName: string };
const SettingsContext = createContext<Settings>({
  countryCode: "",
  brandName: "",
});

export function WhatsAppSettings({
  countryCode,
  brandName,
  children,
}: Settings & { children: ReactNode }) {
  return (
    <SettingsContext.Provider value={{ countryCode, brandName }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useWhatsAppSettings = () => useContext(SettingsContext);

export const WA_BUTTON =
  "bg-[#128C4A] text-white hover:bg-[#0f7a40] dark:bg-[#1DA851] dark:hover:bg-[#22b85a]";

type ComposerProps = {
  phone?: string | null;
  templates: Template[];
  title: string;
  description?: string;
  label?: string;
  className?: string;
};

export function WhatsAppComposer({
  phone,
  templates,
  title,
  description,
  label = "WhatsApp",
  className,
}: ComposerProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-semibold transition-colors hover:bg-muted",
          className,
        )}
      >
        <MessageCircle className="size-3.5 text-[#128C4A] dark:text-[#25D366]" />{" "}
        {label}
      </button>
      {open && (
        <ComposerDialog
          phone={phone}
          templates={templates}
          title={title}
          description={description}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ComposerDialog({
  phone,
  templates,
  title,
  description,
  onClose,
}: Omit<ComposerProps, "label" | "className"> & { onClose: () => void }) {
  const { countryCode } = useWhatsAppSettings();
  const first = templates.find((t) => t.suggested) ?? templates[0];
  const [picked, setPicked] = useState(first?.id ?? "");
  const [text, setText] = useState(first?.text ?? "");

  const askContact = phone === undefined;
  const number = askContact ? null : whatsappNumber(phone, countryCode);
  const href = whatsappLink(number, text.trim());

  const pick = (t: Template) => {
    setPicked(t.id);
    setText(t.text);
  };
  const copy = () => {
    void navigator.clipboard?.writeText(text);
    toast.add({ title: "Message copied", type: "success" });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] gap-0! overflow-hidden p-0! text-left sm:max-w-lg!">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2.5">
            <span
              className={cn(
                "grid size-8 place-items-center rounded-full",
                WA_BUTTON,
              )}
            >
              <MessageCircle className="size-4" />
            </span>
            {title}
          </DialogTitle>
          <DialogDescription>
            {askContact
              ? "WhatsApp opens and asks who to send it to."
              : number
                ? `To +${number}${description ? ` · ${description}` : ""}`
                : "This number looks incomplete: WhatsApp will ask who to send it to."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-5 py-4">
          {templates.length > 1 && (
            <div
              className="mb-3 flex flex-wrap gap-1.5"
              role="radiogroup"
              aria-label="Ready-made messages"
            >
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={picked === t.id}
                  onClick={() => pick(t)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors",
                    picked === t.id
                      ? "border-foreground bg-foreground text-background"
                      : "border-border hover:bg-muted",
                  )}
                >
                  {picked === t.id && <Check className="size-3.5" />}
                  {t.label}
                  {t.suggested && picked !== t.id && (
                    <span
                      className="size-1.5 rounded-full bg-primary"
                      aria-label="(suggested)"
                    />
                  )}
                </button>
              ))}
            </div>
          )}
          <label className="block">
            <span className="sr-only">Message</span>
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setPicked("");
              }}
              rows={8}
              className="w-full resize-y rounded-xl border border-border bg-[#E7F7EC] px-3.5 py-3 text-[15px] leading-relaxed whitespace-pre-wrap text-[#0b2a18] outline-none focus-visible:ring-2 focus-visible:ring-[#1DA851]/50 dark:bg-[#0f2a1b] dark:text-[#dff5e7]"
            />
          </label>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Edit it here or in WhatsApp. *Stars* make text bold.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={copy}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted"
          >
            <Copy className="size-4" /> Copy
          </button>
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            onClick={onClose}
            aria-disabled={!text.trim()}
            className={cn(
              "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors",
              WA_BUTTON,
              !text.trim() && "pointer-events-none opacity-50",
            )}
          >
            Open WhatsApp <ArrowUpRight className="size-4" />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function OrderOnWhatsApp({
  number,
  brandName,
  order,
}: {
  number: string;
  brandName: string;
  order: {
    number: string;
    type: "delivery" | "pickup";
    total: string;
    savings?: string;
  };
}) {
  const digits = whatsappNumber(number);
  if (!digits) return null;
  return (
    <div className="mt-6 flex flex-col gap-4 rounded-[calc(var(--radius)*2)] border border-foreground/10 bg-card px-5 py-5 sm:flex-row sm:items-center sm:px-6">
      <span
        className={cn(
          "grid size-12 shrink-0 place-items-center rounded-full",
          WA_BUTTON,
        )}
      >
        <MessageCircle className="size-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Prefer to chat?</p>
        <p className="text-pretty text-foreground/65">
          Send your order number to us on WhatsApp for any change or question.
          We reply there too.
        </p>
      </div>
      <a
        href={whatsappLink(digits, placedOrderMessage(brandName, order))}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full px-5 font-semibold transition-colors",
          WA_BUTTON,
        )}
      >
        Message us <ArrowUpRight className="size-4" />
      </a>
    </div>
  );
}
