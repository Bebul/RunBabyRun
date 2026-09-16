import { describe, it, expect } from 'vitest';
import { clockSample } from './session.js';

describe('RTT clock synchronization', () => {
  it('estimates the remote clock offset at the round-trip midpoint', () => {
    expect(clockSample(100, 140, 5120)).toEqual({ rtt: 40, offset: 5000 });
  });
  it('supports a remote clock behind the local monotonic clock', () => {
    expect(clockSample(5010, 5030, 20)).toEqual({ rtt: 20, offset: -5000 });
  });
});
