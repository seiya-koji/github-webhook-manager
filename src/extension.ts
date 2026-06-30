import * as vscode from 'vscode';
import { getOctokit } from './auth';
import { resolveRepo, type RepoRef } from './github/repoResolver';
import { WebhookClient } from './github/webhookClient';
import { WebhookTreeProvider } from './tree/webhookTreeProvider';
import { DeliveryNode } from './tree/nodes';
import { DeliveryPanel } from './panel/deliveryPanel';
import { toMessage } from './errors';

export function activate(context: vscode.ExtensionContext): void {
  const log = vscode.window.createOutputChannel('GitHub Webhook Manager', { log: true });
  context.subscriptions.push(log);

  const provider = new WebhookTreeProvider(log);
  const treeView = vscode.window.createTreeView('githubWebhooks.deliveries', {
    treeDataProvider: provider,
  });
  context.subscriptions.push(treeView);

  let currentRepo: RepoRef | undefined;
  let currentClient: WebhookClient | undefined;

  async function load(repo?: RepoRef): Promise<void> {
    try {
      const target = repo ?? currentRepo ?? (await resolveRepo());
      if (!target) {
        log.info('No repository resolved — tree will be empty.');
        provider.setClient(undefined, 'No GitHub repository detected in this workspace.');
        return;
      }
      log.info(`Loading webhooks for ${target.owner}/${target.repo} on ${target.host}`);
      currentRepo = target;
      treeView.title = `Webhooks · ${target.owner}/${target.repo}`;
      const octokit = await getOctokit(target.host);
      currentClient = new WebhookClient(octokit, target.owner, target.repo);
      provider.setClient(currentClient);
    } catch (error) {
      log.error(`load failed: ${toMessage(error)}`);
      void vscode.window.showErrorMessage(`GitHub Webhook Manager: ${toMessage(error)}`);
    }
  }

  async function showDelivery(node: DeliveryNode): Promise<void> {
    const client = currentClient;
    if (!client) {
      return;
    }
    try {
      const detail = await client.getDelivery(node.hookId, node.delivery.id);
      DeliveryPanel.show(detail);
    } catch (error) {
      void vscode.window.showErrorMessage(`GitHub Webhook Manager: ${toMessage(error)}`);
    }
  }

  async function redeliver(node: DeliveryNode): Promise<void> {
    const client = currentClient;
    if (!client) {
      return;
    }
    const choice = await vscode.window.showWarningMessage(
      `Redeliver the "${node.delivery.event}" delivery?`,
      { modal: true },
      'Redeliver'
    );
    if (choice !== 'Redeliver') {
      return;
    }
    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Redelivering webhook…',
        },
        () => client.redeliver(node.hookId, node.delivery.id)
      );
      void vscode.window.showInformationMessage('Webhook redelivered.');
      provider.refresh();
    } catch (error) {
      void vscode.window.showErrorMessage(`GitHub Webhook Manager: ${toMessage(error)}`);
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('githubWebhooks.refresh', () => provider.refresh()),
    vscode.commands.registerCommand('githubWebhooks.showDelivery', (node: DeliveryNode) =>
      showDelivery(node)
    ),
    vscode.commands.registerCommand('githubWebhooks.redeliver', (node: DeliveryNode) =>
      redeliver(node)
    )
  );

  void load();
}

export function deactivate(): void {
  // No teardown needed: disposables are registered on context.subscriptions.
}
