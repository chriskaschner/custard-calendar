# M002: Sharpen the Core

**Vision:** Custard Calendar tracks daily "Flavor of the Day" schedules across 1,000+ frozen custard stores -- primarily Culver's nationwide, plus Milwaukee-area independents (Kopp's, Gille's, Hefner's, Kraverz, Oscar's).

## Success Criteria


## Slices

- [x] **S01: Housekeeping Closure** `risk:medium` `depends:[]`
  > After this: Triage every open item in TODO.
- [x] **S02: Homepage Redesign** `risk:medium` `depends:[S01]`
  > After this: Redesign the homepage hero card to be a complete decision-making unit (flavor + rarity + action CTAs + store meta) and the only content above the fold.
- [x] **S04: Performance** `risk:medium` `depends:[S02]`
  > After this: Eliminate the Worker API dependency from the homepage critical rendering path so returning users see today's flavor instantly from cache, with background refresh.
- [x] **S06: Bug Fixes — Store Disambiguation, Rarity, Art, Signals** `risk:medium` `depends:[S04]`
  > After this: 7 user-reported bugs fixed across Compare, Today, Widget, and Worker surfaces. Store names disambiguated, rarity false positives eliminated, Week Ahead shows L5 PNGs.
- [ ] **S05: Social Sharing** `risk:medium` `depends:[S06]`
  > After this: Add PNG OG card generation for quiz results and flavor rarity stats, plus Worker-level crawler interception for shared URLs.
- [ ] **S03: Page Consolidation** `risk:medium` `depends:[S05]`
  > After this: Zero-traffic pages consolidated or redirected; navigation reflects reduced page count.
