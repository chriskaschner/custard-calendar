# Testing Patterns

**Analysis Date:** 2026-03-07

## Overview

Two independent test ecosystems matching the two language stacks:

| Ecosystem | Framework | Tests | Config |
|-----------|-----------|-------|--------|
| Worker (JS) | Vitest + Playwright | ~574 unit + ~17 browser | `worker/vitest.config.js`, `worker/playwright.config.mjs` |
| Python | pytest | ~179 across 3 dirs | `pyproject.toml [tool.pytest.ini_options]` |

## Test Framework: JavaScript (Worker)

**Runner:** Vitest 3.x (with `@cloudflare/vitest-pool-workers`)
**Config:** `custard-calendar/worker/vitest.config.js`
**Assertion Library:** Vitest built-in (`expect`)

**Run Commands:**
```bash
cd worker && npm test              # Run all unit tests (vitest run)
cd worker && npm run test:watch    # Watch mode (vitest)
cd worker && npm run test:coverage # Coverage with v8 provider
cd worker && npm run test:browser  # Playwright browser tests
```

**Browser Tests:** Playwright 1.58.x
**Config:** `custard-calendar/worker/playwright.config.mjs`
- Runs against local static server serving `docs/` on port 4173
- Uses Chrome with `--no-sandbox --disable-dev-shm-usage`
- Workers: 1 (serial execution)
- Timeout: 30s per test

### Coverage Thresholds

Defined in `custard-calendar/worker/vitest.config.js`:
```javascript
thresholds: {
  branches: 60,
  functions: 70,
  lines: 70,
  // Per-file floors to prevent regression
  'src/email-sender.js': { branches: 63 },
  'src/snapshot-targets.js': { branches: 75 },
  'src/metrics.js': { branches: 59 },
},
```

Coverage provider: `v8`. Reporters: `text` + `lcov`.

## Test Framework: Python

**Runner:** pytest 8.x (via `uv run pytest`)
**Config:** `custard-calendar/pyproject.toml`
```toml
[tool.pytest.ini_options]
filterwarnings = [
    "ignore::DeprecationWarning",
    "ignore::PendingDeprecationWarning",
]
```

**Run Commands:**
```bash
uv run pytest tests/ scripts/tests/ analytics/tests/ -v   # All Python tests (~179)
uv run pytest analytics/tests/ -v                          # Analytics only (~117)
uv run pytest tests/ -v                                    # Core tests only
uv run pytest scripts/tests/ -v                            # Script tests only
```

**No coverage enforcement configured for Python.**

## Test File Organization

### JavaScript (Worker)

**Location:** Separate `test/` directory (not co-located with source)
```
worker/
  src/
    flavor-fetcher.js
    kv-cache.js
    forecast.js
    ...
  test/
    flavor-fetcher.test.js    # Unit test mirrors source file
    kv-cache.test.js
    forecast.test.js
    integration.test.js       # Cross-module integration tests
    health.test.js
    schema.test.js
    browser/                  # Playwright browser tests
      nav-clickthrough.spec.mjs
      forecast-fronts.spec.mjs
      quiz-personality.spec.mjs
      ...
    fixtures/                 # JSON fixture data
      mt-horeb-nextdata.json
      mt-horeb-expected.json
```

**Naming:**
- Unit tests: `{module-name}.test.js`
- Browser tests: `{feature-name}.spec.mjs`

### Python

**Location:** Separate `tests/` directories at each package level
```
custard-calendar/
  tests/                      # Core pipeline tests
    __init__.py
    test_flavor_service.py
    test_calendar_sync.py
    test_main_tidbyt.py
    test_static_assets.py
    test_live_api.py          # Skipped in CI (SKIP_LIVE_API=1)
    test_browser_clickthrough.py  # Skipped in CI (SKIP_BROWSER_TESTS=1)
  scripts/tests/              # Script-specific tests
    __init__.py
    test_upload_forecasts.py
    test_backfill.py
    test_analytics_report.py
    ...
  analytics/tests/            # Analytics/ML tests
    __init__.py
    test_predict.py
    test_data_loader.py
    test_basic_metrics.py
    test_collaborative.py
    test_embeddings.py
    ...
  tools/                      # Tools have tests alongside source
    test_e2e.py
    test_manifest.py
    test_tidbyt.py
```

**Naming:** `test_{module_name}.py` (pytest convention)

## Test Structure: JavaScript

### Suite Organization
```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleRequest } from '../src/index.js';

describe('Worker request handling', () => {
  let mockKV;
  let mockFetchFlavors;
  let env;

  beforeEach(() => {
    mockKV = createMockKV();
    mockFetchFlavors = createMockFetchFlavors();
    env = {
      FLAVOR_CACHE: mockKV,
      _validSlugsOverride: TEST_VALID_SLUGS,
      _storeIndexOverride: TEST_STORE_INDEX,
    };
    vi.clearAllMocks();
  });

  it('1: returns 400 for missing slug parameter', async () => {
    const req = makeRequest('/api/flavors');
    const res = await handleRequest(req, env, mockFetchFlavors);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/slug/i);
  });
});
```

**Key patterns:**
- Tests are numbered: `it('1: description', ...)`, `it('2: description', ...)`
- Each `describe` block covers one route or module
- `beforeEach` resets mocks and creates fresh env
- `vi.clearAllMocks()` in every `beforeEach`
- Tests assert both HTTP status and response body content

### Browser Test Structure (Playwright)
```javascript
import { expect, test } from "@playwright/test";

test("nav click-through across all docs pages", async ({ page }) => {
  await page.goto("/index.html");
  const nav = page.locator("header nav.nav-links");
  await expect(nav).toBeVisible();
  // ...
});
```

## Test Structure: Python

### Class-based grouping
```python
class TestCleanText:
    def test_removes_trademark_symbols(self):
        assert clean_text('OREO\u00ae Cookies') == 'OREO Cookies'

    def test_collapses_extra_spaces(self):
        assert clean_text('Mint   Explosion') == 'Mint Explosion'
```

### Function-based tests (also used)
```python
def test_cache_age_hours_returns_none_for_invalid_timestamp():
    cache_data = {"timestamp": "not-a-date"}
    assert cache_age_hours(cache_data) is None
```

### Conditional skip markers for tests requiring data
```python
_DB_SKIPIF = pytest.mark.skipif(
    not DEFAULT_DB.exists(), reason=f"Backfill database not found at {DEFAULT_DB}",
)

class TestFrequencyRecencyModel:
    pytestmark = _DB_SKIPIF

    def test_predict_proba_sums_to_one(self, freq_model):
        assert abs(freq_model.predict_proba("mt-horeb", pd.Timestamp("2026-02-15")).sum() - 1.0) < 1e-10
```

## Mocking

### JavaScript: Vitest `vi`

**Mock KV namespace (most common mock):**
```javascript
function createMockKV(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    get: vi.fn(async (key) => store.get(key) || null),
    put: vi.fn(async (key, value, opts) => store.set(key, value)),
    delete: vi.fn(async (key) => store.delete(key)),
    list: vi.fn(async (opts) => {
      const prefix = opts?.prefix || '';
      const keys = [];
      for (const key of store.keys()) {
        if (key.startsWith(prefix)) keys.push({ name: key });
      }
      return { keys, list_complete: true };
    }),
    _store: store,  // exposed for assertions
  };
}
```

**Mock fetch function:**
```javascript
function createMockFetchFlavors() {
  return vi.fn(async (slug) => {
    const data = MOCK_FLAVORS[slug];
    if (!data) throw new Error(`Unknown restaurant slug: ${slug}`);
    return data;
  });
}
```

**Module-level mocks (for side-effect modules):**
```javascript
vi.mock('../src/email-sender.js', () => ({
  sendConfirmationEmail: vi.fn(async () => ({ ok: true })),
  sendAlertEmail: vi.fn(async () => ({ ok: true })),
}));
```

**What to mock:**
- KV namespace (`FLAVOR_CACHE`)
- D1 database (`env.DB`)
- Upstream fetcher functions
- Email sender module
- `globalThis.fetch` (passed via dependency injection)

**What NOT to mock:**
- Route handler logic (test through `handleRequest()` integration)
- Request/Response objects (use real Web API objects)
- JSON parsing/serialization

### Python: `unittest.mock`

**Patching external calls:**
```python
@patch('src.flavor_service.requests.get')
def test_returns_mapped_flavors(self, mock_get):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = MOCK_API_RESPONSE
    mock_get.return_value = mock_resp

    result = fetch_flavors_from_api('mt-horeb', 'http://test-worker')
    assert len(result) == 2
```

**Patching subprocess calls:**
```python
@patch("main.subprocess.run")
def test_tidbyt_dry_run_renders_without_push(mock_run):
    # ...
    ok = step_tidbyt_render_push(cache_data, config, dry_run=True)
    assert ok is True
    assert mock_run.call_count == 1
```

**Using monkeypatch for sys.argv:**
```python
def test_fewer_than_3_days_skipped(self, tmp_path, monkeypatch):
    monkeypatch.setattr("sys.argv", ["upload", "--input", str(path), "--dry-run"])
    monkeypatch.setattr("subprocess.run", MagicMock(side_effect=RuntimeError("blocked")))
    result = main()
    assert result == 0
```

## Fixtures and Factories

### JavaScript

**Mock data constants at top of test file:**
```javascript
const MOCK_FLAVORS = {
  'mt-horeb': {
    name: 'Mt. Horeb',
    flavors: [
      { date: '2026-02-20', title: 'Dark Chocolate PB Crunch', description: 'Dark Chocolate custard.' },
    ],
  },
};

const TEST_VALID_SLUGS = new Set(['mt-horeb', 'madison-todd-drive']);
const TEST_STORE_INDEX = [
  { slug: 'mt-horeb', name: 'Mt. Horeb, WI', city: 'Mt. Horeb', state: 'WI' },
];
```

**File-based fixtures:** JSON files in `worker/test/fixtures/` for golden-file testing:
```javascript
const mtHorebNextData = JSON.parse(readFileSync(join(FIXTURES, 'mt-horeb-nextdata.json'), 'utf-8'));
```

**Helper request factory:**
```javascript
function makeRequest(path, options = {}) {
  const method = options.method || 'GET';
  const body = options.body ? JSON.stringify(options.body) : undefined;
  const headers = body
    ? { 'Content-Type': 'application/json', 'CF-Connecting-IP': '1.2.3.4' }
    : { 'CF-Connecting-IP': '1.2.3.4' };
  return new Request(`https://example.com${path}`, { method, body, headers });
}
```

### Python

**Pytest fixtures with module scope (for expensive setup):**
```python
@pytest.fixture(scope="module")
def df():
    return load_clean()

@pytest.fixture(scope="module")
def train_test(df):
    return time_split(df, split_date="2026-01-01")

@pytest.fixture(scope="module")
def freq_model(train_test):
    train, _ = train_test
    return FrequencyRecencyModel().fit(train)
```

**Helper factory functions:**
```python
def _cache_with_primary(flavors, timestamp="2026-02-24T00:00:00"):
    return {
        "timestamp": timestamp,
        "locations": {
            "mt-horeb": {
                "name": "Mt. Horeb",
                "role": "primary",
                "flavors": flavors,
            },
        },
    }
```

**Synthetic data builders (analytics):**
```python
def _make_synthetic_df(store_slug: str, entries: list[tuple]) -> pd.DataFrame:
    rows = [{"store_slug": store_slug, "flavor_date": pd.Timestamp(d), "title": t}
            for t, d in entries]
    df = pd.DataFrame(rows)
    df["dow"] = df["flavor_date"].dt.dayofweek
    df["month"] = df["flavor_date"].dt.month
    df["year"] = df["flavor_date"].dt.year
    return df
```

**Temporary file fixtures:** Use `tmp_path` (pytest built-in) and `tempfile.TemporaryDirectory()`:
```python
def test_load_cache(self, tmp_path):
    cache_path = str(tmp_path / 'cache.json')
    data = {'version': 2, 'locations': {'test': {'role': 'primary'}}}
    with open(cache_path, 'w') as f:
        json.dump(data, f)
    loaded = load_cache(cache_path)
```

## Coverage

**JavaScript:** Enforced -- see thresholds above. View with:
```bash
cd worker && npm run test:coverage
# Coverage output at worker/coverage/
```

**Python:** Not enforced. No coverage tooling configured.

## Test Types

### Unit Tests (bulk of test suite)

**JavaScript (~574 tests):**
- Test individual route handlers through `handleRequest()` with mocked env
- Test utility functions directly: `sanitizeFlavorPayload()`, `cleanText()`, `normalizePath()`
- Test data transformation: `parseNextData()`, `makeFlavorCacheRecord()`
- Each test file covers one source module

**Python (~179 tests):**
- Test service functions with mocked HTTP calls: `test_flavor_service.py`
- Test analytics models with synthetic data or skipif-gated real data: `test_predict.py`
- Test CLI scripts with monkeypatched sys.argv: `test_upload_forecasts.py`
- Test data loading with temporary SQLite databases: `test_data_loader.py`

### Integration Tests

**JavaScript:** `worker/test/integration.test.js` -- tests full request/response cycle through `handleRequest()` with mocked KV/D1. Not true integration tests (no real Cloudflare bindings), but exercises the full handler chain including routing, validation, caching, and response formatting.

**Python:** `tests/test_live_api.py` -- calls the real Worker API (skipped in CI via `SKIP_LIVE_API=1`).

### E2E / Browser Tests

**Playwright browser tests** in `worker/test/browser/`:
- `nav-clickthrough.spec.mjs` -- validates nav links across all 11 docs pages
- `forecast-fronts.spec.mjs` -- forecast map interactions
- `quiz-personality.spec.mjs` -- quiz flow
- `drive-preferences.spec.mjs` -- drive feature preferences
- `radar-phase2.spec.mjs` -- Flavor Radar interactions
- Total: ~17 browser test files

Skipped in Python CI via `SKIP_BROWSER_TESTS=1`.

### Golden File Tests

`worker/test/flavor-fetcher.test.js` test #8 compares JS parser output against Python-generated expected output:
```javascript
it('8: golden test - JS output matches Python expected output', () => {
  const html = wrapInHtml(mtHorebNextData);
  const result = parseNextData(html);
  for (const expected of mtHorebExpected.flavors) {
    const jsFlavor = jsByDate[expected.date];
    expect(jsFlavor.title).toBe(expected.name);
  }
});
```

Update golden files with: `cd worker && npm run bless:cones`

## Common Patterns

### Async Testing (JavaScript)

All Worker route tests are async -- test the full request/response cycle:
```javascript
it('returns 200 with valid JSON', async () => {
  const req = makeRequest('/api/v1/schema');
  const res = await handleRequest(req, env);
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(typeof body).toBe('object');
});
```

### Error Testing (JavaScript)

Test both HTTP status and error message content:
```javascript
it('rejects invalid email', async () => {
  const req = makeRequest('/api/alerts/subscribe', {
    method: 'POST',
    body: { email: 'not-an-email', slug: 'mt-horeb', favorites: ['Turtle'] },
  });
  const res = await handleRequest(req, env, mockFetchFlavors);
  expect(res.status).toBe(400);
  const data = await res.json();
  expect(data.error).toMatch(/email/i);
});
```

### Error Testing (Python)

Use `pytest.raises` and `pytest.warns`:
```python
def test_load_cache_missing_file(self, tmp_path):
    with pytest.raises(FileNotFoundError):
        load_cache(str(tmp_path / 'nonexistent.json'))

def test_missing_column_raises_value_error():
    with pytest.raises(ValueError, match="missing required columns"):
        load_clean(db_path)

def test_empty_db_warns():
    with pytest.warns(UserWarning, match="empty"):
        load_clean(db_path)
```

### Testing Dependency Injection

Worker tests inject mock fetchers instead of real HTTP calls:
```javascript
const res = await handleRequest(req, env, mockFetchFlavors);
```

Python tests patch at the module boundary:
```python
@patch('src.flavor_service.fetch_flavors_from_api')
def test_new_config_format(self, mock_fetch, tmp_path):
    mock_fetch.return_value = [...]
```

## CI Pipeline

Defined in `custard-calendar/.github/workflows/ci.yml`:

**Jobs:**
1. `worker-tests` -- Node 20, `npm install && npm test` in `worker/`
2. `repo-structure` -- `uv run python scripts/check_repo_structure.py`
3. `python-tests` -- `uv sync --all-extras`, then `uv run pytest tests/ scripts/tests/ analytics/tests/ -v`
   - Env: `SKIP_LIVE_API=1`, `SKIP_BROWSER_TESTS=1`

**Triggers:** push/PR to `main`

**Gate rule (from CLAUDE.md):** `cd worker && npm test` must pass before merging any branch.

---

*Testing analysis: 2026-03-07*
