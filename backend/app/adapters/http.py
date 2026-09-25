"""Small, bounded HTTP reader used by hazard adapters."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


class FeedFetchError(RuntimeError):
    """External feed could not be read safely."""


@dataclass(frozen=True)
class HttpDocument:
    body: bytes
    final_url: str
    status: int
    headers: dict[str, str]


def fetch_url(
    url: str,
    *,
    headers: Mapping[str, str] | None = None,
    timeout: float = 5.0,
    max_bytes: int = 2_000_000,
) -> HttpDocument:
    """Fetch one HTTPS document with a timeout and hard response-size limit."""

    if urlparse(url).scheme.lower() != "https":
        raise FeedFetchError("Hazard feed URLs must use HTTPS.")
    request_headers = {
        "Accept": "application/geo+json, application/json, application/xml, text/xml, application/rss+xml;q=0.9",
        "User-Agent": "SurakshaSetu/1.0 hazard-ingestion",
        **dict(headers or {}),
    }
    request = Request(url, headers=request_headers)
    try:
        with urlopen(request, timeout=timeout) as response:
            final_url = response.geturl()
            if urlparse(final_url).scheme.lower() != "https":
                raise FeedFetchError("Hazard feed redirected to a non-HTTPS URL.")
            length = response.headers.get("Content-Length")
            if length and int(length) > max_bytes:
                raise FeedFetchError("Hazard feed response exceeds the configured size limit.")
            body = response.read(max_bytes + 1)
            if len(body) > max_bytes:
                raise FeedFetchError("Hazard feed response exceeds the configured size limit.")
            return HttpDocument(
                body=body,
                final_url=final_url,
                status=getattr(response, "status", 200),
                headers={key.lower(): value for key, value in response.headers.items()},
            )
    except HTTPError as error:
        if error.code == 304:
            return HttpDocument(body=b"", final_url=url, status=304, headers={key.lower(): value for key, value in error.headers.items()})
        raise FeedFetchError(f"Hazard source returned HTTP {error.code}.") from error
    except (URLError, TimeoutError, OSError, ValueError) as error:
        raise FeedFetchError("Hazard source is temporarily unreachable.") from error
