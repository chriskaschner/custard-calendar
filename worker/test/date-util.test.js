import { describe, it, expect } from 'vitest';
import { centralDateString } from '../src/date-util.js';

describe('centralDateString', () => {
  it('returns a zero-padded YYYY-MM-DD', () => {
    expect(centralDateString(new Date('2026-03-07T18:00:00Z'))).toBe('2026-03-07');
  });

  it('is unambiguous at midday', () => {
    expect(centralDateString(new Date('2026-08-04T17:00:00Z'))).toBe('2026-08-04');
  });

  describe('during CDT (UTC-5)', () => {
    it('still reports the previous day after UTC midnight', () => {
      // 01:30 UTC Aug 5 == 20:30 Central Aug 4
      expect(centralDateString(new Date('2026-08-05T01:30:00Z'))).toBe('2026-08-04');
    });

    it('rolls over at 05:00 UTC', () => {
      expect(centralDateString(new Date('2026-08-05T04:59:00Z'))).toBe('2026-08-04');
      expect(centralDateString(new Date('2026-08-05T05:00:00Z'))).toBe('2026-08-05');
    });
  });

  describe('during CST (UTC-6)', () => {
    it('rolls over at 06:00 UTC', () => {
      expect(centralDateString(new Date('2026-01-15T05:59:00Z'))).toBe('2026-01-14');
      expect(centralDateString(new Date('2026-01-15T06:00:00Z'))).toBe('2026-01-15');
    });
  });

  it('crosses the year boundary in Central, not UTC', () => {
    // 02:00 UTC Jan 1 is still 20:00 Central Dec 31
    expect(centralDateString(new Date('2027-01-01T02:00:00Z'))).toBe('2026-12-31');
  });
});
