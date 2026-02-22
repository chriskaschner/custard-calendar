#!/usr/bin/env python3
"""
Culver's Flavor of the Day Tracker - Main Orchestration Script

Three-step pipeline:
1. Fetch flavor data from Culver's website and write to cache
2. Sync cached flavors to Google Calendar
3. Render Tidbyt app with cached data and push to device
"""

import sys
import os
import argparse
import subprocess
import yaml
import logging
from datetime import datetime
from typing import Dict
from pathlib import Path

from src.flavor_service import fetch_and_cache, load_cache, get_primary_location
from src.calendar_sync import authenticate, sync_from_cache

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)

STAR_FILE = Path(__file__).parent / 'tidbyt' / 'culvers_fotd.star'


def load_config(config_path: str = 'config.yaml') -> Dict:
    """Load configuration from YAML file."""
    try:
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)
        logger.info(f"Loaded configuration from {config_path}")
        return config
    except FileNotFoundError:
        logger.error(f"Configuration file not found: {config_path}")
        sys.exit(1)
    except yaml.YAMLError as e:
        logger.error(f"Error parsing configuration: {e}")
        sys.exit(1)


def step_fetch(config: Dict) -> Dict:
    """Step 1: Fetch flavor data and write cache."""
    logger.info("Step 1: Fetching flavor data...")
    cache_data = fetch_and_cache(config)

    location_count = len(cache_data.get('locations', {}))
    total_flavors = sum(
        len(loc.get('flavors', []))
        for loc in cache_data.get('locations', {}).values()
    )
    logger.info(f"  Cached {total_flavors} flavors across {location_count} locations")
    return cache_data


def step_calendar_sync(cache_data: Dict, calendar_id: str) -> Dict:
    """Step 2: Sync cached flavors to Google Calendar."""
    logger.info("Step 2: Syncing to Google Calendar...")

    service = authenticate()
    stats = sync_from_cache(service, cache_data, calendar_id)

    logger.info(
        f"  Calendar sync: {stats['created']} created, "
        f"{stats['updated']} updated, {stats['errors']} errors"
    )
    return stats


def step_tidbyt_render_push(cache_data: Dict, config: Dict) -> bool:
    """Step 3: Render Tidbyt app with cache data and push to device."""
    logger.info("Step 3: Rendering and pushing to Tidbyt...")

    tidbyt_config = config.get('tidbyt', {})
    device_id = tidbyt_config.get('device_id', '')
    installation_id = tidbyt_config.get('installation_id', 'culvers')
    view_mode = tidbyt_config.get('view_mode', 'three_day')
    brand = tidbyt_config.get('brand', 'culvers')
    api_token = os.environ.get('TIDBYT_API_TOKEN', '')

    if not device_id:
        logger.error("  No tidbyt.device_id configured in config.yaml")
        return False

    if not api_token:
        logger.error("  TIDBYT_API_TOKEN not found in environment. Source .env first.")
        return False

    primary = get_primary_location(cache_data)
    if not primary:
        logger.error("  No primary location in cache")
        return False

    location_name = primary['name']
    flavors = primary['flavors']

    # Filter to today and future
    today_str = datetime.now().strftime('%Y-%m-%d')
    future_flavors = [f for f in flavors if f['date'] >= today_str]

    if not future_flavors:
        logger.warning("  No current/future flavors in cache")
        return False

    # Build pixlet render command with flattened params
    output_file = '/tmp/culvers_tidbyt.webp'
    cmd = [
        'pixlet', 'render', str(STAR_FILE),
        f'view_mode={view_mode}',
        f'location_name={location_name}',
        f'brand={brand}',
    ]

    num_flavors = 3 if view_mode == 'three_day' else 1
    for i, flavor in enumerate(future_flavors[:num_flavors]):
        cmd.append(f'flavor_{i}={flavor["name"]}')
        cmd.append(f'flavor_date_{i}={flavor["date"]}')

    cmd.extend(['-o', output_file])

    logger.info(f"  Rendering {num_flavors} flavor(s) for {location_name}...")

    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as e:
        logger.error(f"  Pixlet render failed: {e.stderr}")
        return False
    except FileNotFoundError:
        logger.error("  pixlet not found. Install: brew install tidbyt/tidbyt/pixlet")
        return False

    # Push to device
    push_cmd = [
        'pixlet', 'push',
        '-t', api_token,
        '-i', installation_id,
        device_id,
        output_file,
    ]

    logger.info(f"  Pushing to device {device_id}...")

    try:
        subprocess.run(push_cmd, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as e:
        logger.error(f"  Pixlet push failed: {e.stderr}")
        return False

    logger.info("  Tidbyt updated successfully")
    return True


def main():
    """Main orchestration function."""
    parser = argparse.ArgumentParser(description="Culver's Flavor of the Day Tracker")
    parser.add_argument('--fetch-only', action='store_true',
                        help='Only fetch and cache, skip calendar and tidbyt')
    parser.add_argument('--calendar-only', action='store_true',
                        help='Only sync calendar from existing cache')
    parser.add_argument('--tidbyt-only', action='store_true',
                        help='Only render and push to Tidbyt from existing cache')
    parser.add_argument('--skip-calendar', action='store_true',
                        help='Skip calendar sync')
    parser.add_argument('--skip-tidbyt', action='store_true',
                        help='Skip Tidbyt render/push')
    parser.add_argument('--config', default='config.yaml',
                        help='Config file path (default: config.yaml)')
    args = parser.parse_args()

    logger.info("=" * 60)
    logger.info("Culver's Flavor of the Day Tracker")
    logger.info("=" * 60)

    config = load_config(args.config)
    calendar_id = config.get('google_calendar', {}).get('calendar_id')

    # Determine which steps to run
    run_fetch = True
    run_calendar = True
    run_tidbyt = True

    if args.fetch_only:
        run_calendar = False
        run_tidbyt = False
    elif args.calendar_only:
        run_fetch = False
        run_tidbyt = False
    elif args.tidbyt_only:
        run_fetch = False
        run_calendar = False

    if args.skip_calendar:
        run_calendar = False
    if args.skip_tidbyt:
        run_tidbyt = False

    # Step 1: Fetch and cache
    cache_data = None
    if run_fetch:
        cache_data = step_fetch(config)

    # Load from cache if we skipped fetching
    if cache_data is None:
        cache_data = load_cache()

    # Step 2: Calendar sync
    if run_calendar:
        if not calendar_id:
            logger.error("No calendar_id in config -- skipping calendar sync")
        else:
            step_calendar_sync(cache_data, calendar_id)

    # Step 3: Tidbyt render + push
    if run_tidbyt:
        step_tidbyt_render_push(cache_data, config)

    logger.info("=" * 60)
    logger.info("Done!")
    logger.info("=" * 60)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("\nInterrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
