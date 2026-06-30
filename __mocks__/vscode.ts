import { vi } from 'vitest';

export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

export enum ProgressLocation {
  SourceControl = 1,
  Window = 10,
  Notification = 15,
}

export enum ViewColumn {
  Active = -1,
  Beside = -2,
  One = 1,
}

export class TreeItem {
  label: unknown;
  collapsibleState: unknown;
  description?: unknown;
  contextValue?: string;
  iconPath?: unknown;
  tooltip?: unknown;
  command?: unknown;
  constructor(label: unknown, collapsibleState?: unknown) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

export class ThemeIcon {
  constructor(
    public readonly id: string,
    public readonly color?: unknown
  ) {}
}

export class ThemeColor {
  constructor(public readonly id: string) {}
}

export class EventEmitter<T> {
  private readonly listeners: Array<(e: T) => void> = [];
  event = (listener: (e: T) => void) => {
    this.listeners.push(listener);
    return { dispose: () => {} };
  };
  fire(data: T) {
    for (const listener of this.listeners) {
      listener(data);
    }
  }
  dispose() {
    this.listeners.length = 0;
  }
}

export const authentication = {
  getSession: vi.fn(),
};

export const commands = {
  registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
  executeCommand: vi.fn(),
};

const makeLogChannel = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  dispose: vi.fn(),
});

export const window = {
  showInformationMessage: vi.fn(),
  showErrorMessage: vi.fn(),
  showWarningMessage: vi.fn(),
  showInputBox: vi.fn(),
  createOutputChannel: vi.fn(() => makeLogChannel()),
  createTreeView: vi.fn(() => ({ title: '', dispose: vi.fn() })),
  createWebviewPanel: vi.fn(() => ({
    title: '',
    webview: { html: '' },
    reveal: vi.fn(),
    onDidDispose: vi.fn(),
    dispose: vi.fn(),
  })),
  withProgress: vi.fn((_options: unknown, task: (...args: unknown[]) => unknown) =>
    task({ report: vi.fn() }, { isCancellationRequested: false })
  ),
};

export const extensions = {
  getExtension: vi.fn(),
};

export const workspace: {
  workspaceFolders: Array<{ uri: { fsPath: string } }> | undefined;
} = {
  workspaceFolders: [{ uri: { fsPath: '/repo' } }],
};

export const Uri = {
  file: vi.fn((path: string) => ({ fsPath: path })),
  parse: vi.fn((value: string) => ({ toString: () => value })),
};
