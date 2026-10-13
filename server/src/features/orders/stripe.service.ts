import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import type { Env } from 'src/config/env';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private client?: Stripe | null;

  constructor(private readonly config: ConfigService<Env, true>) {}

  private read(key: 'STRIPE_SECRET_KEY' | 'STRIPE_WEBHOOK_SECRET'): string {
    const value: unknown = this.config.get(key, { infer: true });
    return typeof value === 'string' ? value.trim() : '';
  }

  get enabled(): boolean {
    return this.stripe() !== null;
  }

  private stripe(): Stripe | null {
    if (this.client === undefined) {
      const key = this.read('STRIPE_SECRET_KEY');
      this.client = key
        ? new Stripe(key, { maxNetworkRetries: 2, timeout: 20_000 })
        : null;
      if (!key)
        this.logger.warn('STRIPE_SECRET_KEY is not set: card payments are off');
    }
    return this.client;
  }

  private require(): Stripe {
    const stripe = this.stripe();
    if (!stripe)
      throw new ServiceUnavailableException(
        'Card payments are not available right now. Choose cash instead.',
      );
    return stripe;
  }

  createIntent(input: {
    amount: number;
    currency: string;
    orderId: string;
    metadata: Record<string, string>;
    description: string;
    email?: string;
  }) {
    return this.require().paymentIntents.create(
      {
        amount: input.amount,
        currency: input.currency.toLowerCase(),
        allowed_payment_method_types: ['card'],
        description: input.description,
        metadata: input.metadata,
        ...(input.email && { receipt_email: input.email }),
      },
      { idempotencyKey: `order-${input.orderId}` },
    );
  }

  retrieveIntent(id: string) {
    return this.require().paymentIntents.retrieve(id, {
      expand: ['latest_charge'],
    });
  }

  async cancelIntent(id: string): Promise<void> {
    try {
      await this.require().paymentIntents.cancel(id);
    } catch (error) {
      this.logger.debug(`Couldn't cancel ${id}: ${(error as Error).message}`);
    }
  }

  refund(input: {
    intentId: string;
    amount: number;
    idempotencyKey: string;
    reason?: string;
  }) {
    return this.require().refunds.create(
      {
        payment_intent: input.intentId,
        amount: input.amount,
        metadata: input.reason
          ? { reason: input.reason.slice(0, 200) }
          : undefined,
      },
      { idempotencyKey: input.idempotencyKey },
    );
  }

  verifyWebhook(rawBody: Buffer, signature: string): Stripe.Event {
    const secret = this.read('STRIPE_WEBHOOK_SECRET');
    if (!secret)
      throw new ServiceUnavailableException('STRIPE_WEBHOOK_SECRET is not set');
    return this.require().webhooks.constructEvent(rawBody, signature, secret);
  }
}

export function cardOf(intent: Stripe.PaymentIntent): {
  brand?: string;
  last4?: string;
} {
  const charge = intent.latest_charge;
  const card =
    charge && typeof charge === 'object'
      ? charge.payment_method_details?.card
      : undefined;
  return { brand: card?.brand ?? undefined, last4: card?.last4 ?? undefined };
}
