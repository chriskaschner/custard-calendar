/**
 * CustardPlanner -- Data sub-module.
 * Brand constants, normalize, haversine, similarity groups, flavor families,
 * and seasonal detection.
 *
 * Loaded after planner-shared.js; extends window.CustardPlanner via Object.assign.
 */
(function () {
  'use strict';

  var CP = window.CustardPlanner;
  if (!CP) { console.error('planner-data.js: CustardPlanner not found'); return; }

  // ---------------------------------------------------------------------------
  // Seasonal flavor detection
  // Mirrors SEASONAL_PATTERN from worker/src/flavor-tags.js -- keep in sync
  // ---------------------------------------------------------------------------

  var SEASONAL_PATTERN = /\b(pumpkin|peppermint|eggnog|holiday|gingerbread|apple\s*cider)\b/i;

  function isSeasonalFlavor(flavorName) {
    if (!flavorName) return false;
    return SEASONAL_PATTERN.test(String(flavorName));
  }

  // ---------------------------------------------------------------------------
  // Brand constants
  // ---------------------------------------------------------------------------

  var BRAND_COLORS = {
    culvers: '#005696',
    kopps: '#000000',
    gilles: '#EBCC35',
    hefners: '#93BE46',
    kraverz: '#CE742D',
    oscars: '#BC272C',
  };

  var BRAND_DISPLAY = {
    kopps: "Kopp's",
    gilles: "Gille's",
    hefners: "Hefner's",
    kraverz: "Kraverz",
    oscars: "Oscar's",
  };

  function brandFromSlug(slug) {
    if (!slug) return 'culvers';
    if (slug.startsWith('kopps-')) return 'kopps';
    if (slug === 'gilles') return 'gilles';
    if (slug === 'hefners') return 'hefners';
    if (slug === 'kraverz') return 'kraverz';
    if (slug.startsWith('oscars')) return 'oscars';
    return 'culvers';
  }

  function brandDisplayName(slug) {
    var brand = brandFromSlug(slug);
    return BRAND_DISPLAY[brand] || "Culver's";
  }

  // ---------------------------------------------------------------------------
  // Normalize
  // ---------------------------------------------------------------------------

  /** Canonical flavor normalization -- handles registered marks, curly quotes,
   *  and Oreo brand variations. All surfaces should use this single function. */
  function normalize(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/\boreo(?:\u00ae)?\b/g, 'oreo')
      .replace(/[\u00ae\u2122\u00a9]/g, '')
      .replace(/[\u2018\u2019'']/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  // ---------------------------------------------------------------------------
  // Haversine
  // ---------------------------------------------------------------------------

  function haversineMiles(lat1, lon1, lat2, lon2) {
    var toRad = function (deg) { return deg * Math.PI / 180; };
    var dLat = toRad(lat2 - lat1);
    var dLon = toRad(lon2 - lon1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
      + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2))
      * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ---------------------------------------------------------------------------
  // Similarity groups (canonical, from engine.js -- most complete set)
  // ---------------------------------------------------------------------------

  var SIMILARITY_GROUPS = {
    mint: ['andes mint avalanche', 'mint cookie', 'mint explosion'],
    chocolate: [
      'chocolate caramel twist', 'chocolate heath crunch',
      'dark chocolate decadence', 'dark chocolate pb crunch',
      'chocolate volcano', 'chocolate oreo volcano',
    ],
    caramel: [
      'caramel cashew', 'caramel fudge cookie dough', 'caramel pecan',
      'caramel turtle', 'salted caramel pecan pie', 'chocolate caramel twist',
    ],
    cheesecake: [
      'oreo cheesecake', 'oreo cookie cheesecake',
      'raspberry cheesecake', 'strawberry cheesecake', 'turtle cheesecake',
    ],
    turtle: ['turtle', 'turtle dove', 'turtle cheesecake', 'caramel turtle'],
    cookie: [
      'crazy for cookie dough', 'caramel fudge cookie dough',
      'mint cookie', 'oreo cookie cheesecake', 'oreo cookies and cream',
    ],
    peanutButter: [
      'dark chocolate pb crunch', 'peanut butter cup',
      'reeses peanut butter cup',
    ],
    berry: [
      'blackberry cobbler', 'raspberry cheesecake',
      'strawberry cheesecake', 'lemon berry layer cake',
    ],
    pecan: [
      'butter pecan', 'caramel pecan', 'salted caramel pecan pie',
      'georgia peach pecan',
    ],
  };

  // ---------------------------------------------------------------------------
  // Flavor families -- with colors (from forecast-map.html, most complete)
  // ---------------------------------------------------------------------------

  var FLAVOR_FAMILIES = {
    mint: { color: '#2ECC71', members: ['andes mint avalanche', 'mint cookie', 'mint explosion'] },
    chocolate: { color: '#6F4E37', members: ['chocolate caramel twist', 'chocolate heath crunch', 'chocolate volcano', 'dark chocolate decadence', 'dark chocolate pb crunch', 'chocolate oreo volcano'] },
    caramel: { color: '#D4A056', members: ['caramel cashew', 'caramel fudge cookie dough', 'caramel pecan', 'caramel turtle', 'salted caramel pecan pie', 'chocolate caramel twist'] },
    cheesecake: { color: '#FFF8DC', members: ['oreo cheesecake', 'oreo cookie cheesecake', 'raspberry cheesecake', 'strawberry cheesecake', 'turtle cheesecake'] },
    turtle: { color: '#8B6914', members: ['turtle', 'turtle dove', 'turtle cheesecake', 'caramel turtle'] },
    cookie: { color: '#C4A882', members: ['crazy for cookie dough', 'caramel fudge cookie dough', 'mint cookie', 'oreo cookie cheesecake', 'oreo cookies and cream'] },
    peanutButter: { color: '#C8A96E', members: ['dark chocolate pb crunch', 'peanut butter cup', 'reeses peanut butter cup'] },
    berry: { color: '#E91E63', members: ['blackberry cobbler', 'raspberry cheesecake', 'strawberry cheesecake', 'lemon berry layer cake'] },
    pecan: { color: '#A67B5B', members: ['butter pecan', 'caramel pecan', 'salted caramel pecan pie', 'georgia peach pecan'] },
  };

  // ---------------------------------------------------------------------------
  // Private helpers for flavor family management
  // ---------------------------------------------------------------------------

  function syncMutableObject(target, source) {
    for (var key in target) {
      if (target.hasOwnProperty(key)) delete target[key];
    }
    for (var sourceKey in source) {
      if (source.hasOwnProperty(sourceKey)) target[sourceKey] = source[sourceKey];
    }
  }

  function normalizeGroupMembers(rawMembers) {
    if (!Array.isArray(rawMembers)) return [];
    var out = [];
    var seen = {};
    for (var i = 0; i < rawMembers.length; i++) {
      var normalized = normalize(rawMembers[i]);
      if (!normalized || seen[normalized]) continue;
      seen[normalized] = true;
      out.push(normalized);
    }
    return out;
  }

  function normalizeFamilyConfig(rawFamilies) {
    if (!rawFamilies || typeof rawFamilies !== 'object') return {};
    var result = {};
    for (var key in rawFamilies) {
      if (!rawFamilies.hasOwnProperty(key)) continue;
      var entry = rawFamilies[key];
      if (!entry || typeof entry !== 'object') continue;
      var members = normalizeGroupMembers(entry.members);
      if (members.length === 0) continue;
      result[key] = {
        color: typeof entry.color === 'string' ? entry.color : '#005696',
        members: members,
      };
    }
    return result;
  }

  function normalizeSimilarityConfig(rawGroups) {
    if (!rawGroups || typeof rawGroups !== 'object') return {};
    var result = {};
    for (var key in rawGroups) {
      if (!rawGroups.hasOwnProperty(key)) continue;
      var members = normalizeGroupMembers(rawGroups[key]);
      if (members.length === 0) continue;
      result[key] = members;
    }
    return result;
  }

  /** Simple array-only view of family members (for map.html chip filtering). */
  var FLAVOR_FAMILY_MEMBERS = {};
  var _flavorToFamilies = {};

  function rebuildFlavorFamilyIndexes() {
    syncMutableObject(FLAVOR_FAMILY_MEMBERS, {});
    syncMutableObject(_flavorToFamilies, {});

    for (var familyKey in FLAVOR_FAMILIES) {
      if (!FLAVOR_FAMILIES.hasOwnProperty(familyKey)) continue;
      var familyEntry = FLAVOR_FAMILIES[familyKey];
      var members = normalizeGroupMembers(familyEntry.members || []);
      familyEntry.members = members;
      FLAVOR_FAMILY_MEMBERS[familyKey] = members;

      for (var i = 0; i < members.length; i++) {
        var member = members[i];
        if (!_flavorToFamilies[member]) _flavorToFamilies[member] = [];
        _flavorToFamilies[member].push(familyKey);
      }
    }
  }

  function applyFlavorConfig(config) {
    if (!config || typeof config !== 'object') return;

    if (config.brand_colors && typeof config.brand_colors === 'object') {
      var nextColors = {};
      for (var colorKey in config.brand_colors) {
        if (!config.brand_colors.hasOwnProperty(colorKey)) continue;
        if (typeof config.brand_colors[colorKey] !== 'string') continue;
        nextColors[colorKey] = config.brand_colors[colorKey];
      }
      if (Object.keys(nextColors).length > 0) {
        syncMutableObject(BRAND_COLORS, nextColors);
      }
    }

    var nextGroups = normalizeSimilarityConfig(config.similarity_groups);
    if (Object.keys(nextGroups).length > 0) {
      syncMutableObject(SIMILARITY_GROUPS, nextGroups);
    }

    var nextFamilies = normalizeFamilyConfig(config.flavor_families);
    if (Object.keys(nextFamilies).length > 0) {
      syncMutableObject(FLAVOR_FAMILIES, nextFamilies);
      rebuildFlavorFamilyIndexes();
    }
  }

  function bootstrapFlavorConfig() {
    var WORKER_BASE = CP.WORKER_BASE;
    if (typeof fetch !== 'function') return;
    fetch(WORKER_BASE + '/api/v1/flavor-config')
      .then(function (resp) { return resp.ok ? resp.json() : null; })
      .then(function (data) {
        if (!data) return;
        applyFlavorConfig(data);
      })
      .catch(function () { /* fallback constants remain active */ });
  }

  // Load-time side effects
  rebuildFlavorFamilyIndexes();
  bootstrapFlavorConfig();

  // ---------------------------------------------------------------------------
  // Family lookup functions (must be after rebuildFlavorFamilyIndexes)
  // ---------------------------------------------------------------------------

  function getFamilyForFlavor(flavorName) {
    if (!flavorName) return null;
    var n = flavorName.toLowerCase()
      .replace(/[\u00ae\u2122\u00a9]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    var families = _flavorToFamilies[n];
    return families ? families[0] : null;
  }

  function getFamilyColor(flavorName) {
    var family = getFamilyForFlavor(flavorName);
    return family ? FLAVOR_FAMILIES[family].color : '#005696';
  }

  // ---------------------------------------------------------------------------
  // Similar flavors
  // ---------------------------------------------------------------------------

  /** Find similar flavors to a single target from a list of available flavors. */
  function findSimilarFlavors(target, availableFlavors) {
    var normalizedTarget = normalize(target);
    var normalizedAvailable = {};
    for (var ai = 0; ai < availableFlavors.length; ai++) {
      normalizedAvailable[normalize(availableFlavors[ai])] = true;
    }
    var similar = [];
    var seen = {};
    var groups = Object.keys(SIMILARITY_GROUPS);
    for (var gi = 0; gi < groups.length; gi++) {
      var groupMembers = SIMILARITY_GROUPS[groups[gi]];
      var inGroup = false;
      for (var mi2 = 0; mi2 < groupMembers.length; mi2++) {
        if (groupMembers[mi2] === normalizedTarget) { inGroup = true; break; }
      }
      if (inGroup) {
        for (var mi3 = 0; mi3 < groupMembers.length; mi3++) {
          var m = groupMembers[mi3];
          if (m !== normalizedTarget && normalizedAvailable[m] && !seen[m]) {
            seen[m] = true;
            similar.push(m);
          }
        }
      }
    }
    return similar;
  }

  /** Find flavors similar to a set of favorites (for Radar "you might also like"). */
  function findSimilarToFavorites(favorites) {
    var favNorms = [];
    var iter = typeof favorites.forEach === 'function' ? favorites : Array.from ? Array.from(favorites) : [];
    if (typeof favorites.forEach === 'function') {
      favorites.forEach(function (f) { favNorms.push(normalize(f)); });
    }
    var similar = {};
    for (var fi = 0; fi < favNorms.length; fi++) {
      var fav = favNorms[fi];
      var groups = Object.keys(SIMILARITY_GROUPS);
      for (var gi = 0; gi < groups.length; gi++) {
        var groupMembers = SIMILARITY_GROUPS[groups[gi]];
        var inGroup = false;
        for (var mi = 0; mi < groupMembers.length; mi++) {
          if (groupMembers[mi] === fav) { inGroup = true; break; }
        }
        if (inGroup) {
          for (var mi2 = 0; mi2 < groupMembers.length; mi2++) {
            var m = groupMembers[mi2];
            if (favNorms.indexOf(m) === -1) similar[m] = true;
          }
        }
      }
    }
    return Object.keys(similar);
  }

  // ---------------------------------------------------------------------------
  // Extend CustardPlanner
  // ---------------------------------------------------------------------------

  Object.assign(CP, {
    BRAND_COLORS: BRAND_COLORS,
    BRAND_DISPLAY: BRAND_DISPLAY,
    brandFromSlug: brandFromSlug,
    brandDisplayName: brandDisplayName,
    normalize: normalize,
    haversineMiles: haversineMiles,
    SIMILARITY_GROUPS: SIMILARITY_GROUPS,
    FLAVOR_FAMILIES: FLAVOR_FAMILIES,
    FLAVOR_FAMILY_MEMBERS: FLAVOR_FAMILY_MEMBERS,
    getFamilyForFlavor: getFamilyForFlavor,
    getFamilyColor: getFamilyColor,
    findSimilarFlavors: findSimilarFlavors,
    findSimilarToFavorites: findSimilarToFavorites,
    isSeasonalFlavor: isSeasonalFlavor,
  });
})();
