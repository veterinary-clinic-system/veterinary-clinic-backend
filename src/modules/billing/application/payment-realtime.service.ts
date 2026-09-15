import { Injectable, MessageEvent } from '@nestjs/common';
import { interval, map, merge, Observable } from 'rxjs';

export interface PaymentRealtimePayload {
  paymentId: string;
  invoiceId: string;
  status: string;
  paidAt: Date | null;
}

@Injectable()
export class PaymentRealtimeService {
  private readonly listeners = new Map<string, Set<(event: MessageEvent) => void>>();

  watch(paymentId: string): Observable<MessageEvent> {
    const updates = new Observable<MessageEvent>((subscriber) => {
      const listener = (event: MessageEvent) => subscriber.next(event);
      const listeners = this.listeners.get(paymentId) ?? new Set();
      listeners.add(listener);
      this.listeners.set(paymentId, listeners);

      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) this.listeners.delete(paymentId);
      };
    });

    const heartbeat = interval(25_000).pipe(map(() => ({ type: 'heartbeat', data: {} })));
    return merge(updates, heartbeat);
  }

  publish(payload: PaymentRealtimePayload): void {
    const event: MessageEvent = { type: 'payment.updated', data: payload };
    for (const listener of this.listeners.get(payload.paymentId) ?? []) listener(event);
  }
}
