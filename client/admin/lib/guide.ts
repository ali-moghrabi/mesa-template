import type { Permission } from "@/lib/auth/user-roles";
import type { AdminIcon } from "@/admin/lib/nav";

export type GuideSection = {
  heading: string;
  text?: string;
  points?: string[];
  steps?: string[];
  needs?: Permission;
};

export type GuideTopic = {
  id: AdminIcon | "start" | "account" | "shortcuts";
  title: string;
  summary: string;
  keywords?: string;
  sections: GuideSection[];
  tips?: string[];
  limited?: { missing: Permission; note: string };
};

export const GUIDE_START: GuideTopic = {
  id: "start",
  title: "Start here",
  summary: "How the admin panel works, in two minutes.",
  keywords: "welcome intro help roles permissions",
  sections: [
    {
      heading: "What this is",
      text: "Everything you change here shows on your website right away: the menu, prices, photos, opening hours. Bookings and orders from the website arrive here too, so the team can handle them during service.",
    },
    {
      heading: "Find your way",
      points: [
        "The sidebar lists the pages you can use. You only see what your role allows, and only the features your restaurant has turned on.",
        "A number next to a page (like Orders) means something is waiting for you.",
        "The panel at the top of the sidebar tells you if the restaurant is open right now, and until when.",
        "“View website” opens the site as guests see it.",
      ],
    },
    {
      heading: "Who can do what",
      points: [
        "Staff: the daily service. Sees bookings, moves orders along, marks dishes sold out.",
        "Manager: runs the restaurant. Everything staff does, plus editing the menu, sales, photos, messages and the newsletter, and handling bookings.",
        "Admin: the owner. Everything, plus the team and the restaurant's settings.",
      ],
    },
    {
      heading: "Safe to explore",
      text: "Forms warn you before you leave with unsaved changes, and anything that can't be undone (like deleting a dish) asks first. Hidden items stay saved: you can switch them back on any time.",
    },
  ],
};

export const GUIDE_SHORTCUTS: GuideTopic = {
  id: "shortcuts",
  title: "Shortcuts",
  summary: "Keys that save time.",
  keywords: "keyboard keys hotkeys",
  sections: [
    {
      heading: "Anywhere",
      points: [
        "? — open this guide",
        "Ctrl + B (⌘ + B on Mac) — fold the sidebar to icons, or open it again",
        "Esc — close a panel or this guide",
      ],
    },
    {
      heading: "In forms",
      points: [
        "Ctrl + Enter (⌘ + Enter) — save",
        "Click a price box — the old number is selected, just type the new one",
        "⌘ V / Ctrl + V — paste a copied photo into the dish form",
      ],
    },
  ],
};

export const GUIDE_ACCOUNT: GuideTopic = {
  id: "account",
  title: "Your account",
  summary: "Your name, password and email, from the website's account page.",
  keywords: "password profile email verify sign out devices",
  sections: [
    {
      heading: "Where",
      text: "Open the website, then your name at the top, then “Account”. The same account signs you in to the website and to this panel.",
    },
    {
      heading: "What you can do there",
      points: [
        "Change your name and phone number",
        "Change your password, or set one if you joined with Google",
        "Verify your email address",
        "Sign out on every device, for example after using a shared computer",
      ],
    },
  ],
};

export const GUIDE_TOPICS: Partial<Record<AdminIcon, GuideTopic>> = {
  overview: {
    id: "overview",
    title: "Overview",
    summary: "Today at a glance, and how the restaurant is doing.",
    keywords: "dashboard home analytics stats revenue charts today",
    sections: [
      {
        heading: "What you'll find",
        points: [
          "Today: the bookings and orders coming up, and anything waiting for an answer.",
          "Sales and covers over the last 7, 30 or 90 days, compared with the period before.",
          "Your busiest hours and days, to plan staff and prep.",
          "Your most ordered dishes.",
          "Recent activity: new bookings, orders and messages as they come in.",
        ],
      },
      {
        heading: "How to use it",
        text: "Start your shift here. Anything that needs someone shows first, with a link straight to it.",
      },
    ],
    tips: [
      "Switch between 7, 30 and 90 days at the top to compare a quiet week with the month.",
    ],
  },

  reservations: {
    id: "reservations",
    title: "Reservations",
    summary:
      "Table bookings: answer requests, run the day, add phone bookings.",
    keywords: "booking table request confirm decline seat no-show phone covers",
    sections: [
      {
        heading: "What you'll find",
        points: [
          "The day's bookings in time order, with the number of guests at each time.",
          "Requests: bookings from the website waiting for your answer.",
          "Filters for each status: Requests, Confirmed, Seated, Done and Cancelled.",
        ],
      },
      {
        heading: "Answer a request",
        needs: "reservations:manage",
        steps: [
          "Open the booking from Requests.",
          "Check the date, time and number of guests.",
          "Press Confirm or Decline. The guest gets an email right away.",
        ],
      },
      {
        heading: "During service",
        needs: "reservations:manage",
        steps: [
          "When the guests arrive, mark the booking Seated.",
          "When they leave, mark it Completed. If they never came, use No-show.",
        ],
      },
      {
        heading: "Phone bookings and walk-ins",
        needs: "reservations:manage",
        steps: [
          "Press New booking.",
          "Choose Phone booking, or Walk-in for guests standing at the door.",
          "Fill in the name, phone, date, time and number of guests.",
          "Press Add booking (or Seat guests for a walk-in). No request step: it's confirmed straight away.",
        ],
      },
    ],
    tips: [
      "Add a note to a booking (allergies, a birthday, a favourite table) — only the team sees it.",
      "Changing a booking's time or size emails the guest the new details.",
      "WhatsApp next to the guest's phone opens a ready message (confirmed, reminder, are you on your way?). Check it, then press Send in WhatsApp.",
    ],
    limited: {
      missing: "reservations:manage",
      note: "You can see the bookings. Confirming, changing or cancelling them is for managers.",
    },
  },

  orders: {
    id: "orders",
    title: "Orders",
    summary: "Online orders for delivery and pickup, from new to done.",
    keywords:
      "online order delivery pickup kitchen ticket print accept preparing ready refund cancel whatsapp driver message",
    sections: [
      {
        heading: "What you'll find",
        points: [
          "A live board: New, Accepted, Preparing, and Ready & on the way.",
          "New orders ring and show a number on “Orders” in the sidebar, on every admin page.",
          "Each order shows the dishes, their options and notes, the address or pickup time, and how it was paid.",
        ],
      },
      {
        heading: "Move an order along",
        steps: [
          "Open the new order and press Accept order.",
          "Press Start preparing when the kitchen starts on it.",
          "Press Ready for pickup, or Out for delivery when the driver leaves.",
          "Press Mark picked up or Mark delivered to finish it.",
        ],
      },
      {
        heading: "Message the guest or the driver on WhatsApp",
        steps: [
          "Open the order and press WhatsApp next to the guest's phone.",
          "Pick a message: Order confirmed, In the kitchen, On the way, Running late… It's filled in with the order number and time. Change it if you like.",
          "Press Open WhatsApp, then Send. It goes from the phone or computer you're on.",
          "For a delivery, Send to driver types the address, map link, phone and the amount to collect: choose the driver in WhatsApp.",
        ],
      },
      {
        heading: "Something's not right",
        points: [
          "Print gives the kitchen a ticket.",
          "Notes on an order are for the team only.",
          "Cancel order if you can't make it. Card payments are refunded by the owner.",
        ],
      },
    ],
    tips: [
      "Keep this page open on a tablet in the kitchen: new orders appear by themselves.",
      "Orders guests send on WhatsApp from the menu (without an account) arrive in the restaurant's WhatsApp, not on this board.",
      "“Awaiting payment” means the guest hasn't finished paying yet. Wait before preparing it.",
    ],
    limited: {
      missing: "orders:edit",
      note: "Changing an order's dishes and refunding a payment is for the owner.",
    },
  },

  menu: {
    id: "menu",
    title: "Menu",
    summary: "Your dishes, prices, photos, categories and sales.",
    keywords:
      "dish item price photo category sold out hidden stock sale promotion happy hour allergens sizes extras",
    sections: [
      {
        heading: "What you'll find",
        points: [
          "Every dish, with filters: All, On the menu, Sold out, Hidden. Search by name.",
          "Categories (Starters, Mains…): their order on the website and their photo.",
          "Promotions: sales and happy hours that change prices on their own.",
        ],
      },
      {
        heading: "Sold out during service",
        steps: [
          "Find the dish.",
          "Switch off “In stock”.",
          "Guests see “Sold out” and can't order it. Switch it back on when it's available again.",
        ],
      },
      {
        heading: "Add a dish",
        needs: "menu:manage",
        steps: [
          "Press New item.",
          "Add a photo: drag it in, paste it, or browse. Big photos are fine, they're shrunk for the web.",
          "Fill in the name and price. With several sizes (glass and bottle, small and large), switch the price to Sizes.",
          "Optionally: choices and extras (cooking, sides, sauces), dietary tags, allergens, spice, badges.",
          "Press Create item. It's on the website right away, or saved hidden if “Show on the menu” is off.",
        ],
      },
      {
        heading: "Run a sale or happy hour",
        needs: "menu:manage",
        steps: [
          "Press Promotions at the top of the Menu page, then New promotion. You can start from a ready-made one: Happy hour, Weekend brunch or Menu sale.",
          "Choose the discount and what it covers: the whole menu, some categories, or some dishes.",
          "Choose when: from a date, until a date, and on which days and hours.",
          "Press Create promotion. Prices change by themselves when it starts and go back when it ends.",
        ],
      },
    ],
    tips: [
      "Hidden is better than deleting a seasonal dish: switch it back on next season.",
      "Fill in the allergens. Guests filter the menu with them, and it's often required by law.",
      "The “Was” price shows crossed out next to the price, for a one-off promotion.",
    ],
    limited: {
      missing: "menu:manage",
      note: "You can mark dishes sold out and back in stock. Editing dishes, prices and sales is for managers.",
    },
  },

  qr: {
    id: "qr",
    title: "QR codes",
    summary: "Print codes for the tables, the counter or the window.",
    keywords: "qr code table card sticker poster print scan menu",
    sections: [
      {
        heading: "Print table cards",
        steps: [
          "Choose what the code opens: the menu, the website, booking a table, or another link.",
          "Choose a style: Table card (4 per page), Sticker (9 per page) or Poster (one big code).",
          "Change the headline if you like, and the table numbers (from 1 to 12, for example).",
          "Press Print. Choose A4, scale 100% and “Background graphics”, then cut along the dotted lines.",
        ],
      },
    ],
    tips: [
      "Scan one code with your phone before printing them all.",
      "The code never changes: dishes and prices update on the website, so you don't reprint when the menu changes.",
      "SVG downloads the code alone, sharp at any size, for a designer or a print shop.",
    ],
  },

  gallery: {
    id: "gallery",
    title: "Gallery",
    summary: "The photos on the website's gallery page.",
    keywords: "photos pictures images album upload featured order",
    sections: [
      {
        heading: "What you can do",
        points: [
          "Upload several photos at once by dropping them on the page.",
          "Put photos in albums (food, the room, events…) so guests can filter.",
          "Feature a photo to make it bigger in the gallery.",
          "Drag photos to change their order.",
          "Add a caption, and a short description for people using screen readers.",
        ],
      },
    ],
    tips: [
      "Bright, natural-light photos of a few dishes do more than many dark ones.",
    ],
  },

  messages: {
    id: "messages",
    title: "Messages",
    summary: "What guests send from the contact page, and your replies.",
    keywords: "contact inbox email reply spam archive star",
    sections: [
      {
        heading: "What you'll find",
        points: [
          "Inbox, Unread, Starred, Archived and Spam.",
          "Messages full of links are put in Spam automatically.",
        ],
      },
      {
        heading: "Reply",
        steps: [
          "Open the message.",
          "Write your answer, or start from a quick reply (Thanks, Private event, Feedback).",
          "Send. The guest gets it by email, from the restaurant.",
          "Archive the message once it's dealt with.",
        ],
      },
    ],
    tips: [
      "Star a message to come back to it. Notes on a message are only seen by the team.",
    ],
  },

  subscribers: {
    id: "subscribers",
    title: "Newsletter",
    summary: "Your mailing list, the emails you send, and the automatic ones.",
    keywords:
      "newsletter email campaign subscribers mailing list automation welcome sale alert",
    sections: [
      {
        heading: "Subscribers",
        points: [
          "Everyone who signed up on the website. They confirm by email first, so the list stays clean.",
          "Search, add someone who asked in person, remove someone, or download the list.",
          "People who unsubscribe are never emailed again, as the law requires.",
        ],
      },
      {
        heading: "Send a newsletter",
        steps: [
          "Open Campaigns and start a new newsletter.",
          "Write the subject and the message. You can add dishes from the menu, with their photo and price.",
          "Press Send test to get it yourself, and check it on your phone.",
          "Press Send…, then send it now or schedule it for later.",
        ],
      },
      {
        heading: "Automatic emails",
        points: [
          "Welcome: sent when someone joins. Write your own message for it.",
          "Sale alerts: when a dish goes on sale, subscribers can get an email about it automatically.",
        ],
      },
    ],
    tips: [
      "One or two emails a month keeps people happy. More, and they start to unsubscribe.",
    ],
  },

  team: {
    id: "team",
    title: "Team",
    summary: "Who can open the admin panel, and what they can do.",
    keywords: "staff users roles manager admin access invite remove disable",
    sections: [
      {
        heading: "Add someone",
        steps: [
          "Ask them to create an account on the website first.",
          "Here, search for their name or email.",
          "Give them a role: Staff, Manager or Admin. They see the new pages the next time they open the panel.",
        ],
      },
      {
        heading: "Change or remove access",
        points: [
          "Change someone's role at any time.",
          "Turn the role back to Guest to remove their access, or disable the account completely.",
          "The restaurant always keeps at least one admin.",
        ],
      },
    ],
    tips: [
      "Give each person their own account: never share a password between staff.",
    ],
  },

  settings: {
    id: "settings",
    title: "Settings",
    summary: "Opening hours, holidays and the restaurant's settings.",
    keywords: "opening hours closed holiday special days time zone schedule",
    sections: [
      {
        heading: "Opening hours",
        points: [
          "Set the hours for each day of the week. A day can have two services, like lunch and dinner.",
          "Add special days: holidays, a private event, shorter hours on a given date.",
          "The website, bookings and online orders all follow these hours.",
        ],
      },
    ],
    tips: [
      "Add holidays well ahead, so nobody can book a table on a day you're closed.",
    ],
  },

  events: {
    id: "events",
    title: "Events",
    summary: "Tastings, live music and special nights on the website.",
    keywords: "events calendar tasting music",
    sections: [
      {
        heading: "What you can do",
        text: "Create an event with a date, a photo and a description. It shows on the website until the day has passed.",
      },
    ],
  },
  content: {
    id: "content",
    title: "Pages & content",
    summary: "The texts and photos of the website's pages.",
    keywords: "about page text homepage content",
    sections: [
      {
        heading: "What you can do",
        text: "Change the words and pictures of pages like Home and About, without touching the design.",
      },
    ],
  },
  blog: {
    id: "blog",
    title: "Journal",
    summary: "Stories and news from the kitchen.",
    keywords: "blog journal posts articles news",
    sections: [
      {
        heading: "What you can do",
        text: "Write a post with a title, a photo and text. Save it as a draft, or publish it on the website.",
      },
    ],
  },
  giftCards: {
    id: "giftCards",
    title: "Gift cards",
    summary: "Gift cards sold on the website, and their balance.",
    keywords: "gift card voucher balance code",
    sections: [
      {
        heading: "What you can do",
        text: "See the gift cards sold, check a card's code and balance, and use it when a guest pays with it.",
      },
    ],
  },
};

export function searchText(topic: GuideTopic): string {
  const parts = [
    topic.title,
    topic.summary,
    topic.keywords ?? "",
    ...topic.sections.flatMap((s) => [
      s.heading,
      s.text ?? "",
      ...(s.points ?? []),
      ...(s.steps ?? []),
    ]),
    ...(topic.tips ?? []),
  ];
  return normalize(parts.join(" "));
}

export const normalize = (text: string) =>
  text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
