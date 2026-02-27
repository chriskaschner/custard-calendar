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

var API_BASE = "https://custard.chriskaschner.com/api/v1";
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

// Base flavor colors for cone scoop -- matches the Forecast page palette
var FLAVOR_SCOOP_COLORS = {
  "vanilla":    "#F5DEB3",
  "chocolate":  "#6F4E37",
  "mint":       "#2ECC71",
  "strawberry": "#FF6B9D",
  "caramel":    "#D4A056",
  "peanut":     "#C8A96E",
  "cookie":     "#C4A882",
  "lemon":      "#FFE066",
  "raspberry":  "#E91E63",
  "turtle":     "#8B6914",
  "pecan":      "#A67B5B",
  "oreo":       "#3E3E3E",
  "cheesecake": "#FFF8DC",
  "peach":      "#FFAB76",
  "butter":     "#E8C872"
};

// Guess scoop color from flavor name keywords
function scoopColor(flavorName) {
  if (!flavorName) return "#F5DEB3";
  var lower = flavorName.toLowerCase();
  var keys = Object.keys(FLAVOR_SCOOP_COLORS);
  for (var i = 0; i < keys.length; i++) {
    if (lower.indexOf(keys[i]) !== -1) return FLAVOR_SCOOP_COLORS[keys[i]];
  }
  // Broad category fallbacks
  if (lower.indexOf("choc") !== -1 || lower.indexOf("fudge") !== -1) return "#6F4E37";
  if (lower.indexOf("cream") !== -1) return "#FFF8DC";
  return "#F5DEB3";
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

  var coneImg = drawConeIcon(data.flavor, 36);
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
    for (var i = 0; i < upcoming.length; i++) {
      var f = upcoming[i];

      var card = body.addStack();
      card.layoutHorizontally();
      card.centerAlignContent();
      card.spacing = 8;

      var coneImg = drawConeIcon(f.title, 28);
      var coneEl = card.addImage(coneImg);
      coneEl.imageSize = new Size(28, 28);

      var textCol = card.addStack();
      textCol.layoutVertically();
      textCol.spacing = 1;

      var dateCol = textCol.addText(formatDate(f.date));
      dateCol.font = Font.mediumSystemFont(10);
      dateCol.textColor = new Color("#ffffff", 0.5);
      dateCol.lineLimit = 1;

      var flavorCol = textCol.addText(f.title || "TBD");
      flavorCol.font = Font.boldSystemFont(13);
      flavorCol.textColor = Color.white();
      flavorCol.lineLimit = 1;
      flavorCol.minimumScaleFactor = 0.7;

      if (f.description) {
        var desc = textCol.addText(truncateDesc(f.description, 65));
        desc.font = Font.systemFont(10);
        desc.textColor = new Color("#ffffff", 0.55);
        desc.lineLimit = 1;
      }

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

  // Branded header bar: "Today" LEFT only
  var header = w.addStack();
  header.backgroundColor = new Color(style.bg);
  header.setPadding(6, 16, 6, 16);
  header.layoutHorizontally();
  header.centerAlignContent();

  var todayLbl = header.addText("Today");
  todayLbl.font = Font.systemFont(10);
  todayLbl.textColor = new Color(style.text, 0.8);

  // Content body: store rows matching buildMedium padding/spacing
  var body = w.addStack();
  body.setPadding(6, 16, 10, 16);
  body.layoutVertically();

  for (var i = 0; i < validSlugs.length; i++) {
    var data = results[i];
    var storeSlug = validSlugs[i];

    var row = body.addStack();
    row.layoutHorizontally();
    row.centerAlignContent();
    row.spacing = 8;

    var coneImg = drawConeIcon(data ? data.flavor : null, 28);
    var coneEl = row.addImage(coneImg);
    coneEl.imageSize = new Size(28, 28);

    var textCol = row.addStack();
    textCol.layoutVertically();
    textCol.spacing = 1;

    // Top line: city name LEFT, rarity RIGHT (mirrors date label in 3-day)
    var topRow = textCol.addStack();
    topRow.layoutHorizontally();
    topRow.centerAlignContent();

    var city = data ? cityFromStore(data.store) : storeSlug;
    var cityEl = topRow.addText(city);
    cityEl.font = Font.mediumSystemFont(10);
    cityEl.textColor = new Color("#ffffff", 0.5);
    cityEl.lineLimit = 1;

    topRow.addSpacer(null);

    if (data && data.rarity && data.rarity.label) {
      var rarityEl = topRow.addText(data.rarity.label.toUpperCase());
      rarityEl.font = Font.boldMonospacedSystemFont(8);
      var rarityColor = RARITY_COLORS[data.rarity.label] || RARITY_COLORS["Common"];
      rarityEl.textColor = new Color(rarityColor);
    }

    var flavorName = data ? (data.flavor || "TBD") : "\u2014";
    var flavorEl = textCol.addText(flavorName);
    flavorEl.font = Font.boldSystemFont(13);
    flavorEl.textColor = Color.white();
    flavorEl.lineLimit = 1;
    flavorEl.minimumScaleFactor = 0.7;

    if (data && data.description) {
      var desc = textCol.addText(truncateDesc(data.description, 65));
      desc.font = Font.systemFont(10);
      desc.textColor = new Color("#ffffff", 0.55);
      desc.lineLimit = 1;
    }

    if (i < validSlugs.length - 1) body.addSpacer(4);
  }

  return w;
}

// --- Entry point ---

var widgetSize = (config.widgetFamily || "small");
var widget;

if (widgetSize === "medium" || widgetSize === "large") {
  if (typeof MODE !== "undefined" && MODE === "multi") {
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
  var isMedium = widgetSize === "medium" || (typeof MODE !== "undefined" && MODE === "multi");
  if (isMedium) {
    widget.presentMedium();
  } else {
    widget.presentSmall();
  }
}

Script.complete();
