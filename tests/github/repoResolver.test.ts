import { describe, it, expect, vi, afterEach } from 'vitest';
import * as vscode from 'vscode';
import { parseGitHubRemote, resolveRepo, webhookSettingsUrl } from '../../src/github/repoResolver';

const execFile = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({ execFile }));

type ExecCb = (err: Error | null, stdout: string) => void;

function gitReturns(stdout: string): void {
  execFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: ExecCb) => {
    cb(null, stdout);
  });
}

function gitFails(): void {
  execFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: ExecCb) => {
    cb(new Error('not a git repository'), '');
  });
}

type Folders = Array<{ uri: { fsPath: string } }> | undefined;

function setFolders(folders: Folders): void {
  (vscode.workspace as unknown as { workspaceFolders: Folders }).workspaceFolders = folders;
}

const DEFAULT_FOLDERS = [{ uri: { fsPath: '/repo' } }];

afterEach(() => {
  setFolders(DEFAULT_FOLDERS);
  execFile.mockReset();
});

describe('parseGitHubRemote', () => {
  it('parses an https URL', () => {
    expect(parseGitHubRemote('https://github.com/seiya-koji/github-webhook-manager')).toEqual({
      host: 'github.com',
      owner: 'seiya-koji',
      repo: 'github-webhook-manager',
    });
  });

  it('strips a trailing .git suffix', () => {
    expect(parseGitHubRemote('https://github.com/seiya-koji/demo.git')).toEqual({
      host: 'github.com',
      owner: 'seiya-koji',
      repo: 'demo',
    });
  });

  it('parses an scp-style ssh URL', () => {
    expect(parseGitHubRemote('git@github.com:seiya-koji/demo.git')).toEqual({
      host: 'github.com',
      owner: 'seiya-koji',
      repo: 'demo',
    });
  });

  it('parses an ssh:// URL', () => {
    expect(parseGitHubRemote('ssh://git@github.com/seiya-koji/demo')).toEqual({
      host: 'github.com',
      owner: 'seiya-koji',
      repo: 'demo',
    });
  });

  it('ignores a trailing slash', () => {
    expect(parseGitHubRemote('https://github.com/owner/repo/')).toEqual({
      host: 'github.com',
      owner: 'owner',
      repo: 'repo',
    });
  });

  it('parses a GitHub Enterprise https URL', () => {
    expect(parseGitHubRemote('https://github.example.com/org/repo')).toEqual({
      host: 'github.example.com',
      owner: 'org',
      repo: 'repo',
    });
  });

  it('parses a GitHub Enterprise scp-style ssh URL', () => {
    expect(parseGitHubRemote('git@github.example.com:org/repo.git')).toEqual({
      host: 'github.example.com',
      owner: 'org',
      repo: 'repo',
    });
  });

  it('parses a GitHub Enterprise ssh:// URL', () => {
    expect(parseGitHubRemote('ssh://git@github.example.com/org/repo')).toEqual({
      host: 'github.example.com',
      owner: 'org',
      repo: 'repo',
    });
  });

  it('returns undefined for unrecognised URL patterns', () => {
    expect(parseGitHubRemote('not-a-url')).toBeUndefined();
  });
});

describe('resolveRepo', () => {
  it('detects the repository from the origin remote', async () => {
    setFolders(DEFAULT_FOLDERS);
    gitReturns(
      'origin\thttps://github.com/seiya-koji/demo (fetch)\n' +
        'origin\thttps://github.com/seiya-koji/demo (push)\n'
    );
    expect(await resolveRepo()).toEqual({ host: 'github.com', owner: 'seiya-koji', repo: 'demo' });
  });

  it('prefers the upstream remote over origin', async () => {
    setFolders(DEFAULT_FOLDERS);
    gitReturns(
      'origin\thttps://github.com/me/fork (fetch)\n' +
        'upstream\thttps://github.com/acme/app (fetch)\n'
    );
    expect(await resolveRepo()).toEqual({ host: 'github.com', owner: 'acme', repo: 'app' });
  });

  it('returns undefined when git detection fails', async () => {
    setFolders(DEFAULT_FOLDERS);
    gitFails();
    expect(await resolveRepo()).toBeUndefined();
  });

  it('returns undefined when there are no workspace folders', async () => {
    setFolders([]);
    expect(await resolveRepo()).toBeUndefined();
    expect(execFile).not.toHaveBeenCalled();
  });

  it('returns undefined when workspaceFolders is undefined', async () => {
    setFolders(undefined);
    expect(await resolveRepo()).toBeUndefined();
    expect(execFile).not.toHaveBeenCalled();
  });

  it('returns undefined when git succeeds but no remote parses to a GitHub repo', async () => {
    setFolders(DEFAULT_FOLDERS);
    gitReturns('origin\tsome-unparseable-remote (fetch)\n');
    expect(await resolveRepo()).toBeUndefined();
  });
});

describe('webhookSettingsUrl', () => {
  const repo = { host: 'github.com', owner: 'owner', repo: 'repo' };

  it('builds the single-webhook settings URL when a hookId is given', () => {
    expect(webhookSettingsUrl(repo, 123)).toBe('https://github.com/owner/repo/settings/hooks/123');
  });

  it('builds the hooks-list URL when no hookId is given', () => {
    expect(webhookSettingsUrl(repo)).toBe('https://github.com/owner/repo/settings/hooks');
  });

  it('uses the host from the repo for GitHub Enterprise Server', () => {
    expect(webhookSettingsUrl({ host: 'github.example.com', owner: 'org', repo: 'app' }, 7)).toBe(
      'https://github.example.com/org/app/settings/hooks/7'
    );
  });
});
