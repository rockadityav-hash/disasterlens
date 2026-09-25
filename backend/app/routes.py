import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import HTTPException

from .models import RouteInput

ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes"
FIELD_MASK = "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.routeLabels"


def compute_google_routes(payload: RouteInput) -> dict:
    """Proxy the Routes API so its key is never exposed to browser JavaScript."""
    api_key = os.getenv("GOOGLE_MAPS_ROUTES_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Google Routes is not configured. Add a restricted server-side GOOGLE_MAPS_ROUTES_API_KEY.")
    body = {
        "origin": {"location": {"latLng": payload.origin.model_dump()}},
        "destination": {"location": {"latLng": payload.destination.model_dump()}},
        "travelMode": payload.travel_mode,
        "computeAlternativeRoutes": payload.compute_alternatives,
        "routingPreference": "TRAFFIC_AWARE" if payload.travel_mode == "DRIVE" else None,
        "languageCode": "en-IN",
        "units": "METRIC",
    }
    body = {key: value for key, value in body.items() if value is not None}
    request = Request(
        ROUTES_URL,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", "X-Goog-Api-Key": api_key, "X-Goog-FieldMask": FIELD_MASK},
        method="POST",
    )
    try:
        with urlopen(request, timeout=12) as response:
            result = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise HTTPException(status_code=502, detail=f"Google Routes rejected the request: {detail[:300]}") from error
    except (URLError, TimeoutError) as error:
        raise HTTPException(status_code=502, detail="Google Routes is temporarily unreachable.") from error
    return {**result, "provisional": True, "field_verification_required": True}
