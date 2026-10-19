import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { currencyDecimals } from 'lib/ordering';
import type { Env } from 'src/config/env';

/**
 * Card payments (Visa, Mastercard…) through Tap Payments: https://developers.tap.company
 *
 *   1. createCharge  → Tap answers with transaction.url, its secure payment page
 *   2. the guest pays there (3-D Secure included) and Tap sends them back to redirect.url
 *   3. retrieveCharge → the charge's real status, read from Tap with the secret key
 *   4. Tap also POSTs the charge to post.url (the webhook), in case the guest closes the tab
 *
 * Card numbers never reach MESA. One setting: TAP_SECRET_KEY (sk_test_… or sk_live_…).
 * Amounts sent to Tap are in normal units (12.5 = $12.50), not cents.
 */

const API = 'https://api.tap.company/v2';
const TIMEOUT_MS = 20_000;

export type TapStatus =
  | 'INITIATED'
  | 'ABANDONED'
  | 'CANCELLED'
  | 'FAILED'
  | 'DECLINED'
  | 'RESTRICTED'
  | 'CAPTURED'
  | 'VOID'
  | 'TIMEDOUT'
  | 'UNKNOWN'
  | (string & {});

export type TapCharge = {
  id: string;
  object?: string;
  status: TapStatus;
  amount: number;
  currency: string;
  metadata?: Record<string, string>;
  reference?: {
    transaction?: string;
    order?: string;
    gateway?: string;
    payment?: string;
  };
  transaction?: { url?: string; created?: string };
  card?: {
    brand?: string;
    scheme?: string;
    last_four?: string;
    first_six?: string;
  };
  response?: { code?: string; message?: string };
};

export type TapRefund = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  charge_id?: string;
  response?: { code?: string; message?: string };
};

/** A payment that went through */
export const CAPTURED = 'CAPTURED';
/** The guest is still on Tap's page (or never finished it) */
export const IN_PROGRESS = new Set(['INITIATED', 'UNKNOWN']);

/** A refusal from Tap, with its own message */
export class TapError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class TapService {
  private readonly logger = new Logger(TapService.name);
  private warned = false;

  constructor(private readonly config: ConfigService<Env, true>) {}

  private secretKey(): string {
    const value: unknown = this.config.get('TAP_SECRET_KEY', { infer: true });
    const key = typeof value === 'string' ? value.trim() : '';
    if (!key && !this.warned) {
      this.warned = true;
      this.logger.warn('TAP_SECRET_KEY is not set: card payments are off');
    }
    return key;
  }

  get enabled(): boolean {
    return this.secretKey() !== '';
  }

  cardForm(): { publicKey: string; merchantId?: string } | null {
    if (!this.enabled) return null;
    const read = (key: 'TAP_PUBLIC_KEY' | 'TAP_MERCHANT_ID') => {
      const value: unknown = this.config.get(key, { infer: true });
      return typeof value === 'string' ? value.trim() : '';
    };
    const publicKey = read('TAP_PUBLIC_KEY');
    if (!/^pk_(test|live)_[A-Za-z0-9]+$/.test(publicKey)) return null;
    const merchantId = read('TAP_MERCHANT_ID');
    return { publicKey, ...(merchantId && { merchantId }) };
  }

  /** Where Tap sends its notifications: API_PUBLIC_URL, or the address Render gives the service */
  webhookUrl(): string | undefined {
    const value: unknown = this.config.get('API_PUBLIC_URL', { infer: true });
    const base =
      (typeof value === 'string' && value.trim()) ||
      process.env.RENDER_EXTERNAL_URL?.trim() ||
      '';
    if (!/^https:\/\//i.test(base)) return undefined; // Tap can't post to localhost
    return `${base.replace(/\/+$/, '')}/api/v1/payments/tap/webhook`;
  }

  /**
   * A charge for one checkout attempt. The same idempotency key within 24h returns the same charge.
   * With a card token (tok_…, from the card field in the checkout) the card is charged directly:
   * the answer is final at once, or INITIATED with transaction.url when the bank wants 3-D Secure.
   * Without one, transaction.url is Tap's payment page.
   */
  createCharge(input: {
    amount: number;
    currency: string;
    orderId: string;
    orderNumber: string;
    idempotencyKey: string;
    description: string;
    customer: { name: string; email: string };
    redirectUrl: string;
    cardToken?: string;
  }): Promise<TapCharge> {
    const [first, ...rest] = input.customer.name.trim().split(/\s+/);
    const post = this.webhookUrl();
    return this.request<TapCharge>('POST', '/charges', {
      amount: input.amount,
      currency: input.currency.toUpperCase(),
      threeDSecure: true,
      save_card: false,
      customer_initiated: true,
      description: input.description.slice(0, 200),
      metadata: { udf1: input.orderId },
      reference: {
        transaction: input.orderId,
        order: input.orderNumber,
        idempotent: input.idempotencyKey,
      },
      receipt: { email: false, sms: false },
      customer: {
        first_name: first || 'Guest',
        ...(rest.length > 0 && { last_name: rest.join(' ') }),
        email: input.customer.email,
      },
      // The card typed in the checkout, or Tap's page with every method the restaurant has on
      source: { id: input.cardToken ?? 'src_all' },
      redirect: { url: input.redirectUrl },
      ...(post && { post: { url: post } }),
    });
  }

  retrieveCharge(id: string): Promise<TapCharge> {
    if (!/^chg_[A-Za-z0-9]+$/.test(id))
      return Promise.reject(new TapError('Not a Tap charge id'));
    return this.request<TapCharge>('GET', `/charges/${id}`);
  }

  /** Full or partial refund back to the card */
  refund(input: {
    chargeId: string;
    amount: number;
    currency: string;
    idempotencyKey: string;
    note?: string;
  }): Promise<TapRefund> {
    return this.request<TapRefund>('POST', '/refunds', {
      charge_id: input.chargeId,
      amount: input.amount,
      currency: input.currency.toUpperCase(),
      reason: 'requested_by_customer',
      reference: { idempotent: input.idempotencyKey },
      ...(input.note && { metadata: { udf1: input.note.slice(0, 200) } }),
    });
  }

  /**
   * Tap signs each notification: HMAC-SHA256 (key: the secret key) of
   * x_id…x_amount…x_currency…x_gateway_reference…x_payment_reference…x_status…x_created…,
   * sent in the "hashstring" header. https://developers.tap.company/docs/webhook
   */
  verifyWebhook(body: TapCharge, hashstring: string | undefined): boolean {
    const key = this.secretKey();
    if (!key || !hashstring || !body?.id) return false;
    const decimals = currencyDecimals(body.currency ?? '');
    const created =
      body.transaction?.created ?? (body as { created?: string }).created ?? '';
    const text =
      `x_id${body.id}` +
      `x_amount${Number(body.amount).toFixed(decimals)}` +
      `x_currency${body.currency ?? ''}` +
      `x_gateway_reference${body.reference?.gateway ?? ''}` +
      `x_payment_reference${body.reference?.payment ?? ''}` +
      `x_status${body.status ?? ''}` +
      `x_created${created}`;
    const expected = createHmac('sha256', key).update(text).digest('hex');
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(hashstring.trim().toLowerCase(), 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  /* ───────────── HTTP ───────────── */

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const key = this.secretKey();
    if (!key)
      throw new ServiceUnavailableException(
        'Card payments are not available right now. Choose cash instead.',
      );

    // One retry on a network error or a 5xx: safe, POSTs carry an idempotency key
    for (let attempt = 1; ; attempt++) {
      let response: Response;
      try {
        response = await fetch(`${API}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${key}`,
            Accept: 'application/json',
            ...(body !== undefined && { 'Content-Type': 'application/json' }),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (error) {
        if (attempt < 2) continue;
        throw new TapError(`Tap didn't answer: ${(error as Error).message}`);
      }

      const text = await response.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        // not JSON: handled below
      }
      if (response.ok && json && typeof json === 'object') return json as T;
      if (response.status >= 500 && attempt < 2) continue;
      throw new TapError(
        errorMessage(json) ?? `Tap answered ${response.status}`,
        response.status,
      );
    }
  }
}

/** Tap's errors look like { errors: [{ code, description }] } */
function errorMessage(json: unknown): string | undefined {
  const errors = (
    json as { errors?: { description?: string; message?: string }[] } | null
  )?.errors;
  if (Array.isArray(errors) && errors.length > 0)
    return errors
      .map((e) => e.description ?? e.message)
      .filter(Boolean)
      .join('; ');
  const message = (json as { message?: string } | null)?.message;
  return typeof message === 'string' ? message : undefined;
}

/** "VISA" → "visa", for the receipt ("Visa •••• 4242") */
export function cardOf(charge: TapCharge): { brand?: string; last4?: string } {
  const brand = (charge.card?.brand ?? charge.card?.scheme)?.toLowerCase();
  const last4 = charge.card?.last_four;
  return {
    brand: brand || undefined,
    last4: last4 && /^\d{4}$/.test(last4) ? last4 : undefined,
  };
}

/** A short, guest-friendly reason for a failed charge */
export function failureMessage(charge: TapCharge): string {
  switch (charge.status) {
    case 'DECLINED':
    case 'RESTRICTED':
      return 'Your card was declined. Try another card.';
    case 'CANCELLED':
    case 'ABANDONED':
      return 'The payment was cancelled.';
    case 'TIMEDOUT':
      return 'The payment took too long and expired.';
    default:
      return (
        charge.response?.message?.trim() || "The payment didn't go through."
      );
  }
}
