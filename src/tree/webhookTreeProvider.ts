import * as vscode from 'vscode';
import { HostNode, WebhookNode, BranchNode, DeliveryNode, MessageNode } from './nodes';
import type {
  WebhookClient,
  Webhook,
  DeliverySummary,
  DeliveryDetail,
} from '../github/webhookClient';
import { DeliveryCache } from '../github/deliveryCache';
import { extractBranchName, NO_BRANCH_GROUP } from '../github/branch';
import { toMessage } from '../errors';

type Node = HostNode | WebhookNode | BranchNode | DeliveryNode | MessageNode;

function extractHost(webhook: Webhook): string {
  if (!webhook.config?.url) return webhook.name;
  try {
    return new URL(webhook.config.url).hostname;
  } catch {
    return webhook.name;
  }
}

/** Supplies the webhook tree. Deliveries are always grouped by branch. */
export class WebhookTreeProvider implements vscode.TreeDataProvider<Node> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<Node | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private client: WebhookClient | undefined;
  private cache: DeliveryCache | undefined;
  private emptyMessage: string | undefined;

  constructor(private readonly log: vscode.LogOutputChannel) {}

  /**
   * Replace the active client (e.g. after the repository changes), then refresh.
   * When client is undefined, emptyMessage (if given) is shown as a single row.
   */
  setClient(client: WebhookClient | undefined, emptyMessage?: string): void {
    this.client = client;
    this.cache = client ? new DeliveryCache(client) : undefined;
    this.emptyMessage = emptyMessage;
    this.refresh();
  }

  refresh(): void {
    this.cache?.clear();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: Node): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: Node): Promise<Node[]> {
    const client = this.client;
    if (!client) {
      return this.emptyMessage ? [new MessageNode(this.emptyMessage)] : [];
    }
    try {
      if (!element) {
        const webhooks = await client.listWebhooks();
        this.log.info(`listWebhooks returned ${webhooks.length} webhook(s)`);
        if (webhooks.length === 0) {
          return [new MessageNode('No webhooks configured for this repository.')];
        }
        return this.groupByHost(webhooks);
      }
      if (element instanceof HostNode) {
        return element.webhooks.map((webhook) => new WebhookNode(webhook));
      }
      if (element instanceof WebhookNode) {
        return await this.webhookChildren(client, element.webhook.id);
      }
      if (element instanceof BranchNode) {
        return element.deliveries.map((delivery) => new DeliveryNode(element.hookId, delivery));
      }
      return [];
    } catch (error) {
      this.log.error(`getChildren failed: ${toMessage(error)}`);
      void vscode.window.showErrorMessage(`GitHub Webhook Manager: ${toMessage(error)}`);
      return [];
    }
  }

  /** Group webhooks by hostname, sorted alphabetically. */
  private groupByHost(webhooks: Webhook[]): HostNode[] {
    const groups = new Map<string, Webhook[]>();
    for (const webhook of webhooks) {
      const host = extractHost(webhook);
      const list = groups.get(host) ?? [];
      list.push(webhook);
      groups.set(host, list);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([host, hooks]) => new HostNode(host, hooks));
  }

  /** Children of a webhook node, grouped by branch. */
  private async webhookChildren(client: WebhookClient, hookId: number): Promise<Node[]> {
    const deliveries = await client.listDeliveries(hookId);
    if (!this.cache) {
      return deliveries.map((delivery) => new DeliveryNode(hookId, delivery));
    }
    const details = await this.cache.getMany(hookId, deliveries);
    return this.groupByBranch(hookId, deliveries, details);
  }

  /** Bucket deliveries by branch, keeping branchless/failed ones in a trailing group. */
  private groupByBranch(
    hookId: number,
    deliveries: DeliverySummary[],
    details: Map<number, DeliveryDetail | null>
  ): BranchNode[] {
    const groups = new Map<string, DeliverySummary[]>();
    for (const delivery of deliveries) {
      const detail = details.get(delivery.id);
      const branch = detail
        ? (extractBranchName(delivery.event, detail.request?.payload) ?? NO_BRANCH_GROUP)
        : NO_BRANCH_GROUP;
      const list = groups.get(branch) ?? [];
      list.push(delivery);
      groups.set(branch, list);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => {
        if (a === NO_BRANCH_GROUP) return 1;
        if (b === NO_BRANCH_GROUP) return -1;
        return a.localeCompare(b);
      })
      .map(([branch, deliveries]) => new BranchNode(hookId, branch, deliveries));
  }
}
