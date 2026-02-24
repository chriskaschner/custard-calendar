/**
 * CustardPlanner -- shared utilities for all custard calendar surfaces.
 * Single source of truth for scoring helpers, brand constants, similarity
 * groups, flavor families, certainty vocabulary, and timeline building.
 *
 * Usage: <script src="planner-shared.js"></script>
 * Exposes: window.CustardPlanner (var, no build step required)
 */
var CustardPlanner = (function () {
  'use strict';

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
      'brownie thunder', 'chocolate volcano', 'chocolate oreo volcano',
    ],
    caramel: [
      'caramel cashew', 'caramel fudge cookie dough', 'caramel pecan',
      'caramel turtle', 'salted caramel pecan pie',
      'salted double caramel pecan', 'caramel peanut buttercup',
      'caramel chocolate pecan',
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
      'really reeses', 'caramel peanut buttercup',
    ],
    berry: [
      'blackberry cobbler', 'raspberry cheesecake',
      'double strawberry', 'chocolate covered strawberry',
      'strawberry cheesecake', 'georgia peach',
      'lemon berry layer cake',
    ],
    pecan: [
      'butter pecan', 'caramel pecan', 'salted caramel pecan pie',
      'georgia peach pecan', 'caramel chocolate pecan',
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
    berry: { color: '#E91E63', members: ['blackberry cobbler', 'raspberry cheesecake', 'strawberry cheesecake', 'lemon berry layer cake', 'double strawberry', 'chocolate covered strawberry', 'georgia peach'] },
    pecan: { color: '#A67B5B', members: ['butter pecan', 'caramel pecan', 'salted caramel pecan pie', 'georgia peach pecan'] },
  };

  /** Simple array-only view of family members (for map.html chip filtering). */
  var FLAVOR_FAMILY_MEMBERS = {};
  for (var fam in FLAVOR_FAMILIES) {
    if (FLAVOR_FAMILIES.hasOwnProperty(fam)) {
      FLAVOR_FAMILY_MEMBERS[fam] = FLAVOR_FAMILIES[fam].members;
    }
  }

  /** Reverse lookup: normalized flavor -> array of family keys. */
  var _flavorToFamilies = {};
  for (var famKey in FLAVOR_FAMILIES) {
    if (FLAVOR_FAMILIES.hasOwnProperty(famKey)) {
      var members = FLAVOR_FAMILIES[famKey].members;
      for (var mi = 0; mi < members.length; mi++) {
        var member = members[mi];
        if (!_flavorToFamilies[member]) _flavorToFamilies[member] = [];
        _flavorToFamilies[member].push(famKey);
      }
    }
  }

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
  // Certainty tiers
  // ---------------------------------------------------------------------------

  /** Three-tier certainty vocabulary used across all surfaces.
   *  - confirmed: schedule data from the store, good reliability
   *  - watch:     schedule data present but store has reliability issues
   *  - estimated: probabilistic fill when no schedule data
   *  - none:      no data available
   */
  var CERTAINTY = {
    CONFIRMED: 'confirmed',
    WATCH: 'watch',
    ESTIMATED: 'estimated',
    NONE: 'none',
  };

  /** Determine certainty tier from available data signals. */
  function certaintyTier(opts) {
    var type = opts.type || 'none';
    var reliability = opts.reliability; // 'confirmed', 'watch', 'unreliable' or undefined
    var probability = opts.probability || 0;
    var historyDepth = opts.historyDepth || 0;

    if (type === 'confirmed') {
      if (reliability === 'watch' || reliability === 'unreliable') {
        return CERTAINTY.WATCH;
      }
      return CERTAINTY.CONFIRMED;
    }

    if (type === 'predicted' && probability > 0.04 && historyDepth >= 30) {
      return CERTAINTY.ESTIMATED;
    }

    if (type === 'predicted') {
      return CERTAINTY.ESTIMATED;
    }

    return CERTAINTY.NONE;
  }

  /** Labels for each certainty tier. */
  var CERTAINTY_LABELS = {
    confirmed: 'Confirmed',
    watch: 'Watch',
    estimated: 'Estimated',
    none: '',
  };

  /** Return badge HTML for a certainty tier string. */
  function certaintyBadgeHTML(tier) {
    var label = CERTAINTY_LABELS[tier] || '';
    if (!label) return '';
    return '<span class="day-card-badge day-card-badge-' + tier + '">' + label + '</span>';
  }

  /** Return the day-card CSS class for a certainty tier. */
  function certaintyCardClass(tier) {
    if (tier === CERTAINTY.CONFIRMED) return 'day-card day-card-confirmed';
    if (tier === CERTAINTY.WATCH) return 'day-card day-card-watch';
    if (tier === CERTAINTY.ESTIMATED) return 'day-card day-card-estimated';
    return 'day-card day-card-none';
  }

  // ---------------------------------------------------------------------------
  // Certainty strip (visual indicator for recommendation certainty)
  // ---------------------------------------------------------------------------

  /** Returns the CSS class string for a timeline day's certainty strip. */
  function confidenceStripClass(day) {
    var tier = certaintyTier({ type: day.type || 'none' });
    return 'confidence-strip confidence-strip-' + tier;
  }

  // ---------------------------------------------------------------------------
  // Timeline builder
  // ---------------------------------------------------------------------------

  function _findForecastDay(forecast, dateStr) {
    if (!forecast) return null;
    if (forecast.days) {
      for (var i = 0; i < forecast.days.length; i++) {
        if (forecast.days[i].date === dateStr) return forecast.days[i];
      }
      return null;
    }
    if (forecast.date === dateStr) return forecast;
    return null;
  }

  function _toISODate(d) {
    return d.toISOString().slice(0, 10);
  }

  function _addDays(d, n) {
    var r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }

  /** Build a 7-day timeline merging confirmed flavors with forecast predictions.
   *  @param {Array} confirmedFlavors - [{date, title, description}]
   *  @param {Object|null} forecast - forecast response with .days[]
   *  @param {Date} today - reference date (noon-adjusted)
   *  @param {Object} [opts] - { maxPredictions: 5 }
   *  @returns {Array} timeline entries
   */
  function buildTimeline(confirmedFlavors, forecast, today, opts) {
    var maxPredictions = (opts && opts.maxPredictions) || 5;
    var timeline = [];
    for (var i = 0; i < 7; i++) {
      var date = _addDays(today, i);
      var dateStr = _toISODate(date);

      var confirmed = null;
      for (var ci = 0; ci < confirmedFlavors.length; ci++) {
        if (confirmedFlavors[ci].date === dateStr) {
          confirmed = confirmedFlavors[ci];
          break;
        }
      }

      if (confirmed) {
        timeline.push({
          date: dateStr,
          type: 'confirmed',
          flavor: confirmed.title,
          description: confirmed.description || '',
        });
        continue;
      }

      var forecastDay = _findForecastDay(forecast, dateStr);
      if (forecastDay && forecastDay.predictions && forecastDay.predictions.length > 0) {
        timeline.push({
          date: dateStr,
          type: 'predicted',
          flavor: forecastDay.predictions[0].flavor,
          probability: forecastDay.predictions[0].probability,
          predictions: forecastDay.predictions.slice(0, maxPredictions),
          overdue: forecastDay.overdue_flavors || [],
        });
        continue;
      }

      timeline.push({ date: dateStr, type: 'none' });
    }
    return timeline;
  }

  // ---------------------------------------------------------------------------
  // Action CTA helpers
  // ---------------------------------------------------------------------------

  function directionsUrl(lat, lon, name) {
    var q = lat + ',' + lon;
    if (name) q = encodeURIComponent(name) + '/@' + lat + ',' + lon;
    return 'https://www.google.com/maps/dir/?api=1&destination=' + q;
  }

  function calendarIcsUrl(workerBase, slug) {
    return workerBase + '/v1/calendar.ics?primary=' + encodeURIComponent(slug);
  }

  function alertPageUrl(slug) {
    return 'calendar.html?store=' + encodeURIComponent(slug);
  }

  /**
   * Render a consistent set of action CTAs for a recommendation.
   * @param {Object} opts
   * @param {string} opts.slug - Store slug
   * @param {string} opts.storeName - Display name
   * @param {number} [opts.lat]
   * @param {number} [opts.lon]
   * @param {string} opts.workerBase - Worker URL base
   * @param {string[]} [opts.actions] - Which CTAs to show (default: all)
   * @returns {string} HTML string
   */
  function actionCTAsHTML(opts) {
    var actions = opts.actions || ['directions', 'alert', 'calendar'];
    var parts = [];

    for (var i = 0; i < actions.length; i++) {
      var action = actions[i];
      if (action === 'directions' && opts.lat && opts.lon) {
        parts.push(
          '<a href="' + directionsUrl(opts.lat, opts.lon, opts.storeName) + '" class="cta-link cta-directions" target="_blank" rel="noopener">Directions</a>'
        );
      } else if (action === 'alert') {
        parts.push(
          '<a href="' + alertPageUrl(opts.slug) + '" class="cta-link cta-alert">Set Alert</a>'
        );
      } else if (action === 'calendar') {
        parts.push(
          '<a href="' + calendarIcsUrl(opts.workerBase, opts.slug) + '" class="cta-link cta-calendar">Subscribe</a>'
        );
      }
    }

    if (parts.length === 0) return '';
    return '<div class="cta-row">' + parts.join(' ') + '</div>';
  }

  // ---------------------------------------------------------------------------
  // Reliability fetch
  // ---------------------------------------------------------------------------

  /**
   * Fetch reliability data for a store. Returns null if unavailable.
   * @param {string} workerBase - e.g. 'https://custard-calendar...'
   * @param {string} slug
   * @returns {Promise<Object|null>} { reliability_tier, reason, ... }
   */
  function fetchReliability(workerBase, slug) {
    return fetch(workerBase + '/api/v1/reliability/' + encodeURIComponent(slug))
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  /**
   * Render a Watch reason banner if reliability is watch/unreliable.
   * Returns HTML string (empty if not applicable).
   */
  function watchBannerHTML(reliability) {
    if (!reliability) return '';
    var tier = reliability.reliability_tier;
    if (tier !== 'watch' && tier !== 'unreliable') return '';
    var reason = reliability.reason || 'This store has had inconsistent schedule updates recently.';
    return '<div class="watch-banner">'
      + '<span class="watch-banner-icon">!</span> '
      + '<strong>Watch</strong> -- ' + reason
      + '</div>';
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  return {
    // Brand
    BRAND_COLORS: BRAND_COLORS,
    BRAND_DISPLAY: BRAND_DISPLAY,
    brandFromSlug: brandFromSlug,
    brandDisplayName: brandDisplayName,

    // Normalize
    normalize: normalize,

    // Distance
    haversineMiles: haversineMiles,

    // Similarity / families
    SIMILARITY_GROUPS: SIMILARITY_GROUPS,
    FLAVOR_FAMILIES: FLAVOR_FAMILIES,
    FLAVOR_FAMILY_MEMBERS: FLAVOR_FAMILY_MEMBERS,
    getFamilyForFlavor: getFamilyForFlavor,
    getFamilyColor: getFamilyColor,
    findSimilarFlavors: findSimilarFlavors,
    findSimilarToFavorites: findSimilarToFavorites,

    // Certainty
    CERTAINTY: CERTAINTY,
    CERTAINTY_LABELS: CERTAINTY_LABELS,
    certaintyTier: certaintyTier,
    certaintyBadgeHTML: certaintyBadgeHTML,
    certaintyCardClass: certaintyCardClass,
    confidenceStripClass: confidenceStripClass,

    // Timeline
    buildTimeline: buildTimeline,

    // Reliability
    fetchReliability: fetchReliability,
    watchBannerHTML: watchBannerHTML,

    // Action CTAs
    directionsUrl: directionsUrl,
    calendarIcsUrl: calendarIcsUrl,
    alertPageUrl: alertPageUrl,
    actionCTAsHTML: actionCTAsHTML,
  };
})();
