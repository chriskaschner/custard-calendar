/**
 * CustardPlanner -- UI sub-module.
 * Action CTAs, telemetry, signals, and share button.
 *
 * Loaded after planner-shared.js; extends window.CustardPlanner via Object.assign.
 */
(function () {
  'use strict';

  var CP = window.CustardPlanner;
  if (!CP) { console.error('planner-ui.js: CustardPlanner not found'); return; }

  var WORKER_BASE = CP.WORKER_BASE;

  // ---------------------------------------------------------------------------
  // Telemetry helpers (private)
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Telemetry emission (public)
  // ---------------------------------------------------------------------------

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

  function getPageLoadId() {
    return _pageLoadId;
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

  // Load-time side effects: bind telemetry listener and emit page view
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
    var attrs = ' data-event-action="' + CP.escapeHtml(actionName) + '"';
    if (opts.slug) attrs += ' data-store-slug="' + CP.escapeHtml(opts.slug) + '"';
    if (opts.flavor) attrs += ' data-flavor="' + CP.escapeHtml(opts.flavor) + '"';
    if (opts.certaintyTier) attrs += ' data-certainty-tier="' + CP.escapeHtml(opts.certaintyTier) + '"';
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
  // Flavor signals (MUST be defined before Object.assign -- no hoisting across IIFEs)
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
      + ' data-signal-type="' + CP.escapeHtml(sig.type || 'signal') + '"'
      + ' data-store-slug="' + CP.escapeHtml(slug || '') + '"'
      + ' data-flavor="' + CP.escapeHtml(flavor) + '"'
      + ' data-certainty-tier="' + CP.escapeHtml(certainty) + '">'
      + '<div class="signal-card-body">'
      + '<div class="signal-headline">' + CP.escapeHtml(sig.headline) + '</div>'
      + '<div class="signal-explanation">' + CP.escapeHtml(sig.explanation) + '</div>'
      + '<a href="' + actionHref + '" class="' + actionClass + '" data-event-action="' + CP.escapeHtml(actionName || 'alert') + '" data-store-slug="' + CP.escapeHtml(slug || '') + '" data-flavor="' + CP.escapeHtml(flavor) + '" data-certainty-tier="' + CP.escapeHtml(certainty) + '">' + actionLabel + '</a>'
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

  // ---------------------------------------------------------------------------
  // Extend CustardPlanner
  // ---------------------------------------------------------------------------

  Object.assign(CP, {
    // Action CTAs
    directionsUrl: directionsUrl,
    calendarIcsUrl: calendarIcsUrl,
    alertPageUrl: alertPageUrl,
    actionCTAsHTML: actionCTAsHTML,

    // Telemetry
    emitInteractionEvent: emitInteractionEvent,
    emitPageView: emitPageView,
    getPageLoadId: getPageLoadId,

    // Signals
    signalCardHTML: signalCardHTML,
    fetchSignals: fetchSignalsShared,

    // Share
    initShareButton: initShareButton,
  });
})();
