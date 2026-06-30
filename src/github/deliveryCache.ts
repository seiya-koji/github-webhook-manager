import type { WebhookClient, DeliveryDetail, DeliverySummary } from './webhookClient';
import { toMessage } from '../errors';

/** Maximum number of getDelivery calls to run at once (avoids GitHub's secondary rate limits). */
const MAX_CONCURRENCY = 8;

/**
 * Caches delivery details (a DeliveryDetail including its payload) keyed by deliveryId.
 *
 * A delivery list carries no branch information, so branch display requires an
 * individual fetch per delivery. Memoized so repeated expand/redraw cycles don't
 * refetch, and a failed fetch is recorded as null to degrade gracefully without
 * throwing.
 */
export class DeliveryCache {
  private readonly store = new Map<number, DeliveryDetail | null>();
  private readonly inflight = new Map<number, Promise<DeliveryDetail | null>>();

  constructor(private readonly client: WebhookClient) {}

  /** Fetch a single delivery. Skips the fetch if already cached (whether success or failure). */
  async get(hookId: number, deliveryId: number): Promise<DeliveryDetail | null> {
    if (this.store.has(deliveryId)) {
      return this.store.get(deliveryId) ?? null;
    }
    const pending = this.inflight.get(deliveryId);
    if (pending !== undefined) {
      return pending;
    }
    const promise = this.fetch(hookId, deliveryId);
    this.inflight.set(deliveryId, promise);
    try {
      return await promise;
    } finally {
      this.inflight.delete(deliveryId);
    }
  }

  private async fetch(hookId: number, deliveryId: number): Promise<DeliveryDetail | null> {
    try {
      const detail = await this.client.getDelivery(hookId, deliveryId);
      this.store.set(deliveryId, detail);
      return detail;
    } catch (error) {
      // Degrade on failure: record null to suppress refetching, and don't propagate the exception.
      console.warn(`GitHub Webhook Manager: ${toMessage(error)}`);
      this.store.set(deliveryId, null);
      return null;
    }
  }

  /**
   * Fetch multiple deliveries with a concurrency cap, returning a Map keyed by deliveryId.
   * Individual failures are included as null; the whole operation never rejects.
   */
  async getMany(
    hookId: number,
    deliveries: DeliverySummary[]
  ): Promise<Map<number, DeliveryDetail | null>> {
    const result = new Map<number, DeliveryDetail | null>();
    let next = 0;
    const worker = async (): Promise<void> => {
      while (next < deliveries.length) {
        const delivery = deliveries[next++];
        result.set(delivery.id, await this.get(hookId, delivery.id));
      }
    };
    const size = Math.min(MAX_CONCURRENCY, deliveries.length);
    await Promise.all(Array.from({ length: size }, () => worker()));
    return result;
  }

  /** Discard the cache (on refresh / repository change / after a redelivery). */
  clear(): void {
    this.store.clear();
    this.inflight.clear();
  }
}
