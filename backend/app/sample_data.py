VILLAGES = [
    {"lgd_code":"043219","name":"Tilwara","population":2410,"hazard":"Flood + landslide","risk_score":72,"risk_class":"High","confidence":89},
    {"lgd_code":"043220","name":"Agastyamuni","population":3860,"hazard":"Flood","risk_score":46,"risk_class":"Moderate","confidence":91},
    {"lgd_code":"043221","name":"Ukhimath","population":1980,"hazard":"Landslide","risk_score":88,"risk_class":"Very High","confidence":86},
    {"lgd_code":"043222","name":"Guptkashi","population":3220,"hazard":"Earthquake","risk_score":23,"risk_class":"Low","confidence":82},
    {"lgd_code":"043223","name":"Silli","population":1740,"hazard":"Flood","risk_score":69,"risk_class":"High","confidence":88},
    {"lgd_code":"043224","name":"Phata","population":1260,"hazard":"Landslide + isolation","risk_score":91,"risk_class":"Very High","confidence":84},
    {"lgd_code":"043225","name":"Chopta","population":940,"hazard":"Forest fire","risk_score":43,"risk_class":"Moderate","confidence":78},
]

ALERTS = [
    {"id":"IMD-RPG-20260901-01","title":"Heavy rainfall","severity":"Orange","source":"India Meteorological Department","issued_at":"2026-09-01T08:18:00+05:30","valid_until":"2026-09-02T08:30:00+05:30","is_active":True,"synthetic":True},
    {"id":"CWC-RPG-20260901-02","title":"River level watch","severity":"Watch","source":"CWC mock adapter","issued_at":"2026-09-01T08:00:00+05:30","valid_until":"2026-09-01T20:00:00+05:30","is_active":True,"synthetic":True},
]

DATA_SOURCES = [
    {"organisation":"Geological Survey of India","name":"Bhusanket landslide susceptibility","url":"https://bhusanket.gsi.gov.in/","version":"2025 demonstration schema","collection_date":"2025-06-01","import_date":"2026-08-31","geographic_resolution":"village polygon","update_frequency":"annual","licence":"Official access conditions apply","confidence":"high","last_verified":"2026-08-31","adapter":"mock"},
    {"organisation":"India Meteorological Department","name":"District warnings","url":"https://api.imd.gov.in/public/api_reference.html","version":"public API schema","collection_date":"2026-09-01","import_date":"2026-09-01","geographic_resolution":"district","update_frequency":"15 minutes","licence":"IMD terms apply","confidence":"high","last_verified":"2026-09-01","adapter":"mock"},
    {"organisation":"Local Government Directory","name":"Village code mapping","url":"https://lgdirectory.gov.in/demo/downloadDirectory.do","version":"Aug 2026 demo","collection_date":"2026-08-01","import_date":"2026-08-31","geographic_resolution":"village","update_frequency":"monthly","licence":"Government open data conditions","confidence":"high","last_verified":"2026-08-31","adapter":"manual_import"},
]
