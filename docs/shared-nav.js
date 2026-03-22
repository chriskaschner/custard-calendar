/**
 * SharedNav -- shared navigation bar and store indicator for all pages.
 * Renders nav links + store indicator into a #shared-nav placeholder.
 *
 * Depends on: planner-shared.js (CustardPlanner global)
 *
 * Usage: <div id="shared-nav"></div>
 *        <script src="planner-shared.js"></script>
 *        <script src="shared-nav.js"></script>
 *
 * Exposes: window.SharedNav (var, ES5-compatible IIFE)
 */
var SharedNav = (function () {
  'use strict';

  // -------------------------------------------------------------------------
  // Constants
  // -------------------------------------------------------------------------

  var NAV_CONTAINER_ID = 'shared-nav';
  var MANIFEST_CACHE_KEY = 'custard:store-manifest';

  var NAV_ITEMS = [
    { href: 'index.html', label: 'Today' },
    { href: 'compare.html', label: 'Compare' },
    { href: 'map.html', label: 'Map' },
    { href: 'fun.html', label: 'Fun' }
  ];

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  var _container = null;
  var _stores = null;
  var _manifestPromiseResolve = null;
  var _manifestPromise = new Promise(function (resolve) {
    _manifestPromiseResolve = resolve;
  });

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  function getCurrentPage() {
    var path = window.location.pathname;
    var file = path.substring(path.lastIndexOf('/') + 1) || 'index.html';
    return file;
  }

  function slugToTitle(slug) {
    if (!slug) return '';
    return slug.replace(/-/g, ' ').replace(/\b\w/g, function (c) {
      return c.toUpperCase();
    });
  }

  function escapeHtml(str) {
    if (typeof CustardPlanner !== 'undefined' && CustardPlanner.escapeHtml) {
      return CustardPlanner.escapeHtml(str);
    }
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // -------------------------------------------------------------------------
  // Store manifest loading
  // -------------------------------------------------------------------------

  function loadStoreManifest() {
    // Check sessionStorage cache first
    try {
      var cached = sessionStorage.getItem(MANIFEST_CACHE_KEY);
      if (cached) {
        var parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          _stores = parsed;
          _manifestPromiseResolve(_stores);
          return;
        }
      }
    } catch (_) { /* ignore */ }

    // Fetch from stores.json (local) or Worker API
    var url = 'stores.json';
    fetch(url).then(function (resp) {
      if (!resp.ok) {
        // Try Worker API as fallback
        var workerBase = (typeof CustardPlanner !== 'undefined' && CustardPlanner.WORKER_BASE)
          ? CustardPlanner.WORKER_BASE
          : 'https://custard.chriskaschner.com';
        return fetch(workerBase + '/api/v1/stores');
      }
      return resp;
    }).then(function (resp) {
      if (!resp || !resp.ok) throw new Error('Failed to load stores');
      return resp.json();
    }).then(function (data) {
      // Handle both formats: { stores: [...] } and plain [...]
      var stores = Array.isArray(data) ? data : (data && data.stores ? data.stores : []);
      _stores = stores;
      // Cache in sessionStorage
      try {
        sessionStorage.setItem(MANIFEST_CACHE_KEY, JSON.stringify(stores));
      } catch (_) { /* storage full */ }
      _manifestPromiseResolve(_stores);
    }).catch(function (err) {
      console.debug('SharedNav: Failed to load store manifest:', err);
      _stores = [];
      _manifestPromiseResolve(_stores);
    });
  }

  // -------------------------------------------------------------------------
  // Store lookup
  // -------------------------------------------------------------------------

  function findStoreBySlug(slug) {
    if (!_stores || !slug) return null;
    for (var i = 0; i < _stores.length; i++) {
      if (_stores[i].slug === slug) return _stores[i];
    }
    return null;
  }

  function findNearestStore(lat, lon, stores) {
    if (!stores || stores.length === 0) return null;
    var haversine = (typeof CustardPlanner !== 'undefined' && CustardPlanner.haversineMiles)
      ? CustardPlanner.haversineMiles
      : null;
    if (!haversine) return stores[0]; // fallback to first store

    var best = null;
    var bestDist = Infinity;
    for (var i = 0; i < stores.length; i++) {
      var s = stores[i];
      if (s.lat == null || s.lng == null) continue;
      var dist = haversine(lat, lon, s.lat, s.lng);
      if (dist < bestDist) {
        bestDist = dist;
        best = s;
      }
    }
    return best;
  }

  // -------------------------------------------------------------------------
  // Nav rendering
  // -------------------------------------------------------------------------

  function buildNavLinksHTML() {
    var currentPage = getCurrentPage();
    var html = '<nav class="nav-links">';
    for (var i = 0; i < NAV_ITEMS.length; i++) {
      var item = NAV_ITEMS[i];
      var isActive = (item.href === currentPage);
      var cls = isActive ? ' class="nav-active"' : '';
      html += '<a href="' + item.href + '"' + cls + '>' + escapeHtml(item.label) + '</a>';
    }
    html += '</nav>';
    return html;
  }

  // -------------------------------------------------------------------------
  // Shared footer
  // -------------------------------------------------------------------------

  function buildFooterLinksHTML() {
    return '<div class="shared-footer-links">'
      + '<a href="updates.html" class="shared-footer-link shared-footer-link--brand">Get Updates</a>'
      + '<a href="https://github.com/chriskaschner/custard-calendar" class="shared-footer-link">GitHub</a>'
      + '<a href="privacy.html" class="shared-footer-link">Privacy</a>'
      + '</div>';
  }

  // -------------------------------------------------------------------------
  // Store indicator
  // -------------------------------------------------------------------------

  function buildStoreIndicatorHTML(store, slug) {
    if (!store && slug) {
      // Placeholder while manifest loads
      var placeholder = slugToTitle(slug);
      return '<div class="store-indicator">'
        + '<span class="store-name">' + escapeHtml(placeholder) + '</span>'
        + ' <button type="button" class="btn-text">change</button>'
        + '</div>';
    }
    if (!store) return '';
    var nameText = escapeHtml(store.name);
    var cityState = '';
    if (store.city && store.state) {
      var suffix = store.city + ', ' + store.state;
      // Only append city/state if name does not already contain it
      if (store.name.indexOf(suffix) === -1) {
        cityState = ', ' + escapeHtml(store.city) + ', ' + escapeHtml(store.state);
      }
    } else if (store.city) {
      if (store.name.indexOf(store.city) === -1) {
        cityState = ', ' + escapeHtml(store.city);
      }
    }
    return '<div class="store-indicator">'
      + '<span class="store-name">' + nameText + '<span class="store-city">' + cityState + '</span></span>'
      + ' <button type="button" class="btn-text">change</button>'
      + '</div>';
  }

  function updateStoreIndicator(store) {
    if (!_container) return;
    var existing = _container.querySelector('.store-indicator');
    var prompt = _container.querySelector('.first-visit-prompt');
    if (prompt) prompt.remove();

    var html = buildStoreIndicatorHTML(store, null);
    if (existing) {
      existing.outerHTML = html;
    } else {
      // Insert before nav
      var nav = _container.querySelector('nav.nav-links');
      if (nav) {
        nav.insertAdjacentHTML('beforebegin', html);
      }
    }
    // Re-bind change button
    var btn = _container.querySelector('.btn-text');
    if (btn) {
      btn.addEventListener('click', function () { showStorePicker(); });
    }

    // Dispatch custom event so page-specific code can react to store changes
    if (store && store.slug) {
      try {
        var event = new CustomEvent('sharednav:storechange', {
          detail: { slug: store.slug, store: store }
        });
        document.dispatchEvent(event);
      } catch (_) { /* IE fallback -- not needed for modern browsers */ }
    }
  }

  // -------------------------------------------------------------------------
  // First-visit prompt (STOR-01, STOR-02)
  // -------------------------------------------------------------------------

  function buildFirstVisitPromptHTML(store) {
    if (!store) return '';
    var nameText = escapeHtml(store.name);
    return '<div class="card first-visit-prompt">'
      + '<p>Showing flavors for <strong>' + nameText + '</strong></p>'
      + '<div class="first-visit-actions">'
      + '<button type="button" class="btn-primary btn--sm">Looks good</button>'
      + ' <button type="button" class="btn-text">change</button>'
      + '</div>'
      + '</div>';
  }

  function showFirstVisitPrompt(store) {
    if (!_container || !store) return;
    // Remove any existing prompt or indicator
    var existing = _container.querySelector('.first-visit-prompt');
    if (existing) existing.remove();
    var existingIndicator = _container.querySelector('.store-indicator');
    if (existingIndicator) existingIndicator.remove();

    var html = buildFirstVisitPromptHTML(store);
    var nav = _container.querySelector('nav.nav-links');
    if (nav) {
      nav.insertAdjacentHTML('beforebegin', html);
    } else {
      _container.insertAdjacentHTML('afterbegin', html);
    }

    // Bind confirm button
    var confirmBtn = _container.querySelector('.first-visit-prompt .btn-primary');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', function () {
        if (typeof CustardPlanner !== 'undefined' && CustardPlanner.setPrimaryStoreSlug) {
          CustardPlanner.setPrimaryStoreSlug(store.slug);
        }
        updateStoreIndicator(store);
      });
    }

    // Bind change button
    var changeBtn = _container.querySelector('.first-visit-prompt .btn-text');
    if (changeBtn) {
      changeBtn.addEventListener('click', function () { showStorePicker(); });
    }
  }

  // -------------------------------------------------------------------------
  // IP geolocation flow
  // -------------------------------------------------------------------------

  function getGeolocateURL() {
    var workerBase = (typeof CustardPlanner !== 'undefined' && CustardPlanner.WORKER_BASE)
      ? CustardPlanner.WORKER_BASE
      : 'https://custard.chriskaschner.com';
    return workerBase + '/api/v1/geolocate';
  }

  function doIPGeolocation() {
    fetch(getGeolocateURL())
      .then(function (resp) {
        if (!resp.ok) throw new Error('IP geolocation failed');
        return resp.json();
      })
      .then(function (geo) {
        if (!geo || geo.lat == null || geo.lon == null) throw new Error('No coordinates');
        _manifestPromise.then(function (stores) {
          var nearest = findNearestStore(geo.lat, geo.lon, stores);
          if (nearest) {
            showFirstVisitPrompt(nearest);
          } else {
            // No stores in manifest -- show a subtle prompt instead of full picker
            showFallbackPrompt();
          }
        });
      })
      .catch(function (err) {
        console.debug('SharedNav: IP geolocation failed, showing fallback prompt:', err);
        // Graceful fallback: show a subtle prompt, NOT the full picker overlay.
        // The picker should only appear when user explicitly taps "change".
        _manifestPromise.then(function () {
          showFallbackPrompt();
        });
      });
  }

  // Show a non-intrusive prompt when IP geolocation fails or no stores found.
  // This avoids showing the full-screen picker overlay on first visit.
  function showFallbackPrompt() {
    if (!_container) return;
    // Remove any existing prompt or indicator
    var existing = _container.querySelector('.first-visit-prompt');
    if (existing) existing.remove();
    var existingIndicator = _container.querySelector('.store-indicator');
    if (existingIndicator) existingIndicator.remove();

    var html = '<div class="card first-visit-prompt">'
      + '<p>Select a store to see today\'s flavor</p>'
      + '<div class="first-visit-actions">'
      + '<button type="button" class="btn-text">Find your store</button>'
      + '</div>'
      + '</div>';

    var nav = _container.querySelector('nav.nav-links');
    if (nav) {
      nav.insertAdjacentHTML('beforebegin', html);
    } else {
      _container.insertAdjacentHTML('afterbegin', html);
    }

    // Bind the find store button to open the picker
    var btn = _container.querySelector('.first-visit-prompt .btn-text');
    if (btn) {
      btn.addEventListener('click', function () { showStorePicker(); });
    }
  }

  // -------------------------------------------------------------------------
  // Store picker (STOR-04)
  // -------------------------------------------------------------------------

  function buildStorePickerHTML(stores) {
    var html = '<div class="store-picker" role="dialog" aria-label="Select a store">'
      + '<div class="store-picker-backdrop"></div>'
      + '<div class="store-picker-panel">'
      + '<div class="store-picker-header">'
      + '<h3>Select a store</h3>'
      + '<button type="button" class="store-picker-close" aria-label="Close">&times;</button>'
      + '</div>'
      + '<input type="text" class="store-picker-search" placeholder="Search stores..." />'
      + '<button type="button" class="store-picker-precise">Use precise location</button>'
      + '<ul class="store-picker-list">';

    if (stores) {
      for (var i = 0; i < stores.length; i++) {
        var s = stores[i];
        var label = '';
        if (s.address) {
          label += '<span class="store-picker-address-primary">' + escapeHtml(s.address) + '</span>';
        }
        label += '<span class="store-picker-city">' + escapeHtml(s.name) + '</span>';
        html += '<li class="store-picker-item" data-slug="' + escapeHtml(s.slug) + '"'
          + ' data-name="' + escapeHtml(s.name) + '"'
          + ' data-city="' + escapeHtml(s.city || '') + '"'
          + ' data-state="' + escapeHtml(s.state || '') + '"'
          + ' data-address="' + escapeHtml(s.address || '') + '"'
          + '>' + label + '</li>';
      }
    }

    html += '</ul></div></div>';
    return html;
  }

  function filterStoreList(searchText) {
    var items = _container.querySelectorAll('.store-picker-item');
    var lower = (searchText || '').toLowerCase();
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (!lower) {
        item.classList.remove('hidden');
        continue;
      }
      var name = (item.getAttribute('data-name') || '').toLowerCase();
      var city = (item.getAttribute('data-city') || '').toLowerCase();
      var state = (item.getAttribute('data-state') || '').toLowerCase();
      var address = (item.getAttribute('data-address') || '').toLowerCase();
      var match = name.indexOf(lower) !== -1
        || city.indexOf(lower) !== -1
        || state.indexOf(lower) !== -1
        || address.indexOf(lower) !== -1;
      item.classList.toggle('hidden', !match);
    }
  }

  function showStorePicker() {
    if (!_container) return;
    // Remove existing picker
    var existing = _container.querySelector('.store-picker');
    if (existing) existing.remove();

    _manifestPromise.then(function (stores) {
      var html = buildStorePickerHTML(stores);
      _container.insertAdjacentHTML('beforeend', html);

      var picker = _container.querySelector('.store-picker');
      if (!picker) return;

      // Search input filtering
      var searchInput = picker.querySelector('.store-picker-search');
      if (searchInput) {
        searchInput.addEventListener('input', function () {
          filterStoreList(searchInput.value);
        });
        // Focus the search input
        searchInput.focus();
      }

      // Store item selection
      var items = picker.querySelectorAll('.store-picker-item');
      for (var i = 0; i < items.length; i++) {
        items[i].addEventListener('click', function () {
          var slug = this.getAttribute('data-slug');
          if (typeof CustardPlanner !== 'undefined' && CustardPlanner.setPrimaryStoreSlug) {
            CustardPlanner.setPrimaryStoreSlug(slug);
          }
          var store = findStoreBySlug(slug);
          updateStoreIndicator(store);
          hideStorePicker();
        });
      }

      // Close button
      var closeBtn = picker.querySelector('.store-picker-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', function () { hideStorePicker(); });
      }

      // Backdrop click to close
      var backdrop = picker.querySelector('.store-picker-backdrop');
      if (backdrop) {
        backdrop.addEventListener('click', function () { hideStorePicker(); });
      }

      // Precise location button
      var preciseBtn = picker.querySelector('.store-picker-precise');
      if (preciseBtn) {
        preciseBtn.addEventListener('click', function () {
          refinePreciseLocation();
        });
      }
    });
  }

  function hideStorePicker() {
    if (!_container) return;
    var picker = _container.querySelector('.store-picker');
    if (picker) picker.remove();
  }

  // -------------------------------------------------------------------------
  // Browser geolocation refinement (explicit user action only)
  // -------------------------------------------------------------------------

  function refinePreciseLocation() {
    if (!navigator.geolocation) {
      console.debug('SharedNav: Browser geolocation not available');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        _manifestPromise.then(function (stores) {
          var nearest = findNearestStore(pos.coords.latitude, pos.coords.longitude, stores);
          if (nearest) {
            if (typeof CustardPlanner !== 'undefined' && CustardPlanner.setPrimaryStoreSlug) {
              CustardPlanner.setPrimaryStoreSlug(nearest.slug);
            }
            updateStoreIndicator(nearest);
            hideStorePicker();
          }
        });
      },
      function (err) {
        console.debug('SharedNav: Browser geolocation denied:', err);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
    );
  }

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------

  function renderNav(container) {
    _container = container;

    // Start loading the store manifest immediately
    loadStoreManifest();

    var slug = null;
    if (typeof CustardPlanner !== 'undefined' && CustardPlanner.getPrimaryStoreSlug) {
      slug = CustardPlanner.getPrimaryStoreSlug();
    }

    // Build initial HTML
    var indicatorHTML = '';
    if (slug) {
      // Show placeholder indicator immediately
      indicatorHTML = buildStoreIndicatorHTML(null, slug);
    }

    var navHTML = buildNavLinksHTML();
    container.innerHTML = indicatorHTML + navHTML;

    // Bind change button if indicator was rendered
    var changeBtn = container.querySelector('.btn-text');
    if (changeBtn) {
      changeBtn.addEventListener('click', function () { showStorePicker(); });
    }

    if (slug) {
      // Resolve real store data from manifest
      _manifestPromise.then(function (stores) {
        var store = findStoreBySlug(slug);
        if (store) {
          updateStoreIndicator(store);
        }
      });
    } else {
      // Compare page owns its own onboarding -- suppress SharedNav's first-visit flow
      var navPage = container.getAttribute('data-page');
      if (navPage !== 'compare') {
        // No saved store -- first-time visitor flow (STOR-01, STOR-02)
        doIPGeolocation();
      }
    }

    // Inject shared footer links into existing <footer> or create one
    if (!document.querySelector('.shared-footer-links')) {
      var existingFooter = document.querySelector('footer');
      if (existingFooter) {
        // Remove old brands/links that shared footer now replaces
        var oldBrands = existingFooter.querySelector('.footer-brands');
        if (oldBrands) oldBrands.remove();
        var oldLinks = existingFooter.querySelector('.footer-links');
        if (oldLinks) oldLinks.remove();
        existingFooter.insertAdjacentHTML('afterbegin', buildFooterLinksHTML());
      } else {
        document.body.insertAdjacentHTML('beforeend',
          '<footer class="shared-footer">'
          + buildFooterLinksHTML() + '</footer>');
      }
    }
  }

  // -------------------------------------------------------------------------
  // Auto-init on DOMContentLoaded
  // -------------------------------------------------------------------------

  document.addEventListener('DOMContentLoaded', function () {
    var el = document.getElementById(NAV_CONTAINER_ID);
    if (el) renderNav(el);
  });

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  return {
    renderNav: renderNav,
    showStorePicker: showStorePicker,
    updateStoreIndicator: updateStoreIndicator,
    findNearestStore: findNearestStore,
    manifestPromise: _manifestPromise
  };

})();
