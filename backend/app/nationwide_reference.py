"""Dated, non-operational nationwide reference records for the hackathon demo.

Population values are Census 2011 baselines. Capital coordinates are map anchors,
not hazard observations. The API deliberately returns no state risk score or
shelter occupancy where authorised local evidence is absent.
"""

SOURCE_REGISTER = [
    {"name": "Population Census 2011 – Primary Census Abstract", "publisher": "Office of the Registrar General & Census Commissioner, India", "url": "https://censusindia.gov.in/census.website/en/data/population-finder", "period": "2011", "use": "population and density reference baseline"},
    {"name": "Local Government Directory", "publisher": "Ministry of Panchayati Raj, Government of India", "url": "https://lgdirectory.gov.in/demo/downloadDirectory.do", "period": "accessed 2026-09-02", "use": "administrative-name verification"},
    {"name": "SACHET public CAP/RSS alerts", "publisher": "National Disaster Management Authority", "url": "https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml", "period": "event-driven live feed", "use": "active public alert records; only publisher-supplied CAP polygons/circles are mapped"},
    {"name": "USGS Earthquake Hazards Program GeoJSON feed", "publisher": "U.S. Geological Survey", "url": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson", "period": "rolling all-day feed", "use": "supplemental observed epicentre points; no impact radius is inferred"},
    {"name": "Bhuvan historical flood WMS", "publisher": "National Remote Sensing Centre, ISRO", "url": "https://bhuvan-ras2.nrsc.gov.in/cgi-bin/flood.exe?SERVICE=WMS&REQUEST=GetCapabilities", "period": "dated event/year layers", "use": "historical raster reference for states with verified public layer names; not current warnings"},
    {"name": "Copernicus Data Space Ecosystem", "publisher": "European Union Copernicus programme", "url": "https://documentation.dataspace.copernicus.eu/APIs/STAC.html", "period": "reference accessed 2026-09-11", "use": "Sentinel-1/2 scene discovery for a future analyst-verified workflow; no live scene fetched in this demo"},
]

_ROWS = [
    ("Andhra Pradesh","Amaravati",49386799,308),("Arunachal Pradesh","Itanagar",1383727,17),("Assam","Dispur",31205576,398),
    ("Bihar","Patna",104099452,1106),("Chhattisgarh","Raipur",25545198,189),("Goa","Panaji",1458545,394),
    ("Gujarat","Gandhinagar",60439692,308),("Haryana","Chandigarh",25351462,573),("Himachal Pradesh","Shimla",6864602,123),
    ("Jharkhand","Ranchi",32988134,414),("Karnataka","Bengaluru",61095297,319),("Kerala","Thiruvananthapuram",33406061,860),
    ("Madhya Pradesh","Bhopal",72626809,236),("Maharashtra","Mumbai",112374333,365),("Manipur","Imphal",2855794,115),
    ("Meghalaya","Shillong",2966889,132),("Mizoram","Aizawl",1097206,52),("Nagaland","Kohima",1978502,119),
    ("Odisha","Bhubaneswar",41974218,270),("Punjab","Chandigarh",27743338,551),("Rajasthan","Jaipur",68548437,200),
    ("Sikkim","Gangtok",610577,86),("Tamil Nadu","Chennai",72147030,555),("Telangana","Hyderabad",35193978,312),
    ("Tripura","Agartala",3673917,350),("Uttar Pradesh","Lucknow",199812341,828),("Uttarakhand","Dehradun",10086292,189),
    ("West Bengal","Kolkata",91276115,1028),("Andaman and Nicobar Islands","Sri Vijaya Puram",380581,46),
    ("Chandigarh","Chandigarh",1055450,9252),("Dadra and Nagar Haveli and Daman and Diu","Daman",586620,None),
    ("Delhi","New Delhi",16787941,11320),("Jammu and Kashmir","Srinagar",11992724,None),("Ladakh","Leh",274289,5),
    ("Lakshadweep","Kavaratti",64473,2149),("Puducherry","Puducherry",1247953,2547),
]

STATE_REFERENCES = [
    {"name": name, "capital": capital, "population_2011": population, "density_per_sq_km_2011": density}
    for name, capital, population, density in _ROWS
]


def find_state_reference(name: str) -> dict | None:
    normalised = name.strip().casefold()
    return next((item for item in STATE_REFERENCES if item["name"].casefold() == normalised), None)
