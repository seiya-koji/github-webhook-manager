import { execFile } from 'node:child_process';
import * as vscode from 'vscode';

export interface RepoRef {
  host: string;
  owner: string;
  repo: string;
}

export const GITHUB_COM = 'github.com';

/**
 * Build the browser URL for a repository's webhook settings page.
 * With a hookId, points at that single webhook; without it, the hooks list.
 * Works for github.com and GitHub Enterprise Server (the host is taken from repo).
 */
export function webhookSettingsUrl(repo: RepoRef, hookId?: number): string {
  const base = `https://${repo.host}/${repo.owner}/${repo.repo}/settings/hooks`;
  return hookId === undefined ? base : `${base}/${hookId}`;
}

/**
 * Parse a git remote URL (https, ssh://, or scp-style) into a RepoRef.
 * The host is extracted from the URL and included in the result, so both
 * github.com and GitHub Enterprise Server URLs are supported.
 */
export function parseGitHubRemote(url: string): RepoRef | undefined {
  const trimmed = url.trim();

  // https:// or http://
  let m = /^https?:\/\/([^/:]+)\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(trimmed);
  if (m) return { host: m[1], owner: m[2], repo: m[3] };

  // ssh://[user@]host/owner/repo
  m = /^ssh:\/\/(?:[^@/]+@)?([^/]+)\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(trimmed);
  if (m) return { host: m[1], owner: m[2], repo: m[3] };

  // scp-style: [user@]host:owner/repo (no leading slash after the colon)
  m = /^(?:[^@:/]+@)?([^:/]+):([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(trimmed);
  if (m) return { host: m[1], owner: m[2], repo: m[3] };

  return undefined;
}

function detectInFolder(cwd: string): Promise<RepoRef | undefined> {
  return new Promise((resolve) => {
    execFile('git', ['remote', '-v'], { cwd }, (err, stdout) => {
      if (err) {
        resolve(undefined);
        return;
      }
      const fetchUrls = new Map<string, string>();
      for (const line of stdout.split('\n')) {
        // "origin\thttps://github.com/owner/repo (fetch)"
        const m = /^(\S+)\t(\S+)\s+\(fetch\)$/.exec(line.trim());
        if (m) fetchUrls.set(m[1], m[2]);
      }
      // upstream (fork の元リポジトリ) → origin → それ以外の順で試す
      const order = ['upstream', 'origin', ...fetchUrls.keys()];
      for (const name of new Set(order)) {
        const url = fetchUrls.get(name);
        if (url) {
          const ref = parseGitHubRemote(url);
          if (ref) {
            resolve(ref);
            return;
          }
        }
      }
      resolve(undefined);
    });
  });
}

/**
 * Resolve the repository to operate on by auto-detecting it from the
 * workspace's git remotes (`upstream` is preferred over `origin`).
 * Detection always runs fresh; returns undefined when no GitHub remote is found.
 */
export async function resolveRepo(): Promise<RepoRef | undefined> {
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    const ref = await detectInFolder(folder.uri.fsPath);
    if (ref) return ref;
  }
  return undefined;
}
