for the custard.chriskaschner.com page, I want to ape/ rip off the references as much as possible.  I think having a site that follows that format (some motion, a horizontal list of companies that you work with, etc, lots of fancy marketing / pr words that don't say much)

I don't know how that fits into actually allowing a user to see that this site actually links to useful features (calendar, map, etc)

So I want the joke to land, but not at the expense of actually losing usability

* references

https://www.sas.com/en_us/solutions/ai.html
https://www.tableau.com/products/cloud-bi
https://www.datadoghq.com/
https://www.splunk.com/
https://www.mixmode.ai/
https://www.meetcarrot.com/weather/
a potentially bad comparison, but similar to what we're doing with the weather aspects https://www.accuweather.com/

---

## Resolved: utility wins on homepage, parody is seasoning not structure

The core disagreement was never "funny vs. serious." It was:
- **Homepage as brand theater** (SaaS parody-first, Datadog/Splunk visual language)
- **Homepage as decision surface** (weather-first utility, AccuWeather/Carrot Weather patterns)

For this product, utility wins on homepage. The parody still works, but as seasoning -- microcopy, optional below-fold moments, tone of voice -- not as page architecture.

### Audience split, resolved cleanly
- **End users** (homepage visitors) get instant value: today’s flavor, week ahead, quick actions.
- **Technical audience** (GitHub/README) gets the full enterprise satire zone.
- **Parody on homepage** is limited to word choice and personality, never structural gimmicks (no logo rails, no fake testimonials, no capability grids).

### References, reclassified

| Reference | Role in final design |
|-----------|---------------------|
| AccuWeather | **Primary structural model.** Location-first, forecast cards, scannable density. |
| Carrot Weather | **Primary personality model.** Humor inside utility, not instead of it. |
| Datadog/Splunk/Tableau/SAS/MixMode | **GitHub/README only.** Enterprise marketing patterns don’t serve homepage users. |

---

## PM sketch: weather-first flavor forecast homepage

### Product thesis

This is a forecast product. People check it the same way they check weather: "What’s happening at my store today/this week?" The homepage should answer that question in under 10 seconds, the same way weather.com shows you temperature before you even interact.

Personality lives in the copy and micro-interactions, not in the page structure. Carrot Weather’s lesson: be funny *inside* a genuinely useful interface, not funny *instead of* one.

### What we already have (and should preserve)
- Strong real utility already shipped: Calendar, Map, Alerts, Flavor Radar, Siri.
- In-flight roadmap: Radar Phase 2, Next Best Store, rarity/streak signals, weekly forecast email, Alexa.
- Current nav already links all core surfaces; redesign should not hide or bury those routes.
- Shared `style.css` and consistent header/nav pattern across all pages.

### UX goals translated into measurable outcomes
- `Goal A: Instant value` -> user sees today’s flavor for their store within 10 seconds of landing.
- `Goal B: Discovery` -> first-time users understand the full product surface (Calendar, Map, Alerts, Radar, Siri) without reading docs.
- `Goal C: Personality` -> the experience has warmth and character without blocking task completion.
- `Goal D: Cohesion with roadmap` -> homepage structure has natural slots for upcoming features.

Success metrics:
- Time to first flavor seen (target: <10s for returning users, <20s for new).
- Home -> any tool click-through rate (Calendar/Map/Alerts/Radar/Siri).
- Radar and Alerts adoption lift after redesign.
- Bounce rate on homepage.

### Information architecture

#### 1. Location bar (persistent, top of page)
- Weather-app pattern: location is the first thing you set, everything else flows from it.
- Store picker with geolocation "Nearby" button (we already have this UX in calendar page).
- Remembered via localStorage so returning users skip this step entirely.
- Shows store name + brand badge once set.

#### 2. Today’s forecast (hero section, above the fold)
- Large card showing today’s flavor for selected store.
- Flavor name, brief description, brand logo/color accent.
- "What’s scooping" energy -- warm, not corporate.
- If no store selected: friendly prompt to pick one, with "popular stores" quick-picks for WI (Mt. Horeb, Kopp’s Greenfield, etc.).

#### 3. Week ahead (horizontal scroll or 7-column strip)
- Today highlighted, tomorrow + next 5 days in a row.
- Confirmed days: solid cards with flavor names.
- Predicted days: styled differently (dashed border, confidence indicator, "forecast" label).
- Tapping any day routes to Radar with that date/store context.
- This is the AccuWeather 7-day forecast pattern adapted for custard.

#### 4. Quick actions strip
- 4-5 compact cards in a row, each one sentence + icon:
  - "Subscribe" -> Calendar page (get .ics feed)
  - "Explore the map" -> Map page (find nearby flavors)
  - "Get alerts" -> Alerts page (email when your flavor is coming)
  - "Ask Siri" -> Siri page (voice shortcut setup)
  - "Full radar" -> Radar page (7-day deep dive with favorites)
- These replace the current nav links with richer context about what each tool does.
- Must stay visible on mobile without scrolling past the fold.

#### 5. "Flavor spotlight" section (optional, below fold)
- Trending flavor this week across all stores.
- "Overdue at your store" -- flavors that haven’t appeared in a while (data we already have from analytics).
- "Nearby alternatives" -- if your store has a boring Tuesday, here’s who has Turtle.
- This section is the natural home for Radar Phase 2 features (Next Best Store, rarity badges).

#### 6. Footer
- Brand list (Culver’s, Kopp’s, Gille’s, Hefner’s, Kraverz, Oscar’s).
- Direct links to all 5 tool pages.
- "Not affiliated with any restaurant" disclaimer.
- GitHub link for the nerds who want to see the enterprise-voice README.

### Content strategy: weather voice, not SaaS voice

| Element | Voice | Example |
|---------|-------|---------|
| Headlines | Warm, clear, weather-metaphor | "Today’s flavor forecast" / "Your week ahead" / "What’s scooping near you" |
| Descriptions | Conversational, brief | "Turtle is trending across 14 stores this week" |
| CTAs | Direct, task-oriented | "Subscribe to your store" / "Set a flavor alert" |
| Micro-copy | Playful where natural | "Last updated 2 hours ago" / "Predictions get better closer to the day" |
| Error states | Friendly | "We couldn’t reach your store’s flavor data. Try again in a bit." |

**Rule: personality lives in word choice and tone, not in structural gimmicks.** No "enterprise nonsense mode" toggles, no parody logo bars, no fake testimonials. The page should feel like a well-made weather app that happens to track custard.

### How existing pages evolve

The homepage redesign changes the entry point, but existing pages stay mostly intact:

| Page | Current role | Post-redesign role | Changes needed |
|------|-------------|-------------------|----------------|
| `index.html` | Calendar store selector | **Homepage** (forecast dashboard) | Major rewrite: becomes the forecast landing page. Calendar subscription flow moves to a dedicated section or sub-route. |
| `map.html` | Custard map | Same | Minor: update nav, add "back to forecast" breadcrumb |
| `radar.html` | 7-day flavor radar | Same, but deeper | Minor: accept pre-filled store/date params from homepage links |
| `alerts.html` | Email alert signup | Same | Minor: update nav |
| `siri.html` | Siri shortcut setup | Same | Minor: update nav |
| NEW: `calendar.html` | -- | Dedicated calendar subscription page | Extract current index.html store selector + .ics flow here |

The biggest structural change: `index.html` stops being "the calendar page" and becomes "the homepage." The calendar subscription flow (store selector, .ics URL generation) moves to `calendar.html`. All existing deep links to `index.html` for calendar purposes should still work (redirect or preserve both flows).

### Cohesive roadmap alignment

| Upcoming feature (from TODO.md) | Homepage slot | How it fits |
|--------------------------------|---------------|-------------|
| **Radar Phase 2** (Next Best Store, rarity badges) | Section 5: Flavor Spotlight | "Nearby alternatives" card becomes Next Best Store. Rarity badges appear on flavor names. |
| **Forecast accuracy tracking** | Section 3: Week Ahead | Confidence indicators on predicted days get more precise as accuracy data accumulates. |
| **Weekly forecast email** | Section 4: Quick Actions | "Get the weekly forecast" becomes a 6th action card. |
| **Alexa skill** | Section 4: Quick Actions | "Ask Alexa" joins "Ask Siri" as a voice action card. |
| **Pairwise flavor voting** | Section 5: Flavor Spotlight | "Where should we go tonight?" could become a group-decision feature card. |

### Phased implementation

#### Phase 1: New homepage structure
- Create `calendar.html` by extracting current `index.html` store selector + .ics generation.
- Rebuild `index.html` as forecast homepage: location bar + today’s flavor + week-ahead strip + quick actions.
- Wire location bar to `/api/v1/flavors` and `/api/v1/forecast/{slug}`.
- Update nav across all pages.
- Preserve all existing functionality -- this is rearrangement, not deletion.

#### Phase 2: Polish and density
- Add "flavor spotlight" section with trending/overdue data (requires D1 metrics queries).
- Style confirmed vs. predicted days differently in week-ahead strip.
- Add localStorage persistence for selected store.
- Smooth scroll-reveal animations (subtle, Carrot-Weather-level, not Datadog-level).

#### Phase 3: Roadmap feature hooks
- Wire Next Best Store into spotlight section.
- Add rarity/streak badges to flavor names.
- Add weekly email signup card.
- Alexa card (when skill ships).

### Visual direction

- **Not dark mode.** Weather apps are generally light -- readability and scannability matter more than atmosphere. Current light background (`#fafafa`) is fine.
- **Brand color accents.** Use each brand’s color as an accent on their flavor cards (Culver’s blue, Kopp’s red, etc.).
- **Cards, not grids.** Rounded cards with subtle shadows, not flat bento grids. Weather-app energy.
- **Responsive-first.** Most users will check this on their phone. The 7-day strip should horizontal-scroll on mobile.
- **Minimal JS.** The current pages are lightweight. Don’t add a framework -- vanilla JS + CSS transitions are enough.

### Guardrails
- Every section must have a direct action (no dead-end decorative blocks).
- No motion that delays interaction readiness.
- Mobile-first: quick actions must be reachable without scrolling past the fold.
- Page weight budget: no heavy decorative JS, no framework, no build step.
- Keep legal clarity: not affiliated with any restaurant.

### Locked decisions

1. **Single-store first, with easy switcher.** Show one store by default for clarity and speed. Add "compare/backup stores" as a secondary control after first render. Don't crowd the hero with multiple stores.

2. **Calendar CTA is prominent but not dominant.** Calendar stays as the first or second card in quick actions. The hero answers "what's today?" -- it no longer exists to push calendar subscriptions. The dedicated `calendar.html` page handles that flow.

3. **Live API calls, static fallback only if needed.** Homepage calls `/api/v1/flavors` + `/api/v1/forecast/{slug}` live with the localStorage-selected slug. Add static fallback only if latency or availability becomes an issue in practice.

4. **Freshness timestamp: yes.** "Last updated X ago" near today card and week strip. Cheap trust infrastructure with high upside. Builds confidence that data is current without requiring any explanation.
