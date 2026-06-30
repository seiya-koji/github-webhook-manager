import { describe, it, expect } from 'vitest';
import { extractBranchName } from '../../src/github/branch';

describe('extractBranchName', () => {
  describe('push', () => {
    it('strips the refs/heads/ prefix to get the branch name', () => {
      expect(extractBranchName('push', { ref: 'refs/heads/main' })).toBe('main');
    });

    it('keeps nested branch names intact', () => {
      expect(extractBranchName('push', { ref: 'refs/heads/feature/login' })).toBe('feature/login');
    });

    it('returns null for tag pushes', () => {
      expect(extractBranchName('push', { ref: 'refs/tags/v1.0.0' })).toBeNull();
    });

    it('returns null when ref is missing', () => {
      expect(extractBranchName('push', { before: 'a', after: 'b' })).toBeNull();
    });

    it('returns null when ref is not a string', () => {
      expect(extractBranchName('push', { ref: 123 })).toBeNull();
    });
  });

  describe('create / delete', () => {
    it('returns the branch name when ref_type is branch (create)', () => {
      expect(extractBranchName('create', { ref: 'main', ref_type: 'branch' })).toBe('main');
    });

    it('returns the branch name when ref_type is branch (delete)', () => {
      expect(extractBranchName('delete', { ref: 'feature/x', ref_type: 'branch' })).toBe(
        'feature/x'
      );
    });

    it('returns null for tag creation', () => {
      expect(extractBranchName('create', { ref: 'v1.0.0', ref_type: 'tag' })).toBeNull();
    });

    it('returns null when ref_type is missing', () => {
      expect(extractBranchName('create', { ref: 'main' })).toBeNull();
    });
  });

  describe('pull_request', () => {
    it('uses the base (merge target) ref, not head', () => {
      expect(
        extractBranchName('pull_request', {
          pull_request: { head: { ref: 'patch-1' }, base: { ref: 'main' } },
        })
      ).toBe('main');
    });

    it('returns null when base is missing', () => {
      expect(
        extractBranchName('pull_request', { pull_request: { head: { ref: 'patch-1' } } })
      ).toBeNull();
    });

    it('returns null when pull_request is missing', () => {
      expect(extractBranchName('pull_request', { number: 5 })).toBeNull();
    });
  });

  describe('events without a branch concept', () => {
    it.each(['issues', 'issue_comment', 'release', 'star', 'watch', 'ping', 'commit_comment'])(
      'returns null for %s',
      (event) => {
        expect(extractBranchName(event, { some: 'payload' })).toBeNull();
      }
    );

    it('returns null for an unknown event even if it carries a ref', () => {
      expect(extractBranchName('deployment', { ref: 'refs/heads/main' })).toBeNull();
    });
  });

  describe('malformed payloads', () => {
    it.each([null, undefined, 'a string', 42, true])(
      'returns null for non-object payload %p',
      (payload) => {
        expect(extractBranchName('push', payload as unknown)).toBeNull();
      }
    );

    it('returns null for an array payload', () => {
      expect(extractBranchName('push', ['refs/heads/main'])).toBeNull();
    });
  });
});
