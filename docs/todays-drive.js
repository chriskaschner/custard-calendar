/*
 * CustardDrive -- shared Today's Drive UI for index + scoop surfaces.
 * Requires planner-shared.js and stores.json loaded by the host page.
 */
var CustardDrive = (function () {
  'use strict';

  var EXCLUDE_CHIPS = [
    { tag: 'nuts', label: 'No Nuts' },
    { tag: 'cheesecake', label: 'No Cheesecake' },
  ];
  var BOOST_CHIPS = [
    { tag: 'chocolate', label: 'Chocolatey' },
    { tag: 'fruit', label: 'Fruity' },
    { tag: 'caramel', label: 'Caramel' },
    { tag: 'mint', label: 'Mint' },
    { tag: 'coffee', label: 'Coffee' },
    { tag: 'seasonal', label: 'Seasonal' },
    { tag: 'kids', label: 'Kids Will Eat' },
  ];
  var AVOID_CHIPS = [
    { tag: 'mint', label: 'Avoid Mint' },
    { tag: 'coffee', label: 'Avoid Coffee' },
  ];
  var SORT_MODES = [
    { value: 'match', label: 'Best Match' },
    { value: 'detour', label: 'Shortest Detour' },
    { value: 'rarity', label: 'Highest Rarity' },
    { value: 'eta', label: 'Closest ETA' },
  ];

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function escapeHtml(value) {
    if (!value) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function uniqueList(values) {
    var list = [];
    var seen = {};
    for (var i = 0; i < values.length; i++) {
      var value = values[i];
      if (value == null) continue;
      var clean = String(value).trim();
      if (!clean || seen[clean]) continue;
      seen[clean] = true;
      list.push(clean);
    }
    return list;
  }

  function canonicalTag(tag) {
    return String(tag || '').trim().toLowerCase();
  }

  function normalizeTags(tags) {
    var list = asArray(tags);
    var out = [];
    var seen = {};
    for (var i = 0; i < list.length; i++) {
      var tag = canonicalTag(list[i]);
      if (!tag || seen[tag]) continue;
      seen[tag] = true;
      out.push(tag);
    }
    return out;
  }

  function mapBucketFromScore(score, hardPass) {
    if (hardPass) return 'hard_pass';
    if (score >= 70) return 'great';
    if (score >= 45) return 'ok';
    return 'pass';
  }

  function etaMinutesFromDistance(distanceMiles) {
    if (!Number.isFinite(distanceMiles)) return null;
    return Math.max(3, Math.round(distanceMiles * 2.2 + 2));
  }

  function titleCaseTag(tag) {
    if (!tag) return '';
    return tag.slice(0, 1).toUpperCase() + tag.slice(1);
  }

  function parseNumber(value) {
    var num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function getStoreLabel(store) {
    if (!store) return '';
    var city = store.city ? String(store.city) : '';
    var state = store.state ? String(store.state) : '';
    if (city && state) return city + ', ' + state;
    return store.name || store.slug || '';
  }

  function parseDriveUrlStores() {
    try {
      var params = new URLSearchParams(window.location.search || '');
      var raw = params.get('stores');
      if (!raw) return [];
      return uniqueList(raw.split(','));
    } catch (_) {
      return [];
    }
  }

  function buildShellHtml() {
    return ''
      + '<section class="drive-shell" aria-labelledby="drive-title">'
      +   '<div class="drive-head">'
      +     '<div>'
      +       '<p class="drive-kicker">Decision First</p>'
      +       '<h2 id="drive-title">Today\'s Drive</h2>'
      +       '<p class="drive-sub">Rank your usual 2-5 stops based on today\'s flavor, constraints, and detour.</p>'
      +     '</div>'
      +     '<div class="drive-head-actions">'
      +       '<button type="button" id="drive-use-location" class="drive-btn">Use Location</button>'
      +       '<span id="drive-location-status" class="drive-muted" aria-live="polite"></span>'
      +     '</div>'
      +   '</div>'
      +   '<div class="drive-route-editor">'
      +     '<div class="drive-route-head">'
      +       '<strong>Route stores</strong>'
      +       '<span class="drive-muted">2 to 5 Culver\'s stores</span>'
      +     '</div>'
      +     '<div id="drive-route-stores" class="drive-route-stores" aria-live="polite"></div>'
      +     '<div class="drive-route-actions">'
      +       '<label class="drive-label" for="drive-add-store">Add store</label>'
      +       '<select id="drive-add-store" class="drive-select"></select>'
      +       '<button type="button" id="drive-add-store-btn" class="drive-btn">Add</button>'
      +     '</div>'
      +   '</div>'
      +   '<div class="drive-controls">'
      +     '<div class="drive-chip-group">'
      +       '<span class="drive-chip-label">Hard excludes</span>'
      +       '<div id="drive-exclude-chips" class="drive-chip-row" role="group" aria-label="Hard excludes"></div>'
      +     '</div>'
      +     '<div class="drive-chip-group">'
      +       '<span class="drive-chip-label">Boost</span>'
      +       '<div id="drive-boost-chips" class="drive-chip-row" role="group" aria-label="Boost preferences"></div>'
      +     '</div>'
      +     '<div class="drive-chip-group">'
      +       '<span class="drive-chip-label">Avoid</span>'
      +       '<div id="drive-avoid-chips" class="drive-chip-row" role="group" aria-label="Avoid preferences"></div>'
      +     '</div>'
      +     '<div class="drive-sort-row">'
      +       '<span class="drive-chip-label">Sort</span>'
      +       '<div id="drive-sort-controls" class="drive-sort-controls" role="group" aria-label="Sort mode"></div>'
      +       '<label class="drive-label" for="drive-radius">Radius</label>'
      +       '<select id="drive-radius" class="drive-select">'
      +         '<option value="10">10 mi</option>'
      +         '<option value="25">25 mi</option>'
      +         '<option value="50">50 mi</option>'
      +         '<option value="100">100 mi</option>'
      +       '</select>'
      +     '</div>'
      +   '</div>'
      +   '<div id="drive-status" class="drive-status" aria-live="polite"></div>'
      +   '<div class="drive-layout">'
      +     '<div>'
      +       '<div id="drive-cards" class="drive-cards"></div>'
      +       '<div id="drive-empty" class="drive-empty" hidden></div>'
      +     '</div>'
      +     '<aside class="drive-map-panel">'
      +       '<h3>Mini-map</h3>'
      +       '<p class="drive-muted">Pin color = match bucket for this route.</p>'
      +       '<div id="drive-map" class="drive-map" role="group" aria-label="Route mini-map"></div>'
      +       '<div class="drive-map-legend">'
      +         '<span><i class="drive-dot drive-bucket-great"></i> Great</span>'
      +         '<span><i class="drive-dot drive-bucket-ok"></i> OK</span>'
      +         '<span><i class="drive-dot drive-bucket-pass"></i> Pass</span>'
      +         '<span><i class="drive-dot drive-bucket-hard_pass"></i> Hard pass</span>'
      +       '</div>'
      +     '</aside>'
      +   '</div>'
      +   '<section class="drive-secondary" id="drive-excluded-section" hidden>'
      +     '<h3>Excluded today</h3>'
      +     '<div id="drive-excluded" class="drive-excluded"></div>'
      +   '</section>'
      +   '<section class="drive-secondary" id="drive-nearby-section" hidden>'
      +     '<h3>Nearby leaderboard</h3>'
      +     '<div id="drive-nearby" class="drive-nearby"></div>'
      +   '</section>'
      + '</section>';
  }

  function makeController(config) {
    var planner = window.CustardPlanner;
    if (!planner) throw new Error('CustardPlanner is required before CustardDrive');

    var root = typeof config.root === 'string' ? document.getElementById(config.root) : config.root;
    if (!root) throw new Error('CustardDrive root element not found');
    root.innerHTML = buildShellHtml();

    var allStores = asArray(config.stores);
    var culversStores = allStores.filter(function (store) {
      var slug = store && store.slug ? String(store.slug) : '';
      if (!slug) return false;
      var brand = (store.brand || planner.brandFromSlug(slug) || '').toLowerCase();
      return brand === 'culvers';
    });

    var bySlug = {};
    for (var i = 0; i < culversStores.length; i++) {
      bySlug[culversStores[i].slug] = culversStores[i];
    }

    var prefs = planner.getDrivePreferences({ stores: culversStores });
    prefs.activeRoute.stores = uniqueList(asArray(prefs.activeRoute.stores)).filter(function (slug) {
      return !!bySlug[slug];
    }).slice(0, 5);
    if (prefs.activeRoute.stores.length < 2) {
      prefs.activeRoute.stores = culversStores.slice(0, 2).map(function (store) { return store.slug; });
    }

    var state = {
      prefs: prefs,
      cardsRaw: [],
      excludedServer: [],
      nearby: [],
      loading: false,
      location: config.location || null,
      activeSlug: null,
      hasLoaded: false,
      includeTomorrow: !!config.includeTomorrow,
    };

    var workerBase = config.workerBase || planner.WORKER_BASE;
    var pageKey = config.pageKey || 'index';

    var dom = {
      routeStores: root.querySelector('#drive-route-stores'),
      addStore: root.querySelector('#drive-add-store'),
      addStoreBtn: root.querySelector('#drive-add-store-btn'),
      excludeChips: root.querySelector('#drive-exclude-chips'),
      boostChips: root.querySelector('#drive-boost-chips'),
      avoidChips: root.querySelector('#drive-avoid-chips'),
      sortControls: root.querySelector('#drive-sort-controls'),
      radius: root.querySelector('#drive-radius'),
      cards: root.querySelector('#drive-cards'),
      empty: root.querySelector('#drive-empty'),
      status: root.querySelector('#drive-status'),
      map: root.querySelector('#drive-map'),
      locationBtn: root.querySelector('#drive-use-location'),
      locationStatus: root.querySelector('#drive-location-status'),
      excludedSection: root.querySelector('#drive-excluded-section'),
      excluded: root.querySelector('#drive-excluded'),
      nearbySection: root.querySelector('#drive-nearby-section'),
      nearby: root.querySelector('#drive-nearby'),
    };

    function emitFilter(action) {
      planner.emitInteractionEvent({
        event_type: 'filter_toggle',
        page: pageKey,
        action: action,
      });
    }

    function emitStoreSelect(action, slug) {
      planner.emitInteractionEvent({
        event_type: 'store_select',
        page: pageKey,
        action: action,
        store_slug: slug || null,
      });
    }

    function savePrefs(opts) {
      opts = opts || {};
      state.prefs.favoriteStores = state.prefs.activeRoute.stores.slice(0, 5);
      state.prefs = planner.saveDrivePreferences(state.prefs, { stores: culversStores });
      if (config.syncUrl !== false) {
        var query = planner.buildDriveUrlState(state.prefs, { stores: culversStores });
        var next = query ? ('?' + query) : window.location.pathname;
        if (window.history && typeof window.history.replaceState === 'function') {
          window.history.replaceState({}, '', window.location.pathname + (query ? ('?' + query) : ''));
        } else {
          window.location.search = query;
        }
      }
      if (opts.routeChanged) {
        emitStoreSelect('route_save', state.prefs.activeRoute.stores[0]);
        if (typeof config.onPrimaryStoreChange === 'function' && state.prefs.activeRoute.stores.length > 0) {
          config.onPrimaryStoreChange(state.prefs.activeRoute.stores[0]);
        }
      }
    }

    function renderChipRow(container, options, activeTags, kind) {
      var activeSet = {};
      for (var i = 0; i < activeTags.length; i++) activeSet[activeTags[i]] = true;
      var html = '';
      for (var oi = 0; oi < options.length; oi++) {
        var option = options[oi];
        var active = !!activeSet[option.tag];
        html += '<button type="button" class="drive-chip' + (active ? ' is-active' : '') + '"'
          + ' data-kind="' + escapeHtml(kind) + '"'
          + ' data-tag="' + escapeHtml(option.tag) + '"'
          + ' aria-pressed="' + (active ? 'true' : 'false') + '">'
          + escapeHtml(option.label)
          + '</button>';
      }
      container.innerHTML = html;
    }

    function renderSortControls() {
      var html = '';
      for (var i = 0; i < SORT_MODES.length; i++) {
        var mode = SORT_MODES[i];
        var active = state.prefs.ui.sortMode === mode.value;
        html += '<button type="button" class="drive-sort-btn' + (active ? ' is-active' : '') + '"'
          + ' data-sort="' + escapeHtml(mode.value) + '"'
          + ' aria-pressed="' + (active ? 'true' : 'false') + '">'
          + escapeHtml(mode.label)
          + '</button>';
      }
      dom.sortControls.innerHTML = html;
      dom.radius.value = String(state.prefs.ui.radiusMiles || 25);
    }

    function renderRouteStores() {
      var stores = asArray(state.prefs.activeRoute.stores);
      var canRemove = stores.length > 2;
      var html = '';
      for (var i = 0; i < stores.length; i++) {
        var slug = stores[i];
        var store = bySlug[slug];
        var label = store ? getStoreLabel(store) : slug;
        html += '<div class="drive-route-pill">'
          + '<span>' + escapeHtml(label) + '</span>'
          + '<button type="button" class="drive-pill-remove" data-remove-slug="' + escapeHtml(slug) + '"'
          + (canRemove ? '' : ' disabled')
          + ' aria-label="Remove ' + escapeHtml(label) + '">×</button>'
          + '</div>';
      }
      dom.routeStores.innerHTML = html;

      var options = '<option value="">Select a store…</option>';
      for (var si = 0; si < culversStores.length; si++) {
        var store = culversStores[si];
        if (stores.indexOf(store.slug) !== -1) continue;
        options += '<option value="' + escapeHtml(store.slug) + '">' + escapeHtml(getStoreLabel(store)) + '</option>';
      }
      dom.addStore.innerHTML = options;
      dom.addStoreBtn.disabled = stores.length >= 5;
    }

    function buildRecommendation(card, matchedBoost, matchedAvoid, novelty, avgGap) {
      var parts = [];
      if (matchedBoost.length > 0) parts.push(matchedBoost.join(' + '));
      if (matchedAvoid.length > 0) parts.push('avoid: ' + matchedAvoid.join(', '));
      if (novelty) parts.push('new to this store');
      if (Number.isFinite(avgGap) && avgGap > 0) parts.push('rare cadence ~' + avgGap + ' days');
      if (parts.length === 0) return (card.flavor || 'Flavor') + '; balanced pick for today';
      return (card.flavor || 'Flavor') + '; ' + parts.join('; ');
    }

    function decorateCard(rawCard) {
      var tags = normalizeTags(rawCard.tags);
      var excludes = normalizeTags(state.prefs.filters.excludeTags);
      var boosts = normalizeTags(state.prefs.preferences.boostTags);
      var avoids = normalizeTags(state.prefs.preferences.avoidTags);

      var matchedExclude = excludes.filter(function (tag) { return tags.indexOf(tag) !== -1; });
      var hardPass = matchedExclude.length > 0;

      var matchedBoost = boosts.filter(function (tag) { return tags.indexOf(tag) !== -1; });
      var matchedAvoid = avoids.filter(function (tag) { return tags.indexOf(tag) !== -1; });

      var avgGap = rawCard && rawCard.rarity ? Number(rawCard.rarity.avg_gap_days) : NaN;
      var rarityBonus = clamp(Math.round((Number.isFinite(avgGap) ? avgGap : 0) / 7), 0, 18);
      var novelty = !!(rawCard && rawCard.rarity && rawCard.rarity.novelty_bonus_applied);
      if (!novelty && rawCard && rawCard.rarity && Number.isFinite(Number(rawCard.rarity.days_since_last))) {
        novelty = Number(rawCard.rarity.days_since_last) >= 30;
      }
      var noveltyBonus = novelty ? 10 : 0;
      var distanceMiles = Number(rawCard.distance_miles);
      var distance = Number.isFinite(distanceMiles) ? distanceMiles : null;
      var detourPenalty = Number.isFinite(distance) ? clamp(Math.round(distance * 1.5), 0, 20) : 0;

      var score = clamp(
        50
          + (matchedBoost.length * 12)
          + rarityBonus
          + noveltyBonus
          - (matchedAvoid.length * 8)
          - detourPenalty,
        0,
        100,
      );

      var recommendation = buildRecommendation(rawCard, matchedBoost, matchedAvoid, novelty, Number.isFinite(avgGap) ? Math.round(avgGap) : null);
      var dealbreakers = hardPass
        ? matchedExclude.map(function (tag) { return 'Excluded by ' + titleCaseTag(tag); })
        : asArray(rawCard.dealbreakers);

      return {
        raw: rawCard,
        slug: rawCard.slug,
        name: rawCard.name,
        flavor: rawCard.flavor,
        description: rawCard.description || '',
        vibe: asArray(rawCard.vibe).slice(0, 3),
        tags: tags,
        matchedExclude: matchedExclude,
        matchedBoost: matchedBoost,
        matchedAvoid: matchedAvoid,
        hardPass: hardPass,
        score: score,
        mapBucket: mapBucketFromScore(score, hardPass),
        recommendation: recommendation,
        dealbreakers: dealbreakers,
        distanceMiles: distance,
        etaMinutes: etaMinutesFromDistance(distance),
        avgGapDays: Number.isFinite(avgGap) ? Math.round(avgGap) : null,
        lastSeen: rawCard && rawCard.rarity ? rawCard.rarity.last_seen : null,
      };
    }

    function sortDecoratedCards(cards) {
      var mode = state.prefs.ui.sortMode || 'match';
      var list = cards.slice();
      if (mode === 'detour') {
        list.sort(function (a, b) {
          var ad = Number.isFinite(a.distanceMiles) ? a.distanceMiles : 9999;
          var bd = Number.isFinite(b.distanceMiles) ? b.distanceMiles : 9999;
          return ad - bd;
        });
        return list;
      }
      if (mode === 'rarity') {
        list.sort(function (a, b) {
          var ar = Number.isFinite(a.avgGapDays) ? a.avgGapDays : -1;
          var br = Number.isFinite(b.avgGapDays) ? b.avgGapDays : -1;
          return br - ar;
        });
        return list;
      }
      if (mode === 'eta') {
        list.sort(function (a, b) {
          var ae = Number.isFinite(a.etaMinutes) ? a.etaMinutes : 9999;
          var be = Number.isFinite(b.etaMinutes) ? b.etaMinutes : 9999;
          return ae - be;
        });
        return list;
      }
      list.sort(function (a, b) {
        return b.score - a.score;
      });
      return list;
    }

    function buildDirectionsHref(card) {
      var lat = parseNumber(card.raw && card.raw.lat);
      var lon = parseNumber(card.raw && card.raw.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '#';
      return planner.directionsUrl(lat, lon, card.name || card.slug);
    }

    function renderCards(decoratedCards) {
      if (decoratedCards.length === 0) {
        dom.cards.innerHTML = '';
        dom.empty.hidden = false;
        dom.empty.textContent = 'No route cards cleared current constraints. Toggle a chip to widen matches.';
        return;
      }

      dom.empty.hidden = true;
      var html = '';
      for (var i = 0; i < decoratedCards.length; i++) {
        var card = decoratedCards[i];
        var vibe = card.vibe.length > 0 ? card.vibe.join(' • ') : 'Balanced • Familiar • Sweet';
        var scoreLabel = String(card.score);
        var dealbreaker = card.dealbreakers.length > 0
          ? card.dealbreakers.join(' · ')
          : 'No hard dealbreakers';
        var detour = Number.isFinite(card.distanceMiles)
          ? card.distanceMiles.toFixed(1) + ' mi detour'
          : 'Detour unavailable';
        var eta = Number.isFinite(card.etaMinutes)
          ? card.etaMinutes + ' min ETA'
          : 'ETA unavailable';
        var lastSeen = card.lastSeen ? ('Last seen ' + card.lastSeen) : 'Last seen unavailable';
        var tomorrow = (state.includeTomorrow && card.raw) ? card.raw.tomorrow : null;
        var tomorrowHtml = '';
        if (state.includeTomorrow) {
          var tomorrowFlavor = tomorrow && tomorrow.flavor ? tomorrow.flavor : 'No confirmed flavor posted yet';
          var tomorrowDescription = tomorrow && tomorrow.description
            ? tomorrow.description
            : 'Check back later for an official posting.';
          tomorrowHtml = '<div class="drive-tomorrow">'
            + '<p class="drive-tomorrow-kicker">Tomorrow</p>'
            + '<p class="drive-tomorrow-flavor">' + escapeHtml(tomorrowFlavor) + '</p>'
            + '<p class="drive-tomorrow-desc">' + escapeHtml(tomorrowDescription) + '</p>'
            + '</div>';
        }

        html += '<article class="drive-card" data-store-slug="' + escapeHtml(card.slug) + '" tabindex="0">'
          + '<header class="drive-card-head">'
          +   '<div>'
          +     '<h4>' + escapeHtml(getStoreLabel(bySlug[card.slug] || { name: card.name, slug: card.slug })) + '</h4>'
          +     '<p class="drive-flavor">' + escapeHtml(card.flavor || 'Flavor unavailable') + '</p>'
          +   '</div>'
          +   '<div class="drive-score drive-bucket-' + escapeHtml(card.mapBucket) + '">' + escapeHtml(scoreLabel) + '</div>'
          + '</header>'
          + '<p class="drive-vibe">' + escapeHtml(vibe) + '</p>'
          + '<p class="drive-dealbreaker">' + escapeHtml(dealbreaker) + '</p>'
          + '<p class="drive-rec">' + escapeHtml(card.recommendation) + '</p>'
          + tomorrowHtml
          + '<details>'
          +   '<summary>Details</summary>'
          +   (card.description ? '<p class="drive-detail-line">' + escapeHtml(card.description) + '</p>' : '')
          +   '<p class="drive-detail-line">' + escapeHtml(lastSeen + ' • ' + detour + ' • ' + eta) + '</p>'
          +   '<p><a href="' + escapeHtml(buildDirectionsHref(card)) + '" target="_blank" rel="noopener">Directions</a></p>'
          + '</details>'
          + '</article>';
      }
      dom.cards.innerHTML = html;

      var cardEls = dom.cards.querySelectorAll('.drive-card');
      for (var ci = 0; ci < cardEls.length; ci++) {
        var el = cardEls[ci];
        (function (cardEl) {
          var slug = cardEl.getAttribute('data-store-slug');
          cardEl.addEventListener('mouseenter', function () {
            setActiveSlug(slug);
          });
          cardEl.addEventListener('focus', function () {
            setActiveSlug(slug);
            emitStoreSelect('card_focus', slug);
          });
          cardEl.addEventListener('click', function () {
            setActiveSlug(slug);
          });
        })(el);
      }
    }

    function renderExcluded(excludedList) {
      if (!excludedList || excludedList.length === 0) {
        dom.excludedSection.hidden = true;
        dom.excluded.innerHTML = '';
        return;
      }
      dom.excludedSection.hidden = false;
      var html = '';
      for (var i = 0; i < excludedList.length; i++) {
        var row = excludedList[i];
        var reason = '';
        if (Array.isArray(row.reasons) && row.reasons.length > 0) {
          reason = row.reasons.join(' · ');
        } else if (Array.isArray(row.dealbreakers) && row.dealbreakers.length > 0) {
          reason = row.dealbreakers.join(' · ');
        } else {
          reason = 'Excluded by constraints';
        }
        html += '<div class="drive-excluded-item">'
          + '<strong>' + escapeHtml(getStoreLabel(bySlug[row.slug] || { name: row.name, slug: row.slug })) + '</strong>'
          + '<span>' + escapeHtml((row.flavor || 'No flavor') + ' — ' + reason) + '</span>'
          + '</div>';
      }
      dom.excluded.innerHTML = html;
    }

    function renderNearby(nearbyList) {
      if (!Array.isArray(nearbyList) || nearbyList.length === 0) {
        dom.nearbySection.hidden = true;
        dom.nearby.innerHTML = '';
        return;
      }
      dom.nearbySection.hidden = false;
      var html = '<ol class="drive-nearby-list">';
      for (var i = 0; i < nearbyList.length; i++) {
        var row = nearbyList[i];
        var dist = Number(row.distance_miles);
        var distText = Number.isFinite(dist) ? (' · ' + dist.toFixed(1) + ' mi') : '';
        html += '<li><strong>' + escapeHtml(row.name || row.slug || 'Store') + '</strong>'
          + '<span> — ' + escapeHtml(row.flavor || 'Flavor unavailable') + distText + '</span></li>';
      }
      html += '</ol>';
      dom.nearby.innerHTML = html;
    }

    function mapBounds(points) {
      var latMin = Infinity;
      var latMax = -Infinity;
      var lonMin = Infinity;
      var lonMax = -Infinity;
      for (var i = 0; i < points.length; i++) {
        var p = points[i];
        if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) continue;
        if (p.lat < latMin) latMin = p.lat;
        if (p.lat > latMax) latMax = p.lat;
        if (p.lon < lonMin) lonMin = p.lon;
        if (p.lon > lonMax) lonMax = p.lon;
      }
      if (!Number.isFinite(latMin)) {
        return { latMin: 0, latMax: 1, lonMin: 0, lonMax: 1 };
      }
      if (latMin === latMax) {
        latMin -= 0.05;
        latMax += 0.05;
      }
      if (lonMin === lonMax) {
        lonMin -= 0.05;
        lonMax += 0.05;
      }
      return { latMin: latMin, latMax: latMax, lonMin: lonMin, lonMax: lonMax };
    }

    function renderMap(primaryCards, excludedCards) {
      var cardBySlug = {};
      for (var i = 0; i < primaryCards.length; i++) cardBySlug[primaryCards[i].slug] = primaryCards[i];
      for (var ei = 0; ei < excludedCards.length; ei++) {
        var ex = excludedCards[ei];
        if (!cardBySlug[ex.slug]) {
          cardBySlug[ex.slug] = {
            slug: ex.slug,
            mapBucket: 'hard_pass',
            flavor: ex.flavor || 'Excluded',
          };
        }
      }

      var points = [];
      var route = asArray(state.prefs.activeRoute.stores);
      for (var ri = 0; ri < route.length; ri++) {
        var slug = route[ri];
        var store = bySlug[slug];
        if (!store) continue;
        var card = cardBySlug[slug] || { slug: slug, flavor: 'No card', mapBucket: 'pass' };
        points.push({
          slug: slug,
          lat: parseNumber(store.lat),
          lon: parseNumber(store.lng),
          label: getStoreLabel(store),
          flavor: card.flavor || 'Flavor unavailable',
          bucket: card.mapBucket || 'pass',
        });
      }

      if (points.length === 0) {
        dom.map.innerHTML = '<div class="drive-map-empty">Add at least 2 stores to render the mini-map.</div>';
        return;
      }

      var bounds = mapBounds(points);
      var html = '<div class="drive-map-canvas">';
      for (var pi = 0; pi < points.length; pi++) {
        var p = points[pi];
        var x = clamp(((p.lon - bounds.lonMin) / (bounds.lonMax - bounds.lonMin)) * 100, 6, 94);
        var y = clamp((1 - ((p.lat - bounds.latMin) / (bounds.latMax - bounds.latMin))) * 100, 10, 90);
        var isActive = state.activeSlug === p.slug;
        html += '<button type="button" class="drive-pin drive-bucket-' + escapeHtml(p.bucket) + (isActive ? ' is-active' : '') + '"'
          + ' data-pin-slug="' + escapeHtml(p.slug) + '"'
          + ' style="left:' + x.toFixed(2) + '%;top:' + y.toFixed(2) + '%;"'
          + ' aria-label="' + escapeHtml(p.label + ' ' + p.flavor) + '">'
          + '<span>' + escapeHtml(String(pi + 1)) + '</span>'
          + '</button>';
      }
      html += '</div>';
      dom.map.innerHTML = html;

      var pinEls = dom.map.querySelectorAll('.drive-pin');
      for (var pni = 0; pni < pinEls.length; pni++) {
        var pin = pinEls[pni];
        pin.addEventListener('click', function () {
          var slug = this.getAttribute('data-pin-slug');
          setActiveSlug(slug);
          var cardEl = dom.cards.querySelector('.drive-card[data-store-slug="' + slug + '"]');
          if (cardEl) cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
    }

    function setActiveSlug(slug) {
      state.activeSlug = slug || null;
      var cardEls = dom.cards.querySelectorAll('.drive-card');
      for (var i = 0; i < cardEls.length; i++) {
        var card = cardEls[i];
        var active = card.getAttribute('data-store-slug') === state.activeSlug;
        card.classList.toggle('is-active', active);
      }
      var pinEls = dom.map.querySelectorAll('.drive-pin');
      for (var pi = 0; pi < pinEls.length; pi++) {
        var pin = pinEls[pi];
        var pinActive = pin.getAttribute('data-pin-slug') === state.activeSlug;
        pin.classList.toggle('is-active', pinActive);
      }
    }

    function rerenderFromRaw() {
      var decorated = [];
      var localExcluded = [];
      for (var i = 0; i < state.cardsRaw.length; i++) {
        var card = decorateCard(state.cardsRaw[i]);
        if (card.hardPass) {
          localExcluded.push({
            slug: card.slug,
            name: card.name,
            flavor: card.flavor,
            reasons: card.dealbreakers,
          });
        } else {
          decorated.push(card);
        }
      }

      var sorted = sortDecoratedCards(decorated);
      renderCards(sorted);

      var mergedExcluded = asArray(state.excludedServer).slice();
      for (var j = 0; j < localExcluded.length; j++) {
        var exists = false;
        for (var k = 0; k < mergedExcluded.length; k++) {
          if (mergedExcluded[k] && mergedExcluded[k].slug === localExcluded[j].slug) {
            exists = true;
            break;
          }
        }
        if (!exists) mergedExcluded.push(localExcluded[j]);
      }

      renderExcluded(mergedExcluded);
      renderNearby(state.nearby);
      renderMap(sorted, mergedExcluded);

      if (sorted.length > 0) {
        dom.status.textContent = sorted.length + ' ranked stores. Chips rerank instantly without refetching.';
      } else if (mergedExcluded.length > 0) {
        dom.status.textContent = 'All route stores are excluded by current hard constraints.';
      } else {
        dom.status.textContent = 'No route cards available yet for this query.';
      }

      if (!state.activeSlug && sorted.length > 0) {
        state.activeSlug = sorted[0].slug;
        setActiveSlug(state.activeSlug);
      }
    }

    async function fetchDrive() {
      if (state.loading) return;
      if (state.prefs.activeRoute.stores.length < 2) {
        dom.status.textContent = 'Select at least 2 stores.';
        return;
      }
      state.loading = true;
      dom.status.textContent = 'Loading route cards…';

      try {
        var params = new URLSearchParams();
        params.set('slugs', state.prefs.activeRoute.stores.join(','));
        params.set('radius', String(state.prefs.ui.radiusMiles || 25));
        if (state.location && Number.isFinite(state.location.lat) && Number.isFinite(state.location.lon)) {
          params.set('location', Number(state.location.lat).toFixed(5) + ',' + Number(state.location.lon).toFixed(5));
        }
        if (state.includeTomorrow) {
          params.set('include_tomorrow', '1');
        }
        var url = workerBase + '/api/v1/drive?' + params.toString();
        var resp = await fetch(url);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        var payload = await resp.json();

        state.cardsRaw = asArray(payload.cards);
        state.excludedServer = asArray(payload.excluded);
        state.nearby = asArray(payload.nearby_leaderboard);
        state.hasLoaded = true;
        rerenderFromRaw();
      } catch (err) {
        dom.status.textContent = 'Unable to load Today\'s Drive right now.';
        if (!state.hasLoaded) {
          dom.cards.innerHTML = '';
          dom.empty.hidden = false;
          dom.empty.textContent = 'Drive data unavailable. Retry after checking your connection.';
        }
      } finally {
        state.loading = false;
      }
    }

    function toggleTag(list, tag) {
      var idx = list.indexOf(tag);
      if (idx === -1) list.push(tag);
      else list.splice(idx, 1);
    }

    function bindEvents() {
      root.addEventListener('click', function (event) {
        var target = event.target;
        if (!target) return;

        var removeSlug = target.getAttribute('data-remove-slug');
        if (removeSlug) {
          var stores = state.prefs.activeRoute.stores.slice();
          var idx = stores.indexOf(removeSlug);
          if (idx !== -1 && stores.length > 2) {
            stores.splice(idx, 1);
            state.prefs.activeRoute.stores = stores;
            savePrefs({ routeChanged: true });
            renderRouteStores();
            fetchDrive();
          }
          return;
        }

        var tag = target.getAttribute('data-tag');
        var kind = target.getAttribute('data-kind');
        if (tag && kind) {
          var lowerTag = canonicalTag(tag);
          if (kind === 'exclude') {
            toggleTag(state.prefs.filters.excludeTags, lowerTag);
            emitFilter('exclude:' + lowerTag + ':' + (state.prefs.filters.excludeTags.indexOf(lowerTag) !== -1 ? 'on' : 'off'));
          } else if (kind === 'boost') {
            toggleTag(state.prefs.preferences.boostTags, lowerTag);
            emitFilter('boost:' + lowerTag + ':' + (state.prefs.preferences.boostTags.indexOf(lowerTag) !== -1 ? 'on' : 'off'));
          } else if (kind === 'avoid') {
            toggleTag(state.prefs.preferences.avoidTags, lowerTag);
            emitFilter('avoid:' + lowerTag + ':' + (state.prefs.preferences.avoidTags.indexOf(lowerTag) !== -1 ? 'on' : 'off'));
          }
          savePrefs();
          renderControls();
          rerenderFromRaw();
          return;
        }

        var sort = target.getAttribute('data-sort');
        if (sort) {
          state.prefs.ui.sortMode = sort;
          emitFilter('sort:' + sort);
          savePrefs();
          renderControls();
          rerenderFromRaw();
        }
      });

      dom.addStoreBtn.addEventListener('click', function () {
        var slug = String(dom.addStore.value || '').trim();
        if (!slug || !bySlug[slug]) return;
        var stores = state.prefs.activeRoute.stores.slice();
        if (stores.indexOf(slug) !== -1 || stores.length >= 5) return;
        stores.push(slug);
        state.prefs.activeRoute.stores = stores;
        savePrefs({ routeChanged: true });
        renderRouteStores();
        fetchDrive();
      });

      dom.radius.addEventListener('change', function () {
        var value = Number.parseInt(dom.radius.value, 10);
        if (!Number.isFinite(value)) return;
        state.prefs.ui.radiusMiles = clamp(value, 1, 100);
        savePrefs();
        fetchDrive();
      });

      dom.locationBtn.addEventListener('click', function () {
        if (!navigator.geolocation) {
          dom.locationStatus.textContent = 'Geolocation unavailable';
          return;
        }
        dom.locationBtn.disabled = true;
        dom.locationStatus.textContent = 'Locating…';
        navigator.geolocation.getCurrentPosition(function (pos) {
          state.location = {
            lat: Number(pos.coords.latitude),
            lon: Number(pos.coords.longitude),
          };
          dom.locationStatus.textContent = 'Location applied';
          dom.locationBtn.disabled = false;
          fetchDrive();
          if (typeof config.onLocationChange === 'function') config.onLocationChange(state.location);
        }, function () {
          dom.locationStatus.textContent = 'Location blocked';
          dom.locationBtn.disabled = false;
        }, {
          timeout: 8000,
          maximumAge: 300000,
        });
      });
    }

    function renderControls() {
      renderRouteStores();
      renderChipRow(dom.excludeChips, EXCLUDE_CHIPS, normalizeTags(state.prefs.filters.excludeTags), 'exclude');
      renderChipRow(dom.boostChips, BOOST_CHIPS, normalizeTags(state.prefs.preferences.boostTags), 'boost');
      renderChipRow(dom.avoidChips, AVOID_CHIPS, normalizeTags(state.prefs.preferences.avoidTags), 'avoid');
      renderSortControls();
    }

    function init() {
      var widgetStores = parseDriveUrlStores();
      if (pageKey === 'scoop' && widgetStores.length > 0) {
        planner.emitInteractionEvent({
          event_type: 'widget_tap',
          page: 'scoop',
          action: widgetStores.join(','),
        });
      }

      renderControls();
      bindEvents();
      savePrefs();
      fetchDrive();
      if (typeof config.onPrimaryStoreChange === 'function' && state.prefs.activeRoute.stores.length > 0) {
        config.onPrimaryStoreChange(state.prefs.activeRoute.stores[0]);
      }
    }

    init();

    return {
      refresh: fetchDrive,
      setLocation: function (location) {
        if (!location) return;
        var lat = Number(location.lat);
        var lon = Number(location.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
        state.location = { lat: lat, lon: lon };
        dom.locationStatus.textContent = 'Location applied';
        fetchDrive();
      },
      getPrimaryStoreSlug: function () {
        return state.prefs.activeRoute.stores[0] || null;
      },
      getPreferences: function () {
        return state.prefs;
      },
    };
  }

  return {
    mount: function (config) {
      config = config || {};
      return makeController(config);
    },
  };
})();
