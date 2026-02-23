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
SKY_TOP = (32, 44, 79)         # #202c4f
SKY_BOTTOM = (19, 24, 44)      # #13182c
CLOUD = (195, 210, 236)        # #c3d2ec
CLOUD_SHADE = (143, 166, 206)  # #8fa6ce
WAFFLE = (210, 105, 30)        # #d2691e
WAFFLE_DARK = (184, 134, 11)   # #b8860b


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


def draw_vertical_gradient(img: Image.Image, top: tuple[int, int, int], bottom: tuple[int, int, int]) -> None:
    """Draw a top-to-bottom gradient background."""
    draw = ImageDraw.Draw(img)
    for y in range(HEIGHT):
        t = y / max(HEIGHT - 1, 1)
        r = round(top[0] + (bottom[0] - top[0]) * t)
        g = round(top[1] + (bottom[1] - top[1]) * t)
        b = round(top[2] + (bottom[2] - top[2]) * t)
        draw.line([(0, y), (WIDTH, y)], fill=(r, g, b))


def draw_pixel_cone(draw: ImageDraw.ImageDraw, x: int, y: int, scale: int, scoop: tuple[int, int, int]) -> None:
    """Draw a small pixel-art cone (9x11 grid) at x,y."""
    s = scale
    # Scoop
    scoop_rows = [(2, 6), (1, 7), (1, 7), (1, 7), (1, 7), (2, 6)]
    for row, (start_col, end_col) in enumerate(scoop_rows):
        for col in range(start_col, end_col + 1):
            draw.rectangle(
                [x + col * s, y + row * s, x + (col + 1) * s - 1, y + (row + 1) * s - 1],
                fill=scoop,
            )

    # Cone checkerboard
    cone_rows = [(2, 6), (2, 6), (3, 5), (3, 5)]
    for row, (start_col, end_col) in enumerate(cone_rows):
        for col in range(start_col, end_col + 1):
            color = WAFFLE if (row + col) % 2 == 0 else WAFFLE_DARK
            y_off = row + 6
            draw.rectangle(
                [x + col * s, y + y_off * s, x + (col + 1) * s - 1, y + (y_off + 1) * s - 1],
                fill=color,
            )

    # Tip pixel
    draw.rectangle(
        [x + 4 * s, y + 10 * s, x + 5 * s - 1, y + 11 * s - 1],
        fill=WAFFLE_DARK,
    )


def draw_custard_cloud(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int) -> None:
    """Draw a chunky cloud shape with simple shading."""
    # Base cloud blobs
    blobs = [
        (x + int(w * 0.05), y + int(h * 0.30), x + int(w * 0.35), y + int(h * 0.88)),
        (x + int(w * 0.24), y + int(h * 0.12), x + int(w * 0.57), y + int(h * 0.82)),
        (x + int(w * 0.50), y + int(h * 0.20), x + int(w * 0.84), y + int(h * 0.86)),
        (x + int(w * 0.70), y + int(h * 0.32), x + int(w * 0.98), y + int(h * 0.90)),
    ]
    for blob in blobs:
        draw.ellipse(blob, fill=CLOUD)

    draw.rounded_rectangle(
        [x + int(w * 0.08), y + int(h * 0.52), x + int(w * 0.92), y + int(h * 0.94)],
        radius=26,
        fill=CLOUD,
    )

    # Lower shading strip
    draw.rounded_rectangle(
        [x + int(w * 0.10), y + int(h * 0.70), x + int(w * 0.90), y + int(h * 0.94)],
        radius=18,
        fill=CLOUD_SHADE,
    )


def make_calendar_card() -> Image.Image:
    img = Image.new("RGB", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(img)
    draw_vertical_gradient(img, SKY_TOP, SKY_BOTTOM)
    draw = ImageDraw.Draw(img)

    # Top accent + branding footer
    draw.rectangle([(0, 0), (WIDTH, 8)], fill=ACCENT)
    font_sm = get_font(24)
    draw.text((100, 560), "custard.chriskaschner.com", fill=TEXT_DIM, font=font_sm)
    draw.text((1100, 560), "Custard Calendar", fill=TEXT_DIM, font=font_sm, anchor="ra")

    font_lg = get_font(68)
    font_md = get_font(36)
    font_sm = get_font(28)

    # Left title stack
    draw.text((92, 164), "Custard Forecast", fill=TEXT_WHITE, font=font_lg)
    draw.text((92, 248), "Flavor Front", fill=TEXT_WHITE, font=font_lg)
    draw.text((92, 336), "Pixel-art cloud raining cones", fill=TEXT_GRAY, font=font_md)
    draw.text((92, 382), "Daily picks across 1,000+ stores", fill=TEXT_GRAY, font=font_sm)

    # Cloud + cone rain scene on the right
    cloud_x, cloud_y = 640, 110
    cloud_w, cloud_h = 470, 230
    draw_custard_cloud(draw, cloud_x, cloud_y, cloud_w, cloud_h)

    # Rain streaks
    streaks = [
        (700, 310, 680, 366),
        (760, 330, 742, 388),
        (840, 302, 818, 364),
        (900, 326, 882, 386),
        (980, 308, 956, 374),
        (1040, 334, 1018, 396),
    ]
    for x1, y1, x2, y2 in streaks:
        draw.line([(x1, y1), (x2, y2)], fill=(137, 179, 233), width=4)

    cone_specs = [
        (680, 350, 6, (143, 217, 168)),   # mint
        (738, 374, 6, (245, 222, 179)),   # vanilla
        (814, 344, 6, (123, 74, 46)),     # chocolate
        (876, 372, 6, (232, 138, 174)),   # strawberry
        (948, 352, 6, (197, 138, 69)),    # caramel
        (1012, 382, 6, (243, 231, 203)),  # cheesecake
    ]
    for x, y, scale, scoop_color in cone_specs:
        draw_pixel_cone(draw, x, y, scale, scoop_color)

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
