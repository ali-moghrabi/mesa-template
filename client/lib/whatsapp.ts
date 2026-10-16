const CALLING_CODES = new Set([
  "1",
  "7",
  "20",
  "27",
  "30",
  "31",
  "32",
  "33",
  "34",
  "36",
  "39",
  "40",
  "41",
  "43",
  "44",
  "45",
  "46",
  "47",
  "48",
  "49",
  "51",
  "52",
  "54",
  "55",
  "56",
  "57",
  "60",
  "61",
  "62",
  "63",
  "64",
  "65",
  "66",
  "81",
  "82",
  "84",
  "86",
  "90",
  "91",
  "92",
  "212",
  "213",
  "216",
  "218",
  "220",
  "221",
  "225",
  "233",
  "234",
  "249",
  "254",
  "255",
  "351",
  "352",
  "353",
  "354",
  "356",
  "357",
  "358",
  "359",
  "370",
  "371",
  "372",
  "380",
  "381",
  "385",
  "386",
  "387",
  "961",
  "962",
  "963",
  "964",
  "965",
  "966",
  "967",
  "968",
  "970",
  "971",
  "972",
  "973",
  "974",
  "975",
  "976",
  "977",
]);

export function callingCode(international: string | undefined | null): string {
  const raw = (international ?? "").trim();
  if (!raw.startsWith("+") && !raw.startsWith("00")) return "";
  const digits = raw.replace(/\D/g, "").replace(/^00/, "");
  for (const length of [3, 2, 1])
    if (CALLING_CODES.has(digits.slice(0, length)))
      return digits.slice(0, length);
  return "";
}

export function whatsappNumber(
  phone: string | undefined | null,
  countryCode = "",
): string | null {
  const raw = (phone ?? "").trim();
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (raw.startsWith("+")) {
  } else if (digits.startsWith("00")) {
    digits = digits.slice(2);
  } else if (
    countryCode &&
    !(digits.startsWith(countryCode) && digits.length >= countryCode.length + 7)
  ) {
    digits = countryCode + digits.replace(/^0+/, "");
  }
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

export function whatsappLink(
  number: string | null | undefined,
  text = "",
): string {
  const query = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${number ?? ""}${query}`;
}

export type Money = (amount: number) => string;

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;
const GAP = Symbol("gap");
const lines = (...parts: (string | false | null | undefined | typeof GAP)[]) =>
  parts
    .filter((p) => p === GAP || !!p)
    .map((p) => (p === GAP ? "" : p))
    .join("\n");

export function dayLabel(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(d);
}

export type Template = {
  id: string;
  label: string;
  text: string;
  suggested?: boolean;
};

export type ListLine = {
  name: string;
  variant?: string;
  options: string[];
  note?: string;
  quantity: number;
  unitPrice: number;
  unitWas?: number;
  sale?: { name: string; percentOff: number };
};

export type ListDetails = {
  name: string;
  type: "delivery" | "pickup" | null;
  address: string;
  when: string;
  notes: string;
};

export function listSavings(items: ListLine[]): number {
  const cents = items.reduce(
    (sum, l) =>
      sum +
      (l.unitWas !== undefined
        ? Math.round((l.unitWas - l.unitPrice) * 100) * l.quantity
        : 0),
    0,
  );
  return Math.max(0, cents) / 100;
}

export function saleNames(
  items: { sale?: { name: string; percentOff: number } }[],
): string {
  const seen = new Map<string, number>();
  for (const l of items) if (l.sale) seen.set(l.sale.name, l.sale.percentOff);
  return [...seen].map(([name, off]) => `${name} −${off}%`).join(", ");
}

export function guestListMessage(
  brand: string,
  items: ListLine[],
  details: ListDetails,
  money: Money,
  subtotal: number,
): string {
  const dishes = items.map((l) => {
    const extras = [l.variant, ...l.options].filter(Boolean).join(", ");
    const was =
      l.unitWas !== undefined && l.unitWas > l.unitPrice
        ? ` ~${money(l.unitWas * l.quantity)}~`
        : "";
    return lines(
      `${l.quantity} × ${l.name}  ${money(l.unitPrice * l.quantity)}${was}`,
      extras && `   ${extras}`,
      was && l.sale && `   🏷️ ${l.sale.name} −${l.sale.percentOff}%`,
      l.note && `   Note: ${l.note}`,
    );
  });
  const saved = listSavings(items);
  const sales = saleNames(
    items.filter((l) => l.unitWas !== undefined && l.unitWas > l.unitPrice),
  );
  return lines(
    `Hi ${brand}! I'd like to order:`,
    GAP,
    ...dishes,
    GAP,
    `*Subtotal: ${money(subtotal)}*`,
    saved > 0
      ? `Sale: ${sales || "menu sale"} (I save ${money(saved)})`
      : "Sale: none, regular menu prices",
    details.type === "delivery" && `Delivery to: ${details.address.trim()}`,
    details.type === "pickup" && "I'll pick it up",
    details.when.trim() && `When: ${details.when.trim()}`,
    details.notes.trim() && `Notes: ${details.notes.trim()}`,
    details.name.trim() && `Name: ${details.name.trim()}`,
  );
}

export function placedOrderMessage(
  brand: string,
  order: {
    number: string;
    type: "delivery" | "pickup";
    total: string;
    savings?: string;
    sales?: string;
  },
): string {
  const sale = order.savings
    ? `, sale prices: ${order.savings} off${order.sales ? ` with ${order.sales}` : ""}`
    : ", no sale";
  return `Hi ${brand}! I just placed order *#${order.number}* on your website (${order.type === "delivery" ? "delivery" : "pickup"}, ${order.total}${sale}).\n\n`;
}

export type OrderFacts = {
  number: string;
  status: string;
  type: "delivery" | "pickup";
  guest: string;
  when: string;
};

export function orderTemplates(brand: string, o: OrderFacts): Template[] {
  const hi = `Hi ${firstName(o.guest)}, it's ${brand}.`;
  const delivery = o.type === "delivery";
  const list: Template[] = [
    {
      id: "confirmed",
      label: "Order confirmed",
      text: `${hi} We got your order *#${o.number}* ✅\n${delivery ? "It should reach you" : "It'll be ready"} around ${o.when}. Thank you!`,
      suggested: o.status === "placed" || o.status === "accepted",
    },
    {
      id: "preparing",
      label: "In the kitchen",
      text: `${hi} Your order *#${o.number}* is being prepared now 👨‍🍳`,
      suggested: o.status === "preparing",
    },
    delivery
      ? {
          id: "on-the-way",
          label: "On the way",
          text: `${hi} Your order *#${o.number}* is on its way 🛵 See you soon!`,
          suggested: o.status === "out_for_delivery",
        }
      : {
          id: "ready",
          label: "Ready for pickup",
          text: `${hi} Your order *#${o.number}* is ready for pickup 🛍️ See you soon!`,
          suggested: o.status === "ready",
        },
    {
      id: "late",
      label: "Running late",
      text: `${hi} Sorry, your order *#${o.number}* is running a little late. We'll ${delivery ? "have it with you" : "have it ready"} as soon as we can.`,
    },
    {
      id: "question",
      label: "Question about the order",
      text: `${hi} A quick question about your order *#${o.number}*: `,
    },
    {
      id: "thanks",
      label: "Thank you",
      text: `${hi} Thank you for ordering with us! We hope you enjoyed it 🙏`,
      suggested: o.status === "completed",
    },
  ];
  return sortSuggested(list);
}

export type DriverFacts = {
  number: string;
  guest: string;
  phone: string;
  chat?: string | null;
  address: string;
  area?: string;
  directions?: string;
  payment: string;
  items: string[];
};

export function driverMessage(d: DriverFacts): string {
  const where = [d.address, d.area].filter(Boolean).join(", ");
  return lines(
    `*Delivery #${d.number}*`,
    GAP,
    d.guest,
    d.phone,
    d.chat && `WhatsApp: https://wa.me/${d.chat}`,
    where,
    d.directions && `"${d.directions}"`,
    `Map: https://maps.google.com/?q=${encodeURIComponent(where).replace(/%20/g, "+")}`,
    GAP,
    `*${d.payment}*`,
    GAP,
    ...d.items,
  );
}

export type BookingFacts = {
  number: string;
  status: string;
  guest: string;
  date: string;
  time: string;
  partySize: number;
};

export function bookingTemplates(brand: string, b: BookingFacts): Template[] {
  const hi = `Hi ${firstName(b.guest)}, it's ${brand}.`;
  const people = `${b.partySize} ${b.partySize === 1 ? "person" : "people"}`;
  const when = `${dayLabel(b.date)} at ${b.time}`;
  const list: Template[] = [
    {
      id: "received",
      label: "Request received",
      text: `${hi} We got your booking request for ${people} on ${when}. We'll confirm it shortly.`,
      suggested: b.status === "pending",
    },
    {
      id: "confirmed",
      label: "Booking confirmed",
      text: `${hi} Your table for ${people} on *${when}* is confirmed ✅ See you then!`,
      suggested: b.status === "confirmed",
    },
    {
      id: "reminder",
      label: "Reminder",
      text: `${hi} A friendly reminder of your table for ${people} on *${when}*. Reply here if anything changes.`,
    },
    {
      id: "late",
      label: "Are you on your way?",
      text: `${hi} Your table for ${people} was booked for ${b.time}. Are you still on your way? We're holding it for you.`,
      suggested: b.status === "no_show",
    },
    {
      id: "full",
      label: "Fully booked",
      text: `${hi} Sorry, we're fully booked on ${when}. Would another time or day work for you?`,
      suggested: b.status === "declined",
    },
    {
      id: "thanks",
      label: "Thank you for coming",
      text: `${hi} Thank you for coming! We hope to see you again soon 🙏`,
      suggested: b.status === "completed",
    },
  ];
  return sortSuggested(list);
}

function sortSuggested(list: Template[]): Template[] {
  const first = list.findIndex((t) => t.suggested);
  return list
    .map((t, i) => ({ ...t, suggested: i === first }))
    .sort((a, b) => Number(b.suggested) - Number(a.suggested));
}
