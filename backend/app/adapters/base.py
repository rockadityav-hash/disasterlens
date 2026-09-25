from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass
from datetime import date, datetime
from typing import Any


@dataclass(frozen=True)
class SourceMetadata:
    organisation: str
    source_url: str
    dataset_version: str
    collection_date: date
    import_date: datetime
    geographic_resolution: str
    update_frequency: str
    licence_or_restrictions: str
    confidence_level: str
    last_verification_date: date

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class DataAdapter(ABC):
    """Contract for API, WMS/WFS, download and controlled manual-import adapters."""

    @property
    @abstractmethod
    def source(self) -> SourceMetadata: ...

    @abstractmethod
    def fetch(self) -> list[dict[str, Any]]: ...

    def normalise(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [{**row, "source_metadata": self.source.to_dict()} for row in rows]


@dataclass(frozen=True)
class HazardFetchResult:
    """One bounded fetch from an external hazard source.

    Adapters return normalized GeoJSON Features.  The service owns caching and
    failure isolation so an unavailable source cannot hide healthy sources.
    """

    features: list[dict[str, Any]]
    fetched_at: datetime
    etag: str | None = None
    not_modified: bool = False
    warnings: tuple[str, ...] = ()


class HazardFeedAdapter(ABC):
    """Contract shared by official alert/event feed adapters."""

    source_id: str
    source_name: str
    source_url: str
    official: bool = True

    @abstractmethod
    def fetch(self, *, etag: str | None = None, now: datetime | None = None) -> HazardFetchResult: ...
