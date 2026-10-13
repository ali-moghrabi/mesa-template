import type { OrderStatus, OrderType, OrderView } from "@/lib/checkout";

export const ORDERS_PATH = "/admin/orders";
export const BOARD_KEY = ["admin-orders", "board"] as const;
export const FEED_KEY = ["admin-orders", "feed"] as const;
export const orderKey = (id: string) => ["admin-orders", "order", id] as const;

export type AdminOrderSummary = {
  id: string;
  number: string;
  status: OrderStatus;
  type: OrderType;
  placedAt: string;
  customer: { name: string; phone: string };
  preview: string;
  itemCount: number;
  total: number;
  currency: string;
  payment: { method: "card" | "cash"; status: string };
  schedule: { asap: boolean; for?: string; from: string; to: string };
  area?: string;
  hasNotes: boolean;
  version: string;
};

export type AdminOrder = Omit<OrderView, "history" | "payment"> & {
  version: string;
  placedAt: string | null;
  editedAt: string | null;
  staffNote: string;
  cancelReason?: string;
  payment: OrderView["payment"] & {
    amountPaid?: number;
    refunded: number;
    refunds: {
      id: string;
      amount: number;
      at: string;
      by: string;
      reason?: string;
    }[];
    balance: number;
  };
  history: { status: string; at: string; by?: string; note?: string }[];
  next: OrderStatus | null;
};

export type Board = {
  active: AdminOrderSummary[];
  done: AdminOrderSummary[];
  counts: Record<"placed" | "accepted" | "preparing" | "ready", number>;
  serverTime: string;
};

export type OrdersPage = {
  items: AdminOrderSummary[];
  total: number;
  page: number;
  pages: number;
};
export type OrdersFeed = {
  orders: AdminOrderSummary[];
  waiting: number;
  serverTime: string;
};

export type HistoryFilters = {
  status?: string;
  type?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
};

export type EditLine =
  | { index: number; quantity: number; note?: string }
  | {
      itemId: string;
      variantId?: string;
      optionIds: string[];
      quantity: number;
      note?: string;
    };

export type EditPayload = {
  version: string;
  lines: EditLine[];
  deliveryFee?: number;
  discount?: number;
  reason: string;
};

export const STEPS: Record<OrderType, OrderStatus[]> = {
  delivery: [
    "placed",
    "accepted",
    "preparing",
    "out_for_delivery",
    "completed",
  ],
  pickup: ["placed", "accepted", "preparing", "ready", "completed"],
};

export const isFinal = (status: OrderStatus) =>
  status === "completed" || status === "cancelled";

export function nextStatus(
  type: OrderType,
  status: OrderStatus,
): OrderStatus | null {
  const steps = STEPS[type];
  const i = steps.indexOf(status);
  return i >= 0 && i < steps.length - 1 ? steps[i + 1] : null;
}

export function previousStatus(
  type: OrderType,
  status: OrderStatus,
): OrderStatus | null {
  const steps = STEPS[type];
  const i = steps.indexOf(status);
  return i > 0 && !isFinal(status) ? steps[i - 1] : null;
}

type Meta = { label: string; dot: string; pill: string };

export const STATUS_META: Record<OrderStatus, Meta> = {
  awaiting_payment: {
    label: "Awaiting payment",
    dot: "bg-zinc-400",
    pill: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300",
  },
  placed: {
    label: "New",
    dot: "bg-rose-500",
    pill: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
  },
  accepted: {
    label: "Accepted",
    dot: "bg-sky-500",
    pill: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  },
  preparing: {
    label: "Preparing",
    dot: "bg-amber-500",
    pill: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  },
  ready: {
    label: "Ready for pickup",
    dot: "bg-violet-500",
    pill: "bg-violet-500/12 text-violet-700 dark:text-violet-300",
  },
  out_for_delivery: {
    label: "Out for delivery",
    dot: "bg-violet-500",
    pill: "bg-violet-500/12 text-violet-700 dark:text-violet-300",
  },
  completed: {
    label: "Completed",
    dot: "bg-emerald-500",
    pill: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  },
  cancelled: {
    label: "Cancelled",
    dot: "bg-zinc-400",
    pill: "bg-zinc-500/12 text-zinc-600 dark:text-zinc-400",
  },
};

export function actionLabel(type: OrderType, to: OrderStatus): string {
  switch (to) {
    case "accepted":
      return "Accept order";
    case "preparing":
      return "Start preparing";
    case "ready":
      return "Ready for pickup";
    case "out_for_delivery":
      return "Out for delivery";
    case "completed":
      return type === "delivery" ? "Mark delivered" : "Mark picked up";
    case "cancelled":
      return "Cancel order";
    default:
      return STATUS_META[to].label;
  }
}

export const statusText = (type: OrderType, status: OrderStatus) =>
  status === "completed"
    ? type === "delivery"
      ? "Delivered"
      : "Picked up"
    : STATUS_META[status].label;

export const BOARD_COLUMNS: {
  id: string;
  title: string;
  hint: string;
  statuses: OrderStatus[];
}[] = [
  {
    id: "new",
    title: "New",
    hint: "Waiting to be accepted",
    statuses: ["placed"],
  },
  {
    id: "accepted",
    title: "Accepted",
    hint: "Confirmed, not started",
    statuses: ["accepted"],
  },
  {
    id: "preparing",
    title: "Preparing",
    hint: "In the kitchen",
    statuses: ["preparing"],
  },
  {
    id: "ready",
    title: "Ready & on the way",
    hint: "Waiting for pickup or out with the driver",
    statuses: ["ready", "out_for_delivery"],
  },
];

export const EVENT_LABELS: Record<string, string> = {
  edited: "Order changed",
  refunded: "Refund",
  awaiting_payment: "Checkout started",
};
