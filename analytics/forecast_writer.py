"""Natural language flavor forecast generation — weather-style prose from predictions.

Uses prediction probabilities + store context to generate estimated outlooks like:
"Estimated outlook: Caramel Cashew or Turtle. Chocolate Covered Strawberry is
overdue -- last served 45 days ago." All predictions carry the Estimated certainty
tier -- only confirmed schedule data is Confirmed.
"""

from datetime import datetime

import pandas as pd

from analytics.basic_metrics import days_since_last, overdue_flavors
from analytics.predict import FlavorPredictor


def build_forecast_context(
    model: FlavorPredictor,
    df: pd.DataFrame,
    store_slug: str,
    date: pd.Timestamp,
    n_top: int = 5,
    n_overdue: int = 3,
) -> dict:
    """Build structured context for forecast generation."""
    date = pd.Timestamp(date)
    proba = model.predict_proba(store_slug, date)

    top = proba.nlargest(n_top)
    predictions = [
        {"flavor": f, "probability": round(float(p), 4)}
        for f, p in top.items()
    ]

    overdue = overdue_flavors(df, store_slug, as_of=date)
    overdue_list = []
    for _, row in overdue.head(n_overdue).iterrows():
        overdue_list.append({
            "flavor": row["title"],
            "days_since": int(row["days_since"]),
            "avg_gap": float(row["avg_gap"]),
        })

    store_df = df[(df["store_slug"] == store_slug) & (df["flavor_date"] < date)]
    recent = store_df.sort_values("flavor_date", ascending=False).head(3)
    recent_history = [
        {"date": str(r["flavor_date"].date()), "flavor": r["title"]}
        for _, r in recent.iterrows()
    ]

    return {
        "store_slug": store_slug,
        "store_name": store_slug.replace("-", " ").title(),
        "date": str(date.date()),
        "day_of_week": date.strftime("%A"),
        "predictions": predictions,
        "overdue_flavors": overdue_list,
        "recent_history": recent_history,
    }


def format_forecast_template(context: dict) -> str:
    """Generate forecast using a deterministic template (no LLM required)."""
    store = context["store_name"]
    date = context["date"]
    dow = context["day_of_week"]
    preds = context["predictions"]
    overdue = context["overdue_flavors"]

    if preds:
        top = preds[0]
        lines = [f"**{dow}'s Flavor Forecast for {store}** ({date})", ""]

        top_str = top["flavor"]
        if len(preds) > 1:
            runner_up = preds[1]
            top_str += f" or {runner_up['flavor']}"

        lines.append(f"Estimated outlook: {top_str}.")

        if len(preds) > 2:
            others = ", ".join(p["flavor"] for p in preds[2:])
            lines.append(f"Also possible: {others}.")
    else:
        lines = [f"**Flavor Forecast for {store}** ({date})", "", "Insufficient data for prediction."]

    if overdue:
        lines.append("")
        for o in overdue:
            lines.append(
                f"Watch for **{o['flavor']}** — last served {o['days_since']} days ago "
                f"(typically every {o['avg_gap']:.0f} days)."
            )

    return "\n".join(lines)


def generate_forecast_llm(
    context: dict,
    api_key: str | None = None,
    model: str = "claude-sonnet-4-20250514",
) -> str:
    """Generate natural language forecast using Claude API.

    Falls back to template if anthropic is not installed or API key missing.
    """
    try:
        import anthropic
    except ImportError:
        return format_forecast_template(context)

    if not api_key:
        import os
        api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return format_forecast_template(context)

    client = anthropic.Anthropic(api_key=api_key)

    prompt = f"""You are a custard meteorologist writing a fun, brief flavor forecast.
Use weather-themed language naturally. Keep it to 2-3 sentences max.

Store: {context['store_name']}
Date: {context['day_of_week']}, {context['date']}

Top predictions:
{chr(10).join(f"- {p['flavor']}: {p['probability']:.1%}" for p in context['predictions'])}

Recent history:
{chr(10).join(f"- {h['date']}: {h['flavor']}" for h in context['recent_history'])}

{"Overdue flavors:" if context['overdue_flavors'] else ""}
{chr(10).join(f"- {o['flavor']}: {o['days_since']} days (avg {o['avg_gap']:.0f})" for o in context['overdue_flavors'])}

Write the forecast:"""

    try:
        message = client.messages.create(
            model=model,
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text
    except Exception:
        # LLM is optional -- fall back to deterministic template
        return format_forecast_template(context)


def generate_forecast_json(
    model: FlavorPredictor,
    df: pd.DataFrame,
    store_slug: str,
    date: pd.Timestamp,
    n_predictions: int = 10,
) -> dict:
    """Generate a forecast as structured JSON for API consumption."""
    date = pd.Timestamp(date)
    proba = model.predict_proba(store_slug, date)

    predictions = [
        {"flavor": f, "probability": round(float(p), 4)}
        for f, p in proba.nlargest(n_predictions).items()
    ]

    context = build_forecast_context(model, df, store_slug, date)

    return {
        "store_slug": store_slug,
        "date": str(date.date()),
        "predictions": predictions,
        "total_probability": round(float(proba.sum()), 4),
        "overdue_flavors": context["overdue_flavors"],
        "prose": format_forecast_template(context),
    }


def generate_multiday_forecast_json(
    model: FlavorPredictor,
    df: pd.DataFrame,
    store_slug: str,
    start_date: pd.Timestamp,
    n_days: int = 7,
    n_predictions: int = 10,
) -> dict:
    """Generate multi-day forecast with confidence metadata.

    Wraps generate_forecast_json() in a loop over n_days, adding a confidence
    bucket to each prediction based on probability thresholds.
    """
    start_date = pd.Timestamp(start_date)
    history_depth = len(df[df["store_slug"] == store_slug])

    days = []
    for i in range(n_days):
        date = start_date + pd.Timedelta(days=i)
        single = generate_forecast_json(model, df, store_slug, date, n_predictions)

        for p in single["predictions"]:
            p["certainty_tier"] = "estimated"

        days.append({
            "date": single["date"],
            "predictions": single["predictions"],
            "overdue_flavors": single["overdue_flavors"],
            "prose": single["prose"],
        })

    return {
        "store_slug": store_slug,
        "generated_at": datetime.now().isoformat(),
        "history_depth": history_depth,
        "days": days,
    }
