/**
 * CustardCompare -- compare page logic for the day-first card stack view.
 *
 * Shows 3 days of flavors across 2-4 saved stores with cone SVGs,
 * rarity badges, and a rarity nudge banner. Accordion expand and
 * exclusion filters provide interactive filtering and detail views.
 *
 * Includes a compare-specific multi-store picker that manages store
 * selections in its own localStorage key (custard:compare:stores),
 * allowing users to add/remove stores for side-by-side comparison
 * without affecting the Today page drive preferences.
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
  // Constants
  // ---------------------------------------------------------------------------

  var MAX_COMPARE_STORES = 4;
  var MIN_COMPARE_STORES = 1;
  var COMPARE_STORES_KEY = 'custard:compare:stores';

  // ---------------------------------------------------------------------------
  // Private state
  // ---------------------------------------------------------------------------

  var _stores = [];          // saved store slugs
  var _storeData = {};       // slug -> { flavors: {...}, today: {...} }
  var _storeManifest = {};   // slug -> store object from stores.json
  var _allStoresArr = [];    // full stores array from stores.json
  var _expandedRow = null;   // currently expanded DOM element
  var _manifestLoaded = false; // whether store manifest has been fetched
  var _geoAttempted = false;   // prevents infinite geo-populate loop

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
  var compareStoreBar = null;
  var compareLoadingLabel = null;

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
    compareStoreBar = document.getElementById('compare-store-bar');
    var loadingSection = document.getElementById('compare-loading');
    compareLoadingLabel = loadingSection
      ? loadingSection.querySelector('.compare-loading-label')
      : null;
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
  // Store slug loading and saving
  // ---------------------------------------------------------------------------

  function getSavedStoreSlugs() {
    try {
      var raw = localStorage.getItem(COMPARE_STORES_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.slice(0, MAX_COMPARE_STORES);
      }
    } catch (e) {}

    // Fallback: check legacy primary store key so first-time compare visitors
    // who already picked a store on the Today page see it pre-selected
    try {
      var primary = CustardPlanner.getPrimaryStoreSlug();
      if (primary) return [primary];
    } catch (e) {}

    return [];
  }

  function saveStoreSlugs(slugs) {
    var cleaned = slugs.slice(0, MAX_COMPARE_STORES);
    try {
      localStorage.setItem(COMPARE_STORES_KEY, JSON.stringify(cleaned));
    } catch (e) {}
  }

  // ---------------------------------------------------------------------------
  // Store manifest loading
  // ---------------------------------------------------------------------------

  function loadStores() {
    return fetch('stores.json')
      .then(function (resp) { return resp.json(); })
      .then(function (data) {
        _allStoresArr = data.stores || [];
        _storeManifest = {};
        for (var i = 0; i < _allStoresArr.length; i++) {
          var store = _allStoresArr[i];
          _storeManifest[store.slug] = store;
        }
        _manifestLoaded = true;
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
  // Rarity nudge banner -- REMOVED (S06-T01)
  // The compare rarity banner (buildRarityNudge) produced duplicate rarity
  // information alongside row-level badges and was removed. Rarity information
  // is shown only on the row badge (renderRarityBadge). The #compare-nudge
  // element is kept in HTML for backward compatibility but stays hidden.
  // ---------------------------------------------------------------------------

  function buildRarityNudge() {
    if (compareNudge) compareNudge.hidden = true;
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
      var flavorName = data.today.flavor || '';
      var isSeasonal = CustardPlanner.isSeasonalFlavor(flavorName);
      var rarityText = '';
      if (rarity.label === 'Ultra Rare' && gap && !isSeasonal) {
        rarityText = 'Ultra Rare \u2014 only every ' + gap + ' days!';
      } else if (gap && !isSeasonal) {
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
  // Compare store management bar
  // ---------------------------------------------------------------------------

  function renderStoreBar() {
    if (!compareStoreBar) return;
    compareStoreBar.innerHTML = '';

    if (_stores.length === 0) {
      compareStoreBar.hidden = true;
      return;
    }

    compareStoreBar.hidden = false;

    for (var i = 0; i < _stores.length; i++) {
      var slug = _stores[i];
      var store = _storeManifest[slug];
      var name = store
        ? (typeof CustardPlanner.getDisplayName === 'function'
          ? CustardPlanner.getDisplayName(store, _allStoresArr)
          : store.city)
        : slug.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });

      var chip = document.createElement('span');
      chip.className = 'compare-store-chip';
      chip.setAttribute('data-slug', slug);

      var nameSpan = document.createElement('span');
      nameSpan.className = 'compare-store-chip-name';
      nameSpan.textContent = name;
      chip.appendChild(nameSpan);

      var removeBtn = document.createElement('button');
      removeBtn.className = 'compare-store-chip-remove';
      removeBtn.setAttribute('type', 'button');
      removeBtn.setAttribute('aria-label', 'Remove ' + name);
      removeBtn.innerHTML = '&times;';
      removeBtn.addEventListener('click', (function (s) {
        return function (e) {
          e.stopPropagation();
          removeCompareStore(s);
        };
      })(slug));
      chip.appendChild(removeBtn);

      compareStoreBar.appendChild(chip);
    }

    // Add store button (if under max)
    if (_stores.length < MAX_COMPARE_STORES) {
      var addBtn = document.createElement('button');
      addBtn.className = 'compare-store-add-btn';
      addBtn.setAttribute('type', 'button');
      addBtn.textContent = '+ Add store';
      addBtn.addEventListener('click', function () {
        showCompareStorePicker();
      });
      compareStoreBar.appendChild(addBtn);
    }
  }

  function removeCompareStore(slug) {
    var newStores = [];
    for (var i = 0; i < _stores.length; i++) {
      if (_stores[i] !== slug) newStores.push(_stores[i]);
    }
    saveStoreSlugs(newStores);
    loadAndRender();
  }

  // ---------------------------------------------------------------------------
  // Compare-specific multi-store picker
  // ---------------------------------------------------------------------------

  function showCompareStorePicker() {
    // Remove existing picker if any
    var existing = document.querySelector('.compare-picker');
    if (existing) existing.remove();

    // Build the picker
    var overlay = document.createElement('div');
    overlay.className = 'compare-picker';

    var backdrop = document.createElement('div');
    backdrop.className = 'compare-picker-backdrop';
    overlay.appendChild(backdrop);

    var panel = document.createElement('div');
    panel.className = 'compare-picker-panel';

    // Header
    var header = document.createElement('div');
    header.className = 'compare-picker-header';
    header.innerHTML = '<h3>Select stores to compare</h3>';
    var closeBtn = document.createElement('button');
    closeBtn.className = 'compare-picker-close';
    closeBtn.setAttribute('type', 'button');
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = '&times;';
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Status line showing count
    var statusLine = document.createElement('div');
    statusLine.className = 'compare-picker-status';
    statusLine.textContent = _stores.length + ' of ' + MAX_COMPARE_STORES + ' stores selected (min ' + MIN_COMPARE_STORES + ')';
    panel.appendChild(statusLine);

    // Search input
    var search = document.createElement('input');
    search.className = 'compare-picker-search';
    search.setAttribute('type', 'text');
    search.setAttribute('placeholder', 'Search stores...');
    panel.appendChild(search);

    // Store list
    var list = document.createElement('ul');
    list.className = 'compare-picker-list';

    var currentSlugs = _stores.slice();
    var stores = _allStoresArr.length > 0 ? _allStoresArr : [];

    for (var i = 0; i < stores.length; i++) {
      var s = stores[i];
      var li = document.createElement('li');
      li.className = 'compare-picker-item';
      li.setAttribute('data-slug', s.slug);
      li.setAttribute('data-name', s.name || '');
      li.setAttribute('data-city', s.city || '');
      li.setAttribute('data-state', s.state || '');
      li.setAttribute('data-address', s.address || '');

      var isChecked = currentSlugs.indexOf(s.slug) !== -1;

      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'compare-picker-checkbox';
      checkbox.checked = isChecked;
      checkbox.setAttribute('data-slug', s.slug);

      var label = document.createElement('span');
      label.className = 'compare-picker-label';
      var labelText = '';
      if (s.address) {
        labelText += '<span class="store-picker-address-primary">' + escapeHtml(s.address) + '</span>';
      }
      labelText += '<span class="store-picker-city">' + escapeHtml(s.name) + '</span>';
      label.innerHTML = labelText;

      li.appendChild(checkbox);
      li.appendChild(label);
      list.appendChild(li);
    }

    panel.appendChild(list);

    // Done button
    var footer = document.createElement('div');
    footer.className = 'compare-picker-footer';
    var doneBtn = document.createElement('button');
    doneBtn.className = 'btn-primary compare-picker-done';
    doneBtn.setAttribute('type', 'button');
    doneBtn.textContent = 'Compare stores';
    footer.appendChild(doneBtn);
    panel.appendChild(footer);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // Track selected slugs
    var selected = currentSlugs.slice();

    function updatePickerState() {
      statusLine.textContent = selected.length + ' of ' + MAX_COMPARE_STORES + ' stores selected (min ' + MIN_COMPARE_STORES + ')';
      doneBtn.disabled = selected.length < MIN_COMPARE_STORES;

      // Disable unchecked checkboxes if at max
      var boxes = list.querySelectorAll('.compare-picker-checkbox');
      for (var bi = 0; bi < boxes.length; bi++) {
        if (!boxes[bi].checked) {
          boxes[bi].disabled = selected.length >= MAX_COMPARE_STORES;
        }
      }
    }

    // Wire checkbox changes via list delegation
    list.addEventListener('click', function (e) {
      var item = e.target.closest('.compare-picker-item');
      if (!item) return;
      var cb = item.querySelector('.compare-picker-checkbox');
      if (!cb) return;

      // If the click was directly on the checkbox, it already toggled
      if (e.target !== cb) {
        if (cb.disabled) return;
        cb.checked = !cb.checked;
      }

      var slug = cb.getAttribute('data-slug');
      if (cb.checked) {
        if (selected.length < MAX_COMPARE_STORES && selected.indexOf(slug) === -1) {
          selected.push(slug);
        } else if (selected.length >= MAX_COMPARE_STORES) {
          cb.checked = false;
          return;
        }
      } else {
        var idx = selected.indexOf(slug);
        if (idx !== -1) selected.splice(idx, 1);
      }
      updatePickerState();
    });

    // Search filtering
    search.addEventListener('input', function () {
      var query = (search.value || '').toLowerCase();
      var items = list.querySelectorAll('.compare-picker-item');
      for (var si = 0; si < items.length; si++) {
        var item = items[si];
        if (!query) {
          item.classList.remove('hidden');
          continue;
        }
        var name = (item.getAttribute('data-name') || '').toLowerCase();
        var city = (item.getAttribute('data-city') || '').toLowerCase();
        var state = (item.getAttribute('data-state') || '').toLowerCase();
        var address = (item.getAttribute('data-address') || '').toLowerCase();
        var match = name.indexOf(query) !== -1
          || city.indexOf(query) !== -1
          || state.indexOf(query) !== -1
          || address.indexOf(query) !== -1;
        item.classList.toggle('hidden', !match);
      }
    });

    // Done button
    doneBtn.addEventListener('click', function () {
      if (selected.length >= MIN_COMPARE_STORES) {
        saveStoreSlugs(selected);
        hideCompareStorePicker();
        loadAndRender();
      }
    });

    // Close button and backdrop
    closeBtn.addEventListener('click', function () { hideCompareStorePicker(); });
    backdrop.addEventListener('click', function () { hideCompareStorePicker(); });

    // Focus search
    search.focus();

    // Initial state
    updatePickerState();
  }

  function hideCompareStorePicker() {
    var picker = document.querySelector('.compare-picker');
    if (picker) picker.remove();
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
      dayCard.className = 'card card--compare-day compare-day-card';

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
        var storeName = store
          ? (typeof CustardPlanner.getDisplayName === 'function'
            ? CustardPlanner.getDisplayName(store, _allStoresArr)
            : store.city)
          : slug;

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

      // Add-more hint for single-store view
      if (_stores.length === 1) {
        var hint = document.createElement('div');
        hint.className = 'card compare-add-hint';
        hint.innerHTML = '<span class="compare-add-hint-text">Add another store to compare flavors side by side</span>'
          + '<br><button type="button" class="btn-text">+ Add store</button>';
        hint.querySelector('.btn-text').addEventListener('click', function () {
          if (!_manifestLoaded) {
            loadStores().then(function () { showCompareStorePicker(); });
          } else {
            showCompareStorePicker();
          }
        });
        dayCard.appendChild(hint);
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
    // Show store bar only in grid state (hide when empty/loading/error)
    if (compareStoreBar) compareStoreBar.hidden = (stateName !== 'grid');
    // Hide geo loading label when leaving loading state
    if (compareLoadingLabel && stateName !== 'loading') compareLoadingLabel.hidden = true;
  }

  // ---------------------------------------------------------------------------
  // Geo-aware auto-populate (COMP-01, COMP-03)
  // ---------------------------------------------------------------------------

  var COMPARE_GEO_TIMEOUT = 3000;

  function doCompareGeolocation() {
    // Show loading skeleton with geo label
    showState('loading');
    if (compareLoadingLabel) compareLoadingLabel.hidden = false;

    var geoURL = (typeof CustardPlanner !== 'undefined' && CustardPlanner.WORKER_BASE)
      ? CustardPlanner.WORKER_BASE + '/api/v1/geolocate'
      : 'https://custard.chriskaschner.com/api/v1/geolocate';

    // Race geo against timeout
    var geoPromise = fetch(geoURL)
      .then(function (resp) {
        if (!resp.ok) throw new Error('Geo failed');
        return resp.json();
      });

    var timeoutPromise = new Promise(function (_, reject) {
      setTimeout(function () { reject(new Error('Geo timeout')); }, COMPARE_GEO_TIMEOUT);
    });

    Promise.race([geoPromise, timeoutPromise])
      .then(function (geo) {
        if (!geo || geo.lat == null || geo.lon == null) throw new Error('No coordinates');

        // Wait for store manifest then find nearest
        var manifestP = (typeof SharedNav !== 'undefined' && SharedNav.manifestPromise)
          ? SharedNav.manifestPromise
          : loadStores().then(function () { return _allStoresArr; });

        return manifestP.then(function (stores) {
          var nearest = null;
          if (typeof SharedNav !== 'undefined' && SharedNav.findNearestStore) {
            nearest = SharedNav.findNearestStore(geo.lat, geo.lon, stores);
          } else {
            // Fallback: simple haversine search
            var haversine = (typeof CustardPlanner !== 'undefined' && CustardPlanner.haversineMiles)
              ? CustardPlanner.haversineMiles : null;
            if (haversine && stores) {
              var bestDist = Infinity;
              for (var i = 0; i < stores.length; i++) {
                var s = stores[i];
                if (s.lat == null || s.lng == null) continue;
                var dist = haversine(geo.lat, geo.lon, s.lat, s.lng);
                if (dist < bestDist) { bestDist = dist; nearest = s; }
              }
            }
          }
          return nearest;
        });
      })
      .then(function (nearest) {
        if (!nearest || !nearest.slug) {
          showState('empty');
          return;
        }

        // Seed 1 store
        saveStoreSlugs([nearest.slug]);

        // Set custard-primary for cross-page benefit
        if (typeof CustardPlanner !== 'undefined' && CustardPlanner.setPrimaryStoreSlug) {
          CustardPlanner.setPrimaryStoreSlug(nearest.slug);
        }

        // Hide loading label
        if (compareLoadingLabel) compareLoadingLabel.hidden = true;

        // Now load and render with the seeded store
        loadAndRender();
      })
      .catch(function () {
        // Geo failed or timed out -- show empty state with add-store CTA
        if (compareLoadingLabel) compareLoadingLabel.hidden = true;
        showState('empty');
      });
  }

  // ---------------------------------------------------------------------------
  // Main load flow
  // ---------------------------------------------------------------------------

  function loadAndRender() {
    _stores = getSavedStoreSlugs();

    if (_stores.length === 0) {
      // First-time visitor: attempt geo-aware auto-populate
      // _geoAttempted flag prevents infinite loops
      if (!_geoAttempted) {
        _geoAttempted = true;
        doCompareGeolocation();
        return;
      }
      showState('empty');
      // Remove stale store bar and filter bar
      if (compareStoreBar) compareStoreBar.innerHTML = '';
      var existingFilter = document.querySelector('.compare-filter-bar');
      if (existingFilter) existingFilter.parentNode.removeChild(existingFilter);
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
      renderStoreBar();
      renderGrid();
      renderFilterChips();
      applyExclusions();
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
        // Load the manifest first if we haven't yet, then show picker
        if (!_manifestLoaded) {
          loadStores().then(function () {
            showCompareStorePicker();
          });
        } else {
          showCompareStorePicker();
        }
      });
    }

    if (compareRetryBtn) {
      compareRetryBtn.addEventListener('click', function () {
        loadAndRender();
      });
    }

    // Listen for SharedNav store changes -- when user picks a store via the
    // header "change" button, add it to comparison instead of replacing
    document.addEventListener('sharednav:storechange', function (e) {
      var detail = e && e.detail;
      var newSlug = detail && detail.slug;
      if (newSlug && _stores.indexOf(newSlug) === -1) {
        // Add the newly selected store to the compare list
        var updated = _stores.slice();
        if (updated.length >= MAX_COMPARE_STORES) {
          // Replace last store if at max
          updated[updated.length - 1] = newSlug;
        } else {
          updated.push(newSlug);
        }
        saveStoreSlugs(updated);
      }
      loadAndRender();
    });

    // Override SharedNav's header "change" button to open Compare picker (COMP-02)
    function overrideChangeButton() {
      var changeBtn = document.querySelector('.store-indicator .btn-text');
      if (changeBtn) {
        // Clone and replace to remove SharedNav's click handler
        var newBtn = changeBtn.cloneNode(true);
        changeBtn.parentNode.replaceChild(newBtn, changeBtn);
        newBtn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          if (!_manifestLoaded) {
            loadStores().then(function () { showCompareStorePicker(); });
          } else {
            showCompareStorePicker();
          }
        });
      }
    }

    // Run override after SharedNav renders (it renders on DOMContentLoaded too)
    // Use a short delay to ensure SharedNav has finished binding
    setTimeout(overrideChangeButton, 100);
    // Also re-override when store indicator updates
    document.addEventListener('sharednav:storechange', function () {
      setTimeout(overrideChangeButton, 50);
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

  return { init: init, showStorePicker: showCompareStorePicker };
})();
