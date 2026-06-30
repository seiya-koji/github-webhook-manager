import { describe, it, expect } from 'vitest';
import { WebhookNode, DeliveryNode, BranchNode } from '../../src/tree/nodes';
import type { Webhook, DeliverySummary } from '../../src/github/webhookClient';

const webhook = {
  id: 1,
  name: 'web',
  active: true,
  events: ['push', 'pull_request'],
  config: { url: 'https://example.com/hook' },
} as unknown as Webhook;

const delivery = {
  id: 10,
  guid: 'g-1',
  event: 'push',
  action: null,
  status: 'OK',
  status_code: 200,
  redelivery: false,
  delivered_at: '2026-06-30T00:00:00Z',
  duration: 12,
} as unknown as DeliverySummary;

describe('WebhookNode', () => {
  it('uses the path as label and tags context', () => {
    const node = new WebhookNode(webhook);
    expect(node.label).toBe('/hook');
    expect(node.contextValue).toBe('webhook');
    expect(node.description).toBe('push, pull_request');
  });

  it('marks inactive webhooks', () => {
    const node = new WebhookNode({
      ...webhook,
      active: false,
    });
    expect(node.description).toBe('inactive');
  });

  it('exposes the full destination url in the tooltip', () => {
    const node = new WebhookNode(webhook);
    expect(node.tooltip).toContain('https://example.com/hook');
  });
});

describe('DeliveryNode', () => {
  it('tags delivery context and wires the show command', () => {
    const node = new DeliveryNode(7, delivery);
    expect(node.hookId).toBe(7);
    expect(node.contextValue).toBe('delivery');
    expect(node.command?.command).toBe('githubWebhooks.showDelivery');
    expect(node.command?.arguments?.[0]).toBe(node);
  });

  it('describes the status and flags redeliveries', () => {
    const node = new DeliveryNode(7, {
      ...delivery,
      redelivery: true,
    });
    expect(node.description).toContain('200');
    expect(node.description).toContain('redelivery');
  });

  it('leaves the description and tooltip untouched when no branch is given', () => {
    const node = new DeliveryNode(7, delivery);
    expect(node.description).toBe('200 OK');
    expect(node.tooltip).not.toContain('Branch:');
  });

  it('appends the branch to the description and tooltip when given', () => {
    const node = new DeliveryNode(7, delivery, 'main');
    expect(node.description).toContain('main');
    expect(node.tooltip).toContain('Branch: main');
  });
});

describe('BranchNode', () => {
  it('groups deliveries under a branch label', () => {
    const node = new BranchNode(7, 'main', [delivery, delivery]);
    expect(node.hookId).toBe(7);
    expect(node.branch).toBe('main');
    expect(node.label).toBe('main');
    expect(node.contextValue).toBe('branch');
    expect(node.description).toBe('2');
    expect(node.deliveries).toHaveLength(2);
  });
});
