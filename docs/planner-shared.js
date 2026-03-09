/**
 * CustardPlanner -- shared utilities for all custard calendar surfaces.
 * Facade module: creates window.CustardPlanner with core utilities.
 * Sub-modules (planner-data.js, planner-domain.js, planner-ui.js) extend
 * this object via Object.assign after this script loads.
 *
 * Usage: <script src="planner-shared.js"></script>
 *        <script src="planner-data.js"></script>
 *        <script src="planner-domain.js"></script>
 *        <script src="planner-ui.js"></script>
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
  // Core utilities
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

  // ---------------------------------------------------------------------------
  // Public API -- core facade + internal helpers for sub-modules
  // ---------------------------------------------------------------------------

  return {
    WORKER_BASE: WORKER_BASE,
    escapeHtml: escapeHtml,

    // Internal helpers exposed for sub-modules (underscore-prefixed = internal use only)
    _normalizeStringList: normalizeStringList,
    _parseLegacySecondaryStores: parseLegacySecondaryStores,
    _buildStoreLookup: buildStoreLookup,
    _PRIMARY_STORE_KEY: PRIMARY_STORE_KEY,
    _SECONDARY_STORES_KEY: SECONDARY_STORES_KEY,
    _FAVORITES_KEY: FAVORITES_KEY,
    _MAX_FAVORITES: MAX_FAVORITES,
    _DRIVE_PREFERENCES_KEY: DRIVE_PREFERENCES_KEY,
    _DRIVE_PREF_VERSION: DRIVE_PREF_VERSION,
    _DRIVE_ALLOWED_EXCLUDES: DRIVE_ALLOWED_EXCLUDES,
    _DRIVE_ALLOWED_TAGS: DRIVE_ALLOWED_TAGS,
    _DRIVE_ALLOWED_SORTS: DRIVE_ALLOWED_SORTS,
  };
})();
