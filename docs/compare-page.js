/**
 * CustardCompare -- compare page logic for the day-first card stack view.
 *
 * Shows 3 days of flavors across 2-4 saved stores with cone SVGs,
 * rarity badges, and a rarity nudge banner. Accordion expand and
 * exclusion filters provide interactive filtering and detail views.
 *
 * Usage: <script src="compare-page.js"></script> (after planner-shared.js, shared-nav.js, cone-renderer.js)
 * Exposes: window.CustardCompare (var, no build step required)
 */
var CustardCompare = (function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Shared references (from planner-shared.js and cone-renderer.js)
  // ---------------------------------------------------------------------------

  var WORKER_BASE = CustardPlanner.WORKER_BASE;
  var escapeHtml = CustardPlanner.escapeHtml;

  // ---------------------------------------------------------------------------
  // Private state
  // ---------------------------------------------------------------------------

  var _stores = [];          // saved store slugs
  var _storeData = {};       // slug -> { flavors: {...}, today: {...} }
  var _storeManifest = {};   // slug -> store object from stores.json
  var _allStoresArr = [];    // full stores array from stores.json
  var _expandedRow = null;   // currently expanded DOM element

  // ---------------------------------------------------------------------------
  // Exclusion filter constants and state
  // ---------------------------------------------------------------------------

  var EXCLUSION_CHIPS = [
    { key: 'mint', label: 'No Mint' },
    { key: 'chocolate', label: 'No Chocolate' },
    { key: 'caramel', label: 'No Caramel' },
    { key: 'cheesecake', label: 'No Cheesecake' },
    { key: 'peanutButter', label: 'No Peanut Butter' },
    { key: 'pecan', label: 'No Nuts' },
  ];

  var _exclusions = new Set();

  // Restore exclusion state from localStorage
  function restoreExclusions() {
    try {
      var raw = localStorage.getItem('custard-exclusions');
      if (raw) {
        var arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          _exclusions = new Set(arr);
        }
      }
    } catch (e) {}
  }

  function saveExclusions() {
    try {
      var arr = [];
      _exclusions.forEach(function (key) { arr.push(key); });
      localStorage.setItem('custard-exclusions', JSON.stringify(arr));
    } catch (e) {}
  }

  // ---------------------------------------------------------------------------
  // DOM refs
  // ---------------------------------------------------------------------------

  var compareEmpty = null;
  var compareLoading = null;
  var compareError = null;
  var compareErrorMessage = null;
  var compareRetryBtn = null;
  var compareNudge = null;
  var compareNudgeContent = null;
  var compareGrid = null;
  var addStoresBtn = null;

  function cacheDomRefs() {
    compareEmpty = document.getElementById('compare-empty');
    compareLoading = document.getElementById('compare-loading');
    compareError = document.getElementById('compare-error');
    compareErrorMessage = document.getElementById('compare-error-message');
    compareRetryBtn = document.getElementById('compare-retry-btn');
    compareNudge = document.getElementById('compare-nudge');
    compareNudgeContent = document.getElementById('compare-nudge-content');
    compareGrid = document.getElementById('compare-grid');
    addStoresBtn = document.getElementById('compare-add-stores');
  }

  // ---------------------------------------------------------------------------
  // Utility functions
  // ---------------------------------------------------------------------------

  function toISODate(d) {
    return d.toISOString().slice(0, 10);
  }

  function formatDayHeader(dateStr, index) {
    var d = new Date(dateStr + 'T12:00:00');
    var dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    var monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (index === 0) return 'Today \u2014 ' + dayName + ', ' + monthDay;
    if (index === 1) return 'Tomorrow \u2014 ' + dayName + ', ' + monthDay;
    return dayName + ', ' + monthDay;
  }

  // ---------------------------------------------------------------------------
  // Store slug loading (raw localStorage, not getDrivePreferences)
  // ---------------------------------------------------------------------------

  function getSavedStoreSlugs() {
    try {
      var raw = localStorage.getItem('custard:v1:preferences');
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.activeRoute && Array.isArray(parsed.activeRoute.stores)) {
          return parsed.activeRoute.stores.slice(0, 4);
        }
      }
    } catch (e) {}
    return [];
  }

  // ---------------------------------------------------------------------------
  // Store manifest loading
  // ---------------------------------------------------------------------------

  function loadStores() {
    return fetch('stores.json?v=' + new Date().toISOString().slice(0, 10))
      .then(function (resp) { return resp.json(); })
      .then(function (data) {
        _allStoresArr = data.stores || [];
        _storeManifest = {};
        for (var i = 0; i < _allStoresArr.length; i++) {
          var store = _allStoresArr[i];
          _storeManifest[store.slug] = store;
        }
      })
      .catch(function (err) { console.error('Failed to load stores:', err); });
  }

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  function loadCompareData(slugs) {
    var promises = slugs.map(function (slug) {
      return Promise.all([
        fetch(WORKER_BASE + '/api/v1/flavors?slug=' + encodeURIComponent(slug))
          .then(function (r) { return r.ok ? r.json() : null; })
          .catch(function () { return null; }),
        fetch(WORKER_BASE + '/api/v1/today?slug=' + encodeURIComponent(slug))
          .then(function (r) { return r.ok ? r.json() : null; })
          .catch(function () { return null; }),
      ]).then(function (results) {
        return { slug: slug, flavors: results[0], today: results[1] };
      });
    });
    return Promise.all(promises);
  }

  // ---------------------------------------------------------------------------
  // 3-day schedule extraction
  // ---------------------------------------------------------------------------

  function extract3DaySchedule(flavorsData) {
    var today = new Date();
    today.setHours(12, 0, 0, 0);
    var dates = [];
    for (var i = 0; i < 3; i++) {
      var d = new Date(today);
      d.setDate(d.getDate() + i);
      dates.push(toISODate(d));
    }

    var schedule = {};
    var flavors = (flavorsData && flavorsData.flavors) ? flavorsData.flavors : [];
    for (var di = 0; di < dates.length; di++) {
      var dateStr = dates[di];
      var entry = null;
      for (var fi = 0; fi < flavors.length; fi++) {
        if (flavors[fi].date === dateStr) {
          entry = flavors[fi];
          break;
        }
      }
      schedule[dateStr] = entry || null;
    }
    return { dates: dates, schedule: schedule };
  }

  // ---------------------------------------------------------------------------
  // Rarity badge rendering
  // ---------------------------------------------------------------------------

  function renderRarityBadge(rarity) {
    if (!rarity || !rarity.label) return '';
    var cssClass = 'rarity-badge rarity-badge-' + rarity.label.toLowerCase().replace(/\s+/g, '-');
    return '<span class="' + cssClass + '">' + escapeHtml(rarity.label) + '</span>';
  }

  // ---------------------------------------------------------------------------
  // Rarity nudge banner
  // ---------------------------------------------------------------------------

  function buildRarityNudge() {
    if (!compareNudge || !compareNudgeContent) return;
    var nudges = [];
    for (var slug in _storeData) {
      if (!_storeData.hasOwnProperty(slug)) continue;
      var todayResp = _storeData[slug].today;
      if (!todayResp || !todayResp.rarity) continue;
      var label = todayResp.rarity.label;
      if (label === 'Ultra Rare' || label === 'Rare') {
        var store = _storeManifest[slug];
        var storeName = store ? store.city : slug;
        var gap = todayResp.rarity.avg_gap_days;
        nudges.push({
          label: label,
          flavor: todayResp.flavor,
          store: storeName,
          gap: gap,
        });
      }
    }

    if (nudges.length === 0) {
      compareNudge.hidden = true;
      return;
    }

    var html = '';
    for (var i = 0; i < nudges.length; i++) {
      var n = nudges[i];
      if (i > 0) html += '<br>';
      html += '<strong>' + escapeHtml(n.label) + ':</strong> ';
      html += escapeHtml(n.flavor) + ' at ' + escapeHtml(n.store);
      if (n.gap) {
        html += ' \u2014 only every ' + n.gap + ' days!';
      }
    }
    compareNudgeContent.innerHTML = html;
    compareNudge.hidden = false;
  }

  // ---------------------------------------------------------------------------
  // Google Maps directions URL
  // ---------------------------------------------------------------------------

  function directionsUrl(store) {
    var addr = encodeURIComponent(store.address + ', ' + store.city + ', ' + store.state);
    return 'https://google.com/maps/dir/?api=1&destination=' + addr;
  }

  // ---------------------------------------------------------------------------
  // Accordion expand
  // ---------------------------------------------------------------------------

  function populateDetail(detailEl, slug, dateStr) {
    var data = _storeData[slug];
    var store = _storeManifest[slug];
    var html = '';

    // Flavor description
    var flavorDesc = '';
    if (data && data.flavors) {
      var sched = extract3DaySchedule(data.flavors);
      var entry = sched.schedule[dateStr];
      if (entry && entry.description) {
        flavorDesc = entry.description;
      }
    }
    if (flavorDesc) {
      html += '<p class="compare-flavor-desc">' + escapeHtml(flavorDesc) + '</p>';
    }

    // Rarity detail (only for today)
    var todayDate = new Date();
    todayDate.setHours(12, 0, 0, 0);
    var todayStr = toISODate(todayDate);
    if (dateStr === todayStr && data && data.today && data.today.rarity) {
      var rarity = data.today.rarity;
      var gap = rarity.avg_gap_days;
      var rarityText = '';
      if (rarity.label === 'Ultra Rare' && gap) {
        rarityText = 'Ultra Rare \u2014 only every ' + gap + ' days!';
      } else if (gap) {
        rarityText = 'Shows up roughly every ' + gap + ' days';
      }
      if (rarityText) {
        html += '<p class="compare-rarity-detail">' + escapeHtml(rarityText) + '</p>';
      }
    }

    // Directions link
    if (store && store.address) {
      html += '<a class="compare-directions" href="' + directionsUrl(store) + '" target="_blank" rel="noopener">Get Directions</a>';
    }

    detailEl.innerHTML = html;
  }

  function toggleExpand(rowEl) {
    // Prevent expand on excluded rows (belt-and-suspenders with CSS pointer-events:none)
    if (rowEl.classList.contains('compare-excluded')) return;

    // Find the detail element (next sibling after the row)
    var detailEl = rowEl.nextElementSibling;
    if (!detailEl || !detailEl.classList.contains('compare-store-detail')) return;

    // If this row is already expanded, collapse it
    if (_expandedRow === rowEl) {
      detailEl.hidden = true;
      _expandedRow = null;
      return;
    }

    // Collapse previously expanded row
    if (_expandedRow) {
      var prevDetail = _expandedRow.nextElementSibling;
      if (prevDetail && prevDetail.classList.contains('compare-store-detail')) {
        prevDetail.hidden = true;
      }
      _expandedRow = null;
    }

    // Expand this row
    var slug = rowEl.getAttribute('data-slug');
    var dateStr = rowEl.getAttribute('data-date');
    populateDetail(detailEl, slug, dateStr);
    detailEl.hidden = false;
    _expandedRow = rowEl;
  }

  // ---------------------------------------------------------------------------
  // Exclusion filter chips
  // ---------------------------------------------------------------------------

  function applyExclusions() {
    var rows = document.querySelectorAll('.compare-store-row');
    for (var i = 0; i < rows.length; i++) {
      var flavor = rows[i].getAttribute('data-flavor');
      var family = CustardPlanner.getFamilyForFlavor(flavor);
      var excluded = family ? _exclusions.has(family) : false;
      rows[i].classList.toggle('compare-excluded', excluded);

      // Collapse if excluded row is currently expanded
      if (excluded && _expandedRow === rows[i]) {
        var detailEl = rows[i].nextElementSibling;
        if (detailEl && detailEl.classList.contains('compare-store-detail')) {
          detailEl.hidden = true;
        }
        _expandedRow = null;
      }
    }
  }

  function toggleExclusion(familyKey) {
    if (_exclusions.has(familyKey)) {
      _exclusions.delete(familyKey);
    } else {
      _exclusions.add(familyKey);
    }

    // Toggle active class on the chip button
    var chip = document.querySelector('.compare-filter-chip[data-family="' + familyKey + '"]');
    if (chip) {
      chip.classList.toggle('active', _exclusions.has(familyKey));
    }

    saveExclusions();
    applyExclusions();
  }

  function renderFilterChips() {
    // Remove existing filter bar if any
    var existing = document.querySelector('.compare-filter-bar');
    if (existing) existing.parentNode.removeChild(existing);

    if (!compareGrid) return;

    var bar = document.createElement('div');
    bar.className = 'compare-filter-bar';

    for (var i = 0; i < EXCLUSION_CHIPS.length; i++) {
      var chipData = EXCLUSION_CHIPS[i];
      var btn = document.createElement('button');
      btn.className = 'compare-filter-chip';
      btn.setAttribute('data-family', chipData.key);
      btn.textContent = chipData.label;

      // Restore active state from _exclusions
      if (_exclusions.has(chipData.key)) {
        btn.classList.add('active');
      }

      // Wire click handler
      btn.addEventListener('click', (function (key) {
        return function () { toggleExclusion(key); };
      })(chipData.key));

      bar.appendChild(btn);
    }

    // Insert filter bar above the grid
    compareGrid.parentNode.insertBefore(bar, compareGrid);
  }

  // ---------------------------------------------------------------------------
  // Grid rendering
  // ---------------------------------------------------------------------------

  function renderGrid() {
    _expandedRow = null;
    if (!compareGrid) return;
    compareGrid.innerHTML = '';

    // Compute 3 dates
    var today = new Date();
    today.setHours(12, 0, 0, 0);
    var dates = [];
    for (var i = 0; i < 3; i++) {
      var d = new Date(today);
      d.setDate(d.getDate() + i);
      dates.push(toISODate(d));
    }

    var todayStr = dates[0];

    for (var di = 0; di < dates.length; di++) {
      var dateStr = dates[di];

      // Day card
      var dayCard = document.createElement('div');
      dayCard.className = 'compare-day-card';

      // Day header
      var header = document.createElement('h3');
      header.className = 'compare-day-header';
      header.textContent = formatDayHeader(dateStr, di);
      dayCard.appendChild(header);

      // Store rows
      for (var si = 0; si < _stores.length; si++) {
        var slug = _stores[si];
        var data = _storeData[slug];
        var store = _storeManifest[slug];
        var storeName = store ? store.city : slug;

        // Get flavor for this date
        var flavorEntry = null;
        var flavorName = 'No data';
        var flavorDesc = '';
        if (data && data.flavors) {
          var sched = extract3DaySchedule(data.flavors);
          flavorEntry = sched.schedule[dateStr];
          if (flavorEntry) {
            flavorName = flavorEntry.title || 'No data';
            flavorDesc = flavorEntry.description || '';
          }
        }

        // Rarity (only for today)
        var rarityHtml = '';
        if (dateStr === todayStr && data && data.today && data.today.rarity) {
          rarityHtml = renderRarityBadge(data.today.rarity);
        }

        // Build row
        var row = document.createElement('div');
        row.className = 'compare-store-row';
        row.setAttribute('data-slug', slug);
        row.setAttribute('data-flavor', flavorName);
        row.setAttribute('data-date', dateStr);

        // Cone SVG
        var coneHtml = '';
        if (flavorName !== 'No data' && typeof renderMiniConeSVG === 'function') {
          coneHtml = renderMiniConeSVG(flavorName);
        }

        row.innerHTML =
          '<div class="compare-cone">' + coneHtml + '</div>' +
          '<div class="compare-flavor-name">' + escapeHtml(flavorName) + '</div>' +
          rarityHtml +
          '<span class="compare-store-label">' + escapeHtml(storeName) + '</span>';

        // Wire accordion click handler
        row.addEventListener('click', (function (r) {
          return function () { toggleExpand(r); };
        })(row));

        dayCard.appendChild(row);

        // Detail panel (hidden by default, expanded on click)
        var detail = document.createElement('div');
        detail.className = 'compare-store-detail';
        detail.hidden = true;
        dayCard.appendChild(detail);
      }

      compareGrid.appendChild(dayCard);
    }
  }

  // ---------------------------------------------------------------------------
  // State management
  // ---------------------------------------------------------------------------

  function showState(stateName) {
    if (compareEmpty) compareEmpty.hidden = (stateName !== 'empty');
    if (compareLoading) compareLoading.hidden = (stateName !== 'loading');
    if (compareError) compareError.hidden = (stateName !== 'error');
    if (compareNudge && stateName !== 'grid') compareNudge.hidden = true;
    if (compareGrid && stateName !== 'grid') compareGrid.innerHTML = '';
  }

  // ---------------------------------------------------------------------------
  // Main load flow
  // ---------------------------------------------------------------------------

  function loadAndRender() {
    _stores = getSavedStoreSlugs();

    if (_stores.length <= 1) {
      showState('empty');
      return;
    }

    showState('loading');

    Promise.all([loadStores(), loadFlavorColors()]).then(function () {
      return loadCompareData(_stores);
    }).then(function (results) {
      _storeData = {};
      var anySuccess = false;
      for (var i = 0; i < results.length; i++) {
        var r = results[i];
        _storeData[r.slug] = { flavors: r.flavors, today: r.today };
        if (r.flavors || r.today) anySuccess = true;
      }

      if (!anySuccess) {
        showState('error');
        return;
      }

      showState('grid');
      renderGrid();
      renderFilterChips();
      applyExclusions();
      buildRarityNudge();
    }).catch(function (err) {
      console.error('Compare data load error:', err);
      showState('error');
    });
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  function bindEvents() {
    if (addStoresBtn) {
      addStoresBtn.addEventListener('click', function () {
        if (typeof SharedNav !== 'undefined' && SharedNav.showStorePicker) {
          SharedNav.showStorePicker();
        }
      });
    }

    if (compareRetryBtn) {
      compareRetryBtn.addEventListener('click', function () {
        loadAndRender();
      });
    }

    // Re-render on store change
    document.addEventListener('sharednav:storechange', function () {
      loadAndRender();
    });
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  function init() {
    cacheDomRefs();
    restoreExclusions();
    bindEvents();
    loadAndRender();

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }

  // Auto-init on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  return { init: init };
})();
