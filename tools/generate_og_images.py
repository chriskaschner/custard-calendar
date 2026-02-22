"""Generate static OG preview images (1200x630) for the three HTML pages.

Usage:
    uv run python tools/generate_og_images.py

Outputs:
    docs/og-calendar.png
    docs/og-map.png
    docs/og-alerts.png
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

DOCS_DIR = Path(__file__).resolve().parent.parent / "docs"
WIDTH, HEIGHT = 1200, 630

# Brand colors
BG_COLOR = (26, 26, 46)       # #1a1a2e
ACCENT = (233, 69, 96)        # #e94560
TEXT_WHITE = (255, 255, 255)
TEXT_GRAY = (168, 168, 179)    # #a8a8b3
TEXT_DIM = (74, 74, 90)        # #4a4a5a


def get_font(size: int) -> ImageFont.FreeTypeFont:
    """Get a font, falling back to the default bitmap font."""
    # Try common system fonts
    for name in [
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/SFNSText.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ]:
        try:
            return ImageFont.truetype(name, size)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()


def draw_base(draw: ImageDraw.ImageDraw) -> None:
    """Draw common elements: background, accent bar, branding."""
    draw.rectangle([(0, 0), (WIDTH, HEIGHT)], fill=BG_COLOR)
    draw.rectangle([(0, 0), (WIDTH, 8)], fill=ACCENT)
    font_sm = get_font(24)
    draw.text((100, 560), "custard.chriskaschner.com", fill=TEXT_DIM, font=font_sm)
    draw.text((1100, 560), "Custard Calendar", fill=TEXT_DIM, font=font_sm, anchor="ra")


def make_calendar_card() -> Image.Image:
    img = Image.new("RGB", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(img)
    draw_base(draw)

    font_lg = get_font(64)
    font_md = get_font(36)
    font_emoji = get_font(100)

    draw.text((100, 180), "\U0001f4c5", fill=TEXT_WHITE, font=font_emoji)
    draw.text((280, 200), "Flavor of the Day", fill=TEXT_WHITE, font=font_lg)
    draw.text((280, 290), "Calendar", fill=TEXT_WHITE, font=font_lg)
    draw.text((280, 370), "Subscribe to daily custard forecasts", fill=TEXT_GRAY, font=font_md)
    draw.text((280, 420), "for 1,000+ stores", fill=TEXT_GRAY, font=font_md)

    return img


def make_map_card() -> Image.Image:
    img = Image.new("RGB", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(img)
    draw_base(draw)

    font_lg = get_font(64)
    font_md = get_font(36)
    font_emoji = get_font(100)

    draw.text((100, 180), "\U0001f5fa", fill=TEXT_WHITE, font=font_emoji)
    draw.text((280, 200), "Custard Map", fill=TEXT_WHITE, font=font_lg)
    draw.text((280, 290), "Find your flavor nearby", fill=TEXT_GRAY, font=font_md)
    draw.text((280, 350), "6 Wisconsin custard brands", fill=ACCENT, font=font_md)
    draw.text((280, 410), "Search by flavor, location, or brand", fill=TEXT_GRAY, font=font_md)

    return img


def make_alerts_card() -> Image.Image:
    img = Image.new("RGB", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(img)
    draw_base(draw)

    font_lg = get_font(64)
    font_md = get_font(36)
    font_emoji = get_font(100)

    draw.text((100, 180), "\U0001f514", fill=TEXT_WHITE, font=font_emoji)
    draw.text((280, 200), "Flavor Alerts", fill=TEXT_WHITE, font=font_lg)
    draw.text((280, 290), "Get notified when your", fill=TEXT_GRAY, font=font_md)
    draw.text((280, 340), "favorite flavor is coming up", fill=TEXT_GRAY, font=font_md)
    draw.text((280, 410), "Daily or weekly forecasts", fill=ACCENT, font=font_md)

    return img


def main() -> None:
    cards = {
        "og-calendar.png": make_calendar_card,
        "og-map.png": make_map_card,
        "og-alerts.png": make_alerts_card,
    }

    for filename, builder in cards.items():
        path = DOCS_DIR / filename
        img = builder()
        img.save(path, "PNG", optimize=True)
        print(f"  {path} ({path.stat().st_size // 1024}KB)")

    print("Done.")


if __name__ == "__main__":
    main()
