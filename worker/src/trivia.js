import { STORE_INDEX as DEFAULT_STORE_INDEX } from './store-index.js';
import { normalize } from './flavor-matcher.js';
import { TRIVIA_METRICS_SEED } from './trivia-metrics-seed.js';

const DEFAULT_DAYS = 365;
const MAX_DAYS = 730;
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const MONTH_NAMES = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function jsonResponse(payload, corsHeaders, status = 200) {
  return Response.json(payload, { status, headers: corsHeaders });
}

function parseBoundedInt(url, key, defaultValue, min, max) {
  const raw = Number(url.searchParams.get(key));
  if (!Number.isFinite(raw)) return defaultValue;
  const rounded = Math.round(raw);
  return Math.min(Math.max(rounded, min), max);
}

function hashString(value) {
  let h = 0;
  const str = String(value || '');
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function stableShuffle(items, seed) {
  const out = items.slice();
  let s = hashString(seed) || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

function profileForFlavor(rawFlavor) {
  const n = normalize(rawFlavor);
  if (!n) return { adventurous: 1, social: 1 };
  if (/mint|lemon/.test(n)) return { calm: 2, analytical: 1 };
  if (/chocolate|brownie|dark|devil/.test(n)) return { bold: 2, energetic: 1 };
  if (/caramel|pecan|butter|vanilla/.test(n)) return { classic: 2, analytical: 1 };
  if (/berry|strawberry|raspberry|peach/.test(n)) return { romantic: 2, social: 1 };
  if (/cheesecake|turtle|oreo/.test(n)) return { romantic: 1, classic: 1, social: 1 };
  if (/cookie|peanut|snickers/.test(n)) return { energetic: 1, social: 2 };
  return { adventurous: 2, calm: 1 };
}

function profileForState(state) {
  const profiles = [
    { classic: 2, calm: 1 },
    { social: 2, energetic: 1 },
    { adventurous: 2, bold: 1 },
    { analytical: 2, romantic: 1 },
  ];
  const idx = hashString(state) % profiles.length;
  return profiles[idx];
}

function toTopEntries(map, limit = 10) {
  return [...map.values()]
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return String(a.label || a.key).localeCompare(String(b.label || b.key));
    })
    .slice(0, limit);
}

function makeOption(id, label, traits) {
  return { id, label, traits };
}

function flavorOption(entry) {
  return makeOption(`flavor-${entry.key}`, entry.label, profileForFlavor(entry.key));
}

function stateOption(entry) {
  return makeOption(`state-${entry.key}`, entry.label, profileForState(entry.key));
}

function withCorrectOptionId(options, answerId, seed) {
  const shuffled = stableShuffle(options, seed);
  return {
    options: shuffled,
    correct_option_id: shuffled.find((o) => o.id === answerId)?.id || shuffled[0]?.id || null,
  };
}

function sanitizeKey(value, fallbackPrefix = 'key') {
  const raw = String(value || '').trim().toLowerCase();
  const clean = raw.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (clean) return clean;
  return `${fallbackPrefix}-${hashString(value || fallbackPrefix)}`;
}

function monthLabel(monthNum) {
  const month = Number(monthNum);
  if (!Number.isFinite(month) || month < 1 || month > 12) return 'Unknown month';
  return MONTH_NAMES[Math.round(month)] || 'Unknown month';
}

function fallbackQuestions() {
  return [
    {
      id: 'trivia-fallback-1',
      prompt: 'Which flavor type sounds most fun to chase today?',
      options: [
        { id: 'f1a', label: 'Rare one-off finds', traits: { adventurous: 2, bold: 1 } },
        { id: 'f1b', label: 'Classic staples', traits: { classic: 2, calm: 1 } },
        { id: 'f1c', label: 'Chocolate-heavy options', traits: { energetic: 2, bold: 1 } },
        { id: 'f1d', label: 'Fruit-forward picks', traits: { romantic: 2, social: 1 } },
      ],
      correct_option_id: 'f1a',
    },
    {
      id: 'trivia-fallback-2',
      prompt: 'If two stores tie on distance, what breaks the tie for you?',
      options: [
        { id: 'f2a', label: 'Best evidence depth', traits: { analytical: 2, classic: 1 } },
        { id: 'f2b', label: 'Most interesting signal', traits: { adventurous: 2, romantic: 1 } },
        { id: 'f2c', label: 'Most social plan', traits: { social: 2, energetic: 1 } },
        { id: 'f2d', label: 'Boldest choice', traits: { bold: 2, energetic: 1 } },
      ],
      correct_option_id: 'f2a',
    },
    {
      id: 'trivia-fallback-3',
      prompt: 'Which style best matches your flavor strategy?',
      options: [
        { id: 'f3a', label: 'Reliable and repeatable', traits: { classic: 2, calm: 1 } },
        { id: 'f3b', label: 'Fast and opportunistic', traits: { energetic: 2, bold: 1 } },
        { id: 'f3c', label: 'Explore and discover', traits: { adventurous: 2, social: 1 } },
        { id: 'f3d', label: 'Thoughtful and seasonal', traits: { analytical: 2, romantic: 1 } },
      ],
      correct_option_id: 'f3d',
    },
    {
      id: 'trivia-fallback-4',
      prompt: 'Which signal do you trust first?',
      options: [
        { id: 'f4a', label: 'Confirmed schedule', traits: { classic: 2, analytical: 1 } },
        { id: 'f4b', label: 'Nearby activity', traits: { social: 2, energetic: 1 } },
        { id: 'f4c', label: 'Rare-find alert', traits: { adventurous: 2, bold: 1 } },
        { id: 'f4d', label: 'Seasonal pattern', traits: { romantic: 2, calm: 1 } },
      ],
      correct_option_id: 'f4a',
    },
    {
      id: 'trivia-fallback-5',
      prompt: 'What feels like a trivia win to you?',
      options: [
        { id: 'f5a', label: 'Predicting the exact flavor', traits: { analytical: 2, bold: 1 } },
        { id: 'f5b', label: 'Finding the closest match', traits: { classic: 2, calm: 1 } },
        { id: 'f5c', label: 'Planning a group run', traits: { social: 2, energetic: 1 } },
        { id: 'f5d', label: 'Spotting a hidden gem', traits: { adventurous: 2, romantic: 1 } },
      ],
      correct_option_id: 'f5d',
    },
  ];
}

function buildTriviaQuestions(aggregates, days, limit) {
  const { stateTotals, stateFlavorCounts, storeTotals, storeFlavorCounts, flavorTotals, storeMetaBySlug } = aggregates;
  const questions = [];

  const topStates = toTopEntries(stateTotals, 10);
  const topFlavors = toTopEntries(flavorTotals, 20);
  const topStores = toTopEntries(storeTotals, 20);

  // Q1: Most common flavor in top state.
  if (topStates.length > 0 && topFlavors.length > 0) {
    const topState = topStates[0];
    const stateFlavorMap = stateFlavorCounts.get(topState.key) || new Map();
    const stateFlavorTop = toTopEntries(stateFlavorMap, 6);
    if (stateFlavorTop.length > 0) {
      const correct = stateFlavorTop[0];
      const optionPool = [...stateFlavorTop];
      for (const entry of topFlavors) {
        if (optionPool.find((o) => o.key === entry.key)) continue;
        optionPool.push(entry);
        if (optionPool.length >= 4) break;
      }
      const rawOptions = optionPool.slice(0, 4).map(flavorOption);
      const fixed = withCorrectOptionId(rawOptions, `flavor-${correct.key}`, `state-top-${topState.key}`);
      questions.push({
        id: `trivia-state-top-${topState.key.toLowerCase()}`,
        prompt: `In ${topState.label}, which flavor appeared most often over the last ${days} days?`,
        options: fixed.options,
        correct_option_id: fixed.correct_option_id,
      });
    }
  }

  // Q2: Most common flavor at top-volume store.
  if (topStores.length > 0) {
    const spotlight = topStores[0];
    const storeFlavorMap = storeFlavorCounts.get(spotlight.key) || new Map();
    const storeFlavorTop = toTopEntries(storeFlavorMap, 6);
    if (storeFlavorTop.length > 0) {
      const correct = storeFlavorTop[0];
      const optionPool = [...storeFlavorTop];
      for (const entry of topFlavors) {
        if (optionPool.find((o) => o.key === entry.key)) continue;
        optionPool.push(entry);
        if (optionPool.length >= 4) break;
      }
      const rawOptions = optionPool.slice(0, 4).map(flavorOption);
      const fixed = withCorrectOptionId(rawOptions, `flavor-${correct.key}`, `store-top-${spotlight.key}`);
      const storeName = storeMetaBySlug.get(spotlight.key)?.name || spotlight.key;
      questions.push({
        id: `trivia-store-top-${spotlight.key.toLowerCase()}`,
        prompt: `At ${storeName}, which flavor appeared most often over the last ${days} days?`,
        options: fixed.options,
        correct_option_id: fixed.correct_option_id,
      });
    }
  }

  // Q3: Rarest among high-volume set.
  if (topFlavors.length >= 4) {
    const candidates = topFlavors.slice(0, Math.min(10, topFlavors.length));
    const rare = candidates[candidates.length - 1];
    const heads = candidates.slice(0, 3);
    const optionSet = [rare, ...heads.filter((c) => c.key !== rare.key)].slice(0, 4);
    const rawOptions = optionSet.map(flavorOption);
    const fixed = withCorrectOptionId(rawOptions, `flavor-${rare.key}`, `rare-${rare.key}`);
    questions.push({
      id: 'trivia-rarest-among-popular',
      prompt: `Which flavor is the rarest in this ${days}-day snapshot sample?`,
      options: fixed.options,
      correct_option_id: fixed.correct_option_id,
    });
  }

  // Q4: Most widespread flavor by distinct stores.
  const widespread = [...flavorTotals.values()]
    .map((entry) => ({ ...entry, stores: entry.stores || 0 }))
    .sort((a, b) => {
      if (b.stores !== a.stores) return b.stores - a.stores;
      if (b.count !== a.count) return b.count - a.count;
      return String(a.label).localeCompare(String(b.label));
    });
  if (widespread.length >= 4) {
    const topSpread = widespread.slice(0, 4);
    const correct = topSpread[0];
    const rawOptions = topSpread.map((entry) => flavorOption(entry));
    const fixed = withCorrectOptionId(rawOptions, `flavor-${correct.key}`, 'spread');
    questions.push({
      id: 'trivia-most-widespread',
      prompt: `Which flavor appeared at the most distinct stores over the last ${days} days?`,
      options: fixed.options,
      correct_option_id: fixed.correct_option_id,
    });
  }

  // Q5: Highest total observation state.
  if (topStates.length >= 4) {
    const stateOptions = topStates.slice(0, 4);
    const correct = stateOptions[0];
    const rawOptions = stateOptions.map((entry) => stateOption(entry));
    const fixed = withCorrectOptionId(rawOptions, `state-${correct.key}`, 'state-count');
    questions.push({
      id: 'trivia-top-state-volume',
      prompt: `Which state logged the highest total flavor observations over the last ${days} days?`,
      options: fixed.options,
      correct_option_id: fixed.correct_option_id,
    });
  }

  return questions.slice(0, limit);
}

function buildMetricsSeedQuestions(seed, limit) {
  if (!seed || typeof seed !== 'object') return [];

  const questions = [];
  const topFlavors = Array.isArray(seed.top_flavors)
    ? seed.top_flavors.filter((row) => typeof row?.title === 'string' && row.title.trim())
    : [];
  const topStores = Array.isArray(seed.top_stores)
    ? seed.top_stores.filter((row) => typeof row?.store_slug === 'string' && row.store_slug.trim())
    : [];
  const seasonalSpotlights = Array.isArray(seed.seasonal_spotlights)
    ? seed.seasonal_spotlights.filter((row) => typeof row?.title === 'string' && row.title.trim())
    : [];
  const asOf = String(seed.as_of || '').trim() || 'latest run';

  if (topFlavors.length >= 4) {
    const optionsPool = topFlavors.slice(0, 4);
    const correct = optionsPool[0];
    const rawOptions = optionsPool.map((row) => makeOption(
      `metrics-flavor-${sanitizeKey(row.title, 'flavor')}`,
      row.title,
      profileForFlavor(row.title),
    ));
    const fixed = withCorrectOptionId(
      rawOptions,
      `metrics-flavor-${sanitizeKey(correct.title, 'flavor')}`,
      'metrics-top-flavor',
    );
    questions.push({
      id: 'metrics-top-flavor',
      prompt: `Across the full historical metrics pack (through ${asOf}), which flavor appears most often?`,
      options: fixed.options,
      correct_option_id: fixed.correct_option_id,
    });
  }

  if (topStores.length >= 4) {
    const optionsPool = topStores.slice(0, 4);
    const correct = optionsPool[0];
    const toLabel = (row) => {
      const city = String(row.city || '').trim();
      const state = String(row.state || '').trim();
      if (city && state) return `${city}, ${state}`;
      if (city) return city;
      return String(row.store_slug || '').trim();
    };
    const rawOptions = optionsPool.map((row) => makeOption(
      `metrics-store-${sanitizeKey(row.store_slug, 'store')}`,
      toLabel(row),
      profileForState(row.state || 'UNK'),
    ));
    const fixed = withCorrectOptionId(
      rawOptions,
      `metrics-store-${sanitizeKey(correct.store_slug, 'store')}`,
      'metrics-top-store',
    );
    questions.push({
      id: 'metrics-top-store',
      prompt: `Which store has the most historical flavor observations in the metrics pack?`,
      options: fixed.options,
      correct_option_id: fixed.correct_option_id,
    });
  }

  if (seasonalSpotlights.length >= 4) {
    const optionsPool = seasonalSpotlights
      .slice()
      .sort((a, b) => {
        const aConc = Number(a.seasonal_concentration || 0);
        const bConc = Number(b.seasonal_concentration || 0);
        if (bConc !== aConc) return bConc - aConc;
        return Number(b.appearances || 0) - Number(a.appearances || 0);
      })
      .slice(0, 4);
    const correct = optionsPool[0];
    const rawOptions = optionsPool.map((row) => makeOption(
      `metrics-spotlight-${sanitizeKey(row.title, 'spotlight')}`,
      row.title,
      profileForFlavor(row.title),
    ));
    const fixed = withCorrectOptionId(
      rawOptions,
      `metrics-spotlight-${sanitizeKey(correct.title, 'spotlight')}`,
      'metrics-seasonal-spotlight',
    );
    questions.push({
      id: 'metrics-seasonal-spotlight',
      prompt: 'Which flavor has the strongest single-month concentration in historical data?',
      options: fixed.options,
      correct_option_id: fixed.correct_option_id,
    });
  }

  const hnbcByMonth = seed?.hnbc?.by_month && typeof seed.hnbc.by_month === 'object'
    ? seed.hnbc.by_month
    : {};
  const monthEntries = Object.entries(hnbcByMonth)
    .map(([month, count]) => ({ month: Number(month), count: Number(count) }))
    .filter((row) => Number.isFinite(row.month) && row.month >= 1 && row.month <= 12 && Number.isFinite(row.count))
    .sort((a, b) => b.count - a.count);
  if (monthEntries.length > 0) {
    const correctMonth = monthEntries[0].month;
    const monthSet = [correctMonth];
    for (const row of seasonalSpotlights.slice(0, 6)) {
      const peak = Number(row.peak_month);
      if (!Number.isFinite(peak) || peak < 1 || peak > 12) continue;
      if (!monthSet.includes(peak)) monthSet.push(peak);
      if (monthSet.length >= 4) break;
    }
    for (const fallbackMonth of [3, 5, 8, 12]) {
      if (!monthSet.includes(fallbackMonth)) monthSet.push(fallbackMonth);
      if (monthSet.length >= 4) break;
    }
    const rawOptions = monthSet.slice(0, 4).map((month) => makeOption(
      `metrics-month-${month}`,
      monthLabel(month),
      { analytical: 2, calm: 1 },
    ));
    const fixed = withCorrectOptionId(
      rawOptions,
      `metrics-month-${correctMonth}`,
      'metrics-hnbc-month',
    );
    questions.push({
      id: 'metrics-hnbc-peak-month',
      prompt: 'For "How Now Brown Cow" in historical metrics, which month shows the highest appearance count?',
      options: fixed.options,
      correct_option_id: fixed.correct_option_id,
    });
  }

  const coverage = seed?.coverage && typeof seed.coverage === 'object' ? seed.coverage : {};
  const coverageValues = [];
  for (const key of ['overall_covered', 'current_covered', 'manifest_total', 'wayback_covered']) {
    const value = Number(coverage[key]);
    if (!Number.isFinite(value) || value <= 0) continue;
    if (!coverageValues.includes(value)) coverageValues.push(value);
  }
  const overallCovered = Number(coverage.overall_covered);
  if (Number.isFinite(overallCovered) && overallCovered > 0 && coverageValues.length >= 4) {
    const rawOptions = coverageValues.slice(0, 4).map((value) => makeOption(
      `metrics-coverage-${value}`,
      `${value} stores`,
      { analytical: 2, classic: 1 },
    ));
    const fixed = withCorrectOptionId(
      rawOptions,
      `metrics-coverage-${overallCovered}`,
      'metrics-overall-coverage',
    );
    questions.push({
      id: 'metrics-overall-coverage',
      prompt: 'How many manifest stores are covered by at least one historical dataset?',
      options: fixed.options,
      correct_option_id: fixed.correct_option_id,
    });
  }

  return questions.slice(0, limit);
}

async function handleTrivia(url, env, corsHeaders) {
  const days = parseBoundedInt(url, 'days', DEFAULT_DAYS, 30, MAX_DAYS);
  const limit = parseBoundedInt(url, 'limit', DEFAULT_LIMIT, 1, MAX_LIMIT);
  const sinceExpr = `-${days} day`;
  const storeIndex = env._storeIndexOverride || DEFAULT_STORE_INDEX;
  const storeMetaBySlug = new Map(storeIndex.map((row) => [row.slug, row]));

  let groupedRows = [];
  if (env.DB) {
    try {
      const result = await env.DB.prepare(
        `SELECT
           slug,
           normalized_flavor,
           MAX(flavor) AS flavor,
           COUNT(*) AS count
         FROM snapshots
         WHERE date >= date('now', ?)
         GROUP BY slug, normalized_flavor`
      ).bind(sinceExpr).all();
      groupedRows = result?.results || [];
    } catch (err) {
      console.error(`Trivia D1 query failed, falling back to metrics seed: ${err.message}`);
    }
  }

  const stateTotals = new Map();
  const stateFlavorCounts = new Map();
  const storeTotals = new Map();
  const storeFlavorCounts = new Map();
  const flavorTotals = new Map();

  for (const row of groupedRows) {
    const slug = String(row.slug || '').trim();
    const normalizedFlavor = normalize(row.normalized_flavor || row.flavor || '');
    const flavorLabel = String(row.flavor || row.normalized_flavor || '').trim() || 'Unknown Flavor';
    const count = Number(row.count || 0);
    if (!slug || !normalizedFlavor || !Number.isFinite(count) || count <= 0) continue;

    const state = storeMetaBySlug.get(slug)?.state || 'UNK';

    if (!stateTotals.has(state)) stateTotals.set(state, { key: state, label: state, count: 0 });
    stateTotals.get(state).count += count;

    if (!stateFlavorCounts.has(state)) stateFlavorCounts.set(state, new Map());
    const sf = stateFlavorCounts.get(state);
    if (!sf.has(normalizedFlavor)) sf.set(normalizedFlavor, { key: normalizedFlavor, label: flavorLabel, count: 0 });
    sf.get(normalizedFlavor).count += count;

    if (!storeTotals.has(slug)) {
      const storeMeta = storeMetaBySlug.get(slug);
      storeTotals.set(slug, { key: slug, label: storeMeta?.name || slug, count: 0 });
    }
    storeTotals.get(slug).count += count;

    if (!storeFlavorCounts.has(slug)) storeFlavorCounts.set(slug, new Map());
    const stf = storeFlavorCounts.get(slug);
    if (!stf.has(normalizedFlavor)) stf.set(normalizedFlavor, { key: normalizedFlavor, label: flavorLabel, count: 0 });
    stf.get(normalizedFlavor).count += count;

    if (!flavorTotals.has(normalizedFlavor)) {
      flavorTotals.set(normalizedFlavor, { key: normalizedFlavor, label: flavorLabel, count: 0, stores: 0, _storeSet: new Set() });
    }
    const total = flavorTotals.get(normalizedFlavor);
    total.count += count;
    if (!total._storeSet.has(slug)) {
      total._storeSet.add(slug);
      total.stores = total._storeSet.size;
    }
  }

  const d1Questions = buildTriviaQuestions({
    stateTotals,
    stateFlavorCounts,
    storeTotals,
    storeFlavorCounts,
    flavorTotals,
    storeMetaBySlug,
  }, days, limit);
  const metricsQuestions = buildMetricsSeedQuestions(TRIVIA_METRICS_SEED, limit);

  const seenQuestionIds = new Set();
  const questions = [];
  const addQuestions = (rows) => {
    for (const question of rows || []) {
      if (!question || !question.id) continue;
      if (seenQuestionIds.has(question.id)) continue;
      questions.push(question);
      seenQuestionIds.add(question.id);
      if (questions.length >= limit) break;
    }
  };

  addQuestions(d1Questions);
  if (questions.length < limit) addQuestions(metricsQuestions);
  if (questions.length < limit) addQuestions(fallbackQuestions());

  const usedD1 = d1Questions.length > 0;
  const usedMetrics = metricsQuestions.length > 0 && questions.some((q) => String(q.id).startsWith('metrics-'));
  const source = [usedD1 ? 'd1_snapshots' : null, usedMetrics ? 'metrics_seed' : null].filter(Boolean).join('+') || 'fallback';
  let description = `Generated from ${days}-day flavor snapshot history.`;
  if (usedD1 && usedMetrics) {
    description = `Generated from ${days}-day flavor snapshot history with historical metrics augmentation (${TRIVIA_METRICS_SEED?.as_of || 'latest'}).`;
  } else if (!usedD1 && usedMetrics) {
    description = `Generated from historical flavor intelligence metrics (${TRIVIA_METRICS_SEED?.as_of || 'latest'}).`;
  } else if (!usedD1) {
    description = 'Generated from fallback trivia prompts.';
  }

  return jsonResponse({
    id: 'trivia-v1',
    name: 'Flavor Trivia Challenge',
    title: 'Flavor Trivia Challenge',
    description,
    source,
    metrics_as_of: usedMetrics ? (TRIVIA_METRICS_SEED?.as_of || null) : null,
    generated_at: new Date().toISOString(),
    question_count: Math.min(limit, questions.length),
    questions,
  }, {
    ...corsHeaders,
    'Cache-Control': 'public, max-age=900',
  });
}

export async function handleTriviaRoute(canonical, url, request, env, corsHeaders) {
  if (canonical !== '/api/trivia') return null;
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed. Use GET.' }, corsHeaders, 405);
  }
  return handleTrivia(url, env, corsHeaders);
}
