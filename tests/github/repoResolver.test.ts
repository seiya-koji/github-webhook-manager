import { describe, it, expect, vi, afterEach } from 'vitest';
import * as vscode from 'vscode';
import { parseGitHubRemote, resolveRepo } from '../../src/github/repoResolver';

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
});
