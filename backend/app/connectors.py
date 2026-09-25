from dataclasses import asdict, dataclass
from datetime import datetime, timezone


@dataclass(frozen=True)
class ConnectorStatus:
    id: str
    organisation: str
    dataset: str
    adapter_type: str
    status: str
    label: str
    state_scope: str
    update_frequency: str
    source_url: str
    last_checked: str | None


def connector_catalogue() -> list[dict]:
    checked = datetime.now(timezone.utc).isoformat()
    rows = [
        ConnectorStatus("ndma-sachet", "NDMA", "SACHET public CAP/RSS alerts", "CAP/RSS", "configured_live", "Public live feed; health is reported per hazard snapshot", "India", "event-driven", "https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml", None),
        ConnectorStatus("usgs-earthquakes", "U.S. Geological Survey", "Observed earthquake epicentres", "GeoJSON", "configured_live", "Supplemental official points; never converted into red-zone radii", "Within configured radius of map anchor", "all-day rolling feed", "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson", None),
        ConnectorStatus("imd", "India Meteorological Department", "Warnings and nowcasts", "authorised API", "not_configured", "Authorised credentials/IP whitelisting required", "India", "source-defined", "https://mausam.imd.gov.in/", None),
        ConnectorStatus("cwc", "Central Water Commission", "Flood forecasts", "portal / SACHET distribution", "not_configured", "No undocumented direct API is used; relevant public CAP alerts may arrive through SACHET", "India", "source-defined", "https://ffs.india-water.gov.in/", None),
        ConnectorStatus("bhuvan", "ISRO Bhuvan / NRSC", "Dated historical flood layers", "WMS", "configured_reference", "Historical raster reference only; not a live alert or shelter-screening polygon", "Selected states with verified public layer names", "historical", "https://bhuvan-ras2.nrsc.gov.in/cgi-bin/flood.exe", None),
        ConnectorStatus("copernicus-stac", "Copernicus Data Space Ecosystem", "Sentinel-1/2 scene catalogue", "STAC API", "public_catalogue", "Public catalogue; not connected", "India", "source-defined", "https://documentation.dataspace.copernicus.eu/APIs/STAC.html", checked),
        ConnectorStatus("incois", "INCOIS", "Ocean hazard advisories", "authorised feed", "not_configured", "Reference connector", "Coastal states", "event-driven", "https://incois.gov.in/", checked),
        ConnectorStatus("demo-rudraprayag", "SurakshaSetu", "Synthetic shelter and satellite demonstration", "bundled JSON", "available", "Demonstration data", "India", "static snapshot", "local://sample-data", checked),
    ]
    return [asdict(row) for row in rows]


def demo_import_jobs(state: str | None = None) -> list[dict]:
    if state and state != "Uttarakhand":
        return []
    return [
        {"id": "job-demo-003", "source": "Government shelters Q2", "state": "Uttarakhand", "dataset": "shelters", "status": "completed", "started_at": "2026-09-01T08:10:00+05:30", "finished_at": "2026-09-01T08:10:03+05:30", "imported": 12, "updated": 0, "failed": 0, "error": None, "synthetic": True},
        {"id": "job-demo-002", "source": "PMGSY road status", "state": "Uttarakhand", "dataset": "roads", "status": "needs_review", "started_at": "2026-09-01T08:05:00+05:30", "finished_at": "2026-09-01T08:05:07+05:30", "imported": 421, "updated": 17, "failed": 2, "error": "Two demonstration geometries require manual review.", "synthetic": True},
        {"id": "job-demo-001", "source": "GP population update", "state": "Uttarakhand", "dataset": "population", "status": "completed", "started_at": "2026-09-01T08:00:00+05:30", "finished_at": "2026-09-01T08:00:05+05:30", "imported": 1284, "updated": 0, "failed": 0, "error": None, "synthetic": True},
    ]
