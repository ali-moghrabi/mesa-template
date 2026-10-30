import { Injectable } from '@nestjs/common';

export type GatewayStatus = 'pending' | 'paid' | 'failed';

export type GatewayPayment = {
  id: string;
  status: GatewayStatus;
  orderId?: string;
  amount: number;
  currency: string;
  url?: string;
  failure?: string;
};

export type StartPayment = {
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  description: string;
  customer: { name: string; email: string; phone: string };
  returnUrl: string;
  idempotencyKey: string;
};

export type RefundRequest = {
  paymentId: string;
  amount: number;
  currency: string;
  idempotencyKey: string;
  note: string;
};

export interface PaymentGateway {
  readonly enabled: boolean;
  start(input: StartPayment): Promise<GatewayPayment>;
  check(paymentId: string): Promise<GatewayPayment>;
  refund?(input: RefundRequest): Promise<{ id: string }>;
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export class GatewayError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class NoPaymentGateway implements PaymentGateway {
  readonly enabled = false;

  start(): Promise<GatewayPayment> {
    return Promise.reject(new GatewayError('Online payments are not set up'));
  }

  check(): Promise<GatewayPayment> {
    return Promise.reject(new GatewayError('Online payments are not set up'));
  }
}
