import json
import unittest
from datetime import datetime, timezone

from app.adapters.http import HttpDocument
from app.adapters.ndma import NdmaSachetAdapter, normalize_cap_alert, normalize_hazard_type, normalize_rss_item, parse_xml_safely
from app.adapters.usgs import normalize_usgs_feature


NOW = datetime(2026, 9, 16, 12, 0, tzinfo=timezone.utc)


def cap_xml(*, polygon: str | None = "25.0,84.0 25.0,85.0 26.0,85.0 25.0,84.0") -> bytes:
    geometry = f"<polygon>{polygon}</polygon>" if polygon else ""
    return f"""<?xml version="1.0"?>
    <alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
      <identifier>cap-123</identifier><sender>ndma@example.gov.in</sender>
      <sent>2026-09-16T10:00:00Z</sent><status>Actual</status>
      <msgType>Alert</msgType><scope>Public</scope>
      <info><language>en-IN</language><category>Met</category>
        <event>Flood warning</event><urgency>Immediate</urgency>
        <severity>Severe</severity><certainty>Likely</certainty>
        <effective>2026-09-16T10:00:00Z</effective>
        <expires>2026-09-17T10:00:00Z</expires>
        <headline>Bihar flood warning</headline><description>Official warning text.</description>
        <area><areaDesc>Patna, Bihar</areaDesc>{geometry}</area>
      </info>
    </alert>""".encode()


class HazardAdapterTests(unittest.TestCase):
    def test_cap_polygon_is_preserved_with_coordinate_order_changed_only(self):
        root = parse_xml_safely(cap_xml())
        feature = normalize_cap_alert(root, document_url="https://sachet.ndma.gov.in/cap.xml", fetched_at=NOW, now=NOW)
        self.assertIsNotNone(feature)
        self.assertEqual(feature["geometry"]["type"], "Polygon")
        self.assertEqual(feature["geometry"]["coordinates"][0][0], [84.0, 25.0])
        self.assertEqual(feature["properties"]["geometry_origin"], "official_polygon")
        self.assertTrue(feature["properties"]["is_active"])

    def test_cap_area_without_geometry_is_retained_without_inventing_polygon(self):
        root = parse_xml_safely(cap_xml(polygon=None))
        feature = normalize_cap_alert(root, document_url="https://sachet.ndma.gov.in/cap.xml", fetched_at=NOW, now=NOW)
        self.assertIsNone(feature["geometry"])
        self.assertEqual(feature["properties"]["geometry_origin"], "unavailable")
        self.assertEqual(feature["properties"]["area_description"], "Patna, Bihar")

    def test_xml_parser_rejects_entity_declarations(self):
        with self.assertRaises(ValueError):
            parse_xml_safely(b'<!DOCTYPE x [<!ENTITY secret "x">]><x>&secret;</x>')

    def test_ndma_rss_selects_newest_matching_state_item(self):
        rss = b"""<rss xmlns:cap="urn:oasis:names:tc:emergency:cap:1.2"><channel>
          <item><title>Bihar newest flood alert</title><guid>new</guid>
            <pubDate>Wed, 16 Sep 2026 10:00:00 GMT</pubDate><cap:expires>2026-09-17T00:00:00Z</cap:expires></item>
          <item><title>Bihar older flood alert</title><guid>old</guid>
            <pubDate>Tue, 15 Sep 2026 10:00:00 GMT</pubDate><cap:expires>2026-09-17T00:00:00Z</cap:expires></item>
          <item><title>Punjab unrelated alert</title><guid>other</guid></item>
        </channel></rss>"""

        def fetcher(url, **_kwargs):
            if url.endswith("rss_india.xml"):
                return HttpDocument(rss, url, 200, {"etag": "v1"})
            raise RuntimeError("No linked CAP fixture")

        adapter = NdmaSachetAdapter(fetcher=fetcher, max_items=1, match_terms=("bihar",))
        result = adapter.fetch(now=NOW)
        self.assertEqual(len(result.features), 1)
        self.assertEqual(result.features[0]["properties"]["title"], "Bihar newest flood alert")

    def test_linked_cap_documents_are_revalidated_with_etag(self):
        cap_url = "https://sachet.ndma.gov.in/cap-123.xml"
        rss = f"""<rss><channel><item><title>Bihar alert</title><guid>{cap_url}</guid>
          <link>{cap_url}</link><pubDate>Wed, 16 Sep 2026 10:00:00 GMT</pubDate>
        </item></channel></rss>""".encode()
        cap_headers = []

        def fetcher(url, **kwargs):
            if url.endswith("rss_india.xml"):
                return HttpDocument(rss, url, 200, {})
            cap_headers.append(kwargs.get("headers"))
            if len(cap_headers) == 1:
                return HttpDocument(cap_xml(), cap_url, 200, {"etag": '"cap-v1"'})
            return HttpDocument(b"", cap_url, 304, {"etag": '"cap-v1"'})

        adapter = NdmaSachetAdapter(fetcher=fetcher, match_terms=("bihar",))
        first = adapter.fetch(now=NOW)
        second = adapter.fetch(now=NOW)

        self.assertEqual(len(first.features), 1)
        self.assertEqual(len(second.features), 1)
        self.assertEqual(cap_headers, [None, {"If-None-Match": '"cap-v1"'}])

    def test_weather_wording_is_not_upgraded_to_a_confirmed_flood(self):
        self.assertEqual(normalize_hazard_type("Heavy rainfall warning"), "heavy_rain")
        self.assertEqual(normalize_hazard_type("Thunderstorm with lightning warning"), "thunderstorm")
        self.assertEqual(normalize_hazard_type("River flood warning"), "flood")

    def test_rss_fallback_without_expiry_is_not_indefinitely_active(self):
        item = parse_xml_safely(
            b"<item><title>Bihar heavy rain warning</title><guid>x-1</guid><pubDate>Wed, 16 Sep 2026 10:00:00 GMT</pubDate></item>"
        )
        feature = normalize_rss_item(item, feed_url="https://sachet.ndma.gov.in/feed.xml", fetched_at=NOW, now=NOW)
        self.assertFalse(feature["properties"]["is_active"])

    def test_usgs_geometry_remains_an_epicentre_point(self):
        raw = {
            "type": "Feature",
            "id": "us-test",
            "geometry": {"type": "Point", "coordinates": [85.1, 25.6, 12]},
            "properties": {"mag": 4.8, "place": "near Patna", "time": 1789552800000},
        }
        feature = normalize_usgs_feature(raw, fetched_at=NOW, feed_url="https://earthquake.usgs.gov/feed.geojson")
        self.assertEqual(feature["geometry"], {"type": "Point", "coordinates": [85.1, 25.6, 12.0]})
        self.assertEqual(feature["properties"]["verification_status"], "supplemental_official_source")
        self.assertIn("no hazard radius", feature["properties"]["provenance"]["transformation"].lower())


if __name__ == "__main__":
    unittest.main()
