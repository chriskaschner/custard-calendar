# Masterlock Pixel Prompt Pack

Auto-generated from:
- worker/src/flavor-colors.js
- docs/flavors.json

Regenerate:
```bash
node tools/generate_masterlock_prompts.mjs
```

## Locked Template

```text
Pixel art ice cream cone, centered composition, single scoop, 1:1 aspect ratio.

Quality target:
Choose one tier from the complexity ladder: [L0 | L1 | L2 | L3 | L4 | L5]
Do not blend tiers in a single render.

Style:
Highly detailed modern pixel art, crisp edges, 32-64px style density, smooth but still clearly pixel-based.
Not vector. Not painterly. Not photorealistic. No blur.

Lighting:
Soft studio lighting from upper left.
Gentle highlight across scoop.
Subtle shadow under scoop lip.
No harsh reflections.

Background:
Solid deep brown-black background (#140c06 tone).
No gradients.
No texture.
No logo.
No text.

Cone:
Golden waffle cone with checker pattern.
Warm orange + honey tones.
NO darkened tip.
Tip same tone as rest of cone.
Cone slightly higher resolution than scoop.

Scoop:
Ingredients must be clearly readable.
Distinct chunks and swirls.
Visible texture depth.
Balanced distribution.

Flavor: [FLAVOR NAME]

Description:
[Official Culver's description]

Ingredient treatment:
- Base custard color:
- Swirls:
- Chunk inclusions:
- Texture notes:
```

## Complexity Ladder

Use this ladder to scale from left-side map/Tidbyt simplicity up to premium Blackberry-style detail.

| Tier | Name | App surface | Density | Guidance |
| --- | --- | --- | --- | --- |
| L0 | Tidbyt Micro | Tidbyt forecast columns | 9x11 | Extreme simplification. Keep a clean cone silhouette, no anti-aliasing, and 0-3 readable inclusions. |
| L1 | Map Marker Micro | Map marker cone icon | 9x11 in pin | Same geometry as L0 with slightly boosted contrast for map legibility. |
| L2 | Widget Mini | Widget and inline mini cone | 9x11 scaled | Allow mild highlight and up to 4 inclusions while preserving hard pixel edges. |
| L3 | Radar HD | Radar cards | 18x21 | Use HD slot layout, visible ribbon curve, and clearly separated ingredient colors. |
| L4 | Hero/OG Pixel | Hero and OG cone render | 36x42 | Use hero slot layout with specular highlight, edge shadow, and strong ingredient readability. |
| L5 | Premium Showcase | Marketing or hero reference art | 32-64px style density | Highest detail while still pixel art: visible marbling, realistic chunk forms, and crisp per-pixel depth. |

## Flavor Fill Cards (94)

## Andes Mint Avalanche

Description: Mint Fresh Frozen Custard with Andes Mint pieces and chocolate.

Flavor fill:
```text
Flavor: Andes Mint Avalanche

Description:
Mint Fresh Frozen Custard with Andes Mint pieces and chocolate.

Ingredient treatment:
- Base custard color: Andes mint custard (#1A8A4A).
- Swirls: None.
- Chunk inclusions: Andes mint pieces x2 (#0A3726); Dark chocolate chunks x1 (#2B1A12)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated.
```

Canonical profile:
- Base key: `mint_andes`
- Ribbon key: `none`
- Toppings: `andes, andes, dove`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Deep forest-green mint custard with cool undertones (#1A8A4A with brighter #2ECC71 highlights at scoop crown).
- Swirls: None -- pure Andes mint base with flecks of green and chocolate visible through the body.
- Chunk inclusions: Bright Andes mint pieces with green-white layered striping and crisp fracture edges (#0A3726); dark chocolate chunks with matte cocoa finish and irregular broken shapes (#2B1A12).
- Texture notes: Standard inclusion depth with mint pieces and chocolate chunks clearly separated. Green Andes pieces catch light differently than dark chocolate for strong two-tone contrast.
```

---

## Badger Claw

Description: Vanilla Fresh Frozen Custard with caramel, cashew pieces, and fudge bits.

Flavor fill:
```text
Flavor: Badger Claw

Description:
Vanilla Fresh Frozen Custard with caramel, cashew pieces, and fudge bits.

Ingredient treatment:
- Base custard color: Vanilla custard (#F5DEB3).
- Swirls: Caramel ribbon (#D38B2C).
- Chunk inclusions: Cashew pieces x1 (#897E6C); fudge_bits x1 (#1C0B00)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `vanilla`
- Ribbon key: `caramel`
- Toppings: `cashew, fudge_bits`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm vanilla custard with golden warmth (#F5DEB3 with slightly deeper #EDD9A3 shadows).
- Swirls: Glossy amber caramel ribbons winding through the scoop with translucent golden edges (#D38B2C).
- Chunk inclusions: Pale cashew pieces with smooth ivory surfaces and natural curve shapes (#897E6C); tiny near-black fudge bits scattered as accent specks (#1C0B00).
- Texture notes: Balanced inclusion spread with caramel ribbon weaving between cashew and fudge. Cashew catches warm highlights while fudge bits add dark contrast points.
```

---

## Bailey'S Irish Cream

Description: Vanilla Fresh Frozen Custard swirled with chocolate syrup in a smooth Irish cream style.

Flavor fill:
```text
Flavor: Bailey'S Irish Cream

Description:
Vanilla Fresh Frozen Custard swirled with chocolate syrup in a smooth Irish cream style.

Ingredient treatment:
- Base custard color: Vanilla custard (#F5DEB3).
- Swirls: Chocolate syrup ribbon (#1A0A00).
- Chunk inclusions: None (clean scoop with no chunk inclusions).
- Texture notes: Smooth scoop with low inclusion noise. Keep texture subtle and creamy. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `vanilla`
- Ribbon key: `chocolate_syrup`
- Toppings: `none`
- Density: `pure`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Creamy vanilla custard with warm ivory depth (#F5DEB3 with subtle cream-gold undertones).
- Swirls: Dark chocolate syrup ribbons with near-black glossy sheen tracing through the scoop (#1A0A00).
- Chunk inclusions: None -- pure base with chocolate syrup ribbon detail only.
- Texture notes: Smooth scoop with low inclusion noise. Chocolate syrup ribbons create elegant dark contrast lines against the pale vanilla body. Subtle cream gradients suggest richness.
```

---

## Banana Cream Pie

Description: Banana Fresh Frozen Custard with graham cracker crumbles and cookie crumbs.

Flavor fill:
```text
Flavor: Banana Cream Pie

Description:
Banana Fresh Frozen Custard with graham cracker crumbles and cookie crumbs.

Ingredient treatment:
- Base custard color: banana (#F0E68C).
- Swirls: None.
- Chunk inclusions: graham_cracker x1 (#8B6914); cookie_crumbs x1 (#7B5B32)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated.
```

Canonical profile:
- Base key: `banana`
- Ribbon key: `none`
- Toppings: `graham_cracker, cookie_crumbs`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Pale yellow banana custard with warm golden tones (#F0E68C with slightly deeper #E8DE7A in shadows).
- Swirls: None -- pure banana base with custard body gradients only.
- Chunk inclusions: Golden graham cracker crumbles with toasty amber edges and granular texture (#8B6914); darker sandy cookie crumbs scattered as fine accent particles (#7B5B32).
- Texture notes: Balanced texture with graham cracker and cookie crumb pieces evenly distributed. Graham pieces are larger and flatter while cookie crumbs fill gaps with fine granular detail.
```

---

## Blackberry Cobbler

Description: Blackberry Fresh Frozen Custard with pie crust pieces.

Flavor fill:
```text
Flavor: Blackberry Cobbler

Description:
Blackberry Fresh Frozen Custard with pie crust pieces.

Ingredient treatment:
- Base custard color: Blackberry custard (#6B3FA0).
- Swirls: None.
- Chunk inclusions: Pie crust pieces x3 (#C99E76)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated.
```

Canonical profile:
- Base key: `blackberry`
- Ribbon key: `none`
- Toppings: `pie_crust, pie_crust, pie_crust`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Creamy vanilla-white custard with blackberry marbling (#F5DEB3 mixed with deep blackberry tones #6B3FA0).
- Swirls: Deep purple blackberry sauce ribbons with visible marbling through the scoop.
- Chunk inclusions: Whole blackberries with clustered drupelet shape and glossy deep-purple highlights; pie crust pieces as irregular golden crumbles with slightly toasted edges.
- Texture notes: Visible sauce marbling, balanced chunk placement, and clear depth between berries, sauce, and custard body.
```

---

## Blue Moon

Description: Blue Moon Fresh Frozen Custard with a bright fruity-vanilla flavor.

Flavor fill:
```text
Flavor: Blue Moon

Description:
Blue Moon Fresh Frozen Custard with a bright fruity-vanilla flavor.

Ingredient treatment:
- Base custard color: blue_moon (#5B9BD5).
- Swirls: None.
- Chunk inclusions: None (clean scoop with no chunk inclusions).
- Texture notes: Smooth scoop with low inclusion noise. Keep texture subtle and creamy.
```

Canonical profile:
- Base key: `blue_moon`
- Ribbon key: `none`
- Toppings: `none`
- Density: `pure`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Bright periwinkle-blue custard with gentle cyan highlights (#5B9BD5 with lighter #7BB3E5 at scoop crown).
- Swirls: None -- pure blue moon base with subtle color depth variations.
- Chunk inclusions: None -- clean scoop with no inclusions.
- Texture notes: Smooth scoop with low inclusion noise. Emphasize the unique blue color with gentle gradients from deeper periwinkle at the base to brighter sky-blue highlights at the crown. Creamy surface with soft light reflections.
```

---

## Bonfire S'Mores

Description: Chocolate Fresh Frozen Custard with marshmallow swirl and graham cracker pieces.

Flavor fill:
```text
Flavor: Bonfire S'Mores

Description:
Chocolate Fresh Frozen Custard with marshmallow swirl and graham cracker pieces.

Ingredient treatment:
- Base custard color: Chocolate custard (#6F4E37).
- Swirls: Marshmallow swirl (#FFFFFF).
- Chunk inclusions: graham_cracker x1 (#8B6914)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `chocolate`
- Ribbon key: `marshmallow`
- Toppings: `graham_cracker`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Rich chocolate custard with warm cocoa depth (#6F4E37 with darker #5A3E2A undertones).
- Swirls: Bright white marshmallow swirl with fluffy pulled-taffy texture winding through the chocolate (#FFFFFF).
- Chunk inclusions: Golden graham cracker crumbles with toasty amber surfaces and irregular snap-break edges (#8B6914).
- Texture notes: Balanced depth with marshmallow swirl creating bright white paths through dark chocolate. Graham cracker pieces sit at the surface with warm golden contrast against both chocolate and marshmallow.
```

---

## Boston Cream

Description: Vanilla Fresh Frozen Custard with chocolate syrup and chocolate cake pieces.

Flavor fill:
```text
Flavor: Boston Cream

Description:
Vanilla Fresh Frozen Custard with chocolate syrup and chocolate cake pieces.

Ingredient treatment:
- Base custard color: Vanilla custard (#F5DEB3).
- Swirls: Chocolate syrup ribbon (#1A0A00).
- Chunk inclusions: Chocolate cake chunks x1 (#4A2800)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `vanilla`
- Ribbon key: `chocolate_syrup`
- Toppings: `cake`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm vanilla custard with creamy wheat tones (#F5DEB3 with golden #EDD9A3 highlights).
- Swirls: Dark chocolate syrup ribbons with glossy near-black sheen draping across the scoop (#1A0A00).
- Chunk inclusions: Deep brown chocolate cake chunks with moist matte surfaces and soft crumble edges (#4A2800).
- Texture notes: Balanced inclusion spread with chocolate syrup ribbon weaving between cake chunks. Dark syrup and dark cake create layered depth against the pale vanilla base.
```

---

## Brownie Batter Overload

Description: Chocolate Fresh Frozen Custard overloaded with brownie batter chunks.

Flavor fill:
```text
Flavor: Brownie Batter Overload

Description:
Chocolate Fresh Frozen Custard overloaded with brownie batter chunks.

Ingredient treatment:
- Base custard color: Chocolate custard (#6F4E37).
- Swirls: None.
- Chunk inclusions: Brownie chunks x1 (#ADA59C)
- Texture notes: Very dense single-ingredient distribution across the scoop surface.
```

Canonical profile:
- Base key: `chocolate`
- Ribbon key: `none`
- Toppings: `brownie`
- Density: `overload`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Rich chocolate custard with warm brown depth (#6F4E37 with #5A3E2A shadow tones).
- Swirls: None -- pure chocolate base saturated with brownie pieces.
- Chunk inclusions: Dense field of brownie chunks with moist, fudgy interiors and slightly cracked outer edges. Contrast-adjusted pale-cocoa surface (#ADA59C) against chocolate base.
- Texture notes: Very dense single-ingredient distribution across the scoop surface. Brownie pieces overlap and crowd the scoop, creating a heavily loaded appearance with minimal exposed custard.
```

---

## Brownie Explosion

Description: Chocolate Fresh Frozen Custard with marshmallow, brownie chunks, and dark chocolate pieces.

Flavor fill:
```text
Flavor: Brownie Explosion

Description:
Chocolate Fresh Frozen Custard with marshmallow, brownie chunks, and dark chocolate pieces.

Ingredient treatment:
- Base custard color: Chocolate custard (#6F4E37).
- Swirls: Marshmallow swirl (#FFFFFF).
- Chunk inclusions: Brownie chunks x2 (#ADA59C); Dark chocolate chunks x1 (#2B1A12)
- Texture notes: Dense inclusion field with layered depth while keeping each ingredient readable. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `chocolate`
- Ribbon key: `marshmallow`
- Toppings: `brownie, brownie, dove`
- Density: `explosion`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Rich chocolate custard with warm cocoa tones (#6F4E37 with deeper #5C3E2B undertones).
- Swirls: Bright white marshmallow swirl with soft pulled texture cutting through chocolate (#FFFFFF).
- Chunk inclusions: Fudgy brownie chunks with moist interiors and cracked edges (#ADA59C); dark chocolate pieces with glossy broken-bar facets (#2B1A12).
- Texture notes: Dense inclusion field with layered depth. Brownie and chocolate chunks compete for space while marshmallow swirl weaves between them. Each ingredient readable despite the packed composition.
```

---

## Brownie Thunder

Description: Chocolate Fresh Frozen Custard with brownie pieces and marshmallow.

Flavor fill:
```text
Flavor: Brownie Thunder

Description:
Chocolate Fresh Frozen Custard with brownie pieces and marshmallow.

Ingredient treatment:
- Base custard color: Chocolate custard (#6F4E37).
- Swirls: Marshmallow swirl (#FFFFFF).
- Chunk inclusions: Brownie chunks x2 (#ADA59C); Dark chocolate chunks x1 (#2B1A12)
- Texture notes: Dense inclusion field with layered depth while keeping each ingredient readable. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `chocolate`
- Ribbon key: `marshmallow`
- Toppings: `brownie, dove, brownie`
- Density: `explosion`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Rich chocolate custard with deep cocoa warmth (#6F4E37 with #5A3825 darker zones).
- Swirls: Bright white marshmallow swirl with fluffy pulled texture threading through the chocolate (#FFFFFF).
- Chunk inclusions: Fudgy brownie chunks with moist cracked surfaces (#ADA59C); dark chocolate pieces with glossy facets (#2B1A12); additional brownie chunks layered for double-brownie density.
- Texture notes: Dense inclusion field with layered depth. Marshmallow swirl creates bright paths between dark brownie and chocolate chunks. Multiple brownie sizes create visual depth.
```

---

## Burgundy Cherry

Description: Cherry Fresh Frozen Custard with cherry pieces.

Flavor fill:
```text
Flavor: Burgundy Cherry

Description:
Cherry Fresh Frozen Custard with cherry pieces.

Ingredient treatment:
- Base custard color: cherry (#C41E3A).
- Swirls: None.
- Chunk inclusions: cherry_bits x1 (#8B0000)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated.
```

Canonical profile:
- Base key: `cherry`
- Ribbon key: `none`
- Toppings: `cherry_bits`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Bright cherry-red custard with deep crimson undertones (#C41E3A with darker #A01830 shadows).
- Swirls: None -- pure cherry base with fruit-body color gradients.
- Chunk inclusions: Dark cherry pieces with deep burgundy-red surfaces and glistening wet highlights (#8B0000).
- Texture notes: Standard inclusion depth with cherry pieces distributed evenly. Dark cherry chunks create subtle depth against the bright cherry base. Fruit pieces have natural irregular shapes.
```

---

## Butter Brickle

Description: Butter Pecan Fresh Frozen Custard with Heath toffee bits.

Flavor fill:
```text
Flavor: Butter Brickle

Description:
Butter Pecan Fresh Frozen Custard with Heath toffee bits.

Ingredient treatment:
- Base custard color: Butter pecan custard (#F2E7D1).
- Swirls: None.
- Chunk inclusions: Heath toffee bits x1 (#DAA520)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated.
```

Canonical profile:
- Base key: `butter_pecan`
- Ribbon key: `none`
- Toppings: `heath`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm butter pecan custard with toasty cream tones (#F2E7D1 with slightly golden #E8DCC4 shadows).
- Swirls: None -- pure butter pecan base with warm custard body.
- Chunk inclusions: Golden Heath toffee bits with amber crystalline edges and glossy caramel sheen (#DAA520).
- Texture notes: Standard inclusion depth with toffee bits spread evenly. Heath pieces catch warm light with their golden surfaces, creating sparkle points against the pale butter pecan base.
```

---

## Butter Finger Blast

Description: Vanilla Fresh Frozen Custard packed with Butterfinger crunch pieces.

Flavor fill:
```text
Flavor: Butter Finger Blast

Description:
Vanilla Fresh Frozen Custard packed with Butterfinger crunch pieces.

Ingredient treatment:
- Base custard color: Vanilla custard (#F5DEB3).
- Swirls: None.
- Chunk inclusions: Butterfinger crunch bits x1 (#E6A817)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated.
```

Canonical profile:
- Base key: `vanilla`
- Ribbon key: `none`
- Toppings: `butterfinger`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm vanilla custard with creamy wheat tones (#F5DEB3 with #EDD9A3 gentle shadows).
- Swirls: None -- pure vanilla base with Butterfinger pieces throughout.
- Chunk inclusions: Bright golden Butterfinger crunch pieces with flaky layered texture and vivid amber-orange surfaces (#E6A817).
- Texture notes: Standard inclusion depth with Butterfinger pieces evenly spread. Golden crunch bits stand out boldly against the pale vanilla base with strong warm-tone contrast.
```

---

## Butter Pecan

Description: Butter Pecan Fresh Frozen Custard.

Flavor fill:
```text
Flavor: Butter Pecan

Description:
Butter Pecan Fresh Frozen Custard.

Ingredient treatment:
- Base custard color: Butter pecan custard (#F2E7D1).
- Swirls: None.
- Chunk inclusions: Pecan pieces x1 (#8B5A2B)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated.
```

Canonical profile:
- Base key: `butter_pecan`
- Ribbon key: `none`
- Toppings: `pecan`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm butter pecan custard with toasty cream-gold tones (#F2E7D1 with deeper #E5D5BE in scoop shadows).
- Swirls: None -- pure butter pecan base with warm custard gradients.
- Chunk inclusions: Rich brown pecan pieces with natural wood-grain texture and warm saddle-brown surfaces (#8B5A2B).
- Texture notes: Standard inclusion depth with pecan pieces distributed naturally. Pecans create warm brown contrast against the pale cream base. Natural piece shapes suggest hand-broken halves.
```

---

## Butterfinger Pecan

Description: Vanilla Fresh Frozen Custard with Butterfinger crunch pieces and pecans.

Flavor fill:
```text
Flavor: Butterfinger Pecan

Description:
Vanilla Fresh Frozen Custard with Butterfinger crunch pieces and pecans.

Ingredient treatment:
- Base custard color: Vanilla custard (#F5DEB3).
- Swirls: None.
- Chunk inclusions: Butterfinger crunch bits x1 (#E6A817); Pecan pieces x1 (#8B5A2B)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated.
```

Canonical profile:
- Base key: `vanilla`
- Ribbon key: `none`
- Toppings: `butterfinger, pecan`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm vanilla custard with creamy wheat highlights (#F5DEB3 with golden #EDD9A3 undertones).
- Swirls: None -- pure vanilla base with two-ingredient inclusion field.
- Chunk inclusions: Bright golden Butterfinger crunch pieces with flaky layered texture (#E6A817); rich brown pecan pieces with natural wood-grain surfaces (#8B5A2B).
- Texture notes: Balanced two-ingredient spread with golden Butterfinger and brown pecan pieces clearly separated. Color contrast between bright amber and dark wood tones makes each ingredient readable.
```

---

## Cappuccino Almond Fudge

Description: Espresso Fresh Frozen Custard with fudge swirl and cashew pieces.

Flavor fill:
```text
Flavor: Cappuccino Almond Fudge

Description:
Espresso Fresh Frozen Custard with fudge swirl and cashew pieces.

Ingredient treatment:
- Base custard color: espresso (#2C1503).
- Swirls: Fudge ribbon (#3B1F0B).
- Chunk inclusions: Cashew pieces x1 (#897E6C)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `espresso`
- Ribbon key: `fudge`
- Toppings: `cashew`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Dark espresso custard with deep coffee-brown depth (#2C1503 with warm #3A2010 highlights at scoop crown).
- Swirls: Near-black fudge ribbon with matte chocolate depth winding through the espresso base (#3B1F0B).
- Chunk inclusions: Pale ivory cashew pieces with smooth natural surfaces and warm cream highlights (#897E6C).
- Texture notes: Balanced depth with fudge ribbon visible against espresso base through slight sheen difference. Pale cashew pieces pop brightly against the dark coffee-chocolate body.
```

---

## Cappuccino Cookie Crumble

Description: Espresso Fresh Frozen Custard with cookie crumbles.

Flavor fill:
```text
Flavor: Cappuccino Cookie Crumble

Description:
Espresso Fresh Frozen Custard with cookie crumbles.

Ingredient treatment:
- Base custard color: espresso (#2C1503).
- Swirls: None.
- Chunk inclusions: cookie_crumbs x1 (#7B5B32)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated.
```

Canonical profile:
- Base key: `espresso`
- Ribbon key: `none`
- Toppings: `cookie_crumbs`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Dark espresso custard with rich coffee-brown tones (#2C1503 with #3A2010 subtle warmth).
- Swirls: None -- pure espresso base with cookie crumble inclusions.
- Chunk inclusions: Dark sandy cookie crumbles with granular texture and warm toasted surfaces (#7B5B32).
- Texture notes: Standard inclusion depth with cookie crumbles spread evenly. Crumbles are slightly lighter than the espresso base, creating subtle warm contrast with fine granular texture.
```

---

## Caramel Cashew

Description: Vanilla Fresh Frozen Custard with caramel and cashew pieces.

Flavor fill:
```text
Flavor: Caramel Cashew

Description:
Vanilla Fresh Frozen Custard with caramel and cashew pieces.

Ingredient treatment:
- Base custard color: Vanilla custard (#F5DEB3).
- Swirls: Caramel ribbon (#D38B2C).
- Chunk inclusions: Cashew pieces x1 (#897E6C)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `vanilla`
- Ribbon key: `caramel`
- Toppings: `cashew`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm vanilla custard with creamy wheat tones (#F5DEB3 with golden #EDD9A3 shadows).
- Swirls: Glossy amber caramel ribbon with translucent golden edges winding through the scoop (#D38B2C).
- Chunk inclusions: Smooth ivory cashew pieces with pale cream surfaces and natural curved shapes (#897E6C).
- Texture notes: Balanced spread with caramel ribbon creating golden paths between scattered cashew pieces. Cashew surfaces catch warm highlights from the caramel ribbon nearby.
```

---

## Caramel Chocolate Pecan

Description: Delicious Chocolate Fresh Frozen Custard enhanced with ribbons of old fashioned salted caramel, toasted pecan pieces and chopped Dove Chocolate pieces.

Flavor fill:
```text
Flavor: Caramel Chocolate Pecan

Description:
Delicious Chocolate Fresh Frozen Custard enhanced with ribbons of old fashioned salted caramel, toasted pecan pieces and chopped Dove Chocolate pieces.

Ingredient treatment:
- Base custard color: Deep chocolate custard (#5A3825).
- Swirls: Caramel ribbon (#D38B2C).
- Chunk inclusions: Pecan pieces x3 (#8B5A2B); Dark chocolate chunks x1 (#2B1A12)
- Texture notes: Dense inclusion field with layered depth while keeping each ingredient readable. Keep ribbon visible through inclusions with clean edge contrast. Boost local contrast around dark chunks so ingredients stay readable.
```

Canonical profile:
- Base key: `chocolate_custard`
- Ribbon key: `caramel`
- Toppings: `pecan, pecan, dove, pecan`
- Density: `explosion`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Deep chocolate custard with rich dark-cocoa tones (#5A3825 with #4A2D1C shadows).
- Swirls: Glossy amber caramel ribbon with golden translucent edges cutting through the dark chocolate (#D38B2C).
- Chunk inclusions: Multiple brown pecan pieces with natural wood-grain texture (#8B5A2B); dark chocolate Dove chunks with glossy broken-bar facets (#2B1A12); additional pecans layered through the scoop.
- Texture notes: Dense inclusion field with layered depth. Caramel ribbon weaves between pecan clusters and chocolate chunks. Keep ribbon visible through inclusions with clean edge contrast. Boost local contrast around dark chocolate chunks on the dark base.
```

---

## Caramel Fudge Cookie Dough

Description: Vanilla Fresh Frozen Custard with caramel, fudge, and cookie dough.

Flavor fill:
```text
Flavor: Caramel Fudge Cookie Dough

Description:
Vanilla Fresh Frozen Custard with caramel, fudge, and cookie dough.

Ingredient treatment:
- Base custard color: Vanilla custard (#F5DEB3).
- Swirls: Fudge ribbon (#3B1F0B).
- Chunk inclusions: Cookie dough chunks x1 (#917C60)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `vanilla`
- Ribbon key: `fudge`
- Toppings: `cookie_dough`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm vanilla custard with creamy wheat highlights (#F5DEB3 with #EDD9A3 gentle depth).
- Swirls: Dark near-black fudge ribbon with matte chocolate surface threading through the scoop (#3B1F0B).
- Chunk inclusions: Tan cookie dough chunks with speckled chocolate-chip flecks and soft rounded shapes (#917C60).
- Texture notes: Balanced spread with fudge ribbon creating dark contrast lines between scattered cookie dough pieces. Dough chunks have visible chocolate-chip specks against their tan surface.
```

---

## Caramel Peanut Buttercup

Description: Creamy Vanilla Fresh Frozen Custard swirled with ribbons of peanut butter and old fashioned salted caramel and loaded with novelty chocolate.

Flavor fill:
```text
Flavor: Caramel Peanut Buttercup

Description:
Creamy Vanilla Fresh Frozen Custard swirled with ribbons of peanut butter and old fashioned salted caramel and loaded with novelty chocolate.

Ingredient treatment:
- Base custard color: Vanilla custard (#F5DEB3).
- Swirls: Peanut butter swirl (#D4A017).
- Chunk inclusions: Dark chocolate chunks x1 (#2B1A12)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `vanilla`
- Ribbon key: `peanut_butter`
- Toppings: `dove`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm vanilla custard with creamy wheat tones (#F5DEB3 with golden #EDD9A3 highlights).
- Swirls: Golden peanut butter swirl with thick, matte amber texture winding through the scoop (#D4A017).
- Chunk inclusions: Dark chocolate chunks with glossy broken-piece facets (#2B1A12).
- Texture notes: Balanced depth with peanut butter swirl weaving broad golden paths between dark chocolate pieces. Strong light-dark contrast between golden swirl and near-black chocolate.
```

---

## Caramel Pecan

Description: Caramel Fresh Frozen Custard with pecan pieces.

Flavor fill:
```text
Flavor: Caramel Pecan

Description:
Caramel Fresh Frozen Custard with pecan pieces.

Ingredient treatment:
- Base custard color: Caramel custard (#C68E17).
- Swirls: None.
- Chunk inclusions: Pecan pieces x1 (#8B5A2B)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated.
```

Canonical profile:
- Base key: `caramel`
- Ribbon key: `none`
- Toppings: `pecan`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Rich caramel custard with warm golden-amber depth (#C68E17 with deeper #B07D12 shadow tones).
- Swirls: None -- pure caramel base with warm custard body gradients.
- Chunk inclusions: Rich brown pecan pieces with natural wood-grain texture and warm saddle-brown surfaces (#8B5A2B).
- Texture notes: Standard inclusion depth with pecan pieces evenly distributed. Brown pecans create earthy contrast against the golden caramel base. Natural piece shapes add organic variety.
```

---

## Caramel Turtle

Description: Caramel Fresh Frozen Custard with pecan pieces and fudge.

Flavor fill:
```text
Flavor: Caramel Turtle

Description:
Caramel Fresh Frozen Custard with pecan pieces and fudge.

Ingredient treatment:
- Base custard color: Caramel custard (#C68E17).
- Swirls: Fudge ribbon (#3B1F0B).
- Chunk inclusions: Pecan pieces x2 (#8B5A2B); Dark chocolate chunks x1 (#2B1A12)
- Texture notes: Dense inclusion field with layered depth while keeping each ingredient readable. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `caramel`
- Ribbon key: `fudge`
- Toppings: `pecan, dove, pecan`
- Density: `explosion`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Rich caramel custard with warm golden depth (#C68E17 with deeper #B07D12 undertones).
- Swirls: Near-black fudge ribbon with matte chocolate depth winding through golden caramel (#3B1F0B).
- Chunk inclusions: Brown pecan pieces with natural wood-grain texture (#8B5A2B); dark chocolate Dove chunks with glossy facets (#2B1A12); additional pecan pieces layered for depth.
- Texture notes: Dense inclusion field with layered depth. Fudge ribbon creates dark paths between pecan clusters and chocolate chunks. Three ingredients at different tones create strong visual depth against the golden base.
```

---

## Cashew Delight

Description: Vanilla Fresh Frozen Custard with caramel and cashew pieces.

Flavor fill:
```text
Flavor: Cashew Delight

Description:
Vanilla Fresh Frozen Custard with caramel and cashew pieces.

Ingredient treatment:
- Base custard color: Vanilla custard (#F5DEB3).
- Swirls: Caramel ribbon (#D38B2C).
- Chunk inclusions: Cashew pieces x1 (#897E6C)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `vanilla`
- Ribbon key: `caramel`
- Toppings: `cashew`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm vanilla custard with creamy wheat highlights (#F5DEB3 with golden #EDD9A3 depth).
- Swirls: Glossy amber caramel ribbon with translucent golden edges threading through the scoop (#D38B2C).
- Chunk inclusions: Smooth ivory cashew pieces with pale cream surfaces and gentle curved shapes (#897E6C).
- Texture notes: Standard inclusion spread with caramel ribbon weaving between cashew pieces. Cashews and caramel share warm golden tones but differ in surface finish -- matte nut vs glossy ribbon.
```

---

## Cheri Amour Amaretto

Description: Cherry Fresh Frozen Custard with cherry pieces in an amaretto style.

Flavor fill:
```text
Flavor: Cheri Amour Amaretto

Description:
Cherry Fresh Frozen Custard with cherry pieces in an amaretto style.

Ingredient treatment:
- Base custard color: cherry (#C41E3A).
- Swirls: None.
- Chunk inclusions: cherry_bits x1 (#8B0000)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated.
```

Canonical profile:
- Base key: `cherry`
- Ribbon key: `none`
- Toppings: `cherry_bits`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Bright cherry-red custard with deep crimson warmth (#C41E3A with #A61832 deeper tones).
- Swirls: None -- pure cherry base with rich fruit-body color variations.
- Chunk inclusions: Dark cherry pieces with deep burgundy-red surfaces and glistening wet highlights (#8B0000).
- Texture notes: Standard inclusion depth with cherry pieces naturally distributed. Dark cherry chunks sit slightly below the bright cherry base surface, creating tonal depth within the red family.
```

---

## Cherry Pecan

Description: Cherry Fresh Frozen Custard with cherry pieces and pecans.

Flavor fill:
```text
Flavor: Cherry Pecan

Description:
Cherry Fresh Frozen Custard with cherry pieces and pecans.

Ingredient treatment:
- Base custard color: cherry (#C41E3A).
- Swirls: None.
- Chunk inclusions: cherry_bits x1 (#8B0000); Pecan pieces x1 (#8B5A2B)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated.
```

Canonical profile:
- Base key: `cherry`
- Ribbon key: `none`
- Toppings: `cherry_bits, pecan`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Bright cherry-red custard with vivid crimson tones (#C41E3A with darker #A61832 shadows).
- Swirls: None -- pure cherry base with two-ingredient inclusion field.
- Chunk inclusions: Dark cherry pieces with deep burgundy surfaces and wet highlights (#8B0000); rich brown pecan pieces with warm wood-grain texture (#8B5A2B).
- Texture notes: Balanced two-ingredient spread with dark cherry and brown pecan pieces clearly separated. Cherry pieces are darker and glossier while pecans are matte and warm-toned.
```

---

## Chocolate Caramel Twist

Description: Chocolate and Vanilla Fresh Frozen Custard with caramel.

Flavor fill:
```text
Flavor: Chocolate Caramel Twist

Description:
Chocolate and Vanilla Fresh Frozen Custard with caramel.

Ingredient treatment:
- Base custard color: Chocolate custard (#6F4E37).
- Swirls: Caramel ribbon (#D38B2C).
- Chunk inclusions: Dark chocolate chunks x1 (#2B1A12)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `chocolate`
- Ribbon key: `caramel`
- Toppings: `dove`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Rich chocolate custard with warm cocoa depth (#6F4E37 with #5A3825 darker undertones).
- Swirls: Glossy amber caramel ribbon with golden translucent edges swirling through chocolate (#D38B2C).
- Chunk inclusions: Dark chocolate Dove chunks with glossy broken-bar facets and deep cocoa surfaces (#2B1A12).
- Texture notes: Balanced depth with bright caramel ribbon creating golden contrast lines through the dark chocolate body. Dove chunks add texture at similar darkness to the base. Keep ribbon visible for strong contrast.
```

---

## Chocolate Covered Strawberry

Description: Our creamy Vanilla Fresh Frozen Custard complemented with plump strawberries and novelty chocolate.

Flavor fill:
```text
Flavor: Chocolate Covered Strawberry

Description:
Our creamy Vanilla Fresh Frozen Custard complemented with plump strawberries and novelty chocolate.

Ingredient treatment:
- Base custard color: Vanilla custard (#F5DEB3).
- Swirls: None.
- Chunk inclusions: Strawberry bits x1 (#A10E2B); Dark chocolate chunks x1 (#2B1A12)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated.
```

Canonical profile:
- Base key: `vanilla`
- Ribbon key: `none`
- Toppings: `strawberry_bits, dove`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm vanilla custard with creamy wheat tones (#F5DEB3 with #EDD9A3 gentle shadows).
- Swirls: None -- pure vanilla base with fruit and chocolate inclusions.
- Chunk inclusions: Bright red strawberry bits with vivid crimson surfaces (#A10E2B); dark chocolate Dove chunks with glossy cocoa facets (#2B1A12).
- Texture notes: Balanced two-ingredient spread with bright strawberry and dark chocolate pieces clearly separated. Red-on-cream and dark-on-cream create strong dual-tone visual interest.
```

---

## Chocolate Heath Crunch

Description: Chocolate Fresh Frozen Custard with Heath bar pieces.

Flavor fill:
```text
Flavor: Chocolate Heath Crunch

Description:
Chocolate Fresh Frozen Custard with Heath bar pieces.

Ingredient treatment:
- Base custard color: Chocolate custard (#6F4E37).
- Swirls: None.
- Chunk inclusions: Heath toffee bits x1 (#DAA520)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated.
```

Canonical profile:
- Base key: `chocolate`
- Ribbon key: `none`
- Toppings: `heath`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Rich chocolate custard with warm cocoa depth (#6F4E37 with #5C3E2B shadow tones).
- Swirls: None -- pure chocolate base with toffee inclusions.
- Chunk inclusions: Golden Heath toffee bits with amber crystalline edges and glossy caramel sheen (#DAA520).
- Texture notes: Standard inclusion depth with toffee bits spread evenly. Bright golden Heath pieces pop strongly against the dark chocolate base, creating vivid warm-tone contrast.
```

---

## Chocolate Oreo Volcano

Description: Chocolate Fresh Frozen Custard with OREO cookie pieces and marshmallow.

Flavor fill:
```text
Flavor: Chocolate Oreo Volcano

Description:
Chocolate Fresh Frozen Custard with OREO cookie pieces and marshmallow.

Ingredient treatment:
- Base custard color: Chocolate custard (#6F4E37).
- Swirls: Marshmallow swirl (#FFFFFF).
- Chunk inclusions: OREO cookie chunks x1 (#1A1A1A); Dark chocolate chunks x1 (#2B1A12)
- Texture notes: Dense inclusion field with layered depth while keeping each ingredient readable. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `chocolate`
- Ribbon key: `marshmallow`
- Toppings: `oreo, dove`
- Density: `explosion`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Rich chocolate custard with deep cocoa warmth (#6F4E37 with #5A3825 undertones).
- Swirls: Bright white marshmallow swirl with fluffy pulled texture erupting through the chocolate (#FFFFFF).
- Chunk inclusions: Dark OREO cookie chunks with visible cream filling layers (#1A1A1A); dark chocolate Dove pieces with glossy cocoa facets (#2B1A12).
- Texture notes: Dense inclusion field with layered depth. Marshmallow swirl creates bright white eruption paths between dark OREO and chocolate chunks. Three dark tones contrast against bright white.
```

---

## Chocolate Volcano

Description: Chocolate Fresh Frozen Custard with fudge and marshmallow.

Flavor fill:
```text
Flavor: Chocolate Volcano

Description:
Chocolate Fresh Frozen Custard with fudge and marshmallow.

Ingredient treatment:
- Base custard color: Chocolate custard (#6F4E37).
- Swirls: Chocolate syrup ribbon (#1A0A00).
- Chunk inclusions: OREO cookie chunks x1 (#1A1A1A); Dark chocolate chunks x1 (#2B1A12); M and M candy pieces x1 (#FF7D7D)
- Texture notes: Dense inclusion field with layered depth while keeping each ingredient readable. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `chocolate`
- Ribbon key: `chocolate_syrup`
- Toppings: `oreo, dove, m_and_m`
- Density: `explosion`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Rich chocolate custard with warm cocoa body (#6F4E37 with darker #5A3825 depth).
- Swirls: Near-black chocolate syrup ribbon with glossy wet sheen draping through the scoop (#1A0A00).
- Chunk inclusions: Dark OREO cookie chunks with visible cream filling streaks (#1A1A1A); dark chocolate Dove pieces with broken-bar facets (#2B1A12); bright multicolor M&M candy pieces with glossy shell (#FF7D7D).
- Texture notes: Dense inclusion field with layered depth. Multiple dark ingredients compete for contrast while M&M pieces add bright color pops. Chocolate syrup ribbon adds glossy-vs-matte variation.
```

---

## Chunky Peanut Butter Dream

Description: Vanilla Fresh Frozen Custard with peanut butter swirl and Reese's cup pieces.

Flavor fill:
```text
Flavor: Chunky Peanut Butter Dream

Description:
Vanilla Fresh Frozen Custard with peanut butter swirl and Reese's cup pieces.

Ingredient treatment:
- Base custard color: Vanilla custard (#F5DEB3).
- Swirls: Peanut butter swirl (#D4A017).
- Chunk inclusions: Reese's cup pieces x1 (#D4A017)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `vanilla`
- Ribbon key: `peanut_butter`
- Toppings: `reeses`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm vanilla custard with creamy wheat tones (#F5DEB3 with golden #EDD9A3 highlights).
- Swirls: Golden peanut butter swirl with thick matte amber texture threading through the scoop (#D4A017).
- Chunk inclusions: Golden-amber Reese's cup pieces with layered peanut butter and chocolate visible at broken edges (#D4A017).
- Texture notes: Balanced depth with peanut butter swirl and Reese's pieces in similar golden tones but different textures. Swirl is smooth and matte while cup pieces show layered chocolate-peanut butter cross-sections.
```

---

## Coconut Cream Pie

Description: Coconut Fresh Frozen Custard with coconut flakes and graham cracker crumbles.

Flavor fill:
```text
Flavor: Coconut Cream Pie

Description:
Coconut Fresh Frozen Custard with coconut flakes and graham cracker crumbles.

Ingredient treatment:
- Base custard color: coconut (#FFFAF0).
- Swirls: None.
- Chunk inclusions: coconut_flakes x1 (#F5F5DC); graham_cracker x1 (#8B6914)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated.
```

Canonical profile:
- Base key: `coconut`
- Ribbon key: `none`
- Toppings: `coconut_flakes, graham_cracker`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Floral white coconut custard with pale cream warmth (#FFFAF0 with slightly deeper #F5EDE0 in shadows).
- Swirls: None -- pure coconut base with crispy and crumbly inclusions.
- Chunk inclusions: Off-white coconut flakes with thin curved shred shapes and slight translucency (#F5F5DC); golden graham cracker crumbles with toasty amber surfaces (#8B6914).
- Texture notes: Balanced two-ingredient spread with pale coconut flakes and golden graham pieces. Graham cracker provides warm contrast against the near-white coconut base. Coconut flakes add delicate surface texture.
```

---

## Cookie Dough Craving

Description: Vanilla Fresh Frozen Custard with cookie dough chunks.

Flavor fill:
```text
Flavor: Cookie Dough Craving

Description:
Vanilla Fresh Frozen Custard with cookie dough chunks.

Ingredient treatment:
- Base custard color: Vanilla custard (#F5DEB3).
- Swirls: None.
- Chunk inclusions: Cookie dough chunks x1 (#917C60)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated.
```

Canonical profile:
- Base key: `vanilla`
- Ribbon key: `none`
- Toppings: `cookie_dough`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm vanilla custard with creamy wheat highlights (#F5DEB3 with golden #EDD9A3 undertones).
- Swirls: None -- pure vanilla base with cookie dough inclusions.
- Chunk inclusions: Tan cookie dough chunks with speckled chocolate-chip flecks and soft rounded edges (#917C60).
- Texture notes: Standard inclusion depth with cookie dough pieces distributed naturally. Dough chunks show visible chocolate chip specks against their tan surface, with soft edges suggesting raw dough texture.
```

---

## Cookies & Cream

Description: Vanilla Fresh Frozen Custard with OREO cookie pieces.

Flavor fill:
```text
Flavor: Cookies & Cream

Description:
Vanilla Fresh Frozen Custard with OREO cookie pieces.

Ingredient treatment:
- Base custard color: Vanilla custard (#F5DEB3).
- Swirls: None.
- Chunk inclusions: OREO cookie chunks x1 (#1A1A1A)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated.
```

Canonical profile:
- Base key: `vanilla`
- Ribbon key: `none`
- Toppings: `oreo`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm vanilla custard with creamy wheat tones (#F5DEB3 with #EDD9A3 subtle depth).
- Swirls: None -- pure vanilla base with OREO cookie inclusions.
- Chunk inclusions: Dark OREO cookie chunks with near-black surfaces and visible cream filling layers at broken edges (#1A1A1A).
- Texture notes: Standard inclusion depth with OREO pieces distributed evenly. Dark black-on-cream contrast is the defining visual. Cream filling visible at broken edges adds fine detail.
```

---

## Crazy for Cookie Dough

Description: Vanilla Fresh Frozen Custard with cookie dough pieces and fudge.

Flavor fill:
```text
Flavor: Crazy for Cookie Dough

Description:
Vanilla Fresh Frozen Custard with cookie dough pieces and fudge.

Ingredient treatment:
- Base custard color: Vanilla custard (#F5DEB3).
- Swirls: Fudge ribbon (#3B1F0B).
- Chunk inclusions: Cookie dough chunks x1 (#917C60)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `vanilla`
- Ribbon key: `fudge`
- Toppings: `cookie_dough`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm vanilla custard with creamy wheat highlights (#F5DEB3 with golden #EDD9A3 depth).
- Swirls: Near-black fudge ribbon with matte chocolate surface threading through the scoop (#3B1F0B).
- Chunk inclusions: Tan cookie dough chunks with speckled chocolate-chip flecks and soft rounded shapes (#917C60).
- Texture notes: Balanced depth with fudge ribbon creating dark contrast lines weaving between cookie dough chunks. Tan dough against dark fudge and pale vanilla creates three-tone layering.
```

---

## Creamy Lemon Crumble

Description: Lemon Fresh Frozen Custard with cookie crumbles.

Flavor fill:
```text
Flavor: Creamy Lemon Crumble

Description:
Lemon Fresh Frozen Custard with cookie crumbles.

Ingredient treatment:
- Base custard color: Lemon custard (#FFF176).
- Swirls: None.
- Chunk inclusions: cookie_crumbs x1 (#7B5B32)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated.
```

Canonical profile:
- Base key: `lemon`
- Ribbon key: `none`
- Toppings: `cookie_crumbs`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Bright lemon custard with vivid yellow warmth (#FFF176 with slightly deeper #F5E76A in shadows).
- Swirls: None -- pure lemon base with cookie crumble inclusions.
- Chunk inclusions: Dark sandy cookie crumbles with granular toasted texture (#7B5B32).
- Texture notes: Standard inclusion depth with cookie crumbles evenly spread. Dark crumble pieces create strong contrast against the bright yellow lemon base. Fine granular texture adds surface interest.
```

---

## Dark Chocolate Decadence

Description: Dark Chocolate Fresh Frozen Custard with fudge and chocolate chips.

Flavor fill:
```text
Flavor: Dark Chocolate Decadence

Description:
Dark Chocolate Fresh Frozen Custard with fudge and chocolate chips.

Ingredient treatment:
- Base custard color: Dark chocolate custard (#3B1F0B).
- Swirls: None.
- Chunk inclusions: None (clean scoop with no chunk inclusions).
- Texture notes: Smooth scoop with low inclusion noise. Keep texture subtle and creamy.
```

Canonical profile:
- Base key: `dark_chocolate`
- Ribbon key: `none`
- Toppings: `none`
- Density: `pure`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Deep, near-black chocolate custard with velvety darkness (#3B1F0B with warm #4A2D18 highlights at crown and edges).
- Swirls: None -- pure dark chocolate with subtle color depth variations only.
- Chunk inclusions: None -- clean scoop with no inclusions.
- Texture notes: Smooth scoop with low inclusion noise. Emphasize the ultra-dark chocolate with subtle warm highlight at the crown and gentle shadow depth at the base. Velvety surface with minimal light reflection.
```

---

## Dark Chocolate PB Crunch

Description: Dark Chocolate Fresh Frozen Custard with peanut butter and chocolate crunch.

Flavor fill:
```text
Flavor: Dark Chocolate PB Crunch

Description:
Dark Chocolate Fresh Frozen Custard with peanut butter and chocolate crunch.

Ingredient treatment:
- Base custard color: Dark chocolate custard (#3B1F0B).
- Swirls: Peanut butter swirl (#D4A017).
- Chunk inclusions: Butterfinger crunch bits x1 (#E6A817)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `dark_chocolate`
- Ribbon key: `peanut_butter`
- Toppings: `butterfinger`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Deep dark chocolate custard with near-black richness (#3B1F0B with warm #4A2D18 undertones).
- Swirls: Golden peanut butter swirl with thick matte amber texture winding through the dark base (#D4A017).
- Chunk inclusions: Bright golden Butterfinger crunch pieces with flaky layered texture and vivid amber surfaces (#E6A817).
- Texture notes: Balanced depth with peanut butter swirl and Butterfinger pieces creating bright golden contrast against the ultra-dark chocolate base. Keep ribbon visible for maximum light-dark drama.
```

---

## Death By Chocolate

Description: Dark Chocolate Fresh Frozen Custard with chocolate syrup, brownie chunks, and dark chocolate pieces.

Flavor fill:
```text
Flavor: Death By Chocolate

Description:
Dark Chocolate Fresh Frozen Custard with chocolate syrup, brownie chunks, and dark chocolate pieces.

Ingredient treatment:
- Base custard color: Dark chocolate custard (#3B1F0B).
- Swirls: Chocolate syrup ribbon (#1A0A00).
- Chunk inclusions: Brownie chunks x1 (#ADA59C); Dark chocolate chunks x1 (#2B1A12)
- Texture notes: Dense inclusion field with layered depth while keeping each ingredient readable. Keep ribbon visible through inclusions with clean edge contrast. Boost local contrast around dark chunks so ingredients stay readable.
```

Canonical profile:
- Base key: `dark_chocolate`
- Ribbon key: `chocolate_syrup`
- Toppings: `brownie, dove`
- Density: `explosion`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Deep dark chocolate custard with near-black velvety depth (#3B1F0B with warm #4A2D18 crown highlights).
- Swirls: Near-black chocolate syrup ribbon with glossy wet sheen threading through the dark base (#1A0A00).
- Chunk inclusions: Fudgy brownie chunks with moist cracked surfaces (#ADA59C); dark chocolate Dove pieces with glossy broken-bar facets (#2B1A12).
- Texture notes: Dense inclusion field with layered depth. Multiple dark-on-dark ingredients require careful local contrast. Brownie pieces lighter than base, Dove chunks show glossy sheen difference. Chocolate syrup ribbon adds wet-vs-matte texture variation.
```

---

## Devil's Food Cake

Description: Dark Chocolate Fresh Frozen Custard swirled with chocolate cake and novelty chocolate.

Flavor fill:
```text
Flavor: Devil's Food Cake

Description:
Dark Chocolate Fresh Frozen Custard swirled with chocolate cake and novelty chocolate.

Ingredient treatment:
- Base custard color: Deep chocolate custard (#5A3825).
- Swirls: None.
- Chunk inclusions: Chocolate cake chunks x1 (#4A2800); Dark chocolate chunks x1 (#2B1A12)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated. Boost local contrast around dark chunks so ingredients stay readable.
```

Canonical profile:
- Base key: `chocolate_custard`
- Ribbon key: `none`
- Toppings: `cake, dove`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Deep chocolate custard with rich dark-cocoa body (#5A3825 with darker #4A2D1C shadow tones).
- Swirls: None -- pure chocolate custard base with cake and chocolate inclusions.
- Chunk inclusions: Deep brown chocolate cake chunks with moist matte surfaces and soft crumble edges (#4A2800); dark chocolate Dove pieces with glossy cocoa facets (#2B1A12).
- Texture notes: Standard inclusion depth with cake and chocolate pieces at similar dark tones. Boost local contrast around dark chunks so ingredients stay readable against the dark base. Cake is matte, chocolate is glossy.
```

---

## Double Butter Pecan

Description: Vanilla Fresh Frozen Custard with extra pecan pieces.

Flavor fill:
```text
Flavor: Double Butter Pecan

Description:
Vanilla Fresh Frozen Custard with extra pecan pieces.

Ingredient treatment:
- Base custard color: Vanilla custard (#F5DEB3).
- Swirls: None.
- Chunk inclusions: Pecan pieces x1 (#8B5A2B)
- Texture notes: Emphasize the primary inclusion with repeated chunks near top and mid scoop.
```

Canonical profile:
- Base key: `vanilla`
- Ribbon key: `none`
- Toppings: `pecan`
- Density: `double`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm vanilla custard with creamy wheat highlights (#F5DEB3 with #EDD9A3 golden depth).
- Swirls: None -- pure vanilla base with double-portion pecan inclusions.
- Chunk inclusions: Rich brown pecan pieces with natural wood-grain texture, doubled in quantity with pieces near top and mid scoop (#8B5A2B).
- Texture notes: Emphasize the primary inclusion with repeated pecan chunks near top and mid scoop. Double portion means denser pecan coverage than standard, but pieces remain individually readable.
```

---

## Double Marshmallow OREO

Description: Chocolate Fresh Frozen Custard with marshmallow swirl and OREO cookie pieces.

Flavor fill:
```text
Flavor: Double Marshmallow OREO

Description:
Chocolate Fresh Frozen Custard with marshmallow swirl and OREO cookie pieces.

Ingredient treatment:
- Base custard color: Chocolate custard (#6F4E37).
- Swirls: Marshmallow swirl (#FFFFFF).
- Chunk inclusions: OREO cookie chunks x1 (#1A1A1A)
- Texture notes: Emphasize the primary inclusion with repeated chunks near top and mid scoop. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `chocolate`
- Ribbon key: `marshmallow`
- Toppings: `oreo`
- Density: `double`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Rich chocolate custard with warm cocoa depth (#6F4E37 with #5A3825 darker tones).
- Swirls: Bright white marshmallow swirl with extra-thick fluffy pulled texture threading through chocolate (#FFFFFF).
- Chunk inclusions: Dark OREO cookie chunks with near-black surfaces and visible cream filling layers (#1A1A1A).
- Texture notes: Emphasize the primary inclusion with marshmallow swirl extra prominent at top and mid scoop. Double marshmallow means thicker, more visible white paths. Dark OREO adds contrast points.
```

---

## Double Strawberry

Description: Our specially blended Strawberry Fresh Frozen Custard swirled with plump strawberries.

Flavor fill:
```text
Flavor: Double Strawberry

Description:
Our specially blended Strawberry Fresh Frozen Custard swirled with plump strawberries.

Ingredient treatment:
- Base custard color: Strawberry custard (#FF6B9D).
- Swirls: None.
- Chunk inclusions: Strawberry bits x1 (#A10E2B)
- Texture notes: Emphasize the primary inclusion with repeated chunks near top and mid scoop.
```

Canonical profile:
- Base key: `strawberry`
- Ribbon key: `none`
- Toppings: `strawberry_bits`
- Density: `double`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Vibrant strawberry-pink custard with bright berry warmth (#FF6B9D with deeper #E8598A undertones).
- Swirls: None -- pure strawberry base with fruit inclusions.
- Chunk inclusions: Deep red strawberry bits with vivid crimson surfaces and natural fruit shapes (#A10E2B).
- Texture notes: Emphasize the primary inclusion with strawberry pieces doubled near top and mid scoop. Dark red fruit bits against bright pink base create rich monochromatic depth within the berry color family.
```

---

## Georgia Peach

Description: Our specially blended Peach Fresh Frozen Custard swirled with sweet peaches for a light, refreshing treat.

Flavor fill:
```text
Flavor: Georgia Peach

Description:
Our specially blended Peach Fresh Frozen Custard swirled with sweet peaches for a light, refreshing treat.

Ingredient treatment:
- Base custard color: Peach custard (#FFE5B4).
- Swirls: None.
- Chunk inclusions: Peach bits x1 (#BF7200)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated.
```

Canonical profile:
- Base key: `peach`
- Ribbon key: `none`
- Toppings: `peach_bits`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm peach custard with soft golden-orange glow (#FFE5B4 with slightly deeper #F5D9A0 shadow tones).
- Swirls: None -- pure peach base with fruit inclusions.
- Chunk inclusions: Deep amber-orange peach bits with warm sunset tones and natural fruit-slice shapes (#BF7200).
- Texture notes: Standard inclusion depth with peach pieces naturally distributed. Darker orange fruit bits against pale peach base create warm monochromatic depth. Fruit pieces suggest natural irregular cuts.
```

---

## Grasshopper Fudge

Description: Mint Fresh Frozen Custard swirled with fudge and loaded with OREO cookie pieces.

Flavor fill:
```text
Flavor: Grasshopper Fudge

Description:
Mint Fresh Frozen Custard swirled with fudge and loaded with OREO cookie pieces.

Ingredient treatment:
- Base custard color: Mint custard (#2ECC71).
- Swirls: Fudge ribbon (#3B1F0B).
- Chunk inclusions: OREO cookie chunks x1 (#1A1A1A)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `mint`
- Ribbon key: `fudge`
- Toppings: `oreo`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Bright mint-green custard with cool fresh tones (#2ECC71 with slightly deeper #28B563 in shadows).
- Swirls: Near-black fudge ribbon with matte chocolate depth threading through the bright mint (#3B1F0B).
- Chunk inclusions: Dark OREO cookie chunks with near-black surfaces and visible cream filling layers (#1A1A1A).
- Texture notes: Balanced depth with fudge ribbon creating dark paths through bright mint. OREO chunks add dark texture points. Strong light-dark contrast between mint base and dark inclusions throughout.
```

---

## Just Drummy

Description: Vanilla Fresh Frozen Custard with chocolate cake pieces.

Flavor fill:
```text
Flavor: Just Drummy

Description:
Vanilla Fresh Frozen Custard with chocolate cake pieces.

Ingredient treatment:
- Base custard color: Vanilla custard (#F5DEB3).
- Swirls: None.
- Chunk inclusions: Chocolate cake chunks x1 (#4A2800)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated.
```

Canonical profile:
- Base key: `vanilla`
- Ribbon key: `none`
- Toppings: `cake`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm vanilla custard with creamy wheat highlights (#F5DEB3 with golden #EDD9A3 undertones).
- Swirls: None -- pure vanilla base with cake inclusions.
- Chunk inclusions: Deep brown chocolate cake chunks with moist matte surfaces and soft crumble edges (#4A2800).
- Texture notes: Standard inclusion depth with cake pieces evenly distributed. Dark brown cake chunks create strong contrast against the pale vanilla base. Moist matte surfaces suggest fresh-baked texture.
```

---

## Key Lime Custard Pie

Description: Lemon Fresh Frozen Custard with graham cracker crumbles in a key lime pie style.

Flavor fill:
```text
Flavor: Key Lime Custard Pie

Description:
Lemon Fresh Frozen Custard with graham cracker crumbles in a key lime pie style.

Ingredient treatment:
- Base custard color: Lemon custard (#FFF176).
- Swirls: None.
- Chunk inclusions: graham_cracker x1 (#8B6914)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated.
```

Canonical profile:
- Base key: `lemon`
- Ribbon key: `none`
- Toppings: `graham_cracker`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Bright citrus custard with vivid yellow-green warmth (#FFF176 with a cooler green-tinged cast for key lime character).
- Swirls: None -- pure citrus base with graham cracker inclusions.
- Chunk inclusions: Golden graham cracker crumbles with toasty amber surfaces and granular snap-break texture (#8B6914).
- Texture notes: Standard inclusion depth with graham pieces evenly spread. Golden graham crumbles against bright citrus base create warm pie-crust contrast. Granular crumb texture suggests crushed pie crust.
```

---

## Kit Kat Bar

Description: Vanilla Fresh Frozen Custard with crispy toffee bar pieces.

Flavor fill:
```text
Flavor: Kit Kat Bar

Description:
Vanilla Fresh Frozen Custard with crispy toffee bar pieces.

Ingredient treatment:
- Base custard color: Vanilla custard (#F5DEB3).
- Swirls: None.
- Chunk inclusions: Heath toffee bits x1 (#DAA520)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated.
```

Canonical profile:
- Base key: `vanilla`
- Ribbon key: `none`
- Toppings: `heath`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm vanilla custard with creamy wheat tones (#F5DEB3 with #EDD9A3 gentle shadows).
- Swirls: None -- pure vanilla base with crispy toffee bar inclusions.
- Chunk inclusions: Golden Heath toffee bits standing in for crispy wafer-bar pieces with amber crystalline edges (#DAA520).
- Texture notes: Standard inclusion depth with toffee-bar pieces evenly distributed. Golden pieces pop brightly against the pale vanilla base with strong warm-tone contrast and crispy edge detail.
```

---

## Kit Kat Swirl

Description: Vanilla Fresh Frozen Custard with chocolate syrup swirl and crispy toffee bar pieces.

Flavor fill:
```text
Flavor: Kit Kat Swirl

Description:
Vanilla Fresh Frozen Custard with chocolate syrup swirl and crispy toffee bar pieces.

Ingredient treatment:
- Base custard color: Vanilla custard (#F5DEB3).
- Swirls: Chocolate syrup ribbon (#1A0A00).
- Chunk inclusions: Heath toffee bits x1 (#DAA520)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `vanilla`
- Ribbon key: `chocolate_syrup`
- Toppings: `heath`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm vanilla custard with creamy wheat highlights (#F5DEB3 with golden #EDD9A3 depth).
- Swirls: Near-black chocolate syrup ribbon with glossy wet sheen draping through the scoop (#1A0A00).
- Chunk inclusions: Golden Heath toffee bits standing in for crispy wafer-bar pieces with amber crystalline edges (#DAA520).
- Texture notes: Balanced depth with dark chocolate syrup ribbon creating strong contrast lines through pale vanilla. Golden toffee pieces add bright warm accents against both vanilla and chocolate.
```

---

## Lemon Berry Layer Cake

Description: Lemon Fresh Frozen Custard with blueberries and cake pieces.

Flavor fill:
```text
Flavor: Lemon Berry Layer Cake

Description:
Lemon Fresh Frozen Custard with blueberries and cake pieces.

Ingredient treatment:
- Base custard color: Lemon custard (#FFF176).
- Swirls: None.
- Chunk inclusions: Blueberry pieces x1 (#3B1F6B); Chocolate cake chunks x1 (#4A2800)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated.
```

Canonical profile:
- Base key: `lemon`
- Ribbon key: `none`
- Toppings: `blueberry, cake`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Bright lemon custard with vivid yellow warmth (#FFF176 with slightly deeper #F5E76A in shadows).
- Swirls: None -- pure lemon base with berry and cake inclusions.
- Chunk inclusions: Deep purple blueberry pieces with dark violet surfaces and natural round shapes (#3B1F6B); deep brown chocolate cake chunks with moist matte surfaces (#4A2800).
- Texture notes: Balanced two-ingredient spread with dark purple blueberry and dark brown cake pieces clearly separated. Both create strong contrast against the bright yellow lemon base. Blueberry is glossy, cake is matte.
```

---

## Lemon Dash Cookie

Description: Lemon Fresh Frozen Custard with cookie pieces.

Flavor fill:
```text
Flavor: Lemon Dash Cookie

Description:
Lemon Fresh Frozen Custard with cookie pieces.

Ingredient treatment:
- Base custard color: Lemon custard (#FFF176).
- Swirls: None.
- Chunk inclusions: OREO cookie chunks x1 (#1A1A1A)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated.
```

Canonical profile:
- Base key: `lemon`
- Ribbon key: `none`
- Toppings: `oreo`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Bright lemon custard with vivid yellow warmth (#FFF176 with #F5E76A depth in shadows).
- Swirls: None -- pure lemon base with cookie inclusions.
- Chunk inclusions: Dark OREO cookie chunks with near-black surfaces and visible cream filling layers (#1A1A1A).
- Texture notes: Standard inclusion depth with OREO pieces distributed evenly. Extreme dark-on-bright contrast between near-black cookies and vivid yellow lemon base. Cream filling streaks add fine detail.
```

---

## M&m Cookie Dough

Description: Chocolate Fresh Frozen Custard with M&M candy pieces and cookie dough chunks.

Flavor fill:
```text
Flavor: M&m Cookie Dough

Description:
Chocolate Fresh Frozen Custard with M&M candy pieces and cookie dough chunks.

Ingredient treatment:
- Base custard color: Chocolate custard (#6F4E37).
- Swirls: None.
- Chunk inclusions: M and M candy pieces x1 (#FF7D7D); Cookie dough chunks x1 (#917C60)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated.
```

Canonical profile:
- Base key: `chocolate`
- Ribbon key: `none`
- Toppings: `m_and_m, cookie_dough`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Rich chocolate custard with warm cocoa depth (#6F4E37 with #5C3E2B undertones).
- Swirls: None -- pure chocolate base with candy and dough inclusions.
- Chunk inclusions: Bright multicolor M&M candy pieces with glossy rounded shells in red, yellow, green, blue (#FF7D7D); tan cookie dough chunks with speckled chocolate-chip flecks (#917C60).
- Texture notes: Balanced two-ingredient spread with bright M&M candy and tan cookie dough clearly separated. M&Ms add vivid color pops against dark chocolate while dough chunks provide earthy warmth.
```

---

## M&m Swirl

Description: Chocolate Fresh Frozen Custard with M&M candy pieces.

Flavor fill:
```text
Flavor: M&m Swirl

Description:
Chocolate Fresh Frozen Custard with M&M candy pieces.

Ingredient treatment:
- Base custard color: Chocolate custard (#6F4E37).
- Swirls: None.
- Chunk inclusions: M and M candy pieces x1 (#FF7D7D)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated.
```

Canonical profile:
- Base key: `chocolate`
- Ribbon key: `none`
- Toppings: `m_and_m`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Rich chocolate custard with warm cocoa tones (#6F4E37 with #5C3E2B shadow depth).
- Swirls: None -- pure chocolate base with candy inclusions.
- Chunk inclusions: Bright multicolor M&M candy pieces with glossy rounded shells in red, yellow, green, blue (#FF7D7D).
- Texture notes: Standard inclusion depth with M&M pieces evenly distributed. Bright candy shell colors pop vividly against the dark chocolate base. Each candy piece a different hue for rainbow effect.
```

---

## Maple Pecan

Description: Maple Fresh Frozen Custard with pecan pieces.

Flavor fill:
```text
Flavor: Maple Pecan

Description:
Maple Fresh Frozen Custard with pecan pieces.

Ingredient treatment:
- Base custard color: maple (#C9882C).
- Swirls: None.
- Chunk inclusions: Pecan pieces x1 (#8B5A2B)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated.
```

Canonical profile:
- Base key: `maple`
- Ribbon key: `none`
- Toppings: `pecan`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm amber maple custard with golden-brown depth (#C9882C with deeper #B47A24 shadow tones).
- Swirls: None -- pure maple base with pecan inclusions.
- Chunk inclusions: Rich brown pecan pieces with natural wood-grain texture and warm saddle-brown surfaces (#8B5A2B).
- Texture notes: Standard inclusion depth with pecan pieces naturally distributed. Brown pecans blend warmly with the amber maple base while remaining distinct through texture difference -- rough nut vs smooth custard.
```

---

## Midnight Toffee

Description: Dark Chocolate Fresh Frozen Custard with Heath toffee bits.

Flavor fill:
```text
Flavor: Midnight Toffee

Description:
Dark Chocolate Fresh Frozen Custard with Heath toffee bits.

Ingredient treatment:
- Base custard color: Dark chocolate custard (#3B1F0B).
- Swirls: None.
- Chunk inclusions: Heath toffee bits x1 (#DAA520)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated.
```

Canonical profile:
- Base key: `dark_chocolate`
- Ribbon key: `none`
- Toppings: `heath`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Deep dark chocolate custard with near-black velvety richness (#3B1F0B with warm #4A2D18 crown highlights).
- Swirls: None -- pure dark chocolate base with toffee inclusions.
- Chunk inclusions: Golden Heath toffee bits with amber crystalline edges and glossy caramel sheen (#DAA520).
- Texture notes: Standard inclusion depth with toffee bits evenly spread. Bright golden Heath pieces create dramatic contrast against the ultra-dark chocolate base -- the strongest light-dark contrast in the lineup.
```

---

## Mint Cookie

Description: Mint Fresh Frozen Custard with cookie pieces.

Flavor fill:
```text
Flavor: Mint Cookie

Description:
Mint Fresh Frozen Custard with cookie pieces.

Ingredient treatment:
- Base custard color: Mint custard (#2ECC71).
- Swirls: None.
- Chunk inclusions: OREO cookie chunks x1 (#1A1A1A)
- Texture notes: Emphasize the primary inclusion with repeated chunks near top and mid scoop.
```

Canonical profile:
- Base key: `mint`
- Ribbon key: `none`
- Toppings: `oreo`
- Density: `double`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Bright mint-green custard with cool fresh tones (#2ECC71 with slightly deeper #28B563 in shadows).
- Swirls: None -- pure mint base with double-portion cookie inclusions.
- Chunk inclusions: Dark OREO cookie chunks with near-black surfaces and visible cream filling layers, doubled for density (#1A1A1A).
- Texture notes: Emphasize the primary inclusion with OREO pieces repeated near top and mid scoop. Dark cookie chunks against bright mint create strong contrast. Double portion means denser coverage.
```

---

## Mint Explosion

Description: Mint Fresh Frozen Custard with OREO cookie pieces and fudge.

Flavor fill:
```text
Flavor: Mint Explosion

Description:
Mint Fresh Frozen Custard with OREO cookie pieces and fudge.

Ingredient treatment:
- Base custard color: Mint custard (#2ECC71).
- Swirls: None.
- Chunk inclusions: OREO cookie chunks x1 (#1A1A1A); Andes mint pieces x1 (#0A3726); Dark chocolate chunks x1 (#2B1A12)
- Texture notes: Dense inclusion field with layered depth while keeping each ingredient readable.
```

Canonical profile:
- Base key: `mint`
- Ribbon key: `none`
- Toppings: `oreo, andes, dove`
- Density: `explosion`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Bright mint-green custard with vibrant cool tones (#2ECC71 with deeper #25A85E in shadows).
- Swirls: None -- pure mint base with dense multi-ingredient inclusion field.
- Chunk inclusions: Dark OREO cookie chunks with visible cream filling layers (#1A1A1A); bright Andes mint pieces with green-white layered striping (#0A3726); dark chocolate Dove chunks with glossy cocoa facets (#2B1A12).
- Texture notes: Dense inclusion field with layered depth while keeping each ingredient readable. Three dark-toned ingredients at slightly different values create depth against the bright mint base. OREO is near-black, Andes is deep green, Dove is dark brown.
```

---

## Mooey Gooey Twist

Description: Chocolate Fresh Frozen Custard with caramel swirl and cookie dough chunks.

Flavor fill:
```text
Flavor: Mooey Gooey Twist

Description:
Chocolate Fresh Frozen Custard with caramel swirl and cookie dough chunks.

Ingredient treatment:
- Base custard color: Chocolate custard (#6F4E37).
- Swirls: Caramel ribbon (#D38B2C).
- Chunk inclusions: Cookie dough chunks x1 (#917C60)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `chocolate`
- Ribbon key: `caramel`
- Toppings: `cookie_dough`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Rich chocolate custard with warm cocoa depth (#6F4E37 with #5A3825 shadow tones).
- Swirls: Glossy amber caramel ribbon with golden translucent edges winding through the chocolate (#D38B2C).
- Chunk inclusions: Tan cookie dough chunks with speckled chocolate-chip flecks and soft rounded edges (#917C60).
- Texture notes: Balanced depth with bright caramel ribbon creating golden paths through dark chocolate. Cookie dough chunks add warm tan accents. Three distinct tones -- dark base, golden ribbon, tan chunks.
```

---

## Mudd Pie

Description: Espresso Fresh Frozen Custard with fudge swirl, OREO cookie chunks, and cookie crumbles.

Flavor fill:
```text
Flavor: Mudd Pie

Description:
Espresso Fresh Frozen Custard with fudge swirl, OREO cookie chunks, and cookie crumbles.

Ingredient treatment:
- Base custard color: espresso (#2C1503).
- Swirls: Fudge ribbon (#3B1F0B).
- Chunk inclusions: OREO cookie chunks x1 (#1A1A1A); cookie_crumbs x1 (#7B5B32)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `espresso`
- Ribbon key: `fudge`
- Toppings: `oreo, cookie_crumbs`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Dark espresso custard with deep coffee-brown richness (#2C1503 with warm #3A2010 crown highlights).
- Swirls: Near-black fudge ribbon with matte chocolate depth threading through the dark espresso base (#3B1F0B).
- Chunk inclusions: Dark OREO cookie chunks with near-black surfaces and cream filling streaks (#1A1A1A); dark sandy cookie crumbles with granular texture (#7B5B32).
- Texture notes: Standard inclusion depth with dark-on-dark ingredients requiring careful contrast. Fudge ribbon distinguished by sheen difference from base. OREO is cooler black, cookie crumbles are warmer brown. Layer these carefully against espresso.
```

---

## Nestle Crunch Swirl

Description: Vanilla Fresh Frozen Custard with chocolate syrup swirl and cookie crumbles.

Flavor fill:
```text
Flavor: Nestle Crunch Swirl

Description:
Vanilla Fresh Frozen Custard with chocolate syrup swirl and cookie crumbles.

Ingredient treatment:
- Base custard color: Vanilla custard (#F5DEB3).
- Swirls: Chocolate syrup ribbon (#1A0A00).
- Chunk inclusions: cookie_crumbs x1 (#7B5B32)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `vanilla`
- Ribbon key: `chocolate_syrup`
- Toppings: `cookie_crumbs`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm vanilla custard with creamy wheat tones (#F5DEB3 with golden #EDD9A3 highlights).
- Swirls: Near-black chocolate syrup ribbon with glossy wet sheen threading through the vanilla (#1A0A00).
- Chunk inclusions: Dark sandy cookie crumbles with granular toasted texture and warm brown surfaces (#7B5B32).
- Texture notes: Balanced depth with dark chocolate syrup ribbon creating strong contrast lines through pale vanilla. Cookie crumbles add warm granular texture at a middle tone between syrup and base.
```

---

## Nutty Caramel Apple

Description: Caramel Fresh Frozen Custard with pecans and caramel chips.

Flavor fill:
```text
Flavor: Nutty Caramel Apple

Description:
Caramel Fresh Frozen Custard with pecans and caramel chips.

Ingredient treatment:
- Base custard color: Caramel custard (#C68E17).
- Swirls: None.
- Chunk inclusions: Pecan pieces x1 (#8B5A2B); caramel_chips x1 (#9E6B23)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated.
```

Canonical profile:
- Base key: `caramel`
- Ribbon key: `none`
- Toppings: `pecan, caramel_chips`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Rich caramel custard with warm golden-amber depth (#C68E17 with deeper #B07D12 undertones).
- Swirls: None -- pure caramel base with nut and candy inclusions.
- Chunk inclusions: Brown pecan pieces with natural wood-grain texture (#8B5A2B); deep amber caramel chips with glossy crystalline edges (#9E6B23).
- Texture notes: Balanced two-ingredient spread with pecans and caramel chips in similar warm tones but different textures. Pecans are matte and irregular, caramel chips are glossy and angular.
```

---

## Orange Creamsicle

Description: Orange Fresh Frozen Custard with a smooth creamsicle flavor.

Flavor fill:
```text
Flavor: Orange Creamsicle

Description:
Orange Fresh Frozen Custard with a smooth creamsicle flavor.

Ingredient treatment:
- Base custard color: orange (#FF8C00).
- Swirls: None.
- Chunk inclusions: None (clean scoop with no chunk inclusions).
- Texture notes: Smooth scoop with low inclusion noise. Keep texture subtle and creamy.
```

Canonical profile:
- Base key: `orange`
- Ribbon key: `none`
- Toppings: `none`
- Density: `pure`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Bright dark-orange custard with vivid citrus warmth (#FF8C00 with slightly deeper #E67E00 shadows).
- Swirls: None -- pure orange base with subtle cream-white highlight gradients suggesting creamsicle character.
- Chunk inclusions: None -- clean scoop with no inclusions.
- Texture notes: Smooth scoop with low inclusion noise. Emphasize the vivid orange with gentle gradients from deeper orange at the base to brighter, almost cream-touched highlights at the crown. Creamsicle effect through subtle white-orange transitions.
```

---

## OREO Cheesecake

Description: Cheesecake Fresh Frozen Custard with OREO cookie pieces.

Flavor fill:
```text
Flavor: OREO Cheesecake

Description:
Cheesecake Fresh Frozen Custard with OREO cookie pieces.

Ingredient treatment:
- Base custard color: Cheesecake custard (#FFF5E1).
- Swirls: None.
- Chunk inclusions: OREO cookie chunks x1 (#1A1A1A)
- Texture notes: Emphasize the primary inclusion with repeated chunks near top and mid scoop.
```

Canonical profile:
- Base key: `cheesecake`
- Ribbon key: `none`
- Toppings: `oreo`
- Density: `double`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm ivory cheesecake custard with buttery cream tones (#FFF5E1 with slightly deeper #F5EBD0 shadows).
- Swirls: None -- pure cheesecake base with double-portion OREO inclusions.
- Chunk inclusions: Dark OREO cookie chunks with near-black surfaces and visible cream filling layers, doubled for density (#1A1A1A).
- Texture notes: Emphasize the primary inclusion with OREO pieces repeated near top and mid scoop. Extreme dark-on-light contrast between near-black cookies and pale cheesecake base. Double portion creates dense cookie coverage.
```

---

## OREO Cookie Cheesecake

Description: Cheesecake Fresh Frozen Custard with OREO cookie pieces.

Flavor fill:
```text
Flavor: OREO Cookie Cheesecake

Description:
Cheesecake Fresh Frozen Custard with OREO cookie pieces.

Ingredient treatment:
- Base custard color: Cheesecake custard (#FFF5E1).
- Swirls: None.
- Chunk inclusions: OREO cookie chunks x1 (#1A1A1A)
- Texture notes: Emphasize the primary inclusion with repeated chunks near top and mid scoop.
```

Canonical profile:
- Base key: `cheesecake`
- Ribbon key: `none`
- Toppings: `oreo`
- Density: `double`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm ivory cheesecake custard with buttery cream depth (#FFF5E1 with #F5EBD0 gentle shadows).
- Swirls: None -- pure cheesecake base with double-portion OREO inclusions.
- Chunk inclusions: Dark OREO cookie chunks with near-black surfaces and visible cream filling layers, doubled for density (#1A1A1A).
- Texture notes: Emphasize the primary inclusion with OREO pieces repeated near top and mid scoop. Near-black OREO against pale cheesecake creates maximum contrast. Double portion means dense cookie field.
```

---

## OREO Cookie Overload

Description: Chocolate Fresh Frozen Custard overloaded with OREO cookie pieces and chocolate syrup.

Flavor fill:
```text
Flavor: OREO Cookie Overload

Description:
Chocolate Fresh Frozen Custard overloaded with OREO cookie pieces and chocolate syrup.

Ingredient treatment:
- Base custard color: Chocolate custard (#6F4E37).
- Swirls: Chocolate syrup ribbon (#1A0A00).
- Chunk inclusions: OREO cookie chunks x1 (#1A1A1A)
- Texture notes: Very dense single-ingredient distribution across the scoop surface. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `chocolate`
- Ribbon key: `chocolate_syrup`
- Toppings: `oreo`
- Density: `overload`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Rich chocolate custard with warm cocoa tones (#6F4E37 with #5A3825 deeper shadows).
- Swirls: Near-black chocolate syrup ribbon with glossy wet sheen draping through the scoop (#1A0A00).
- Chunk inclusions: Dense field of dark OREO cookie chunks with near-black surfaces and cream filling streaks, overloaded across the entire scoop surface (#1A1A1A).
- Texture notes: Very dense single-ingredient distribution across the scoop surface. OREO pieces crowd every surface area with minimal exposed custard. Chocolate syrup ribbon adds wet-vs-matte variation among the dark tones.
```

---

## PB Brownie

Description: Chocolate Fresh Frozen Custard with peanut butter swirl and brownie chunks.

Flavor fill:
```text
Flavor: PB Brownie

Description:
Chocolate Fresh Frozen Custard with peanut butter swirl and brownie chunks.

Ingredient treatment:
- Base custard color: Chocolate custard (#6F4E37).
- Swirls: Peanut butter swirl (#D4A017).
- Chunk inclusions: Brownie chunks x1 (#ADA59C)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `chocolate`
- Ribbon key: `peanut_butter`
- Toppings: `brownie`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Rich chocolate custard with warm cocoa depth (#6F4E37 with #5C3E2B shadow tones).
- Swirls: Golden peanut butter swirl with thick matte amber texture winding through the chocolate (#D4A017).
- Chunk inclusions: Fudgy brownie chunks with moist cracked surfaces and lighter cocoa contrast (#ADA59C).
- Texture notes: Balanced depth with bright peanut butter swirl creating golden paths through dark chocolate. Brownie chunks add texture variation. Keep peanut butter ribbon visible through inclusions.
```

---

## Peanut Butter Cookie Dough

Description: Vanilla Fresh Frozen Custard with peanut butter swirl and cookie dough chunks.

Flavor fill:
```text
Flavor: Peanut Butter Cookie Dough

Description:
Vanilla Fresh Frozen Custard with peanut butter swirl and cookie dough chunks.

Ingredient treatment:
- Base custard color: Vanilla custard (#F5DEB3).
- Swirls: Peanut butter swirl (#D4A017).
- Chunk inclusions: Cookie dough chunks x1 (#917C60)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `vanilla`
- Ribbon key: `peanut_butter`
- Toppings: `cookie_dough`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm vanilla custard with creamy wheat highlights (#F5DEB3 with golden #EDD9A3 depth).
- Swirls: Golden peanut butter swirl with thick matte amber texture threading through the scoop (#D4A017).
- Chunk inclusions: Tan cookie dough chunks with speckled chocolate-chip flecks and soft rounded shapes (#917C60).
- Texture notes: Balanced depth with peanut butter swirl and cookie dough pieces in similar warm tones. Swirl is smooth and matte while dough is chunky with visible chocolate-chip specks. Both warm against pale vanilla.
```

---

## Peanut Butter Cup

Description: Chocolate Fresh Frozen Custard with peanut butter cup pieces.

Flavor fill:
```text
Flavor: Peanut Butter Cup

Description:
Chocolate Fresh Frozen Custard with peanut butter cup pieces.

Ingredient treatment:
- Base custard color: Chocolate custard (#6F4E37).
- Swirls: Peanut butter swirl (#D4A017).
- Chunk inclusions: Reese's cup pieces x1 (#D4A017)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `chocolate`
- Ribbon key: `peanut_butter`
- Toppings: `reeses`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Rich chocolate custard with warm cocoa depth (#6F4E37 with #5C3E2B undertones).
- Swirls: Golden peanut butter swirl with thick matte amber texture winding through the chocolate (#D4A017).
- Chunk inclusions: Golden-amber Reese's cup pieces with layered peanut butter and chocolate visible at broken edges (#D4A017).
- Texture notes: Balanced depth with peanut butter swirl and Reese's pieces creating bright golden contrast against dark chocolate. Swirl and cup pieces share similar golden tone but differ in texture -- smooth vs chunky.
```

---

## Pecan Toffee Crunch

Description: Vanilla Fresh Frozen Custard with pecan pieces and Heath toffee bits.

Flavor fill:
```text
Flavor: Pecan Toffee Crunch

Description:
Vanilla Fresh Frozen Custard with pecan pieces and Heath toffee bits.

Ingredient treatment:
- Base custard color: Vanilla custard (#F5DEB3).
- Swirls: None.
- Chunk inclusions: Pecan pieces x1 (#8B5A2B); Heath toffee bits x1 (#DAA520)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated.
```

Canonical profile:
- Base key: `vanilla`
- Ribbon key: `none`
- Toppings: `pecan, heath`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm vanilla custard with creamy wheat tones (#F5DEB3 with golden #EDD9A3 highlights).
- Swirls: None -- pure vanilla base with two warm-toned inclusions.
- Chunk inclusions: Rich brown pecan pieces with natural wood-grain texture (#8B5A2B); golden Heath toffee bits with amber crystalline edges and glossy caramel sheen (#DAA520).
- Texture notes: Balanced two-ingredient spread with brown pecans and golden toffee clearly separated. Both warm-toned but pecans are darker and matte while toffee is brighter and glossy. Strong contrast against pale vanilla.
```

---

## Pistachio

Description: Pistachio Fresh Frozen Custard with a smooth, nutty flavor.

Flavor fill:
```text
Flavor: Pistachio

Description:
Pistachio Fresh Frozen Custard with a smooth, nutty flavor.

Ingredient treatment:
- Base custard color: pistachio (#93C572).
- Swirls: None.
- Chunk inclusions: None (clean scoop with no chunk inclusions).
- Texture notes: Smooth scoop with low inclusion noise. Keep texture subtle and creamy.
```

Canonical profile:
- Base key: `pistachio`
- Ribbon key: `none`
- Toppings: `none`
- Density: `pure`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Muted sage-green pistachio custard with earthy cool tones (#93C572 with slightly deeper #82B462 in shadows).
- Swirls: None -- pure pistachio base with subtle natural green gradients.
- Chunk inclusions: None -- clean scoop with no inclusions.
- Texture notes: Smooth scoop with low inclusion noise. Emphasize the distinctive sage-green color with gentle gradients from deeper muted green at the base to brighter, lighter green at the crown. Earthy and natural with soft creaminess.
```

---

## Polar Bear Tracks

Description: Vanilla Fresh Frozen Custard with fudge swirl and Reese's cup pieces.

Flavor fill:
```text
Flavor: Polar Bear Tracks

Description:
Vanilla Fresh Frozen Custard with fudge swirl and Reese's cup pieces.

Ingredient treatment:
- Base custard color: Vanilla custard (#F5DEB3).
- Swirls: Fudge ribbon (#3B1F0B).
- Chunk inclusions: Reese's cup pieces x1 (#D4A017)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `vanilla`
- Ribbon key: `fudge`
- Toppings: `reeses`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm vanilla custard with creamy wheat highlights (#F5DEB3 with golden #EDD9A3 depth).
- Swirls: Near-black fudge ribbon with matte chocolate depth threading through the vanilla (#3B1F0B).
- Chunk inclusions: Golden-amber Reese's cup pieces with layered peanut butter and chocolate visible at broken edges (#D4A017).
- Texture notes: Balanced depth with dark fudge ribbon creating strong contrast paths through pale vanilla. Reese's pieces add warm golden accents. Three-tone layering -- pale base, dark ribbon, golden chunks.
```

---

## Pumpkin Pecan

Description: Pumpkin Fresh Frozen Custard with pecan pieces and pumpkin spice.

Flavor fill:
```text
Flavor: Pumpkin Pecan

Description:
Pumpkin Fresh Frozen Custard with pecan pieces and pumpkin spice.

Ingredient treatment:
- Base custard color: pumpkin (#D2691E).
- Swirls: None.
- Chunk inclusions: Pecan pieces x1 (#8B5A2B); pumpkin_spice x1 (#6B3410)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated.
```

Canonical profile:
- Base key: `pumpkin`
- Ribbon key: `none`
- Toppings: `pecan, pumpkin_spice`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm orange-brown pumpkin custard with autumn spice depth (#D2691E with deeper #B85B18 shadow tones).
- Swirls: None -- pure pumpkin base with nut and spice inclusions.
- Chunk inclusions: Rich brown pecan pieces with natural wood-grain texture (#8B5A2B); dark cinnamon-sienna pumpkin spice specks scattered as fine accent particles (#6B3410).
- Texture notes: Balanced inclusion spread with pecan pieces and fine pumpkin spice specks. Pecans provide larger texture while spice particles add fine detail. All in warm autumn tones against the orange-brown base.
```

---

## Pumpkin Pie

Description: Pumpkin Fresh Frozen Custard with graham cracker crumbles and pumpkin spice.

Flavor fill:
```text
Flavor: Pumpkin Pie

Description:
Pumpkin Fresh Frozen Custard with graham cracker crumbles and pumpkin spice.

Ingredient treatment:
- Base custard color: pumpkin (#D2691E).
- Swirls: None.
- Chunk inclusions: graham_cracker x1 (#8B6914); pumpkin_spice x1 (#6B3410)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated.
```

Canonical profile:
- Base key: `pumpkin`
- Ribbon key: `none`
- Toppings: `graham_cracker, pumpkin_spice`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm orange-brown pumpkin custard with autumn depth (#D2691E with #B85B18 deeper undertones).
- Swirls: None -- pure pumpkin base with pie-crust and spice inclusions.
- Chunk inclusions: Golden graham cracker crumbles with toasty amber surfaces (#8B6914); dark cinnamon-sienna pumpkin spice specks as fine accent particles (#6B3410).
- Texture notes: Balanced depth with graham cracker pieces suggesting pie crust and pumpkin spice adding fine warm specks. Autumn-palette harmony -- orange base, golden crumbles, dark cinnamon accents.
```

---

## Raspberry Cheesecake

Description: Cheesecake Fresh Frozen Custard with raspberry sauce.

Flavor fill:
```text
Flavor: Raspberry Cheesecake

Description:
Cheesecake Fresh Frozen Custard with raspberry sauce.

Ingredient treatment:
- Base custard color: Cheesecake custard (#FFF5E1).
- Swirls: None.
- Chunk inclusions: Raspberry pieces x1 (#E91E63)
- Texture notes: Emphasize the primary inclusion with repeated chunks near top and mid scoop.
```

Canonical profile:
- Base key: `cheesecake`
- Ribbon key: `none`
- Toppings: `raspberry`
- Density: `double`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm ivory cheesecake custard with buttery cream tones (#FFF5E1 with #F5EBD0 gentle shadows).
- Swirls: None -- pure cheesecake base with double-portion raspberry inclusions.
- Chunk inclusions: Bright magenta-pink raspberry pieces with vivid berry color and natural seed-textured surfaces (#E91E63).
- Texture notes: Emphasize the primary inclusion with raspberry pieces doubled near top and mid scoop. Vibrant pink-magenta fruit against pale ivory cheesecake creates vivid color pop. Fruit pieces have organic shapes.
```

---

## Raspberry Cordial

Description: Vanilla Fresh Frozen Custard with raspberry pieces and dark chocolate chunks.

Flavor fill:
```text
Flavor: Raspberry Cordial

Description:
Vanilla Fresh Frozen Custard with raspberry pieces and dark chocolate chunks.

Ingredient treatment:
- Base custard color: Vanilla custard (#F5DEB3).
- Swirls: None.
- Chunk inclusions: Raspberry pieces x1 (#E91E63); Dark chocolate chunks x1 (#2B1A12)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated.
```

Canonical profile:
- Base key: `vanilla`
- Ribbon key: `none`
- Toppings: `raspberry, dove`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm vanilla custard with creamy wheat tones (#F5DEB3 with golden #EDD9A3 highlights).
- Swirls: None -- pure vanilla base with berry and chocolate inclusions.
- Chunk inclusions: Bright magenta-pink raspberry pieces with vivid berry color (#E91E63); dark chocolate Dove chunks with glossy broken-bar facets (#2B1A12).
- Texture notes: Balanced two-ingredient spread with bright raspberry and dark chocolate clearly separated. Pink-on-cream and dark-on-cream create elegant dual-tone contrast against the pale vanilla body.
```

---

## Really Reese's

Description: Chocolate Fresh Frozen Custard with Reese's peanut butter cup pieces.

Flavor fill:
```text
Flavor: Really Reese's

Description:
Chocolate Fresh Frozen Custard with Reese's peanut butter cup pieces.

Ingredient treatment:
- Base custard color: Chocolate custard (#6F4E37).
- Swirls: Peanut butter swirl (#D4A017).
- Chunk inclusions: Reese's cup pieces x1 (#D4A017)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `chocolate`
- Ribbon key: `peanut_butter`
- Toppings: `reeses`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Rich chocolate custard with warm cocoa depth (#6F4E37 with #5C3E2B undertones).
- Swirls: Golden peanut butter swirl with thick matte amber texture winding through the chocolate (#D4A017).
- Chunk inclusions: Golden-amber Reese's cup pieces with layered peanut butter and chocolate visible at broken edges (#D4A017).
- Texture notes: Balanced depth with peanut butter swirl and Reese's pieces in matching golden tones against dark chocolate. Swirl is smooth, cups are chunky with cross-section detail. Strong warm-dark contrast.
```

---

## Red Raspberry

Description: Vanilla Fresh Frozen Custard with raspberry pieces.

Flavor fill:
```text
Flavor: Red Raspberry

Description:
Vanilla Fresh Frozen Custard with raspberry pieces.

Ingredient treatment:
- Base custard color: Vanilla custard (#F5DEB3).
- Swirls: None.
- Chunk inclusions: Raspberry pieces x1 (#E91E63)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated.
```

Canonical profile:
- Base key: `vanilla`
- Ribbon key: `none`
- Toppings: `raspberry`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm vanilla custard with creamy wheat highlights (#F5DEB3 with #EDD9A3 golden depth).
- Swirls: None -- pure vanilla base with raspberry inclusions.
- Chunk inclusions: Bright magenta-pink raspberry pieces with vivid berry color and natural seed-textured surfaces (#E91E63).
- Texture notes: Standard inclusion depth with raspberry pieces naturally distributed. Bright magenta fruit pops vividly against the pale vanilla cream base. Fruit pieces have organic irregular shapes.
```

---

## Rice Krispie Treat

Description: Vanilla Fresh Frozen Custard with marshmallow swirl and cookie crumbles.

Flavor fill:
```text
Flavor: Rice Krispie Treat

Description:
Vanilla Fresh Frozen Custard with marshmallow swirl and cookie crumbles.

Ingredient treatment:
- Base custard color: Vanilla custard (#F5DEB3).
- Swirls: Marshmallow swirl (#FFFFFF).
- Chunk inclusions: cookie_crumbs x1 (#7B5B32)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `vanilla`
- Ribbon key: `marshmallow`
- Toppings: `cookie_crumbs`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm vanilla custard with creamy wheat tones (#F5DEB3 with golden #EDD9A3 highlights).
- Swirls: Bright white marshmallow swirl with fluffy pulled-taffy texture threading through the vanilla (#FFFFFF).
- Chunk inclusions: Dark sandy cookie crumbles standing in for crispy rice pieces with granular toasted texture (#7B5B32).
- Texture notes: Balanced depth with bright white marshmallow swirl weaving through pale vanilla. Darker cookie crumbles add warm texture points. Marshmallow and vanilla are both light but distinguishable by texture.
```

---

## Rocky Road

Description: Chocolate Fresh Frozen Custard with marshmallow swirl, cashew pieces, and chocolate chips.

Flavor fill:
```text
Flavor: Rocky Road

Description:
Chocolate Fresh Frozen Custard with marshmallow swirl, cashew pieces, and chocolate chips.

Ingredient treatment:
- Base custard color: Chocolate custard (#6F4E37).
- Swirls: Marshmallow swirl (#FFFFFF).
- Chunk inclusions: Cashew pieces x1 (#897E6C); chocolate_chip x1 (#3B2314)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `chocolate`
- Ribbon key: `marshmallow`
- Toppings: `cashew, chocolate_chip`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Rich chocolate custard with warm cocoa depth (#6F4E37 with #5C3E2B shadow tones).
- Swirls: Bright white marshmallow swirl with fluffy pulled texture winding through the chocolate (#FFFFFF).
- Chunk inclusions: Smooth ivory cashew pieces with pale cream surfaces (#897E6C); tiny dark chocolate chips with glossy pointed shapes (#3B2314).
- Texture notes: Balanced multi-ingredient depth with bright marshmallow swirl creating white paths between cashew and chocolate chip inclusions. Light cashew, bright marshmallow, and dark chips create three-tone layering against chocolate.
```

---

## Root Beer Float

Description: Root Beer Fresh Frozen Custard with marshmallow bits.

Flavor fill:
```text
Flavor: Root Beer Float

Description:
Root Beer Fresh Frozen Custard with marshmallow bits.

Ingredient treatment:
- Base custard color: root_beer (#5C3317).
- Swirls: None.
- Chunk inclusions: marshmallow_bits x1 (#FFFAED)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated.
```

Canonical profile:
- Base key: `root_beer`
- Ribbon key: `none`
- Toppings: `marshmallow_bits`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Deep amber-brown root beer custard with warm cola-like depth (#5C3317 with lighter #6E4020 crown highlights).
- Swirls: None -- pure root beer base with marshmallow foam-like inclusions.
- Chunk inclusions: Warm white marshmallow bits with soft fluffy shapes suggesting root beer float foam (#FFFAED).
- Texture notes: Standard inclusion depth with marshmallow bits distributed naturally. Pale marshmallow pieces against the dark amber root beer base recreate the visual of foam on a root beer float. Strong light-dark contrast.
```

---

## Salted Caramel Pecan Pie

Description: Salted Caramel Fresh Frozen Custard with pecan pie pieces.

Flavor fill:
```text
Flavor: Salted Caramel Pecan Pie

Description:
Salted Caramel Fresh Frozen Custard with pecan pie pieces.

Ingredient treatment:
- Base custard color: Caramel custard (#C68E17).
- Swirls: None.
- Chunk inclusions: Pecan pieces x1 (#8B5A2B); Salt crystals x1 (#4B4B4B); Pie crust pieces x1 (#C99E76)
- Texture notes: Dense inclusion field with layered depth while keeping each ingredient readable.
```

Canonical profile:
- Base key: `caramel`
- Ribbon key: `none`
- Toppings: `pecan, salt, pie_crust`
- Density: `explosion`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Rich caramel custard with warm golden-amber depth (#C68E17 with deeper #B07D12 shadow tones).
- Swirls: None -- pure caramel base with dense multi-ingredient inclusion field.
- Chunk inclusions: Brown pecan pieces with natural wood-grain texture (#8B5A2B); crystalline salt flakes with translucent grey-white sparkle (#4B4B4B); golden pie crust crumbles with toasty warm surfaces (#C99E76).
- Texture notes: Dense inclusion field with layered depth. Three ingredients in warm tones -- brown pecans, grey-white salt crystals, golden crust -- create visual depth against the golden caramel base. Salt crystals add tiny sparkle points.
```

---

## Salted Double Caramel Pecan

Description: Ribbons of old fashioned salted caramel swirled into Caramel Fresh Frozen Custard and mixed with toasted pecan pieces.

Flavor fill:
```text
Flavor: Salted Double Caramel Pecan

Description:
Ribbons of old fashioned salted caramel swirled into Caramel Fresh Frozen Custard and mixed with toasted pecan pieces.

Ingredient treatment:
- Base custard color: Vanilla custard (#F5DEB3).
- Swirls: Caramel ribbon (#D38B2C).
- Chunk inclusions: Pecan pieces x1 (#8B5A2B); Salt crystals x1 (#4B4B4B)
- Texture notes: Emphasize the primary inclusion with repeated chunks near top and mid scoop. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `vanilla`
- Ribbon key: `caramel`
- Toppings: `pecan, salt`
- Density: `double`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm vanilla custard with creamy wheat tones (#F5DEB3 with golden #EDD9A3 depth).
- Swirls: Glossy amber caramel ribbon with golden translucent edges -- double-width for emphasis (#D38B2C).
- Chunk inclusions: Brown pecan pieces with natural wood-grain texture (#8B5A2B); crystalline salt flakes with translucent grey-white sparkle (#4B4B4B).
- Texture notes: Emphasize the primary inclusion with caramel ribbon extra prominent. Double caramel means wider, more visible golden paths. Pecan pieces and salt crystals add warm and cool accent points respectively.
```

---

## Snickers Swirl

Description: Chocolate Fresh Frozen Custard with Snickers bar pieces and caramel.

Flavor fill:
```text
Flavor: Snickers Swirl

Description:
Chocolate Fresh Frozen Custard with Snickers bar pieces and caramel.

Ingredient treatment:
- Base custard color: Chocolate custard (#6F4E37).
- Swirls: Caramel ribbon (#D38B2C).
- Chunk inclusions: Snickers pieces x1 (#C4A060)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `chocolate`
- Ribbon key: `caramel`
- Toppings: `snickers`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Rich chocolate custard with warm cocoa depth (#6F4E37 with #5C3E2B undertones).
- Swirls: Glossy amber caramel ribbon with golden translucent edges winding through the chocolate (#D38B2C).
- Chunk inclusions: Snickers bar pieces with visible layers of nougat, caramel, and peanuts in cross-section with golden-tan color (#C4A060).
- Texture notes: Balanced depth with bright caramel ribbon creating golden paths through dark chocolate. Snickers pieces show internal layering at broken edges. Warm golden tones contrast against dark cocoa base.
```

---

## Strawberry Cheesecake

Description: Cheesecake Fresh Frozen Custard with strawberry sauce.

Flavor fill:
```text
Flavor: Strawberry Cheesecake

Description:
Cheesecake Fresh Frozen Custard with strawberry sauce.

Ingredient treatment:
- Base custard color: Cheesecake custard (#FFF5E1).
- Swirls: None.
- Chunk inclusions: Strawberry bits x1 (#A10E2B)
- Texture notes: Emphasize the primary inclusion with repeated chunks near top and mid scoop.
```

Canonical profile:
- Base key: `cheesecake`
- Ribbon key: `none`
- Toppings: `strawberry_bits`
- Density: `double`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm ivory cheesecake custard with buttery cream tones (#FFF5E1 with slightly deeper #F5EBD0 shadows).
- Swirls: None -- pure cheesecake base with double-portion strawberry inclusions.
- Chunk inclusions: Deep red strawberry bits with vivid crimson surfaces and natural fruit shapes (#A10E2B).
- Texture notes: Emphasize the primary inclusion with strawberry pieces doubled near top and mid scoop. Deep red fruit bits against pale ivory cheesecake create vivid color pop. Fruit pieces have organic shapes.
```

---

## Tiramisu

Description: Espresso Fresh Frozen Custard with marshmallow swirl, cake pieces, and dark chocolate chunks.

Flavor fill:
```text
Flavor: Tiramisu

Description:
Espresso Fresh Frozen Custard with marshmallow swirl, cake pieces, and dark chocolate chunks.

Ingredient treatment:
- Base custard color: espresso (#2C1503).
- Swirls: Marshmallow swirl (#FFFFFF).
- Chunk inclusions: Chocolate cake chunks x1 (#4A2800); Dark chocolate chunks x1 (#2B1A12)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `espresso`
- Ribbon key: `marshmallow`
- Toppings: `cake, dove`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Dark espresso custard with deep coffee-brown richness (#2C1503 with warm #3A2010 crown highlights).
- Swirls: Bright white marshmallow swirl with soft fluffy texture representing mascarpone cream (#FFFFFF).
- Chunk inclusions: Deep brown cake chunks representing ladyfinger pieces with moist matte surfaces (#4A2800); dark chocolate Dove pieces with glossy cocoa facets (#2B1A12).
- Texture notes: Balanced depth with bright marshmallow cream swirl creating white paths through dark espresso. Cake and chocolate pieces in similar dark tones differ by surface finish -- matte vs glossy.
```

---

## Toffee Pecan

Description: Butter Pecan Fresh Frozen Custard with Heath toffee bits and pecan pieces.

Flavor fill:
```text
Flavor: Toffee Pecan

Description:
Butter Pecan Fresh Frozen Custard with Heath toffee bits and pecan pieces.

Ingredient treatment:
- Base custard color: Butter pecan custard (#F2E7D1).
- Swirls: None.
- Chunk inclusions: Heath toffee bits x1 (#DAA520); Pecan pieces x1 (#8B5A2B)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated.
```

Canonical profile:
- Base key: `butter_pecan`
- Ribbon key: `none`
- Toppings: `heath, pecan`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm butter pecan custard with toasty cream-gold tones (#F2E7D1 with slightly deeper #E5D5BE shadows).
- Swirls: None -- pure butter pecan base with two warm-toned inclusions.
- Chunk inclusions: Golden Heath toffee bits with amber crystalline edges and glossy caramel sheen (#DAA520); rich brown pecan pieces with natural wood-grain texture (#8B5A2B).
- Texture notes: Balanced two-ingredient spread with golden toffee and brown pecan pieces clearly separated. Both warm-toned but toffee is brighter and glossy while pecans are darker and matte.
```

---

## Triple Chocolate Kiss

Description: Dark Chocolate Fresh Frozen Custard with chocolate syrup swirl and dark chocolate chunks.

Flavor fill:
```text
Flavor: Triple Chocolate Kiss

Description:
Dark Chocolate Fresh Frozen Custard with chocolate syrup swirl and dark chocolate chunks.

Ingredient treatment:
- Base custard color: Dark chocolate custard (#3B1F0B).
- Swirls: Chocolate syrup ribbon (#1A0A00).
- Chunk inclusions: Dark chocolate chunks x1 (#2B1A12)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated. Keep ribbon visible through inclusions with clean edge contrast. Boost local contrast around dark chunks so ingredients stay readable.
```

Canonical profile:
- Base key: `dark_chocolate`
- Ribbon key: `chocolate_syrup`
- Toppings: `dove`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Deep dark chocolate custard with near-black velvety richness (#3B1F0B with warm #4A2D18 highlights).
- Swirls: Near-black chocolate syrup ribbon with glossy wet sheen threading through the dark base (#1A0A00).
- Chunk inclusions: Dark chocolate Dove chunks with glossy broken-bar facets and matte-to-shiny surface transitions (#2B1A12).
- Texture notes: Standard inclusion depth with dark-on-dark-on-dark layering. Chocolate syrup, dark chocolate base, and Dove chunks at three slightly different dark values. Distinguish each through sheen variation -- matte base, glossy syrup, semi-gloss chunks.
```

---

## Turtle

Description: Vanilla Fresh Frozen Custard with pecan pieces, caramel, and fudge.

Flavor fill:
```text
Flavor: Turtle

Description:
Vanilla Fresh Frozen Custard with pecan pieces, caramel, and fudge.

Ingredient treatment:
- Base custard color: Vanilla custard (#F5DEB3).
- Swirls: Caramel ribbon (#D38B2C).
- Chunk inclusions: Pecan pieces x1 (#8B5A2B); Dark chocolate chunks x1 (#2B1A12)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `vanilla`
- Ribbon key: `caramel`
- Toppings: `pecan, dove`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm vanilla custard with creamy wheat tones (#F5DEB3 with golden #EDD9A3 highlights).
- Swirls: Glossy amber caramel ribbon with golden translucent edges winding through the scoop (#D38B2C).
- Chunk inclusions: Rich brown pecan pieces with natural wood-grain texture (#8B5A2B); dark chocolate Dove chunks with glossy cocoa facets (#2B1A12).
- Texture notes: Balanced depth with caramel ribbon weaving between pecan and chocolate pieces. Three warm tones -- golden ribbon, brown pecans, dark chocolate -- create classic turtle layering against pale vanilla.
```

---

## Turtle Cheesecake

Description: Cheesecake Fresh Frozen Custard with pecan pieces, caramel, and fudge.

Flavor fill:
```text
Flavor: Turtle Cheesecake

Description:
Cheesecake Fresh Frozen Custard with pecan pieces, caramel, and fudge.

Ingredient treatment:
- Base custard color: Cheesecake custard (#FFF5E1).
- Swirls: Caramel ribbon (#D38B2C).
- Chunk inclusions: Pecan pieces x2 (#8B5A2B); Dark chocolate chunks x1 (#2B1A12)
- Texture notes: Dense inclusion field with layered depth while keeping each ingredient readable. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `cheesecake`
- Ribbon key: `caramel`
- Toppings: `pecan, dove, pecan`
- Density: `explosion`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm ivory cheesecake custard with buttery cream depth (#FFF5E1 with #F5EBD0 gentle shadows).
- Swirls: Glossy amber caramel ribbon with golden translucent edges threading through the cheesecake (#D38B2C).
- Chunk inclusions: Brown pecan pieces with natural wood-grain texture (#8B5A2B); dark chocolate Dove chunks with glossy cocoa facets (#2B1A12); additional pecan pieces layered through the scoop.
- Texture notes: Dense inclusion field with layered depth. Caramel ribbon weaves between pecan clusters and chocolate chunks. Classic turtle trio against pale cheesecake creates strong multi-tone contrast.
```

---

## Turtle Dove

Description: Chocolate and Vanilla Fresh Frozen Custard with pecan pieces, caramel, and fudge.

Flavor fill:
```text
Flavor: Turtle Dove

Description:
Chocolate and Vanilla Fresh Frozen Custard with pecan pieces, caramel, and fudge.

Ingredient treatment:
- Base custard color: Vanilla custard (#F5DEB3).
- Swirls: Marshmallow swirl (#FFFFFF).
- Chunk inclusions: Pecan pieces x1 (#8B5A2B); Dark chocolate chunks x1 (#2B1A12)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `vanilla`
- Ribbon key: `marshmallow`
- Toppings: `pecan, dove`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Warm vanilla custard with creamy wheat highlights (#F5DEB3 with golden #EDD9A3 depth).
- Swirls: Bright white marshmallow swirl with fluffy pulled texture winding through the vanilla (#FFFFFF).
- Chunk inclusions: Rich brown pecan pieces with natural wood-grain texture (#8B5A2B); dark chocolate Dove chunks with glossy broken-bar facets (#2B1A12).
- Texture notes: Balanced depth with bright marshmallow swirl weaving between brown pecan and dark chocolate pieces. Marshmallow and vanilla are both light but swirl is brighter white. Pecans and Dove at two different brown tones.
```

---

## Twix Mix

Description: Chocolate Fresh Frozen Custard with caramel swirl and cookie crumbles.

Flavor fill:
```text
Flavor: Twix Mix

Description:
Chocolate Fresh Frozen Custard with caramel swirl and cookie crumbles.

Ingredient treatment:
- Base custard color: Chocolate custard (#6F4E37).
- Swirls: Caramel ribbon (#D38B2C).
- Chunk inclusions: cookie_crumbs x1 (#7B5B32)
- Texture notes: Balanced texture depth with inclusions spread evenly and clearly separated. Keep ribbon visible through inclusions with clean edge contrast.
```

Canonical profile:
- Base key: `chocolate`
- Ribbon key: `caramel`
- Toppings: `cookie_crumbs`
- Density: `standard`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Rich chocolate custard with warm cocoa depth (#6F4E37 with #5C3E2B shadow tones).
- Swirls: Glossy amber caramel ribbon with golden translucent edges winding through the chocolate (#D38B2C).
- Chunk inclusions: Dark sandy cookie crumbles with granular texture representing crispy biscuit layers (#7B5B32).
- Texture notes: Balanced depth with bright caramel ribbon creating golden contrast paths through dark chocolate. Cookie crumbles add warm granular texture. Trio of dark base, golden ribbon, and warm crumbles.
```

---

## Vanilla

Description: Vanilla Fresh Frozen Custard.

Flavor fill:
```text
Flavor: Vanilla

Description:
Vanilla Fresh Frozen Custard.

Ingredient treatment:
- Base custard color: Vanilla custard (#F5DEB3).
- Swirls: None.
- Chunk inclusions: None (clean scoop with no chunk inclusions).
- Texture notes: Smooth scoop with low inclusion noise. Keep texture subtle and creamy.
```

Canonical profile:
- Base key: `vanilla`
- Ribbon key: `none`
- Toppings: `none`
- Density: `pure`

L5 premium override (showcase detail):
```text
Ingredient treatment:
- Base custard color: Classic warm vanilla custard with golden wheat tones (#F5DEB3 with slightly deeper #EDD9A3 in scoop shadows and brighter #FFF5E8 at crown).
- Swirls: None -- pure vanilla with subtle natural color depth variations.
- Chunk inclusions: None -- clean scoop with no inclusions.
- Texture notes: Smooth scoop with low inclusion noise. Emphasize the warm golden-cream color with gentle gradients from deeper wheat at the base to brighter cream at the crown. Classic custard surface with soft light reflections and creamy richness.
```
