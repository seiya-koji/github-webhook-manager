import { describe, it, expect, vi } from 'vitest';
import * as vscode from 'vscode';
import {
  DeliveryPanel,
  escapeHtml,
  formatPayload,
  renderHtml,
} from '../../src/panel/deliveryPanel';
import type { DeliveryDetail } from '../../src/github/webhookClient';

describe('escapeHtml', () => {
  it('escapes angle brackets, ampersands and quotes', () => {
    expect(escapeHtml('<script>"&"</script>')).toBe(
      '&lt;script&gt;&quot;&amp;&quot;&lt;/script&gt;'
    );
  });

  it('leaves plain text untouched', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});

describe('formatPayload', () => {
  it('pretty-prints objects as JSON', () => {
    expect(formatPayload({ a: 1 })).toBe('{\n  "a": 1\n}');
  });

  it('returns strings unchanged', () => {
    expect(formatPayload('plain')).toBe('plain');
  });

  it('renders null and undefined as (empty)', () => {
    expect(formatPayload(null)).toBe('(empty)');
    expect(formatPayload(undefined)).toBe('(empty)');
  });
});

function detail(overrides: Partial<DeliveryDetail>): DeliveryDetail {
  return {
    id: 42,
    guid: 'guid-1',
    event: 'push',
    action: null,
    status: 'OK',
    status_code: 200,
    duration: 12,
    redelivery: false,
    delivered_at: '2026-06-30T00:00:00Z',
    request: { headers: null, payload: null },
    response: { headers: null, payload: null },
    ...overrides,
  } as unknown as DeliveryDetail;
}

describe('renderHtml', () => {
  it('highlights the branch for a push delivery', () => {
    const html = renderHtml(
      detail({
        event: 'push',
        request: { headers: null, payload: { ref: 'refs/heads/main' } },
      })
    );
    expect(html).toContain('<strong>Branch:</strong>');
    expect(html).toContain('main');
  });

  it('omits the branch line for branchless events', () => {
    const html = renderHtml(
      detail({
        event: 'issues',
        request: { headers: null, payload: { issue: { number: 1 } } },
      })
    );
    expect(html).not.toContain('Branch:');
  });

  it('includes the action and redelivery flag in the metadata line', () => {
    const html = renderHtml(detail({ action: 'opened', redelivery: true }));
    expect(html).toContain('push.opened');
    expect(html).toContain('redelivery');
  });
});

describe('DeliveryPanel', () => {
  it('creates a panel, reuses it on later shows, and recreates after disposal', () => {
    let disposeCb: () => void = () => {};
    const panel = {
      title: '',
      webview: { html: '' },
      reveal: vi.fn(),
      onDidDispose: vi.fn((cb: () => void) => {
        disposeCb = cb;
      }),
      dispose: vi.fn(),
    };
    const create = vi.mocked(vscode.window.createWebviewPanel);
    create.mockReturnValue(panel as unknown as ReturnType<typeof create>);
    create.mockClear();

    DeliveryPanel.show(detail({ id: 1 }));
    expect(create).toHaveBeenCalledTimes(1);
    expect(panel.title).toBe('Delivery #1');
    expect(panel.webview.html).toContain('Webhook delivery #1');

    DeliveryPanel.show(detail({ id: 2 }));
    expect(create).toHaveBeenCalledTimes(1); // reused, not recreated
    expect(panel.reveal).toHaveBeenCalledTimes(1);
    expect(panel.webview.html).toContain('Webhook delivery #2');

    disposeCb(); // clears the singleton
    DeliveryPanel.show(detail({ id: 3 }));
    expect(create).toHaveBeenCalledTimes(2);
  });
});
