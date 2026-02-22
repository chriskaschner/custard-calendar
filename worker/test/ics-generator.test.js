import { describe, it, expect } from 'vitest';
import { generateIcs } from '../src/ics-generator.js';

// Fixture data for tests
const PRIMARY_STORE = { slug: 'mt-horeb', name: 'Mt. Horeb', address: '1700 Springdale St, Mt. Horeb, WI', role: 'primary' };
const SECONDARY_STORE_1 = { slug: 'madison-todd-drive', name: 'Madison Todd Dr', role: 'secondary' };
const SECONDARY_STORE_2 = { slug: 'middleton', name: 'Middleton', role: 'secondary' };
const SECONDARY_STORE_3 = { slug: 'verona', name: 'Verona', role: 'secondary' };

const FLAVORS_BY_SLUG = {
  'mt-horeb': [
    { date: '2026-02-20', title: 'Dark Chocolate PB Crunch', description: 'Dark Chocolate Fresh Frozen Custard with peanut butter.' },
    { date: '2026-02-21', title: 'Chocolate Caramel Twist', description: 'Chocolate and Vanilla with salted caramel.' },
    { date: '2026-02-22', title: 'Mint Explosion', description: 'Mint Fresh Frozen Custard with OREO pieces.' },
  ],
  'madison-todd-drive': [
    { date: '2026-02-20', title: 'Chocolate Volcano', description: 'Chocolate custard with fudge.' },
    { date: '2026-02-21', title: 'Butter Pecan', description: 'Butter Pecan custard.' },
    { date: '2026-02-22', title: 'Vanilla Bean', description: 'Vanilla Bean custard.' },
  ],
  'middleton': [
    { date: '2026-02-20', title: 'Andes Mint Avalanche', description: 'Mint with Andes candies.' },
    { date: '2026-02-21', title: 'Caramel Cashew', description: 'Caramel with cashews.' },
    { date: '2026-02-22', title: 'Cookie Dough Craving', description: 'Cookie dough custard.' },
  ],
  'verona': [
    { date: '2026-02-20', title: 'Turtle', description: 'Vanilla with caramel and pecans.' },
    { date: '2026-02-21', title: 'Crazy for Cookie Dough', description: 'Cookie dough lovers.' },
    { date: '2026-02-22', title: 'Salted Caramel Pecan Pie', description: 'Salted caramel pie.' },
  ],
};

function makeOpts({ stores, flavorsBySlug, calendarName } = {}) {
  return {
    calendarName: calendarName || "Culver's FOTD - Mt. Horeb",
    stores: stores || [PRIMARY_STORE],
    flavorsBySlug: flavorsBySlug || { 'mt-horeb': FLAVORS_BY_SLUG['mt-horeb'] },
  };
}

describe('generateIcs', () => {
  it('1: generates a valid VCALENDAR wrapper', () => {
    const ics = generateIcs(makeOpts());
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('METHOD:PUBLISH');
    expect(ics).toContain('CALSCALE:GREGORIAN');
    expect(ics).toContain('PRODID:');
  });

  it('2: includes calendar name property', () => {
    const ics = generateIcs(makeOpts({ calendarName: "Culver's FOTD - Mt. Horeb" }));
    expect(ics).toContain("X-WR-CALNAME:Culver's FOTD - Mt. Horeb");
  });

  it('3: uses all-day event format with VALUE=DATE', () => {
    const ics = generateIcs(makeOpts());
    expect(ics).toContain('DTSTART;VALUE=DATE:20260220');
    expect(ics).toContain('DTEND;VALUE=DATE:20260221');
    // Should NOT contain time components
    expect(ics).not.toMatch(/DTSTART;VALUE=DATE:\d{8}T/);
  });

  it('4: sets TRANSP:TRANSPARENT on all events', () => {
    const ics = generateIcs(makeOpts());
    const eventBlocks = ics.split('BEGIN:VEVENT').slice(1);
    expect(eventBlocks.length).toBeGreaterThan(0);
    for (const block of eventBlocks) {
      expect(block).toContain('TRANSP:TRANSPARENT');
    }
  });

  it('5: contains no VALARM components', () => {
    const ics = generateIcs(makeOpts({
      stores: [PRIMARY_STORE, SECONDARY_STORE_1, SECONDARY_STORE_2, SECONDARY_STORE_3],
      flavorsBySlug: FLAVORS_BY_SLUG,
    }));
    expect(ics).not.toContain('VALARM');
  });

  it('6: puts primary flavor in SUMMARY with ice cream emoji', () => {
    const ics = generateIcs(makeOpts());
    expect(ics).toContain('SUMMARY:🍦 Dark Chocolate PB Crunch');
  });

  it('7: puts secondary flavor in DESCRIPTION with backup format', () => {
    const ics = generateIcs(makeOpts({
      stores: [PRIMARY_STORE, SECONDARY_STORE_1],
      flavorsBySlug: {
        'mt-horeb': FLAVORS_BY_SLUG['mt-horeb'],
        'madison-todd-drive': FLAVORS_BY_SLUG['madison-todd-drive'],
      },
    }));

    // Unfold .ics line folding before checking content
    const unfolded = ics.replace(/\r\n[ \t]/g, '');
    expect(unfolded).toContain('Backup Option');
    expect(unfolded).toContain('🍨: Chocolate Volcano - Madison Todd Dr');
  });

  it('8: lists all 3 secondary stores as backup options', () => {
    const ics = generateIcs(makeOpts({
      stores: [PRIMARY_STORE, SECONDARY_STORE_1, SECONDARY_STORE_2, SECONDARY_STORE_3],
      flavorsBySlug: FLAVORS_BY_SLUG,
    }));

    const unfolded = ics.replace(/\r\n[ \t]/g, '');
    // Check all three backup stores appear with alternating emoji
    expect(unfolded).toContain('🍨: Chocolate Volcano - Madison Todd Dr');
    expect(unfolded).toContain('🍦: Andes Mint Avalanche - Middleton');
    expect(unfolded).toContain('🍨: Turtle - Verona');
  });

  it('9: generates deterministic UIDs', () => {
    const opts = makeOpts();
    const ics1 = generateIcs(opts);
    const ics2 = generateIcs(opts);

    const getUIDs = (ics) => [...ics.matchAll(/UID:(.*)/g)].map(m => m[1]);
    expect(getUIDs(ics1)).toEqual(getUIDs(ics2));
    expect(getUIDs(ics1).length).toBeGreaterThan(0);
  });

  it('10: folds lines longer than 75 octets', () => {
    // Use a flavor with a very long description to trigger folding
    const longDesc = 'A'.repeat(200);
    const ics = generateIcs(makeOpts({
      flavorsBySlug: {
        'mt-horeb': [
          { date: '2026-02-20', title: 'Test Flavor', description: longDesc },
        ],
      },
    }));

    // Split into raw lines (CRLF-separated)
    const lines = ics.split('\r\n');
    for (const line of lines) {
      // Each line should be at most 75 octets
      const byteLength = new TextEncoder().encode(line).length;
      expect(byteLength).toBeLessThanOrEqual(75);
    }
  });

  it('11: includes emoji characters in UTF-8', () => {
    const ics = generateIcs(makeOpts({
      stores: [PRIMARY_STORE, SECONDARY_STORE_1],
      flavorsBySlug: {
        'mt-horeb': FLAVORS_BY_SLUG['mt-horeb'],
        'madison-todd-drive': FLAVORS_BY_SLUG['madison-todd-drive'],
      },
    }));

    const unfolded = ics.replace(/\r\n[ \t]/g, '');
    expect(unfolded).toContain('🍦');
    expect(unfolded).toContain('🍨');
  });

  it('12: includes REFRESH-INTERVAL property', () => {
    const ics = generateIcs(makeOpts());
    expect(ics).toContain('REFRESH-INTERVAL;VALUE=DURATION:PT12H');
  });

  it('13: returns valid empty calendar when no flavors', () => {
    const ics = generateIcs(makeOpts({
      flavorsBySlug: { 'mt-horeb': [] },
    }));

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).not.toContain('BEGIN:VEVENT');
  });

  it('14: DTSTAMP is deterministic (derived from event date)', () => {
    const opts = makeOpts();
    const ics1 = generateIcs(opts);
    const ics2 = generateIcs(opts);

    // Both calls should produce identical output
    expect(ics1).toBe(ics2);

    // DTSTAMP should be based on event date, not wall clock
    expect(ics1).toContain('DTSTAMP:20260220T120000Z');
    expect(ics1).toContain('DTSTAMP:20260221T120000Z');
    expect(ics1).toContain('DTSTAMP:20260222T120000Z');
  });
});
