import { z } from "zod";
import type { Cart } from "@/lib/cart";

export type OrderType = "delivery" | "pickup";
export type PaymentMethod = "online" | "cash";

export type SlotDay = {
  date: string;
  label: string;
  times: { value: string; label: string }[];
};
export type DeliveryArea = {
  id: string;
  name: string;
  fee?: number;
  minimumOrder?: number;
};
export type OpenStatus = {
  open: boolean;
  label: string;
  closingSoon: boolean;
  special?: string;
};
export type SavedAddress = {
  areaId?: string;
  street: string;
  building: string;
  floor: string;
  apartment: string;
  directions: string;
};

export type CheckoutInfo = {
  cart: Cart;
  currency: string;
  priceUnit: number;
  vat: { rate: number; included: boolean };
  delivery: null | {
    fee: number;
    freeOver: number | null;
    minimumOrder: number;
    etaMinutes: [number, number];
    areas: DeliveryArea[];
    slots: SlotDay[];
  };
  pickup: null | {
    etaMinutes: [number, number];
    address: string;
    instructions: string;
    slots: SlotDay[];
  };
  /** online: a payment provider is connected and the site offers paying online */
  payments: { online: boolean; cash: boolean };
  tips: number[];
  open: OpenStatus | null;
  scheduling: boolean;
  customer: { name: string; email: string; phone: string };
  lastAddress: SavedAddress | null;
  timezone: string;
};

export type OrderStatus =
  | "awaiting_payment"
  | "placed"
  | "accepted"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "completed"
  | "cancelled";

export type OrderView = {
  id: string;
  number: string;
  status: OrderStatus;
  type: OrderType;
  currency: string;
  createdAt: string;
  payment: {
    method: PaymentMethod;
    status: "unpaid" | "pending" | "paid" | "failed" | "refunded";
    cashChangeFor?: number;
    lastError?: string;
    paidAt?: string;
  };
  lines: {
    name: string;
    image?: string;
    variantName?: string;
    options: string[];
    quantity: number;
    unitPrice: number;
    unitWas?: number;
    total: number;
    note: string;
  }[];
  amounts: {
    subtotal: number;
    savings: number;
    deliveryFee: number;
    deliveryWaived: number;
    tip: number;
    vat: number;
    vatIncluded: boolean;
    vatRate: number;
    discount?: number;
    total: number;
  };
  customer: { name: string; phone: string; email: string };
  address?: SavedAddress & { area?: string };
  pickupAddress?: string;
  schedule: {
    asap: boolean;
    for?: string;
    from: string;
    to: string;
    timezone: string;
  };
  notes: string;
  cutlery: boolean;
  history: { status: string; at: string }[];
};

/** paymentUrl: the payment provider's page, for an online order still to be paid */
export type PlacedOrder = { order: OrderView; paymentUrl?: string };

export const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{5,22}$/;
export const NOTES_MAX = 300;

export const checkoutSchema = z
  .object({
    type: z.enum(["delivery", "pickup"]),
    areaId: z.string().max(60).optional(),
    street: z.string().trim().max(120).optional(),
    building: z.string().trim().max(60).optional(),
    floor: z.string().trim().max(20).optional(),
    apartment: z.string().trim().max(20).optional(),
    directions: z.string().trim().max(240).optional(),
    when: z.enum(["asap", "later"]),
    slot: z.string().optional(),
    phone: z
      .string()
      .trim()
      .regex(PHONE_PATTERN, "Enter a phone number we can call"),
    notes: z
      .string()
      .trim()
      .max(NOTES_MAX, `Up to ${NOTES_MAX} characters`)
      .optional(),
    cutlery: z.boolean(),
    paymentMethod: z.enum(["online", "cash"]),
    cashChangeFor: z
      .string()
      .trim()
      .regex(/^$|^\d{1,7}(\.\d{1,2})?$/, "Enter an amount, e.g. 50")
      .optional(),
    tipPercent: z.number().int().min(0).max(50),
  })
  .superRefine((v, ctx) => {
    if (v.type === "delivery" && (v.street ?? "").length < 3)
      ctx.addIssue({
        code: "custom",
        path: ["street"],
        message: "Enter your street",
      });
    if (v.when === "later" && !v.slot)
      ctx.addIssue({
        code: "custom",
        path: ["slot"],
        message: "Choose a time",
      });
  });

export type CheckoutValues = z.infer<typeof checkoutSchema>;

export const FIELD_FROM_API: Record<string, keyof CheckoutValues> = {
  "address.areaId": "areaId",
  "address.street": "street",
  "address.building": "building",
  "address.floor": "floor",
  "address.apartment": "apartment",
  "address.directions": "directions",
  scheduledFor: "slot",
  phone: "phone",
  notes: "notes",
  paymentMethod: "paymentMethod",
  cashChangeFor: "cashChangeFor",
  tipPercent: "tipPercent",
  type: "type",
};

export type Quote = {
  subtotal: number;
  savings: number;
  deliveryFee: number;
  deliveryWaived: number;
  tip: number;
  vat: number;
  vatIncluded: boolean;
  total: number;
  minimumOrder: number;
  belowMinimum: number;
  toFreeDelivery: number | null;
};

export function quote(
  info: Pick<CheckoutInfo, "cart" | "delivery" | "vat" | "priceUnit">,
  type: OrderType,
  options: { areaId?: string; tipPercent?: number } = {},
): Quote {
  const unit = info.priceUnit || 100;
  const m = (n: number) => Math.round(n * unit);
  const subtotal = info.cart.lines
    .filter((l) => !l.issue)
    .reduce((sum, l) => sum + m(l.total), 0);
  const delivery = type === "delivery" ? info.delivery : null;
  const area = delivery?.areas.find((a) => a.id === options.areaId);

  const baseFee = delivery ? m(area?.fee ?? delivery.fee) : 0;
  const freeOver = delivery?.freeOver != null ? m(delivery.freeOver) : null;
  const free = freeOver !== null && subtotal >= freeOver;
  const deliveryFee = free ? 0 : baseFee;
  const minimumOrder = delivery
    ? m(area?.minimumOrder ?? delivery.minimumOrder)
    : 0;
  const tip = Math.round(
    (subtotal * Math.max(0, options.tipPercent ?? 0)) / 100,
  );
  const taxable = subtotal + deliveryFee;
  const rate = info.vat.rate;
  const vat =
    rate > 0
      ? info.vat.included
        ? Math.round(taxable - taxable / (1 + rate))
        : Math.round(taxable * rate)
      : 0;
  const n = (minor: number) => minor / unit;

  return {
    subtotal: n(subtotal),
    savings: info.cart.savings,
    deliveryFee: n(deliveryFee),
    deliveryWaived: n(free ? baseFee : 0),
    tip: n(tip),
    vat: n(vat),
    vatIncluded: info.vat.included,
    total: n(taxable + tip + (info.vat.included ? 0 : vat)),
    minimumOrder: n(minimumOrder),
    belowMinimum: n(Math.max(0, minimumOrder - subtotal)),
    toFreeDelivery:
      freeOver !== null && !free && baseFee > 0 ? n(freeOver - subtotal) : null,
  };
}

export const STATUS_STEPS: Record<
  OrderType,
  { status: OrderStatus; label: string }[]
> = {
  delivery: [
    { status: "placed", label: "Order placed" },
    { status: "accepted", label: "Confirmed" },
    { status: "preparing", label: "Being prepared" },
    { status: "out_for_delivery", label: "On the way" },
    { status: "completed", label: "Delivered" },
  ],
  pickup: [
    { status: "placed", label: "Order placed" },
    { status: "accepted", label: "Confirmed" },
    { status: "preparing", label: "Being prepared" },
    { status: "ready", label: "Ready for pickup" },
    { status: "completed", label: "Picked up" },
  ],
};

export const CHECKOUT_SUCCESS_ROUTE = "/payment/complete";

export const ORDERS_ROUTE = "/account/orders";
export const ACTIVE_ORDERS_KEY = ["my-orders", "active-count"] as const;

export type MyOrders = {
  active: OrderView[];
  past: OrderView[];
  nextBefore: string | null;
};

export type ReorderResult = {
  cart: Cart;
  added: number;
  skipped: { name: string; reason: string }[];
};

export const isActiveOrder = (status: OrderStatus) =>
  !["awaiting_payment", "completed", "cancelled"].includes(status);

export function statusLabel(order: Pick<OrderView, "status" | "type">): string {
  switch (order.status) {
    case "completed":
      return order.type === "delivery" ? "Delivered" : "Picked up";
    case "cancelled":
      return "Cancelled";
    case "awaiting_payment":
      return "Awaiting payment";
    default:
      return (
        STATUS_STEPS[order.type].find((s) => s.status === order.status)
          ?.label ?? "In progress"
      );
  }
}
