import * as vscode from 'vscode';
import type { Webhook, DeliverySummary } from '../github/webhookClient';

function pathLabel(webhook: Webhook): string {
  if (!webhook.config?.url) return webhook.name;
  try {
    const { pathname, search } = new URL(webhook.config.url);
    return pathname + search;
  } catch {
    return webhook.config.url;
  }
}

/** A hostname group shown as a collapsible root node. */
export class HostNode extends vscode.TreeItem {
  constructor(
    public readonly host: string,
    public readonly webhooks: Webhook[]
  ) {
    super(host, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'host';
    this.iconPath = new vscode.ThemeIcon('globe');
    this.description = `${webhooks.length}`;
  }
}

/** A repository webhook shown as a collapsible node under its host group. */
export class WebhookNode extends vscode.TreeItem {
  constructor(public readonly webhook: Webhook) {
    super(pathLabel(webhook), vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'webhook';
    this.description = webhook.active ? webhook.events.join(', ') : 'inactive';
    this.iconPath = new vscode.ThemeIcon(webhook.active ? 'broadcast' : 'circle-slash');
    this.tooltip = [
      `${webhook.name} (#${webhook.id})`,
      webhook.config?.url ? `URL: ${webhook.config.url}` : undefined,
      `Events: ${webhook.events.join(', ')}`,
      webhook.active ? 'Active' : 'Inactive',
    ]
      .filter((line): line is string => line !== undefined)
      .join('\n');
  }
}

/** A single webhook delivery shown as a leaf node. */
export class DeliveryNode extends vscode.TreeItem {
  constructor(
    public readonly hookId: number,
    public readonly delivery: DeliverySummary,
    branch?: string
  ) {
    super(delivery.event, vscode.TreeItemCollapsibleState.None);
    const succeeded = delivery.status_code >= 200 && delivery.status_code < 300;
    const branchSuffix = branch ? ` · ${branch}` : '';
    const branchTooltip = branch ? `\nBranch: ${branch}` : '';
    this.contextValue = 'delivery';
    this.description = `${delivery.status_code} ${delivery.status}${
      delivery.redelivery ? ' · redelivery' : ''
    }${branchSuffix}`;
    this.iconPath = new vscode.ThemeIcon(
      succeeded ? 'pass' : 'error',
      new vscode.ThemeColor(succeeded ? 'testing.iconPassed' : 'testing.iconFailed')
    );
    this.tooltip = `${delivery.event}${
      delivery.action ? '.' + delivery.action : ''
    } — ${delivery.delivered_at}${branchTooltip}`;
    this.command = {
      command: 'githubWebhooks.showDelivery',
      title: 'Show Delivery Details',
      arguments: [this],
    };
  }
}

/** A branch that groups its deliveries beneath a webhook (grouped display mode). */
export class BranchNode extends vscode.TreeItem {
  constructor(
    public readonly hookId: number,
    public readonly branch: string,
    public readonly deliveries: DeliverySummary[]
  ) {
    super(branch, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'branch';
    this.description = `${deliveries.length}`;
    this.iconPath = new vscode.ThemeIcon('git-branch');
  }
}

/** A non-interactive informational row used for empty states and notices. */
export class MessageNode extends vscode.TreeItem {
  constructor(message: string) {
    super(message, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'message';
  }
}
