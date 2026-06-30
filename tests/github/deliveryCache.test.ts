import { describe, it, expect, vi, afterEach } from 'vitest';
import { DeliveryCache } from '../../src/github/deliveryCache';
import type { WebhookClient, DeliverySummary } from '../../src/github/webhookClient';

type GetDeliveryImpl = (hookId: number, deliveryId: number) => Promise<unknown>;

function createClient(impl?: GetDeliveryImpl) {
  const getDelivery = vi.fn(impl ?? ((_hookId: number, id: number) => Promise.resolve({ id })));
  return { getDelivery } as unknown as WebhookClient & {
    getDelivery: ReturnType<typeof vi.fn>;
  };
}

/** Build delivery summaries with only the fields the cache relies on. */
function summaries(...ids: number[]): DeliverySummary[] {
  return ids.map((id) => ({ id })) as unknown as DeliverySummary[];
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DeliveryCache', () => {
  it('memoizes a successful fetch', async () => {
    const client = createClient();
    const cache = new DeliveryCache(client);

    await cache.get(1, 10);
    await cache.get(1, 10);

    expect(client.getDelivery).toHaveBeenCalledTimes(1);
  });

  it('shares an in-flight request for concurrent gets of the same id', async () => {
    let resolveFetch!: (value: unknown) => void;
    const client = createClient(() => new Promise((resolve) => (resolveFetch = resolve)));
    const cache = new DeliveryCache(client);

    const first = cache.get(1, 10);
    const second = cache.get(1, 10);
    resolveFetch({ id: 10 });
    await Promise.all([first, second]);

    expect(client.getDelivery).toHaveBeenCalledTimes(1);
  });

  it('records null on failure, does not throw, and does not refetch', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const client = createClient(() => Promise.reject(new Error('boom')));
    const cache = new DeliveryCache(client);

    await expect(cache.get(1, 10)).resolves.toBeNull();
    await expect(cache.get(1, 10)).resolves.toBeNull();
    expect(client.getDelivery).toHaveBeenCalledTimes(1);
  });

  it('fetches again after clear', async () => {
    const client = createClient();
    const cache = new DeliveryCache(client);

    await cache.get(1, 10);
    cache.clear();
    await cache.get(1, 10);

    expect(client.getDelivery).toHaveBeenCalledTimes(2);
  });

  it('returns details keyed by delivery id via getMany', async () => {
    const client = createClient();
    const cache = new DeliveryCache(client);

    const result = await cache.getMany(1, summaries(10, 11));

    expect(result.get(10)).toEqual({ id: 10 });
    expect(result.get(11)).toEqual({ id: 11 });
  });

  it('caps concurrency at 8 simultaneous fetches', async () => {
    let active = 0;
    let peak = 0;
    const client = createClient(async (_hookId, id) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return { id };
    });
    const cache = new DeliveryCache(client);

    await cache.getMany(1, summaries(...Array.from({ length: 20 }, (_unused, i) => i + 1)));

    expect(peak).toBeLessThanOrEqual(8);
    expect(client.getDelivery).toHaveBeenCalledTimes(20);
  });
});
