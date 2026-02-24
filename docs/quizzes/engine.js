const WORKER_BASE = 'https://custard.chriskaschner.com';

const QUIZ_CONFIG_PATHS = [
  'quizzes/quiz-classic-v1.json',
  'quizzes/quiz-weather-v1.json',
  'quizzes/quiz-date-night-v1.json',
];

const state = {
  traits: [],
  archetypes: [],
  quizzes: [],
  activeQuiz: null,
};

const els = {
  form: document.getElementById('quiz-form'),
  locationInput: document.getElementById('quiz-location'),
  radiusSelect: document.getElementById('quiz-radius'),
  variantSelect: document.getElementById('quiz-variant'),
  geoBtn: document.getElementById('quiz-geo'),
  questionsWrap: document.getElementById('quiz-questions'),
  submitBtn: document.getElementById('quiz-submit'),
  status: document.getElementById('quiz-status'),
  resultSection: document.getElementById('quiz-result'),
  resultTitle: document.getElementById('result-title'),
  resultFlavor: document.getElementById('result-flavor'),
  resultBlurb: document.getElementById('result-blurb'),
  resultTraits: document.getElementById('result-traits'),
  resultAvailability: document.getElementById('result-availability'),
  resultAlternates: document.getElementById('result-alternates'),
  resultMapLink: document.getElementById('result-map-link'),
};

function setStatus(message, tone = 'neutral') {
  if (!els.status) return;
  els.status.textContent = message;
  els.status.className = `quiz-status quiz-status-${tone}`;
}

function normalizeFlavor(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\boreo(?:\u00ae)?\b/g, 'oreo')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseLatLon(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lon = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon, source: 'manual-coords' };
}

async function geocodeLocation(locationText) {
  const manual = parseLatLon(locationText);
  if (manual) return manual;

  const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q='
    + encodeURIComponent(locationText);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Geocoder returned ${resp.status}`);
  const rows = await resp.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = rows[0];
  const lat = Number(row.lat);
  const lon = Number(row.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon, source: 'geocoder' };
}

function haversineMiles(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function loadJson(path) {
  const resp = await fetch(path);
  if (!resp.ok) throw new Error(`Failed to load ${path}: ${resp.status}`);
  return resp.json();
}

async function loadConfigs() {
  const [archetypeData, ...quizConfigs] = await Promise.all([
    loadJson('quizzes/flavor-archetypes.json'),
    ...QUIZ_CONFIG_PATHS.map((path) => loadJson(path)),
  ]);
  state.traits = Array.isArray(archetypeData?.traits) ? archetypeData.traits : [];
  state.archetypes = Array.isArray(archetypeData?.archetypes) ? archetypeData.archetypes : [];
  state.quizzes = quizConfigs.filter((quiz) => quiz && quiz.id && Array.isArray(quiz.questions));
}

function populateVariantSelect() {
  els.variantSelect.innerHTML = '';
  for (const quiz of state.quizzes) {
    const opt = document.createElement('option');
    opt.value = quiz.id;
    opt.textContent = quiz.name || quiz.title || quiz.id;
    els.variantSelect.appendChild(opt);
  }
  if (state.quizzes.length > 0) {
    state.activeQuiz = state.quizzes[0];
    els.variantSelect.value = state.activeQuiz.id;
  }
}

function renderQuestions(quiz) {
  els.questionsWrap.innerHTML = '';
  const template = document.getElementById('quiz-header-template');
  if (template) {
    const clone = template.content.cloneNode(true);
    clone.querySelector('[data-quiz-title]').textContent = quiz.title;
    clone.querySelector('[data-quiz-description]').textContent = quiz.description || '';
    els.questionsWrap.appendChild(clone);
  }

  quiz.questions.forEach((question, idx) => {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'quiz-question';
    fieldset.dataset.questionId = question.id;

    const legend = document.createElement('legend');
    legend.textContent = `${idx + 1}. ${question.prompt}`;
    fieldset.appendChild(legend);

    const grid = document.createElement('div');
    grid.className = 'quiz-options-grid';
    fieldset.appendChild(grid);

    question.options.forEach((option) => {
      const label = document.createElement('label');
      label.className = 'quiz-option';

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = question.id;
      input.value = option.id;

      const copy = document.createElement('span');
      copy.className = 'quiz-option-copy';
      copy.textContent = option.label;

      label.appendChild(input);
      label.appendChild(copy);
      grid.appendChild(label);
    });

    els.questionsWrap.appendChild(fieldset);
  });
}

function getQuizById(id) {
  return state.quizzes.find((quiz) => quiz.id === id) || null;
}

function collectAnswers(quiz, formEl) {
  const data = new FormData(formEl);
  const traitScores = {};
  const selected = {};

  for (const trait of state.traits) {
    traitScores[trait] = 0;
  }

  for (const question of quiz.questions) {
    const selectedId = data.get(question.id);
    if (!selectedId) {
      throw new Error('Please answer all questions before running your custard forecast.');
    }
    selected[question.id] = String(selectedId);
    const selectedOption = question.options.find((opt) => opt.id === selectedId);
    if (!selectedOption) continue;
    const deltas = selectedOption.traits || {};
    for (const [trait, delta] of Object.entries(deltas)) {
      if (typeof traitScores[trait] !== 'number') traitScores[trait] = 0;
      const value = Number(delta);
      if (!Number.isFinite(value)) continue;
      traitScores[trait] += value;
    }
  }

  return { traitScores, selected };
}

function chooseArchetype(traitScores) {
  const ranked = state.archetypes.map((archetype) => {
    const profile = archetype.profile || {};
    let score = 0;
    for (const [trait, weight] of Object.entries(profile)) {
      const traitValue = Number(traitScores[trait] || 0);
      const profileWeight = Number(weight || 0);
      score += traitValue * profileWeight;
    }
    return { archetype, score };
  }).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.archetype.id.localeCompare(b.archetype.id);
  });

  return ranked[0]?.archetype || null;
}

function pickResultFlavor(quizId, archetype) {
  const flavors = Array.isArray(archetype?.flavors) ? archetype.flavors : [];
  if (flavors.length === 0) return null;
  const storageKey = `quiz:last:${quizId}:${archetype.id}`;
  const previous = localStorage.getItem(storageKey);
  const fallback = flavors[0];
  const next = flavors.find((f) => f !== previous) || fallback;
  localStorage.setItem(storageKey, next);
  return next;
}

async function fetchNearby(locationText) {
  const url = `${WORKER_BASE}/api/v1/nearby-flavors?location=${encodeURIComponent(locationText)}&limit=100`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Nearby lookup failed (${resp.status})`);
  }
  const data = await resp.json();
  if (!Array.isArray(data?.nearby)) return [];
  return data.nearby;
}

function rankAvailabilityMatches(stores, candidateFlavors, center, radiusMiles) {
  const flavorOrder = new Map(candidateFlavors.map((flavor, idx) => [normalizeFlavor(flavor), idx]));
  const within = [];
  const outside = [];

  for (const store of stores) {
    const normalizedStoreFlavor = normalizeFlavor(store.flavor);
    if (!flavorOrder.has(normalizedStoreFlavor)) continue;

    const lat = Number(store.lat);
    const lon = Number(store.lon);
    let distanceMiles = null;
    if (center && Number.isFinite(lat) && Number.isFinite(lon)) {
      distanceMiles = haversineMiles(center.lat, center.lon, lat, lon);
    }

    const row = {
      store,
      flavorOrder: flavorOrder.get(normalizedStoreFlavor),
      distanceMiles,
    };

    if (distanceMiles == null || distanceMiles <= radiusMiles) {
      within.push(row);
    } else {
      outside.push(row);
    }
  }

  const sorter = (a, b) => {
    if (a.flavorOrder !== b.flavorOrder) return a.flavorOrder - b.flavorOrder;
    if (a.distanceMiles != null && b.distanceMiles != null && a.distanceMiles !== b.distanceMiles) {
      return a.distanceMiles - b.distanceMiles;
    }
    return (a.store.rank || 9999) - (b.store.rank || 9999);
  };

  within.sort(sorter);
  outside.sort(sorter);
  return { within, outside };
}

function topTraits(traitScores, limit = 3) {
  return Object.entries(traitScores)
    .sort((a, b) => b[1] - a[1])
    .filter((entry) => entry[1] > 0)
    .slice(0, limit)
    .map(([trait, score]) => ({
      trait,
      score: Math.round(score * 10) / 10,
    }));
}

function formatMiles(value) {
  if (!Number.isFinite(value)) return null;
  return `${value.toFixed(1)} mi`;
}

function renderAlternates(rows, locationText, radiusMiles) {
  els.resultAlternates.innerHTML = '';
  if (!rows || rows.length === 0) {
    const li = document.createElement('li');
    li.textContent = `No additional archetype matches within ${radiusMiles} miles of ${locationText}.`;
    els.resultAlternates.appendChild(li);
    return;
  }
  for (const row of rows.slice(0, 4)) {
    const li = document.createElement('li');
    const store = row.store;
    const distance = row.distanceMiles != null ? ` (${formatMiles(row.distanceMiles)})` : '';
    li.textContent = `${store.flavor} at ${store.name}${distance}`;
    els.resultAlternates.appendChild(li);
  }
}

async function sendQuizEvent(payload) {
  try {
    await fetch(`${WORKER_BASE}/api/v1/quiz/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Telemetry is best-effort only.
  }
}

async function runQuiz(evt) {
  evt.preventDefault();
  if (!state.activeQuiz) return;

  const locationText = els.locationInput.value.trim();
  if (!locationText) {
    setStatus('Add a city, ZIP, or coordinates first so we can find nearby flavors.', 'error');
    els.locationInput.focus();
    return;
  }
  const radiusMiles = Number(els.radiusSelect.value || 20);

  els.submitBtn.disabled = true;
  setStatus('Running your personality forecast and checking live nearby flavors...', 'loading');
  els.resultSection.hidden = true;

  try {
    const { traitScores } = collectAnswers(state.activeQuiz, els.form);
    const archetype = chooseArchetype(traitScores);
    if (!archetype) {
      throw new Error('Could not determine an archetype from the selected answers.');
    }
    const fallbackFlavor = pickResultFlavor(state.activeQuiz.id, archetype);
    const candidateFlavors = archetype.flavors || [];

    const [nearbyStores, center] = await Promise.all([
      fetchNearby(locationText),
      geocodeLocation(locationText).catch(() => null),
    ]);

    const ranked = rankAvailabilityMatches(nearbyStores, candidateFlavors, center, radiusMiles);
    const bestWithin = ranked.within[0] || null;
    const nearestOutside = ranked.outside[0] || null;
    const bestFlavor = bestWithin?.store?.flavor || fallbackFlavor;

    els.resultTitle.textContent = `${archetype.name}: ${archetype.headline}`;
    els.resultFlavor.textContent = bestFlavor || 'Flavor signal unavailable';
    els.resultBlurb.textContent = archetype.blurb || '';

    const traits = topTraits(traitScores, 3);
    els.resultTraits.textContent = traits.length
      ? `Top traits: ${traits.map((t) => `${t.trait} (${t.score})`).join(', ')}`
      : 'Top traits: balanced profile';

    if (bestWithin) {
      const dist = bestWithin.distanceMiles != null ? ` (${formatMiles(bestWithin.distanceMiles)})` : '';
      const store = bestWithin.store;
      els.resultAvailability.textContent = `Available now: ${store.flavor} at ${store.name}${dist}. ${store.address || ''}`.trim();
      setStatus('Forecast locked: at least one archetype flavor is available inside your radius.', 'success');
    } else if (nearestOutside) {
      const dist = nearestOutside.distanceMiles != null ? ` (${formatMiles(nearestOutside.distanceMiles)})` : '';
      els.resultAvailability.textContent = `No archetype flavors inside ${radiusMiles} miles right now. Closest is ${nearestOutside.store.flavor} at ${nearestOutside.store.name}${dist}.`;
      setStatus('No in-radius match right now; showing closest outside your selected radius.', 'neutral');
    } else {
      els.resultAvailability.textContent = `No current nearby stores matched your archetype flavors. Fallback pick: ${fallbackFlavor}.`;
      setStatus('No live local matches yet; fallback flavor personality selected.', 'neutral');
    }

    renderAlternates(ranked.within.slice(bestWithin ? 1 : 0), locationText, radiusMiles);
    const mapFlavor = bestWithin?.store?.flavor || fallbackFlavor || '';
    els.resultMapLink.href = `map.html?location=${encodeURIComponent(locationText)}&flavor=${encodeURIComponent(mapFlavor)}`;

    await sendQuizEvent({
      event_type: 'quiz_result',
      quiz_id: state.activeQuiz.id,
      archetype: archetype.id,
      result_flavor: bestFlavor,
      matched_flavor: bestWithin?.store?.flavor || null,
      matched_store_slug: bestWithin?.store?.slug || null,
      matched_distance_miles: bestWithin?.distanceMiles ?? null,
      radius_miles: radiusMiles,
      has_radius_match: Boolean(bestWithin),
      trait_scores: traitScores,
    });

    els.resultSection.hidden = false;
    els.resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    setStatus(`Unable to run quiz right now: ${err.message}`, 'error');
  } finally {
    els.submitBtn.disabled = false;
  }
}

async function setLocationFromCloudflare() {
  if (els.locationInput.value.trim()) return;
  try {
    const resp = await fetch(`${WORKER_BASE}/api/v1/geolocate`);
    if (!resp.ok) return;
    const geo = await resp.json();
    if (geo?.city && geo?.state) {
      els.locationInput.value = `${geo.city}, ${geo.state}`;
    }
  } catch {
    // no-op
  }
}

async function setLocationFromBrowser() {
  if (!navigator.geolocation) {
    setStatus('Browser geolocation is unavailable. Enter city, ZIP, or coordinates manually.', 'error');
    return;
  }
  setStatus('Detecting your location...', 'loading');
  await new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(4);
        const lon = pos.coords.longitude.toFixed(4);
        els.locationInput.value = `${lat},${lon}`;
        setStatus('Location set from browser GPS. Radius filtering will use exact distance.', 'success');
        resolve();
      },
      () => {
        setStatus('Could not access browser location. Enter city, ZIP, or coordinates manually.', 'error');
        resolve();
      },
      { timeout: 7000 },
    );
  });
}

function bindEvents() {
  els.variantSelect.addEventListener('change', () => {
    const next = getQuizById(els.variantSelect.value);
    if (!next) return;
    state.activeQuiz = next;
    renderQuestions(next);
    setStatus(`Loaded quiz: ${next.name}.`, 'neutral');
  });
  els.form.addEventListener('submit', runQuiz);
  els.geoBtn.addEventListener('click', (evt) => {
    evt.preventDefault();
    setLocationFromBrowser();
  });
}

async function init() {
  try {
    await loadConfigs();
    if (!state.quizzes.length || !state.archetypes.length) {
      throw new Error('Quiz configuration is missing.');
    }
    populateVariantSelect();
    renderQuestions(state.activeQuiz);
    bindEvents();
    await setLocationFromCloudflare();
    setStatus('Pick a quiz mode, answer five prompts, then get a live in-radius flavor match.', 'neutral');
  } catch (err) {
    setStatus(`Failed to initialize quiz engine: ${err.message}`, 'error');
    if (els.submitBtn) els.submitBtn.disabled = true;
  }
}

init();
