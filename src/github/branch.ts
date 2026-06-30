/** Label for events that have no branch concept, shown in inline mode. */
export const NO_BRANCH_LABEL = 'N/A';
/** Group name that collects branchless deliveries in grouped mode. */
export const NO_BRANCH_GROUP = '(No branch)';
/** Label for deliveries whose branch could not be determined (detail fetch failed). */
export const UNKNOWN_BRANCH_LABEL = 'Unknown branch';

const HEADS_PREFIX = 'refs/heads/';

/** Narrow an unknown value to a plain object (excludes arrays and null). */
function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/** Narrow an unknown value to a string. */
function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * Extract the branch name to display from a webhook delivery payload.
 *
 * A delivery list (DeliverySummary) carries no payload, so callers pass the
 * `request.payload` obtained from an individual fetch. Returns null for events
 * that have no branch concept or when the data is missing.
 *
 * @param event   The delivery event type (as in DeliverySummary.event, e.g. 'push')
 * @param payload The request.payload returned by getWebhookDelivery (typed as unknown)
 */
export function extractBranchName(event: string, payload: unknown): string | null {
  const obj = asRecord(payload);
  if (!obj) {
    return null;
  }
  switch (event) {
    case 'push': {
      // ref looks like "refs/heads/main". Tag pushes (refs/tags/...) are excluded.
      const ref = asString(obj.ref);
      return ref?.startsWith(HEADS_PREFIX) ? ref.slice(HEADS_PREFIX.length) : null;
    }
    case 'create':
    case 'delete': {
      // Only branch create/delete applies. ref is the bare branch name (no prefix). Tags are excluded.
      return obj.ref_type === 'branch' ? asString(obj.ref) : null;
    }
    case 'pull_request': {
      // For PRs from a fork, head.ref is the fork-side branch name and lacks context,
      // so we use base.ref (the merge target on the upstream repository).
      const pr = asRecord(obj.pull_request);
      const base = pr ? asRecord(pr.base) : null;
      return base ? asString(base.ref) : null;
    }
    default:
      // issues / issue_comment / release / star / watch / ping / commit_comment, etc.
      return null;
  }
}
