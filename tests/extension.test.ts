import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { activate, deactivate } from '../src/extension';
import { DeliveryNode, MessageNode, WebhookNode } from '../src/tree/nodes';
import type { DeliverySummary, Webhook } from '../src/github/webhookClient';

const repos = vi.hoisted(() => ({
  listWebhooks: vi.fn(),
  listWebhookDeliveries: vi.fn(),
  getWebhookDelivery: vi.fn(),
  redeliverWebhookDelivery: vi.fn(),
}));

vi.mock('@octokit/rest', () => ({
  Octokit: class {
    rest = { repos };
  },
}));

const execFile = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({ execFile }));

type ExecCb = (err: Error | null, stdout: string) => void;
const GIT_REMOTE = 'origin\thttps://github.com/seiya-koji/demo (fetch)\n';

const COMMANDS = [
  'githubWebhooks.refresh',
  'githubWebhooks.showDelivery',
  'githubWebhooks.redeliver',
  'githubWebhooks.openWebhookSettings',
  'githubWebhooks.openRepoWebhooks',
];

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function fakeSession(accessToken: string): vscode.AuthenticationSession {
  return {
    id: 'session-id',
    accessToken,
    account: { id: 'account-id', label: 'test account' },
    scopes: [],
  };
}

function makeContext(): vscode.ExtensionContext {
  return {
    subscriptions: { push: vi.fn() },
  } as unknown as vscode.ExtensionContext;
}

function handlerFor(command: string): (...args: unknown[]) => unknown {
  const calls = vi.mocked(vscode.commands.registerCommand).mock.calls;
  const match = calls.find(([id]) => id === command);
  if (!match) {
    throw new Error(`command not registered: ${command}`);
  }
  return match[1];
}

const deliveryNode = new DeliveryNode(7, {
  id: 10,
  guid: 'g',
  event: 'push',
  action: null,
  status: 'OK',
  status_code: 200,
  redelivery: false,
  delivered_at: 'x',
  duration: 1,
} as unknown as DeliverySummary);

const webhookNode = new WebhookNode({
  id: 42,
  name: 'web',
  active: true,
  events: ['push'],
  config: {},
} as unknown as Webhook);

describe('activate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    execFile.mockImplementation((_c: string, _a: string[], _o: unknown, cb: ExecCb) =>
      cb(null, GIT_REMOTE)
    );
    repos.listWebhooks.mockResolvedValue({ data: [] });
    repos.listWebhookDeliveries.mockResolvedValue({ data: [] });
    repos.getWebhookDelivery.mockResolvedValue({ data: { id: 10 } });
    repos.redeliverWebhookDelivery.mockResolvedValue({ data: {} });
    vi.mocked(vscode.authentication.getSession).mockResolvedValue(fakeSession('tok'));
  });

  it('creates the tree view and registers every command', () => {
    activate(makeContext());

    expect(vscode.window.createTreeView).toHaveBeenCalledWith(
      'githubWebhooks.deliveries',
      expect.anything()
    );
    for (const command of COMMANDS) {
      expect(vscode.commands.registerCommand).toHaveBeenCalledWith(command, expect.any(Function));
    }
  });

  it('redelivers after confirmation and refreshes the tree', async () => {
    // showWarningMessage は MessageItem を返すオーバーロードで型解決されるため、
    // コードが実際に受け取る文字列ボタン値に合わせてキャストする。
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(
      'Redeliver' as unknown as vscode.MessageItem
    );
    activate(makeContext());
    await flush();

    await handlerFor('githubWebhooks.redeliver')(deliveryNode);

    expect(repos.redeliverWebhookDelivery).toHaveBeenCalledWith({
      owner: 'seiya-koji',
      repo: 'demo',
      hook_id: 7,
      delivery_id: 10,
    });
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Webhook redelivered.');
  });

  it('does not redeliver when the user dismisses the prompt', async () => {
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(undefined);
    activate(makeContext());
    await flush();

    await handlerFor('githubWebhooks.redeliver')(deliveryNode);

    expect(repos.redeliverWebhookDelivery).not.toHaveBeenCalled();
  });

  it('shows a notice in the view when no repository is detected', async () => {
    execFile.mockImplementation((_c: string, _a: string[], _o: unknown, cb: ExecCb) =>
      cb(new Error('not a git repository'), '')
    );
    activate(makeContext());
    await flush();

    const options = vi.mocked(vscode.window.createTreeView).mock.calls[0][1];
    const provider = options.treeDataProvider as unknown as { getChildren(): Promise<unknown[]> };
    const roots = await provider.getChildren();

    expect(roots).toHaveLength(1);
    expect(roots[0]).toBeInstanceOf(MessageNode);
  });

  it('opens the repository webhooks page in the browser', async () => {
    activate(makeContext());
    await flush();

    await handlerFor('githubWebhooks.openRepoWebhooks')();

    expect(vscode.Uri.parse).toHaveBeenCalledWith(
      'https://github.com/seiya-koji/demo/settings/hooks'
    );
    expect(vscode.env.openExternal).toHaveBeenCalled();
  });

  it('opens a single webhook settings page in the browser', async () => {
    activate(makeContext());
    await flush();

    await handlerFor('githubWebhooks.openWebhookSettings')(webhookNode);

    expect(vscode.Uri.parse).toHaveBeenCalledWith(
      'https://github.com/seiya-koji/demo/settings/hooks/42'
    );
    expect(vscode.env.openExternal).toHaveBeenCalled();
  });

  it('warns instead of opening when no repository is detected', async () => {
    execFile.mockImplementation((_c: string, _a: string[], _o: unknown, cb: ExecCb) =>
      cb(new Error('not a git repository'), '')
    );
    activate(makeContext());
    await flush();

    await handlerFor('githubWebhooks.openRepoWebhooks')();

    expect(vscode.env.openExternal).not.toHaveBeenCalled();
    expect(vscode.window.showWarningMessage).toHaveBeenCalled();
  });

  it('deactivate runs without throwing', () => {
    expect(() => deactivate()).not.toThrow();
  });
});
