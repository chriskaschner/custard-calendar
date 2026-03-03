"""
Generate STORE_NAME slot type values for the Alexa interaction model.

Reads the store manifest (docs/stores.json) and updates the en-US.json
interaction model's custom slot types in place. All other parts of the
interaction model (intents, invocation name, samples) are preserved.

Usage:
    python alexa/tools/build_slots.py
    python alexa/tools/build_slots.py --manifest path/to/stores.json
    python alexa/tools/build_slots.py --model path/to/en-US.json
"""

import argparse
import json
import sys
from pathlib import Path

# Default paths relative to the repo root
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_MANIFEST = REPO_ROOT / "docs" / "stores.json"
DEFAULT_MODEL = (
    REPO_ROOT
    / "alexa"
    / "skill-package"
    / "interactionModels"
    / "custom"
    / "en-US.json"
)


def build_slot_values(stores: list[dict]) -> list[dict]:
    """Convert store manifest entries into Alexa slot type values.

    Each store becomes a slot value with:
      - id: the store slug (used for entity resolution)
      - value: "{city}, {state}" (the canonical spoken form)
      - synonyms: [name, slug-with-spaces] (alternate spoken forms)

    Deduplication: if multiple stores share the same city+state, only the
    first is used as the primary value -- the rest become synonyms. This
    avoids Alexa rejecting duplicate slot values during model building.
    """
    # Group stores by (city, state) to handle cities with multiple locations
    city_groups: dict[tuple[str, str], list[dict]] = {}
    for store in stores:
        key = (store["city"], store["state"])
        city_groups.setdefault(key, []).append(store)

    values = []
    for (city, state), group in city_groups.items():
        canonical_value = f"{city}, {state}"

        # Collect synonyms from all stores in this city
        synonyms = set()
        slugs = []
        for store in group:
            slug = store["slug"]
            name = store.get("name", "")
            slugs.append(slug)

            # Add the store name if it differs from the canonical value
            if name and name != canonical_value:
                synonyms.add(name)

            # Add slug with hyphens replaced by spaces
            slug_spoken = slug.replace("-", " ")
            if slug_spoken != canonical_value.lower():
                synonyms.add(slug_spoken)

        # Use the first store's slug as the primary ID.
        # For single-location cities this is the only slug.
        # For multi-location cities, additional slugs are added as synonyms
        # so Alexa can still match them, but we route to the first location
        # by default. The API handles disambiguation.
        primary_slug = slugs[0]

        # Add the bare city name as a synonym for natural speech
        if city != canonical_value:
            synonyms.add(city)

        # Sort for deterministic output
        sorted_synonyms = sorted(synonyms)

        slot_value = {
            "id": primary_slug,
            "name": {
                "value": canonical_value,
                "synonyms": sorted_synonyms,
            },
        }
        values.append(slot_value)

    return values


def update_interaction_model(model: dict, slot_values: list[dict]) -> dict:
    """Replace the STORE_NAME slot type values in the interaction model.

    Preserves all other slot types and the rest of the model structure.
    If STORE_NAME doesn't exist yet, it's appended to the types list.
    """
    lang_model = model["interactionModel"]["languageModel"]
    types = lang_model.get("types", [])

    found = False
    for slot_type in types:
        if slot_type["name"] == "STORE_NAME":
            slot_type["values"] = slot_values
            found = True
            break

    if not found:
        types.append({
            "name": "STORE_NAME",
            "values": slot_values,
        })
        lang_model["types"] = types

    return model


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate STORE_NAME slot values from the store manifest."
    )
    parser.add_argument(
        "--manifest",
        type=Path,
        default=DEFAULT_MANIFEST,
        help=f"Path to stores.json (default: {DEFAULT_MANIFEST})",
    )
    parser.add_argument(
        "--model",
        type=Path,
        default=DEFAULT_MODEL,
        help=f"Path to en-US.json interaction model (default: {DEFAULT_MODEL})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print slot count and exit without writing.",
    )
    args = parser.parse_args()

    # Load the store manifest
    if not args.manifest.exists():
        print(f"Error: manifest not found at {args.manifest}", file=sys.stderr)
        sys.exit(1)

    with open(args.manifest) as f:
        manifest = json.load(f)

    stores = manifest.get("stores", [])
    if not stores:
        print("Error: no stores found in manifest", file=sys.stderr)
        sys.exit(1)

    # Build slot values
    slot_values = build_slot_values(stores)
    print(f"Built {len(slot_values)} slot values from {len(stores)} stores")

    if args.dry_run:
        # Print a sample for verification
        for sv in slot_values[:5]:
            print(f"  {sv['id']}: {sv['name']['value']} ({len(sv['name']['synonyms'])} synonyms)")
        if len(slot_values) > 5:
            print(f"  ... and {len(slot_values) - 5} more")
        return

    # Load the existing interaction model
    if not args.model.exists():
        print(f"Error: interaction model not found at {args.model}", file=sys.stderr)
        sys.exit(1)

    with open(args.model) as f:
        model = json.load(f)

    # Update the STORE_NAME type
    updated = update_interaction_model(model, slot_values)

    # Write back
    with open(args.model, "w") as f:
        json.dump(updated, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"Updated {args.model}")


if __name__ == "__main__":
    main()
