import { describe, it, expect, vi } from 'vitest';
import * as vscode from 'vscode';
import { WebhookTreeProvider } from '../../src/tree/webhookTreeProvider';
import { HostNode, WebhookNode, BranchNode, DeliveryNode, MessageNode } from '../../src/tree/nodes';
import type { WebhookClient } from '../../src/github/webhookClient';

function makeLog(): vscode.LogOutputChannel {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    dispose: vi.fn(),
  } as unknown as vscode.LogOutputChannel;
}

function createClient() {
  return {
    listWebhooks: vi
      .fn()
      .mockResolvedValue([
        { id: 1, name: 'web', active: true, events: ['push'], config: { url: 'u' } },
      ]),
    listDeliveries: vi.fn().mockResolvedValue([
      {
        id: 10,
        guid: 'g',
        event: 'push',
        action: null,
        status: 'OK',
        status_code: 200,
        redelivery: false,
        delivered_at: 'x',
        duration: 1,
      },
    ]),
  } as unknown as WebhookClient;
}

type BranchClient = WebhookClient & {
  listDeliveries: ReturnType<typeof vi.fn>;
  getDelivery: ReturnType<typeof vi.fn>;
};

function summary(id: number, event: string, action: string | null) {
  return {
    id,
    guid: `g${id}`,
    event,
    action,
    status: 'OK',
    status_code: 200,
    redelivery: false,
    delivered_at: 'x',
    duration: 1,
  };
}

/**
 * A client whose single webhook has three deliveries: a push to main,
 * a pull_request whose merge target (base) is develop, and a branchless issues event.
 */
function createBranchClient(): BranchClient {
  const deliveries = [
    summary(10, 'push', null),
    summary(11, 'pull_request', 'opened'),
    summary(12, 'issues', 'opened'),
  ];
  const payloads: Record<number, unknown> = {
    10: { ref: 'refs/heads/main' },
    11: { pull_request: { base: { ref: 'develop' } } },
    12: { issue: { number: 1 } },
  };
  return {
    listWebhooks: vi
      .fn()
      .mockResolvedValue([
        { id: 1, name: 'web', active: true, events: ['push'], config: { url: 'u' } },
      ]),
    listDeliveries: vi.fn().mockResolvedValue(deliveries),
    getDelivery: vi
      .fn()
      .mockImplementation((_hookId: number, id: number) =>
        Promise.resolve({ id, request: { payload: payloads[id] } })
      ),
  } as unknown as BranchClient;
}

/** Navigate to the WebhookNode inside the single-host branch client. */
async function getWebhookNode(provider: WebhookTreeProvider): Promise<WebhookNode> {
  const [hostNode] = await provider.getChildren();
  const [webhookNode] = await provider.getChildren(hostNode);
  return webhookNode as WebhookNode;
}

describe('WebhookTreeProvider', () => {
  it('returns no children until a client is set', async () => {
    const provider = new WebhookTreeProvider(makeLog());
    expect(await provider.getChildren()).toEqual([]);
  });

  it('shows the empty message when set without a client', async () => {
    const provider = new WebhookTreeProvider(makeLog());
    provider.setClient(undefined, 'No GitHub repository detected in this workspace.');

    const roots = await provider.getChildren();

    expect(roots).toHaveLength(1);
    expect(roots[0]).toBeInstanceOf(MessageNode);
    expect(roots[0].label).toBe('No GitHub repository detected in this workspace.');
  });

  it('shows a message when the repository has no webhooks', async () => {
    const provider = new WebhookTreeProvider(makeLog());
    provider.setClient({
      listWebhooks: vi.fn().mockResolvedValue([]),
      listDeliveries: vi.fn(),
    } as unknown as WebhookClient);

    const roots = await provider.getChildren();

    expect(roots).toHaveLength(1);
    expect(roots[0]).toBeInstanceOf(MessageNode);
    expect(roots[0].label).toBe('No webhooks configured for this repository.');
  });

  it('returns host nodes at the root', async () => {
    const provider = new WebhookTreeProvider(makeLog());
    provider.setClient(createClient());

    const roots = await provider.getChildren();

    expect(roots).toHaveLength(1);
    expect(roots[0]).toBeInstanceOf(HostNode);
  });

  it('returns webhook nodes under a host node', async () => {
    const provider = new WebhookTreeProvider(makeLog());
    provider.setClient(createClient());

    const [hostNode] = await provider.getChildren();
    const webhooks = await provider.getChildren(hostNode);

    expect(webhooks).toHaveLength(1);
    expect(webhooks[0]).toBeInstanceOf(WebhookNode);
  });

  it('orders root host nodes alphabetically by hostname', async () => {
    const provider = new WebhookTreeProvider(makeLog());
    provider.setClient({
      listWebhooks: vi.fn().mockResolvedValue([
        {
          id: 1,
          name: 'web',
          active: true,
          events: ['push'],
          config: { url: 'https://b.example.com/hook' },
        },
        {
          id: 2,
          name: 'web',
          active: true,
          events: ['push'],
          config: { url: 'https://a.example.com/hook' },
        },
      ]),
      listDeliveries: vi.fn(),
    } as unknown as WebhookClient);

    const roots = await provider.getChildren();

    expect(roots.map((node) => node.label)).toEqual(['a.example.com', 'b.example.com']);
  });

  it('groups same-host webhooks under one host node', async () => {
    const provider = new WebhookTreeProvider(makeLog());
    provider.setClient({
      listWebhooks: vi.fn().mockResolvedValue([
        {
          id: 1,
          name: 'web',
          active: true,
          events: ['push'],
          config: { url: 'https://example.com/hook1' },
        },
        {
          id: 2,
          name: 'web',
          active: true,
          events: ['push'],
          config: { url: 'https://example.com/hook2' },
        },
      ]),
      listDeliveries: vi.fn(),
    } as unknown as WebhookClient);

    const roots = await provider.getChildren();

    expect(roots).toHaveLength(1);
    expect(roots[0]).toBeInstanceOf(HostNode);
    const webhooks = await provider.getChildren(roots[0]);
    expect(webhooks).toHaveLength(2);
  });

  it('groups deliveries by branch', async () => {
    const client = createBranchClient();
    const provider = new WebhookTreeProvider(makeLog());
    provider.setClient(client);

    const webhookNode = await getWebhookNode(provider);
    const branches = await provider.getChildren(webhookNode);

    expect(branches.every((node) => node instanceof BranchNode)).toBe(true);
    const labels = branches.map((node) => node.label);
    expect(labels).toContain('main');
    expect(labels).toContain('develop');
    expect(labels).toContain('(No branch)');
    expect(labels.at(-1)).toBe('(No branch)'); // branchless group is last
  });

  it('expands a branch node without extra detail fetches', async () => {
    const client = createBranchClient();
    const provider = new WebhookTreeProvider(makeLog());
    provider.setClient(client);

    const webhookNode = await getWebhookNode(provider);
    const branches = await provider.getChildren(webhookNode);
    const callsSoFar = client.getDelivery.mock.calls.length;
    const main = branches.find((node) => node.label === 'main');
    expect(main).toBeDefined();
    const leaves = await provider.getChildren(main);

    expect(leaves.every((node) => node instanceof DeliveryNode)).toBe(true);
    expect(client.getDelivery).toHaveBeenCalledTimes(callsSoFar);
  });

  it('places deliveries in (No branch) group when detail fetch fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const client = createBranchClient();
    client.getDelivery.mockRejectedValue(new Error('boom'));
    const provider = new WebhookTreeProvider(makeLog());
    provider.setClient(client);

    const webhookNode = await getWebhookNode(provider);
    const branches = await provider.getChildren(webhookNode);

    expect(branches.every((node) => node instanceof BranchNode)).toBe(true);
    const labels = branches.map((node) => node.label);
    expect(labels).toEqual(['(No branch)']); // all deliveries fall back to no-branch group
    warn.mockRestore();
  });

  it('sorts branch groups alphabetically with the branchless group last', async () => {
    const deliveries = [
      summary(20, 'push', null),
      summary(21, 'issues', 'opened'),
      summary(22, 'push', null),
      summary(23, 'pull_request', 'opened'),
    ];
    const payloads: Record<number, unknown> = {
      20: { ref: 'refs/heads/zeta' },
      21: { issue: { number: 1 } },
      22: { ref: 'refs/heads/alpha' },
      23: { pull_request: { base: { ref: 'mu' } } },
    };
    const client = {
      listWebhooks: vi
        .fn()
        .mockResolvedValue([
          { id: 1, name: 'web', active: true, events: ['push'], config: { url: 'https://h/hook' } },
        ]),
      listDeliveries: vi.fn().mockResolvedValue(deliveries),
      getDelivery: vi
        .fn()
        .mockImplementation((_hookId: number, id: number) =>
          Promise.resolve({ id, request: { payload: payloads[id] } })
        ),
    } as unknown as WebhookClient;
    const provider = new WebhookTreeProvider(makeLog());
    provider.setClient(client);

    const webhookNode = await getWebhookNode(provider);
    const branches = await provider.getChildren(webhookNode);

    expect(branches.map((node) => node.label)).toEqual(['alpha', 'mu', 'zeta', '(No branch)']);
  });

  it('returns the element itself as its tree item', () => {
    const provider = new WebhookTreeProvider(makeLog());
    const node = new MessageNode('hello');
    expect(provider.getTreeItem(node)).toBe(node);
  });

  it('groups a webhook whose config has no url under its name', async () => {
    const provider = new WebhookTreeProvider(makeLog());
    provider.setClient({
      listWebhooks: vi
        .fn()
        .mockResolvedValue([
          { id: 1, name: 'named-hook', active: true, events: ['push'], config: {} },
        ]),
      listDeliveries: vi.fn(),
    } as unknown as WebhookClient);

    const roots = await provider.getChildren();

    expect(roots).toHaveLength(1);
    expect(roots[0].label).toBe('named-hook');
  });

  it('returns no children for node types that never expand', async () => {
    const provider = new WebhookTreeProvider(makeLog());
    provider.setClient(createClient());

    expect(await provider.getChildren(new MessageNode('leaf'))).toEqual([]);
  });

  it('reports an error and returns no children when listing webhooks fails', async () => {
    const log = makeLog();
    const provider = new WebhookTreeProvider(log);
    provider.setClient({
      listWebhooks: vi.fn().mockRejectedValue(new Error('api down')),
      listDeliveries: vi.fn(),
    } as unknown as WebhookClient);

    const roots = await provider.getChildren();

    expect(roots).toEqual([]);
    expect(log.error).toHaveBeenCalled();
    expect(vscode.window.showErrorMessage).toHaveBeenCalled();
  });

  it('returns an ungrouped delivery list when no cache is present', async () => {
    const provider = new WebhookTreeProvider(makeLog());
    const client = createBranchClient();
    // White-box: bypass setClient so no DeliveryCache is created, exercising the
    // ungrouped fallback in webhookChildren.
    (provider as unknown as { client: WebhookClient }).client = client;

    const webhookNode = await getWebhookNode(provider);
    const children = await provider.getChildren(webhookNode);

    expect(children.every((node) => node instanceof DeliveryNode)).toBe(true);
    expect(children).toHaveLength(3);
    expect(client.getDelivery).not.toHaveBeenCalled();
  });
});
