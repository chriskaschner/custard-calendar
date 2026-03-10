# Unprofiled Flavors

**Total unprofiled: 54 flavors**
**Total profiled: 40 (FLAVOR_PROFILES) + 20 (FLAVOR_ALIASES) + ~24 (keyword fallback) = 84 coverage paths**

Sources:
- `culvers-fotd` = Active on culvers.com/flavor-of-the-day (current rotation)
- `seed-catalog` = SEED_CATALOG in flavor-catalog.js
- `map-fallback` = KNOWN_FLAVORS_FALLBACK in map.html
- `similarity-groups` = SIMILARITY_GROUPS in flavor-matcher.js
- `trivia-historical` = Historical/multi-brand flavors from trivia-metrics-seed.js

Note: The Culver's FOTD page lists "Red Raspberry" with the display name "Raspberry Cream" -- these are the same flavor. Description: "Creamy Vanilla Fresh Frozen Custard swirled with sweet raspberries."

---

## Chocolate Family (chocolate, dark_chocolate, chocolate_custard, espresso bases)

- **Brownie Batter Overload** -- base: chocolate, ribbon: null, toppings: [brownie], density: overload. Chocolate custard loaded with brownie pieces. [trivia-historical]
- **Brownie Explosion** -- base: chocolate, ribbon: marshmallow, toppings: [brownie, brownie, dove], density: explosion. Chocolate custard with brownie pieces and marshmallow. [trivia-historical]
- **Cappuccino Almond Fudge** -- base: espresso, ribbon: fudge, toppings: [cashew], density: standard. Espresso custard with almond (use cashew) and fudge ribbon. [trivia-historical]
- **Cappuccino Cookie Crumble** -- base: espresso, ribbon: null, toppings: [cookie_crumbs], density: standard. Espresso custard with cookie crumble pieces. [trivia-historical]
- **Cookies & Cream** -- base: vanilla, ribbon: null, toppings: [oreo], density: standard. NOTE: vanilla-based (Oreo cookies in vanilla custard), belongs in Vanilla family. Reclassified below.
- **Death by Chocolate** -- base: dark_chocolate, ribbon: chocolate_syrup, toppings: [brownie, dove], density: explosion. Dark chocolate custard with maximum chocolate toppings. [trivia-historical]
- **Double Marshmallow Oreo** -- base: chocolate, ribbon: marshmallow, toppings: [oreo], density: double. Chocolate custard with marshmallow and Oreo. [trivia-historical]
- **Grasshopper Fudge** -- base: mint, ribbon: fudge, toppings: [oreo], density: standard. NOTE: mint-based, belongs in Specialty family. Reclassified below.
- **M&M Cookie Dough** -- base: chocolate, ribbon: null, toppings: [m_and_m, cookie_dough], density: standard. Chocolate custard with M&M's and cookie dough. [trivia-historical]
- **M&M Swirl** -- base: chocolate, ribbon: null, toppings: [m_and_m], density: standard. Chocolate custard with M&M pieces. [trivia-historical]
- **Midnight Toffee** -- base: dark_chocolate, ribbon: null, toppings: [heath], density: standard. Dark chocolate custard with toffee/heath pieces. [trivia-historical]
- **Mooey Gooey Twist** -- base: chocolate, ribbon: caramel, toppings: [cookie_dough], density: standard. Chocolate and caramel custard twist with cookie dough. [trivia-historical]
- **Mudd Pie** -- base: espresso, ribbon: fudge, toppings: [oreo, cookie_crumbs], density: standard. Espresso/coffee custard with Oreo and cookie crust (mud pie base). [trivia-historical]
- **PB Brownie** -- base: chocolate, ribbon: peanut_butter, toppings: [brownie], density: standard. Chocolate custard with peanut butter and brownie. [trivia-historical]
- **Rocky Road** -- base: chocolate, ribbon: marshmallow, toppings: [cashew, chocolate_chip], density: standard. Chocolate custard with marshmallow, nuts, and chocolate chips. [trivia-historical]
- **Triple Chocolate Kiss** -- base: dark_chocolate, ribbon: chocolate_syrup, toppings: [dove], density: standard. Dark chocolate custard with chocolate syrup ribbon and chocolate pieces. [trivia-historical]
- **Twix Mix** -- base: chocolate, ribbon: caramel, toppings: [cookie_crumbs], density: standard. Chocolate custard with caramel and cookie crumbs (Twix bar). [trivia-historical]

**Chocolate family count: 15** (after reclassifying Cookies & Cream and Grasshopper Fudge)

---

## Vanilla Family (vanilla, butter_pecan bases)

- **Badger Claw** -- base: vanilla, ribbon: caramel, toppings: [cashew, fudge_bits], density: standard. Vanilla custard with caramel, cashew, and fudge. Similar to turtle but with cashews. [trivia-historical]
- **Butter Brickle** -- base: butter_pecan, ribbon: null, toppings: [heath], density: standard. Butter pecan custard with toffee/brickle pieces. [trivia-historical]
- **Butter Finger Blast** -- base: vanilla, ribbon: null, toppings: [butterfinger], density: standard. Vanilla custard with Butterfinger pieces. [trivia-historical]
- **Butterfinger Pecan** -- base: vanilla, ribbon: null, toppings: [butterfinger, pecan], density: standard. Vanilla custard with Butterfinger and pecan pieces. [trivia-historical]
- **Cashew Delight** -- base: vanilla, ribbon: caramel, toppings: [cashew], density: standard. Vanilla custard with caramel and cashew pieces. [trivia-historical]
- **Chunky Peanut Butter Dream** -- base: vanilla, ribbon: peanut_butter, toppings: [reeses], density: standard. Vanilla custard with chunky peanut butter and peanut butter cup pieces. [trivia-historical]
- **Cookie Dough Craving** -- base: vanilla, ribbon: null, toppings: [cookie_dough], density: standard. Vanilla custard with cookie dough pieces. [trivia-historical]
- **Cookies & Cream** -- base: vanilla, ribbon: null, toppings: [oreo], density: standard. Vanilla custard with Oreo cookie pieces. [trivia-historical]
- **Just Drummy** -- base: vanilla, ribbon: null, toppings: [cake], density: standard. Vanilla custard with drumstick/cake pieces. [trivia-historical]
- **Kit Kat Bar** -- base: vanilla, ribbon: null, toppings: [heath], density: standard. Vanilla custard with Kit Kat wafer pieces (use heath as closest). [trivia-historical]
- **Kit Kat Swirl** -- base: vanilla, ribbon: chocolate_syrup, toppings: [heath], density: standard. Vanilla custard with chocolate swirl and Kit Kat pieces. [trivia-historical]
- **Nestle Crunch Swirl** -- base: vanilla, ribbon: chocolate_syrup, toppings: [cookie_crumbs], density: standard. Vanilla custard with chocolate swirl and crunch pieces. [trivia-historical]
- **Peanut Butter Cookie Dough** -- base: vanilla, ribbon: peanut_butter, toppings: [cookie_dough], density: standard. Vanilla custard with peanut butter ribbon and cookie dough. [trivia-historical]
- **Pecan Toffee Crunch** -- base: vanilla, ribbon: null, toppings: [pecan, heath], density: standard. Vanilla custard with pecan and toffee pieces. [trivia-historical]
- **Polar Bear Tracks** -- base: vanilla, ribbon: fudge, toppings: [reeses], density: standard. Vanilla custard with fudge ribbon and peanut butter cup pieces. [trivia-historical]
- **Red Raspberry** -- base: vanilla, ribbon: null, toppings: [raspberry], density: standard. "Creamy Vanilla Fresh Frozen Custard swirled with sweet raspberries." Also known as "Raspberry Cream". [culvers-fotd, trivia-historical]
- **Rice Krispie Treat** -- base: vanilla, ribbon: marshmallow, toppings: [cookie_crumbs], density: standard. Vanilla custard with marshmallow and rice crispy pieces (use cookie_crumbs as closest). [trivia-historical]

**Vanilla family count: 17**

---

## Caramel Family (caramel, maple bases)

- **Maple Pecan** -- base: maple, ribbon: null, toppings: [pecan], density: standard. Maple custard with pecan pieces. [trivia-historical]
- **Nutty Caramel Apple** -- base: caramel, ribbon: null, toppings: [pecan, caramel_chips], density: standard. Caramel custard with nut and apple-caramel pieces. [trivia-historical]

**Caramel family count: 2**

---

## Fruit Family (strawberry, peach, cherry, blackberry, lemon, orange, banana, raspberry, blueberry bases)

- **Banana Cream Pie** -- base: banana, ribbon: null, toppings: [graham_cracker, cookie_crumbs], density: standard. Banana custard with pie crust/graham cracker. [trivia-historical]
- **Burgundy Cherry** -- base: cherry, ribbon: null, toppings: [cherry_bits], density: standard. Cherry custard with cherry pieces. [trivia-historical]
- **Cherry Pecan** -- base: cherry, ribbon: null, toppings: [cherry_bits, pecan], density: standard. Cherry custard with cherry and pecan pieces. [trivia-historical]
- **Creamy Lemon Crumble** -- base: lemon, ribbon: null, toppings: [cookie_crumbs], density: standard. Lemon custard with cookie crumble topping. [trivia-historical]
- **Orange Creamsicle** -- base: orange, ribbon: null, toppings: [], density: pure. Orange custard, creamsicle style -- pure orange base, no mix-ins. [trivia-historical]
- **Raspberry Cordial** -- base: vanilla, ribbon: null, toppings: [raspberry, dove], density: standard. NOTE: vanilla-based. Reclassifying to Vanilla family.
- **Raspberry Cream** -- base: vanilla, ribbon: null, toppings: [raspberry], density: standard. NOTE: This is the same flavor as "Red Raspberry". Covered by Red Raspberry profile. Should be aliased to Red Raspberry.

**Fruit family count: 5** (after reclassifying Raspberry Cordial and Raspberry Cream)

---

## Specialty Family (mint, mint_andes, cheesecake, pumpkin, root_beer, pistachio, coconut, blue_moon bases)

- **Bailey's Irish Cream** -- base: vanilla, ribbon: chocolate_syrup, toppings: [], density: pure. NOTE: coffee-cream liqueur flavor. vanilla base with chocolate drizzle. Reclassifying to Vanilla family.
- **Blue Moon** -- base: blue_moon, ribbon: null, toppings: [], density: pure. Blue Moon custard -- bright blue, no toppings. [trivia-historical]
- **Bonfire S'mores** -- base: chocolate, ribbon: marshmallow, toppings: [graham_cracker], density: standard. NOTE: chocolate-based. Reclassifying to Chocolate family.
- **Boston Cream** -- base: vanilla, ribbon: chocolate_syrup, toppings: [cake], density: standard. NOTE: vanilla-based custard with chocolate syrup topping. Reclassifying to Vanilla family.
- **Cheri Amour Amaretto** -- base: cherry, ribbon: null, toppings: [cherry_bits], density: standard. NOTE: cherry-based. Reclassifying to Fruit family.
- **Coconut Cream Pie** -- base: coconut, ribbon: null, toppings: [coconut_flakes, graham_cracker], density: standard. Coconut custard with coconut flakes and pie crust. [trivia-historical]
- **Grasshopper Fudge** -- base: mint, ribbon: fudge, toppings: [oreo], density: standard. Mint custard with fudge ribbon and Oreo. Classic grasshopper pie flavor. [trivia-historical]
- **Key Lime Custard Pie** -- base: lemon, ribbon: null, toppings: [graham_cracker], density: standard. NOTE: lemon-family base (key lime). Reclassifying to Fruit family.
- **Pistachio** -- base: pistachio, ribbon: null, toppings: [], density: pure. Pistachio custard, no mix-ins. [trivia-historical]
- **Pumpkin Pecan** -- base: pumpkin, ribbon: null, toppings: [pecan, pumpkin_spice], density: standard. Pumpkin custard with pecan and pumpkin spice. [trivia-historical]
- **Pumpkin Pie** -- base: pumpkin, ribbon: null, toppings: [graham_cracker, pumpkin_spice], density: standard. Pumpkin custard with pie crust and spice. [trivia-historical]
- **Root Beer Float** -- base: root_beer, ribbon: null, toppings: [marshmallow_bits], density: standard. Root beer custard with marshmallow topping (float style). [trivia-historical]
- **Tiramisu** -- base: espresso, ribbon: marshmallow, toppings: [cake, dove], density: standard. NOTE: espresso-based. Reclassifying to Chocolate family.
- **Toffee Pecan** -- base: butter_pecan, ribbon: null, toppings: [heath, pecan], density: standard. NOTE: butter_pecan base. Reclassifying to Vanilla family.

**Specialty family count: 6** (Blue Moon, Coconut Cream Pie, Grasshopper Fudge, Pistachio, Pumpkin Pecan, Pumpkin Pie, Root Beer Float = 7)

---

## Final Categorized Tally (after reclassifications)

| Family | Count | Notes |
|--------|-------|-------|
| Chocolate | 18 | +Bonfire S'mores, Tiramisu, Double Marshmallow Oreo relocated here |
| Vanilla | 21 | +Bailey's Irish Cream, Boston Cream, Raspberry Cordial, Toffee Pecan relocated here |
| Caramel | 2 | Maple Pecan, Nutty Caramel Apple |
| Fruit | 7 | +Cheri Amour Amaretto, Key Lime Custard Pie relocated here |
| Specialty | 7 | Blue Moon, Coconut Cream Pie, Grasshopper Fudge, Pistachio, Pumpkin Pecan, Pumpkin Pie, Root Beer Float |
| **Total** | **54** | (Raspberry Cream counted as alias of Red Raspberry, not separate) |

Note: "Red Raspberry" is listed in Vanilla family (vanilla base + raspberry topping). "Raspberry Cream" should be aliased to "Red Raspberry" when profiled.

---

## Chocolate-Family Batch (Phase 16-01 scope)

The following 18 flavors need FLAVOR_PROFILES entries in this plan:

### chocolate base
- **Bonfire S'mores** -- base: chocolate, ribbon: marshmallow, toppings: [graham_cracker], density: standard
- **Brownie Batter Overload** -- base: chocolate, ribbon: null, toppings: [brownie], density: overload
- **Brownie Explosion** -- base: chocolate, ribbon: marshmallow, toppings: [brownie, brownie, dove], density: explosion
- **Double Marshmallow Oreo** -- base: chocolate, ribbon: marshmallow, toppings: [oreo], density: double
- **M&M Cookie Dough** -- base: chocolate, ribbon: null, toppings: [m_and_m, cookie_dough], density: standard
- **M&M Swirl** -- base: chocolate, ribbon: null, toppings: [m_and_m], density: standard
- **Mooey Gooey Twist** -- base: chocolate, ribbon: caramel, toppings: [cookie_dough], density: standard
- **PB Brownie** -- base: chocolate, ribbon: peanut_butter, toppings: [brownie], density: standard
- **Rocky Road** -- base: chocolate, ribbon: marshmallow, toppings: [cashew, chocolate_chip], density: standard
- **Twix Mix** -- base: chocolate, ribbon: caramel, toppings: [cookie_crumbs], density: standard

### dark_chocolate base
- **Death by Chocolate** -- base: dark_chocolate, ribbon: chocolate_syrup, toppings: [brownie, dove], density: explosion
- **Midnight Toffee** -- base: dark_chocolate, ribbon: null, toppings: [heath], density: standard
- **Triple Chocolate Kiss** -- base: dark_chocolate, ribbon: chocolate_syrup, toppings: [dove], density: standard

### espresso base
- **Cappuccino Almond Fudge** -- base: espresso, ribbon: fudge, toppings: [cashew], density: standard
- **Cappuccino Cookie Crumble** -- base: espresso, ribbon: null, toppings: [cookie_crumbs], density: standard
- **Mudd Pie** -- base: espresso, ribbon: fudge, toppings: [oreo, cookie_crumbs], density: standard
- **Tiramisu** -- base: espresso, ribbon: marshmallow, toppings: [cake, dove], density: standard

### chocolate_custard base
(No new unprofiled flavors -- devil's food cake already profiled)

**Chocolate-family total: 17** (10 chocolate + 3 dark_chocolate + 4 espresso + 0 chocolate_custard)
