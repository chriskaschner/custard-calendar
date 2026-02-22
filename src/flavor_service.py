"""
Flavor Service — single source of truth via Worker API.

Fetches flavor data from the Custard Calendar Worker API (which handles all
brand-specific scraping) and manages a local cache. Both the Calendar Sync
and Tidbyt Render consumers read from this cache.
"""

import os
import requests
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Cache configuration
DEFAULT_CACHE_PATH = Path(__file__).parent.parent / 'flavor_cache.json'
CACHE_VERSION = 2

# Worker API defaults
DEFAULT_WORKER_BASE = 'https://custard-calendar.chris-kaschner.workers.dev'
API_TIMEOUT = 15  # seconds — Worker may cold-start
MAX_RETRIES = 2


def clean_text(text: str) -> str:
    """Remove trademark symbols and clean up text (names, descriptions, etc.)."""
    text = text.replace('\u00ae', '').replace('\u2122', '').replace('\u00a9', '')
    text = ' '.join(text.split())
    return text


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
    url = f"{worker_base}/api/v1/flavors?slug={slug}"
    logger.info(f"Fetching flavors from Worker API: {url}")

    last_err = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = requests.get(url, timeout=timeout)
            response.raise_for_status()
            data = response.json()

            # Map Worker API response fields to local format
            # Worker returns: {name, flavors: [{date, title, description}]}
            flavors = []
            for f in data.get('flavors', []):
                flavors.append({
                    'date': f.get('date', ''),
                    'name': clean_text(f.get('title', f.get('name', 'Unknown'))),
                    'description': clean_text(f.get('description', '')),
                })

            logger.info(f"Got {len(flavors)} flavors for {slug} from Worker API")
            return flavors

        except requests.RequestException as e:
            last_err = e
            if attempt < MAX_RETRIES:
                logger.warning(f"Attempt {attempt} failed for {slug}: {e}, retrying...")
            else:
                logger.error(f"All {MAX_RETRIES} attempts failed for {slug}: {e}")

    raise last_err


def fetch_and_cache(config: Dict, cache_path: str = None) -> Dict:
    """
    Fetch flavor data for all configured stores via Worker API and write to cache.

    Args:
        config: Parsed config.yaml dict
        cache_path: Override path for flavor_cache.json

    Returns:
        The cache dict that was written
    """
    if cache_path is None:
        cache_path = str(DEFAULT_CACHE_PATH)

    worker_base = config.get('worker_base', DEFAULT_WORKER_BASE)
    stores = config.get('stores', [])

    # Backward compat: support old culvers.locations format
    if not stores:
        locations = config.get('culvers', {}).get('locations', [])
        for loc in locations:
            if loc.get('enabled', False):
                # Derive slug from URL
                url = loc.get('url', '')
                slug = url.rstrip('/').split('/')[-1] if url else ''
                stores.append({
                    'slug': slug,
                    'brand': 'culvers',
                    'name': loc.get('name', ''),
                    'role': loc.get('role', ''),
                })

    cache_data = {
        'version': CACHE_VERSION,
        'timestamp': datetime.now().isoformat(),
        'locations': {},
    }

    for store in stores:
        slug = store.get('slug', '')
        name = store.get('name', slug)
        role = store.get('role', '')

        if not slug:
            logger.error(f"No slug for store: {name}")
            continue

        try:
            flavors = fetch_flavors_from_api(slug, worker_base)

            cache_data['locations'][slug] = {
                'name': name,
                'slug': slug,
                'brand': store.get('brand', 'culvers'),
                'role': role,
                'flavors': flavors,
            }

            logger.info(f"Cached {len(flavors)} flavors for {name}")

        except Exception as e:
            logger.error(f"Error fetching {name} ({slug}): {e}")
            # Try to use stale cache if available
            _try_stale_fallback(cache_path, slug, cache_data)

    with open(cache_path, 'w') as f:
        json.dump(cache_data, f, indent=2)

    logger.info(f"Cache written to {cache_path}")
    return cache_data


def _try_stale_fallback(cache_path: str, slug: str, cache_data: Dict) -> None:
    """If Worker is down, copy stale data from existing cache file."""
    try:
        if os.path.exists(cache_path):
            with open(cache_path, 'r') as f:
                old_cache = json.load(f)
            old_loc = old_cache.get('locations', {}).get(slug)
            if old_loc:
                logger.warning(f"Using stale cache for {slug}")
                cache_data['locations'][slug] = old_loc
    except Exception:
        pass  # stale cache is best-effort


def load_cache(cache_path: str = None) -> Dict:
    """
    Load flavor data from cache file.

    Args:
        cache_path: Override path for flavor_cache.json

    Returns:
        Parsed cache dict

    Raises:
        FileNotFoundError: If cache file does not exist
    """
    if cache_path is None:
        cache_path = str(DEFAULT_CACHE_PATH)

    if not os.path.exists(cache_path):
        raise FileNotFoundError(
            f"Cache file not found: {cache_path}. "
            f"Run with --fetch-only first."
        )

    with open(cache_path, 'r') as f:
        return json.load(f)


def get_primary_location(cache_data: Dict) -> Optional[Dict]:
    """Get the primary location data from cache."""
    for slug, loc in cache_data.get('locations', {}).items():
        if loc.get('role') == 'primary':
            return loc
    return None


def get_backup_location(cache_data: Dict) -> Optional[Dict]:
    """Get the backup location data from cache."""
    for slug, loc in cache_data.get('locations', {}).items():
        if loc.get('role') in ('backup', 'secondary'):
            return loc
    return None


if __name__ == "__main__":
    import yaml

    print("Testing Flavor Service (Worker API)...")
    print("-" * 50)

    try:
        # Test direct API fetch
        flavors = fetch_flavors_from_api('mt-horeb')
        print(f"\nFlavors for mt-horeb ({len(flavors)}):")
        for f in flavors[:5]:
            print(f"  {f['date']}: {f['name']}")

        # Test fetch_and_cache with config
        config_path = Path(__file__).parent.parent / 'config.yaml'
        if config_path.exists():
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)

            print(f"\nTesting fetch_and_cache...")
            cache_data = fetch_and_cache(config)
            print(f"Cached {len(cache_data['locations'])} locations")

            loaded = load_cache()
            print(f"Loaded cache with {len(loaded['locations'])} locations")

            primary = get_primary_location(loaded)
            if primary:
                print(f"Primary: {primary['name']} ({len(primary['flavors'])} flavors)")

        print("\nAll flavor service tests passed!")

    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
