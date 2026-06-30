import * as vscode from 'vscode';
import { Octokit } from '@octokit/rest';
import { GITHUB_COM } from './github/repoResolver';

/**
 * Scopes required to read and redeliver repository webhooks.
 * `admin:repo_hook` is mandatory even for reading deliveries; `repo`
 * is needed to access private repositories.
 */
const SCOPES = ['repo', 'admin:repo_hook'];

/**
 * Acquire a GitHub authentication session and return an Octokit client.
 *
 * For github.com the built-in `github` provider is used. For any other host
 * (GitHub Enterprise Server) the `github-enterprise` provider is used and
 * Octokit's baseUrl is pointed at `https://<host>/api/v3`.
 *
 * VS Code caches and refreshes the session, so this can be called freely.
 */
export async function getOctokit(host: string = GITHUB_COM): Promise<Octokit> {
  const isEnterprise = host !== GITHUB_COM;
  const providerId = isEnterprise ? 'github-enterprise' : 'github';
  const session = await vscode.authentication.getSession(providerId, SCOPES, {
    createIfNone: true,
  });
  return new Octokit({
    auth: session.accessToken,
    userAgent: 'github-webhook-manager',
    ...(isEnterprise && { baseUrl: `https://${host}/api/v3` }),
  });
}
