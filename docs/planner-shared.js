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
  // Worker base URL (canonical origin for all API calls)
  // ---------------------------------------------------------------------------

  var WORKER_BASE = 'https://custard.chriskaschner.com';
  var PRIMARY_STORE_KEY = 'custard-primary';
  var SECONDARY_STORES_KEY = 'custard-secondary';
  var FAVORITES_KEY = 'custard-favorites';
  var MAX_FAVORITES = 10;
  var DRIVE_PREFERENCES_KEY = 'custard:v1:preferences';
  var DRIVE_PREF_VERSION = 1;

  var DRIVE_ALLOWED_EXCLUDES = { nuts: true, cheesecake: true };
  var DRIVE_ALLOWED_TAGS = {
    chocolate: true,
    fruit: true,
    caramel: true,
    mint: true,
    coffee: true,
    seasonal: true,
    kids: true,
  };
  var DRIVE_ALLOWED_SORTS = { match: true, detour: true, rarity: true, eta: true };

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function normalizeStringList(list) {
    if (!Array.isArray(list)) return [];
    var out = [];
    var seen = {};
    for (var i = 0; i < list.length; i++) {
      var value = list[i];
      if (value == null) continue;
      var clean = String(value).trim();
      if (!clean) continue;
      if (seen[clean]) continue;
      seen[clean] = true;
      out.push(clean);
    }
    return out;
  }

  function parseLegacySecondaryStores() {
    try {
      if (typeof localStorage === 'undefined') return [];
      var raw = localStorage.getItem(SECONDARY_STORES_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return normalizeStringList(parsed);
      if (typeof parsed === 'string') return normalizeStringList(parsed.split(','));
      if (typeof raw === 'string' && raw.indexOf(',') !== -1) return normalizeStringList(raw.split(','));
      return [];
    } catch (_) {
      try {
        var fallbackRaw = localStorage.getItem(SECONDARY_STORES_KEY);
        if (typeof fallbackRaw === 'string') return normalizeStringList(fallbackRaw.split(','));
      } catch (_2) { /* ignore */ }
      return [];
    }
  }

  function buildStoreLookup(stores) {
    var lookup = {};
    if (!Array.isArray(stores)) return lookup;
    for (var i = 0; i < stores.length; i++) {
      var store = stores[i];
      if (!store || !store.slug) continue;
      lookup[String(store.slug)] = store;
    }
    return lookup;
  }

  function isCulversSlug(slug, storeLookup) {
    if (!slug) return false;
    if (brandFromSlug(slug) !== 'culvers') return false;
    if (!storeLookup) return true;
    var store = storeLookup[slug];
    if (!store) return false;
    if (!store.brand) return true;
    return String(store.brand).toLowerCase() === 'culvers';
  }

  function sanitizeDriveStores(slugs, opts) {
    opts = opts || {};
    var list = normalizeStringList(Array.isArray(slugs) ? slugs : []);
    var storeLookup = buildStoreLookup(opts.stores);
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
    if (DRIVE_ALLOWED_SORTS[value]) return value;
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

  function pickDefaultDriveStores(opts) {
    opts = opts || {};
    var fromLegacy = [];
    var primary = getPrimaryStoreSlug();
    if (primary) fromLegacy.push(primary);
    var secondary = parseLegacySecondaryStores();
    for (var i = 0; i < secondary.length; i++) fromLegacy.push(secondary[i]);
    var legacyClean = sanitizeDriveStores(fromLegacy, opts);
    if (legacyClean.length >= 2) return legacyClean.slice(0, 5);

    var storeLookup = buildStoreLookup(opts.stores);
    var culvers = [];
    var lookupKeys = Object.keys(storeLookup);
    for (var ki = 0; ki < lookupKeys.length; ki++) {
      var slug = lookupKeys[ki];
      if (isCulversSlug(slug, storeLookup)) culvers.push(slug);
      if (culvers.length >= 5) break;
    }
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
      version: DRIVE_PREF_VERSION,
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
      version: DRIVE_PREF_VERSION,
      favoriteStores: favoriteStores,
      activeRoute: {
        id: 'default',
        name: "Today's Drive",
        stores: routeStores,
      },
      filters: {
        excludeTags: sanitizeDriveTagList(value.filters && value.filters.excludeTags, DRIVE_ALLOWED_EXCLUDES),
        includeOnlyTags: [],
        avoidIngredients: [],
      },
      preferences: {
        boostTags: sanitizeDriveTagList(value.preferences && value.preferences.boostTags, DRIVE_ALLOWED_TAGS),
        avoidTags: sanitizeDriveTagList(value.preferences && value.preferences.avoidTags, DRIVE_ALLOWED_TAGS),
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
      state.excludeTags = parseCsvTagParam(params.get('exclude') || '', DRIVE_ALLOWED_EXCLUDES);
    }
    if (params.has('boost')) {
      state.boostTags = parseCsvTagParam(params.get('boost') || '', DRIVE_ALLOWED_TAGS);
    }
    if (params.has('avoid')) {
      state.avoidTags = parseCsvTagParam(params.get('avoid') || '', DRIVE_ALLOWED_TAGS);
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
    if (Array.isArray(state.excludeTags)) merged.filters.excludeTags = sanitizeDriveTagList(state.excludeTags, DRIVE_ALLOWED_EXCLUDES);
    if (Array.isArray(state.boostTags)) merged.preferences.boostTags = sanitizeDriveTagList(state.boostTags, DRIVE_ALLOWED_TAGS);
    if (Array.isArray(state.avoidTags)) merged.preferences.avoidTags = sanitizeDriveTagList(state.avoidTags, DRIVE_ALLOWED_TAGS);
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
        var raw = localStorage.getItem(DRIVE_PREFERENCES_KEY);
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

  function saveDrivePreferences(prefs, opts) {
    var clean = sanitizeDrivePreferences(prefs, opts);
    clean.updatedAt = new Date().toISOString();
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(DRIVE_PREFERENCES_KEY, JSON.stringify(clean));
        if (clean.activeRoute && Array.isArray(clean.activeRoute.stores) && clean.activeRoute.stores.length > 0) {
          setPrimaryStoreSlug(clean.activeRoute.stores[0]);
          localStorage.setItem(SECONDARY_STORES_KEY, JSON.stringify(clean.activeRoute.stores.slice(1, 5)));
        }
      }
    } catch (_) {
      return clean;
    }
    return clean;
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

  /**
   * Derive a rarity label from avg_gap_days (per-store cadence).
   * This keeps the badge consistent with the "Every N days" cadence text.
   * Thresholds:
   *   > 120 days  -> Ultra Rare  (appears less than ~3x/year)
   *   > 60 days   -> Rare        (appears roughly every 2-4 months)
   *   <= 60 days  -> null        (appears frequently enough to not be notable)
   */
  function rarityLabelFromGapDays(avgGapDays) {
    var days = Math.round(Number(avgGapDays));
    if (!Number.isFinite(days) || days < 2) return null;
    if (days > 120) return 'Ultra Rare';
    if (days > 60) return 'Rare';
    return null;
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

  function getPrimaryStoreSlug() {
    try {
      if (typeof localStorage === 'undefined') return null;
      var slug = localStorage.getItem(PRIMARY_STORE_KEY);
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
        localStorage.removeItem(PRIMARY_STORE_KEY);
      } else {
        localStorage.setItem(PRIMARY_STORE_KEY, clean);
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
      var raw = localStorage.getItem(FAVORITES_KEY);
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
      if (favs.length >= MAX_FAVORITES) return false;
      favs.push(clean);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
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
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
      return true;
    } catch (_) {
      return false;
    }
  }

  function inferPageKey() {
    if (typeof document !== 'undefined' && document.body) {
      var explicit = document.body.getAttribute('data-page');
      if (explicit) return String(explicit).toLowerCase();
    }
    if (typeof window === 'undefined' || !window.location) return 'unknown';
    var path = String(window.location.pathname || '').toLowerCase();
    var file = path.substring(path.lastIndexOf('/') + 1);
    if (!file || file === 'index.html') return 'index';
    if (file.slice(-5) === '.html') return file.slice(0, -5);
    return file || 'unknown';
  }

  function makePageLoadId() {
    try {
      if (typeof crypto !== 'undefined' && crypto && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID().replace(/[^a-z0-9_-]/gi, '').slice(0, 64);
      }
    } catch (_) { /* ignore */ }
    var rand = Math.random().toString(36).slice(2);
    var ts = Date.now().toString(36);
    return ('pl_' + ts + '_' + rand).slice(0, 64);
  }

  var _pageLoadId = makePageLoadId();
  var _telemetryListenerBound = false;
  var _ALLOWED_EVENT_TYPES = {
    cta_click: true,
    signal_view: true,
    popup_open: true,
    onboarding_view: true,
    onboarding_click: true,
    quiz_complete: true,
    page_view: true,
    store_select: true,
    filter_toggle: true,
    widget_tap: true,
    alert_form_view: true,
    alert_subscribe_success: true,
  };
  var _ALLOWED_CERTAINTY = { confirmed: true, watch: true, estimated: true, none: true };

  function cleanTelemetryText(value, maxLen) {
    if (typeof value !== 'string') return null;
    var trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, maxLen || 96);
  }

  function cleanTelemetrySlug(value) {
    if (typeof value !== 'string') return null;
    var trimmed = value.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{0,80}$/.test(trimmed)) return null;
    return trimmed;
  }

  function cleanTelemetryEventType(value) {
    var t = cleanTelemetryText(value, 32);
    if (!t) return null;
    var lower = t.toLowerCase();
    return _ALLOWED_EVENT_TYPES[lower] ? lower : null;
  }

  function cleanTelemetryAction(value) {
    var a = cleanTelemetryText(value, 64);
    if (!a) return null;
    return a.toLowerCase().replace(/\s+/g, '_');
  }

  function cleanTelemetryCertainty(value) {
    var c = cleanTelemetryText(value, 16);
    if (!c) return null;
    var lower = c.toLowerCase();
    return _ALLOWED_CERTAINTY[lower] ? lower : null;
  }

  function cleanTelemetryDeviceType(value) {
    var t = cleanTelemetryText(value, 16);
    if (!t) return null;
    var lower = t.toLowerCase();
    return (lower === 'mobile' || lower === 'desktop' || lower === 'tablet') ? lower : null;
  }

  function emitInteractionEvent(raw) {
    if (!raw || typeof raw !== 'object') return false;
    var eventType = cleanTelemetryEventType(raw.event_type);
    if (!eventType) return false;

    var payload = {
      event_type: eventType,
      page: cleanTelemetryText(raw.page, 48) || inferPageKey(),
      action: cleanTelemetryAction(raw.action),
      store_slug: cleanTelemetrySlug(raw.store_slug),
      flavor: cleanTelemetryText(raw.flavor, 96),
      certainty_tier: cleanTelemetryCertainty(raw.certainty_tier),
      page_load_id: cleanTelemetryText(raw.page_load_id, 80) || _pageLoadId,
      referrer: cleanTelemetryText(raw.referrer, 200),
      device_type: cleanTelemetryDeviceType(raw.device_type),
    };

    var body = JSON.stringify(payload);
    var url = WORKER_BASE + '/api/v1/events';

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        var ok = navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
        if (ok) return true;
      }
    } catch (_) { /* fall through to fetch */ }

    try {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true,
      }).catch(function () { /* best effort */ });
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * Emit a page_view event with referrer and device_type.
   * Call once per page load: CustardPlanner.emitPageView('scoop')
   */
  var _pageViewEmitted = false;
  function emitPageView(pageName) {
    if (_pageViewEmitted) return false;
    _pageViewEmitted = true;
    var referrer = '';
    try { referrer = document.referrer || ''; } catch (_) {}
    var ua = '';
    try { ua = navigator.userAgent || ''; } catch (_) {}
    var deviceType = /iPad|Tablet/i.test(ua) ? 'tablet' : (/Mobile|Android|iPhone|iPod/i.test(ua) ? 'mobile' : 'desktop');
    return emitInteractionEvent({
      event_type: 'page_view',
      page: pageName || 'unknown',
      referrer: referrer,
      device_type: deviceType,
    });
  }

  function inferCtaAction(link) {
    if (!link) return null;
    var explicit = link.getAttribute('data-event-action');
    if (explicit) return explicit;
    var classes = link.className || '';
    if (classes.indexOf('cta-directions') >= 0) return 'directions';
    if (classes.indexOf('cta-alert') >= 0) return 'alert';
    if (classes.indexOf('cta-calendar') >= 0) return 'subscribe';
    return null;
  }

  function bindInteractionTelemetry() {
    if (_telemetryListenerBound || typeof document === 'undefined') return;
    _telemetryListenerBound = true;
    document.addEventListener('click', function (evt) {
      var target = evt.target;
      if (!target || typeof target.closest !== 'function') return;
      var link = target.closest('a.cta-link');
      if (!link) return;
      var action = inferCtaAction(link);
      if (!action) return;
      emitInteractionEvent({
        event_type: 'cta_click',
        action: action,
        store_slug: link.getAttribute('data-store-slug'),
        flavor: link.getAttribute('data-flavor'),
        certainty_tier: link.getAttribute('data-certainty-tier'),
      });
    }, true);
  }

  bindInteractionTelemetry();

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        emitPageView(inferPageKey());
      }, { once: true });
    } else {
      setTimeout(function () { emitPageView(inferPageKey()); }, 0);
    }
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
    if (typeof fetch !== 'function') return;
    fetch(WORKER_BASE + '/api/v1/flavor-config')
      .then(function (resp) { return resp.ok ? resp.json() : null; })
      .then(function (data) {
        if (!data) return;
        applyFlavorConfig(data);
      })
      .catch(function () { /* fallback constants remain active */ });
  }

  rebuildFlavorFamilyIndexes();
  bootstrapFlavorConfig();

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

  function ctaDataAttrs(opts, actionName) {
    var attrs = ' data-event-action="' + escapeHtml(actionName) + '"';
    if (opts.slug) attrs += ' data-store-slug="' + escapeHtml(opts.slug) + '"';
    if (opts.flavor) attrs += ' data-flavor="' + escapeHtml(opts.flavor) + '"';
    if (opts.certaintyTier) attrs += ' data-certainty-tier="' + escapeHtml(opts.certaintyTier) + '"';
    return attrs;
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
    var hasCoords = Number.isFinite(Number(opts.lat)) && Number.isFinite(Number(opts.lon));

    for (var i = 0; i < actions.length; i++) {
      var action = actions[i];
      if (action === 'directions' && hasCoords) {
        parts.push(
          '<a href="' + directionsUrl(opts.lat, opts.lon, opts.storeName) + '" class="cta-link cta-directions"' + ctaDataAttrs(opts, 'directions') + ' target="_blank" rel="noopener">Directions</a>'
        );
      } else if (action === 'alert') {
        parts.push(
          '<a href="' + alertPageUrl(opts.slug) + '" class="cta-link cta-alert"' + ctaDataAttrs(opts, 'alert') + '>Set Alert</a>'
        );
      } else if (action === 'calendar') {
        parts.push(
          '<a href="' + calendarIcsUrl(opts.workerBase, opts.slug) + '" class="cta-link cta-calendar"' + ctaDataAttrs(opts, 'subscribe') + '>Subscribe</a>'
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
  // Historical context (metrics-pack backed snippets)
  // ---------------------------------------------------------------------------

  var _flavorContextCache = {};
  var _storeContextCache = {};

  function formatInt(value) {
    var n = Number(value || 0);
    if (!Number.isFinite(n)) return '0';
    return n.toLocaleString('en-US');
  }

  function fetchFlavorHistoricalContext(workerBase, flavorName) {
    var key = normalize(flavorName);
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
      listHtml += '<li>' + escapeHtml(lines[i]) + '</li>';
    }

    return '<div class="historical-context-card">'
      + '<div class="historical-context-head">' + escapeHtml(heading) + '</div>'
      + '<ul class="historical-context-list">' + listHtml + '</ul>'
      + (sourceLabel ? '<div class="historical-context-source">' + escapeHtml(sourceLabel) + '</div>' : '')
      + '</div>';
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  return {
    // Worker base URL
    WORKER_BASE: WORKER_BASE,

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

    // Utilities
    escapeHtml: escapeHtml,
    getPrimaryStoreSlug: getPrimaryStoreSlug,
    setPrimaryStoreSlug: setPrimaryStoreSlug,
    getSavedStore: getSavedStore,
    setSavedStore: setSavedStore,
    getFavorites: getFavorites,
    addFavorite: addFavorite,
    removeFavorite: removeFavorite,
    getDrivePreferences: getDrivePreferences,
    saveDrivePreferences: saveDrivePreferences,
    parseDriveUrlState: parseDriveUrlState,
    buildDriveUrlState: buildDriveUrlState,
    DRIVE_PREFERENCES_KEY: DRIVE_PREFERENCES_KEY,
    rarityLabelFromGapDays: rarityLabelFromGapDays,
    rarityLabelFromPercentile: rarityLabelFromPercentile,
    rarityLabelFromRank: rarityLabelFromRank,
    formatCadenceText: formatCadenceText,

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

    // Historical context
    fetchFlavorHistoricalContext: fetchFlavorHistoricalContext,
    fetchStoreHistoricalContext: fetchStoreHistoricalContext,
    historicalContextHTML: historicalContextHTML,

    // Action CTAs
    directionsUrl: directionsUrl,
    calendarIcsUrl: calendarIcsUrl,
    alertPageUrl: alertPageUrl,
    actionCTAsHTML: actionCTAsHTML,
    emitInteractionEvent: emitInteractionEvent,
    emitPageView: emitPageView,
    getPageLoadId: function() { return _pageLoadId; },

    // Signals
    signalCardHTML: signalCardHTML,
    fetchSignals: fetchSignalsShared,

    // Share
    initShareButton: initShareButton,
  };

  // ---------------------------------------------------------------------------
  // Flavor signals
  // ---------------------------------------------------------------------------

  /**
   * Render a single signal card as HTML.
   * @param {Object} sig - Signal object from /api/v1/signals
   * @param {string} slug - Store slug for action URLs
   * @param {string} workerBase - Worker base URL
   * @returns {string} HTML
   */
  function signalCardHTML(sig, slug, workerBase) {
    var actionLabel = sig.action === 'directions' ? 'Directions' : sig.action === 'calendar' ? 'Subscribe' : 'Set Alert';
    var actionClass = 'cta-link cta-' + sig.action;
    var actionHref = sig.action === 'alert' ? alertPageUrl(slug) : sig.action === 'calendar' ? calendarIcsUrl(workerBase, slug) : '#';
    var flavor = sig.flavor || '';
    var certainty = sig.certainty_tier || 'none';
    var actionName = sig.action === 'calendar' ? 'subscribe' : sig.action;
    return '<div class="signal-card"'
      + ' data-signal-type="' + escapeHtml(sig.type || 'signal') + '"'
      + ' data-store-slug="' + escapeHtml(slug || '') + '"'
      + ' data-flavor="' + escapeHtml(flavor) + '"'
      + ' data-certainty-tier="' + escapeHtml(certainty) + '">'
      + '<div class="signal-card-accent signal-accent-' + escapeHtml(sig.type) + '"></div>'
      + '<div class="signal-card-body">'
      + '<div class="signal-headline">' + escapeHtml(sig.headline) + '</div>'
      + '<div class="signal-explanation">' + escapeHtml(sig.explanation) + '</div>'
      + '<a href="' + actionHref + '" class="' + actionClass + '" data-event-action="' + escapeHtml(actionName || 'alert') + '" data-store-slug="' + escapeHtml(slug || '') + '" data-flavor="' + escapeHtml(flavor) + '" data-certainty-tier="' + escapeHtml(certainty) + '">' + actionLabel + '</a>'
      + '</div></div>';
  }

  function trackSignalViews(list) {
    if (!list || typeof list.querySelectorAll !== 'function') return;
    var cards = list.querySelectorAll('.signal-card');
    if (!cards || cards.length === 0) return;

    var emitForCard = function (card) {
      emitInteractionEvent({
        event_type: 'signal_view',
        action: card.getAttribute('data-signal-type') || 'signal',
        store_slug: card.getAttribute('data-store-slug'),
        flavor: card.getAttribute('data-flavor'),
        certainty_tier: card.getAttribute('data-certainty-tier'),
      });
    };

    if (typeof IntersectionObserver === 'undefined') {
      for (var i = 0; i < cards.length; i++) emitForCard(cards[i]);
      return;
    }

    if (list.__signalViewObserver && typeof list.__signalViewObserver.disconnect === 'function') {
      list.__signalViewObserver.disconnect();
    }

    var seen = {};
    var observer = new IntersectionObserver(function (entries, obs) {
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        if (!entry.isIntersecting) continue;
        var card = entry.target;
        var key = card.getAttribute('data-signal-key');
        if (key && seen[key]) {
          obs.unobserve(card);
          continue;
        }
        if (key) seen[key] = true;
        emitForCard(card);
        obs.unobserve(card);
      }
    }, { threshold: 0.6 });

    list.__signalViewObserver = observer;
    for (var ci = 0; ci < cards.length; ci++) {
      cards[ci].setAttribute('data-signal-key', cards[ci].getAttribute('data-signal-key') || String(ci));
      observer.observe(cards[ci]);
    }
  }

  /**
   * Fetch signals for a store and render into a container.
   * @param {string} workerBase
   * @param {string} slug
   * @param {HTMLElement} section - Container section (hidden/shown)
   * @param {HTMLElement} list - List container for signal cards
   * @param {number} [limit=3]
   */
  function fetchSignalsShared(workerBase, slug, section, list, limit) {
    limit = limit || 3;
    fetch(workerBase + '/api/v1/signals/' + encodeURIComponent(slug) + '?limit=' + limit)
      .then(function (resp) { return resp.ok ? resp.json() : null; })
      .then(function (data) {
        if (!data || !data.signals || data.signals.length === 0) return;
        var html = '';
        for (var i = 0; i < data.signals.length; i++) {
          html += signalCardHTML(data.signals[i], slug, workerBase);
        }
        list.innerHTML = html;
        section.hidden = false;
        trackSignalViews(list);
      })
      .catch(function () { /* enhancement-only */ });
  }

  // ---------------------------------------------------------------------------
  // Share button
  // ---------------------------------------------------------------------------

  /**
   * Mount a share button into a container element.
   * Uses Web Share API when available; falls back to clipboard copy.
   * Reads og:url and og:title meta tags for share payload.
   * @param {HTMLElement|string} container - Element or element ID to mount into
   */
  function initShareButton(container) {
    if (typeof container === 'string') container = document.getElementById(container);
    if (!container) return;

    var ogUrl = document.querySelector('meta[property="og:url"]');
    var ogTitle = document.querySelector('meta[property="og:title"]');
    var shareUrl = (ogUrl && ogUrl.content) || window.location.href;
    var shareTitle = (ogTitle && ogTitle.content) || document.title;

    var btn = document.createElement('button');
    btn.className = 'share-btn';
    btn.setAttribute('aria-label', 'Share this page');
    btn.textContent = 'Share';

    btn.addEventListener('click', function () {
      if (navigator.share) {
        navigator.share({ title: shareTitle, url: shareUrl }).catch(function () {});
      } else {
        navigator.clipboard.writeText(shareUrl).then(function () {
          btn.textContent = 'Link copied';
          setTimeout(function () { btn.textContent = 'Share'; }, 2000);
        }).catch(function () {
          window.prompt('Copy this link:', shareUrl);
        });
      }
    });

    container.appendChild(btn);
  }
})();
