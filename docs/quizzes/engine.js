const WORKER_BASE = window.CustardPlanner.WORKER_BASE;

const QUIZ_CONFIG_PATHS = [
  'quizzes/quiz-weather-v1.json',
  'quizzes/quiz-classic-v1.json',
  'quizzes/quiz-date-night-v1.json',
  'quizzes/quiz-build-scoop-v1.json',
  'quizzes/quiz-compatibility-v1.json',
  'quizzes/quiz-trivia-v1.json',
];
const QUESTION_COUNT = 5;
const DYNAMIC_QUIZ_TTL_MS = 15 * 60 * 1000;

const state = {
  traits: [],
  archetypes: [],
  quizzes: [],
  activeQuiz: null,
  activeQuestionsByQuiz: {},
  flavorToArchetypeIds: new Map(),
  nearbyTraitCache: new Map(),
  dynamicQuizCache: new Map(),
  cfState: null,
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
  resultCone: document.getElementById('result-cone'),
  resultNarrative: document.getElementById('result-narrative'),
  resultCtas: document.getElementById('result-ctas'),
  resultNearestOutside: document.getElementById('result-nearest-outside'),
  resultNearestAny: document.getElementById('result-nearest-any'),
};

function setStatus(message, tone = 'neutral') {
  if (!els.status) return;
  els.status.textContent = message;
  els.status.className = `quiz-status quiz-status-${tone}`;
}

const normalizeFlavor = window.CustardPlanner.normalize;
const findSimilarFlavors = window.CustardPlanner.findSimilarFlavors;

// Culver's typical hours end around 10pm local. After that, today's flavors
// are wrapping up. We note this in result messaging.
function isAfterClosing() {
  return new Date().getHours() >= 22;
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

const haversineMiles = window.CustardPlanner.haversineMiles;

async function loadJson(path) {
  const resp = await fetch(path);
  if (!resp.ok) throw new Error(`Failed to load ${path}: ${resp.status}`);
  return resp.json();
}

function resolveDynamicQuizUrl(sourcePath) {
  if (typeof sourcePath !== 'string' || !sourcePath.trim()) return null;
  if (/^https?:\/\//i.test(sourcePath)) return sourcePath;
  if (sourcePath.startsWith('/')) return `${WORKER_BASE}${sourcePath}`;
  return `${WORKER_BASE}/${sourcePath}`;
}

function applyDynamicQuizData(quiz, data) {
  if (!quiz || !data) return;

  const remotePool = Array.isArray(data.question_pool)
    ? data.question_pool
    : (Array.isArray(data.questions) ? data.questions : null);
  if (remotePool && remotePool.length > 0) {
    quiz.question_pool = remotePool;
    quiz.questions = remotePool;
  }

  if (Number(data.question_count) > 0) {
    quiz.question_count = Math.round(Number(data.question_count));
  }
  if (typeof data.name === 'string' && data.name.trim()) quiz.name = data.name;
  if (typeof data.title === 'string' && data.title.trim()) quiz.title = data.title;
  if (typeof data.description === 'string' && data.description.trim()) quiz.description = data.description;
}

async function hydrateDynamicQuiz(quiz) {
  if (!quiz?.id || !quiz?.dynamic_source) return quiz;

  const now = Date.now();
  const cache = state.dynamicQuizCache.get(quiz.id);
  if (cache && now - cache.fetchedAt < DYNAMIC_QUIZ_TTL_MS) {
    applyDynamicQuizData(quiz, cache.data);
    return quiz;
  }

  const sourceUrl = resolveDynamicQuizUrl(quiz.dynamic_source);
  if (!sourceUrl) return quiz;

  try {
    const resp = await fetch(sourceUrl, { headers: { 'Accept': 'application/json' } });
    if (!resp.ok) throw new Error(`Dynamic quiz fetch failed (${resp.status})`);
    const data = await resp.json();
    const pool = Array.isArray(data?.question_pool) ? data.question_pool : data?.questions;
    if (!Array.isArray(pool) || pool.length === 0) throw new Error('Dynamic quiz returned no questions');

    const normalized = {
      ...data,
      question_pool: pool,
      question_count: Number(data?.question_count) > 0 ? Math.round(Number(data.question_count)) : quiz.question_count,
    };

    state.dynamicQuizCache.set(quiz.id, { fetchedAt: now, data: normalized });
    applyDynamicQuizData(quiz, normalized);
  } catch {
    if (cache?.data) applyDynamicQuizData(quiz, cache.data);
  }

  return quiz;
}

function getQuestionPool(quiz) {
  if (!quiz) return [];
  if (Array.isArray(quiz.question_pool)) return quiz.question_pool;
  if (Array.isArray(quiz.questions)) return quiz.questions;
  return [];
}

function getActiveQuestions(quiz) {
  if (!quiz) return [];
  return state.activeQuestionsByQuiz[quiz.id] || getQuestionPool(quiz);
}

function randomValue() {
  if (typeof crypto !== 'undefined' && crypto && typeof crypto.getRandomValues === 'function') {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] / 4294967296;
  }
  return Math.random();
}

function computeQuestionTraitSignals(question) {
  const out = {};
  const options = Array.isArray(question?.options) ? question.options : [];
  for (const option of options) {
    const traits = option?.traits || {};
    for (const [trait, raw] of Object.entries(traits)) {
      const value = Math.abs(Number(raw));
      if (!Number.isFinite(value) || value <= 0) continue;
      out[trait] = (out[trait] || 0) + value;
    }
  }
  return out;
}

function buildQuestionWeights(pool, favoredTraits) {
  const hasFavoredTraits = favoredTraits && Object.keys(favoredTraits).length > 0;
  return pool.map((question) => {
    if (!hasFavoredTraits) return 1;
    const signals = computeQuestionTraitSignals(question);
    let overlap = 0;
    for (const [trait, signal] of Object.entries(signals)) {
      const favor = Number(favoredTraits[trait] || 0);
      if (!Number.isFinite(favor) || favor <= 0) continue;
      overlap += signal * favor;
    }
    return 1 + overlap;
  });
}

function weightedSampleWithoutReplacement(pool, weights, count) {
  const items = pool.slice();
  const weightCopy = weights.slice();
  const selected = [];
  const picks = Math.min(Math.max(count, 0), items.length);

  for (let i = 0; i < picks; i += 1) {
    const total = weightCopy.reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
    let idx = 0;

    if (total <= 0) {
      idx = Math.floor(randomValue() * items.length);
    } else {
      let needle = randomValue() * total;
      for (let wi = 0; wi < weightCopy.length; wi += 1) {
        needle -= Math.max(0, Number(weightCopy[wi]) || 0);
        if (needle <= 0) {
          idx = wi;
          break;
        }
      }
    }

    selected.push(items[idx]);
    items.splice(idx, 1);
    weightCopy.splice(idx, 1);
  }

  return selected;
}

function buildFlavorToArchetypeIndex(archetypes) {
  const index = new Map();
  for (const archetype of archetypes) {
    const flavors = Array.isArray(archetype?.flavors) ? archetype.flavors : [];
    for (const flavor of flavors) {
      const normalized = normalizeFlavor(flavor);
      if (!normalized) continue;
      if (!index.has(normalized)) index.set(normalized, []);
      index.get(normalized).push(archetype.id);
    }
  }
  return index;
}

function computeFavoredTraitsFromFlavors(allFlavorsToday) {
  const favored = {};
  for (const rawFlavor of allFlavorsToday || []) {
    const key = normalizeFlavor(rawFlavor);
    const archetypeIds = state.flavorToArchetypeIds.get(key) || [];
    for (const archetypeId of archetypeIds) {
      const archetype = state.archetypes.find((a) => a.id === archetypeId);
      if (!archetype) continue;
      for (const [trait, raw] of Object.entries(archetype.profile || {})) {
        const value = Number(raw);
        if (!Number.isFinite(value) || value <= 0) continue;
        favored[trait] = (favored[trait] || 0) + value;
      }
    }
  }
  return favored;
}

async function fetchFavoredTraitsForLocation(locationText) {
  const key = String(locationText || '').trim().toLowerCase();
  if (!key) return null;
  if (state.nearbyTraitCache.has(key)) return state.nearbyTraitCache.get(key);

  try {
    const nearbyData = await fetchNearby(locationText);
    const favored = computeFavoredTraitsFromFlavors(nearbyData.all_flavors_today);
    state.nearbyTraitCache.set(key, favored);
    return favored;
  } catch {
    return null;
  }
}

function pickSessionQuestions(pool, favoredTraits, questionCount = QUESTION_COUNT) {
  if (!Array.isArray(pool) || pool.length === 0) return [];
  const count = Math.min(Math.max(Number(questionCount) || QUESTION_COUNT, 1), pool.length);
  const weights = buildQuestionWeights(pool, favoredTraits);
  return weightedSampleWithoutReplacement(pool, weights, count);
}

async function loadConfigs() {
  const [archetypeData, ...quizConfigs] = await Promise.all([
    loadJson('quizzes/flavor-archetypes.json'),
    ...QUIZ_CONFIG_PATHS.map((path) => loadJson(path)),
  ]);
  state.traits = Array.isArray(archetypeData?.traits) ? archetypeData.traits : [];
  state.archetypes = Array.isArray(archetypeData?.archetypes) ? archetypeData.archetypes : [];
  state.flavorToArchetypeIds = buildFlavorToArchetypeIndex(state.archetypes);
  state.quizzes = quizConfigs
    .filter((quiz) => quiz && quiz.id && Array.isArray(quiz.questions))
    .map((quiz) => ({
      ...quiz,
      question_pool: Array.isArray(quiz.question_pool) && quiz.question_pool.length ? quiz.question_pool : quiz.questions,
      question_count: Number(quiz.question_count) > 0 ? Math.round(Number(quiz.question_count)) : QUESTION_COUNT,
    }));
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

async function renderQuestions(quiz) {
  const hydratedQuiz = await hydrateDynamicQuiz(quiz);
  const pool = getQuestionPool(hydratedQuiz);
  const questionCount = Math.min(
    Math.max(Number(hydratedQuiz?.question_count) || QUESTION_COUNT, 1),
    Math.max(pool.length, 1),
  );
  const favoredTraits = await fetchFavoredTraitsForLocation(els.locationInput?.value || '');
  const selectedQuestions = pickSessionQuestions(pool, favoredTraits, questionCount);
  state.activeQuestionsByQuiz[hydratedQuiz.id] = selectedQuestions;

  els.questionsWrap.innerHTML = '';
  const template = document.getElementById('quiz-header-template');
  if (template) {
    const clone = template.content.cloneNode(true);
    clone.querySelector('[data-quiz-title]').textContent = hydratedQuiz.title;
    clone.querySelector('[data-quiz-description]').textContent = hydratedQuiz.description || '';
    els.questionsWrap.appendChild(clone);
  }

  selectedQuestions.forEach((question, idx) => {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'quiz-question';
    fieldset.dataset.questionId = question.id;

    const legend = document.createElement('legend');
    legend.textContent = `${idx + 1}. ${question.prompt}`;
    fieldset.appendChild(legend);

    const questionType = question.type || 'multiple_choice';

    if (questionType === 'ranking') {
      // Hidden input stores current order as "id1,id2,id3"
      const hiddenInput = document.createElement('input');
      hiddenInput.type = 'hidden';
      hiddenInput.name = question.id;
      fieldset.appendChild(hiddenInput);

      const rankingList = document.createElement('div');
      rankingList.className = 'quiz-ranking-list';

      (question.options || []).forEach((option) => {
        const card = document.createElement('div');
        card.className = 'quiz-ranking-card';
        card.dataset.optionId = option.id;
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');

        const badge = document.createElement('span');
        badge.className = 'quiz-rank-badge';

        const labelEl = document.createElement('span');
        labelEl.className = 'quiz-ranking-label';
        labelEl.textContent = option.label;

        card.appendChild(badge);
        card.appendChild(labelEl);

        function updateRankBadges() {
          const currentOrder = hiddenInput.value ? hiddenInput.value.split(',') : [];
          rankingList.querySelectorAll('.quiz-ranking-card').forEach((c) => {
            const rankIdx = currentOrder.indexOf(c.dataset.optionId);
            const b = c.querySelector('.quiz-rank-badge');
            if (rankIdx >= 0) {
              b.textContent = String(rankIdx + 1);
              c.classList.add('ranked');
            } else {
              b.textContent = '';
              c.classList.remove('ranked');
            }
          });
        }

        card.addEventListener('click', () => {
          const currentOrder = hiddenInput.value ? hiddenInput.value.split(',') : [];
          const optId = option.id;
          if (currentOrder.includes(optId)) {
            hiddenInput.value = currentOrder.filter((id) => id !== optId).join(',');
          } else {
            hiddenInput.value = [...currentOrder, optId].join(',');
          }
          updateRankBadges();
        });

        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
        });

        rankingList.appendChild(card);
      });

      fieldset.appendChild(rankingList);
    } else if (questionType === 'fill_in') {
      const textInput = document.createElement('input');
      textInput.type = 'text';
      textInput.name = question.id;
      textInput.className = 'quiz-fill-in-input';
      textInput.placeholder = question.placeholder || 'Type your answer...';
      textInput.autocomplete = 'off';
      fieldset.appendChild(textInput);
    } else {
      // Default: multiple_choice
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

        const iconSvg = option.icon && window.QuizSprites
          ? window.QuizSprites.resolve(option.icon, 4) : '';

        label.appendChild(input);

        const copy = document.createElement('span');
        copy.className = 'quiz-option-copy';

        if (iconSvg) {
          label.classList.add('has-icon');
          const iconEl = document.createElement('span');
          iconEl.className = 'quiz-option-icon';
          iconEl.setAttribute('aria-hidden', 'true');
          iconEl.innerHTML = iconSvg;
          copy.appendChild(iconEl);
        }

        const textEl = document.createElement('span');
        textEl.className = 'quiz-option-label';
        textEl.textContent = option.label;
        copy.appendChild(textEl);

        label.appendChild(copy);
        grid.appendChild(label);
      });
    }

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
  const commentaries = [];
  const trivia = { correct: 0, total: 0, accuracy: null, answerFeedback: [] };
  const questions = getActiveQuestions(quiz);

  for (const trait of state.traits) {
    traitScores[trait] = 0;
  }

  for (const question of questions) {
    const questionType = question.type || 'multiple_choice';

    if (questionType === 'fill_in') {
      const answer = String(data.get(question.id) || '').trim();
      if (!answer) {
        throw new Error('Please answer all questions before running your custard forecast.');
      }
      selected[question.id] = answer;
      if (typeof question.correct_answer === 'string' && question.correct_answer) {
        trivia.total += 1;
        if (answer.toLowerCase() === question.correct_answer.toLowerCase().trim()) {
          trivia.correct += 1;
        }
        trivia.answerFeedback.push(`Answer: ${question.correct_answer}`);
      }
    } else if (questionType === 'ranking') {
      const orderStr = String(data.get(question.id) || '');
      const orderIds = orderStr ? orderStr.split(',').filter(Boolean) : [];
      const optionCount = Array.isArray(question.options) ? question.options.length : 0;
      if (orderIds.length < optionCount) {
        throw new Error('Please rank all options before running your custard forecast.');
      }
      selected[question.id] = orderStr;
      if (Array.isArray(question.correct_order) && question.correct_order.length > 0) {
        trivia.total += 1;
        const isCorrect = question.correct_order.every((id, idx) => orderIds[idx] === id);
        if (isCorrect) trivia.correct += 1;
        const correctLabels = question.correct_order.map((id) => {
          const opt = (question.options || []).find((o) => o.id === id);
          return opt ? opt.label : id;
        });
        trivia.answerFeedback.push(`Correct order: ${correctLabels.join(' \u2192 ')}`);
      }
    } else {
      // multiple_choice (default)
      const selectedId = data.get(question.id);
      if (!selectedId) {
        throw new Error('Please answer all questions before running your custard forecast.');
      }
      selected[question.id] = String(selectedId);
      const selectedOption = question.options.find((opt) => opt.id === selectedId);
      if (!selectedOption) continue;
      if (typeof question.correct_option_id === 'string' && question.correct_option_id) {
        trivia.total += 1;
        if (question.correct_option_id === String(selectedId)) {
          trivia.correct += 1;
        }
      }
      if (selectedOption.commentary) {
        commentaries.push(selectedOption.commentary);
      }
      const deltas = selectedOption.traits || {};
      for (const [trait, delta] of Object.entries(deltas)) {
        if (typeof traitScores[trait] !== 'number') traitScores[trait] = 0;
        const value = Number(delta);
        if (!Number.isFinite(value)) continue;
        traitScores[trait] += value;
      }
    }
  }

  if (trivia.total > 0) {
    trivia.accuracy = trivia.correct / trivia.total;
  }

  return { traitScores, selected, commentaries, trivia };
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
  return {
    nearby: Array.isArray(data?.nearby) ? data.nearby : [],
    all_flavors_today: Array.isArray(data?.all_flavors_today) ? data.all_flavors_today : [],
  };
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

/**
 * Build an encouraging fallback nudge when the archetype flavor isn't nearby.
 * Points the user toward whatever IS actually available at the nearest store.
 */
function buildFallbackEncouragement(nearestStore, nearestDistance) {
  if (!nearestStore) return null;
  const flavor = nearestStore.flavor;
  const storeName = nearestStore.name;
  const dist = formatMiles(nearestDistance);
  const distLabel = dist ? ` (${dist})` : '';

  const nudges = [
    `Or just go grab some ${flavor} at ${storeName}${distLabel} -- no quiz can hold you down!`,
    `Meanwhile, ${storeName}${distLabel} is scooping ${flavor} right now. Custard waits for no one.`,
    `Good news: ${storeName}${distLabel} has ${flavor} ready to go. Your taste buds won't know the difference.`,
    `Plot twist: ${flavor} at ${storeName}${distLabel} is calling your name. Go get it.`,
  ];

  // Deterministic-ish pick based on flavor + store name length so the same
  // query yields the same nudge, but different stores rotate the message.
  const seed = (flavor.length + storeName.length) % nudges.length;
  return nudges[seed];
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

async function fetchStateLeaderboard(state) {
  const statesParam = state ? `&states=${encodeURIComponent(state)}` : '';
  const url = `${WORKER_BASE}/api/v1/leaderboard/state?days=90&limit=5${statesParam}`;
  try {
    const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
}

function renderLeaderboardSection(data, locationText) {
  if (!data?.state_leaders) return;
  const entries = Object.entries(data.state_leaders);
  if (entries.length === 0) return;

  // Pick the first state's data (or 'national' fallback)
  const [stateKey, flavors] = entries[0];
  if (!Array.isArray(flavors) || flavors.length === 0) return;

  const container = document.getElementById('quiz-result-leaderboard');
  if (!container) return;

  const label = stateKey === 'national' ? 'National' : stateKey;
  const header = document.createElement('h4');
  header.className = 'leaderboard-header';
  header.textContent = `Community Favorites (${label}, last 90 days)`;
  container.appendChild(header);

  const list = document.createElement('ol');
  list.className = 'leaderboard-list';
  for (const entry of flavors.slice(0, 5)) {
    const li = document.createElement('li');
    li.textContent = entry.flavor;
    list.appendChild(li);
  }
  container.appendChild(list);
  container.hidden = false;
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
    const { traitScores, commentaries, trivia } = collectAnswers(state.activeQuiz, els.form);
    const archetype = chooseArchetype(traitScores);
    if (!archetype) {
      throw new Error('Could not determine an archetype from the selected answers.');
    }
    const candidateFlavors = archetype.flavors || [];
    const lateNight = isAfterClosing();

    // Fetch nearby data and geocode in parallel
    const [nearbyData, center] = await Promise.all([
      fetchNearby(locationText),
      geocodeLocation(locationText).catch(() => null),
    ]);

    const stores = nearbyData.nearby;
    const allFlavorsToday = nearbyData.all_flavors_today;

    // -- Step 1: Match archetype candidates against what is actually available --
    const normalizedCandidates = new Map(candidateFlavors.map((f) => [normalizeFlavor(f), f]));
    const normalizedAvailable = new Map(allFlavorsToday.map((f) => [normalizeFlavor(f), f]));

    let matchedFlavor = null;
    for (const [normCandidate, originalCandidate] of normalizedCandidates) {
      if (normalizedAvailable.has(normCandidate)) {
        matchedFlavor = originalCandidate;
        break;
      }
    }

    // -- Step 2: If no exact match, try similarity groups --
    let similarMatch = null;
    if (!matchedFlavor) {
      for (const candidate of candidateFlavors) {
        const similar = findSimilarFlavors(candidate, allFlavorsToday);
        if (similar.length > 0) {
          const normSimilar = similar[0];
          for (const avail of allFlavorsToday) {
            if (normalizeFlavor(avail) === normSimilar) {
              similarMatch = avail;
              break;
            }
          }
          if (similarMatch) break;
        }
      }
    }

    // -- Step 3: Find the best store serving the matched flavor --
    const resultFlavor = matchedFlavor || similarMatch;
    let bestStore = null;
    let bestDistance = null;
    let nearestOutside = null;
    let nearestOutsideDistance = null;
    if (resultFlavor && center) {
      const normalizedResult = normalizeFlavor(resultFlavor);
      const allMatching = stores
        .filter((s) => normalizeFlavor(s.flavor) === normalizedResult)
        .map((s) => {
          const lat = Number(s.lat);
          const lon = Number(s.lon);
          let dist = null;
          if (Number.isFinite(lat) && Number.isFinite(lon)) {
            dist = haversineMiles(center.lat, center.lon, lat, lon);
          }
          return { ...s, _dist: dist };
        })
        .filter((s) => s._dist != null)
        .sort((a, b) => a._dist - b._dist);
      const withinRadius = allMatching.filter((s) => s._dist <= radiusMiles);
      const outsideRadius = allMatching.filter((s) => s._dist > radiusMiles);
      if (withinRadius.length > 0) {
        bestStore = withinRadius[0];
        bestDistance = withinRadius[0]._dist;
      }
      if (outsideRadius.length > 0) {
        nearestOutside = outsideRadius[0];
        nearestOutsideDistance = outsideRadius[0]._dist;
      }
    }

    // -- Step 4: Fallback if nothing matched --
    const fallbackFlavor = resultFlavor ? null : pickResultFlavor(state.activeQuiz.id, archetype);
    const displayFlavor = resultFlavor || fallbackFlavor;

    // -- Step 5: Build ranked alternates from any archetype + similarity matches --
    // Collect all available flavors that match archetype or similarity groups
    const alternateRows = [];
    const usedFlavors = new Set();
    if (resultFlavor) usedFlavors.add(normalizeFlavor(resultFlavor));

    for (const candidate of candidateFlavors) {
      const normCand = normalizeFlavor(candidate);
      if (usedFlavors.has(normCand)) continue;
      if (!normalizedAvailable.has(normCand)) continue;
      // Find stores serving this flavor within radius
      for (const s of stores) {
        if (normalizeFlavor(s.flavor) !== normCand) continue;
        const lat = Number(s.lat);
        const lon = Number(s.lon);
        let dist = null;
        if (center && Number.isFinite(lat) && Number.isFinite(lon)) {
          dist = haversineMiles(center.lat, center.lon, lat, lon);
        }
        if (dist != null && dist <= radiusMiles) {
          alternateRows.push({ store: s, distanceMiles: dist });
          usedFlavors.add(normCand);
          break;
        }
      }
    }
    alternateRows.sort((a, b) => (a.distanceMiles || 0) - (b.distanceMiles || 0));

    // -- Step 5b: Find nearest store within radius serving ANY flavor --
    let nearestAnyStore = null;
    let nearestAnyDistance = null;
    if (center && stores.length > 0) {
      const withinAny = stores
        .map((s) => {
          const lat = Number(s.lat);
          const lon = Number(s.lon);
          let dist = null;
          if (Number.isFinite(lat) && Number.isFinite(lon)) {
            dist = haversineMiles(center.lat, center.lon, lat, lon);
          }
          return { ...s, _dist: dist };
        })
        .filter((s) => s._dist != null && s._dist <= radiusMiles)
        .sort((a, b) => a._dist - b._dist);
      if (withinAny.length > 0) {
        // Skip if it's the same store+flavor as bestStore
        for (const s of withinAny) {
          if (bestStore && s.slug === bestStore.slug && normalizeFlavor(s.flavor) === normalizeFlavor(resultFlavor)) continue;
          nearestAnyStore = s;
          nearestAnyDistance = s._dist;
          break;
        }
      }
    }

    // -- Render results --
    els.resultTitle.textContent = `${archetype.name}: ${archetype.headline}`;
    els.resultFlavor.textContent = displayFlavor || 'Flavor signal unavailable';
    els.resultBlurb.textContent = archetype.blurb || '';

    // Render cone icon for the result flavor
    if (els.resultCone) {
      if (displayFlavor && typeof window.renderMiniConeHDSVG === 'function') {
        els.resultCone.innerHTML = window.renderMiniConeHDSVG(displayFlavor, 5);
      } else if (displayFlavor && typeof window.renderMiniConeSVG === 'function') {
        els.resultCone.innerHTML = window.renderMiniConeSVG(displayFlavor, 8);
      } else {
        els.resultCone.innerHTML = '';
      }
    }

    // Build narrative "train of thought" from answer commentaries
    if (els.resultNarrative) {
      if (commentaries.length >= 2) {
        // Pick 3 commentaries (first, middle, last) for variety
        const picks = [commentaries[0]];
        if (commentaries.length >= 3) picks.push(commentaries[Math.floor(commentaries.length / 2)]);
        picks.push(commentaries[commentaries.length - 1]);
        const narrative = picks.join('... ') + '... that all adds up to ' + (displayFlavor || 'something special') + '.';
        els.resultNarrative.textContent = narrative;
        els.resultNarrative.hidden = false;
      } else {
        els.resultNarrative.hidden = true;
      }
    }

    const traits = topTraits(traitScores, 3);
    const triviaLabel = trivia.total > 0 ? ` Trivia: ${trivia.correct}/${trivia.total} correct.` : '';
    const feedbackLabel = trivia.answerFeedback && trivia.answerFeedback.length > 0
      ? ' ' + trivia.answerFeedback.join(' ')
      : '';
    els.resultTraits.textContent = traits.length
      ? `Top traits: ${traits.map((t) => `${t.trait} (${t.score})`).join(', ')}.${triviaLabel}${feedbackLabel}`
      : `Top traits: balanced profile.${triviaLabel}${feedbackLabel}`;

    const lateNote = lateNight ? ' Last chance tonight -- stores close around 10pm.' : '';

    // Reset CTAs and nearest-outside
    els.resultCtas.innerHTML = '';
    els.resultNearestOutside.hidden = true;

    if (resultFlavor && bestStore) {
      const dist = bestDistance != null ? ` (${formatMiles(bestDistance)})` : '';
      const addr = bestStore.address ? ` ${bestStore.address}` : '';
      els.resultAvailability.textContent =
        `Available now: ${resultFlavor} at ${bestStore.name}${dist}.${addr}${lateNote}`.trim();

      // Action CTAs for the matched store
      els.resultCtas.innerHTML = CustardPlanner.actionCTAsHTML({
        slug: bestStore.slug,
        storeName: bestStore.name,
        lat: Number(bestStore.lat),
        lon: Number(bestStore.lon),
        workerBase: WORKER_BASE,
        actions: ['directions', 'alert', 'calendar'],
      });

      if (similarMatch && !matchedFlavor) {
        setStatus(
          `No exact archetype flavor today, but ${similarMatch} is a close match and available nearby.`,
          'success',
        );
      } else {
        setStatus('Forecast locked: your archetype flavor is scooping nearby right now.', 'success');
      }
    } else if (resultFlavor && !bestStore) {
      els.resultAvailability.textContent =
        `${resultFlavor} is scooping today, but not within ${radiusMiles} miles of your location.${lateNote}`.trim();

      // Show nearest outside-radius store serving the archetype flavor
      if (nearestOutside) {
        const outsideDist = formatMiles(nearestOutsideDistance);
        els.resultNearestOutside.textContent =
          `Nearest: ${nearestOutside.name} (${outsideDist}).`;
        els.resultNearestOutside.hidden = false;

        // Offer alert + calendar CTAs for the outside-radius store
        els.resultCtas.innerHTML = CustardPlanner.actionCTAsHTML({
          slug: nearestOutside.slug,
          storeName: nearestOutside.name,
          lat: Number(nearestOutside.lat),
          lon: Number(nearestOutside.lon),
          workerBase: WORKER_BASE,
          actions: ['alert', 'calendar'],
        });
      }

      // Encourage the user toward whatever IS within radius
      const outsideNudge = buildFallbackEncouragement(nearestAnyStore, nearestAnyDistance);
      if (nearestAnyStore && outsideNudge) {
        const coneSvg = typeof window.renderMiniConeSVG === 'function'
          ? `<span class="nearest-any-cone">${window.renderMiniConeSVG(nearestAnyStore.flavor, 4)}</span>` : '';
        // Append the encouragement after any existing CTAs
        els.resultCtas.innerHTML +=
          `<div class="fallback-encouragement">${coneSvg}<span>${outsideNudge}</span></div>` +
          CustardPlanner.actionCTAsHTML({
            slug: nearestAnyStore.slug,
            storeName: nearestAnyStore.name,
            lat: Number(nearestAnyStore.lat),
            lon: Number(nearestAnyStore.lon),
            workerBase: WORKER_BASE,
            actions: ['directions'],
          });
      }

      setStatus('Your flavor is available today, just outside your drive radius.', 'neutral');
    } else {
      const tomorrow = lateNight ? ' Check back tomorrow morning for fresh forecasts.' : ' Check back tomorrow.';
      els.resultAvailability.textContent =
        `Your archetype flavor ${fallbackFlavor} is not scooping nearby today.${tomorrow}`.trim();

      // Instead of a dead-end, nudge toward whatever IS available at the nearest store
      const fallbackNudge = buildFallbackEncouragement(nearestAnyStore, nearestAnyDistance);
      if (nearestAnyStore && fallbackNudge) {
        const coneSvg = typeof window.renderMiniConeSVG === 'function'
          ? `<span class="nearest-any-cone">${window.renderMiniConeSVG(nearestAnyStore.flavor, 4)}</span>` : '';
        els.resultCtas.innerHTML =
          `<div class="fallback-encouragement">${coneSvg}<span>${fallbackNudge}</span></div>` +
          CustardPlanner.actionCTAsHTML({
            slug: nearestAnyStore.slug,
            storeName: nearestAnyStore.name,
            lat: Number(nearestAnyStore.lat),
            lon: Number(nearestAnyStore.lon),
            workerBase: WORKER_BASE,
            actions: ['directions', 'alert', 'calendar'],
          });
        setStatus('No archetype match today, but there is custard nearby worth the trip.', 'neutral');
      } else {
        // Truly nothing within radius -- offer general alert link
        els.resultCtas.innerHTML = '<div class="cta-row"><a href="alerts.html" class="cta-link cta-alert">Set Flavor Alert</a></div>';
        setStatus('No live matches today; showing your archetype flavor for reference.', 'neutral');
      }
    }

    // Render nearest store within radius serving any flavor.
    // Skip when a fallback encouragement already features this store (no-match
    // and outside-radius branches) to avoid duplicating the same info.
    const fallbackAlreadyShown = !resultFlavor || (resultFlavor && !bestStore);
    if (els.resultNearestAny) {
      els.resultNearestAny.hidden = true;
      if (nearestAnyStore && !fallbackAlreadyShown) {
        const dist = formatMiles(nearestAnyDistance);
        const coneSvg = typeof window.renderMiniConeSVG === 'function'
          ? `<span class="nearest-any-cone">${window.renderMiniConeSVG(nearestAnyStore.flavor, 4)}</span>` : '';
        els.resultNearestAny.innerHTML =
          `<strong>Nearest in radius:</strong> ${coneSvg}${nearestAnyStore.flavor} at ${nearestAnyStore.name}` +
          (dist ? ` (${dist})` : '');
        els.resultNearestAny.hidden = false;
      }
    }

    renderAlternates(alternateRows, locationText, radiusMiles);
    const mapFlavor = resultFlavor || fallbackFlavor || '';
    els.resultMapLink.href = `map.html?location=${encodeURIComponent(locationText)}&flavor=${encodeURIComponent(mapFlavor)}`;

    await sendQuizEvent({
      event_type: 'quiz_result',
      quiz_id: state.activeQuiz.id,
      archetype: archetype.id,
      result_flavor: displayFlavor,
      matched_flavor: resultFlavor || null,
      similar_match: similarMatch ? true : false,
      matched_store_slug: bestStore?.slug || null,
      matched_distance_miles: bestDistance ?? null,
      nearest_outside_slug: nearestOutside?.slug || null,
      nearest_outside_miles: nearestOutsideDistance ?? null,
      radius_miles: radiusMiles,
      has_radius_match: Boolean(bestStore),
      alternates_count: alternateRows.length,
      fallback_encouragement_shown: Boolean(
        (!resultFlavor || (resultFlavor && !bestStore)) && nearestAnyStore
      ),
      fallback_store_slug: (!resultFlavor || (resultFlavor && !bestStore)) ? (nearestAnyStore?.slug || null) : null,
      trivia_correct: trivia.total > 0 ? trivia.correct : null,
      trivia_total: trivia.total > 0 ? trivia.total : null,
      trait_scores: traitScores,
      page_load_id: CustardPlanner.getPageLoadId(),
    });

    els.resultSection.hidden = false;
    els.resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Non-blocking: load community flavor leaderboard for user's state
    fetchStateLeaderboard(state.cfState).then((data) => {
      renderLeaderboardSection(data, locationText);
    });
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
      state.cfState = geo.state;
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
        Promise.resolve(state.activeQuiz ? renderQuestions(state.activeQuiz) : null).finally(() => {
          setStatus('Location set from browser GPS. Radius filtering will use exact distance.', 'success');
          resolve();
        });
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
  els.variantSelect.addEventListener('change', async () => {
    const next = getQuizById(els.variantSelect.value);
    if (!next) return;
    state.activeQuiz = next;
    await renderQuestions(next);
    setStatus(`Loaded quiz: ${next.name}.`, 'neutral');
  });
  els.form.addEventListener('submit', runQuiz);
  els.geoBtn.addEventListener('click', (evt) => {
    evt.preventDefault();
    setLocationFromBrowser();
  });
  if (els.locationInput) {
    els.locationInput.addEventListener('change', async () => {
      if (!state.activeQuiz) return;
      await renderQuestions(state.activeQuiz);
      setStatus('Question mix updated for this location.', 'neutral');
    });
  }
}

async function init() {
  try {
    await loadConfigs();
    if (!state.quizzes.length || !state.archetypes.length) {
      throw new Error('Quiz configuration is missing.');
    }
    populateVariantSelect();
    await setLocationFromCloudflare();
    await renderQuestions(state.activeQuiz);
    bindEvents();
    setStatus('Pick a quiz mode, answer five prompts, then get a live in-radius flavor match.', 'neutral');
  } catch (err) {
    setStatus(`Failed to initialize quiz engine: ${err.message}`, 'error');
    if (els.submitBtn) els.submitBtn.disabled = true;
  }
}

init();
