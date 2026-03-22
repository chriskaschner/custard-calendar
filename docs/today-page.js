/**
 * CustardToday -- today page logic for the simplified flavor hero view.
 *
 * Extracted from inline JS in index.html. Handles hero card rendering
 * with action CTAs and meta footer, rarity badges, week-ahead strip,
 * and the updates CTA.
 *
 * Usage: <script src="today-page.js"></script> (after planner-shared.js, shared-nav.js, cone-renderer.js)
 * Exposes: window.CustardToday (var, no build step required)
 */
var CustardToday = (function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Shared references (from planner-shared.js and cone-renderer.js)
  // ---------------------------------------------------------------------------

  var WORKER_BASE = CustardPlanner.WORKER_BASE;
  var BRAND_COLORS = CustardPlanner.BRAND_COLORS;
  var BRAND_DISPLAY = CustardPlanner.BRAND_DISPLAY;
  var brandFromSlug = CustardPlanner.brandFromSlug;
  var escapeHtml = CustardPlanner.escapeHtml;
  var haversine = CustardPlanner.haversineMiles;
  var certaintyStripClass = CustardPlanner.confidenceStripClass;

  // ---------------------------------------------------------------------------
  // Private state
  // ---------------------------------------------------------------------------

  var _currentSlug = null;
  var _allStores = [];
  var _userLat = null;
  var _userLng = null;
  var _heroCacheRendered = false;

  // ---------------------------------------------------------------------------
  // DOM refs
  // ---------------------------------------------------------------------------

  var emptyState = null;
  var todayLoading = null;
  var errorState = null;
  var errorMessage = null;
  var retryBtn = null;
  var todaySection = null;
  var todayCard = null;
  var todayFlavor = null;
  var todayCone = null;
  var todayDesc = null;
  var todayRarity = null;
  var todayCtas = null;
  var todayMeta = null;
  var weekSection = null;
  var weekStrip = null;
  var findStoreBtn = null;
  var updatesCta = null;

  function cacheDomRefs() {
    emptyState = document.getElementById('empty-state');
    todayLoading = document.getElementById('today-loading');
    errorState = document.getElementById('error-state');
    errorMessage = document.getElementById('error-message');
    retryBtn = document.getElementById('retry-btn');
    todaySection = document.getElementById('today-section');
    todayCard = document.getElementById('today-card');
    todayFlavor = document.getElementById('today-flavor');
    todayCone = document.getElementById('today-cone');
    todayDesc = document.getElementById('today-desc');
    todayRarity = document.getElementById('today-rarity');
    todayCtas = document.getElementById('today-ctas');
    todayMeta = document.getElementById('today-meta');
    weekSection = document.getElementById('week-section');
    weekStrip = document.getElementById('week-strip');
    findStoreBtn = document.getElementById('find-store-btn');
    updatesCta = document.getElementById('updates-cta');
  }

  // ---------------------------------------------------------------------------
  // Utility functions
  // ---------------------------------------------------------------------------

  function toISODate(d) {
    return d.toISOString().slice(0, 10);
  }

  function addDays(d, n) {
    var r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }

  function timeSince(isoStr) {
    if (!isoStr) return '';
    var diff = Date.now() - new Date(isoStr).getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' min ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + ' hr ago';
    var days = Math.floor(hrs / 24);
    return days + 'd ago';
  }

  // ---------------------------------------------------------------------------
  // Hero cache (localStorage) -- instant render for returning users
  // ---------------------------------------------------------------------------

  function cacheHeroData(slug, day, fetchedAt) {
    try {
      localStorage.setItem('custard-hero-cache', JSON.stringify({
        slug: slug,
        flavor: day.flavor || '',
        description: day.description || '',
        date: day.date,
        type: day.type,
        fetchedAt: fetchedAt,
        ts: Date.now()
      }));
    } catch (e) {}
  }

  function readHeroCache(slug) {
    try {
      var raw = localStorage.getItem('custard-hero-cache');
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || data.slug !== slug) return null;
      var today = new Date();
      today.setHours(12, 0, 0, 0);
      var todayStr = today.toISOString().slice(0, 10);
      if (data.date !== todayStr) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Store loading
  // ---------------------------------------------------------------------------

  function loadStores() {
    return fetch('stores.json')
      .then(function (resp) { return resp.json(); })
      .then(function (data) { _allStores = data.stores || []; })
      .catch(function (err) { console.error('Failed to load stores:', err); });
  }

  // ---------------------------------------------------------------------------
  // Near me now (empty state geo cards)
  // ---------------------------------------------------------------------------

  function loadNearMe(lat, lng) {
    var section = document.getElementById('near-me-section');
    var container = document.getElementById('near-me-cards');
    if (!section || !container) return;

    fetch(WORKER_BASE + '/api/v1/nearby-flavors?location=' + lat + ',' + lng + '&limit=5')
      .then(function (resp) {
        if (!resp.ok) return null;
        return resp.json();
      })
      .then(function (data) {
        if (!data) return;
        var stores = (data.nearby || []).slice(0, 5);
        if (stores.length === 0) return;

        container.innerHTML = '';
        for (var i = 0; i < stores.length; i++) {
          var store = stores[i];
          var card = document.createElement('div');
          card.className = 'card near-me-card';
          card.dataset.slug = store.slug;
          card.dataset.name = store.name;

          var dist = haversine(lat, lng, store.lat, store.lon);
          var coneSvg = (typeof renderMiniConeSVG === 'function') ? renderMiniConeSVG(store.flavor, 5) : '';
          var storeDisplayName = (typeof CustardPlanner.getDisplayName === 'function' && _allStores.length > 0)
            ? CustardPlanner.getDisplayName(
                _allStores.find(function (s) { return s.slug === store.slug; }) || store,
                _allStores
              )
            : (store.name || store.city || store.slug || '');

          card.innerHTML = coneSvg +
            '<div class="near-me-card-text">' +
              '<div class="near-me-card-flavor">' + escapeHtml(store.flavor || 'No flavor listed') + '</div>' +
              '<div class="near-me-card-store">' + escapeHtml(storeDisplayName) + '</div>' +
            '</div>' +
            '<div class="near-me-card-dist">' + dist.toFixed(1) + ' mi</div>';

          card.addEventListener('click', (function (storeSlug, storeName) {
            return function () {
              var match = _allStores.find(function (s) { return s.slug === storeSlug; });
              if (match) {
                selectStore(match.slug);
              }
            };
          })(store.slug, store.name));

          container.appendChild(card);
        }

        section.hidden = false;
      })
      .catch(function (e) { console.debug('Near me failed:', e); });
  }

  // ---------------------------------------------------------------------------
  // Forecast loading
  // ---------------------------------------------------------------------------

  function loadForecast(slug) {
    // If hero was rendered from cache, keep it visible during background refresh
    // instead of flashing the loading skeleton
    if (!_heroCacheRendered) {
      todaySection.hidden = true;
      todayLoading.hidden = false;
    }
    if (weekSection) weekSection.hidden = true;
    errorState.hidden = true;
    if (updatesCta) updatesCta.hidden = true;

    Promise.all([
      fetch(WORKER_BASE + '/api/v1/flavors?slug=' + encodeURIComponent(slug))
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; }),
      fetch(WORKER_BASE + '/api/v1/forecast/' + encodeURIComponent(slug))
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; }),
      fetch(WORKER_BASE + '/api/v1/today?slug=' + encodeURIComponent(slug))
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; }),
    ]).then(function (results) {
      var flavorsData = results[0];
      var forecastData = results[1];
      var todayData = results[2];

      var confirmedFlavors = [];
      var fetchedAt = null;
      if (flavorsData) {
        confirmedFlavors = (flavorsData.flavors || []).map(function (f) {
          return { date: f.date, title: f.title, description: f.description || '' };
        });
        fetchedAt = flavorsData.fetched_at || null;
      }

      var today = new Date();
      today.setHours(12, 0, 0, 0);
      var timeline = CustardPlanner.buildTimeline(confirmedFlavors, forecastData, today, { maxPredictions: 3 });

      todayLoading.hidden = true;

      if (timeline.length > 0) {
        renderHeroCard(timeline[0], slug, fetchedAt, forecastData, todayData);
        renderWeekStrip(timeline.slice(1), fetchedAt);
        // Write cache for instant render on next visit (confirmed flavors only)
        if (timeline[0].type === 'confirmed') {
          cacheHeroData(slug, timeline[0], fetchedAt);
        }
        _heroCacheRendered = false;
      } else if (!_heroCacheRendered) {
        // Only show "no data" if we don't already have a cached render visible
        renderHeroCard({ date: toISODate(today), type: 'none' }, slug, fetchedAt, forecastData, todayData);
      }

      // Show CTA
      if (updatesCta) updatesCta.hidden = false;
    }).catch(function (err) {
      console.error('Forecast load error:', err);
      todayLoading.hidden = true;
      // If hero was rendered from cache, keep it visible instead of showing error
      if (!_heroCacheRendered) {
        if (errorMessage) errorMessage.textContent = 'Something went wrong loading the flavor data.';
        errorState.hidden = false;
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Rarity badge rendering
  // ---------------------------------------------------------------------------

  function renderRarity(rarity, flavorName) {
    if (!todayRarity) return;
    if (!rarity) {
      todayRarity.hidden = true;
      return;
    }
    var isSeasonal = CustardPlanner.isSeasonalFlavor(flavorName);
    var html = '';
    if (rarity.label) {
      var cssClass = 'rarity-badge rarity-badge-' + rarity.label.toLowerCase().replace(/\s+/g, '-');
      html += '<span class="' + cssClass + '">' + escapeHtml(rarity.label) + '</span>';
      if (rarity.avg_gap_days && !isSeasonal) {
        html += 'Shows up roughly every ' + rarity.avg_gap_days + ' days at your store';
      }
    }
    if (html) {
      todayRarity.innerHTML = html;
      todayRarity.hidden = false;
    } else {
      todayRarity.hidden = true;
    }
  }

  // ---------------------------------------------------------------------------
  // Hero card rendering
  // ---------------------------------------------------------------------------

  function renderHeroCard(day, slug, fetchedAt, forecast, todayData) {
    var store = _allStores.find(function (s) { return s.slug === slug; });
    var brand = brandFromSlug(slug);
    var color = BRAND_COLORS[brand] || '#005696';

    // Reset state classes
    todayCard.classList.remove('day-card-confirmed', 'day-card-estimated', 'day-card-none');
    todayCard.style.borderLeftColor = '';
    todayFlavor.classList.remove('text-estimated');
    todayFlavor.style.color = '';

    if (day.type === 'confirmed') {
      todayCard.classList.add('day-card-confirmed');
      todayCard.style.borderLeftColor = color;
      // Use hero cone PNG with L0 SVG fallback
      renderHeroCone(day.flavor, todayCone, 6);
      todayCone.hidden = false;
      todayFlavor.textContent = day.flavor;
      todayDesc.textContent = day.description || '';
      todayDesc.hidden = !day.description;
      renderRarity(todayData && todayData.rarity, day.flavor);
    } else if (day.type === 'predicted') {
      todayCard.classList.add('day-card-estimated');
      renderHeroCone(day.flavor, todayCone, 6);
      todayCone.hidden = false;
      todayFlavor.textContent = day.flavor;
      todayDesc.textContent = '';
      todayDesc.hidden = true;
      renderRarity(null, null);
    } else {
      todayCard.classList.add('day-card-none');
      todayCone.innerHTML = '';
      todayCone.hidden = true;
      todayFlavor.textContent = 'No data yet';
      todayFlavor.classList.add('text-estimated');
      todayDesc.textContent = 'Check back later \u2014 flavor data updates throughout the day.';
      todayDesc.hidden = false;
      renderRarity(null, null);
      if (todayCtas) todayCtas.innerHTML = '';
    }

    // Wire action CTAs (confirmed and predicted only)
    if (todayCtas && day.type !== 'none') {
      if (store) {
        todayCtas.innerHTML = CustardPlanner.actionCTAsHTML({
          actions: ['directions', 'alert', 'calendar'],
          lat: store.lat,
          lon: store.lon || store.lng,
          storeName: store.name || (store.city + ', ' + store.state),
          slug: slug,
          workerBase: WORKER_BASE
        });
      } else {
        todayCtas.innerHTML = CustardPlanner.actionCTAsHTML({
          actions: ['alert', 'calendar'],
          slug: slug,
          workerBase: WORKER_BASE
        });
      }
    }

    // Render meta footer: freshness timestamp only (store name lives in header)
    if (todayMeta) {
      var freshness = fetchedAt ? timeSince(fetchedAt) : '';
      if (freshness) {
        todayMeta.innerHTML = '<span class="freshness-ts">Updated ' + escapeHtml(freshness) + '</span>';
        todayMeta.hidden = false;
      } else {
        todayMeta.hidden = true;
      }
    }

    // Fade-in transition
    todayCard.classList.add('today-card-enter');

    todaySection.hidden = false;
  }

  // ---------------------------------------------------------------------------
  // Week strip rendering
  // ---------------------------------------------------------------------------

  function formatDateLabel(dateStr) {
    var today = new Date();
    today.setHours(12, 0, 0, 0);
    var todayStr = toISODate(today);
    var tomorrowStr = toISODate(addDays(today, 1));
    if (dateStr === todayStr) return 'Today';
    if (dateStr === tomorrowStr) return 'Tmrw';
    var d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  }

  function renderWeekStrip(days, fetchedAt) {
    if (!weekStrip || !weekSection) return;
    weekStrip.innerHTML = '';
    var today = new Date();
    today.setHours(12, 0, 0, 0);

    var hasAnyData = false;

    for (var i = 0; i < days.length; i++) {
      var day = days[i];
      var d = new Date(day.date + 'T12:00:00');
      var dayName = formatDateLabel(day.date);
      var dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      var card = document.createElement('div');

      if (day.type === 'confirmed') {
        hasAnyData = true;
        card.className = 'card card--accent-sm week-day-card';
        card.innerHTML =
          '<div class="' + certaintyStripClass(day) + '"></div>'
          + '<div class="week-day-header"><span class="week-day-name">' + escapeHtml(dayName) + '</span>'
          + '<span class="week-day-date">' + escapeHtml(dateLabel) + '</span></div>'
          + '<div class="week-day-cone cone-sm"></div>'
          + '<div class="week-day-flavor">' + escapeHtml(day.flavor) + '</div>';
      } else if (day.type === 'predicted') {
        hasAnyData = true;
        card.className = 'card card--accent-sm week-day-card week-day-card-estimated';
        card.innerHTML =
          '<div class="' + certaintyStripClass(day) + '"></div>'
          + '<div class="week-day-header"><span class="week-day-name">' + escapeHtml(dayName) + '</span>'
          + '<span class="week-day-date">' + escapeHtml(dateLabel) + '</span></div>'
          + '<div class="week-day-cone cone-sm"></div>'
          + '<div class="week-day-flavor">' + escapeHtml(day.flavor) + '</div>';
      } else {
        card.className = 'card card--accent-sm week-day-card week-day-card-none';
        card.innerHTML =
          '<div class="' + certaintyStripClass(day) + '"></div>'
          + '<div class="week-day-header"><span class="week-day-name">' + escapeHtml(dayName) + '</span>'
          + '<span class="week-day-date">' + escapeHtml(dateLabel) + '</span></div>'
          + '<div class="week-day-flavor text-estimated">No data</div>';
      }

      weekStrip.appendChild(card);

      // Render hero cone PNG (L5) into the .week-day-cone placeholder; falls back
      // to L0 SVG via renderHeroCone's onerror handler when PNG is unavailable.
      if (day.flavor && typeof renderHeroCone === 'function') {
        var coneEl = card.querySelector('.week-day-cone');
        if (coneEl) renderHeroCone(day.flavor, coneEl, 3);
      }
    }

    if (hasAnyData || !days.every(function (d) { return d.type === 'none'; })) {
      weekSection.hidden = false;
    } else {
      weekSection.hidden = true;
    }
  }

  // ---------------------------------------------------------------------------
  // Store selection
  // ---------------------------------------------------------------------------

  function selectStore(slug) {
    if (errorState) errorState.hidden = true;
    var store = _allStores.find(function (s) { return s.slug === slug; });
    if (!store) {
      // Still attempt forecast load -- slug may be valid even if not in local manifest
      loadForecast(slug);
      _currentSlug = slug;
      return;
    }
    _currentSlug = slug;

    if (CustardPlanner && typeof CustardPlanner.emitInteractionEvent === 'function') {
      CustardPlanner.emitInteractionEvent({
        event_type: 'store_select',
        page: 'index',
        action: 'store_select',
        store_slug: slug,
      });
    }

    // Save to localStorage
    try { localStorage.setItem('custard-primary', slug); } catch (e) {}

    // Hide empty state, load forecast
    if (emptyState) emptyState.hidden = true;

    loadForecast(slug);
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  function bindEvents() {
    if (findStoreBtn) {
      findStoreBtn.addEventListener('click', function () {
        if (typeof SharedNav !== 'undefined' && SharedNav.showStorePicker) {
          SharedNav.showStorePicker();
        }
      });
    }

    if (retryBtn) {
      retryBtn.addEventListener('click', function () {
        if (_currentSlug) {
          errorState.hidden = true;
          loadForecast(_currentSlug);
        }
      });
    }

    // Listen for SharedNav store changes
    document.addEventListener('sharednav:storechange', function (e) {
      var slug = e.detail && e.detail.slug;
      if (slug && slug !== _currentSlug) {
        selectStore(slug);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  function init() {
    cacheDomRefs();
    bindEvents();

    // Synchronous localStorage check -- determine initial DOM state
    // BEFORE any async work to prevent onboarding banner flash
    var savedSlug = null;
    try { savedSlug = localStorage.getItem('custard-primary'); } catch (e) {}

    if (savedSlug) {
      var heroCache = readHeroCache(savedSlug);
      if (heroCache) {
        // Instant render from cache -- skip skeleton entirely
        _heroCacheRendered = true;
        if (emptyState) emptyState.hidden = true;
        if (todayLoading) todayLoading.hidden = true;
        if (todaySection) todaySection.hidden = false;
        if (todayFlavor) todayFlavor.textContent = heroCache.flavor;
        if (todayDesc) {
          todayDesc.textContent = heroCache.description || '';
          todayDesc.hidden = !heroCache.description;
        }
        if (todayCard) {
          todayCard.classList.remove('day-card-confirmed', 'day-card-estimated', 'day-card-none');
          todayCard.classList.add('day-card-confirmed');
        }
        if (todayCone && typeof renderHeroCone === 'function') {
          renderHeroCone(heroCache.flavor, todayCone, 6);
          todayCone.hidden = false;
        }
        if (todayMeta) {
          var freshness = heroCache.fetchedAt ? timeSince(heroCache.fetchedAt) : '';
          todayMeta.innerHTML =
            '<span class="today-store">' + escapeHtml(savedSlug) + '</span>' +
            (freshness ? '<span class="freshness-ts">Updated ' + escapeHtml(freshness) + '</span>' : '');
        }
        if (todayRarity) todayRarity.hidden = true;
        if (todayCtas) todayCtas.innerHTML = '';
        if (weekSection) weekSection.hidden = true;
        if (updatesCta) updatesCta.hidden = true;
      } else {
        // No valid cache -- show skeleton as before
        if (emptyState) emptyState.hidden = true;
        if (todayLoading) todayLoading.hidden = false;
        if (todaySection) todaySection.hidden = true;
        if (weekSection) weekSection.hidden = true;
        if (updatesCta) updatesCta.hidden = true;
      }
    }
    // If no savedSlug, leave DOM as-is (empty-state starts visible in HTML,
    // will be confirmed below after manifest loads)

    Promise.all([loadStores(), loadFlavorColors()]).then(function () {
      if (savedSlug) {
        var storeExists = _allStores.find(function (s) { return s.slug === savedSlug; });
        if (storeExists && _currentSlug !== savedSlug) {
          selectStore(savedSlug);
        } else if (!storeExists) {
          // Invalid slug -- clear it and show onboarding
          try { localStorage.removeItem('custard-primary'); } catch (e) {}
          if (todayLoading) todayLoading.hidden = true;
          if (emptyState) emptyState.hidden = false;
          if (todaySection) todaySection.hidden = true;
          if (weekSection) weekSection.hidden = true;
          if (updatesCta) updatesCta.hidden = true;
        }
      } else if (!_currentSlug) {
        if (emptyState) emptyState.hidden = false;
        todaySection.hidden = true;
        if (weekSection) weekSection.hidden = true;
        if (updatesCta) updatesCta.hidden = true;
      }
    });

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

  return {
    init: init,
    selectStore: selectStore,
  };
})();
