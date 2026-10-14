export const MESSAGES_PATH = "/admin/messages";

export const MESSAGES_ROOT = ["admin-messages"] as const;
export const listKey = (filters: MessageFilters) =>
  ["admin-messages", "list", filters] as const;
export const messageKey = (id: string) =>
  ["admin-messages", "one", id] as const;

export type MessageStatus = "new" | "read" | "replied";
export type MessageFolder = "inbox" | "archived" | "spam";
export type MessageView = "inbox" | "unread" | "starred" | "archived" | "spam";
export type BulkAction =
  | "read"
  | "unread"
  | "star"
  | "unstar"
  | "archive"
  | "inbox"
  | "spam"
  | "delete";

export type MessageSummary = {
  id: string;
  name: string;
  email: string;
  subject: string;
  preview: string;
  status: MessageStatus;
  folder: MessageFolder;
  starred: boolean;
  replies: number;
  createdAt: string;
};

export type MessageDetail = MessageSummary & {
  phone: string;
  body: string;
  thread: { body: string; at: string; by: string }[];
  staffNote: string;
  readAt: string | null;
  readBy: string | null;
  hasAccount: boolean;
  others: {
    id: string;
    subject: string;
    status: MessageStatus;
    createdAt: string;
  }[];
};

export type MessageCounts = Record<MessageView, number>;
export type MessagesPage = {
  items: MessageSummary[];
  total: number;
  page: number;
  pages: number;
  counts: MessageCounts;
  subjects: string[];
};
export type MessageFilters = {
  view: MessageView;
  q?: string;
  subject?: string;
  page?: number;
};

export const DEFAULT_FILTERS: MessageFilters = { view: "inbox", page: 1 };
export const REPLY_MAX = 5000;

export const VIEWS: { id: MessageView; label: string; empty: string }[] = [
  {
    id: "inbox",
    label: "Inbox",
    empty:
      "No messages yet. When guests write from the contact page, they land here.",
  },
  { id: "unread", label: "Unread", empty: "You're all caught up." },
  {
    id: "starred",
    label: "Starred",
    empty: "Star a message to keep it close at hand.",
  },
  {
    id: "archived",
    label: "Archived",
    empty: "Messages you've dealt with can be archived here.",
  },
  {
    id: "spam",
    label: "Spam",
    empty: "No spam. Messages full of links are filtered here automatically.",
  },
];

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

const TONES = [
  "bg-rose-500/12 text-rose-700 dark:text-rose-300",
  "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  "bg-violet-500/12 text-violet-700 dark:text-violet-300",
  "bg-teal-500/12 text-teal-700 dark:text-teal-300",
];
export const toneFor = (email: string) =>
  TONES[[...email].reduce((n, c) => n + c.charCodeAt(0), 0) % TONES.length];

export function shortWhen(
  iso: string,
  timeZone: string,
  now: number | null,
): string {
  const date = new Date(iso);
  const fmt = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { timeZone, ...o }).format(date);
  if (now === null) return fmt({ day: "numeric", month: "short" });
  const day = (t: number) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(t);
  const age = now - date.getTime();
  if (day(now) === day(date.getTime()))
    return fmt({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  if (age < 6 * 86_400_000) return fmt({ weekday: "short" });
  if (new Date(now).getFullYear() === date.getFullYear())
    return fmt({ day: "numeric", month: "short" });
  return fmt({ day: "numeric", month: "short", year: "numeric" });
}

export const fullWhen = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));

export const QUICK_REPLIES: {
  label: string;
  text: (firstName: string, brand: string) => string;
}[] = [
  {
    label: "Thanks",
    text: (n, b) =>
      `Thank you for your message, ${n}! We're glad you reached out.\n\n\n\nWarm regards,\nThe ${b} team`,
  },
  {
    label: "Private event",
    text: (n, b) =>
      `Thank you for thinking of ${b} for your event, ${n}!\n\nCould you tell us the date, the number of guests and the kind of evening you have in mind? We'll come back with menus and options.\n\nWarm regards,\nThe ${b} team`,
  },
  {
    label: "Feedback",
    text: (n, b) =>
      `Thank you for taking the time to write to us, ${n}. Your feedback means a lot and we've shared it with the team.\n\n\n\nWarm regards,\nThe ${b} team`,
  },
];
