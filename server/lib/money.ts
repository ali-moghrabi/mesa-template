import { PRICE_UNIT } from './constants/menuConstants';

export const PRICE_DECIMALS = Math.round(Math.log10(PRICE_UNIT));

export const MAX_PRICE = 1_000_000;

export const toMinor = (amount: number): number =>
  Math.round(amount * PRICE_UNIT);

export const fromMinor = (
  minor: number | undefined | null,
): number | undefined => (minor == null ? undefined : minor / PRICE_UNIT);
