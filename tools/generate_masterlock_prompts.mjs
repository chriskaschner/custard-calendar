#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FLAVOR_PROFILES,
  BASE_COLORS,
  RIBBON_COLORS,
  TOPPING_COLORS,
  CONE_COLORS,
} from '../worker/src/flavor-colors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const FLAVORS_JSON_PATH = path.join(REPO_ROOT, 'docs', 'flavors.json');
const OUT_DIR = path.join(REPO_ROOT, 'docs', 'assets');
const OUT_PATH_MD = path.join(OUT_DIR, 'masterlock-prompt-pack.md');
const OUT_PATH_JSON = path.join(OUT_DIR, 'masterlock-flavor-fills.json');
const OUT_PATH_JS = path.join(OUT_DIR, 'masterlock-flavor-fills.js');

const TITLE_FALLBACK = {
  'double butter pecan': 'Double Butter Pecan',
  'oreo cookie overload': 'OREO Cookie Overload',
};

const DESCRIPTION_FALLBACK = {
  'badger claw': 'Vanilla Fresh Frozen Custard with caramel, cashew pieces, and fudge bits.',
  "bailey's irish cream": 'Vanilla Fresh Frozen Custard swirled with chocolate syrup in a smooth Irish cream style.',
  'banana cream pie': 'Banana Fresh Frozen Custard with graham cracker crumbles and cookie crumbs.',
  'blue moon': 'Blue Moon Fresh Frozen Custard with a bright fruity-vanilla flavor.',
  'bonfire s\'mores': 'Chocolate Fresh Frozen Custard with marshmallow swirl and graham cracker pieces.',
  'boston cream': 'Vanilla Fresh Frozen Custard with chocolate syrup and chocolate cake pieces.',
  'brownie batter overload': 'Chocolate Fresh Frozen Custard overloaded with brownie batter chunks.',
  'brownie explosion': 'Chocolate Fresh Frozen Custard with marshmallow, brownie chunks, and dark chocolate pieces.',
  'burgundy cherry': 'Cherry Fresh Frozen Custard with cherry pieces.',
  'butter brickle': 'Butter Pecan Fresh Frozen Custard with Heath toffee bits.',
  'butter finger blast': 'Vanilla Fresh Frozen Custard packed with Butterfinger crunch pieces.',
  'butterfinger pecan': 'Vanilla Fresh Frozen Custard with Butterfinger crunch pieces and pecans.',
  'cappuccino almond fudge': 'Espresso Fresh Frozen Custard with fudge swirl and cashew pieces.',
  'cappuccino cookie crumble': 'Espresso Fresh Frozen Custard with cookie crumbles.',
  'cashew delight': 'Vanilla Fresh Frozen Custard with caramel and cashew pieces.',
  'cheri amour amaretto': 'Cherry Fresh Frozen Custard with cherry pieces in an amaretto style.',
  'cherry pecan': 'Cherry Fresh Frozen Custard with cherry pieces and pecans.',
  'chunky peanut butter dream': 'Vanilla Fresh Frozen Custard with peanut butter swirl and Reese\'s cup pieces.',
  'coconut cream pie': 'Coconut Fresh Frozen Custard with coconut flakes and graham cracker crumbles.',
  'cookie dough craving': 'Vanilla Fresh Frozen Custard with cookie dough chunks.',
  'cookies & cream': 'Vanilla Fresh Frozen Custard with OREO cookie pieces.',
  'creamy lemon crumble': 'Lemon Fresh Frozen Custard with cookie crumbles.',
  'death by chocolate': 'Dark Chocolate Fresh Frozen Custard with chocolate syrup, brownie chunks, and dark chocolate pieces.',
  'double butter pecan': 'Vanilla Fresh Frozen Custard with extra pecan pieces.',
  'double marshmallow oreo': 'Chocolate Fresh Frozen Custard with marshmallow swirl and OREO cookie pieces.',
  'grasshopper fudge': 'Mint Fresh Frozen Custard swirled with fudge and loaded with OREO cookie pieces.',
  'just drummy': 'Vanilla Fresh Frozen Custard with chocolate cake pieces.',
  'key lime custard pie': 'Lemon Fresh Frozen Custard with graham cracker crumbles in a key lime pie style.',
  'kit kat bar': 'Vanilla Fresh Frozen Custard with crispy toffee bar pieces.',
  'kit kat swirl': 'Vanilla Fresh Frozen Custard with chocolate syrup swirl and crispy toffee bar pieces.',
  'm&m cookie dough': 'Chocolate Fresh Frozen Custard with M&M candy pieces and cookie dough chunks.',
  'm&m swirl': 'Chocolate Fresh Frozen Custard with M&M candy pieces.',
  'maple pecan': 'Maple Fresh Frozen Custard with pecan pieces.',
  'midnight toffee': 'Dark Chocolate Fresh Frozen Custard with Heath toffee bits.',
  'mooey gooey twist': 'Chocolate Fresh Frozen Custard with caramel swirl and cookie dough chunks.',
  'mudd pie': 'Espresso Fresh Frozen Custard with fudge swirl, OREO cookie chunks, and cookie crumbles.',
  'nestle crunch swirl': 'Vanilla Fresh Frozen Custard with chocolate syrup swirl and cookie crumbles.',
  'nutty caramel apple': 'Caramel Fresh Frozen Custard with pecans and caramel chips.',
  'orange creamsicle': 'Orange Fresh Frozen Custard with a smooth creamsicle flavor.',
  'oreo cookie overload': 'Chocolate Fresh Frozen Custard overloaded with OREO cookie pieces and chocolate syrup.',
  'pb brownie': 'Chocolate Fresh Frozen Custard with peanut butter swirl and brownie chunks.',
  'peanut butter cookie dough': 'Vanilla Fresh Frozen Custard with peanut butter swirl and cookie dough chunks.',
  'pecan toffee crunch': 'Vanilla Fresh Frozen Custard with pecan pieces and Heath toffee bits.',
  'pistachio': 'Pistachio Fresh Frozen Custard with a smooth, nutty flavor.',
  'polar bear tracks': 'Vanilla Fresh Frozen Custard with fudge swirl and Reese\'s cup pieces.',
  'pumpkin pecan': 'Pumpkin Fresh Frozen Custard with pecan pieces and pumpkin spice.',
  'pumpkin pie': 'Pumpkin Fresh Frozen Custard with graham cracker crumbles and pumpkin spice.',
  'raspberry cordial': 'Vanilla Fresh Frozen Custard with raspberry pieces and dark chocolate chunks.',
  'red raspberry': 'Vanilla Fresh Frozen Custard with raspberry pieces.',
  'rice krispie treat': 'Vanilla Fresh Frozen Custard with marshmallow swirl and cookie crumbles.',
  'rocky road': 'Chocolate Fresh Frozen Custard with marshmallow swirl, cashew pieces, and chocolate chips.',
  'root beer float': 'Root Beer Fresh Frozen Custard with marshmallow bits.',
  'tiramisu': 'Espresso Fresh Frozen Custard with marshmallow swirl, cake pieces, and dark chocolate chunks.',
  'toffee pecan': 'Butter Pecan Fresh Frozen Custard with Heath toffee bits and pecan pieces.',
  'triple chocolate kiss': 'Dark Chocolate Fresh Frozen Custard with chocolate syrup swirl and dark chocolate chunks.',
  'twix mix': 'Chocolate Fresh Frozen Custard with caramel swirl and cookie crumbles.',
};

const BASE_LABELS = {
  vanilla: 'Vanilla custard',
  chocolate: 'Chocolate custard',
  chocolate_custard: 'Deep chocolate custard',
  dark_chocolate: 'Dark chocolate custard',
  mint: 'Mint custard',
  mint_andes: 'Andes mint custard',
  strawberry: 'Strawberry custard',
  cheesecake: 'Cheesecake custard',
  caramel: 'Caramel custard',
  butter_pecan: 'Butter pecan custard',
  peach: 'Peach custard',
  lemon: 'Lemon custard',
  blackberry: 'Blackberry custard',
};

const RIBBON_LABELS = {
  caramel: 'Caramel ribbon',
  peanut_butter: 'Peanut butter swirl',
  marshmallow: 'Marshmallow swirl',
  chocolate_syrup: 'Chocolate syrup ribbon',
  fudge: 'Fudge ribbon',
};

const TOPPING_LABELS = {
  oreo: 'OREO cookie chunks',
  andes: 'Andes mint pieces',
  dove: 'Dark chocolate chunks',
  pecan: 'Pecan pieces',
  cashew: 'Cashew pieces',
  heath: 'Heath toffee bits',
  butterfinger: 'Butterfinger crunch bits',
  cookie_dough: 'Cookie dough chunks',
  strawberry_bits: 'Strawberry bits',
  raspberry: 'Raspberry pieces',
  peach_bits: 'Peach bits',
  salt: 'Salt crystals',
  snickers: 'Snickers pieces',
  cake: 'Chocolate cake chunks',
  cheesecake_bits: 'Cheesecake bits',
  m_and_m: 'M and M candy pieces',
  reeses: "Reese's cup pieces",
  brownie: 'Brownie chunks',
  blueberry: 'Blueberry pieces',
  pie_crust: 'Pie crust pieces',
};

const DENSITY_NOTES = {
  pure: 'Smooth scoop with low inclusion noise. Keep texture subtle and creamy.',
  standard: 'Balanced texture depth with inclusions spread evenly and clearly separated.',
  double: 'Emphasize the primary inclusion with repeated chunks near top and mid scoop.',
  explosion: 'Dense inclusion field with layered depth while keeping each ingredient readable.',
  overload: 'Very dense single-ingredient distribution across the scoop surface.',
};

const PREMIUM_TREATMENT_OVERRIDES = {
  'andes mint avalanche': {
    base: 'Deep forest-green mint custard with cool undertones (#1A8A4A with brighter #2ECC71 highlights at scoop crown).',
    swirls: 'None -- pure Andes mint base with flecks of green and chocolate visible through the body.',
    chunks: 'Bright Andes mint pieces with green-white layered striping and crisp fracture edges (#0A3726); dark chocolate chunks with matte cocoa finish and irregular broken shapes (#2B1A12).',
    texture: 'Standard inclusion depth with mint pieces and chocolate chunks clearly separated. Green Andes pieces catch light differently than dark chocolate for strong two-tone contrast.',
  },
  'badger claw': {
    base: 'Warm vanilla custard with golden warmth (#F5DEB3 with slightly deeper #EDD9A3 shadows).',
    swirls: 'Glossy amber caramel ribbons winding through the scoop with translucent golden edges (#D38B2C).',
    chunks: 'Pale cashew pieces with smooth ivory surfaces and natural curve shapes (#897E6C); tiny near-black fudge bits scattered as accent specks (#1C0B00).',
    texture: 'Balanced inclusion spread with caramel ribbon weaving between cashew and fudge. Cashew catches warm highlights while fudge bits add dark contrast points.',
  },
  "bailey's irish cream": {
    base: 'Creamy vanilla custard with warm ivory depth (#F5DEB3 with subtle cream-gold undertones).',
    swirls: 'Dark chocolate syrup ribbons with near-black glossy sheen tracing through the scoop (#1A0A00).',
    chunks: 'None -- pure base with chocolate syrup ribbon detail only.',
    texture: 'Smooth scoop with low inclusion noise. Chocolate syrup ribbons create elegant dark contrast lines against the pale vanilla body. Subtle cream gradients suggest richness.',
  },
  'banana cream pie': {
    base: 'Pale yellow banana custard with warm golden tones (#F0E68C with slightly deeper #E8DE7A in shadows).',
    swirls: 'None -- pure banana base with custard body gradients only.',
    chunks: 'Golden graham cracker crumbles with toasty amber edges and granular texture (#8B6914); darker sandy cookie crumbs scattered as fine accent particles (#7B5B32).',
    texture: 'Balanced texture with graham cracker and cookie crumb pieces evenly distributed. Graham pieces are larger and flatter while cookie crumbs fill gaps with fine granular detail.',
  },
  'blackberry cobbler': {
    base: 'Creamy vanilla-white custard with blackberry marbling (#F5DEB3 mixed with deep blackberry tones #6B3FA0).',
    swirls: 'Deep purple blackberry sauce ribbons with visible marbling through the scoop.',
    chunks: 'Whole blackberries with clustered drupelet shape and glossy deep-purple highlights; pie crust pieces as irregular golden crumbles with slightly toasted edges.',
    texture: 'Visible sauce marbling, balanced chunk placement, and clear depth between berries, sauce, and custard body.',
  },
  'blue moon': {
    base: 'Bright periwinkle-blue custard with gentle cyan highlights (#5B9BD5 with lighter #7BB3E5 at scoop crown).',
    swirls: 'None -- pure blue moon base with subtle color depth variations.',
    chunks: 'None -- clean scoop with no inclusions.',
    texture: 'Smooth scoop with low inclusion noise. Emphasize the unique blue color with gentle gradients from deeper periwinkle at the base to brighter sky-blue highlights at the crown. Creamy surface with soft light reflections.',
  },
  'bonfire s\'mores': {
    base: 'Rich chocolate custard with warm cocoa depth (#6F4E37 with darker #5A3E2A undertones).',
    swirls: 'Bright white marshmallow swirl with fluffy pulled-taffy texture winding through the chocolate (#FFFFFF).',
    chunks: 'Golden graham cracker crumbles with toasty amber surfaces and irregular snap-break edges (#8B6914).',
    texture: 'Balanced depth with marshmallow swirl creating bright white paths through dark chocolate. Graham cracker pieces sit at the surface with warm golden contrast against both chocolate and marshmallow.',
  },
  'boston cream': {
    base: 'Warm vanilla custard with creamy wheat tones (#F5DEB3 with golden #EDD9A3 highlights).',
    swirls: 'Dark chocolate syrup ribbons with glossy near-black sheen draping across the scoop (#1A0A00).',
    chunks: 'Deep brown chocolate cake chunks with moist matte surfaces and soft crumble edges (#4A2800).',
    texture: 'Balanced inclusion spread with chocolate syrup ribbon weaving between cake chunks. Dark syrup and dark cake create layered depth against the pale vanilla base.',
  },
  'brownie batter overload': {
    base: 'Rich chocolate custard with warm brown depth (#6F4E37 with #5A3E2A shadow tones).',
    swirls: 'None -- pure chocolate base saturated with brownie pieces.',
    chunks: 'Dense field of brownie chunks with moist, fudgy interiors and slightly cracked outer edges. Contrast-adjusted pale-cocoa surface (#ADA59C) against chocolate base.',
    texture: 'Very dense single-ingredient distribution across the scoop surface. Brownie pieces overlap and crowd the scoop, creating a heavily loaded appearance with minimal exposed custard.',
  },
  'brownie explosion': {
    base: 'Rich chocolate custard with warm cocoa tones (#6F4E37 with deeper #5C3E2B undertones).',
    swirls: 'Bright white marshmallow swirl with soft pulled texture cutting through chocolate (#FFFFFF).',
    chunks: 'Fudgy brownie chunks with moist interiors and cracked edges (#ADA59C); dark chocolate pieces with glossy broken-bar facets (#2B1A12).',
    texture: 'Dense inclusion field with layered depth. Brownie and chocolate chunks compete for space while marshmallow swirl weaves between them. Each ingredient readable despite the packed composition.',
  },
  'brownie thunder': {
    base: 'Rich chocolate custard with deep cocoa warmth (#6F4E37 with #5A3825 darker zones).',
    swirls: 'Bright white marshmallow swirl with fluffy pulled texture threading through the chocolate (#FFFFFF).',
    chunks: 'Fudgy brownie chunks with moist cracked surfaces (#ADA59C); dark chocolate pieces with glossy facets (#2B1A12); additional brownie chunks layered for double-brownie density.',
    texture: 'Dense inclusion field with layered depth. Marshmallow swirl creates bright paths between dark brownie and chocolate chunks. Multiple brownie sizes create visual depth.',
  },
  'burgundy cherry': {
    base: 'Bright cherry-red custard with deep crimson undertones (#C41E3A with darker #A01830 shadows).',
    swirls: 'None -- pure cherry base with fruit-body color gradients.',
    chunks: 'Dark cherry pieces with deep burgundy-red surfaces and glistening wet highlights (#8B0000).',
    texture: 'Standard inclusion depth with cherry pieces distributed evenly. Dark cherry chunks create subtle depth against the bright cherry base. Fruit pieces have natural irregular shapes.',
  },
  'butter brickle': {
    base: 'Warm butter pecan custard with toasty cream tones (#F2E7D1 with slightly golden #E8DCC4 shadows).',
    swirls: 'None -- pure butter pecan base with warm custard body.',
    chunks: 'Golden Heath toffee bits with amber crystalline edges and glossy caramel sheen (#DAA520).',
    texture: 'Standard inclusion depth with toffee bits spread evenly. Heath pieces catch warm light with their golden surfaces, creating sparkle points against the pale butter pecan base.',
  },
  'butter finger blast': {
    base: 'Warm vanilla custard with creamy wheat tones (#F5DEB3 with #EDD9A3 gentle shadows).',
    swirls: 'None -- pure vanilla base with Butterfinger pieces throughout.',
    chunks: 'Bright golden Butterfinger crunch pieces with flaky layered texture and vivid amber-orange surfaces (#E6A817).',
    texture: 'Standard inclusion depth with Butterfinger pieces evenly spread. Golden crunch bits stand out boldly against the pale vanilla base with strong warm-tone contrast.',
  },
  'butter pecan': {
    base: 'Warm butter pecan custard with toasty cream-gold tones (#F2E7D1 with deeper #E5D5BE in scoop shadows).',
    swirls: 'None -- pure butter pecan base with warm custard gradients.',
    chunks: 'Rich brown pecan pieces with natural wood-grain texture and warm saddle-brown surfaces (#8B5A2B).',
    texture: 'Standard inclusion depth with pecan pieces distributed naturally. Pecans create warm brown contrast against the pale cream base. Natural piece shapes suggest hand-broken halves.',
  },
  'butterfinger pecan': {
    base: 'Warm vanilla custard with creamy wheat highlights (#F5DEB3 with golden #EDD9A3 undertones).',
    swirls: 'None -- pure vanilla base with two-ingredient inclusion field.',
    chunks: 'Bright golden Butterfinger crunch pieces with flaky layered texture (#E6A817); rich brown pecan pieces with natural wood-grain surfaces (#8B5A2B).',
    texture: 'Balanced two-ingredient spread with golden Butterfinger and brown pecan pieces clearly separated. Color contrast between bright amber and dark wood tones makes each ingredient readable.',
  },
  'cappuccino almond fudge': {
    base: 'Dark espresso custard with deep coffee-brown depth (#2C1503 with warm #3A2010 highlights at scoop crown).',
    swirls: 'Near-black fudge ribbon with matte chocolate depth winding through the espresso base (#3B1F0B).',
    chunks: 'Pale ivory cashew pieces with smooth natural surfaces and warm cream highlights (#897E6C).',
    texture: 'Balanced depth with fudge ribbon visible against espresso base through slight sheen difference. Pale cashew pieces pop brightly against the dark coffee-chocolate body.',
  },
  'cappuccino cookie crumble': {
    base: 'Dark espresso custard with rich coffee-brown tones (#2C1503 with #3A2010 subtle warmth).',
    swirls: 'None -- pure espresso base with cookie crumble inclusions.',
    chunks: 'Dark sandy cookie crumbles with granular texture and warm toasted surfaces (#7B5B32).',
    texture: 'Standard inclusion depth with cookie crumbles spread evenly. Crumbles are slightly lighter than the espresso base, creating subtle warm contrast with fine granular texture.',
  },
  'caramel cashew': {
    base: 'Warm vanilla custard with creamy wheat tones (#F5DEB3 with golden #EDD9A3 shadows).',
    swirls: 'Glossy amber caramel ribbon with translucent golden edges winding through the scoop (#D38B2C).',
    chunks: 'Smooth ivory cashew pieces with pale cream surfaces and natural curved shapes (#897E6C).',
    texture: 'Balanced spread with caramel ribbon creating golden paths between scattered cashew pieces. Cashew surfaces catch warm highlights from the caramel ribbon nearby.',
  },
  'caramel chocolate pecan': {
    base: 'Deep chocolate custard with rich dark-cocoa tones (#5A3825 with #4A2D1C shadows).',
    swirls: 'Glossy amber caramel ribbon with golden translucent edges cutting through the dark chocolate (#D38B2C).',
    chunks: 'Multiple brown pecan pieces with natural wood-grain texture (#8B5A2B); dark chocolate Dove chunks with glossy broken-bar facets (#2B1A12); additional pecans layered through the scoop.',
    texture: 'Dense inclusion field with layered depth. Caramel ribbon weaves between pecan clusters and chocolate chunks. Keep ribbon visible through inclusions with clean edge contrast. Boost local contrast around dark chocolate chunks on the dark base.',
  },
  'caramel fudge cookie dough': {
    base: 'Warm vanilla custard with creamy wheat highlights (#F5DEB3 with #EDD9A3 gentle depth).',
    swirls: 'Dark near-black fudge ribbon with matte chocolate surface threading through the scoop (#3B1F0B).',
    chunks: 'Tan cookie dough chunks with speckled chocolate-chip flecks and soft rounded shapes (#917C60).',
    texture: 'Balanced spread with fudge ribbon creating dark contrast lines between scattered cookie dough pieces. Dough chunks have visible chocolate-chip specks against their tan surface.',
  },
  'caramel peanut buttercup': {
    base: 'Warm vanilla custard with creamy wheat tones (#F5DEB3 with golden #EDD9A3 highlights).',
    swirls: 'Golden peanut butter swirl with thick, matte amber texture winding through the scoop (#D4A017).',
    chunks: 'Dark chocolate chunks with glossy broken-piece facets (#2B1A12).',
    texture: 'Balanced depth with peanut butter swirl weaving broad golden paths between dark chocolate pieces. Strong light-dark contrast between golden swirl and near-black chocolate.',
  },
  'caramel pecan': {
    base: 'Rich caramel custard with warm golden-amber depth (#C68E17 with deeper #B07D12 shadow tones).',
    swirls: 'None -- pure caramel base with warm custard body gradients.',
    chunks: 'Rich brown pecan pieces with natural wood-grain texture and warm saddle-brown surfaces (#8B5A2B).',
    texture: 'Standard inclusion depth with pecan pieces evenly distributed. Brown pecans create earthy contrast against the golden caramel base. Natural piece shapes add organic variety.',
  },
  'caramel turtle': {
    base: 'Rich caramel custard with warm golden depth (#C68E17 with deeper #B07D12 undertones).',
    swirls: 'Near-black fudge ribbon with matte chocolate depth winding through golden caramel (#3B1F0B).',
    chunks: 'Brown pecan pieces with natural wood-grain texture (#8B5A2B); dark chocolate Dove chunks with glossy facets (#2B1A12); additional pecan pieces layered for depth.',
    texture: 'Dense inclusion field with layered depth. Fudge ribbon creates dark paths between pecan clusters and chocolate chunks. Three ingredients at different tones create strong visual depth against the golden base.',
  },
  'cashew delight': {
    base: 'Warm vanilla custard with creamy wheat highlights (#F5DEB3 with golden #EDD9A3 depth).',
    swirls: 'Glossy amber caramel ribbon with translucent golden edges threading through the scoop (#D38B2C).',
    chunks: 'Smooth ivory cashew pieces with pale cream surfaces and gentle curved shapes (#897E6C).',
    texture: 'Standard inclusion spread with caramel ribbon weaving between cashew pieces. Cashews and caramel share warm golden tones but differ in surface finish -- matte nut vs glossy ribbon.',
  },
  'cheri amour amaretto': {
    base: 'Bright cherry-red custard with deep crimson warmth (#C41E3A with #A61832 deeper tones).',
    swirls: 'None -- pure cherry base with rich fruit-body color variations.',
    chunks: 'Dark cherry pieces with deep burgundy-red surfaces and glistening wet highlights (#8B0000).',
    texture: 'Standard inclusion depth with cherry pieces naturally distributed. Dark cherry chunks sit slightly below the bright cherry base surface, creating tonal depth within the red family.',
  },
  'cherry pecan': {
    base: 'Bright cherry-red custard with vivid crimson tones (#C41E3A with darker #A61832 shadows).',
    swirls: 'None -- pure cherry base with two-ingredient inclusion field.',
    chunks: 'Dark cherry pieces with deep burgundy surfaces and wet highlights (#8B0000); rich brown pecan pieces with warm wood-grain texture (#8B5A2B).',
    texture: 'Balanced two-ingredient spread with dark cherry and brown pecan pieces clearly separated. Cherry pieces are darker and glossier while pecans are matte and warm-toned.',
  },
  'chocolate caramel twist': {
    base: 'Rich chocolate custard with warm cocoa depth (#6F4E37 with #5A3825 darker undertones).',
    swirls: 'Glossy amber caramel ribbon with golden translucent edges swirling through chocolate (#D38B2C).',
    chunks: 'Dark chocolate Dove chunks with glossy broken-bar facets and deep cocoa surfaces (#2B1A12).',
    texture: 'Balanced depth with bright caramel ribbon creating golden contrast lines through the dark chocolate body. Dove chunks add texture at similar darkness to the base. Keep ribbon visible for strong contrast.',
  },
  'chocolate covered strawberry': {
    base: 'Warm vanilla custard with creamy wheat tones (#F5DEB3 with #EDD9A3 gentle shadows).',
    swirls: 'None -- pure vanilla base with fruit and chocolate inclusions.',
    chunks: 'Bright red strawberry bits with vivid crimson surfaces (#A10E2B); dark chocolate Dove chunks with glossy cocoa facets (#2B1A12).',
    texture: 'Balanced two-ingredient spread with bright strawberry and dark chocolate pieces clearly separated. Red-on-cream and dark-on-cream create strong dual-tone visual interest.',
  },
  'chocolate heath crunch': {
    base: 'Rich chocolate custard with warm cocoa depth (#6F4E37 with #5C3E2B shadow tones).',
    swirls: 'None -- pure chocolate base with toffee inclusions.',
    chunks: 'Golden Heath toffee bits with amber crystalline edges and glossy caramel sheen (#DAA520).',
    texture: 'Standard inclusion depth with toffee bits spread evenly. Bright golden Heath pieces pop strongly against the dark chocolate base, creating vivid warm-tone contrast.',
  },
  'chocolate oreo volcano': {
    base: 'Rich chocolate custard with deep cocoa warmth (#6F4E37 with #5A3825 undertones).',
    swirls: 'Bright white marshmallow swirl with fluffy pulled texture erupting through the chocolate (#FFFFFF).',
    chunks: 'Dark OREO cookie chunks with visible cream filling layers (#1A1A1A); dark chocolate Dove pieces with glossy cocoa facets (#2B1A12).',
    texture: 'Dense inclusion field with layered depth. Marshmallow swirl creates bright white eruption paths between dark OREO and chocolate chunks. Three dark tones contrast against bright white.',
  },
  'chocolate volcano': {
    base: 'Rich chocolate custard with warm cocoa body (#6F4E37 with darker #5A3825 depth).',
    swirls: 'Near-black chocolate syrup ribbon with glossy wet sheen draping through the scoop (#1A0A00).',
    chunks: 'Dark OREO cookie chunks with visible cream filling streaks (#1A1A1A); dark chocolate Dove pieces with broken-bar facets (#2B1A12); bright multicolor M&M candy pieces with glossy shell (#FF7D7D).',
    texture: 'Dense inclusion field with layered depth. Multiple dark ingredients compete for contrast while M&M pieces add bright color pops. Chocolate syrup ribbon adds glossy-vs-matte variation.',
  },
  'chunky peanut butter dream': {
    base: 'Warm vanilla custard with creamy wheat tones (#F5DEB3 with golden #EDD9A3 highlights).',
    swirls: 'Golden peanut butter swirl with thick matte amber texture threading through the scoop (#D4A017).',
    chunks: 'Golden-amber Reese\'s cup pieces with layered peanut butter and chocolate visible at broken edges (#D4A017).',
    texture: 'Balanced depth with peanut butter swirl and Reese\'s pieces in similar golden tones but different textures. Swirl is smooth and matte while cup pieces show layered chocolate-peanut butter cross-sections.',
  },
  'coconut cream pie': {
    base: 'Floral white coconut custard with pale cream warmth (#FFFAF0 with slightly deeper #F5EDE0 in shadows).',
    swirls: 'None -- pure coconut base with crispy and crumbly inclusions.',
    chunks: 'Off-white coconut flakes with thin curved shred shapes and slight translucency (#F5F5DC); golden graham cracker crumbles with toasty amber surfaces (#8B6914).',
    texture: 'Balanced two-ingredient spread with pale coconut flakes and golden graham pieces. Graham cracker provides warm contrast against the near-white coconut base. Coconut flakes add delicate surface texture.',
  },
  'cookie dough craving': {
    base: 'Warm vanilla custard with creamy wheat highlights (#F5DEB3 with golden #EDD9A3 undertones).',
    swirls: 'None -- pure vanilla base with cookie dough inclusions.',
    chunks: 'Tan cookie dough chunks with speckled chocolate-chip flecks and soft rounded edges (#917C60).',
    texture: 'Standard inclusion depth with cookie dough pieces distributed naturally. Dough chunks show visible chocolate chip specks against their tan surface, with soft edges suggesting raw dough texture.',
  },
  'cookies & cream': {
    base: 'Warm vanilla custard with creamy wheat tones (#F5DEB3 with #EDD9A3 subtle depth).',
    swirls: 'None -- pure vanilla base with OREO cookie inclusions.',
    chunks: 'Dark OREO cookie chunks with near-black surfaces and visible cream filling layers at broken edges (#1A1A1A).',
    texture: 'Standard inclusion depth with OREO pieces distributed evenly. Dark black-on-cream contrast is the defining visual. Cream filling visible at broken edges adds fine detail.',
  },
  'crazy for cookie dough': {
    base: 'Warm vanilla custard with creamy wheat highlights (#F5DEB3 with golden #EDD9A3 depth).',
    swirls: 'Near-black fudge ribbon with matte chocolate surface threading through the scoop (#3B1F0B).',
    chunks: 'Tan cookie dough chunks with speckled chocolate-chip flecks and soft rounded shapes (#917C60).',
    texture: 'Balanced depth with fudge ribbon creating dark contrast lines weaving between cookie dough chunks. Tan dough against dark fudge and pale vanilla creates three-tone layering.',
  },
  'creamy lemon crumble': {
    base: 'Bright lemon custard with vivid yellow warmth (#FFF176 with slightly deeper #F5E76A in shadows).',
    swirls: 'None -- pure lemon base with cookie crumble inclusions.',
    chunks: 'Dark sandy cookie crumbles with granular toasted texture (#7B5B32).',
    texture: 'Standard inclusion depth with cookie crumbles evenly spread. Dark crumble pieces create strong contrast against the bright yellow lemon base. Fine granular texture adds surface interest.',
  },
  'dark chocolate decadence': {
    base: 'Deep, near-black chocolate custard with velvety darkness (#3B1F0B with warm #4A2D18 highlights at crown and edges).',
    swirls: 'None -- pure dark chocolate with subtle color depth variations only.',
    chunks: 'None -- clean scoop with no inclusions.',
    texture: 'Smooth scoop with low inclusion noise. Emphasize the ultra-dark chocolate with subtle warm highlight at the crown and gentle shadow depth at the base. Velvety surface with minimal light reflection.',
  },
  'dark chocolate pb crunch': {
    base: 'Deep dark chocolate custard with near-black richness (#3B1F0B with warm #4A2D18 undertones).',
    swirls: 'Golden peanut butter swirl with thick matte amber texture winding through the dark base (#D4A017).',
    chunks: 'Bright golden Butterfinger crunch pieces with flaky layered texture and vivid amber surfaces (#E6A817).',
    texture: 'Balanced depth with peanut butter swirl and Butterfinger pieces creating bright golden contrast against the ultra-dark chocolate base. Keep ribbon visible for maximum light-dark drama.',
  },
  'death by chocolate': {
    base: 'Deep dark chocolate custard with near-black velvety depth (#3B1F0B with warm #4A2D18 crown highlights).',
    swirls: 'Near-black chocolate syrup ribbon with glossy wet sheen threading through the dark base (#1A0A00).',
    chunks: 'Fudgy brownie chunks with moist cracked surfaces (#ADA59C); dark chocolate Dove pieces with glossy broken-bar facets (#2B1A12).',
    texture: 'Dense inclusion field with layered depth. Multiple dark-on-dark ingredients require careful local contrast. Brownie pieces lighter than base, Dove chunks show glossy sheen difference. Chocolate syrup ribbon adds wet-vs-matte texture variation.',
  },
  "devil's food cake": {
    base: 'Deep chocolate custard with rich dark-cocoa body (#5A3825 with darker #4A2D1C shadow tones).',
    swirls: 'None -- pure chocolate custard base with cake and chocolate inclusions.',
    chunks: 'Deep brown chocolate cake chunks with moist matte surfaces and soft crumble edges (#4A2800); dark chocolate Dove pieces with glossy cocoa facets (#2B1A12).',
    texture: 'Standard inclusion depth with cake and chocolate pieces at similar dark tones. Boost local contrast around dark chunks so ingredients stay readable against the dark base. Cake is matte, chocolate is glossy.',
  },
  'double butter pecan': {
    base: 'Warm vanilla custard with creamy wheat highlights (#F5DEB3 with #EDD9A3 golden depth).',
    swirls: 'None -- pure vanilla base with double-portion pecan inclusions.',
    chunks: 'Rich brown pecan pieces with natural wood-grain texture, doubled in quantity with pieces near top and mid scoop (#8B5A2B).',
    texture: 'Emphasize the primary inclusion with repeated pecan chunks near top and mid scoop. Double portion means denser pecan coverage than standard, but pieces remain individually readable.',
  },
  'double marshmallow oreo': {
    base: 'Rich chocolate custard with warm cocoa depth (#6F4E37 with #5A3825 darker tones).',
    swirls: 'Bright white marshmallow swirl with extra-thick fluffy pulled texture threading through chocolate (#FFFFFF).',
    chunks: 'Dark OREO cookie chunks with near-black surfaces and visible cream filling layers (#1A1A1A).',
    texture: 'Emphasize the primary inclusion with marshmallow swirl extra prominent at top and mid scoop. Double marshmallow means thicker, more visible white paths. Dark OREO adds contrast points.',
  },
  'double strawberry': {
    base: 'Vibrant strawberry-pink custard with bright berry warmth (#FF6B9D with deeper #E8598A undertones).',
    swirls: 'None -- pure strawberry base with fruit inclusions.',
    chunks: 'Deep red strawberry bits with vivid crimson surfaces and natural fruit shapes (#A10E2B).',
    texture: 'Emphasize the primary inclusion with strawberry pieces doubled near top and mid scoop. Dark red fruit bits against bright pink base create rich monochromatic depth within the berry color family.',
  },
  'georgia peach': {
    base: 'Warm peach custard with soft golden-orange glow (#FFE5B4 with slightly deeper #F5D9A0 shadow tones).',
    swirls: 'None -- pure peach base with fruit inclusions.',
    chunks: 'Deep amber-orange peach bits with warm sunset tones and natural fruit-slice shapes (#BF7200).',
    texture: 'Standard inclusion depth with peach pieces naturally distributed. Darker orange fruit bits against pale peach base create warm monochromatic depth. Fruit pieces suggest natural irregular cuts.',
  },
  'grasshopper fudge': {
    base: 'Bright mint-green custard with cool fresh tones (#2ECC71 with slightly deeper #28B563 in shadows).',
    swirls: 'Near-black fudge ribbon with matte chocolate depth threading through the bright mint (#3B1F0B).',
    chunks: 'Dark OREO cookie chunks with near-black surfaces and visible cream filling layers (#1A1A1A).',
    texture: 'Balanced depth with fudge ribbon creating dark paths through bright mint. OREO chunks add dark texture points. Strong light-dark contrast between mint base and dark inclusions throughout.',
  },
  'just drummy': {
    base: 'Warm vanilla custard with creamy wheat highlights (#F5DEB3 with golden #EDD9A3 undertones).',
    swirls: 'None -- pure vanilla base with cake inclusions.',
    chunks: 'Deep brown chocolate cake chunks with moist matte surfaces and soft crumble edges (#4A2800).',
    texture: 'Standard inclusion depth with cake pieces evenly distributed. Dark brown cake chunks create strong contrast against the pale vanilla base. Moist matte surfaces suggest fresh-baked texture.',
  },
  'key lime custard pie': {
    base: 'Bright citrus custard with vivid yellow-green warmth (#FFF176 with a cooler green-tinged cast for key lime character).',
    swirls: 'None -- pure citrus base with graham cracker inclusions.',
    chunks: 'Golden graham cracker crumbles with toasty amber surfaces and granular snap-break texture (#8B6914).',
    texture: 'Standard inclusion depth with graham pieces evenly spread. Golden graham crumbles against bright citrus base create warm pie-crust contrast. Granular crumb texture suggests crushed pie crust.',
  },
  'kit kat bar': {
    base: 'Warm vanilla custard with creamy wheat tones (#F5DEB3 with #EDD9A3 gentle shadows).',
    swirls: 'None -- pure vanilla base with crispy toffee bar inclusions.',
    chunks: 'Golden Heath toffee bits standing in for crispy wafer-bar pieces with amber crystalline edges (#DAA520).',
    texture: 'Standard inclusion depth with toffee-bar pieces evenly distributed. Golden pieces pop brightly against the pale vanilla base with strong warm-tone contrast and crispy edge detail.',
  },
  'kit kat swirl': {
    base: 'Warm vanilla custard with creamy wheat highlights (#F5DEB3 with golden #EDD9A3 depth).',
    swirls: 'Near-black chocolate syrup ribbon with glossy wet sheen draping through the scoop (#1A0A00).',
    chunks: 'Golden Heath toffee bits standing in for crispy wafer-bar pieces with amber crystalline edges (#DAA520).',
    texture: 'Balanced depth with dark chocolate syrup ribbon creating strong contrast lines through pale vanilla. Golden toffee pieces add bright warm accents against both vanilla and chocolate.',
  },
  'lemon berry layer cake': {
    base: 'Bright lemon custard with vivid yellow warmth (#FFF176 with slightly deeper #F5E76A in shadows).',
    swirls: 'None -- pure lemon base with berry and cake inclusions.',
    chunks: 'Deep purple blueberry pieces with dark violet surfaces and natural round shapes (#3B1F6B); deep brown chocolate cake chunks with moist matte surfaces (#4A2800).',
    texture: 'Balanced two-ingredient spread with dark purple blueberry and dark brown cake pieces clearly separated. Both create strong contrast against the bright yellow lemon base. Blueberry is glossy, cake is matte.',
  },
  'lemon dash cookie': {
    base: 'Bright lemon custard with vivid yellow warmth (#FFF176 with #F5E76A depth in shadows).',
    swirls: 'None -- pure lemon base with cookie inclusions.',
    chunks: 'Dark OREO cookie chunks with near-black surfaces and visible cream filling layers (#1A1A1A).',
    texture: 'Standard inclusion depth with OREO pieces distributed evenly. Extreme dark-on-bright contrast between near-black cookies and vivid yellow lemon base. Cream filling streaks add fine detail.',
  },
  'm&m cookie dough': {
    base: 'Rich chocolate custard with warm cocoa depth (#6F4E37 with #5C3E2B undertones).',
    swirls: 'None -- pure chocolate base with candy and dough inclusions.',
    chunks: 'Bright multicolor M&M candy pieces with glossy rounded shells in red, yellow, green, blue (#FF7D7D); tan cookie dough chunks with speckled chocolate-chip flecks (#917C60).',
    texture: 'Balanced two-ingredient spread with bright M&M candy and tan cookie dough clearly separated. M&Ms add vivid color pops against dark chocolate while dough chunks provide earthy warmth.',
  },
  'm&m swirl': {
    base: 'Rich chocolate custard with warm cocoa tones (#6F4E37 with #5C3E2B shadow depth).',
    swirls: 'None -- pure chocolate base with candy inclusions.',
    chunks: 'Bright multicolor M&M candy pieces with glossy rounded shells in red, yellow, green, blue (#FF7D7D).',
    texture: 'Standard inclusion depth with M&M pieces evenly distributed. Bright candy shell colors pop vividly against the dark chocolate base. Each candy piece a different hue for rainbow effect.',
  },
  'maple pecan': {
    base: 'Warm amber maple custard with golden-brown depth (#C9882C with deeper #B47A24 shadow tones).',
    swirls: 'None -- pure maple base with pecan inclusions.',
    chunks: 'Rich brown pecan pieces with natural wood-grain texture and warm saddle-brown surfaces (#8B5A2B).',
    texture: 'Standard inclusion depth with pecan pieces naturally distributed. Brown pecans blend warmly with the amber maple base while remaining distinct through texture difference -- rough nut vs smooth custard.',
  },
  'midnight toffee': {
    base: 'Deep dark chocolate custard with near-black velvety richness (#3B1F0B with warm #4A2D18 crown highlights).',
    swirls: 'None -- pure dark chocolate base with toffee inclusions.',
    chunks: 'Golden Heath toffee bits with amber crystalline edges and glossy caramel sheen (#DAA520).',
    texture: 'Standard inclusion depth with toffee bits evenly spread. Bright golden Heath pieces create dramatic contrast against the ultra-dark chocolate base -- the strongest light-dark contrast in the lineup.',
  },
  'mint cookie': {
    base: 'Bright mint-green custard with cool fresh tones (#2ECC71 with slightly deeper #28B563 in shadows).',
    swirls: 'None -- pure mint base with double-portion cookie inclusions.',
    chunks: 'Dark OREO cookie chunks with near-black surfaces and visible cream filling layers, doubled for density (#1A1A1A).',
    texture: 'Emphasize the primary inclusion with OREO pieces repeated near top and mid scoop. Dark cookie chunks against bright mint create strong contrast. Double portion means denser coverage.',
  },
  'mint explosion': {
    base: 'Bright mint-green custard with vibrant cool tones (#2ECC71 with deeper #25A85E in shadows).',
    swirls: 'None -- pure mint base with dense multi-ingredient inclusion field.',
    chunks: 'Dark OREO cookie chunks with visible cream filling layers (#1A1A1A); bright Andes mint pieces with green-white layered striping (#0A3726); dark chocolate Dove chunks with glossy cocoa facets (#2B1A12).',
    texture: 'Dense inclusion field with layered depth while keeping each ingredient readable. Three dark-toned ingredients at slightly different values create depth against the bright mint base. OREO is near-black, Andes is deep green, Dove is dark brown.',
  },
  'mooey gooey twist': {
    base: 'Rich chocolate custard with warm cocoa depth (#6F4E37 with #5A3825 shadow tones).',
    swirls: 'Glossy amber caramel ribbon with golden translucent edges winding through the chocolate (#D38B2C).',
    chunks: 'Tan cookie dough chunks with speckled chocolate-chip flecks and soft rounded edges (#917C60).',
    texture: 'Balanced depth with bright caramel ribbon creating golden paths through dark chocolate. Cookie dough chunks add warm tan accents. Three distinct tones -- dark base, golden ribbon, tan chunks.',
  },
  'mudd pie': {
    base: 'Dark espresso custard with deep coffee-brown richness (#2C1503 with warm #3A2010 crown highlights).',
    swirls: 'Near-black fudge ribbon with matte chocolate depth threading through the dark espresso base (#3B1F0B).',
    chunks: 'Dark OREO cookie chunks with near-black surfaces and cream filling streaks (#1A1A1A); dark sandy cookie crumbles with granular texture (#7B5B32).',
    texture: 'Standard inclusion depth with dark-on-dark ingredients requiring careful contrast. Fudge ribbon distinguished by sheen difference from base. OREO is cooler black, cookie crumbles are warmer brown. Layer these carefully against espresso.',
  },
  'nestle crunch swirl': {
    base: 'Warm vanilla custard with creamy wheat tones (#F5DEB3 with golden #EDD9A3 highlights).',
    swirls: 'Near-black chocolate syrup ribbon with glossy wet sheen threading through the vanilla (#1A0A00).',
    chunks: 'Dark sandy cookie crumbles with granular toasted texture and warm brown surfaces (#7B5B32).',
    texture: 'Balanced depth with dark chocolate syrup ribbon creating strong contrast lines through pale vanilla. Cookie crumbles add warm granular texture at a middle tone between syrup and base.',
  },
  'nutty caramel apple': {
    base: 'Rich caramel custard with warm golden-amber depth (#C68E17 with deeper #B07D12 undertones).',
    swirls: 'None -- pure caramel base with nut and candy inclusions.',
    chunks: 'Brown pecan pieces with natural wood-grain texture (#8B5A2B); deep amber caramel chips with glossy crystalline edges (#9E6B23).',
    texture: 'Balanced two-ingredient spread with pecans and caramel chips in similar warm tones but different textures. Pecans are matte and irregular, caramel chips are glossy and angular.',
  },
  'orange creamsicle': {
    base: 'Bright dark-orange custard with vivid citrus warmth (#FF8C00 with slightly deeper #E67E00 shadows).',
    swirls: 'None -- pure orange base with subtle cream-white highlight gradients suggesting creamsicle character.',
    chunks: 'None -- clean scoop with no inclusions.',
    texture: 'Smooth scoop with low inclusion noise. Emphasize the vivid orange with gentle gradients from deeper orange at the base to brighter, almost cream-touched highlights at the crown. Creamsicle effect through subtle white-orange transitions.',
  },
  'oreo cheesecake': {
    base: 'Warm ivory cheesecake custard with buttery cream tones (#FFF5E1 with slightly deeper #F5EBD0 shadows).',
    swirls: 'None -- pure cheesecake base with double-portion OREO inclusions.',
    chunks: 'Dark OREO cookie chunks with near-black surfaces and visible cream filling layers, doubled for density (#1A1A1A).',
    texture: 'Emphasize the primary inclusion with OREO pieces repeated near top and mid scoop. Extreme dark-on-light contrast between near-black cookies and pale cheesecake base. Double portion creates dense cookie coverage.',
  },
  'oreo cookie cheesecake': {
    base: 'Warm ivory cheesecake custard with buttery cream depth (#FFF5E1 with #F5EBD0 gentle shadows).',
    swirls: 'None -- pure cheesecake base with double-portion OREO inclusions.',
    chunks: 'Dark OREO cookie chunks with near-black surfaces and visible cream filling layers, doubled for density (#1A1A1A).',
    texture: 'Emphasize the primary inclusion with OREO pieces repeated near top and mid scoop. Near-black OREO against pale cheesecake creates maximum contrast. Double portion means dense cookie field.',
  },
  'oreo cookie overload': {
    base: 'Rich chocolate custard with warm cocoa tones (#6F4E37 with #5A3825 deeper shadows).',
    swirls: 'Near-black chocolate syrup ribbon with glossy wet sheen draping through the scoop (#1A0A00).',
    chunks: 'Dense field of dark OREO cookie chunks with near-black surfaces and cream filling streaks, overloaded across the entire scoop surface (#1A1A1A).',
    texture: 'Very dense single-ingredient distribution across the scoop surface. OREO pieces crowd every surface area with minimal exposed custard. Chocolate syrup ribbon adds wet-vs-matte variation among the dark tones.',
  },
  'pb brownie': {
    base: 'Rich chocolate custard with warm cocoa depth (#6F4E37 with #5C3E2B shadow tones).',
    swirls: 'Golden peanut butter swirl with thick matte amber texture winding through the chocolate (#D4A017).',
    chunks: 'Fudgy brownie chunks with moist cracked surfaces and lighter cocoa contrast (#ADA59C).',
    texture: 'Balanced depth with bright peanut butter swirl creating golden paths through dark chocolate. Brownie chunks add texture variation. Keep peanut butter ribbon visible through inclusions.',
  },
  'peanut butter cookie dough': {
    base: 'Warm vanilla custard with creamy wheat highlights (#F5DEB3 with golden #EDD9A3 depth).',
    swirls: 'Golden peanut butter swirl with thick matte amber texture threading through the scoop (#D4A017).',
    chunks: 'Tan cookie dough chunks with speckled chocolate-chip flecks and soft rounded shapes (#917C60).',
    texture: 'Balanced depth with peanut butter swirl and cookie dough pieces in similar warm tones. Swirl is smooth and matte while dough is chunky with visible chocolate-chip specks. Both warm against pale vanilla.',
  },
  'peanut butter cup': {
    base: 'Rich chocolate custard with warm cocoa depth (#6F4E37 with #5C3E2B undertones).',
    swirls: 'Golden peanut butter swirl with thick matte amber texture winding through the chocolate (#D4A017).',
    chunks: 'Golden-amber Reese\'s cup pieces with layered peanut butter and chocolate visible at broken edges (#D4A017).',
    texture: 'Balanced depth with peanut butter swirl and Reese\'s pieces creating bright golden contrast against dark chocolate. Swirl and cup pieces share similar golden tone but differ in texture -- smooth vs chunky.',
  },
  'pecan toffee crunch': {
    base: 'Warm vanilla custard with creamy wheat tones (#F5DEB3 with golden #EDD9A3 highlights).',
    swirls: 'None -- pure vanilla base with two warm-toned inclusions.',
    chunks: 'Rich brown pecan pieces with natural wood-grain texture (#8B5A2B); golden Heath toffee bits with amber crystalline edges and glossy caramel sheen (#DAA520).',
    texture: 'Balanced two-ingredient spread with brown pecans and golden toffee clearly separated. Both warm-toned but pecans are darker and matte while toffee is brighter and glossy. Strong contrast against pale vanilla.',
  },
  'pistachio': {
    base: 'Muted sage-green pistachio custard with earthy cool tones (#93C572 with slightly deeper #82B462 in shadows).',
    swirls: 'None -- pure pistachio base with subtle natural green gradients.',
    chunks: 'None -- clean scoop with no inclusions.',
    texture: 'Smooth scoop with low inclusion noise. Emphasize the distinctive sage-green color with gentle gradients from deeper muted green at the base to brighter, lighter green at the crown. Earthy and natural with soft creaminess.',
  },
  'polar bear tracks': {
    base: 'Warm vanilla custard with creamy wheat highlights (#F5DEB3 with golden #EDD9A3 depth).',
    swirls: 'Near-black fudge ribbon with matte chocolate depth threading through the vanilla (#3B1F0B).',
    chunks: 'Golden-amber Reese\'s cup pieces with layered peanut butter and chocolate visible at broken edges (#D4A017).',
    texture: 'Balanced depth with dark fudge ribbon creating strong contrast paths through pale vanilla. Reese\'s pieces add warm golden accents. Three-tone layering -- pale base, dark ribbon, golden chunks.',
  },
  'pumpkin pecan': {
    base: 'Warm orange-brown pumpkin custard with autumn spice depth (#D2691E with deeper #B85B18 shadow tones).',
    swirls: 'None -- pure pumpkin base with nut and spice inclusions.',
    chunks: 'Rich brown pecan pieces with natural wood-grain texture (#8B5A2B); dark cinnamon-sienna pumpkin spice specks scattered as fine accent particles (#6B3410).',
    texture: 'Balanced inclusion spread with pecan pieces and fine pumpkin spice specks. Pecans provide larger texture while spice particles add fine detail. All in warm autumn tones against the orange-brown base.',
  },
  'pumpkin pie': {
    base: 'Warm orange-brown pumpkin custard with autumn depth (#D2691E with #B85B18 deeper undertones).',
    swirls: 'None -- pure pumpkin base with pie-crust and spice inclusions.',
    chunks: 'Golden graham cracker crumbles with toasty amber surfaces (#8B6914); dark cinnamon-sienna pumpkin spice specks as fine accent particles (#6B3410).',
    texture: 'Balanced depth with graham cracker pieces suggesting pie crust and pumpkin spice adding fine warm specks. Autumn-palette harmony -- orange base, golden crumbles, dark cinnamon accents.',
  },
  'raspberry cheesecake': {
    base: 'Warm ivory cheesecake custard with buttery cream tones (#FFF5E1 with #F5EBD0 gentle shadows).',
    swirls: 'None -- pure cheesecake base with double-portion raspberry inclusions.',
    chunks: 'Bright magenta-pink raspberry pieces with vivid berry color and natural seed-textured surfaces (#E91E63).',
    texture: 'Emphasize the primary inclusion with raspberry pieces doubled near top and mid scoop. Vibrant pink-magenta fruit against pale ivory cheesecake creates vivid color pop. Fruit pieces have organic shapes.',
  },
  'raspberry cordial': {
    base: 'Warm vanilla custard with creamy wheat tones (#F5DEB3 with golden #EDD9A3 highlights).',
    swirls: 'None -- pure vanilla base with berry and chocolate inclusions.',
    chunks: 'Bright magenta-pink raspberry pieces with vivid berry color (#E91E63); dark chocolate Dove chunks with glossy broken-bar facets (#2B1A12).',
    texture: 'Balanced two-ingredient spread with bright raspberry and dark chocolate clearly separated. Pink-on-cream and dark-on-cream create elegant dual-tone contrast against the pale vanilla body.',
  },
  'really reese\'s': {
    base: 'Rich chocolate custard with warm cocoa depth (#6F4E37 with #5C3E2B undertones).',
    swirls: 'Golden peanut butter swirl with thick matte amber texture winding through the chocolate (#D4A017).',
    chunks: 'Golden-amber Reese\'s cup pieces with layered peanut butter and chocolate visible at broken edges (#D4A017).',
    texture: 'Balanced depth with peanut butter swirl and Reese\'s pieces in matching golden tones against dark chocolate. Swirl is smooth, cups are chunky with cross-section detail. Strong warm-dark contrast.',
  },
  'red raspberry': {
    base: 'Warm vanilla custard with creamy wheat highlights (#F5DEB3 with #EDD9A3 golden depth).',
    swirls: 'None -- pure vanilla base with raspberry inclusions.',
    chunks: 'Bright magenta-pink raspberry pieces with vivid berry color and natural seed-textured surfaces (#E91E63).',
    texture: 'Standard inclusion depth with raspberry pieces naturally distributed. Bright magenta fruit pops vividly against the pale vanilla cream base. Fruit pieces have organic irregular shapes.',
  },
  'rice krispie treat': {
    base: 'Warm vanilla custard with creamy wheat tones (#F5DEB3 with golden #EDD9A3 highlights).',
    swirls: 'Bright white marshmallow swirl with fluffy pulled-taffy texture threading through the vanilla (#FFFFFF).',
    chunks: 'Dark sandy cookie crumbles standing in for crispy rice pieces with granular toasted texture (#7B5B32).',
    texture: 'Balanced depth with bright white marshmallow swirl weaving through pale vanilla. Darker cookie crumbles add warm texture points. Marshmallow and vanilla are both light but distinguishable by texture.',
  },
  'rocky road': {
    base: 'Rich chocolate custard with warm cocoa depth (#6F4E37 with #5C3E2B shadow tones).',
    swirls: 'Bright white marshmallow swirl with fluffy pulled texture winding through the chocolate (#FFFFFF).',
    chunks: 'Smooth ivory cashew pieces with pale cream surfaces (#897E6C); tiny dark chocolate chips with glossy pointed shapes (#3B2314).',
    texture: 'Balanced multi-ingredient depth with bright marshmallow swirl creating white paths between cashew and chocolate chip inclusions. Light cashew, bright marshmallow, and dark chips create three-tone layering against chocolate.',
  },
  'root beer float': {
    base: 'Deep amber-brown root beer custard with warm cola-like depth (#5C3317 with lighter #6E4020 crown highlights).',
    swirls: 'None -- pure root beer base with marshmallow foam-like inclusions.',
    chunks: 'Warm white marshmallow bits with soft fluffy shapes suggesting root beer float foam (#FFFAED).',
    texture: 'Standard inclusion depth with marshmallow bits distributed naturally. Pale marshmallow pieces against the dark amber root beer base recreate the visual of foam on a root beer float. Strong light-dark contrast.',
  },
  'salted caramel pecan pie': {
    base: 'Rich caramel custard with warm golden-amber depth (#C68E17 with deeper #B07D12 shadow tones).',
    swirls: 'None -- pure caramel base with dense multi-ingredient inclusion field.',
    chunks: 'Brown pecan pieces with natural wood-grain texture (#8B5A2B); crystalline salt flakes with translucent grey-white sparkle (#4B4B4B); golden pie crust crumbles with toasty warm surfaces (#C99E76).',
    texture: 'Dense inclusion field with layered depth. Three ingredients in warm tones -- brown pecans, grey-white salt crystals, golden crust -- create visual depth against the golden caramel base. Salt crystals add tiny sparkle points.',
  },
  'salted double caramel pecan': {
    base: 'Warm vanilla custard with creamy wheat tones (#F5DEB3 with golden #EDD9A3 depth).',
    swirls: 'Glossy amber caramel ribbon with golden translucent edges -- double-width for emphasis (#D38B2C).',
    chunks: 'Brown pecan pieces with natural wood-grain texture (#8B5A2B); crystalline salt flakes with translucent grey-white sparkle (#4B4B4B).',
    texture: 'Emphasize the primary inclusion with caramel ribbon extra prominent. Double caramel means wider, more visible golden paths. Pecan pieces and salt crystals add warm and cool accent points respectively.',
  },
  'snickers swirl': {
    base: 'Rich chocolate custard with warm cocoa depth (#6F4E37 with #5C3E2B undertones).',
    swirls: 'Glossy amber caramel ribbon with golden translucent edges winding through the chocolate (#D38B2C).',
    chunks: 'Snickers bar pieces with visible layers of nougat, caramel, and peanuts in cross-section with golden-tan color (#C4A060).',
    texture: 'Balanced depth with bright caramel ribbon creating golden paths through dark chocolate. Snickers pieces show internal layering at broken edges. Warm golden tones contrast against dark cocoa base.',
  },
  'strawberry cheesecake': {
    base: 'Warm ivory cheesecake custard with buttery cream tones (#FFF5E1 with slightly deeper #F5EBD0 shadows).',
    swirls: 'None -- pure cheesecake base with double-portion strawberry inclusions.',
    chunks: 'Deep red strawberry bits with vivid crimson surfaces and natural fruit shapes (#A10E2B).',
    texture: 'Emphasize the primary inclusion with strawberry pieces doubled near top and mid scoop. Deep red fruit bits against pale ivory cheesecake create vivid color pop. Fruit pieces have organic shapes.',
  },
  'tiramisu': {
    base: 'Dark espresso custard with deep coffee-brown richness (#2C1503 with warm #3A2010 crown highlights).',
    swirls: 'Bright white marshmallow swirl with soft fluffy texture representing mascarpone cream (#FFFFFF).',
    chunks: 'Deep brown cake chunks representing ladyfinger pieces with moist matte surfaces (#4A2800); dark chocolate Dove pieces with glossy cocoa facets (#2B1A12).',
    texture: 'Balanced depth with bright marshmallow cream swirl creating white paths through dark espresso. Cake and chocolate pieces in similar dark tones differ by surface finish -- matte vs glossy.',
  },
  'toffee pecan': {
    base: 'Warm butter pecan custard with toasty cream-gold tones (#F2E7D1 with slightly deeper #E5D5BE shadows).',
    swirls: 'None -- pure butter pecan base with two warm-toned inclusions.',
    chunks: 'Golden Heath toffee bits with amber crystalline edges and glossy caramel sheen (#DAA520); rich brown pecan pieces with natural wood-grain texture (#8B5A2B).',
    texture: 'Balanced two-ingredient spread with golden toffee and brown pecan pieces clearly separated. Both warm-toned but toffee is brighter and glossy while pecans are darker and matte.',
  },
  'triple chocolate kiss': {
    base: 'Deep dark chocolate custard with near-black velvety richness (#3B1F0B with warm #4A2D18 highlights).',
    swirls: 'Near-black chocolate syrup ribbon with glossy wet sheen threading through the dark base (#1A0A00).',
    chunks: 'Dark chocolate Dove chunks with glossy broken-bar facets and matte-to-shiny surface transitions (#2B1A12).',
    texture: 'Standard inclusion depth with dark-on-dark-on-dark layering. Chocolate syrup, dark chocolate base, and Dove chunks at three slightly different dark values. Distinguish each through sheen variation -- matte base, glossy syrup, semi-gloss chunks.',
  },
  'turtle': {
    base: 'Warm vanilla custard with creamy wheat tones (#F5DEB3 with golden #EDD9A3 highlights).',
    swirls: 'Glossy amber caramel ribbon with golden translucent edges winding through the scoop (#D38B2C).',
    chunks: 'Rich brown pecan pieces with natural wood-grain texture (#8B5A2B); dark chocolate Dove chunks with glossy cocoa facets (#2B1A12).',
    texture: 'Balanced depth with caramel ribbon weaving between pecan and chocolate pieces. Three warm tones -- golden ribbon, brown pecans, dark chocolate -- create classic turtle layering against pale vanilla.',
  },
  'turtle cheesecake': {
    base: 'Warm ivory cheesecake custard with buttery cream depth (#FFF5E1 with #F5EBD0 gentle shadows).',
    swirls: 'Glossy amber caramel ribbon with golden translucent edges threading through the cheesecake (#D38B2C).',
    chunks: 'Brown pecan pieces with natural wood-grain texture (#8B5A2B); dark chocolate Dove chunks with glossy cocoa facets (#2B1A12); additional pecan pieces layered through the scoop.',
    texture: 'Dense inclusion field with layered depth. Caramel ribbon weaves between pecan clusters and chocolate chunks. Classic turtle trio against pale cheesecake creates strong multi-tone contrast.',
  },
  'turtle dove': {
    base: 'Warm vanilla custard with creamy wheat highlights (#F5DEB3 with golden #EDD9A3 depth).',
    swirls: 'Bright white marshmallow swirl with fluffy pulled texture winding through the vanilla (#FFFFFF).',
    chunks: 'Rich brown pecan pieces with natural wood-grain texture (#8B5A2B); dark chocolate Dove chunks with glossy broken-bar facets (#2B1A12).',
    texture: 'Balanced depth with bright marshmallow swirl weaving between brown pecan and dark chocolate pieces. Marshmallow and vanilla are both light but swirl is brighter white. Pecans and Dove at two different brown tones.',
  },
  'twix mix': {
    base: 'Rich chocolate custard with warm cocoa depth (#6F4E37 with #5C3E2B shadow tones).',
    swirls: 'Glossy amber caramel ribbon with golden translucent edges winding through the chocolate (#D38B2C).',
    chunks: 'Dark sandy cookie crumbles with granular texture representing crispy biscuit layers (#7B5B32).',
    texture: 'Balanced depth with bright caramel ribbon creating golden contrast paths through dark chocolate. Cookie crumbles add warm granular texture. Trio of dark base, golden ribbon, and warm crumbles.',
  },
  'vanilla': {
    base: 'Classic warm vanilla custard with golden wheat tones (#F5DEB3 with slightly deeper #EDD9A3 in scoop shadows and brighter #FFF5E8 at crown).',
    swirls: 'None -- pure vanilla with subtle natural color depth variations.',
    chunks: 'None -- clean scoop with no inclusions.',
    texture: 'Smooth scoop with low inclusion noise. Emphasize the warm golden-cream color with gentle gradients from deeper wheat at the base to brighter cream at the crown. Classic custard surface with soft light reflections and creamy richness.',
  },
};

const QUALITY_LADDER = [
  {
    tier: 'L0',
    name: 'Tidbyt Micro',
    appSurface: 'Tidbyt forecast columns',
    density: '9x11',
    guidance: 'Extreme simplification. Keep a clean cone silhouette, no anti-aliasing, and 0-3 readable inclusions.',
  },
  {
    tier: 'L1',
    name: 'Map Marker Micro',
    appSurface: 'Map marker cone icon',
    density: '9x11 in pin',
    guidance: 'Same geometry as L0 with slightly boosted contrast for map legibility.',
  },
  {
    tier: 'L2',
    name: 'Widget Mini',
    appSurface: 'Widget and inline mini cone',
    density: '9x11 scaled',
    guidance: 'Allow mild highlight and up to 4 inclusions while preserving hard pixel edges.',
  },
  {
    tier: 'L3',
    name: 'Radar HD',
    appSurface: 'Radar cards',
    density: '18x21',
    guidance: 'Use HD slot layout, visible ribbon curve, and clearly separated ingredient colors.',
  },
  {
    tier: 'L4',
    name: 'Hero/OG Pixel',
    appSurface: 'Hero and OG cone render',
    density: '36x42',
    guidance: 'Use hero slot layout with specular highlight, edge shadow, and strong ingredient readability.',
  },
  {
    tier: 'L5',
    name: 'Premium Showcase',
    appSurface: 'Marketing or hero reference art',
    density: '32-64px style density',
    guidance: 'Highest detail while still pixel art: visible marbling, realistic chunk forms, and crisp per-pixel depth.',
  },
];

const MASTERLOCK_TEMPLATE = `Pixel art ice cream cone, centered composition, single scoop, 1:1 aspect ratio.

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
- Texture notes:`;

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u00ae\u2122]/g, '')
    .replace(/[\u2018\u2019]/g, '\'')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleFromKey(key) {
  if (TITLE_FALLBACK[key]) return TITLE_FALLBACK[key];
  return key
    .split(' ')
    .map((word) => {
      if (word === 'oreo') return 'OREO';
      if (word === 'pb') return 'PB';
      if (word === 'and') return 'and';
      if (word.includes("'")) {
        return word
          .split("'")
          .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
          .join("'");
      }
      return word[0].toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function formatChunkInclusions(toppings) {
  if (!toppings || toppings.length === 0) {
    return 'None (clean scoop with no chunk inclusions).';
  }

  const counts = new Map();
  const order = [];
  for (const topping of toppings) {
    if (!counts.has(topping)) order.push(topping);
    counts.set(topping, (counts.get(topping) || 0) + 1);
  }

  return order
    .map((topping) => {
      const label = TOPPING_LABELS[topping] || topping;
      const hex = TOPPING_COLORS[topping] || 'n/a';
      return `${label} x${counts.get(topping)} (${hex})`;
    })
    .join('; ');
}

function textureNotesForProfile(profile) {
  const density = profile.density || 'standard';
  const notes = [DENSITY_NOTES[density] || DENSITY_NOTES.standard];

  if (profile.ribbon) {
    notes.push('Keep ribbon visible through inclusions with clean edge contrast.');
  }

  const hasDarkBase = profile.base === 'dark_chocolate' || profile.base === 'chocolate_custard';
  const hasDarkChunks = (profile.toppings || []).some((key) => key === 'dove' || key === 'brownie' || key === 'oreo');
  if (hasDarkBase && hasDarkChunks) {
    notes.push('Boost local contrast around dark chunks so ingredients stay readable.');
  }

  return notes.join(' ');
}

function ingredientTreatmentForFlavor(profile) {
  const baseLabel = BASE_LABELS[profile.base] || profile.base;
  const baseHex = BASE_COLORS[profile.base] || 'n/a';

  const swirls = profile.ribbon
    ? `${RIBBON_LABELS[profile.ribbon] || profile.ribbon} (${RIBBON_COLORS[profile.ribbon] || 'n/a'}).`
    : 'None.';

  return {
    base: `${baseLabel} (${baseHex}).`,
    swirls,
    chunks: formatChunkInclusions(profile.toppings || []),
    texture: textureNotesForProfile(profile),
  };
}

function flavorFillSnippet({ title, description, treatment }) {
  return `Flavor: ${title}

Description:
${description}

Ingredient treatment:
- Base custard color: ${treatment.base}
- Swirls: ${treatment.swirls}
- Chunk inclusions: ${treatment.chunks}
- Texture notes: ${treatment.texture}`;
}

async function main() {
  const rawFlavorCatalog = JSON.parse(await fs.readFile(FLAVORS_JSON_PATH, 'utf8'));
  const catalog = Array.isArray(rawFlavorCatalog.flavors) ? rawFlavorCatalog.flavors : rawFlavorCatalog;

  const titleByNormalized = new Map();
  const descriptionByNormalized = new Map();
  for (const flavor of catalog) {
    const key = normalizeName(flavor.title);
    titleByNormalized.set(key, flavor.title);
    descriptionByNormalized.set(key, flavor.description);
  }

  const fillCards = [];
  const profileKeys = Object.keys(FLAVOR_PROFILES).sort();

  for (const key of profileKeys) {
    const normalized = normalizeName(key);
    const title = titleByNormalized.get(normalized) || titleFromKey(key);
    const description = descriptionByNormalized.get(normalized) || DESCRIPTION_FALLBACK[key];
    if (!description) {
      throw new Error(`No description available for flavor key "${key}"`);
    }

    const profile = FLAVOR_PROFILES[key];
    const treatment = ingredientTreatmentForFlavor(profile);
    const premiumTreatmentOverride = PREMIUM_TREATMENT_OVERRIDES[key] || null;
    fillCards.push({
      flavor_key: key,
      title,
      description,
      treatment,
      premium_treatment_override: premiumTreatmentOverride,
      profile,
    });
  }

  const ladderTableRows = QUALITY_LADDER
    .map((row) => `| ${row.tier} | ${row.name} | ${row.appSurface} | ${row.density} | ${row.guidance} |`)
    .join('\n');

  const markdownCards = fillCards
    .map((card) => `## ${card.title}

Description: ${card.description}

Flavor fill:
\`\`\`text
${flavorFillSnippet({
  title: card.title,
  description: card.description,
  treatment: card.treatment,
})}
\`\`\`

Canonical profile:
- Base key: \`${card.profile.base}\`
- Ribbon key: \`${card.profile.ribbon || 'none'}\`
- Toppings: \`${(card.profile.toppings || []).join(', ') || 'none'}\`
- Density: \`${card.profile.density || 'standard'}\`

${card.premium_treatment_override ? `L5 premium override (showcase detail):
\`\`\`text
Ingredient treatment:
- Base custard color: ${card.premium_treatment_override.base}
- Swirls: ${card.premium_treatment_override.swirls}
- Chunk inclusions: ${card.premium_treatment_override.chunks}
- Texture notes: ${card.premium_treatment_override.texture}
\`\`\`` : ''}`)
    .join('\n\n---\n\n');

  const markdown = `# Masterlock Pixel Prompt Pack

Auto-generated from:
- worker/src/flavor-colors.js
- docs/flavors.json

Regenerate:
\`\`\`bash
node tools/generate_masterlock_prompts.mjs
\`\`\`

## Locked Template

\`\`\`text
${MASTERLOCK_TEMPLATE}
\`\`\`

## Complexity Ladder

Use this ladder to scale from left-side map/Tidbyt simplicity up to premium Blackberry-style detail.

| Tier | Name | App surface | Density | Guidance |
| --- | --- | --- | --- | --- |
${ladderTableRows}

## Flavor Fill Cards (${fillCards.length})

${markdownCards}
`;

  const json = {
    generated_at: new Date().toISOString(),
    source: {
      flavor_profiles: 'worker/src/flavor-colors.js',
      descriptions: 'docs/flavors.json',
    },
    color_data: {
      profiles: FLAVOR_PROFILES,
      base_colors: BASE_COLORS,
      ribbon_colors: RIBBON_COLORS,
      topping_colors: TOPPING_COLORS,
      cone_colors: CONE_COLORS,
    },
    complexity_ladder: QUALITY_LADDER,
    template: MASTERLOCK_TEMPLATE,
    flavors: fillCards.map((card) => ({
      flavor_key: card.flavor_key,
      title: card.title,
      description: card.description,
      ingredient_treatment: card.treatment,
      premium_treatment_override: card.premium_treatment_override,
      profile: card.profile,
    })),
  };

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(OUT_PATH_MD, markdown, 'utf8');
  await fs.writeFile(OUT_PATH_JSON, JSON.stringify(json, null, 2) + '\n', 'utf8');
  await fs.writeFile(OUT_PATH_JS, 'window.MASTERLOCK_FLAVOR_FILLS = ' + JSON.stringify(json, null, 2) + ';\n', 'utf8');
  console.log(`Wrote ${fillCards.length} flavor cards to ${OUT_PATH_MD}`);
  console.log(`Wrote JSON flavor fills to ${OUT_PATH_JSON}`);
  console.log(`Wrote browser seed JS to ${OUT_PATH_JS}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
