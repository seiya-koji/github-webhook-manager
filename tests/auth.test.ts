import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { Octokit } from '@octokit/rest';
import { getOctokit } from '../src/auth';

vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn(),
}));

function fakeSession(accessToken: string): vscode.AuthenticationSession {
  return {
    id: 'session-id',
    accessToken,
    account: { id: 'account-id', label: 'test account' },
    scopes: [],
  };
}

describe('getOctokit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('github.com (default)', () => {
    it('requests a github session with the webhook scopes', async () => {
      vi.mocked(vscode.authentication.getSession).mockResolvedValue(fakeSession('tok'));

      await getOctokit();

      expect(vscode.authentication.getSession).toHaveBeenCalledWith(
        'github',
        ['repo', 'admin:repo_hook'],
        { createIfNone: true }
      );
    });

    it('builds an Octokit client without baseUrl', async () => {
      vi.mocked(vscode.authentication.getSession).mockResolvedValue(fakeSession('tok'));

      await getOctokit();

      expect(Octokit).toHaveBeenCalledWith({
        auth: 'tok',
        userAgent: 'github-webhook-manager',
      });
    });
  });

  describe('GitHub Enterprise Server', () => {
    it('requests a github-enterprise session', async () => {
      vi.mocked(vscode.authentication.getSession).mockResolvedValue(fakeSession('ghe-tok'));

      await getOctokit('github.example.com');

      expect(vscode.authentication.getSession).toHaveBeenCalledWith(
        'github-enterprise',
        ['repo', 'admin:repo_hook'],
        { createIfNone: true }
      );
    });

    it('builds an Octokit client with baseUrl pointing at /api/v3', async () => {
      vi.mocked(vscode.authentication.getSession).mockResolvedValue(fakeSession('ghe-tok'));

      await getOctokit('github.example.com');

      expect(Octokit).toHaveBeenCalledWith({
        auth: 'ghe-tok',
        userAgent: 'github-webhook-manager',
        baseUrl: 'https://github.example.com/api/v3',
      });
    });
  });
});
