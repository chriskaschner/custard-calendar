/**
 * CustardPlanner -- Domain sub-module.
 * Certainty vocabulary, timeline building, rarity labels, reliability,
 * store persistence, drive preferences, and historical context.
 *
 * Loaded after planner-shared.js; extends window.CustardPlanner via Object.assign.
 */
(function () {
  'use strict';

  var CP = window.CustardPlanner;
  if (!CP) { console.error('planner-domain.js: CustardPlanner not found'); return; }

  // ---------------------------------------------------------------------------
  // Drive preference helpers (private)
  // ---------------------------------------------------------------------------

  function isCulversSlug(slug, storeLookup) {
    if (!slug) return false;
    if (CP.brandFromSlug(slug) !== 'culvers') return false;
    if (!storeLookup) return true;
    var store = storeLookup[slug];
    if (!store) return false;
    if (!store.brand) return true;
    return String(store.brand).toLowerCase() === 'culvers';
  }

  function sanitizeDriveStores(slugs, opts) {
    opts = opts || {};
    var list = CP._normalizeStringList(Array.isArray(slugs) ? slugs : []);
    var storeLookup = CP._buildStoreLookup(opts.stores);
    var useLookup = Object.keys(storeLookup).length > 0 ? storeLookup : null;
    var clean = [];
    for (var i = 0; i < list.length; i++) {
      var slug = list[i];
      if (!isCulversSlug(slug, useLookup)) continue;
      clean.push(slug);
      if (clean.length >= 5) break;
    }
    return clean;
  }

  function sanitizeDriveTagList(tags, allowMap) {
    if (!Array.isArray(tags)) return [];
    var out = [];
    var seen = {};
    for (var i = 0; i < tags.length; i++) {
      var value = tags[i];
      if (value == null) continue;
      var clean = String(value).trim().toLowerCase();
      if (!clean || seen[clean] || !allowMap[clean]) continue;
      seen[clean] = true;
      out.push(clean);
    }
    return out;
  }

  function parseCsvTagParam(raw, allowMap) {
    if (typeof raw !== 'string') return [];
    if (!raw.trim()) return [];
    return sanitizeDriveTagList(raw.split(','), allowMap);
  }

  function sanitizeDriveSort(raw, fallback) {
    var value = raw == null ? '' : String(raw).trim().toLowerCase();
    if (CP._DRIVE_ALLOWED_SORTS[value]) return value;
    return fallback;
  }

  function sanitizeDriveRadius(raw, fallback) {
    if (raw == null || raw === '') return fallback;
    var num = Number.parseInt(raw, 10);
    if (!Number.isFinite(num)) return fallback;
    if (num < 1) return 1;
    if (num > 100) return 100;
    return num;
  }

  // ---------------------------------------------------------------------------
  // Rarity labels
  // ---------------------------------------------------------------------------

  /**
   * Derive a rarity label from avg_gap_days (per-store cadence).
   * This keeps the badge consistent with the "Every N days" cadence text.
   * Thresholds (tightened to reduce false-positive rare badges):
   *   > 150 days  -> Ultra Rare  (appears less than ~2.5x/year)
   *   90-150 days -> Rare        (appears roughly every 3-5 months)
   *   <= 90 days  -> null        (appears frequently enough to not be notable)
   */
  function rarityLabelFromGapDays(avgGapDays) {
    var days = Math.round(Number(avgGapDays));
    if (!Number.isFinite(days) || days < 2) return null;
    if (days > 150) return 'Ultra Rare';
    if (days > 90) return 'Rare';
    return null;
  }

  /**
   * Build a display name for a store that disambiguates cities with multiple
   * Culver's locations. For unique cities, returns just the city name.
   * For cities with >1 store, prepends the street name from the slug.
   *
   * Slug format: "<city>-<state>-<street-segment>" or legacy "<city-name>"
   * Example: "madison-wi-mineral-point-rd" -> "Mineral Point Rd - Madison"
   * Example: "verona" (single store) -> "Verona"
   *
   * @param {Object} store - Store object from stores.json { slug, city, state, ... }
   * @param {Array} allStores - Full array of store objects (for uniqueness check)
   * @returns {string} Display name
   */
  function getDisplayName(store, allStores) {
    if (!store) return '';
    var city = store.city || '';
    var state = store.state || '';
    if (!city) return store.slug || '';

    // Count stores in the same city+state
    var sameCity = 0;
    if (allStores && allStores.length > 0) {
      for (var i = 0; i < allStores.length; i++) {
        var s = allStores[i];
        if (s.city === city && s.state === state) sameCity++;
      }
    }

    // Single-store city: return short city name only
    if (sameCity <= 1) return city;

    // Multiple stores in this city: extract street segment from slug
    var slug = store.slug || '';
    var street = _streetFromSlug(slug, city, state);
    if (street) return street + ' \u2014 ' + city;

    // If address is present, use first word(s) of the street address
    if (store.address) {
      var addrStreet = _streetFromAddress(store.address);
      if (addrStreet) return addrStreet + ' \u2014 ' + city;
    }

    // Fallback: city + state
    return city + ', ' + state;
  }

  /**
   * Extract a human-readable street name from a slug.
   * Slug pattern: city-state-streetpart (e.g. "madison-wi-mineral-point-rd")
   * or legacy city-only (e.g. "madison")
   */
  function _streetFromSlug(slug, city, state) {
    if (!slug) return '';
    // Build prefix from city+state to strip it
    var cityNorm = (city || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    var stateNorm = (state || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // Try to strip city-state prefix: "madison-wi-mineral-point-rd" -> "mineral-point-rd"
    var withState = cityNorm + '-' + stateNorm + '-';
    var withoutState = cityNorm + '-';

    var remainder = '';
    if (slug.indexOf(withState) === 0) {
      remainder = slug.slice(withState.length);
    } else if (slug.indexOf(withoutState) === 0) {
      var after = slug.slice(withoutState.length);
      // Check if 'after' starts with state abbreviation
      if (stateNorm && after.indexOf(stateNorm + '-') === 0) {
        remainder = after.slice(stateNorm.length + 1);
      } else if (after && after !== stateNorm) {
        remainder = after;
      }
    }

    if (!remainder) return '';
    // Title-case the street segment (replace hyphens with spaces)
    return remainder.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  /**
   * Extract a short street descriptor from a full address string.
   * E.g. "7206 Mineral Point Road" -> "Mineral Point Rd"
   */
  function _streetFromAddress(address) {
    if (!address) return '';
    // Strip leading house number
    var clean = address.trim().replace(/^\d+\s+/, '');
    // Abbreviate common suffixes to save space
    clean = clean.replace(/\bRoad\b/gi, 'Rd').replace(/\bStreet\b/gi, 'St').replace(/\bAvenue\b/gi, 'Ave')
      .replace(/\bBoulevard\b/gi, 'Blvd').replace(/\bDrive\b/gi, 'Dr').replace(/\bHighway\b/gi, 'Hwy')
      .replace(/\bLane\b/gi, 'Ln').replace(/\bCourt\b/gi, 'Ct').replace(/\bParkway\b/gi, 'Pkwy');
    // Limit to first ~25 chars to avoid overly long labels
    if (clean.length > 28) {
      // Try to cut at a word boundary
      var truncated = clean.slice(0, 25);
      var lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > 8) truncated = truncated.slice(0, lastSpace);
      return truncated;
    }
    return clean;
  }

  // Keep percentile helpers for trivia/leaderboard usage (not rarity badges)
  function rarityLabelFromPercentile(percentile) {
    var p = Number(percentile);
    if (!Number.isFinite(p)) return null;
    if (p <= 10) return 'Ultra Rare';
    if (p <= 25) return 'Rare';
    if (p <= 50) return 'Uncommon';
    if (p <= 75) return 'Common';
    return 'Staple';
  }

  function rarityLabelFromRank(rank, totalRankedFlavors) {
    var r = Number(rank);
    var total = Number(totalRankedFlavors);
    if (!Number.isFinite(r) || !Number.isFinite(total) || r < 1 || total < 2) return null;
    var percentile = ((r - 1) / (total - 1)) * 100;
    return rarityLabelFromPercentile(percentile);
  }

  function formatCadenceText(avgGapDays, opts) {
    var days = Math.round(Number(avgGapDays));
    if (!Number.isFinite(days) || days < 2 || days > 365) return '';
    var scope = opts && typeof opts.scope === 'string' ? opts.scope : '';
    var suffix = '';
    if (scope === 'store') suffix = ' at this store';
    if (scope === 'primary') suffix = ' at your store';
    return 'Shows up roughly every ' + days + ' days' + suffix;
  }

  // ---------------------------------------------------------------------------
  // Store persistence
  // ---------------------------------------------------------------------------

  function getPrimaryStoreSlug() {
    try {
      if (typeof localStorage === 'undefined') return null;
      var slug = localStorage.getItem(CP._PRIMARY_STORE_KEY);
      return slug && String(slug).trim() ? String(slug).trim() : null;
    } catch (_) {
      return null;
    }
  }

  function setPrimaryStoreSlug(slug) {
    try {
      if (typeof localStorage === 'undefined') return false;
      var clean = slug && String(slug).trim();
      if (!clean) {
        localStorage.removeItem(CP._PRIMARY_STORE_KEY);
      } else {
        localStorage.setItem(CP._PRIMARY_STORE_KEY, clean);
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  function getSavedStore() {
    return getPrimaryStoreSlug();
  }

  function setSavedStore(slug) {
    return setPrimaryStoreSlug(slug);
  }

  function getFavorites() {
    try {
      if (typeof localStorage === 'undefined') return [];
      var raw = localStorage.getItem(CP._FAVORITES_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(function (f) { return f && typeof f === 'string'; });
    } catch (_) {
      return [];
    }
  }

  function addFavorite(title) {
    if (!title || typeof title !== 'string') return false;
    try {
      if (typeof localStorage === 'undefined') return false;
      var clean = title.trim();
      if (!clean) return false;
      var favs = getFavorites();
      if (favs.indexOf(clean) !== -1) return false;
      if (favs.length >= CP._MAX_FAVORITES) return false;
      favs.push(clean);
      localStorage.setItem(CP._FAVORITES_KEY, JSON.stringify(favs));
      return true;
    } catch (_) {
      return false;
    }
  }

  function removeFavorite(title) {
    if (!title) return false;
    try {
      if (typeof localStorage === 'undefined') return false;
      var favs = getFavorites().filter(function (f) { return f !== title; });
      localStorage.setItem(CP._FAVORITES_KEY, JSON.stringify(favs));
      return true;
    } catch (_) {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Drive preferences
  // ---------------------------------------------------------------------------

  function pickDefaultDriveStores(opts) {
    opts = opts || {};
    var fromLegacy = [];
    var primary = getPrimaryStoreSlug();
    if (primary) fromLegacy.push(primary);
    var secondary = CP._parseLegacySecondaryStores();
    for (var i = 0; i < secondary.length; i++) fromLegacy.push(secondary[i]);
    var legacyClean = sanitizeDriveStores(fromLegacy, opts);
    if (legacyClean.length >= 2) return legacyClean.slice(0, 5);

    var storeLookup = CP._buildStoreLookup(opts.stores);
    var culvers = [];
    var lookupKeys = Object.keys(storeLookup);
    for (var ki = 0; ki < lookupKeys.length; ki++) {
      var slug = lookupKeys[ki];
      if (isCulversSlug(slug, storeLookup)) culvers.push(slug);
    }
    // Sort by proximity to geoIP location
    if (opts.location && Number.isFinite(opts.location.lat) && Number.isFinite(opts.location.lon)) {
      var gLat = opts.location.lat;
      var gLon = opts.location.lon;
      culvers.sort(function (a, b) {
        var sa = storeLookup[a];
        var sb = storeLookup[b];
        var da = (sa && sa.lat != null && sa.lng != null) ? CP.haversineMiles(gLat, gLon, sa.lat, sa.lng) : Infinity;
        var db = (sb && sb.lat != null && sb.lng != null) ? CP.haversineMiles(gLat, gLon, sb.lat, sb.lng) : Infinity;
        return da - db;
      });
    }
    culvers = culvers.slice(0, 5);
    if (legacyClean.length === 1) {
      for (var ci = 0; ci < culvers.length; ci++) {
        if (culvers[ci] !== legacyClean[0]) {
          return [legacyClean[0], culvers[ci]];
        }
      }
    }
    if (culvers.length >= 2) return culvers.slice(0, 2);
    return legacyClean.slice(0, 5);
  }

  function makeDefaultDrivePreferences(opts) {
    var defaultStores = pickDefaultDriveStores(opts);
    return {
      version: CP._DRIVE_PREF_VERSION,
      favoriteStores: defaultStores.slice(0, 5),
      activeRoute: {
        id: 'default',
        name: "Today's Drive",
        stores: defaultStores,
      },
      filters: {
        excludeTags: [],
        includeOnlyTags: [],
        avoidIngredients: [],
      },
      preferences: {
        boostTags: [],
        avoidTags: [],
      },
      ui: {
        homeView: 'today_drive',
        sortMode: 'match',
        radiusMiles: 25,
      },
      updatedAt: new Date().toISOString(),
    };
  }

  function sanitizeDrivePreferences(raw, opts) {
    var defaults = makeDefaultDrivePreferences(opts);
    var value = raw && typeof raw === 'object' ? raw : {};
    var favoriteStores = sanitizeDriveStores(value.favoriteStores, opts);
    var routeStores = sanitizeDriveStores(value.activeRoute && value.activeRoute.stores, opts);

    if (routeStores.length < 2) routeStores = defaults.activeRoute.stores.slice();
    if (routeStores.length > 5) routeStores = routeStores.slice(0, 5);

    if (favoriteStores.length === 0) favoriteStores = routeStores.slice(0, 5);
    if (favoriteStores.length > 5) favoriteStores = favoriteStores.slice(0, 5);

    var sortMode = sanitizeDriveSort(value.ui && value.ui.sortMode, 'match') || 'match';
    var radius = sanitizeDriveRadius(value.ui && value.ui.radiusMiles, 25);
    if (!Number.isFinite(radius)) radius = 25;

    return {
      version: CP._DRIVE_PREF_VERSION,
      favoriteStores: favoriteStores,
      activeRoute: {
        id: 'default',
        name: "Today's Drive",
        stores: routeStores,
      },
      filters: {
        excludeTags: sanitizeDriveTagList(value.filters && value.filters.excludeTags, CP._DRIVE_ALLOWED_EXCLUDES),
        includeOnlyTags: [],
        avoidIngredients: [],
      },
      preferences: {
        boostTags: sanitizeDriveTagList(value.preferences && value.preferences.boostTags, CP._DRIVE_ALLOWED_TAGS),
        avoidTags: sanitizeDriveTagList(value.preferences && value.preferences.avoidTags, CP._DRIVE_ALLOWED_TAGS),
      },
      ui: {
        homeView: 'today_drive',
        sortMode: sortMode,
        radiusMiles: radius,
      },
      updatedAt: value.updatedAt && String(value.updatedAt).trim() ? String(value.updatedAt) : new Date().toISOString(),
    };
  }

  function parseDriveUrlState(search, opts) {
    var rawSearch = typeof search === 'string'
      ? search
      : (typeof window !== 'undefined' && window.location ? window.location.search : '');
    var params = new URLSearchParams(rawSearch || '');
    var state = {};

    if (params.has('stores')) {
      var stores = sanitizeDriveStores(String(params.get('stores') || '').split(','), opts);
      if (stores.length >= 2) state.stores = stores;
    }

    if (params.has('exclude')) {
      state.excludeTags = parseCsvTagParam(params.get('exclude') || '', CP._DRIVE_ALLOWED_EXCLUDES);
    }
    if (params.has('boost')) {
      state.boostTags = parseCsvTagParam(params.get('boost') || '', CP._DRIVE_ALLOWED_TAGS);
    }
    if (params.has('avoid')) {
      state.avoidTags = parseCsvTagParam(params.get('avoid') || '', CP._DRIVE_ALLOWED_TAGS);
    }
    if (params.has('sort')) {
      state.sortMode = sanitizeDriveSort(params.get('sort'), 'match') || 'match';
    }
    if (params.has('radius')) {
      var radius = sanitizeDriveRadius(params.get('radius'), 25);
      state.radiusMiles = Number.isFinite(radius) ? radius : 25;
    }

    return state;
  }

  function applyDriveUrlState(prefs, state, opts) {
    var merged = sanitizeDrivePreferences(prefs, opts);
    if (!state || typeof state !== 'object') return merged;
    if (Array.isArray(state.stores) && state.stores.length >= 2) {
      merged.activeRoute.stores = sanitizeDriveStores(state.stores, opts);
      if (merged.activeRoute.stores.length < 2) merged.activeRoute.stores = makeDefaultDrivePreferences(opts).activeRoute.stores.slice();
      merged.favoriteStores = merged.activeRoute.stores.slice(0, 5);
    }
    if (Array.isArray(state.excludeTags)) merged.filters.excludeTags = sanitizeDriveTagList(state.excludeTags, CP._DRIVE_ALLOWED_EXCLUDES);
    if (Array.isArray(state.boostTags)) merged.preferences.boostTags = sanitizeDriveTagList(state.boostTags, CP._DRIVE_ALLOWED_TAGS);
    if (Array.isArray(state.avoidTags)) merged.preferences.avoidTags = sanitizeDriveTagList(state.avoidTags, CP._DRIVE_ALLOWED_TAGS);
    if (state.sortMode != null) merged.ui.sortMode = sanitizeDriveSort(state.sortMode, 'match') || 'match';
    if (state.radiusMiles != null) {
      var radius = sanitizeDriveRadius(state.radiusMiles, 25);
      merged.ui.radiusMiles = Number.isFinite(radius) ? radius : 25;
    }
    merged.updatedAt = new Date().toISOString();
    return merged;
  }

  function getDrivePreferences(opts) {
    opts = opts || {};
    var defaults = makeDefaultDrivePreferences(opts);
    var parsed = defaults;

    try {
      if (typeof localStorage !== 'undefined') {
        var raw = localStorage.getItem(CP._DRIVE_PREFERENCES_KEY);
        if (raw) {
          parsed = sanitizeDrivePreferences(JSON.parse(raw), opts);
        }
      }
    } catch (_) {
      parsed = defaults;
    }

    // Legacy migration fallback for first-time drive users.
    if (!parsed.activeRoute || !Array.isArray(parsed.activeRoute.stores) || parsed.activeRoute.stores.length < 2) {
      parsed = defaults;
    }

    var urlState = parseDriveUrlState(opts.search, opts);
    parsed = applyDriveUrlState(parsed, urlState, opts);
    return sanitizeDrivePreferences(parsed, opts);
  }

  var DRIVE_DEBOUNCE_MS = 300;
  var _debounceSaveTimer = null;
  var _lastSavedPrefs = null;

  function _writeDrivePrefsToStorage(clean) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(CP._DRIVE_PREFERENCES_KEY, JSON.stringify(clean));
        if (clean.activeRoute && Array.isArray(clean.activeRoute.stores) && clean.activeRoute.stores.length > 0) {
          setPrimaryStoreSlug(clean.activeRoute.stores[0]);
          localStorage.setItem(CP._SECONDARY_STORES_KEY, JSON.stringify(clean.activeRoute.stores.slice(1, 5)));
        }
      }
    } catch (_) { /* storage full or unavailable */ }
  }

  function saveDrivePreferences(prefs, opts) {
    var clean = sanitizeDrivePreferences(prefs, opts);
    clean.updatedAt = new Date().toISOString();
    _lastSavedPrefs = clean;
    if (typeof clearTimeout === 'function' && _debounceSaveTimer) {
      clearTimeout(_debounceSaveTimer);
    }
    if (typeof setTimeout === 'function') {
      _debounceSaveTimer = setTimeout(function () {
        _debounceSaveTimer = null;
        if (_lastSavedPrefs) _writeDrivePrefsToStorage(_lastSavedPrefs);
      }, DRIVE_DEBOUNCE_MS);
    } else {
      _writeDrivePrefsToStorage(clean);
    }
    return clean;
  }

  function flushDrivePreferences() {
    if (_debounceSaveTimer) {
      if (typeof clearTimeout === 'function') clearTimeout(_debounceSaveTimer);
      _debounceSaveTimer = null;
    }
    if (_lastSavedPrefs) {
      _writeDrivePrefsToStorage(_lastSavedPrefs);
      _lastSavedPrefs = null;
    }
  }

  function resetDrivePreferences(opts) {
    if (typeof clearTimeout === 'function' && _debounceSaveTimer) {
      clearTimeout(_debounceSaveTimer);
      _debounceSaveTimer = null;
    }
    _lastSavedPrefs = null;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(CP._DRIVE_PREFERENCES_KEY);
        localStorage.removeItem(CP._PRIMARY_STORE_KEY);
        localStorage.removeItem(CP._SECONDARY_STORES_KEY);
      }
    } catch (_) { /* storage unavailable */ }
    return makeDefaultDrivePreferences(opts);
  }

  function buildDriveUrlState(prefs, opts) {
    var clean = sanitizeDrivePreferences(prefs, opts);
    var params = new URLSearchParams();
    if (clean.activeRoute && Array.isArray(clean.activeRoute.stores) && clean.activeRoute.stores.length > 0) {
      params.set('stores', clean.activeRoute.stores.join(','));
    }
    params.set('sort', clean.ui.sortMode || 'match');
    params.set('radius', String(clean.ui.radiusMiles || 25));
    if (clean.filters.excludeTags.length > 0) params.set('exclude', clean.filters.excludeTags.join(','));
    if (clean.preferences.boostTags.length > 0) params.set('boost', clean.preferences.boostTags.join(','));
    if (clean.preferences.avoidTags.length > 0) params.set('avoid', clean.preferences.avoidTags.join(','));
    return params.toString();
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

  // Thresholds must match worker/src/certainty.js
  var MIN_PROBABILITY = 0.02;
  var MIN_HISTORY_DEPTH = 14;
  var MAX_FORECAST_AGE_HOURS = 168;

  /** Determine certainty tier from available data signals. */
  function certaintyTier(opts) {
    var type = opts.type || 'none';
    var reliability = opts.reliability; // 'confirmed', 'watch', 'unreliable' or undefined
    var probability = opts.probability || 0;
    var historyDepth = opts.historyDepth || 0;
    var forecastAgeHours = opts.forecastAgeHours;

    if (type === 'confirmed') {
      if (reliability === 'watch' || reliability === 'unreliable') {
        return CERTAINTY.WATCH;
      }
      return CERTAINTY.CONFIRMED;
    }

    if (type === 'predicted') {
      var stale = typeof forecastAgeHours === 'number' && forecastAgeHours > MAX_FORECAST_AGE_HOURS;
      if (!stale && probability >= MIN_PROBABILITY && historyDepth >= MIN_HISTORY_DEPTH) {
        return CERTAINTY.ESTIMATED;
      }
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
    if (tier === CERTAINTY.CONFIRMED) return 'card card--accent day-card day-card-confirmed';
    if (tier === CERTAINTY.WATCH) return 'card card--accent day-card day-card-watch';
    if (tier === CERTAINTY.ESTIMATED) return 'card card--accent day-card day-card-estimated';
    return 'card card--accent day-card day-card-none';
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
  // Historical context (metrics-pack backed snippets)
  // ---------------------------------------------------------------------------

  var _flavorContextCache = {};
  var _storeContextCache = {};

  function formatInt(value) {
    var n = Number(value || 0);
    if (!Number.isFinite(n)) return '0';
    return n.toLocaleString('en-US');
  }

  /**
   * cleanTelemetrySlug -- duplicated from UI module for use in
   * fetchStoreHistoricalContext (avoids cross-module load-time dependency).
   */
  function cleanTelemetrySlug(value) {
    if (typeof value !== 'string') return null;
    var trimmed = value.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{0,80}$/.test(trimmed)) return null;
    return trimmed;
  }

  function fetchFlavorHistoricalContext(workerBase, flavorName) {
    var key = CP.normalize(flavorName);
    if (!key) return Promise.resolve(null);
    var cacheKey = workerBase + '::flavor::' + key;
    if (_flavorContextCache[cacheKey]) return _flavorContextCache[cacheKey];

    var p = fetch(workerBase + '/api/v1/metrics/context/flavor/' + encodeURIComponent(key))
      .then(function (resp) { return resp.ok ? resp.json() : null; })
      .catch(function () { return null; });
    _flavorContextCache[cacheKey] = p;
    return p;
  }

  function fetchStoreHistoricalContext(workerBase, slug) {
    var key = cleanTelemetrySlug(slug);
    if (!key) return Promise.resolve(null);
    var cacheKey = workerBase + '::store::' + key;
    if (_storeContextCache[cacheKey]) return _storeContextCache[cacheKey];

    var p = fetch(workerBase + '/api/v1/metrics/context/store/' + encodeURIComponent(key))
      .then(function (resp) { return resp.ok ? resp.json() : null; })
      .catch(function () { return null; });
    _storeContextCache[cacheKey] = p;
    return p;
  }

  function historicalContextHTML(opts) {
    opts = opts || {};
    var flavorContext = opts.flavorContext;
    var storeContext = opts.storeContext;
    var flavor = flavorContext && flavorContext.found && flavorContext.flavor ? flavorContext.flavor : null;
    var store = storeContext && storeContext.found && storeContext.store ? storeContext.store : null;

    var lines = [];
    if (flavor) {
      var rank = Number(flavorContext.rank || 0);
      var rankedTotal = Number(flavorContext.total_ranked_flavors || 0);
      var rankLine = 'Frequency rank';
      if (rank > 0 && rankedTotal > 0) {
        rankLine += ': #' + rank + ' of ' + rankedTotal;
      }
      rankLine += ' (' + formatInt(flavor.appearances) + ' appearances across ' + formatInt(flavor.store_count) + ' stores).';
      lines.push(rankLine);

      var peakMonth = Number(flavor.peak_month || 0);
      var peakMonthName = flavor.peak_month_name || '';
      if (!peakMonthName && peakMonth >= 1 && peakMonth <= 12) {
        peakMonthName = ['January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'][peakMonth - 1];
      }
      if (peakMonthName) {
        var nowMonth = new Date().getUTCMonth() + 1;
        var seasonLine = 'Seasonality: peaks in ' + peakMonthName + '.';
        seasonLine += nowMonth === peakMonth ? ' In-season now.' : ' Off-season now.';
        lines.push(seasonLine);
      }
    }

    if (store && store.top_flavor) {
      var specialty = 'Store specialty: ' + store.top_flavor + ' leads this store history';
      specialty += ' (' + formatInt(store.top_flavor_count) + ' of ' + formatInt(store.observations) + ' observations).';
      lines.push(specialty);
    }

    if (lines.length === 0) return '';

    var sourceWindow = (flavorContext && flavorContext.source_window) || (storeContext && storeContext.source_window) || null;
    var sourceLabel = '';
    if (sourceWindow && sourceWindow.start && sourceWindow.end) {
      sourceLabel = 'Historical window: ' + sourceWindow.start + ' to ' + sourceWindow.end + '.';
    }

    var headingFlavor = opts.flavorLabel || (flavor && flavor.title) || '';
    var heading = headingFlavor
      ? 'Historical context for ' + headingFlavor
      : 'Historical context';

    var listHtml = '';
    for (var i = 0; i < lines.length; i++) {
      listHtml += '<li>' + CP.escapeHtml(lines[i]) + '</li>';
    }

    return '<div class="card historical-context-card">'
      + '<div class="historical-context-head">' + CP.escapeHtml(heading) + '</div>'
      + '<ul class="historical-context-list">' + listHtml + '</ul>'
      + (sourceLabel ? '<div class="historical-context-source">' + CP.escapeHtml(sourceLabel) + '</div>' : '')
      + '</div>';
  }

  // ---------------------------------------------------------------------------
  // Flush debounced preferences on page unload
  // ---------------------------------------------------------------------------
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('beforeunload', flushDrivePreferences);
  }

  // ---------------------------------------------------------------------------
  // Extend CustardPlanner
  // ---------------------------------------------------------------------------

  Object.assign(CP, {
    // Certainty
    CERTAINTY: CERTAINTY,
    CERTAINTY_LABELS: CERTAINTY_LABELS,
    certaintyTier: certaintyTier,
    certaintyBadgeHTML: certaintyBadgeHTML,
    certaintyCardClass: certaintyCardClass,
    confidenceStripClass: confidenceStripClass,

    // Timeline
    buildTimeline: buildTimeline,

    // Rarity
    rarityLabelFromGapDays: rarityLabelFromGapDays,
    rarityLabelFromPercentile: rarityLabelFromPercentile,
    rarityLabelFromRank: rarityLabelFromRank,
    formatCadenceText: formatCadenceText,

    // Store disambiguation
    getDisplayName: getDisplayName,

    // Reliability
    fetchReliability: fetchReliability,
    watchBannerHTML: watchBannerHTML,

    // Historical context
    fetchFlavorHistoricalContext: fetchFlavorHistoricalContext,
    fetchStoreHistoricalContext: fetchStoreHistoricalContext,
    historicalContextHTML: historicalContextHTML,

    // Store persistence
    getPrimaryStoreSlug: getPrimaryStoreSlug,
    setPrimaryStoreSlug: setPrimaryStoreSlug,
    getSavedStore: getSavedStore,
    setSavedStore: setSavedStore,
    getFavorites: getFavorites,
    addFavorite: addFavorite,
    removeFavorite: removeFavorite,

    // Drive preferences
    getDrivePreferences: getDrivePreferences,
    saveDrivePreferences: saveDrivePreferences,
    flushDrivePreferences: flushDrivePreferences,
    resetDrivePreferences: resetDrivePreferences,
    pickDefaultDriveStores: pickDefaultDriveStores,
    parseDriveUrlState: parseDriveUrlState,
    buildDriveUrlState: buildDriveUrlState,
    DRIVE_PREFERENCES_KEY: CP._DRIVE_PREFERENCES_KEY,
    DRIVE_DEBOUNCE_MS: DRIVE_DEBOUNCE_MS,
  });
})();
