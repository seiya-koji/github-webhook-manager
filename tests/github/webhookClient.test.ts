import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Octokit } from '@octokit/rest';
import { WebhookClient } from '../../src/github/webhookClient';

function createOctokit() {
  return {
    rest: {
      repos: {
        listWebhooks: vi.fn().mockResolvedValue({ data: [{ id: 1 }] }),
        listWebhookDeliveries: vi.fn().mockResolvedValue({ data: [{ id: 10 }] }),
        getWebhookDelivery: vi.fn().mockResolvedValue({ data: { id: 10 } }),
        redeliverWebhookDelivery: vi.fn().mockResolvedValue({ data: {} }),
      },
    },
  };
}

describe('WebhookClient', () => {
  let octokit: ReturnType<typeof createOctokit>;
  let client: WebhookClient;

  beforeEach(() => {
    octokit = createOctokit();
    client = new WebhookClient(octokit as unknown as Octokit, 'seiya-koji', 'demo');
  });

  it('listWebhooks queries owner/repo and returns the data payload', async () => {
    const result = await client.listWebhooks();
    expect(octokit.rest.repos.listWebhooks).toHaveBeenCalledWith({
      owner: 'seiya-koji',
      repo: 'demo',
    });
    expect(result).toEqual([{ id: 1 }]);
  });

  it('listDeliveries passes hook_id and a page size', async () => {
    await client.listDeliveries(42);
    expect(octokit.rest.repos.listWebhookDeliveries).toHaveBeenCalledWith({
      owner: 'seiya-koji',
      repo: 'demo',
      hook_id: 42,
      per_page: 30,
    });
  });

  it('getDelivery passes hook_id and delivery_id', async () => {
    await client.getDelivery(42, 99);
    expect(octokit.rest.repos.getWebhookDelivery).toHaveBeenCalledWith({
      owner: 'seiya-koji',
      repo: 'demo',
      hook_id: 42,
      delivery_id: 99,
    });
  });

  it('redeliver posts a new attempt for hook_id and delivery_id', async () => {
    await client.redeliver(42, 99);
    expect(octokit.rest.repos.redeliverWebhookDelivery).toHaveBeenCalledWith({
      owner: 'seiya-koji',
      repo: 'demo',
      hook_id: 42,
      delivery_id: 99,
    });
  });
});
