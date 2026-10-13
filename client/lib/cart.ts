export const MAX_LINE_QUANTITY = 20;
export const MAX_LINE_NOTE = 140;
export const CART_KEY = ["cart"] as const;
export const CHECKOUT_ROUTE = "/payment/checkout";

export type CartIssue = "removed" | "sold-out" | "changed";

export type CartLine = {
  id: string;
  dish: {
    id: string;
    slug: string;
    name: string;
    image?: string;
    imageBlur?: string;
    category?: string;
  };
  variant?: { id: string; name: string };
  options: { id: string; name: string; group: string }[];
  quantity: number;
  note: string;
  unitPrice: number;
  unitWas?: number;
  total: number;
  sale?: { name: string; percentOff: number };
  issue?: CartIssue;
  issueText?: string;
};

export type Cart = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  savings: number;
  ready: boolean;
  updatedAt: string | null;
};

export type AddToCartInput = {
  itemId: string;
  variantId?: string;
  optionIds: string[];
  quantity: number;
  note?: string;
};

export const EMPTY_CART: Cart = {
  lines: [],
  count: 0,
  subtotal: 0,
  savings: 0,
  ready: false,
  updatedAt: null,
};

export function recount(cart: Cart, lines: CartLine[]): Cart {
  const ok = lines.filter((l) => !l.issue);
  const sum = (values: number[]) =>
    values.reduce((a, b) => a + Math.round(b * 1e6), 0) / 1e6;
  return {
    ...cart,
    lines,
    count: ok.reduce((n, l) => n + l.quantity, 0),
    subtotal: sum(ok.map((l) => l.total)),
    savings: sum(
      ok.map((l) =>
        l.unitWas !== undefined ? (l.unitWas - l.unitPrice) * l.quantity : 0,
      ),
    ),
    ready: ok.length > 0 && ok.length === lines.length,
  };
}

export function withQuantity(
  cart: Cart,
  lineId: string,
  quantity: number,
): Cart {
  const lines =
    quantity <= 0
      ? cart.lines.filter((l) => l.id !== lineId)
      : cart.lines.map((l) =>
          l.id === lineId
            ? {
                ...l,
                quantity,
                total: l.issue
                  ? 0
                  : Math.round(l.unitPrice * quantity * 1e6) / 1e6,
              }
            : l,
        );
  return recount(cart, lines);
}

export const SIGN_IN_EVENT = "mesa:sign-in";
export const requestSignIn = () =>
  window.dispatchEvent(new CustomEvent(SIGN_IN_EVENT));

export const CART_TARGET = "data-cart-target";
const BUMP_EVENT = "mesa:cart-bump";

export const cartButton = () =>
  document.querySelector<HTMLElement>(`[${CART_TARGET}]`);

export function flyToCart(
  from: Element | DOMRect | null,
  image?: string | null,
) {
  const target = cartButton();
  if (!target) return;
  const bump = () => window.dispatchEvent(new CustomEvent(BUMP_EVENT));
  if (!from || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    return bump();

  const a = from instanceof Element ? from.getBoundingClientRect() : from;
  if (a.width === 0 && a.height === 0) return bump();
  const b = target.getBoundingClientRect();
  const size = 56;
  const startX = a.left + a.width / 2 - size / 2;
  const startY = a.top + a.height / 2 - size / 2;
  const dx = b.left + b.width / 2 - size / 2 - startX;
  const dy = b.top + b.height / 2 - size / 2 - startY;

  const flyer = document.createElement("div");
  flyer.setAttribute("aria-hidden", "true");
  Object.assign(flyer.style, {
    position: "fixed",
    left: `${startX}px`,
    top: `${startY}px`,
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: "9999px",
    zIndex: "200",
    pointerEvents: "none",
    background: image
      ? `center / cover no-repeat url("${image.replace(/"/g, '\\"')}")`
      : "var(--primary)",
    boxShadow:
      "0 10px 30px -8px rgb(0 0 0 / 0.45), 0 0 0 3px var(--background)",
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(flyer);

  const lift = Math.min(160, Math.abs(dy) * 0.35 + 60);
  const animation = flyer.animate(
    [
      { transform: "translate(0, 0) scale(0.6)", opacity: 0.9 },
      { transform: "translate(0, 0) scale(1.08)", opacity: 1, offset: 0.12 },
      {
        transform: `translate(${dx * 0.55}px, ${Math.min(dy, 0) * 0.55 - lift}px) scale(0.8)`,
        opacity: 1,
        offset: 0.55,
      },
      { transform: `translate(${dx}px, ${dy}px) scale(0.2)`, opacity: 0.35 },
    ],
    { duration: 720, easing: "cubic-bezier(0.45, 0, 0.2, 1)" },
  );
  animation.onfinish = () => {
    flyer.remove();
    bump();
  };
}

export function onCartBump(handler: () => void) {
  window.addEventListener(BUMP_EVENT, handler);
  return () => window.removeEventListener(BUMP_EVENT, handler);
}
