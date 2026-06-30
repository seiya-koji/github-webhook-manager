import * as vscode from 'vscode';
import type { DeliveryDetail } from '../github/webhookClient';
import { extractBranchName } from '../github/branch';

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function formatPayload(payload: unknown): string {
  if (payload === null || payload === undefined) {
    return '(empty)';
  }
  if (typeof payload === 'string') {
    return payload;
  }
  return JSON.stringify(payload, null, 2);
}

export function renderHtml(detail: DeliveryDetail): string {
  const branch = extractBranchName(detail.event, detail.request?.payload);
  const branchLine = branch
    ? `<p class="meta"><strong>Branch:</strong> ${escapeHtml(branch)}</p>`
    : '';
  const sections: Array<[string, string]> = [
    ['Request headers', formatPayload(detail.request?.headers)],
    ['Request payload', formatPayload(detail.request?.payload)],
    ['Response headers', formatPayload(detail.response?.headers)],
    ['Response body', formatPayload(detail.response?.payload)],
  ];
  const body = sections
    .map(([title, content]) => `<h2>${escapeHtml(title)}</h2><pre>${escapeHtml(content)}</pre>`)
    .join('\n');
  const meta = [
    `${escapeHtml(detail.event)}${detail.action ? '.' + escapeHtml(detail.action) : ''}`,
    `status ${detail.status_code} ${escapeHtml(detail.status)}`,
    `${detail.duration}ms`,
    detail.redelivery ? 'redelivery' : '',
    escapeHtml(detail.delivered_at),
  ]
    .filter(Boolean)
    .join(' · ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';" />
<style>
  body { font-family: var(--vscode-font-family); padding: 0 1rem 2rem; color: var(--vscode-foreground); }
  h1 { font-size: 1.1rem; }
  h2 { font-size: 0.95rem; margin-top: 1.5rem; }
  .meta { color: var(--vscode-descriptionForeground); margin: 0.2rem 0; }
  pre { background: var(--vscode-textCodeBlock-background); padding: 0.75rem; border-radius: 4px; overflow-x: auto; white-space: pre-wrap; word-break: break-word; }
</style>
</head>
<body>
<h1>Webhook delivery #${escapeHtml(String(detail.id))}</h1>
<p class="meta">${meta}</p>
<p class="meta">GUID: ${escapeHtml(detail.guid)}</p>
${branchLine}
${body}
</body>
</html>`;
}

/**
 * Singleton webview panel that shows the details of one webhook delivery.
 */
export class DeliveryPanel {
  private static current: DeliveryPanel | undefined;

  static show(detail: DeliveryDetail): void {
    if (DeliveryPanel.current) {
      DeliveryPanel.current.update(detail);
      DeliveryPanel.current.panel.reveal();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'githubWebhookDelivery',
      'Webhook Delivery',
      vscode.ViewColumn.Active,
      { enableScripts: false }
    );
    DeliveryPanel.current = new DeliveryPanel(panel);
    DeliveryPanel.current.update(detail);
  }

  private constructor(private readonly panel: vscode.WebviewPanel) {
    this.panel.onDidDispose(() => {
      DeliveryPanel.current = undefined;
    });
  }

  private update(detail: DeliveryDetail): void {
    this.panel.title = `Delivery #${detail.id}`;
    this.panel.webview.html = renderHtml(detail);
  }
}
