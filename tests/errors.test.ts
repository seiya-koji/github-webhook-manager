import { describe, it, expect } from 'vitest';
import { toMessage } from '../src/errors';

describe('toMessage', () => {
  it('returns the message of an Error instance', () => {
    expect(toMessage(new Error('boom'))).toBe('boom');
  });

  it('returns a string value unchanged', () => {
    expect(toMessage('plain failure')).toBe('plain failure');
  });

  it('JSON-stringifies any other thrown value', () => {
    expect(toMessage({ code: 42 })).toBe('{"code":42}');
    expect(toMessage(123)).toBe('123');
  });
});
