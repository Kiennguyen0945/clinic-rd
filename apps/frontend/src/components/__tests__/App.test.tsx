import { describe, it, expect } from 'vitest';

describe('App smoke test', () => {
  it('should pass a basic sanity check', () => {
    expect(1 + 1).toBe(2);
  });
});
