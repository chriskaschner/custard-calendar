# Coding Conventions

**Analysis Date:** 2026-03-07

## Project Structure

This is a **monorepo** with two sub-projects (`custard-calendar/`, `custard-tidbyt/`) and two distinct language ecosystems:

- **JavaScript (Cloudflare Worker):** `custard-calendar/worker/` -- plain ES modules, no TypeScript, no bundler
- **Python (Pipeline + Analytics):** `custard-calendar/src/`, `custard-calendar/analytics/`, `custard-calendar/scripts/`, `custard-calendar/main.py`

Conventions differ between the two ecosystems. Follow the conventions for whichever ecosystem the file belongs to.

## Naming Patterns

### Files

**JavaScript (Worker):**
- Use kebab-case: `flavor-fetcher.js`, `kv-cache.js`, `rate-limit.js`, `brand-registry.js`
- Source in `worker/src/`, tests in `worker/test/`
- Test files mirror source: `worker/src/forecast.js` -> `worker/test/forecast.test.js`
- Browser tests use `.spec.mjs` extension: `worker/test/browser/nav-clickthrough.spec.mjs`

**Python:**
- Use snake_case: `flavor_service.py`, `calendar_sync.py`, `data_loader.py`
- Test files use `test_` prefix: `test_flavor_service.py`, `test_predict.py`
- `__init__.py` files mark all packages

### Functions

**JavaScript:**
- camelCase for all functions: `handleRequest()`, `getFlavorsCached()`, `parseNextData()`, `cleanText()`
- Exported handler functions follow `handle{Route}` pattern: `handleForecast()`, `handleAlertRoute()`, `handleCalendar()`
- Internal helpers use descriptive camelCase: `checkAdminAccess()`, `originAllowed()`, `isPublicWriteRoute()`

**Python:**
- snake_case for all functions: `fetch_and_cache()`, `load_cache()`, `get_primary_location()`
- Private helpers use underscore prefix: `_try_stale_fallback()`, `_parse_iso_timestamp()`
- Test helpers use underscore prefix: `_cache_with_primary()`, `_mock_service()`, `_make_valid_forecast()`

### Variables and Constants

**JavaScript:**
- Constants use UPPER_SNAKE_CASE: `CACHE_MAX_AGE`, `KV_TTL_SECONDS`, `FLAVOR_CACHE_RECORD_VERSION`
- Mutable variables use camelCase: `corsHeaders`, `requestOrigin`, `configuredOrigin`
- Collections of constant data: `VALID_SLUGS`, `STORE_INDEX`, `BRAND_COLORS`

**Python:**
- Module-level constants use UPPER_SNAKE_CASE: `DEFAULT_CACHE_PATH`, `CACHE_VERSION`, `API_TIMEOUT`, `MAX_RETRIES`
- Instance variables use snake_case: `self.all_flavors`, `self.frequency_weight`
- Data-class-style constants: `CLOSED_MARKERS`, `REQUIRED_COLUMNS`

### Classes

**Python only (no classes in JS):**
- PascalCase: `FrequencyRecencyModel`, `MarkovRecencyModel`, `XGBoostFlavorModel`, `FlavorPredictor`
- Test classes use `Test` prefix: `TestCleanText`, `TestFetchFlavorsFromApi`, `TestTimeSplit`

## Code Style

### Formatting

**No automated formatters configured.** Neither ESLint, Prettier, nor Ruff/Black configs exist. Follow the implicit style:

**JavaScript:**
- 2-space indentation
- Single quotes for strings: `'text'`
- Semicolons at end of statements
- Template literals for interpolation: `` `meta:parse-fail-count:${today}` ``
- Trailing commas in multi-line objects and arrays

**Python:**
- 4-space indentation (PEP 8 standard)
- Single quotes for strings (preferred): `'text'`
- f-strings for interpolation: `f"Cached {len(flavors)} flavors for {name}"`
- Type hints on function signatures: `def fetch_flavors_from_api(slug: str, worker_base: str = DEFAULT_WORKER_BASE) -> List[Dict[str, str]]:`

### Linting

**No linters configured.** No `.eslintrc`, `.prettierrc`, `ruff.toml`, or `biome.json` files.

**Python:** `pyproject.toml` has `[tool.pytest.ini_options]` for warning filters only.

## Import Organization

### JavaScript (Worker)

**Order:**
1. Named imports from local modules: `import { fetchFlavors } from './flavor-fetcher.js';`
2. No external npm packages used at runtime (zero-dependency Worker)
3. Always use explicit `.js` extensions in import paths

**Pattern:**
```javascript
import { recordSnapshots } from './snapshot-writer.js';
import { getFetcherForSlug } from './brand-registry.js';
```

### Python

**Order:**
1. Standard library: `import os`, `import json`, `from datetime import datetime`
2. Third-party: `import requests`, `import pandas as pd`, `import numpy as np`
3. Local project: `from src.flavor_service import fetch_and_cache`, `from analytics.predict import FrequencyRecencyModel`

**Path aliases:** None. All imports use dotted module paths relative to project root.

## Error Handling

### JavaScript (Worker)

**Pattern: Defensive returns with JSON error payloads**

All API endpoints return `Response.json()` with an `error` field and appropriate HTTP status code:
```javascript
return Response.json(
  { error: 'Missing required "slug" parameter.' },
  { status: 400, headers: corsHeaders }
);
```

**Error status code conventions:**
- `400`: Bad input (missing params, invalid slug, malformed JSON)
- `403`: Forbidden (invalid admin token, unauthorized origin)
- `404`: Not found (no forecast, invalid unsub token)
- `429`: Rate limited
- `500`: Internal error (email sending failure, corrupted data)
- `502`: Upstream fetch failure
- `503`: Service unavailable (missing env config)

**Best-effort KV writes:** Use `safeKvPut()` from `worker/src/kv-cache.js` -- wraps `kv.put()` in try/catch, logs failure, returns boolean. KV write failures must never crash request handling.

**Console-based logging:** `console.error()` for failures, `console.warn()` for degraded states. No structured logging library.

### Python

**Pattern: Exceptions with logging**

- Use `logging` module throughout: `logger = logging.getLogger(__name__)`
- Log levels: `logger.info()` for progress, `logger.warning()` for degraded states, `logger.error()` for failures
- Critical failures call `sys.exit(1)` in CLI entrypoints
- API/network errors use retry loops with `except requests.RequestException`
- File operations use explicit `FileNotFoundError` handling

**Stale cache fallback pattern in `src/flavor_service.py`:**
```python
except Exception as e:
    logger.error(f"Error fetching {name} ({slug}): {e}")
    _try_stale_fallback(cache_path, slug, cache_data)
```

## Logging

### JavaScript
- **Framework:** `console` (native Worker runtime)
- Log errors with context: `console.error(\`Snapshot harvest failed for ${slug}: ${err.message}\`)`
- Empty catch blocks allowed only for best-effort operations (annotated with comments like `/* counter reads are best-effort */`)

### Python
- **Framework:** `logging` stdlib
- **Setup:** `logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')` in `main.py`
- Each module creates its own logger: `logger = logging.getLogger(__name__)`

## Comments

### JSDoc on all exported functions (Worker):
```javascript
/**
 * Handle forecast route.
 * @param {string} slug - Store slug from URL path
 * @param {Object} env - Worker env bindings
 * @param {Object} corsHeaders
 * @returns {Promise<Response>}
 */
export async function handleForecast(slug, env, corsHeaders) {
```

### Python docstrings on all public functions:
```python
def fetch_flavors_from_api(
    slug: str,
    worker_base: str = DEFAULT_WORKER_BASE,
    timeout: int = API_TIMEOUT,
) -> List[Dict[str, str]]:
    """
    Fetch flavor data for a store via the Worker API.

    Args:
        slug: Store slug (e.g. 'mt-horeb', 'kopps-greenfield')
        worker_base: Worker API base URL
        timeout: Request timeout in seconds

    Returns:
        List of dicts with 'date', 'name', 'description' keys
    """
```

### Inline comments:
- Explain "why" not "what": `// Hourly buckets keep key cardinality predictable for current limits.`
- Reference observability issue codes: `// O2: Track parse failures`, `// X1: data poisoning defense`, `// O11: Column validation`
- Use `#` prefix style markers for sections: `# ---------------------------------------------------------------------------`

## Function Design

**Size:** Functions are small-to-medium (10-60 lines). Large functions like `handleRequest()` in `worker/src/index.js` (~270 lines) are the exception and act as routing orchestrators.

**Parameters:**
- JavaScript: Use destructured options objects for functions with 3+ params: `applyIpRateLimit({ request, kv, corsHeaders, prefix, limit, error })`
- Python: Use keyword arguments with defaults: `fetch_flavors_from_api(slug, worker_base=DEFAULT_WORKER_BASE, timeout=API_TIMEOUT)`

**Return Values:**
- JavaScript: Always return `Response` objects from route handlers. Helper functions return structured objects: `{ found: boolean, forecast: Object|null, corrupted: boolean }`
- Python: Return typed dicts, lists, or domain objects. Use `Optional[T]` for nullable returns.

## Module Design

### JavaScript (Worker)
**Exports:** Named exports only. No default exports except the Worker entry point in `worker/src/index.js`.
```javascript
export function cleanText(text) { ... }
export function parseNextData(html) { ... }
export async function fetchFlavors(slug, fetchFn = globalThis.fetch) { ... }
```

**Re-exports:** `worker/src/index.js` re-exports shared utilities:
```javascript
export { isValidSlug } from './slug-validation.js';
export { getFetcherForSlug, getBrandForSlug } from './brand-registry.js';
```

**Barrel files:** Not used.

### Python
**Exports:** No `__all__` lists. Import directly from module files.
**Packages:** `__init__.py` files exist in `src/`, `analytics/`, `scripts/`, `tests/`, `analytics/tests/`, `scripts/tests/`.

## Dependency Injection

**Critical pattern used in both ecosystems for testability:**

**JavaScript:** Functions accept injectable dependencies as trailing params with defaults:
```javascript
export async function fetchFlavors(slug, fetchFn = globalThis.fetch) { ... }
export async function handleRequest(request, env, fetchFlavorsFn = defaultFetchFlavors) { ... }
```

**Python:** Functions accept overridable paths/URLs as keyword args:
```python
def fetch_and_cache(config: Dict, cache_path: str = None) -> Dict:
def load_cache(cache_path: str = None) -> Dict:
```

## Security Conventions

- All API responses include security headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, `Content-Security-Policy`
- Admin routes require `Bearer` token via `Authorization` header
- Public write routes enforce origin allowlists and per-IP rate limits
- Upstream data is sanitized before caching: `sanitizeFlavorPayload()` in `worker/src/kv-cache.js`
- Input validation uses regex patterns: `SAFE_TEXT_RE`, `ISO_DATE_RE`

## Language & Voice (from CLAUDE.md)

**Two tones depending on audience:**
- **User-facing (site copy, alerts):** Clear and concise, weather-themed metaphors ("flavor forecast", "today's outlook")
- **Technical (code comments, commits):** Playful enterprise-SaaS energy ("custard telemetry", "upstream flavor pipeline")

---

*Convention analysis: 2026-03-07*
