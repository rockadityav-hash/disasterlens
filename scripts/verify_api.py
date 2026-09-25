"""Exercise copied SurakshaSetu endpoint contracts against a local baseline."""
import json
import sys
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

backend = Path(__file__).resolve().parents[1] / 'backend'
sys.path[:0] = [str(backend), str(backend / 'tests')]
from test_shelter_recommendation import safe_site

BASE = 'http://127.0.0.1:8000'
checks = []


def request(path, payload=None, status=200, headers=None, method=None):
    body = None if payload is None else json.dumps(payload).encode()
    req = Request(BASE + path, data=body, headers={'Content-Type': 'application/json', **(headers or {})}, method=method)
    try:
        response = urlopen(req, timeout=120)
    except HTTPError as error:
        response = error
    with response:
        result = json.loads(response.read()) if response.headers.get('Content-Type', '').startswith('application/json') else None
        assert response.status == status, (path, response.status, result)
        checks.append({'path': path, 'method': req.get_method(), 'status': response.status})
        return result, response.headers


health, _ = request('/health')
assert health['status'] == 'ok'
schema, _ = request('/openapi.json')
assert '/api/v1/shelters/recommend' in schema['paths']
dashboard, _ = request('/api/v1/dashboard')
assert dashboard['district'] == 'Rudraprayag'
villages, _ = request('/api/v1/villages')
assert villages['count'] > 0
request('/api/v1/villages/' + villages['items'][0]['lgd_code'])
request('/api/v1/villages/unknown', status=404)
request('/api/v1/alerts')
request('/api/v1/data-sources')
states, _ = request('/api/v1/states')
assert states['count'] == 36
state, _ = request('/api/v1/states/Uttarakhand')
assert state['risk_score'] is None
request('/api/v1/states/unknown', status=404)
request('/api/v1/connectors/status')
request('/api/v1/import-jobs?state=Uttarakhand')
request('/api/v1/dashboard', status=403, headers={'X-Demo-Role': 'invalid'})

static, _ = request('/api/v1/scoring/static-risk', dict(hazard=80, exposure=70, vulnerability=60, access_weakness=50))
assert static['score'] == 69.0
priority, _ = request('/api/v1/scoring/immediate-priority', dict(active_warning=80, observed_danger=70, household_vulnerability=60, building_weakness=50, isolation=40))
assert priority['score'] == 63.0
red, _ = request('/api/v1/scoring/red-zone', dict(hazard=80, human_exposure=90, evacuation_vulnerability=70, critical_infrastructure=40, economic_assets=30))
assert red['score'] == 71.7
confidence, _ = request('/api/v1/scoring/confidence', dict(source_reliability=90, recency=80, completeness=70, cross_source_agreement=60, field_verification=100))
assert confidence['score'] == 81.0
capacity, _ = request('/api/v1/capacity', dict(housing=500, water=400, sanitation=450, health=300, school=600, road_access=450, current_population=100, allocated_relocatees=50))
assert capacity['available_capacity'] == 150 and capacity['limiting_factor'] == 'health'
for disaster in ('flood', 'landslide', 'earthquake', 'cyclone', 'heatwave', 'wildfire'):
    shelters, _ = request('/api/v1/shelters/recommend', dict(disaster=disaster, people=250, shelters=[safe_site()]))
    assert shelters['ranked_count'] == 1
    assert shelters['items'][0]['decision'] == 'eligible'
blocked, _ = request('/api/v1/shelters/recommend', dict(disaster='flood', people=250, shelters=[safe_site(route_safety='unsafe')]))
assert blocked['ranked_count'] == 0 and blocked['items'][0]['decision'] == 'rejected'
unknown, _ = request('/api/v1/shelters/recommend', dict(disaster='flood', people=250, shelters=[safe_site(satellite_evidence=None)]))
assert unknown['items'][0]['decision'] == 'verification_required'
weights, _ = request('/api/v1/admin/risk-weights')
request('/api/v1/admin/risk-weights', payload=weights['weights'], method='PUT', status=403)
request('/api/v1/admin/risk-weights', payload=weights['weights'], method='PUT', headers={'X-Demo-Role': 'administrator'})
survey = dict(state='Uttarakhand', location='Baseline smoke location', coordinates={'latitude': 30.28, 'longitude': 78.98}, survey_time='2026-09-25T00:00:00Z', officer_identifier='migration-smoke', affected_population=12, consent_acknowledged=True)
accepted, _ = request('/api/v1/field-surveys', payload=survey, status=202)
assert accepted['official_data_overwritten'] is False
request('/api/v1/field-surveys', payload={**survey, 'consent_acknowledged': False}, status=422)
request('/api/v1/field-surveys', payload=survey, status=403, headers={'X-Demo-Role': 'public'})
request('/api/v1/scoring/static-risk', dict(hazard=101, exposure=70, vulnerability=60, access_weakness=50), status=422)
route, _ = request('/api/v1/routes/compute', dict(origin={'latitude': 30.28, 'longitude': 78.98}, destination={'latitude': 30.30, 'longitude': 79.00}), status=503)
assert 'GOOGLE_MAPS_ROUTES_API_KEY' in route['detail']
_, cors_headers = request('/health', headers={'Origin': 'http://localhost:5173'})
assert cors_headers['Access-Control-Allow-Origin'] == 'http://localhost:5173'
request('/api/v1/hazards/snapshot?state=Uttarakhand&latitude=30.28', status=422)
snapshot, _ = request('/api/v1/hazards/snapshot?state=Uttarakhand&latitude=30.28&longitude=78.98')
assert 'features' in snapshot and 'sources' in snapshot
screen, _ = request('/api/v1/hazards/screen-shelters', dict(state='Uttarakhand', latitude=30.28, longitude=78.98, shelters=[dict(id='test', name='Test shelter', latitude=30.28, longitude=78.98)]))
assert len(screen['items']) == 1
print(json.dumps({'passed_requests': len(checks), 'checks': checks, 'scores': {'static': static['score'], 'priority': priority['score'], 'red_zone': red['score'], 'confidence': confidence['score']}, 'capacity': capacity, 'hazard_snapshot': {key: snapshot.get(key) for key in ('status', 'verified_active_alerts', 'sources')}, 'hazard_shelter_status': screen['items'][0]['status'], 'routes': route['detail']}, indent=2))
