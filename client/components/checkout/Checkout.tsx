"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  useForm,
  useWatch,
  type FieldPath,
  type UseFormRegisterReturn,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Bike,
  CalendarClock,
  Check,
  ChevronDown,
  Clock,
  CreditCard,
  Loader2,
  Lock,
  MapPin,
  NotebookPen,
  Phone,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { canOptimize, mediaSrc } from "@/admin/lib/menu/format";
import { formatMoney, type CurrencyConfig } from "@/lib/menu/money";
import { CART_KEY } from "@/lib/cart";
import {
  placeOrder,
  type PlaceOrderInput,
} from "@/lib/actions/checkout.actions";
import {
  ACTIVE_ORDERS_KEY,
  CHECKOUT_SUCCESS_ROUTE,
  FIELD_FROM_API,
  NOTES_MAX,
  checkoutSchema,
  quote,
  type CheckoutInfo,
  type CheckoutValues,
  type OrderType,
  type PaymentMethod,
  type Quote,
  type SlotDay,
} from "@/lib/checkout";

type Phase = "idle" | "placing" | "redirecting" | "done";

type Props = {
  info: CheckoutInfo;
  currency: CurrencyConfig;
  brandName: string;
};

export function Checkout({ info, currency, brandName }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const money = (amount: number) => formatMoney(amount, currency);

  const types = (["delivery", "pickup"] as const).filter(
    (t) => info[t] !== null,
  );

  // "Pay online": shown once a payment provider (Whish Pay) is connected and the site allows it
  const onlineAvailable = info.payments.online;
  const closed = info.open !== null && !info.open.open;
  const areas = info.delivery?.areas ?? [];

  const form = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    mode: "onTouched",
    defaultValues: {
      type: types[0],
      areaId:
        info.lastAddress?.areaId ?? (areas.length === 1 ? areas[0].id : ""),
      street: info.lastAddress?.street ?? "",
      building: info.lastAddress?.building ?? "",
      floor: info.lastAddress?.floor ?? "",
      apartment: info.lastAddress?.apartment ?? "",
      directions: info.lastAddress?.directions ?? "",
      when: closed ? "later" : "asap",
      slot: "",
      phone: info.customer.phone,
      notes: "",
      cutlery: false,
      paymentMethod: onlineAvailable ? "online" : "cash",
      cashChangeFor: "",
      tipPercent: 0,
    },
  });
  const { control, register, setValue, formState } = form;
  const errors = formState.errors;

  const type = useWatch({ control, name: "type" });
  const areaId = useWatch({ control, name: "areaId" });
  const when = useWatch({ control, name: "when" });
  const slot = useWatch({ control, name: "slot" });
  const paymentMethod = useWatch({ control, name: "paymentMethod" });
  const tipPercent = useWatch({ control, name: "tipPercent" });
  const cutlery = useWatch({ control, name: "cutlery" });
  const notes = useWatch({ control, name: "notes" }) ?? "";
  const cashChangeFor = useWatch({ control, name: "cashChangeFor" }) ?? "";

  const bill = useMemo(
    () => quote(info, type, { areaId, tipPercent }),
    [info, type, areaId, tipPercent],
  );
  const kind = type === "delivery" ? info.delivery : info.pickup;
  const slots = kind?.slots ?? [];

  const blocker = !info.cart.ready
    ? "Some dishes in your cart need your attention."
    : bill.belowMinimum > 0
      ? `Delivery starts from ${money(bill.minimumOrder).main}. Add ${money(bill.belowMinimum).main} more, or pick it up.`
      : closed && (!info.scheduling || slots.length === 0)
        ? `${info.open?.label ?? "Closed"}. Come back then to order.`
        : null;

  const attempt = useRef<{ signature: string; key: string } | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [payError, setPayError] = useState<string | null>(null);
  // Step 2: the filled-in order, shown once more before it's sent
  const [review, setReview] = useState<CheckoutValues | null>(null);

  // Back from the payment page with the browser's back button: the page is restored as it was left
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) setPhase("idle");
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  const finish = (orderId: string) => {
    setPhase("done");
    void queryClient.invalidateQueries({ queryKey: CART_KEY });
    void queryClient.invalidateQueries({ queryKey: ACTIVE_ORDERS_KEY });
    router.replace(`${CHECKOUT_SUCCESS_ROUTE}?order=${orderId}`);
  };

  const showApiError = (result: {
    status: number;
    message: string;
    fieldErrors?: Record<string, string>;
  }) => {
    setPhase("idle");
    if (result.fieldErrors) {
      let first: FieldPath<CheckoutValues> | null = null;
      for (const [path, message] of Object.entries(result.fieldErrors)) {
        const field = FIELD_FROM_API[path];
        if (!field) continue;
        form.setError(field, { message });
        first ??= field;
      }
      if (first) {
        form.setFocus(first);
        return;
      }
    }
    toast.add({
      title:
        result.status === 409
          ? "Please check your order"
          : "Your order wasn't placed",
      description: result.message,
      type: "error",
    });
    if (result.status === 409) router.refresh();
  };

  /** Step 1: the form is valid, so show the order for a last check */
  const submit = (values: CheckoutValues) => {
    if (phase !== "idle" || blocker) return;
    setPayError(null);
    if (values.type === "delivery" && areas.length > 0 && !values.areaId) {
      form.setError("areaId", { message: "Choose your area" });
      form.setFocus("areaId");
      return;
    }
    setReview(values);
  };

  /** Step 2: confirmed, send it */
  const place = async (values: CheckoutValues) => {
    if (phase !== "idle" || blocker) return;
    const online = values.paymentMethod === "online";

    const input: Omit<PlaceOrderInput, "idempotencyKey"> = {
      type: values.type,
      paymentMethod: values.paymentMethod,
      address:
        values.type === "delivery"
          ? {
              areaId: values.areaId || undefined,
              street: values.street ?? "",
              building: values.building,
              floor: values.floor,
              apartment: values.apartment,
              directions: values.directions,
            }
          : undefined,
      phone: values.phone,
      notes: values.notes || undefined,
      cutlery: values.cutlery,
      scheduledFor: values.when === "later" ? values.slot : undefined,
      tipPercent: values.tipPercent || undefined,
      cashChangeFor:
        !online && values.cashChangeFor
          ? Number(values.cashChangeFor)
          : undefined,
      expectedTotal: bill.total,
    };
    // The same details resend the same order (a retry can't place it twice)
    const signature = JSON.stringify(input);
    if (attempt.current?.signature !== signature)
      attempt.current = { signature, key: newKey() };

    setPhase("placing");
    const placed = await placeOrder({
      ...input,
      idempotencyKey: attempt.current.key,
    });
    if (!placed.ok) {
      showApiError(placed);
      return;
    }
    const { order, paymentUrl } = placed.data;
    if (!online || order.status !== "awaiting_payment") {
      finish(order.id);
      return;
    }
    if (order.payment.status === "failed") {
      setPhase("idle");
      setPayError(
        `${order.payment.lastError ?? "The payment didn't go through."} You weren't charged. Try again, or pay cash.`,
      );
      return;
    }
    if (!paymentUrl || !/^https:\/\//i.test(paymentUrl)) {
      setPhase("idle");
      setPayError("Paying online didn't start. Try again, or pay cash.");
      return;
    }
    // The provider's secure page, then the receipt page confirms the payment
    setPhase("redirecting");
    window.location.assign(paymentUrl);
  };

  const busy = phase !== "idle";
  const payLabel =
    paymentMethod === "online"
      ? `Pay ${money(bill.total).main}`
      : `Place order · ${money(bill.total).main}`;

  return (
    <main className="min-h-svh bg-background pb-36 text-foreground [--pad:clamp(1rem,4vw,3rem)] lg:pb-24">
      <div className="mx-auto max-w-6xl px-(--pad) pt-[calc(var(--nav-height,4.5rem)+1.75rem)]">
        {/* Header */}
        <Link
          href="/menu"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/60 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to the menu
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Checkout
            </h1>
            <p className="mt-1 text-foreground/60">
              {info.cart.count} {info.cart.count === 1 ? "dish" : "dishes"} from{" "}
              {brandName}
            </p>
          </div>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            <ShieldCheck className="size-4" /> Secure checkout
          </p>
        </div>

        {info.open && (
          <OpenBanner
            open={info.open}
            canSchedule={info.scheduling && slots.length > 0}
          />
        )}

        {/* Mobile: the bill, folded */}
        <details className="group mt-6 overflow-hidden rounded-2xl border border-foreground/10 bg-muted/50 lg:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2 font-medium">
              <ShoppingBag className="size-4.5 text-primary" /> Order summary
              <ChevronDown className="size-4 text-foreground/50 transition-transform group-open:rotate-180" />
            </span>
            <span className="font-semibold tabular-nums">
              {money(bill.total).main}
            </span>
          </summary>
          <div className="border-t border-foreground/10 px-4 pt-2 pb-4">
            <Summary info={info} bill={bill} type={type} money={money} />
          </div>
        </details>

        <form
          id="checkout-form"
          onSubmit={(event) => void form.handleSubmit(submit)(event)}
          noValidate
          className="mt-6 grid gap-8 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start xl:gap-12"
        >
          <div className="space-y-5">
            {/* 1. How */}
            {types.length > 1 && (
              <Section
                step={1}
                title="How would you like it?"
                icon={<Truck className="size-4.5" />}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {types.map((t) => {
                    const k = t === "delivery" ? info.delivery! : info.pickup!;
                    const fee =
                      t === "delivery"
                        ? quote(info, "delivery", { areaId }).deliveryFee
                        : 0;
                    return (
                      <Tile
                        key={t}
                        selected={type === t}
                        onSelect={() => {
                          setValue("type", t, { shouldDirty: true });
                          setValue("slot", "");
                          form.clearErrors();
                        }}
                        icon={
                          t === "delivery" ? (
                            <Bike className="size-5" />
                          ) : (
                            <Store className="size-5" />
                          )
                        }
                        title={t === "delivery" ? "Delivery" : "Pickup"}
                        text={`${k.etaMinutes[0]}–${k.etaMinutes[1]} min`}
                        aside={
                          t === "delivery"
                            ? fee > 0
                              ? money(fee).main
                              : "Free"
                            : "Free"
                        }
                      />
                    );
                  })}
                </div>
              </Section>
            )}

            {/* 2. Where */}
            {type === "delivery" ? (
              <Section
                step={types.length > 1 ? 2 : 1}
                title="Delivery address"
                icon={<MapPin className="size-4.5" />}
              >
                <div className="grid grid-cols-6 gap-x-3 gap-y-4 sm:gap-x-4">
                  {areas.length > 0 && (
                    <Field
                      label="Area"
                      error={errors.areaId?.message}
                      className="col-span-6"
                    >
                      <div className="relative">
                        <select
                          {...register("areaId", {
                            onChange: () => form.clearErrors("areaId"),
                          })}
                          className={cn(
                            inputClass,
                            "appearance-none pr-10",
                            !areaId && "text-foreground/45",
                          )}
                          aria-invalid={!!errors.areaId}
                        >
                          <option value="">Choose your area</option>
                          {areas.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                              {a.fee !== undefined
                                ? ` · ${a.fee > 0 ? money(a.fee).main : "free delivery"}`
                                : ""}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-foreground/45" />
                      </div>
                    </Field>
                  )}
                  <Field
                    label="Street"
                    error={errors.street?.message}
                    className="col-span-6"
                  >
                    <input
                      {...register("street")}
                      autoComplete="address-line1"
                      placeholder="Street name and number"
                      className={inputClass}
                      aria-invalid={!!errors.street}
                    />
                  </Field>
                  <Field
                    label="Building"
                    optional
                    error={errors.building?.message}
                    className="col-span-2"
                  >
                    <input
                      {...register("building")}
                      autoComplete="address-line2"
                      placeholder="Name or no."
                      className={inputClass}
                    />
                  </Field>
                  <Field
                    label="Floor"
                    optional
                    error={errors.floor?.message}
                    className="col-span-2"
                  >
                    <input
                      {...register("floor")}
                      inputMode="numeric"
                      placeholder="3"
                      className={inputClass}
                    />
                  </Field>
                  <Field
                    label="Apartment"
                    optional
                    error={errors.apartment?.message}
                    className="col-span-2"
                  >
                    <input
                      {...register("apartment")}
                      placeholder="12B"
                      className={inputClass}
                    />
                  </Field>
                  <Field
                    label="Directions for the driver"
                    optional
                    error={errors.directions?.message}
                    className="col-span-6"
                  >
                    <input
                      {...register("directions")}
                      placeholder="Next to the pharmacy, blue gate…"
                      className={inputClass}
                    />
                  </Field>
                </div>
              </Section>
            ) : (
              <Section
                step={types.length > 1 ? 2 : 1}
                title="Pickup"
                icon={<Store className="size-4.5" />}
              >
                <div className="flex items-start gap-3.5 rounded-xl bg-muted/70 p-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/12 text-primary">
                    <MapPin className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold">{brandName}</p>
                    {info.pickup?.address && (
                      <p className="mt-0.5 text-sm text-foreground/65">
                        {info.pickup.address}
                      </p>
                    )}
                    {info.pickup?.instructions && (
                      <p className="mt-2 text-sm text-foreground/65">
                        {info.pickup.instructions}
                      </p>
                    )}
                    {info.pickup?.address && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(info.pickup.address)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline"
                      >
                        Get directions
                      </a>
                    )}
                  </div>
                </div>
              </Section>
            )}

            {/* 3. When */}
            <Section
              step={types.length > 1 ? 3 : 2}
              title={type === "delivery" ? "Delivery time" : "Pickup time"}
              icon={<Clock className="size-4.5" />}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Tile
                  selected={when === "asap"}
                  disabled={closed}
                  onSelect={() => setValue("when", "asap")}
                  icon={<Zap className="size-5" />}
                  title="As soon as possible"
                  text={
                    closed
                      ? (info.open?.label ?? "Closed")
                      : `${kind?.etaMinutes[0]}–${kind?.etaMinutes[1]} min`
                  }
                />
                {info.scheduling && (
                  <Tile
                    selected={when === "later"}
                    disabled={slots.length === 0}
                    onSelect={() => setValue("when", "later")}
                    icon={<CalendarClock className="size-5" />}
                    title="Schedule for later"
                    text={
                      slots.length
                        ? slot
                          ? describeSlot(slot, slots)
                          : "Pick a day and time"
                        : "No times available"
                    }
                  />
                )}
              </div>
              {when === "later" && slots.length > 0 && (
                <SlotPicker
                  slots={slots}
                  value={slot ?? ""}
                  onChange={(v) =>
                    setValue("slot", v, { shouldValidate: true })
                  }
                  error={errors.slot?.message}
                />
              )}
            </Section>

            {/* 4. Contact */}
            <Section
              step={types.length > 1 ? 4 : 3}
              title="Contact"
              icon={<Phone className="size-4.5" />}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-muted/70 px-4 py-3">
                  <p className="text-xs font-medium tracking-wide text-foreground/50 uppercase">
                    Ordering as
                  </p>
                  <p className="mt-0.5 truncate font-semibold">
                    {info.customer.name}
                  </p>
                  <p className="truncate text-sm text-foreground/60">
                    {info.customer.email}
                  </p>
                </div>
                <Field
                  label="Phone number"
                  error={errors.phone?.message}
                  hint={
                    type === "delivery"
                      ? "The driver calls this number"
                      : "We call if anything changes"
                  }
                >
                  <input
                    {...register("phone")}
                    type="tel"
                    autoComplete="tel"
                    placeholder="+961 71 234 567"
                    className={inputClass}
                    aria-invalid={!!errors.phone}
                  />
                </Field>
              </div>
            </Section>

            {/* 5. Payment */}
            <Section
              step={types.length > 1 ? 5 : 4}
              title="Payment"
              icon={<CreditCard className="size-4.5" />}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {onlineAvailable && (
                  <Tile
                    selected={paymentMethod === "online"}
                    onSelect={() => setValue("paymentMethod", "online")}
                    icon={<CreditCard className="size-5" />}
                    title="Pay online"
                    text="On a secure payment page"
                  />
                )}
                {info.payments.cash && (
                  <Tile
                    selected={paymentMethod === "cash"}
                    onSelect={() => {
                      setValue("paymentMethod", "cash");
                      setPayError(null);
                    }}
                    icon={<Banknote className="size-5" />}
                    title={
                      type === "delivery" ? "Cash on delivery" : "Pay at pickup"
                    }
                    text={
                      type === "delivery"
                        ? "Pay the driver"
                        : "Cash at the counter"
                    }
                  />
                )}
              </div>

              {onlineAvailable && paymentMethod === "online" && (
                <div className="mt-4">
                  <p className="flex items-start gap-2.5 rounded-xl bg-foreground/4 px-3.5 py-3 text-sm text-foreground/70">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>
                      You&apos;ll pay on our payment partner&apos;s secure page,
                      then come straight back here.
                    </span>
                  </p>
                  {payError && (
                    <p
                      role="alert"
                      className="mt-3 flex items-start gap-2 rounded-xl bg-destructive/10 px-3.5 py-3 text-sm font-medium text-destructive"
                    >
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" />{" "}
                      {payError}
                    </p>
                  )}
                </div>
              )}

              {paymentMethod === "cash" && type === "delivery" && (
                <CashChange
                  total={bill.total}
                  money={money}
                  value={cashChangeFor}
                  register={register("cashChangeFor")}
                  error={errors.cashChangeFor?.message}
                  onPick={(v) =>
                    setValue("cashChangeFor", v, { shouldValidate: true })
                  }
                />
              )}

              {!onlineAvailable && !info.payments.cash && (
                <p className="text-sm text-destructive">
                  No payment method is available right now. Please call us to
                  order.
                </p>
              )}
            </Section>

            {/* Extras */}
            <Section
              title="Anything else?"
              icon={<NotebookPen className="size-4.5" />}
            >
              <Field
                label="Note for the kitchen"
                optional
                error={errors.notes?.message}
                hint={`${notes.length}/${NOTES_MAX}`}
              >
                <textarea
                  {...register("notes")}
                  rows={2}
                  maxLength={NOTES_MAX}
                  placeholder="Allergies, ring the bell twice…"
                  className={cn(inputClass, "h-auto resize-none py-3")}
                />
              </Field>
              <button
                type="button"
                role="switch"
                aria-checked={cutlery}
                onClick={() => setValue("cutlery", !cutlery)}
                className="mt-4 flex w-full items-center justify-between gap-4 rounded-xl border border-foreground/10 px-4 py-3 text-left transition-colors hover:bg-foreground/3"
              >
                <span className="flex items-center gap-3">
                  <UtensilsCrossed className="size-5 text-foreground/55" />
                  <span>
                    <span className="block font-medium">
                      Cutlery and napkins
                    </span>
                    <span className="block text-sm text-foreground/55">
                      {cutlery
                        ? "We'll add them"
                        : "Skipping them helps reduce waste"}
                    </span>
                  </span>
                </span>
                <span
                  className={cn(
                    "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                    cutlery ? "bg-primary" : "bg-foreground/20",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform",
                      cutlery && "translate-x-5",
                    )}
                  />
                </span>
              </button>

              {info.tips.length > 0 && (
                <div className="mt-5">
                  <p className="text-sm font-medium">
                    Add a tip{" "}
                    <span className="font-normal text-foreground/50">
                      · 100% goes to the team
                    </span>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[0, ...info.tips.filter((t) => t > 0)].map((t) => (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={tipPercent === t}
                        onClick={() => setValue("tipPercent", t)}
                        className={cn(
                          "h-10 min-w-16 rounded-full border px-4 text-sm font-semibold tabular-nums transition-all",
                          tipPercent === t
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-foreground/15 hover:border-foreground/35",
                        )}
                      >
                        {t === 0 ? "No tip" : `${t}%`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          </div>

          {/* Desktop: the bill and the button, sticky */}
          <aside className="hidden lg:sticky lg:top-[calc(var(--nav-height,4.5rem)+1.5rem)] lg:block">
            <div className="rounded-[calc(var(--radius)*2)] border border-foreground/10 bg-card p-6 shadow-[0_24px_60px_-36px_rgb(0_0_0/0.35)]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Your order</h2>
                <Link
                  href="/menu"
                  className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
                >
                  Add more
                </Link>
              </div>
              <Summary info={info} bill={bill} type={type} money={money} />
              {blocker && <Blocker text={blocker} />}
              <PlaceButton
                busy={busy}
                disabled={!!blocker}
                label={payLabel}
                className="mt-5 w-full"
              />
              <TrustLine method={paymentMethod} />
            </div>
          </aside>
        </form>
      </div>

      {/* Mobile: the button, always in reach */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-foreground/10 bg-background/90 px-(--pad) pt-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden">
        {blocker && (
          <p className="mb-2 line-clamp-2 text-xs font-medium text-amber-800 dark:text-amber-300">
            {blocker}
          </p>
        )}
        <PlaceButton
          form="checkout-form"
          busy={busy}
          disabled={!!blocker}
          label={payLabel}
          className="w-full"
        />
      </div>

      {review && (
        <ConfirmOrder
          values={review}
          info={info}
          total={money(bill.total).main}
          money={(n) => money(n).main}
          areaName={areas.find((a) => a.id === review.areaId)?.name}
          slots={slots}
          onCancel={() => setReview(null)}
          onConfirm={() => {
            const values = review;
            setReview(null);
            void place(values);
          }}
        />
      )}
      {busy && <Working phase={phase} />}
    </main>
  );
}

/** 32 random hex characters (crypto.randomUUID only exists on https / localhost) */
function newKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/* ───────────── pieces ───────────── */

const inputClass =
  "h-12 w-full rounded-xl border border-foreground/15 bg-background px-3.5 text-[15px] outline-none transition-[border-color,box-shadow] placeholder:text-foreground/35 hover:border-foreground/30 focus:border-primary focus:ring-3 focus:ring-primary/20 aria-invalid:border-destructive aria-invalid:ring-destructive/15";

function Section({
  step,
  title,
  icon,
  children,
}: {
  step?: number;
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[calc(var(--radius)*2)] border border-foreground/10 bg-card p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-3 text-lg font-semibold tracking-tight">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/12 text-sm font-bold text-primary tabular-nums">
          {step ?? icon}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Tile({
  selected,
  disabled,
  onSelect,
  icon,
  title,
  text,
  aside,
}: {
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  icon: ReactNode;
  title: string;
  text: string;
  aside?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "group relative flex min-h-19 items-center gap-3.5 rounded-xl border-2 px-4 py-3 text-left transition-all duration-200",
        selected
          ? "border-primary bg-primary/6 shadow-[0_10px_30px_-18px_var(--primary)]"
          : "border-foreground/10 hover:border-foreground/25",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-foreground/10",
      )}
    >
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full transition-colors",
          selected
            ? "bg-primary text-primary-foreground"
            : "bg-foreground/6 text-foreground/65",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block truncate text-sm text-foreground/60">
          {text}
        </span>
      </span>
      {aside && (
        <span className="shrink-0 text-sm font-semibold tabular-nums">
          {aside}
        </span>
      )}
      <span
        className={cn(
          "absolute top-2.5 right-2.5 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground transition-all",
          selected ? "scale-100 opacity-100" : "scale-50 opacity-0",
          aside && "hidden",
        )}
      >
        <Check className="size-3" strokeWidth={3} />
      </span>
    </button>
  );
}

function Field({
  label,
  optional,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  optional?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-medium">
        <span>
          {label}{" "}
          {optional && (
            <span className="font-normal text-foreground/45">(optional)</span>
          )}
        </span>
        {hint && !error && (
          <span className="text-xs font-normal text-foreground/45 tabular-nums">
            {hint}
          </span>
        )}
      </span>
      {children}
      {error && (
        <span className="mt-1.5 block text-sm text-destructive">{error}</span>
      )}
    </label>
  );
}

function SlotPicker({
  slots,
  value,
  onChange,
  error,
}: {
  slots: SlotDay[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const day =
    slots.find((d) => d.date === (picked ?? value.slice(0, 10))) ?? slots[0];

  return (
    <div className="mt-4 rounded-xl border border-foreground/10 p-3 sm:p-4">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
        {slots.map((d) => (
          <button
            key={d.date}
            type="button"
            aria-pressed={d.date === day.date}
            onClick={() => setPicked(d.date)}
            className={cn(
              "h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors",
              d.date === day.date
                ? "bg-foreground text-background"
                : "bg-foreground/6 text-foreground/70 hover:bg-foreground/10",
            )}
          >
            {d.label}
          </button>
        ))}
      </div>
      <div
        role="radiogroup"
        aria-label={`Times on ${day.label}`}
        className="mt-3 grid max-h-56 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-5"
      >
        {day.times.map((t) => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={value === t.value}
            onClick={() => onChange(t.value)}
            className={cn(
              "h-10 rounded-lg border text-sm font-semibold tabular-nums transition-all",
              value === t.value
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-foreground/12 hover:border-foreground/35",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}

function describeSlot(value: string, slots: SlotDay[]) {
  const day = slots.find((d) => d.date === value.slice(0, 10));
  return `${day?.label ?? value.slice(0, 10)} at ${value.slice(11)}`;
}

function CashChange({
  total,
  money,
  value,
  register,
  error,
  onPick,
}: {
  total: number;
  money: (n: number) => { main: string };
  value: string;
  register: UseFormRegisterReturn<"cashChangeFor">;
  error?: string;
  onPick: (value: string) => void;
}) {
  const notes = [
    ...new Set(
      [10, 20, 50, 100]
        .map((n) => Math.ceil(total / n) * n)
        .filter((n) => n > total),
    ),
  ].slice(0, 3);
  return (
    <div className="mt-4 rounded-xl bg-muted/70 p-4">
      <p className="text-sm font-medium">
        Need change?{" "}
        <span className="font-normal text-foreground/55">
          Tell the driver what you&apos;ll pay with
        </span>
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onPick("")}
          className={cn(
            "h-9 rounded-full border px-3.5 text-sm font-semibold",
            !value
              ? "border-primary bg-primary text-primary-foreground"
              : "border-foreground/15 bg-background",
          )}
        >
          Exact amount
        </button>
        {notes.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPick(String(n))}
            className={cn(
              "h-9 rounded-full border px-3.5 text-sm font-semibold tabular-nums",
              value === String(n)
                ? "border-primary bg-primary text-primary-foreground"
                : "border-foreground/15 bg-background",
            )}
          >
            {money(n).main}
          </button>
        ))}
        <input
          {...register}
          inputMode="decimal"
          placeholder="Other"
          aria-label="Paying with"
          className={cn(
            inputClass,
            "h-9 w-24 rounded-full bg-background text-sm",
          )}
        />
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}

function Summary({
  info,
  bill,
  type,
  money,
}: {
  info: CheckoutInfo;
  bill: Quote;
  type: OrderType;
  money: (n: number) => { main: string; sub: string | null };
}) {
  const total = money(bill.total);
  const freeOver = info.delivery?.freeOver ?? null;
  return (
    <div>
      <ul className="mt-3 max-h-[min(42vh,380px)] divide-y divide-foreground/10 overflow-y-auto overscroll-contain pr-1">
        {info.cart.lines.map((line) => {
          const src = mediaSrc(line.dish.image);
          const details = [
            line.variant?.name,
            ...line.options.map((o) => o.name),
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <li
              key={line.id}
              className={cn("flex gap-3 py-3", line.issue && "opacity-60")}
            >
              <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-foreground/6">
                {src ? (
                  <Image
                    src={src}
                    alt=""
                    fill
                    // Square thumbnail of a (usually 4:3) photo: object-cover draws it ~1.4× wider than the box,
                    // so ask for a bigger file, and quality 90 (the API already compressed it once)
                    sizes="112px"
                    quality={90}
                    placeholder={line.dish.imageBlur ? "blur" : "empty"}
                    blurDataURL={line.dish.imageBlur}
                    unoptimized={!canOptimize(src)}
                    className="object-cover"
                  />
                ) : (
                  <UtensilsCrossed className="absolute inset-0 m-auto size-5 text-foreground/30" />
                )}
                <span className="absolute top-0 right-0 grid h-5 min-w-5 place-items-center rounded-bl-lg bg-foreground px-1 text-[11px] font-bold text-background tabular-nums">
                  {line.quantity}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate leading-snug font-medium">
                  {line.dish.name}
                </p>
                {details && (
                  <p className="truncate text-xs text-foreground/55">
                    {details}
                  </p>
                )}
                {line.note && (
                  <p className="truncate text-xs text-foreground/55 italic">
                    “{line.note}”
                  </p>
                )}
                {line.issue && (
                  <p className="text-xs font-medium text-destructive">
                    {line.issueText}
                  </p>
                )}
              </div>
              <div className="text-right text-sm tabular-nums">
                <p className="font-semibold">{money(line.total).main}</p>
                {line.unitWas !== undefined && (
                  <p className="text-xs text-foreground/45 line-through">
                    {money(line.unitWas * line.quantity).main}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {type === "delivery" &&
        freeOver !== null &&
        bill.deliveryWaived === 0 &&
        bill.toFreeDelivery !== null && (
          <div className="mt-3 rounded-xl bg-primary/[0.07] px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Truck className="size-4 text-primary" /> Add{" "}
              {money(bill.toFreeDelivery).main} more for free delivery
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary/15">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{
                  width: `${Math.min(100, (bill.subtotal / freeOver) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

      <dl className="mt-4 space-y-2 border-t border-foreground/10 pt-4 text-[15px]">
        <Row label="Subtotal" value={money(bill.subtotal).main} />
        {bill.savings > 0 && (
          <Row
            label={
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="size-4" /> You save
              </span>
            }
            value={`−${money(bill.savings).main}`}
            className="text-emerald-700 dark:text-emerald-400"
          />
        )}
        {type === "delivery" && (
          <Row
            label="Delivery"
            value={
              bill.deliveryFee > 0 ? (
                money(bill.deliveryFee).main
              ) : (
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                  {bill.deliveryWaived > 0 && (
                    <span className="font-normal text-foreground/40 line-through">
                      {money(bill.deliveryWaived).main}
                    </span>
                  )}{" "}
                  Free
                </span>
              )
            }
          />
        )}
        {bill.tip > 0 && <Row label="Tip" value={money(bill.tip).main} />}
        {bill.vat > 0 && !bill.vatIncluded && (
          <Row
            label={`VAT (${Math.round(info.vat.rate * 100)}%)`}
            value={money(bill.vat).main}
          />
        )}
        <div className="flex items-baseline justify-between border-t border-foreground/10 pt-3">
          <dt className="text-base font-semibold">Total</dt>
          <dd className="text-right tabular-nums">
            <span className="text-2xl font-semibold tracking-tight">
              {total.main}
            </span>
            {total.sub && (
              <span className="block text-xs text-foreground/55">
                ≈ {total.sub}
              </span>
            )}
          </dd>
        </div>
        {bill.vat > 0 && bill.vatIncluded && (
          <div className="text-right text-xs text-foreground/50">
            Includes {money(bill.vat).main} VAT
          </div>
        )}
      </dl>
    </div>
  );
}

function Row({
  label,
  value,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <dt className="text-foreground/70">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/** The second step: everything that matters, once more, before the order is sent */
function ConfirmOrder({
  values,
  info,
  total,
  money,
  areaName,
  slots,
  onCancel,
  onConfirm,
}: {
  values: CheckoutValues;
  info: CheckoutInfo;
  total: string;
  money: (n: number) => string;
  areaName?: string;
  slots: SlotDay[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const delivery = values.type === "delivery";
  const kind = delivery ? info.delivery : info.pickup;
  const lines = info.cart.lines.filter((l) => !l.issue);
  const shown = lines.slice(0, 4);
  const more = lines.length - shown.length;

  const when = (() => {
    if (values.when !== "later" || !values.slot)
      return `As soon as possible · about ${kind?.etaMinutes[0]}–${kind?.etaMinutes[1]} min`;
    const day = slots.find((d) => d.date === values.slot!.slice(0, 10));
    const time = day?.times.find((t) => t.value === values.slot)?.label;
    return [day?.label, time].filter(Boolean).join(", ") || values.slot;
  })();

  const where = delivery
    ? [
        values.street,
        values.building && `Building ${values.building}`,
        values.floor && `Floor ${values.floor}`,
        values.apartment && `Apt ${values.apartment}`,
        areaName,
      ]
        .filter(Boolean)
        .join(", ")
    : info.pickup?.address || "At the restaurant";

  const online = values.paymentMethod === "online";
  const change = Number(values.cashChangeFor);
  const payment = online
    ? "Pay online, on the next page"
    : delivery
      ? `Cash on delivery${change > 0 ? ` · change for ${money(change)}` : ""}`
      : "Pay at pickup";

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:max-w-md! sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Confirm your order
          </DialogTitle>
          <DialogDescription>
            Check everything once more before it goes to the kitchen.
          </DialogDescription>
        </DialogHeader>

        <ul className="divide-y divide-foreground/10 rounded-xl border border-foreground/10 px-3.5">
          {shown.map((l) => (
            <li
              key={l.id}
              className="flex items-baseline gap-2.5 py-2.5 text-sm"
            >
              <span className="font-semibold text-primary tabular-nums">
                {l.quantity}×
              </span>
              <span className="min-w-0 flex-1 truncate">
                {l.dish.name}
                {l.variant && (
                  <span className="text-foreground/55">
                    {" "}
                    · {l.variant.name}
                  </span>
                )}
              </span>
              <span className="text-foreground/70 tabular-nums">
                {money(l.total)}
              </span>
            </li>
          ))}
          {more > 0 && (
            <li className="py-2.5 text-sm text-foreground/55">
              + {more} more {more === 1 ? "dish" : "dishes"}
            </li>
          )}
        </ul>

        <dl className="grid gap-3 text-sm">
          <ConfirmRow
            icon={delivery ? <Truck /> : <Store />}
            label={delivery ? "Delivery to" : "Pickup at"}
            value={where}
          />
          <ConfirmRow icon={<Clock />} label="When" value={when} />
          <ConfirmRow
            icon={online ? <CreditCard /> : <Banknote />}
            label="Payment"
            value={payment}
          />
          <ConfirmRow icon={<Phone />} label="Phone" value={values.phone} />
        </dl>

        <div className="flex items-baseline justify-between rounded-xl bg-foreground/5 px-4 py-3">
          <span className="font-medium">Total</span>
          <span className="text-xl font-semibold tabular-nums">{total}</span>
        </div>

        <DialogFooter className="-mx-5 -mb-5 sm:-mx-6 sm:-mb-6">
          <button
            type="button"
            onClick={onCancel}
            className="h-12 rounded-full border border-foreground/15 px-5 text-sm font-semibold transition-colors hover:bg-foreground/5"
          >
            Edit order
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground tabular-nums shadow-[0_14px_30px_-14px_color-mix(in_srgb,var(--primary)_90%,transparent)] transition-all hover:brightness-105"
          >
            <Check className="size-4" />
            {online ? `Confirm and pay ${total}` : `Confirm order · ${total}`}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary [&_svg]:size-4">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-foreground/55">{label}</dt>
        <dd className="font-medium text-pretty wrap-break-word">{value}</dd>
      </div>
    </div>
  );
}

function PlaceButton({
  busy,
  disabled,
  label,
  className,
  form,
}: {
  busy: boolean;
  disabled: boolean;
  label: string;
  className?: string;
  form?: string;
}) {
  return (
    <button
      type="submit"
      form={form}
      disabled={busy || disabled}
      className={cn(
        "group flex h-13 items-center justify-center gap-2 rounded-full bg-primary px-6 text-[15px] font-semibold text-primary-foreground tabular-nums shadow-[0_14px_30px_-14px_color-mix(in_srgb,var(--primary)_90%,transparent)] transition-all hover:-translate-y-px hover:brightness-105 active:translate-y-0 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none",
        className,
      )}
    >
      {busy ? (
        <Loader2 className="size-5 animate-spin" />
      ) : (
        <Lock className="size-4 opacity-80" />
      )}
      {busy ? "Working on it…" : label}
    </button>
  );
}

function TrustLine({ method }: { method: PaymentMethod }) {
  return (
    <p className="mt-3 text-center text-xs leading-relaxed text-foreground/50">
      {method === "online"
        ? "You pay on our payment partner's secure page. We never see your payment details."
        : "You'll pay when your order arrives."}
    </p>
  );
}

function Blocker({ text }: { text: string }) {
  return (
    <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-500/12 px-3.5 py-3 text-sm text-amber-900 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {text}
    </p>
  );
}

function OpenBanner({
  open,
  canSchedule,
}: {
  open: NonNullable<CheckoutInfo["open"]>;
  canSchedule: boolean;
}) {
  if (open.open && !open.closingSoon) return null;
  return (
    <div
      className={cn(
        "mt-5 flex items-start gap-3 rounded-2xl px-4 py-3.5 text-sm",
        open.open
          ? "bg-amber-500/12 text-amber-900 dark:text-amber-200"
          : "bg-foreground/6",
      )}
    >
      <Clock className="mt-0.5 size-4.5 shrink-0" />
      <p>
        <span className="font-semibold">{open.label}.</span>{" "}
        {open.open
          ? "Order soon so the kitchen has time."
          : canSchedule
            ? "You can still order now for later: pick a time below."
            : "Online orders open again then."}
      </p>
    </div>
  );
}

function Working({ phase }: { phase: Phase }) {
  const text =
    phase === "placing"
      ? "Placing your order…"
      : phase === "redirecting"
        ? "Taking you to the secure payment page…"
        : "Almost there…";
  return (
    <div
      className="fixed inset-0 z-60 grid place-items-center bg-background/70 backdrop-blur-sm transition-opacity starting:opacity-0"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-4 rounded-3xl bg-card px-10 py-8 shadow-2xl ring-1 ring-foreground/10">
        <span className="relative grid size-14 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
          <span className="grid size-14 place-items-center rounded-full bg-primary text-primary-foreground">
            <Lock className="size-6" />
          </span>
        </span>
        <p className="font-semibold">{text}</p>
        <p className="-mt-2 text-sm text-foreground/55">
          Please don&apos;t close this page.
        </p>
      </div>
    </div>
  );
}
