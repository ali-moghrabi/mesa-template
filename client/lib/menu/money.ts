export type CurrencyConfig = {
  primary: { enabled: boolean; code: string };
  secondary?: { enabled: boolean; code: string; rate: number; roundTo: number };
};

export type Money = { main: string; sub: string | null };

const formatters = new Map<string, Intl.NumberFormat>();
function format(amount: number, code: string, digits?: number): string {
  const key = `${code}:${digits ?? ""}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: code,
        ...(digits !== undefined && {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        }),
      });
    } catch {
      formatter = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    formatters.set(key, formatter);
  }
  return formatter.format(amount);
}

export function formatMoney(amount: number, currency: CurrencyConfig): Money {
  const primary = currency.primary.enabled
    ? format(amount, currency.primary.code)
    : null;
  const s = currency.secondary;
  const secondary = s?.enabled
    ? format(Math.round((amount * s.rate) / s.roundTo) * s.roundTo, s.code, 0)
    : null;
  return {
    main: primary ?? secondary ?? format(amount, currency.primary.code),
    sub: primary && secondary ? secondary : null,
  };
}
