from datetime import date, datetime, timezone

from .base import DataAdapter, SourceMetadata


class ImdWarningMockAdapter(DataAdapter):
    """Credential-free schema-compatible adapter; replace fetch() after IMD approval."""

    @property
    def source(self) -> SourceMetadata:
        return SourceMetadata(
            organisation="India Meteorological Department",
            source_url="https://api.imd.gov.in/public/api_reference.html",
            dataset_version="public API demonstration schema",
            collection_date=date(2026, 9, 1),
            import_date=datetime.now(timezone.utc),
            geographic_resolution="district",
            update_frequency="15 minutes",
            licence_or_restrictions="IMD access terms and credentials apply",
            confidence_level="high",
            last_verification_date=date(2026, 9, 1),
        )

    def fetch(self) -> list[dict]:
        return self.normalise([{
            "external_id":"IMD-RPG-DEMO-01",
            "district_lgd_code":"046",
            "hazard_type":"heavy_rain",
            "severity":"orange",
            "issued_at":"2026-09-01T08:18:00+05:30",
            "valid_until":"2026-09-02T08:30:00+05:30",
            "original_payload":{"synthetic":True},
            "synthetic":True,
        }])
