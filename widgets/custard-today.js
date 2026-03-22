// Custard Today -- Scriptable widget for iOS
// Shows today's Flavor of the Day from Custard Calendar.
//
// Setup:
//   1. Install Scriptable from the App Store
//   2. Create a new script, paste this file
//   3. Add a Scriptable widget to your home screen
//   4. Long-press the widget > Edit Widget > choose this script
//   5. Set Parameter to your store slug (e.g. "mt-horeb")
//      Find your slug at custard.chriskaschner.com/widget.html
//
// Small widget:  Cone icon, flavor name, description, rarity badge
// Medium widget: 3-day cards with cone icons, flavor names, and descriptions
// Medium widget (MODE="multi"): today's flavor at 3 stores side by side
//
// Art pipeline: L5 AI PNG (online) with L0-aligned DrawContext fallback (offline).
// PNG slugs resolve through FLAVOR_ALIASES to match docs/assets/cones/ filenames.

var API_BASE = "https://custard.chriskaschner.com/api/v1";
var CONE_PNG_BASE = "https://custard.chriskaschner.com/assets/cones";
var slug = (args.widgetParameter || "mt-horeb").trim();

var BRAND_COLORS = {
  "Culver's": { bg: "#005696", text: "#FFFFFF" },
  "Kopp's":   { bg: "#1a1a1a", text: "#FFFFFF" },
  "Gille's":  { bg: "#EBCC35", text: "#1a1a1a" },
  "Hefner's": { bg: "#93BE46", text: "#1a1a1a" },
  "Kraverz":  { bg: "#CE742D", text: "#FFFFFF" },
  "Oscar's":  { bg: "#BC272C", text: "#FFFFFF" }
};

var RARITY_COLORS = {
  "Ultra Rare": "#9C27B0",
  "Rare":       "#E65100",
  "Uncommon":   "#1565C0",
  "Common":     "#757575",
  "Staple":     "#2E7D32"
};

// Flavor alias map for slug resolution -- variant names to canonical PNG filenames
var FLAVOR_ALIASES = {
  "reeses peanut butter cup": "really reese's",
  "reese's peanut butter cup": "really reese's",
  "pb cup": "really reese's",
  "georgia peach pecan": "georgia peach",
  "oreo cookies and cream": "oreo cookie cheesecake",
  "cookie dough craze": "crazy for cookie dough",
  "chocolate decadence": "dark chocolate decadence",
  "dark chocolate peanut butter crunch": "dark chocolate pb crunch",
  "snickers": "snickers swirl",
  "salted caramel pecan": "salted double caramel pecan",
  "vanilla custard": "vanilla",
  "butter pecan custard": "butter pecan",
  "turtle sundae": "turtle",
  "caramel turtle sundae": "caramel turtle",
  "double strawberry custard": "double strawberry",
  "brownie batter": "brownie thunder",
  "mint oreo": "mint cookie",
  "oreo mint": "mint cookie",
  "oreo cheesecake cookie": "oreo cookie cheesecake",
  "heath bar crunch": "chocolate heath crunch",
  "choc m&m": "m&m swirl",
  "bonfire smores": "bonfire s'mores",
  "s'mores": "bonfire s'mores",
  "raspberry cream": "red raspberry",
  "butterfinger": "butter finger blast",
  "cookies and cream": "cookies & cream",
  "oreo cookies & cream": "cookies & cream",
  "kit kat": "kit kat bar",
  "rice krispy treat": "rice krispie treat",
  "rice krispie": "rice krispie treat",
  "baileys irish cream": "bailey's irish cream",
  "grasshopper": "grasshopper fudge",
  "root beer": "root beer float",
  "key lime pie": "key lime custard pie",
  "key lime": "key lime custard pie",
  "coconut pie": "coconut cream pie",
  "banana pie": "banana cream pie"
};

// Canonical 23-entry base color palette for offline cone fallback (matches cone-renderer.js)
var BASE_COLORS = {
  vanilla: '#F5DEB3',
  chocolate: '#6F4E37',
  chocolate_custard: '#5A3825',
  dark_chocolate: '#3B1F0B',
  mint: '#2ECC71',
  mint_andes: '#1A8A4A',
  strawberry: '#FF6B9D',
  cheesecake: '#FFF5E1',
  caramel: '#C68E17',
  butter_pecan: '#F2E7D1',
  peach: '#FFE5B4',
  lemon: '#FFF176',
  blackberry: '#6B3FA0',
  espresso: '#2C1503',
  cherry: '#C41E3A',
  pumpkin: '#D2691E',
  banana: '#F0E68C',
  coconut: '#FFFAF0',
  root_beer: '#5C3317',
  pistachio: '#93C572',
  orange: '#FF8C00',
  blue_moon: '#5B9BD5',
  maple: '#C9882C'
};

// Guess scoop color from flavor name keywords
function scoopColor(flavorName) {
  if (!flavorName) return "#F5DEB3";
  var lower = flavorName.toLowerCase();
  var keys = Object.keys(BASE_COLORS);
  for (var i = 0; i < keys.length; i++) {
    if (lower.indexOf(keys[i]) !== -1) return BASE_COLORS[keys[i]];
  }
  // Extended keyword fallbacks for palette entries with underscored keys
  if (lower.indexOf("blackberry") !== -1 || lower.indexOf("berry") !== -1) return BASE_COLORS.blackberry;
  if (lower.indexOf("espresso") !== -1 || lower.indexOf("coffee") !== -1 || lower.indexOf("cappuccino") !== -1) return BASE_COLORS.espresso;
  if (lower.indexOf("cherry") !== -1) return BASE_COLORS.cherry;
  if (lower.indexOf("pumpkin") !== -1) return BASE_COLORS.pumpkin;
  if (lower.indexOf("banana") !== -1) return BASE_COLORS.banana;
  if (lower.indexOf("coconut") !== -1) return BASE_COLORS.coconut;
  if (lower.indexOf("root beer") !== -1) return BASE_COLORS.root_beer;
  if (lower.indexOf("pistachio") !== -1) return BASE_COLORS.pistachio;
  if (lower.indexOf("orange") !== -1 || lower.indexOf("creamsicle") !== -1) return BASE_COLORS.orange;
  if (lower.indexOf("blue moon") !== -1) return BASE_COLORS.blue_moon;
  if (lower.indexOf("maple") !== -1) return BASE_COLORS.maple;
  // Broad category fallbacks
  if (lower.indexOf("choc") !== -1 || lower.indexOf("fudge") !== -1) return "#6F4E37";
  if (lower.indexOf("cream") !== -1) return "#FFF8DC";
  return "#F5DEB3";
}

// Convert flavor name to PNG filename slug, resolving aliases first
function flavorToSlug(name) {
  if (!name) return null;
  var key = name.toLowerCase().replace(/[\u00ae\u2122]/g, '').replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ').trim();
  var canonical = FLAVOR_ALIASES[key];
  var nameForSlug = canonical || key;
  var slug = nameForSlug.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || null;
}

// Try loading L5 AI PNG from CDN; fall back to drawConeIcon on failure
async function getConeImage(flavorName, size) {
  var coneSlug = flavorToSlug(flavorName);
  if (coneSlug) {
    try {
      var url = CONE_PNG_BASE + "/" + coneSlug + ".png";
      var img = await new Request(url).loadImage();
      return img;
    } catch (e) {
      // Network error or 404 -- fall through to drawConeIcon
      console.log("[custard] getConeImage failed for '" + flavorName + "': " + (e && e.message || e));
    }
  }
  return drawConeIcon(flavorName, size);
}

// Draw a mini cone icon using DrawContext and return as Image
function drawConeIcon(flavorName, size) {
  var s = size || 28;
  var ctx = new DrawContext();
  ctx.size = new Size(s, s);
  ctx.opaque = false;
  ctx.respectScreenScale = true;

  var scoopR = s * 0.32;
  var scoopCx = s / 2;
  var scoopCy = s * 0.30;
  var sc = new Color(scoopColor(flavorName));

  // Cone body (waffle triangle)
  var conePath = new Path();
  conePath.move(new Point(scoopCx - scoopR * 0.85, scoopCy + scoopR * 0.4));
  conePath.addLine(new Point(scoopCx, s * 0.92));
  conePath.addLine(new Point(scoopCx + scoopR * 0.85, scoopCy + scoopR * 0.4));
  conePath.closeSubpath();
  ctx.addPath(conePath);
  ctx.setFillColor(new Color("#D2691E"));
  ctx.fillPath();

  // Waffle crosshatch lines
  ctx.setStrokeColor(new Color("#B8860B"));
  ctx.setLineWidth(0.5);
  var coneTop = scoopCy + scoopR * 0.4;
  var coneBot = s * 0.92;
  var coneH = coneBot - coneTop;
  for (var li = 1; li <= 3; li++) {
    var yLine = coneTop + (coneH * li / 4);
    var frac = (yLine - coneTop) / coneH;
    var halfW = scoopR * 0.85 * (1 - frac);
    var linePath = new Path();
    linePath.move(new Point(scoopCx - halfW, yLine));
    linePath.addLine(new Point(scoopCx + halfW, yLine));
    ctx.addPath(linePath);
    ctx.strokePath();
  }

  // Scoop (filled circle)
  var scoopRect = new Rect(scoopCx - scoopR, scoopCy - scoopR, scoopR * 2, scoopR * 2);
  ctx.setFillColor(sc);
  ctx.fillEllipse(scoopRect);

  // Scoop highlight (lighter circle in upper-left)
  var hlR = scoopR * 0.3;
  var hlRect = new Rect(scoopCx - scoopR * 0.4, scoopCy - scoopR * 0.5, hlR * 2, hlR * 2);
  ctx.setFillColor(new Color("#FFFFFF", 0.3));
  ctx.fillEllipse(hlRect);

  return ctx.getImage();
}

// Fetch today's flavor
async function fetchToday() {
  var url = API_BASE + "/today?slug=" + encodeURIComponent(slug);
  var req = new Request(url);
  req.timeoutInterval = 10;
  return await req.loadJSON();
}

// Fetch multi-day flavors
async function fetchFlavors() {
  var url = API_BASE + "/flavors?slug=" + encodeURIComponent(slug);
  var req = new Request(url);
  req.timeoutInterval = 10;
  return await req.loadJSON();
}

function formatDate(dateStr) {
  var d = new Date(dateStr + "T12:00:00");
  var today = new Date();
  today.setHours(12, 0, 0, 0);
  var tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";

  var days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return days[d.getDay()] + ", " + months[d.getMonth()] + " " + d.getDate();
}

function brandStyle(brandName) {
  return BRAND_COLORS[brandName] || BRAND_COLORS["Culver's"];
}

function rarityTextColor(label) {
  if (!label) return new Color("#90CAF9");
  return new Color(RARITY_COLORS[label] || "#90CAF9");
}

// Shared medium-row renderer so 3-day and 3-store views stay in visual sync.
async function addMediumRow(body, row) {
  var card = body.addStack();
  card.layoutHorizontally();
  card.centerAlignContent();
  card.spacing = 8;

  var coneImg = await getConeImage(row.flavor, 28);
  var coneEl = card.addImage(coneImg);
  coneEl.imageSize = new Size(28, 28);

  var textCol = card.addStack();
  textCol.layoutVertically();
  textCol.spacing = 1;

  var metaRow = textCol.addStack();
  metaRow.layoutHorizontally();
  metaRow.centerAlignContent();

  var labelEl = metaRow.addText(row.label || "");
  labelEl.font = Font.mediumSystemFont(10);
  labelEl.textColor = new Color("#ffffff", 0.5);
  labelEl.lineLimit = 1;

  metaRow.addSpacer(null);
  if (row.rarityLabel) {
    var rarityEl = metaRow.addText(String(row.rarityLabel).toUpperCase());
    rarityEl.font = Font.boldMonospacedSystemFont(8);
    rarityEl.textColor = rarityTextColor(row.rarityLabel);
    rarityEl.lineLimit = 1;
  }

  var flavorEl = textCol.addText(row.flavor || "TBD");
  flavorEl.font = Font.boldSystemFont(13);
  flavorEl.textColor = Color.white();
  flavorEl.lineLimit = 1;
  flavorEl.minimumScaleFactor = 0.7;

  if (row.description) {
    var descEl = textCol.addText(truncateDesc(row.description, 65));
    descEl.font = Font.systemFont(10);
    descEl.textColor = new Color("#ffffff", 0.55);
    descEl.lineLimit = 1;
  }
}

function truncateDesc(desc, maxLen) {
  if (!desc) return "";
  if (desc.length <= maxLen) return desc;
  return desc.substring(0, maxLen - 1).trim() + "\u2026";
}

// Extract city from store name (e.g. "Culver's of Mt. Horeb, WI" -> "Mt. Horeb")
function cityFromStore(storeName) {
  if (!storeName) return slug;
  var m = storeName.match(/of\s+(.+?)(?:,|\s*-)/);
  if (m) return m[1].trim();
  var c = storeName.match(/^(.+?),/);
  if (c) return c[1].trim();
  return slug;
}

// --- Small Widget: Branded header bar + cone + flavor ---
// Header: date label LEFT, city RIGHT

async function buildSmall() {
  var data = await fetchToday();
  var style = brandStyle(data.brand);
  var city = cityFromStore(data.store);
  var w = new ListWidget();
  w.backgroundColor = new Color("#1a1a1a");
  w.setPadding(0, 0, 0, 0);
  w.url = "https://custard.chriskaschner.com/scoop.html?stores=" + encodeURIComponent(slug);

  // Branded header bar: date LEFT, city RIGHT
  var header = w.addStack();
  header.backgroundColor = new Color(style.bg);
  header.setPadding(6, 16, 6, 16);
  header.layoutHorizontally();
  header.centerAlignContent();

  var dateText = header.addText(formatDate(data.date));
  dateText.font = Font.systemFont(10);
  dateText.textColor = new Color(style.text, 0.8);
  header.addSpacer(null);
  var cityText = header.addText(city);
  cityText.font = Font.semiboldSystemFont(11);
  cityText.textColor = new Color(style.text);

  // Content area
  var body = w.addStack();
  body.setPadding(8, 16, 12, 16);
  body.layoutVertically();

  // Cone icon + flavor name row
  var mainRow = body.addStack();
  mainRow.layoutHorizontally();
  mainRow.centerAlignContent();
  mainRow.spacing = 10;

  var coneImg = await getConeImage(data.flavor, 36);
  var coneEl = mainRow.addImage(coneImg);
  coneEl.imageSize = new Size(36, 36);

  var textCol = mainRow.addStack();
  textCol.layoutVertically();

  var flavorText = textCol.addText(data.flavor || "No flavor listed");
  flavorText.font = Font.boldSystemFont(15);
  flavorText.textColor = Color.white();
  flavorText.minimumScaleFactor = 0.6;
  flavorText.lineLimit = 2;

  // Description
  if (data.description) {
    textCol.addSpacer(2);
    var descText = textCol.addText(truncateDesc(data.description, 60));
    descText.font = Font.systemFont(11);
    descText.textColor = new Color("#ffffff", 0.6);
    descText.lineLimit = 2;
  }

  body.addSpacer(null);

  // Rarity badge
  if (data.rarity && data.rarity.label) {
    var badge = body.addText(data.rarity.label.toUpperCase());
    badge.font = Font.boldMonospacedSystemFont(9);
    var rarityColor = RARITY_COLORS[data.rarity.label] || RARITY_COLORS["Common"];
    badge.textColor = new Color(rarityColor);
  }

  return w;
}

// --- Medium Widget: Branded header + 3-day cell rows ---
// Header: "This Week" LEFT, city RIGHT

async function buildMedium() {
  var data = await fetchFlavors();
  var flavors = (data.flavors || []);

  var todayStr = new Date().toISOString().slice(0, 10);
  var upcoming = flavors.filter(function(f) { return f.date >= todayStr; }).slice(0, 3);

  var todayData = null;
  try { todayData = await fetchToday(); } catch (e) { /* best effort */ }

  var brandName = todayData ? (todayData.brand || "Culver's") : "Culver's";
  if (!todayData) {
    var storeName = data.name || "";
    var brandKeys = Object.keys(BRAND_COLORS);
    for (var bi = 0; bi < brandKeys.length; bi++) {
      if (storeName.indexOf(brandKeys[bi]) !== -1) {
        brandName = brandKeys[bi];
        break;
      }
    }
  }
  var style = brandStyle(brandName);
  var city = cityFromStore(todayData ? todayData.store : data.name);

  var w = new ListWidget();
  w.backgroundColor = new Color("#1a1a1a");
  w.setPadding(0, 0, 0, 0);
  w.url = "https://custard.chriskaschner.com/scoop.html?stores=" + encodeURIComponent(slug);

  // Branded header bar: "This Week" LEFT, city RIGHT
  var header = w.addStack();
  header.backgroundColor = new Color(style.bg);
  header.setPadding(6, 16, 6, 16);
  header.layoutHorizontally();
  header.centerAlignContent();

  var weekLabel = header.addText("This Week");
  weekLabel.font = Font.systemFont(10);
  weekLabel.textColor = new Color(style.text, 0.8);
  header.addSpacer(null);
  var cityText = header.addText(city);
  cityText.font = Font.semiboldSystemFont(11);
  cityText.textColor = new Color(style.text);

  // Content area
  var body = w.addStack();
  body.setPadding(6, 16, 10, 16);
  body.layoutVertically();

  if (upcoming.length === 0) {
    var noData = body.addText("No upcoming flavors listed");
    noData.font = Font.systemFont(13);
    noData.textColor = new Color("#ffffff", 0.6);
  } else {
    var todayRarity = todayData && todayData.rarity ? todayData.rarity.label : null;
    for (var i = 0; i < upcoming.length; i++) {
      var f = upcoming[i];
      var rarityLabel = null;
      if (todayData && f.date === todayData.date && f.title === todayData.flavor) {
        rarityLabel = todayRarity;
      }
      await addMediumRow(body, {
        label: formatDate(f.date),
        flavor: f.title || "TBD",
        description: f.description || "",
        rarityLabel: rarityLabel,
      });

      if (i < upcoming.length - 1) body.addSpacer(4);
    }
  }

  return w;
}

// --- Multi-store Medium Widget: branded header + 3 store rows ---
// Header: branded color from first store, "Today" LEFT only
// Each row: cone icon | [city + rarity right-aligned, flavor name, description]

async function buildMultiStore(slugs) {
  var validSlugs = slugs.filter(function(s) { return s !== null && s !== undefined; });

  var results = await Promise.all(validSlugs.map(async function(s) {
    try {
      var req = new Request(API_BASE + "/today?slug=" + encodeURIComponent(s));
      req.timeoutInterval = 10;
      return await req.loadJSON();
    } catch(e) { return null; }
  }));

  // Use first valid result's brand for header (matches small/medium widgets)
  var firstData = results.find(function(r) { return r !== null; });
  var style = brandStyle(firstData ? (firstData.brand || "Culver's") : "Culver's");

  var w = new ListWidget();
  w.backgroundColor = new Color("#1a1a1a");
  w.setPadding(0, 0, 0, 0);
  w.url = "https://custard.chriskaschner.com/scoop.html?stores=" + validSlugs.join(",");

  // Branded header bar: "Today" LEFT, "Your Stores" RIGHT
  var header = w.addStack();
  header.backgroundColor = new Color(style.bg);
  header.setPadding(6, 16, 6, 16);
  header.layoutHorizontally();
  header.centerAlignContent();

  var todayLbl = header.addText("Today");
  todayLbl.font = Font.systemFont(10);
  todayLbl.textColor = new Color(style.text, 0.8);
  header.addSpacer(null);
  var headerCityEl = header.addText("Your Stores");
  headerCityEl.font = Font.semiboldSystemFont(11);
  headerCityEl.textColor = new Color(style.text);

  // Content body: store rows matching buildMedium padding/spacing
  var body = w.addStack();
  body.setPadding(6, 16, 10, 16);
  body.layoutVertically();

  for (var i = 0; i < validSlugs.length; i++) {
    var data = results[i];
    var storeSlug = validSlugs[i];
    var city = data ? cityFromStore(data.store) : (storeSlug || "Store");
    var flavorName = data ? (data.flavor || "TBD") : "\u2014";
    var rarityLabel = data && data.rarity ? data.rarity.label : null;
    await addMediumRow(body, {
      label: city,
      flavor: flavorName,
      description: data ? (data.description || "") : "",
      rarityLabel: rarityLabel,
    });

    if (i < validSlugs.length - 1) body.addSpacer(4);
  }

  return w;
}

// --- Entry point ---

// When running in-app (not on home screen), config.widgetFamily is null.
// Default to "medium" for multi-store scripts so the in-app preview shows
// the 3-store view instead of the small single-store view.
var isMultiMode = typeof MODE !== "undefined" && MODE === "multi";
var widgetSize = config.widgetFamily || (isMultiMode ? "medium" : "small");
var widget;

if (widgetSize === "medium" || widgetSize === "large") {
  if (isMultiMode) {
    widget = await buildMultiStore(slugs);
  } else {
    widget = await buildMedium();
  }
} else {
  widget = await buildSmall();
}

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  // Preview when running in-app
  var isMedium = widgetSize === "medium" || isMultiMode;
  if (isMedium) {
    widget.presentMedium();
  } else {
    widget.presentSmall();
  }
}

Script.complete();
