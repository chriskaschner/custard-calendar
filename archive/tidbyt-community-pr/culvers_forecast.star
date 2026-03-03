"""
Applet: Culver's Forecast
Summary: Culver's 3-Day Forecast
Description: See the next 3 days of Flavor of the Day at your Culver's with color-coded pixel-art cones.
Author: Chris Kaschner
"""

load("cache.star", "cache")
load("encoding/json.star", "json")
load("html.star", "html")
load("http.star", "http")
load("render.star", "render")
load("schema.star", "schema")
load("time.star", "time")

# Culver's locator API (same endpoint used by existing community app)
LOCATOR_URL = "https://culvers.com/api/locator/getLocations"
LOCATOR_RADIUS = 40233  # 25 miles in meters
LOCATOR_LIMIT = 10

# Cache TTLs
HTTP_TTL = 21600  # 6 hours — http.get response cache
CACHE_TTL = 43200  # 12 hours — parsed flavor data cache

# Display constants
WIDTH = 64
HEIGHT = 32

# ─── Color palettes ─────────────────────────────────────────────────

BASE_COLORS = {
    "vanilla": "#F5DEB3",
    "chocolate": "#6F4E37",
    "dark_chocolate": "#3B1F0B",
    "mint": "#2ECC71",
    "strawberry": "#FF6B9D",
    "cheesecake": "#FFF5E1",
    "caramel": "#C68E17",
    "butter_pecan": "#D4A574",
    "peach": "#FFE5B4",
}

RIBBON_COLORS = {
    "caramel": "#DAA520",
    "peanut_butter": "#D4A017",
    "marshmallow": "#FFFFFF",
    "chocolate_syrup": "#1A0A00",
    "fudge": "#3B1F0B",
}

TOPPING_COLORS = {
    "oreo": "#1A1A1A",
    "andes": "#00897B",
    "dove": "#3B1F0B",
    "pecan": "#8B6914",
    "cashew": "#D4C4A8",
    "heath": "#DAA520",
    "butterfinger": "#E6A817",
    "cookie_dough": "#C4A882",
    "strawberry_bits": "#FF1744",
    "raspberry": "#E91E63",
    "peach_bits": "#FF9800",
    "salt": "#FFFFFF",
    "snickers": "#C4A060",
    "cake": "#4A2800",
    "cheesecake_bits": "#FFF8DC",
    "m_and_m": "#FF4444",
    "reeses": "#D4A017",
}

# ─── Flavor profiles ────────────────────────────────────────────────

FLAVOR_PROFILES = {
    "dark chocolate pb crunch": {
        "base": "dark_chocolate",
        "ribbon": "peanut_butter",
        "toppings": ["butterfinger"],
        "density": "standard",
    },
    "chocolate caramel twist": {
        "base": "chocolate",
        "ribbon": "caramel",
        "toppings": ["dove"],
        "density": "standard",
    },
    "mint explosion": {
        "base": "mint",
        "ribbon": None,
        "toppings": ["oreo", "andes", "dove"],
        "density": "explosion",
    },
    "turtle dove": {
        "base": "vanilla",
        "ribbon": "marshmallow",
        "toppings": ["pecan", "dove"],
        "density": "standard",
    },
    "double strawberry": {
        "base": "strawberry",
        "ribbon": None,
        "toppings": ["strawberry_bits"],
        "density": "double",
    },
    "turtle cheesecake": {
        "base": "cheesecake",
        "ribbon": "caramel",
        "toppings": ["dove", "pecan", "cheesecake_bits"],
        "density": "explosion",
    },
    "caramel turtle": {
        "base": "caramel",
        "ribbon": None,
        "toppings": ["pecan", "dove"],
        "density": "standard",
    },
    "andes mint avalanche": {
        "base": "mint",
        "ribbon": None,
        "toppings": ["andes", "dove"],
        "density": "standard",
    },
    "oreo cookie cheesecake": {
        "base": "cheesecake",
        "ribbon": None,
        "toppings": ["oreo", "cheesecake_bits"],
        "density": "standard",
    },
    "devil's food cake": {
        "base": "dark_chocolate",
        "ribbon": None,
        "toppings": ["cake", "dove"],
        "density": "standard",
    },
    "caramel cashew": {
        "base": "vanilla",
        "ribbon": "caramel",
        "toppings": ["cashew"],
        "density": "standard",
    },
    "butter pecan": {
        "base": "butter_pecan",
        "ribbon": None,
        "toppings": ["pecan"],
        "density": "standard",
    },
    "caramel chocolate pecan": {
        "base": "chocolate",
        "ribbon": "caramel",
        "toppings": ["pecan", "dove"],
        "density": "standard",
    },
    "dark chocolate decadence": {
        "base": "dark_chocolate",
        "ribbon": None,
        "toppings": [],
        "density": "pure",
    },
    "caramel fudge cookie dough": {
        "base": "vanilla",
        "ribbon": "fudge",
        "toppings": ["cookie_dough"],
        "density": "standard",
    },
    "mint cookie": {
        "base": "mint",
        "ribbon": None,
        "toppings": ["oreo"],
        "density": "standard",
    },
    "caramel pecan": {
        "base": "vanilla",
        "ribbon": "caramel",
        "toppings": ["pecan"],
        "density": "standard",
    },
    "really reese's": {
        "base": "chocolate",
        "ribbon": "peanut_butter",
        "toppings": ["reeses"],
        "density": "standard",
    },
    "raspberry cheesecake": {
        "base": "cheesecake",
        "ribbon": None,
        "toppings": ["raspberry", "cheesecake_bits"],
        "density": "standard",
    },
    "chocolate covered strawberry": {
        "base": "vanilla",
        "ribbon": None,
        "toppings": ["strawberry_bits", "dove"],
        "density": "standard",
    },
    "caramel peanut buttercup": {
        "base": "vanilla",
        "ribbon": "peanut_butter",
        "toppings": ["dove"],
        "density": "standard",
    },
    "turtle": {
        "base": "vanilla",
        "ribbon": "caramel",
        "toppings": ["dove", "pecan"],
        "density": "standard",
    },
    "georgia peach": {
        "base": "peach",
        "ribbon": None,
        "toppings": ["peach_bits"],
        "density": "standard",
    },
    "snickers swirl": {
        "base": "chocolate",
        "ribbon": "caramel",
        "toppings": ["snickers"],
        "density": "standard",
    },
    "chocolate volcano": {
        "base": "chocolate",
        "ribbon": "chocolate_syrup",
        "toppings": ["oreo", "dove", "m_and_m"],
        "density": "explosion",
    },
    "oreo cookie overload": {
        "base": "chocolate",
        "ribbon": "chocolate_syrup",
        "toppings": ["oreo"],
        "density": "overload",
    },
    "salted double caramel pecan": {
        "base": "caramel",
        "ribbon": "caramel",
        "toppings": ["pecan", "salt"],
        "density": "double",
    },
    "crazy for cookie dough": {
        "base": "vanilla",
        "ribbon": "fudge",
        "toppings": ["cookie_dough"],
        "density": "standard",
    },
    "chocolate heath crunch": {
        "base": "chocolate",
        "ribbon": None,
        "toppings": ["heath"],
        "density": "standard",
    },
}

# ─── Rendering helpers ───────────────────────────────────────────────

def get_flavor_profile(flavor_name):
    """Look up flavor profile by name, with keyword fallback for unknown flavors."""
    key = flavor_name.lower()
    if key in FLAVOR_PROFILES:
        return FLAVOR_PROFILES[key]

    # Normalize unicode curly quotes to ASCII for matching
    normalized = key.replace("\u2019", "'").replace("\u2018", "'")
    if normalized in FLAVOR_PROFILES:
        return FLAVOR_PROFILES[normalized]

    # Keyword fallback for unknown flavors
    if "mint" in key:
        return {"base": "mint", "ribbon": None, "toppings": [], "density": "standard"}
    elif "dark choc" in key:
        return {"base": "dark_chocolate", "ribbon": None, "toppings": [], "density": "standard"}
    elif "chocolate" in key or "cocoa" in key:
        return {"base": "chocolate", "ribbon": None, "toppings": [], "density": "standard"}
    elif "strawberry" in key:
        return {"base": "strawberry", "ribbon": None, "toppings": [], "density": "standard"}
    elif "cheesecake" in key:
        return {"base": "cheesecake", "ribbon": None, "toppings": [], "density": "standard"}
    elif "caramel" in key:
        return {"base": "caramel", "ribbon": "caramel", "toppings": [], "density": "standard"}
    elif "peach" in key:
        return {"base": "peach", "ribbon": None, "toppings": [], "density": "standard"}
    elif "butter pecan" in key:
        return {"base": "butter_pecan", "ribbon": None, "toppings": ["pecan"], "density": "standard"}
    elif "vanilla" in key:
        return {"base": "vanilla", "ribbon": None, "toppings": [], "density": "standard"}
    return {"base": "vanilla", "ribbon": None, "toppings": [], "density": "standard"}

def create_mini_cone(profile):
    """Create a mini ice cream cone (9x11) with profile-driven rendering.

    Geometry: 6-row scoop (no outline), 4-row checkerboard cone, 1px tip.
    Rendering order: base fill -> toppings -> ribbon (ribbon wins at overlap) -> cone -> tip.
    """
    base = BASE_COLORS[profile["base"]]
    ribbon_key = profile.get("ribbon")
    topping_keys = profile.get("toppings", [])
    density = profile.get("density", "standard")

    has_ribbon = ribbon_key != None and density != "pure"

    topping_slots = []

    if density == "pure":
        pass
    elif density == "double":
        if len(topping_keys) > 0:
            topping_slots = [topping_keys[0], topping_keys[0]]
            if len(topping_keys) > 1:
                topping_slots.append(topping_keys[1])
    elif density == "explosion":
        topping_slots = list(topping_keys[:4])
    elif density == "overload":
        if len(topping_keys) > 0:
            topping_slots = [topping_keys[0], topping_keys[0]]
    else:
        topping_slots = list(topping_keys[:4])

    overlays = []

    if len(topping_slots) > 0:
        overlays.append(
            render.Padding(
                pad = (2, 1, 0, 0),
                child = render.Box(width = 1, height = 1, color = TOPPING_COLORS[topping_slots[0]]),
            ),
        )
    if len(topping_slots) > 1:
        overlays.append(
            render.Padding(
                pad = (6, 1, 0, 0),
                child = render.Box(width = 1, height = 1, color = TOPPING_COLORS[topping_slots[1]]),
            ),
        )
    if len(topping_slots) > 2:
        overlays.append(
            render.Padding(
                pad = (3, 3, 0, 0),
                child = render.Box(width = 1, height = 1, color = TOPPING_COLORS[topping_slots[2]]),
            ),
        )
    if len(topping_slots) > 3 and not has_ribbon:
        overlays.append(
            render.Padding(
                pad = (5, 2, 0, 0),
                child = render.Box(width = 1, height = 1, color = TOPPING_COLORS[topping_slots[3]]),
            ),
        )

    if has_ribbon:
        ribbon = RIBBON_COLORS[ribbon_key]
        overlays.append(
            render.Padding(
                pad = (3, 0, 0, 0),
                child = render.Box(width = 1, height = 1, color = ribbon),
            ),
        )
        overlays.append(
            render.Padding(
                pad = (4, 1, 0, 0),
                child = render.Box(width = 1, height = 1, color = ribbon),
            ),
        )
        overlays.append(
            render.Padding(
                pad = (5, 2, 0, 0),
                child = render.Box(width = 1, height = 1, color = ribbon),
            ),
        )

    return render.Stack(
        children = [
            render.Box(width = 9, height = 11),
            render.Column(
                children = [
                    render.Padding(
                        pad = (2, 0, 0, 0),
                        child = render.Box(width = 5, height = 1, color = base),
                    ),
                    render.Padding(
                        pad = (1, 0, 0, 0),
                        child = render.Box(width = 7, height = 5, color = base),
                    ),
                    render.Padding(
                        pad = (2, 0, 0, 0),
                        child = render.Row(
                            children = [
                                render.Box(width = 1, height = 1, color = "#D2691E"),
                                render.Box(width = 1, height = 1, color = "#B8860B"),
                                render.Box(width = 1, height = 1, color = "#D2691E"),
                                render.Box(width = 1, height = 1, color = "#B8860B"),
                                render.Box(width = 1, height = 1, color = "#D2691E"),
                            ],
                        ),
                    ),
                    render.Padding(
                        pad = (2, 0, 0, 0),
                        child = render.Row(
                            children = [
                                render.Box(width = 1, height = 1, color = "#B8860B"),
                                render.Box(width = 1, height = 1, color = "#D2691E"),
                                render.Box(width = 1, height = 1, color = "#B8860B"),
                                render.Box(width = 1, height = 1, color = "#D2691E"),
                                render.Box(width = 1, height = 1, color = "#B8860B"),
                            ],
                        ),
                    ),
                    render.Padding(
                        pad = (3, 0, 0, 0),
                        child = render.Row(
                            children = [
                                render.Box(width = 1, height = 1, color = "#D2691E"),
                                render.Box(width = 1, height = 1, color = "#B8860B"),
                                render.Box(width = 1, height = 1, color = "#D2691E"),
                            ],
                        ),
                    ),
                    render.Padding(
                        pad = (3, 0, 0, 0),
                        child = render.Row(
                            children = [
                                render.Box(width = 1, height = 1, color = "#B8860B"),
                                render.Box(width = 1, height = 1, color = "#D2691E"),
                                render.Box(width = 1, height = 1, color = "#B8860B"),
                            ],
                        ),
                    ),
                    render.Padding(
                        pad = (4, 0, 0, 0),
                        child = render.Box(width = 1, height = 1, color = "#B8860B"),
                    ),
                ],
            ),
        ] + overlays,
    )

def format_flavor_for_display(name, max_chars = 5):
    """Format flavor name using base noun anchoring.

    Returns [line1, line2] where line2 = base noun, line1 = descriptors.
    Max 5 chars per line for optimal 3-cone display.
    """

    # Special case patterns for common flavors
    if "Dark Chocolate PB Crunch" in name or "Dk Choc PB Crunch" in name:
        return ["DK PB", "Crunc"]
    elif "OREO Cookie Cheesecake" in name or "Oreo" in name.lower():
        if "Cheesecake" in name:
            return ["Oreo", "Chees"]
        else:
            return ["Oreo", "Cook"]
    elif "Chocolate Covered Strawberry" in name:
        return ["Choc", "Straw"]
    elif "Devil's Food Cake" in name or "Devils Food Cake" in name:
        return ["Devil", "Cake"]
    elif "Snickers" in name:
        return ["Snkrs", "Swirl"]
    elif "Georgia Peach" in name:
        return ["GA", "Peach"]
    elif "Really Reese" in name or "Reese" in name:
        return ["Reese"]
    elif "Turtle Cheesecake" in name:
        return ["Turtl", "Chees"]
    elif "Turtle Dove" in name:
        return ["Turtl", "Dove"]
    elif "Caramel Turtle" in name:
        return ["Crml", "Turtl"]
    elif "Butter Pecan" in name:
        return ["Buttr", "Pecan"]
    elif "Caramel Cashew" in name:
        return ["Crml", "Cashw"]
    elif "Andes Mint Avalanche" in name:
        return ["Mint", "Avlnc"]
    elif "Chocolate Volcano" in name or "Choc Volcano" in name:
        return ["Choc", "Volc"]
    elif "Chocolate Decadence" in name or "Choc Decadence" in name:
        return ["Choc", "Decad"]
    elif "Chocolate Heath Crunch" in name or "Choc Heath Crunch" in name:
        return ["Heath", "Crunc"]
    elif "Caramel Fudge Cookie Dough" in name or "Crml Fudge Cook Dough" in name:
        return ["Fudge", "Dough"]
    elif "Salted Double Caramel Pecan" in name or "Salt Dbl Crml Pecan" in name:
        return ["Salt", "Pecan"]
    elif name == "Turtle":
        return ["Turtl"]

    # Base noun whitelist (5-char abbreviated forms)
    base_nouns = [
        "Avlnc",
        "Volc",
        "Chees",
        "Flury",
        "Cake",
        "Crumb",
        "Bliss",
        "Ovld",
        "Dough",
        "Pecan",
        "Cashw",
        "Fudge",
        "Crml",
        "Choc",
        "Expl",
        "Delit",
        "Dream",
        "Swirl",
        "Crunc",
        "Cook",
        "Brown",
        "Twist",
        "Turtl",
        "Mint",
        "Toff",
        "Decad",
        "Straw",
        "PBcup",
        "Dove",
    ]

    # Abbreviation map (optimized for 5 chars)
    abbr_map = {
        "Chocolate": "Choc",
        "Caramel": "Crml",
        "Raspberry": "Rasp",
        "Strawberry": "Straw",
        "Cappuccino": "Capp",
        "Peanut Butter": "PB",
        "Explosion": "Expl",
        "Crumble": "Crumb",
        "Midnight": "Midn",
        "Brownie": "Brown",
        "Batter": "Batt",
        "Toffee": "Toff",
        "Salted": "Salt",
        "Cookie": "Cook",
        "Crazy for": "Crazy4",
        "Dark": "Dk",
        "Double": "Dbl",
        "Triple": "Trpl",
        "Covered": "Covr",
        "Cheesecake": "Chees",
        "Avalanche": "Avlnc",
        "Volcano": "Volc",
        "Decadence": "Decad",
        "Turtle": "Turtl",
        "Crunch": "Crunc",
        "Cashew": "Cashw",
        "Butter": "Buttr",
    }

    abbreviated = name
    for full, short in abbr_map.items():
        abbreviated = abbreviated.replace(full, short)

    words = abbreviated.split()

    if len(words) == 0:
        return ["???"]

    base_noun = ""
    desc_words = words

    if words[-1] in base_nouns:
        base_noun = words[-1]
        desc_words = words[:-1]
    elif len(words) >= 2:
        two_word = " ".join(words[-2:])
        if two_word in ["Cook Dough", "Layer Cake", "Batt Bliss"]:
            base_noun = two_word
            desc_words = words[:-2]
        else:
            base_noun = words[-1]
            desc_words = words[:-1]
    else:
        return [words[0][:max_chars]]

    line1 = " ".join(desc_words) if desc_words else ""
    line2 = base_noun

    if len(line1) > max_chars:
        if len(desc_words) > 1:
            line1 = " ".join(desc_words[1:])
        if len(line1) > max_chars:
            line1 = line1[:max_chars]

    if len(line2) > max_chars:
        line2 = line2[:max_chars]

    if line1 and line2:
        return [line1, line2]
    elif line2:
        return [line2]
    else:
        return [name[:max_chars]]

# ─── View builders ───────────────────────────────────────────────────

def create_three_day_view(flavors, location_name):
    """Create 3-day forecast with mini cones and flavor names.

    Pixel budget (32px):
      y=0-4:  header (5px blue, descent clipped)
      y=5:    gap (1px black)
      y=6-31: content (26px per column)
    """
    columns = []
    col_height = 26
    cone_height = 11

    for i, flavor in enumerate(flavors[:3]):
        flavor_name = flavor.get("name", "Unknown")
        profile = get_flavor_profile(flavor_name)
        name_lines = format_flavor_for_display(flavor_name)

        text_children = []
        for line in name_lines:
            text_children.append(
                render.Text(
                    content = line.upper(),
                    font = "tom-thumb",
                    color = "#FFFFFF",
                ),
            )

        cone = create_mini_cone(profile)
        text_height = len(name_lines) * 6

        if i == 1:
            spacer = col_height - cone_height - text_height
            column = render.Column(
                main_align = "start",
                cross_align = "center",
                children = [cone, render.Box(width = 1, height = spacer)] + text_children,
            )
        else:
            spacer = col_height - text_height - cone_height - 1
            column = render.Padding(
                pad = (0, 0, 0, 1),
                child = render.Column(
                    main_align = "start",
                    cross_align = "center",
                    children = text_children + [render.Box(width = 1, height = spacer), cone],
                ),
            )

        columns.append(column)

    if len(columns) < 3:
        for _ in range(3 - len(columns)):
            columns.append(render.Box(width = 1))

    return render.Box(
        width = WIDTH,
        height = HEIGHT,
        child = render.Column(
            main_align = "space_between",
            cross_align = "center",
            expanded = True,
            children = [
                render.Box(
                    width = WIDTH,
                    height = 6,
                    child = render.Stack(
                        children = [
                            render.Box(width = WIDTH, height = 5, color = "#003366"),
                            render.Box(
                                width = WIDTH,
                                height = 6,
                                child = render.Text(
                                    content = location_name,
                                    font = "tom-thumb",
                                    color = "#FFFFFF",
                                ),
                            ),
                        ],
                    ),
                ),
                render.Row(
                    main_align = "space_evenly",
                    children = columns,
                ),
            ],
        ),
    )

# ─── Data fetching ───────────────────────────────────────────────────

def clean_text(text):
    """Remove trademark symbols and normalize whitespace."""
    text = text.replace("\u00ae", "")  # ®
    text = text.replace("\u2122", "")  # ™
    text = text.replace("\u00a9", "")  # ©
    return " ".join(text.split())

def parse_flavor_calendar(body):
    """Parse __NEXT_DATA__ from restaurant page HTML to extract flavor calendar.

    Returns dict with "name" (restaurant name) and "flavors" (list of {date, name}).
    Uses html.star with string-index fallback.
    """

    # Primary: use html.star CSS selector
    script_text = ""
    doc = html(body)
    node = doc.find("#__NEXT_DATA__")
    if node.len() > 0:
        script_text = node.eq(0).text()

    # Fallback: string search if html.star didn't find it
    if not script_text:
        marker = '__NEXT_DATA__"'
        idx = body.find(marker)
        if idx == -1:
            return None
        gt_idx = body.find(">", idx)
        if gt_idx == -1:
            return None
        end_idx = body.find("</script>", gt_idx)
        if end_idx == -1:
            return None
        script_text = body[gt_idx + 1:end_idx]

    if not script_text:
        return None

    data = json.decode(script_text)
    props = data.get("props", data)
    page_props = props.get("pageProps", {})
    page = page_props.get("page", {})
    custom_data = page.get("customData", {})
    calendar = custom_data.get("restaurantCalendar", {})
    raw_flavors = calendar.get("flavors", [])
    restaurant_details = custom_data.get("restaurantDetails", {})
    restaurant_name = clean_text(restaurant_details.get("name", ""))

    # Parse flavors
    flavors = []
    for f in raw_flavors:
        on_date = f.get("onDate", "")
        date = on_date.split("T")[0]
        title = clean_text(f.get("title", ""))
        if date and title:
            flavors.append({"date": date, "name": title})

    return {"name": restaurant_name, "flavors": flavors}

def fetch_flavor_calendar(slug):
    """Fetch restaurant page and parse flavor calendar.

    Returns list of {date, name} dicts for today and future, or None on error.
    """
    url = "https://www.culvers.com/restaurants/%s" % slug
    resp = http.get(url, ttl_seconds = HTTP_TTL)
    if resp.status_code != 200:
        return None

    result = parse_flavor_calendar(resp.body())
    if not result:
        return None

    # Filter to today and future (use Central time — most Culver's are CT)
    now = time.now().in_location("America/Chicago")
    today = now.format("2006-01-02")

    filtered = []
    for f in result["flavors"]:
        if f["date"] >= today:
            filtered.append(f)

    return {"name": result["name"], "flavors": filtered}

def get_flavors_for_display(config):
    """Cache orchestrator: return flavor data from cache or fetch.

    Returns dict with "name" (location) and "flavors" (list of {date, name}),
    or None on error.
    """
    location_data = get_location_from_config(config)
    if not location_data:
        return None

    slug = location_data["slug"]
    name = location_data["name"]
    cache_key = "culvers_forecast_%s" % slug

    # Check app-level cache first
    cached = cache.get(cache_key)
    if cached:
        return json.decode(cached)

    # Fetch from restaurant page
    result = fetch_flavor_calendar(slug)
    if not result:
        return None

    # Use fetched restaurant name, fall back to stored name
    if not result["name"]:
        result["name"] = name

    # Store in app-level cache
    cache.set(cache_key, json.encode(result), ttl_seconds = CACHE_TTL)

    return result

def get_location_from_config(config):
    """Extract slug and name from config's location field.

    The location value is JSON: {"slug": "mt-horeb", "name": "Mt. Horeb"}
    """
    raw = config.get("restaurant_location")
    if not raw:
        return None

    # The schema.LocationBased wraps the value in another JSON object
    loc = json.decode(raw)
    value = loc.get("value", raw)

    # The value itself is our JSON-encoded slug+name
    info = json.decode(value)
    return info

# ─── Schema: location search ────────────────────────────────────────

def get_restaurants(location):
    """schema.LocationBased handler: find nearby Culver's restaurants."""
    loc = json.decode(location)

    resp = http.get(
        "%s?lat=%s&long=%s&radius=%d&limit=%d" % (
            LOCATOR_URL,
            loc["lat"],
            loc["lng"],
            LOCATOR_RADIUS,
            LOCATOR_LIMIT,
        ),
        ttl_seconds = HTTP_TTL,
    )
    if resp.status_code != 200:
        return []

    data = resp.json()
    geofences = data.get("data", {}).get("geofences", [])

    options = []
    for restaurant in geofences:
        description = restaurant.get("description", "Unknown")
        metadata = restaurant.get("metadata", {})
        slug = metadata.get("slug", "")

        if not slug:
            continue

        value = json.encode({"slug": slug, "name": description})
        options.append(
            schema.Option(
                display = description,
                value = value,
            ),
        )

    return options

# ─── Entry points ────────────────────────────────────────────────────

def main(config):
    """Main render entry point."""

    # Fetch flavor data
    flavor_data = get_flavors_for_display(config)

    if not flavor_data or len(flavor_data.get("flavors", [])) == 0:
        return render.Root(
            child = render.Box(
                width = WIDTH,
                height = HEIGHT,
                child = render.Column(
                    main_align = "center",
                    cross_align = "center",
                    children = [
                        render.Text(
                            content = "Culver's",
                            font = "tom-thumb",
                            color = "#FFFFFF",
                        ),
                        render.Text(
                            content = "No flavors",
                            font = "tom-thumb",
                            color = "#888888",
                        ),
                    ],
                ),
            ),
        )

    return render.Root(
        child = create_three_day_view(
            flavor_data["flavors"],
            flavor_data["name"],
        ),
    )

def get_schema():
    """Configuration schema for the Tidbyt app."""
    return schema.Schema(
        version = "1",
        fields = [
            schema.LocationBased(
                id = "restaurant_location",
                name = "Culver's Location",
                desc = "Pick your Culver's restaurant.",
                icon = "iceCream",
                handler = get_restaurants,
            ),
        ],
    )
