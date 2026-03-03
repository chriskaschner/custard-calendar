"""
Alexa Lambda handler for the Custard Forecast skill.

Resolves a store name spoken by the user to a slug, queries the
Custard Calendar Worker API for today's flavor, and speaks the result.
"""

import logging
import re

import requests
from ask_sdk_core.dispatch_components import (
    AbstractExceptionHandler,
    AbstractRequestHandler,
)
from ask_sdk_core.handler_input import HandlerInput
from ask_sdk_core.skill_builder import SkillBuilder
from ask_sdk_core.utils import is_intent_name, is_request_type
from ask_sdk_model import Response
from ask_sdk_model.slu.entityresolution import StatusCode

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Worker API base URL -- no trailing slash
API_BASE = "https://custard-calendar.chris-kaschner.workers.dev/api/v1"

# Timeout for upstream API calls (seconds)
API_TIMEOUT = 5


def _resolve_slot_to_slug(handler_input: HandlerInput) -> str | None:
    """Extract store slug from the intent's slot via entity resolution.

    Checks for a successful ER match first (the slot type maps spoken
    store names to their canonical slug IDs). Falls back to naive
    slugification of the raw spoken value.
    """
    slot = (
        handler_input.request_envelope.request.intent.slots.get("store")
        if hasattr(handler_input.request_envelope.request, "intent")
        and handler_input.request_envelope.request.intent.slots
        else None
    )
    if slot is None:
        return None

    # Try entity resolution first -- the STORE_NAME slot type has IDs
    # set to the canonical slug for each store.
    resolutions = slot.resolutions
    if resolutions and resolutions.resolutions_per_authority:
        for authority in resolutions.resolutions_per_authority:
            if (
                authority.status
                and authority.status.code == StatusCode.ER_SUCCESS_MATCH
                and authority.values
            ):
                return authority.values[0].value.id

    # Fallback: slugify the raw spoken value.
    raw = slot.value
    if raw:
        return _slugify(raw)

    return None


def _slugify(text: str) -> str:
    """Convert a spoken store name into a plausible slug.

    Strips punctuation, lowercases, and replaces spaces with hyphens.
    This is a best-effort fallback when entity resolution misses.
    """
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"\s+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-")


def _fetch_today(slug: str) -> dict:
    """Call the Worker API for today's flavor at the given slug.

    Returns the parsed JSON response dict. Raises on HTTP or network errors.
    """
    url = f"{API_BASE}/today"
    resp = requests.get(url, params={"slug": slug}, timeout=API_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


# ---------------------------------------------------------------------------
# Request Handlers
# ---------------------------------------------------------------------------

class LaunchRequestHandler(AbstractRequestHandler):
    """Handle skill launch with no specific intent."""

    def can_handle(self, handler_input: HandlerInput) -> bool:
        return is_request_type("LaunchRequest")(handler_input)

    def handle(self, handler_input: HandlerInput) -> Response:
        speech = (
            "Welcome to Custard Forecast! "
            "Ask me for today's flavor at any store. "
            "For example, say: what's the flavor at Mt. Horeb?"
        )
        reprompt = "Which store would you like to check? Say a city name."
        return (
            handler_input.response_builder
            .speak(speech)
            .ask(reprompt)
            .response
        )


class GetFlavorIntentHandler(AbstractRequestHandler):
    """Handle GetFlavorIntent -- the core of the skill."""

    def can_handle(self, handler_input: HandlerInput) -> bool:
        return is_intent_name("GetFlavorIntent")(handler_input)

    def handle(self, handler_input: HandlerInput) -> Response:
        slug = _resolve_slot_to_slug(handler_input)

        if not slug:
            speech = (
                "I didn't catch the store name. "
                "Try saying something like: what's the flavor at Madison?"
            )
            return (
                handler_input.response_builder
                .speak(speech)
                .ask("Which store should I check?")
                .response
            )

        try:
            data = _fetch_today(slug)
        except requests.exceptions.HTTPError as exc:
            status = exc.response.status_code if exc.response is not None else 0
            if status == 400:
                # Slug not recognized by the API
                speech = (
                    f"I couldn't find a store matching {slug.replace('-', ' ')}. "
                    "Try a different city name or check the Custard Forecast website "
                    "for a full list of stores."
                )
            else:
                logger.error("API HTTP error for slug=%s: %s", slug, exc)
                speech = (
                    "The flavor forecast service is temporarily unavailable. "
                    "Please try again in a few minutes."
                )
            return (
                handler_input.response_builder
                .speak(speech)
                .response
            )
        except requests.exceptions.RequestException as exc:
            logger.error("API request failed for slug=%s: %s", slug, exc)
            speech = (
                "I had trouble reaching the flavor forecast service. "
                "Please try again in a moment."
            )
            return (
                handler_input.response_builder
                .speak(speech)
                .response
            )

        # The API returns a pre-composed spoken sentence
        spoken = data.get("spoken", "")
        flavor = data.get("flavor")

        if not flavor:
            speech = spoken or (
                "I don't have today's flavor for that store yet. "
                "Check back later -- the forecast updates daily."
            )
            return (
                handler_input.response_builder
                .speak(speech)
                .response
            )

        # Speak the flavor and offer a follow-up
        reprompt = "Want to check another store?"
        return (
            handler_input.response_builder
            .speak(f"{spoken} Want to check another store?")
            .ask(reprompt)
            .response
        )


class HelpIntentHandler(AbstractRequestHandler):
    """Handle AMAZON.HelpIntent."""

    def can_handle(self, handler_input: HandlerInput) -> bool:
        return is_intent_name("AMAZON.HelpIntent")(handler_input)

    def handle(self, handler_input: HandlerInput) -> Response:
        speech = (
            "Custard Forecast covers over a thousand frozen custard stores "
            "across the United States. Just say the city name of a store "
            "and I'll tell you today's flavor of the day. "
            "For example: what's the flavor at Mt. Horeb? "
            "Or try: what's scooping at Milwaukee?"
        )
        reprompt = "Which store would you like to check?"
        return (
            handler_input.response_builder
            .speak(speech)
            .ask(reprompt)
            .response
        )


class CancelOrStopIntentHandler(AbstractRequestHandler):
    """Handle AMAZON.CancelIntent and AMAZON.StopIntent."""

    def can_handle(self, handler_input: HandlerInput) -> bool:
        return (
            is_intent_name("AMAZON.CancelIntent")(handler_input)
            or is_intent_name("AMAZON.StopIntent")(handler_input)
        )

    def handle(self, handler_input: HandlerInput) -> Response:
        return (
            handler_input.response_builder
            .speak("Stay frosty.")
            .response
        )


class FallbackIntentHandler(AbstractRequestHandler):
    """Handle AMAZON.FallbackIntent for unrecognized utterances."""

    def can_handle(self, handler_input: HandlerInput) -> bool:
        return is_intent_name("AMAZON.FallbackIntent")(handler_input)

    def handle(self, handler_input: HandlerInput) -> Response:
        speech = (
            "I'm not sure what you're looking for. "
            "Try asking: what's the flavor at, and then a city name."
        )
        reprompt = "Say a city name to get today's flavor."
        return (
            handler_input.response_builder
            .speak(speech)
            .ask(reprompt)
            .response
        )


class SessionEndedRequestHandler(AbstractRequestHandler):
    """Handle session termination (user exits, error, or timeout)."""

    def can_handle(self, handler_input: HandlerInput) -> bool:
        return is_request_type("SessionEndedRequest")(handler_input)

    def handle(self, handler_input: HandlerInput) -> Response:
        reason = handler_input.request_envelope.request.reason
        logger.info("Session ended: %s", reason)
        return handler_input.response_builder.response


class CatchAllExceptionHandler(AbstractExceptionHandler):
    """Catch-all for unhandled exceptions. Logs and gives a graceful response."""

    def can_handle(self, handler_input: HandlerInput, exception: Exception) -> bool:
        return True

    def handle(self, handler_input: HandlerInput, exception: Exception) -> Response:
        logger.error("Unhandled exception: %s", exception, exc_info=True)
        speech = (
            "Sorry, something went wrong with the flavor forecast. "
            "Please try again."
        )
        return (
            handler_input.response_builder
            .speak(speech)
            .response
        )


# ---------------------------------------------------------------------------
# Skill Builder
# ---------------------------------------------------------------------------

sb = SkillBuilder()

# Register handlers in priority order (first match wins)
sb.add_request_handler(LaunchRequestHandler())
sb.add_request_handler(GetFlavorIntentHandler())
sb.add_request_handler(HelpIntentHandler())
sb.add_request_handler(CancelOrStopIntentHandler())
sb.add_request_handler(FallbackIntentHandler())
sb.add_request_handler(SessionEndedRequestHandler())

sb.add_exception_handler(CatchAllExceptionHandler())

# Lambda entry point
handler = sb.lambda_handler()
