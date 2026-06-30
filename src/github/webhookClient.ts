import type { Octokit } from '@octokit/rest';

type ReposApi = Octokit['rest']['repos'];

export type Webhook = Awaited<ReturnType<ReposApi['listWebhooks']>>['data'][number];
export type DeliverySummary = Awaited<
  ReturnType<ReposApi['listWebhookDeliveries']>
>['data'][number];
export type DeliveryDetail = Awaited<ReturnType<ReposApi['getWebhookDelivery']>>['data'];

/**
 * Thin wrapper around the GitHub REST API scoped to a single repository's
 * webhooks. Each method returns the response payload directly.
 */
export class WebhookClient {
  constructor(
    private readonly octokit: Octokit,
    private readonly owner: string,
    private readonly repo: string
  ) {}

  async listWebhooks(): Promise<Webhook[]> {
    const { data } = await this.octokit.rest.repos.listWebhooks({
      owner: this.owner,
      repo: this.repo,
    });
    return data;
  }

  async listDeliveries(hookId: number): Promise<DeliverySummary[]> {
    const { data } = await this.octokit.rest.repos.listWebhookDeliveries({
      owner: this.owner,
      repo: this.repo,
      hook_id: hookId,
      per_page: 30,
    });
    return data;
  }

  async getDelivery(hookId: number, deliveryId: number): Promise<DeliveryDetail> {
    const { data } = await this.octokit.rest.repos.getWebhookDelivery({
      owner: this.owner,
      repo: this.repo,
      hook_id: hookId,
      delivery_id: deliveryId,
    });
    return data;
  }

  async redeliver(hookId: number, deliveryId: number): Promise<void> {
    await this.octokit.rest.repos.redeliverWebhookDelivery({
      owner: this.owner,
      repo: this.repo,
      hook_id: hookId,
      delivery_id: deliveryId,
    });
  }
}
