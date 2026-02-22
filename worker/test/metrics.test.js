import { describe, it, expect } from 'vitest';
import { detectStreaks } from '../src/metrics.js';

describe('detectStreaks', () => {
  it('detects a streak of 3 consecutive same-flavor days', () => {
    const history = [
      { date: '2026-02-24', normalized_flavor: 'mint explosion', flavor: 'Mint Explosion' },
      { date: '2026-02-23', normalized_flavor: 'mint explosion', flavor: 'Mint Explosion' },
      { date: '2026-02-22', normalized_flavor: 'mint explosion', flavor: 'Mint Explosion' },
      { date: '2026-02-21', normalized_flavor: 'butter pecan', flavor: 'Butter Pecan' },
    ];

    const streaks = detectStreaks(history);
    expect(streaks).toHaveLength(1);
    expect(streaks[0].flavor).toBe('Mint Explosion');
    expect(streaks[0].length).toBe(3);
    expect(streaks[0].start).toBe('2026-02-22');
    expect(streaks[0].end).toBe('2026-02-24');
  });

  it('ignores single-day appearances (no streak)', () => {
    const history = [
      { date: '2026-02-24', normalized_flavor: 'mint explosion', flavor: 'Mint Explosion' },
      { date: '2026-02-23', normalized_flavor: 'butter pecan', flavor: 'Butter Pecan' },
      { date: '2026-02-22', normalized_flavor: 'turtle', flavor: 'Turtle' },
    ];

    expect(detectStreaks(history)).toHaveLength(0);
  });

  it('detects multiple streaks', () => {
    const history = [
      { date: '2026-02-26', normalized_flavor: 'turtle', flavor: 'Turtle' },
      { date: '2026-02-25', normalized_flavor: 'turtle', flavor: 'Turtle' },
      { date: '2026-02-24', normalized_flavor: 'mint explosion', flavor: 'Mint Explosion' },
      { date: '2026-02-23', normalized_flavor: 'butter pecan', flavor: 'Butter Pecan' },
      { date: '2026-02-22', normalized_flavor: 'butter pecan', flavor: 'Butter Pecan' },
    ];

    const streaks = detectStreaks(history);
    expect(streaks).toHaveLength(2);
    expect(streaks[0].flavor).toBe('Turtle');
    expect(streaks[0].length).toBe(2);
    expect(streaks[1].flavor).toBe('Butter Pecan');
    expect(streaks[1].length).toBe(2);
  });

  it('returns empty for empty history', () => {
    expect(detectStreaks([])).toEqual([]);
  });
});
