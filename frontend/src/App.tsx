import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { AlertTriangle, BarChart3, Bell, Building2, CheckCircle2, ChevronRight, ClipboardList, Database, ExternalLink, FileUp, Globe2, Map, MapPin, Menu, Navigation, RefreshCw, Satellite, Search, ShieldCheck, Users, X } from 'lucide-react'
import { priorityCases, recommendShelters, shelters, sites, villages, type CandidateSite, type PriorityCase, type Village } from './data'
import { I18nProvider, languageOptions, useI18n, type Language } from './i18n'
import GoogleRiskMap from './GoogleRiskMap'
import HazardLayerControls, { type HazardLayerVisibility } from './HazardLayerControls'
import HazardSourceList from './HazardSourceList'
import { isOfficialZone, useHazardSnapshot, useShelterScreening, type HazardSnapshotState } from './hazardLayers'
import StateGate from './StateGate'
import { buildDemoCandidateSites, buildDemoPriorityCases, buildDemoRiskLocations, buildDemoShelters, getStateProfile, type StateProfile } from './nationwideData'
import { disasterOptions, evaluateShelters, recommendationWeights, satelliteShareOfHazard, type DisasterType, type ShelterEvaluation } from './shelterRecommendation'
import { sourcesForHazard } from './hazardSources'
import { apiBase } from './api'

type ViewId = 'overview' | 'map' | 'villages' | 'capacity' | 'priority' | 'survey' | 'data'
type ToastState = { title: string; copy: string } | null

const scoreClass = (score: number) => score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low'
const EMPTY_HAZARD_STATE: HazardSnapshotState = { snapshot: null, loading: false, error: null, refresh: () => undefined }

function DistrictMap({ onVillage }: { onVillage: (name: string) => void }) {
  const { t } = useI18n()
  const zones = [
    ['Tilwara', 'high', 'M90 120 L184 86 245 128 216 205 121 218 72 169Z'],
    ['Agastyamuni', 'moderate', 'M249 106 L337 79 396 121 367 196 280 210 222 166Z'],
    ['Ukhimath', 'very-high', 'M401 70 L510 46 561 108 518 187 420 180 372 126Z'],
    ['Guptkashi', 'low', 'M564 91 L672 74 729 141 684 210 580 198 531 145Z'],
    ['Silli', 'high', 'M210 224 L303 198 365 244 339 330 243 345 181 280Z'],
    ['Phata', 'very-high', 'M404 216 L508 188 568 244 540 334 438 348 376 285Z'],
    ['Chopta', 'moderate', 'M581 222 L690 207 746 273 706 353 604 342 551 282Z'],
  ]
  return <svg className="district-map" viewBox="0 0 760 390" role="img" aria-label={t('Synthetic district risk map')}>
    <defs><pattern id="terrain" width="34" height="34" patternUnits="userSpaceOnUse"><path d="M0 28 Q10 20 19 27 T38 25" fill="none" stroke="#cad5cf" strokeWidth="1" opacity=".55" /></pattern></defs>
    <rect width="760" height="390" fill="#eef2ef" /><rect width="760" height="390" fill="url(#terrain)" />
    <path className="terrain-fill" d="M0 295 C100 250 130 150 235 160 S360 105 450 148 600 205 760 85V390H0Z" />
    <path className="river" d="M84 0 C105 72 170 81 194 146 S175 246 246 390" /><path className="road" d="M0 220 C109 211 182 263 275 231 S423 198 511 246 649 278 760 248" /><path className="road secondary" d="M357 0 C366 93 327 145 348 235 S393 334 385 390" />
    <g>{zones.map(([name, klass, path]) => <path key={name} className={`zone ${klass}`} d={path} onClick={() => onVillage(name)} />)}</g>
    <g className="map-labels"><text x="115" y="153">Tilwara</text><text x="265" y="146">Agastyamuni</text><text x="430" y="119">Ukhimath</text><text x="588" y="145">Guptkashi</text><text x="239" y="274">Silli</text><text x="432" y="271">Phata</text><text x="608" y="278">Chopta</text></g>
    <g className="shelters"><g transform="translate(312 170)"><circle r="10" /><path d="M-4 1h8M0-4v10" /></g><g transform="translate(654 182)"><circle r="10" /><path d="M-4 1h8M0-4v10" /></g></g>
  </svg>
}

function PageHeader({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: ReactNode }) {
  return <div className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-copy">{copy}</p></div>{action}</div>
}

function RiskLegend() {
  const { t } = useI18n()
  return <div className="map-legend"><strong>{t('Risk level')}</strong><span><i className="low" />{t('Low')}</span><span><i className="moderate" />{t('Moderate')}</span><span><i className="high" />{t('High')}</span><span><i className="very-high" />{t('Very high')}</span></div>
}

function LegacyVillageDrawer({ village, close }: { village: Village | null; close: () => void }) {
  const { t, text, number } = useI18n()
  if (!village) return null
  const components = [[t('Hazard probability and intensity'), Math.min(96, village.score + 5), '40%'], [t('People and buildings exposed'), Math.max(34, village.score - 9), '25%'], [t('Social vulnerability'), Math.max(38, village.score - 14), '20%'], [t('Access and infrastructure weakness'), Math.min(93, village.score + 2), '15%']]
  return <><button className="drawer-backdrop" onClick={close} aria-label={t('Close')} /><aside className="detail-drawer" aria-label={`${village.name} ${t('profile')}`}><button className="drawer-close" onClick={close} aria-label={t('Close')}><X size={18} /></button><p className="eyebrow">{t('Habitation profile')} · LGD {village.lgdCode}</p><h2>{village.name}</h2><p className="drawer-subtitle">{t('Rudraprayag district')} · {t('Synthetic demonstration record')}</p><div className="drawer-risk"><div><span className={`status-pill ${scoreClass(village.score)}`}>{text(village.priority)}</span><small>{t('Official review priority')}</small></div><strong>{village.score}<small>/100</small></strong></div><section className="drawer-section"><h3>{t('Score breakdown')}</h3>{components.map(([label, value, weight]) => <div className="score-component" key={String(label)}><div><span>{label}</span><small>{t('Weight')} {weight}</small></div><strong>{value}/100</strong></div>)}</section><section className="drawer-section"><h3>{t('People and access')}</h3><dl className="detail-list"><div><dt>{t('Population')}</dt><dd>{number(village.population)}</dd></div><div><dt>{t('Vulnerable groups')}</dt><dd>{text(village.groups)}</dd></div><div><dt>{t('Nearest safe shelter')}</dt><dd>{text(village.shelter)}</dd></div><div><dt>{t('Data confidence')}</dt><dd>{village.confidence}%</dd></div></dl></section><section className="drawer-section"><h3>{t('Source record')}</h3><div className="source-record"><span>GSI Bhusanket</span><strong>{t('Mock adapter')}</strong></div><div className="source-record"><span>LGD / GP update</span><strong>{t('Demo import')}</strong></div><div className="source-record"><span>IMD warning schema</span><strong>{t('Mock adapter')}</strong></div></section><div className="official-note"><AlertTriangle size={17} /><p><strong>{t('Recommended next step')}</strong>{t('Verify the current slope condition and road access before taking action.')}</p></div></aside></>
}

function Overview({ navigate, inspect, notify, locations, shelterData, stateName, profile }: { navigate: (view: ViewId) => void; inspect: (name: string) => void; notify: (title: string, copy: string) => void; locations: Village[]; shelterData: typeof shelters; stateName: string; profile: StateProfile | null }) {
  const { t, number, text } = useI18n()
  const [selectedName, setSelectedName] = useState(locations[0]?.name ?? '')
  useEffect(() => setSelectedName(locations[0]?.name ?? ''), [locations])
  const selectLocation = useCallback((name: string) => setSelectedName(name), [])
  const highRisk = locations.filter(village => village.score >= 50).sort((a, b) => b.score - a.score)
  const exposed = locations.reduce((sum, village) => sum + village.population, 0)
  const capacity = shelterData.reduce((sum, shelter) => sum + shelter.availableCapacity, 0)
  const metrics = [[t('Population exposed'), number(exposed), `${locations.length} ${t('demo locations')}`], [t('High and very high risk'), String(highRisk.length), t('Synthetic scenario scores')], [t('Cases needing review'), String(highRisk.length), t('Verification pending')], [t('Available demo shelter spaces'), number(capacity), `${shelterData.length} ${t('demo shelters')}`]]
  const alerts = locations.slice(0, 3).map((location, index) => [index === 0 ? 'orange' : index === 1 ? 'yellow' : 'slate', text(location.hazard), t(location.score >= 75 ? 'Orange warning' : location.score >= 50 ? 'Watch' : 'Advisory'), `${t('Demonstration scenario for')} ${text(location.name)}.`, `${sourcesForHazard(location.hazard)[0]?.name ?? 'NDMA SACHET'} · ${t('official reference')}`])
  return <><PageHeader eyebrow={`${stateName} · ${t('District control room')}`} title={t('Risk situation overview')} copy={t('A single operational view of hazards, exposed communities, access and response readiness.')} action={<button className="primary-button" onClick={() => notify(t('Data refreshed'), t('Demo records checked successfully'))}><RefreshCw size={16} />{t('Refresh snapshot')}</button>} />{profile && <section className="official-baseline"><Database size={20} /><div><strong>{t('Official public baseline')}</strong><span>{t('Population and density are dated Census 2011 facts; administrative names use the Government of India LGD reference.')}</span></div><dl><div><dt>{t('Census population')}</dt><dd>{number(profile.population2011)}</dd></div><div><dt>{t('Population density')}</dt><dd>{profile.density2011 === null ? t('Not available') : `${number(profile.density2011)} / km²`}</dd></div><div><dt>{t('Reference location')}</dt><dd>{profile.capital}</dd></div></dl></section>}<div className="demo-banner"><Database size={18} /><div><strong>{t('Demonstration dataset')}</strong><span>{t('This public prototype uses synthetic records, not live operational intelligence.')}</span></div><span className="snapshot-date">03 Sep 2026 · 10:00 IST</span></div>{alerts[0] && <section className="alert-strip"><div className="alert-strip-icon"><Bell size={20} /></div><div><span>{t('Active demonstration warning')}</span><strong>{alerts[0][1]}</strong><small>{alerts[0][4]}</small></div><button onClick={() => navigate('map')}>{t('View affected area')}<ChevronRight size={16} /></button></section>}<div className="metric-grid">{metrics.map(([label, value, note], index) => <article className="metric-card" key={String(label)}><div className="metric-index">0{index + 1}</div><p>{label}</p><strong>{value}</strong><small>{note}</small></article>)}</div>
    <section className="panel high-risk-panel"><div className="panel-header"><div><span>{t('Map-first risk review')}</span><h2>{t('High-risk habitations and safe shelters')}</h2></div><button className="text-button" onClick={() => navigate('map')}>{t('Open full map')}<ChevronRight size={15} /></button></div><div className="risk-workbench"><div className="habitation-list">{highRisk.map(village => { const shelter = recommendShelters(village, shelterData)[0]; return <article key={village.name} className={`habitation-card ${selectedName === village.name ? 'selected' : ''}`} onClick={() => selectLocation(village.name)}><div className="habitation-card-head"><a href={`https://www.openstreetmap.org/?mlat=${village.lat}&mlon=${village.lng}#map=12/${village.lat}/${village.lng}`} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()}>{text(village.name)}<ExternalLink size={13} /></a><span className={`status-pill ${scoreClass(village.score)}`}>{text(village.priority)} · {village.score}</span></div><span className="district-line">{text(village.district)} · {text(village.hazard)}</span><div className="habitation-facts"><div><span>{t('People at risk')}</span><strong>{number(village.population)}</strong></div><div><span>{t('Data confidence')}</span><strong>{village.confidence}%</strong></div></div>{shelter && <div className="shelter-recommendation"><span>{t('Recommended shelter')}</span><strong>{text(shelter.name)}</strong><small>{shelter.distanceKm} km · {shelter.estimatedMinutes} min · {number(shelter.availableCapacity)} {t('spaces available')}</small><div><em className={`route-safety ${shelter.routeSafety.toLowerCase()}`}>{text(shelter.routeSafety)}</em><a href={`https://www.google.com/maps/dir/?api=1&origin=${village.lat},${village.lng}&destination=${shelter.lat},${shelter.lng}&travelmode=driving`} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()}>{t('Get directions')}<Navigation size={13} /></a></div></div>}<button className="profile-link" onClick={event => { event.stopPropagation(); inspect(village.name) }}>{t('Review full profile')}<ChevronRight size={14} /></button></article> })}</div><div className="workbench-map"><GoogleRiskMap locations={locations} shelters={shelterData} selectedName={selectedName} onSelect={selectLocation} /><RiskLegend /></div></div></section>
    <div className="overview-grid secondary"><aside className="panel alerts-panel"><div className="panel-header"><div><span>{t('Demonstration inputs')}</span><h2>{t('Alerts and advisories')}</h2></div><span className="count-badge">{alerts.length} {t('scenarios')}</span></div><div className="alert-list">{alerts.map(alert => <article className="alert-row" key={alert[1]}><i className={alert[0]} /><div><div><strong>{alert[1]}</strong><span>{alert[2]}</span></div><p>{alert[3]}</p><small>{alert[4]}</small></div></article>)}</div><div className="source-health"><CheckCircle2 size={18} /><div><strong>{t('Official source references attached')}</strong><span>{t('Live official alert status is shown on the risk map')}</span></div><button onClick={() => navigate('data')}>{t('Check')}</button></div></aside><section className="panel method-panel"><div className="panel-header"><div><span>{t('Transparent methodology')}</span><h2>{t('How risk is calculated')}</h2></div><button className="text-button" onClick={() => notify(t('Risk weights'), t('Human safety factors receive the highest combined weight'))}>{t('View details')}</button></div><p>{t('Every location receives five scores from 0 to 100. Human exposure and evacuation difficulty receive the greatest combined weight.')}</p><div className="weight-list"><div><span>{t('Human exposure')}</span><strong>30%</strong></div><div><span>{t('Evacuation vulnerability')}</span><strong>25%</strong></div><div><span>{t('Hazard')}</span><strong>25%</strong></div><div><span>{t('Critical infrastructure')}</span><strong>12%</strong></div><div><span>{t('Economic and physical assets')}</span><strong>8%</strong></div></div><div className="formula-note"><ShieldCheck size={17} />{t('Scores support human review and never create automatic evacuation orders.')}</div></section></div></>
}

function MapView({ inspect, notify, locations, shelterData, stateName = null, hazardState = EMPTY_HAZARD_STATE }: { inspect: (name: string) => void; notify: (title: string, copy: string) => void; locations: Village[]; shelterData: typeof shelters; stateName?: string | null; hazardState?: HazardSnapshotState }) {
  const { t } = useI18n()
  const defaultLayers: HazardLayerVisibility = { official: true, supplemental: true, staticMaps: false, synthetic: false, habitations: true, shelters: true }
  const [route, setRoute] = useState(false)
  const [routeStatus, setRouteStatus] = useState(t('Not calculated'))
  const [routeOptions, setRouteOptions] = useState<string[]>([])
  const [routePolylines, setRoutePolylines] = useState<string[]>([])
  const [layers, setLayers] = useState<HazardLayerVisibility>(defaultLayers)
  const [hazardFilter, setHazardFilter] = useState('all')
  const origin = locations[0]
  const destination = shelterData[0]
  const screeningShelters = useMemo(() => shelterData.filter(shelter => shelter.status !== 'Closed').map(shelter => ({ id: shelter.id, name: shelter.name, latitude: shelter.lat, longitude: shelter.lng })), [shelterData])
  const shelterScreening = useShelterScreening(
    hazardState.snapshot?.state ?? null,
    hazardState.snapshot?.query.latitude ?? undefined,
    hazardState.snapshot?.query.longitude ?? undefined,
    screeningShelters,
    hazardState.snapshot?.generated_at,
  )
  const hazardSourcesIncomplete = hazardState.snapshot?.status === 'partial' || hazardState.snapshot?.sources.some(source => source.status === 'error' || source.status === 'stale') === true
  const officialBoundarySourceIncomplete = hazardState.snapshot?.sources.find(source => source.id === 'ndma-sachet')?.status !== 'ok'
  const shelterAssessments = useMemo(() => (shelterScreening.result?.items ?? []).map(item => officialBoundarySourceIncomplete && item.status === 'outside_mapped_active_zones' ? {
    ...item,
    status: 'verification_required' as const,
    notice: t('The official CAP source is incomplete, so this shelter cannot be cleared by the boundary check.'),
  } : item), [shelterScreening.result, officialBoundarySourceIncomplete, t])
  const screeningCounts = useMemo(() => shelterAssessments.reduce((counts, item) => {
    counts[item.status] += 1
    return counts
  }, { inside_active_zone: 0, outside_mapped_active_zones: 0, verification_required: 0 }), [shelterAssessments])
  const screeningMessage = shelterScreening.loading && !shelterScreening.result ? t('Checking shelters against source-supplied active alert boundaries…')
    : shelterScreening.error ? t('Screening service unavailable. Every shelter still needs manual verification.')
      : screeningCounts.inside_active_zone ? t('At least one shelter intersects an active official alert boundary and must be held for authorised review.')
        : screeningCounts.verification_required ? t('Some shelters cannot be cleared because source coverage is incomplete or an active alert has no mapped boundary.')
          : shelterAssessments.length ? t('No screened shelter intersects a mapped active alert boundary. This is not a safety certification.')
            : t('Waiting for the official hazard snapshot.')
  const officialMapped = hazardState.snapshot?.features.filter(isOfficialZone).length ?? 0
  const verifiedAlerts = hazardState.snapshot?.verified_active_alerts ?? 0
  const mapStatus = hazardState.error ? t('Hazard feed unavailable') : hazardState.loading && !hazardState.snapshot ? t('Loading hazard sources…') : officialMapped > 0 ? `${officialMapped} ${t('official mapped zones')}` : verifiedAlerts > 0 ? `${verifiedAlerts} ${t('official alerts active · boundary unavailable')}` : hazardSourcesIncomplete ? t('Unable to confirm · hazard sources incomplete') : t('No verified active alert')
  const calculateRoute = async () => {
    if (!origin || !destination) return
    setRoute(true); setRouteStatus(t('Checking Google Routes'))
    try {
      const response = await fetch(`${apiBase}/api/v1/routes/compute`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ origin: { latitude: origin.lat, longitude: origin.lng }, destination: { latitude: destination.lat, longitude: destination.lng }, travel_mode: 'DRIVE', compute_alternatives: true }) })
      if (!response.ok) throw new Error('unavailable')
      const data = await response.json(); const results = (data.routes ?? []).slice(0, 3)
      setRouteOptions(results.map((item: any, index: number) => `${index === 0 ? t('Recommended / Safest') : index === 1 ? t('Fastest alternative') : t('Alternative')} · ${Math.round(item.distanceMeters / 100) / 10} km · ${item.duration}`))
      setRoutePolylines(results.map((item: any) => item.polyline?.encodedPolyline).filter(Boolean)); setRouteStatus(t('Google Routes · provisional')); notify(t('Route calculated'), t('Alternatives returned by Google Routes'))
    } catch {
      setRouteOptions([`${t('Demonstration route')} · ${Math.max(3, Math.round(Math.hypot(origin.lat - destination.lat, origin.lng - destination.lng) * 85 * 10) / 10)} km · 19 min`]); setRoutePolylines([]); setRouteStatus(t('Demonstration fallback · Google Routes not configured')); notify(t('Route unavailable'), t('Showing the clearly labelled demonstration route'))
    }
  }
  return <><PageHeader eyebrow={t('Geospatial operations')} title={t('District risk map')} copy={t('Official alert geometry, supplemental events and static hazard context are kept distinct.')} action={<span className="review-chip"><ShieldCheck size={15} />{t('Official verification required')}</span>} />
    <div className="map-workspace hazard-map-workspace"><aside className="panel layer-panel hazard-layer-panel"><HazardLayerControls hazardState={hazardState} visibility={layers} onToggle={key => setLayers(previous => ({ ...previous, [key]: !previous[key] }))} hazardFilter={hazardFilter} onHazardFilter={setHazardFilter} /></aside>
      <section className="panel map-main"><div className="map-toolbar"><span>EPSG:4326 · {mapStatus}</span><button className="primary-button" onClick={calculateRoute} disabled={!origin || !destination}><Navigation size={15} />{t('Check route options')}</button></div>
        <div className="large-map"><GoogleRiskMap locations={locations} shelters={shelterData} onSelect={inspect} visibleLayers={layers} routePolylines={routePolylines} hazardSnapshot={hazardState.snapshot} hazardFilter={hazardFilter} shelterAssessments={shelterAssessments} />{layers.synthetic && <RiskLegend />}</div>
        {!hazardState.error && verifiedAlerts > officialMapped && <div className="map-integrity-note boundary-unavailable"><AlertTriangle size={17} /><p><strong>{t('Official alert active · boundary unavailable.')}</strong> {t('The alert remains listed, but no red zone is drawn without source geometry.')}</p></div>}
        {hazardSourcesIncomplete && <div className="map-integrity-note boundary-unavailable"><AlertTriangle size={17} /><p><strong>{t('Source coverage incomplete')}</strong> {t('The map may show available boundaries, but it cannot confirm a complete alert picture. Treat every shelter as requiring verification.')}</p></div>}
        <div className={`shelter-boundary-summary ${shelterScreening.error ? 'unavailable' : screeningCounts.inside_active_zone || screeningCounts.verification_required ? 'attention' : shelterAssessments.length ? 'checked' : 'pending'}`}>
          {shelterScreening.error || screeningCounts.inside_active_zone || screeningCounts.verification_required ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}
          <div><strong>{t('Shelter boundary screening')}</strong><p>{screeningMessage}</p></div>
          {shelterAssessments.length > 0 && <dl><div className="inside"><dt>{t('Inside active boundary')}</dt><dd>{screeningCounts.inside_active_zone}</dd></div><div className="verify"><dt>{t('Verification required')}</dt><dd>{screeningCounts.verification_required}</dd></div><div className="outside"><dt>{t('Outside mapped boundaries')}</dt><dd>{screeningCounts.outside_mapped_active_zones}</dd></div></dl>}
          <small>{t('Outside a mapped alert boundary does not certify a shelter as safe. Field, route and structural checks remain required.')}</small>
        </div>
        {route && <div className="route-result"><div><strong>{origin?.name} → {destination?.name}</strong><span>{routeStatus}</span></div><div className="route-options">{routeOptions.length ? routeOptions.map((option, index) => <span key={option}><b>{t('Route')} {index + 1}</b>{option}</span>) : <span>{t('Checking available routes…')}</span>}</div><em>{t('FIELD CHECK REQUIRED')}</em></div>}
      </section>
    </div>
  </>
}

function VillagesView({ inspect, notify, locations }: { inspect: (name: string) => void; notify: (title: string, copy: string) => void; locations: Village[] }) {
  const { t, text, number } = useI18n(); const [query, setQuery] = useState(''); const [risk, setRisk] = useState('All'); const filtered = useMemo(() => locations.filter(v => (`${v.name} ${v.hazard}`).toLowerCase().includes(query.toLowerCase()) && (risk === 'All' || v.priority === risk)), [locations, query, risk])
  return <><PageHeader eyebrow={t('Community exposure')} title={t('Habitation register')} copy={t('Review population exposure, vulnerability, shelter access and data confidence by habitation.')} action={<button className="secondary-button" onClick={() => notify(t('Export prepared'), t('Restricted household information was excluded'))}>{t('Export aggregate')}</button>} /><div className="filter-toolbar"><div className="search-field"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('Search habitation or hazard')} /></div><select value={risk} onChange={event => setRisk(event.target.value)}><option value="All">{t('All risk levels')}</option><option value="Critical">{t('Critical')}</option><option value="High">{t('High')}</option><option value="Medium">{t('Medium')}</option><option value="Low">{t('Low')}</option></select><span>{filtered.length} {t('demo records')}</span></div><div className="profile-grid">{filtered.map(v => <article className="panel profile-card" key={v.name}><div className="profile-top"><span className={`status-pill ${scoreClass(v.score)}`}>{text(v.priority)}</span><strong>{v.score}<small>/100</small></strong></div><h2>{v.name}</h2><p>{text(v.hazard)}</p><dl><div><dt>{t('Population')}</dt><dd>{number(v.population)}</dd></div><div><dt>{t('Confidence')}</dt><dd>{v.confidence}%</dd></div><div><dt>{t('Survey coverage')}</dt><dd>{Math.max(34, v.score - 10)}%</dd></div></dl><div className="shelter-line"><span>{t('Nearest shelter')}</span><strong>{text(v.shelter)}</strong></div><button onClick={() => inspect(v.name)}>{t('View risk profile')}<ChevronRight size={15} /></button></article>)}</div></>
}

function SiteDetail({ site }: { site: CandidateSite }) {
  const { t, text, number } = useI18n(); const constraints = ['housing', 'water', 'sanitation', 'health', 'school', 'road'] as const; const labels = { housing: t('Housing'), water: t('Water'), sanitation: t('Sanitation'), health: t('Health services'), school: t('School capacity'), road: t('Road access') }
  return <aside className="panel capacity-detail"><span className="panel-kicker">{t('Selected site')}</span><h2>{site.name}</h2><div className="capacity-highlight"><span>{t('Available capacity')}</span><strong>{number(site.available)}</strong><small>{t('People after current population and allocations')}</small></div><div className="constraint-list">{constraints.map(key => <div key={key}><div><span>{labels[key]}</span><strong>{number(site[key])}</strong></div><div className="bar"><i className={site[key] === site.effective ? 'limit' : ''} style={{ width: `${Math.min(100, site[key] / 13)}%` }} /></div></div>)}</div><div className="limiting-note"><span>{t('Limiting factor')}</span><strong>{text(site.bottleneck)}</strong><p>{text(site.landStatus)}</p></div></aside>
}

function ShelterDecisionBadge({ evaluation }: { evaluation: ShelterEvaluation }) {
  const { t } = useI18n()
  const label = evaluation.decision === 'eligible' ? t('Eligible') : evaluation.decision === 'verification_required' ? t('Verification required') : t('Rejected')
  return <span className={`shelter-decision ${evaluation.decision}`}>{label}</span>
}

function ShelterRecommendationWorkbench({ candidateSites }: { candidateSites: CandidateSite[] }) {
  const { t, text, number } = useI18n()
  const [disaster, setDisaster] = useState<DisasterType>('flood')
  const [people, setPeople] = useState(250)
  const evaluations = useMemo(() => evaluateShelters(disaster, people, candidateSites), [candidateSites, disaster, people])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = evaluations.find(item => item.site.id === selectedId) ?? evaluations[0]
  useEffect(() => setSelectedId(evaluations[0]?.site.id ?? null), [candidateSites])
  const factorRows = selected ? [
    [t('Disaster safety'), selected.factors.hazardSafety, `${recommendationWeights.hazardSafety * 100}%`],
    [t('Route access'), selected.factors.routeAccess, `${recommendationWeights.routeAccess * 100}%`],
    [t('Usable capacity'), selected.factors.capacity, `${recommendationWeights.capacity * 100}%`],
    [t('Essential services'), selected.factors.essentialServices, `${recommendationWeights.essentialServices * 100}%`],
    [t('Distance'), selected.factors.proximity, `${recommendationWeights.proximity * 100}%`],
  ] as [string, number, string][] : []
  const selectedLabel = disasterOptions.find(option => option.value === disaster)?.label ?? 'Flood'
  const safety = selected?.site.safetyProfile
  const satellite = safety?.satelliteEvidence
  const satelliteSignal = satellite?.hazardSignals[disaster]
  const satelliteSignalLabel = satelliteSignal === 'clear' ? t('Clear') : satelliteSignal === 'watch' ? t('Watch') : satelliteSignal === 'unsafe' ? t('Unsafe') : t('Unknown')
  const satelliteQualityLabel = satellite?.quality === 'usable' ? t('Usable') : satellite?.quality === 'limited' ? t('Limited') : t('Unusable')
  const satelliteSensorLabel = satellite?.sensor === 'sar' ? t('Radar (SAR)') : satellite?.sensor === 'optical' ? t('Optical') : t('Derived product')
  const satelliteSignalNames: Record<DisasterType, string> = {
    flood: 'Surface-water / inundation', landslide: 'Slope-change', earthquake: 'Surface-change / damage', cyclone: 'Inundation / storm impact', heatwave: 'Land-surface heat', wildfire: 'Thermal hotspot / burn area',
  }
  const evidenceLabels: Record<string, string> = {
    landVerification: 'Land verification', safetyProfile: 'Shelter safety profile', routeSafety: 'Route safety',
    surveyedElevationM: 'Surveyed ground level', planningFloodLevelM: 'Planning flood level', inNotifiedFloodplain: 'Floodplain record', drainage: 'Drainage condition',
    landslideSusceptibility: 'Landslide susceptibility', inLandslideRunout: 'Landslide run-out record', slopeStability: 'Slope stability', structuralAudit: 'Structural audit',
    seismicCompliance: 'Seismic compliance', liquefactionRisk: 'Liquefaction risk', windResistance: 'Wind-resistance audit', inStormSurgeZone: 'Storm-surge record',
    waterReliability: 'Drinking-water reliability', backupPower: 'Backup power', ventilation: 'Ventilation', medicalAccess: 'Medical access', fireClearanceM: 'Fire-break clearance', vegetationRisk: 'Vegetation fire risk',
    satelliteEvidence: 'Satellite evidence', satelliteImageQuality: 'Satellite image quality', satelliteAnalystReview: 'Satellite analyst review', satelliteHazardSignal: 'Satellite hazard signal', satelliteFieldConfirmation: 'Satellite field confirmation',
  }

  return <section className="panel shelter-workbench">
    <div className="shelter-workbench-header">
      <div>
        <span className="panel-kicker">{t('Rule-based safety screening')}</span>
        <h2>{t('Find a shelter for the selected calamity')}</h2>
        <p>{t('Unsafe sites are removed first. Only the remaining sites are ranked.')}</p>
      </div>
      <div className="shelter-controls">
        <label>{t('Calamity')}<select value={disaster} onChange={event => setDisaster(event.target.value as DisasterType)}>{disasterOptions.map(option => <option key={option.value} value={option.value}>{t(option.label)}</option>)}</select></label>
        <label>{t('People to accommodate')}<input type="number" min="1" max="1000000" value={people} onChange={event => setPeople(Math.max(1, Number(event.target.value) || 1))} /></label>
      </div>
    </div>
    <div className="algorithm-safeguard satellite"><Satellite size={18} /><div><strong>{t('Satellite-assisted screening')}</strong><span>{t('Satellite warning signals are combined with field records, engineering checks, route safety, capacity and essential services.')}</span></div><em>{t('SYNTHETIC SIGNALS')}</em></div>
    <div className="shelter-results-layout">
      <div className="shelter-ranking" role="list" aria-label={t('Shelter screening results')}>
        {evaluations.map(evaluation => <button type="button" role="listitem" key={evaluation.site.id} className={selected?.site.id === evaluation.site.id ? 'selected' : ''} onClick={() => setSelectedId(evaluation.site.id)}>
          <span className="rank-number">{evaluation.rank ? `#${evaluation.rank}` : '—'}</span>
          <span className="rank-copy"><strong>{text(evaluation.site.name)}</strong><small>{number(Number(evaluation.site.distance.toFixed(1)))} km · {number(evaluation.site.available)} {t('spaces available')}</small></span>
          <span className="rank-outcome"><ShelterDecisionBadge evaluation={evaluation} />{evaluation.score !== null && <b>{evaluation.score}/100</b>}</span>
        </button>)}
      </div>
      {selected && <article className="shelter-explanation">
        <header><div><span>{selected.rank ? `${t('Rank')} #${selected.rank}` : t('Screening result')}</span><h3>{text(selected.site.name)}</h3></div><div className="recommendation-score"><ShelterDecisionBadge evaluation={selected} /><strong>{selected.score ?? '—'}<small>/100</small></strong></div></header>
        <div className="evidence-status"><Database size={16} /><div><strong>{t('Synthetic demonstration measurements')}</strong><span>{t('Demo record')} · {safety?.recordDate.split(' · ').at(-1)} · {t('Confidence')} {selected.confidence}%</span></div></div>
        {satellite && <section className={`satellite-evidence-card ${satelliteSignal ?? 'unknown'}`}>
          <header><div className="satellite-evidence-title"><Satellite size={18} /><div><strong>{t('Satellite interpretation')}</strong><span>{t('Synthetic satellite-derived indicator')} · {satellite.capturedAt}</span></div></div><div className="satellite-evidence-score"><em>{satelliteSignalLabel}</em><strong>{selected.factors.satelliteInterpretation}/100</strong><small>{Math.round(satelliteShareOfHazard * 100)}% {t('of disaster safety')}</small></div></header>
          <dl><div><dt>{t('Source')}</dt><dd title={satellite.sourceName}>{satellite.sourceName}</dd></div><div><dt>{t('Scene')}</dt><dd>{satellite.sceneId}</dd></div><div><dt>{t('Captured')}</dt><dd>{satellite.capturedAt}</dd></div><div><dt>{t('Sensor')}</dt><dd>{satelliteSensorLabel}</dd></div><div><dt>{t('Selected-disaster signal')}</dt><dd>{t(satelliteSignalNames[disaster])}</dd></div><div><dt>{t('Image quality')}</dt><dd>{satelliteQualityLabel}</dd></div><div><dt>{t('Resolution')}</dt><dd>{satellite.resolutionM === null ? t('Unknown') : `${number(satellite.resolutionM)} m`}</dd></div><div><dt>{t('Analysis radius')}</dt><dd>{number(satellite.analysisRadiusM)} m</dd></div></dl>
          <p><AlertTriangle size={14} />{t('Satellite evidence can flag or reject a site, but it cannot certify the shelter as safe.')}</p>
          <nav><a href={satellite.sourceUrl ?? 'https://browser.dataspace.copernicus.eu/'} target="_blank" rel="noreferrer">{t('Open Copernicus Browser')}<ExternalLink size={12} /></a></nav>
        </section>}
        {disaster === 'flood' && safety && <><div className="flood-level-check"><span>{t('Surveyed ground level')}<strong>{safety.surveyedElevationM} m</strong></span><i aria-hidden="true" /><span>{t('Planning flood level')}<strong>{safety.planningFloodLevelM} m</strong></span><b>{t('Elevation margin')} {safety.surveyedElevationM !== null && safety.planningFloodLevelM !== null ? `${(safety.surveyedElevationM - safety.planningFloodLevelM).toFixed(1)} m` : t('Unknown')}</b></div><p className="flood-safety-note"><AlertTriangle size={15} />{t('Higher ground is not automatically safe. An unstable slope, unsafe route, failed structure or insufficient capacity can still reject it.')}</p></>}
        <div className="factor-score-list">{factorRows.map(([label, value, weight]) => <div key={label}><span>{label}<small>{t('Weight')} {weight}</small></span><div><i style={{ width: `${value}%` }} /></div><strong>{value}</strong></div>)}</div>
        <div className="decision-reasons">
          <section><h4>{t('Why this result')}</h4><ul>{selected.reasons.map(reason => <li key={reason}><CheckCircle2 size={14} />{t(reason)}</li>)}</ul></section>
          {selected.blockers.length > 0 && <section className="blockers"><h4>{t('Safety blockers')}</h4><ul>{selected.blockers.map(reason => <li key={reason}><AlertTriangle size={14} />{t(reason)}</li>)}</ul></section>}
          {selected.missingFields.length > 0 && <section className="missing-evidence"><h4>{t('Evidence still required')}</h4><p>{selected.missingFields.map(field => t(evidenceLabels[field] ?? field)).join(' · ')}</p></section>}
        </div>
        <footer><strong>{t('Data to verify before use')}</strong><span>{t(selectedLabel)} · {t('shelter checks')}</span><div><a href="https://nidm.gov.in/PDF/pubs/NDMA/24.pdf" target="_blank" rel="noreferrer">NDMA {t('shelter guidance')}<ExternalLink size={12} /></a><a href="https://cwc.gov.in/" target="_blank" rel="noreferrer">CWC {t('flood records')}<ExternalLink size={12} /></a><a href="https://bhusanket.gsi.gov.in/" target="_blank" rel="noreferrer">GSI {t('slope records')}<ExternalLink size={12} /></a><a href="https://idrn.nidm.gov.in/" target="_blank" rel="noreferrer">IDRN {t('resource records')}<ExternalLink size={12} /></a></div></footer>
      </article>}
    </div>
    <div className="human-decision-note"><AlertTriangle size={16} /><span><strong>{t('Officer approval required.')}</strong> {t('Replace every demo value with a dated official record or field check before moving people.')}</span></div>
  </section>
}

function CapacityView({ notify, candidateSites }: { notify: (title: string, copy: string) => void; candidateSites: CandidateSite[] }) {
  const { t, text, number } = useI18n(); const [selected, setSelected] = useState(0)
  useEffect(() => setSelected(0), [candidateSites])
  return <><PageHeader eyebrow={t('Preparedness planning')} title={t('Calamity-aware shelter identification')} copy={t('Screen shelters using disaster-specific safety checks, then compare capacity and access.')} action={<button className="primary-button" onClick={() => notify(t('Shelters screened'), t('Hard safety checks and weighted ranking were recalculated'))}><RefreshCw size={15} />{t('Recalculate')}</button>} />
    <ShelterRecommendationWorkbench candidateSites={candidateSites} />
    <div className="capacity-section-heading"><div><span className="panel-kicker">{t('Capacity audit')}</span><h2>{t('Service and capacity details')}</h2></div><div className="method-banner"><strong>MIN</strong><p><b>{t('Effective capacity')}</b>{t('The smallest available capacity across housing, water, sanitation, health, school and roads.')}</p></div></div>
    <div className="capacity-layout"><section className="panel table-panel"><div className="table-scroll"><table className="data-table"><thead><tr><th>{t('Candidate site')}</th><th>{t('Land verification')}</th><th>{t('Hazard')}</th><th>{t('Effective')}</th><th>{t('Available')}</th><th>{t('Distance')}</th><th>{t('Constraint')}</th></tr></thead><tbody>{candidateSites.map((site, index) => <tr key={site.id} className={selected === index ? 'selected' : ''} onClick={() => setSelected(index)}><td><strong>{site.name}</strong><small>{site.id}</small></td><td><span className={`land-status ${site.landStatus.includes('Verified') ? 'verified' : site.landStatus.includes('pending') ? 'pending' : 'unverified'}`}>{text(site.landStatus)}</span></td><td>{text(site.hazard)}</td><td><strong>{number(site.effective)}</strong></td><td><strong>{number(site.available)}</strong></td><td>{number(Number(site.distance.toFixed(1)))} km</td><td>{text(site.bottleneck)}</td></tr>)}</tbody></table></div></section>{candidateSites[selected] && <SiteDetail site={candidateSites[selected]} />}</div></>
}

function LegacyPriorityView({ notify }: { notify: (title: string, copy: string) => void }) {
  const { t, text } = useI18n(); const [query, setQuery] = useState(''); const [priority, setPriority] = useState('All'); const rows = priorityCases.filter(item => (`${item.name} ${item.village} ${item.vulnerable}`).toLowerCase().includes(query.toLowerCase()) && (priority === 'All' || item.priority === priority))
  return <><PageHeader eyebrow={t('Official review workflow')} title={t('Relocation priority queue')} copy={t('Review cases using warnings, field observations, vulnerability, building condition and isolation.')} action={<button className="secondary-button" onClick={() => notify(t('Review brief prepared'), t('Score explanation and source record included'))}>{t('Export review brief')}</button>} /><div className="review-notice"><AlertTriangle size={18} /><div><strong>{t('Human authorisation is mandatory')}</strong><span>{t('A score can prioritise review, but cannot trigger evacuation or relocation.')}</span></div></div><div className="summary-row"><div><span>{t('Critical cases')}</span><strong>4</strong></div><div><span>{t('Pending field verification')}</span><strong>3</strong></div><div><span>{t('Official warning weight')}</span><strong>25%</strong></div></div><div className="filter-toolbar"><div className="search-field"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('Search case, village or group')} /></div><select value={priority} onChange={event => setPriority(event.target.value)}><option value="All">{t('All priorities')}</option><option value="Critical">{t('Critical')}</option><option value="High">{t('High')}</option><option value="Medium">{t('Medium')}</option></select><span>{rows.length} {t('cases')}</span></div><section className="panel table-panel"><div className="table-scroll"><table className="data-table priority-table"><thead><tr><th>{t('Case')}</th><th>{t('Hazard')}</th><th>{t('Vulnerable group')}</th><th>{t('Warning')}</th><th>{t('Score')}</th><th>{t('Priority')}</th><th>{t('Verification')}</th><th>{t('Action')}</th></tr></thead><tbody>{rows.map(item => <tr key={item.id}><td><strong>{item.name}</strong><small>{item.id} · {item.village}</small></td><td>{text(item.hazard)}</td><td>{text(item.vulnerable)}</td><td><span className="warning-label">{text(item.warning)}</span></td><td><span className={`queue-score ${scoreClass(item.score)}`}>{item.score}</span></td><td><span className={`status-pill ${scoreClass(item.score)}`}>{text(item.priority)}</span></td><td><span className={`verification ${item.verified === 'Pending' ? 'pending' : 'verified'}`}>{text(item.verified)}</span></td><td><button className="table-action" onClick={() => notify(t('Case opened'), t('Ready for official review'))}>{t('Review')}</button></td></tr>)}</tbody></table></div></section></>
}

function LegacySurveyView({ notify }: { notify: (title: string, copy: string) => void }) {
  const { t, text } = useI18n(); const [drafts, setDrafts] = useState(localStorage.getItem('disasterlens-draft') ? 1 : 0); const [score, setScore] = useState(8)
  const preview = (form: HTMLFormElement) => { const data = new FormData(form); const value = 8 + Number(data.get('children')) * 2 + Number(data.get('elderly')) * 3 + Number(data.get('pwd')) * 4 + Number(data.get('bedridden')) * 5 + (data.get('danger') === 'None visible' ? 0 : 18) + (data.get('road') === 'Blocked' ? 14 : data.get('road') === 'Restricted' ? 7 : 0) + (data.get('condition') === 'Unsafe' ? 14 : data.get('condition') === 'Damaged' ? 7 : 0); setScore(Math.min(100, value)) }
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); localStorage.removeItem('disasterlens-draft'); setDrafts(0); notify(t('Survey submitted'), t('Pending official verification')); event.currentTarget.reset(); setScore(8) }
  return <><PageHeader eyebrow={t('Field operations')} title={t('Household hazard survey')} copy={t('Capture only the minimum operational information needed for verified review.')} action={<span className="review-chip safe"><CheckCircle2 size={15} />{t('Offline draft available')}</span>} /><div className="survey-layout"><form className="panel survey-form" onInput={event => preview(event.currentTarget)} onSubmit={submit}><fieldset><legend>{t('Location and household')}</legend><div className="form-grid"><label>{t('Village')}<select name="village" required><option value="">{t('Select village')}</option>{villages.map(v => <option key={v.name}>{v.name}</option>)}</select></label><label>{t('Habitation or ward')}<input name="habitation" required placeholder={t('Enter habitation or ward')} /></label><label>{t('GPS coordinates')}<div className="input-action"><input name="gps" required placeholder="30.527, 79.068" /><button type="button" onClick={event => { const input = event.currentTarget.previousElementSibling as HTMLInputElement; input.value = '30.5270, 79.0682'; notify(t('Location captured'), t('GPS accuracy ±8 metres')) }}>{t('Use GPS')}</button></div></label><label>{t('Household size')}<input name="household_size" type="number" min="1" required defaultValue="4" /></label></div></fieldset><fieldset><legend>{t('Vulnerability details')}</legend><div className="count-grid">{[['Children', 'children'], ['Elderly', 'elderly'], ['Pregnant women', 'pregnant'], ['Persons with disabilities', 'pwd'], ['Bedridden', 'bedridden'], ['Medical assistance', 'medical']].map(([label, name]) => <label key={name}>{t(label)}<input name={name} type="number" min="0" defaultValue="0" /></label>)}</div></fieldset><fieldset><legend>{t('Observed danger and access')}</legend><div className="form-grid"><label>{t('House condition')}<select name="condition"><option value="Stable">{t('Stable')}</option><option value="Damaged">{t('Damaged')}</option><option value="Unsafe">{t('Unsafe')}</option></select></label><label>{t('Floodwater depth in cm')}<input name="flood_depth" type="number" min="0" defaultValue="0" /></label><label>{t('Observed danger')}<select name="danger"><option value="None visible">{t('None visible')}</option><option value="Visible cracks">{t('Visible cracks')}</option><option value="Slope movement">{t('Slope movement')}</option><option value="Falling rocks">{t('Falling rocks')}</option><option value="Active flooding">{t('Active flooding')}</option></select></label><label>{t('Road access')}<select name="road"><option value="Open">{t('Open')}</option><option value="Restricted">{t('Restricted')}</option><option value="Blocked">{t('Blocked')}</option></select></label><label className="full-field">{t('Field notes')}<textarea name="notes" placeholder={t('Record only operationally relevant observations')} /></label></div></fieldset><label className="consent"><input type="checkbox" required /><span>{t('Consent and privacy acknowledgement recorded. No Aadhaar number is collected.')}</span></label><div className="form-actions"><button type="button" className="secondary-button" onClick={event => { const form = event.currentTarget.form!; localStorage.setItem('disasterlens-draft', JSON.stringify(Object.fromEntries(new FormData(form)))); setDrafts(1); notify(t('Draft saved'), t('Synchronise when connectivity returns')) }}>{t('Save offline draft')}</button><button className="primary-button">{t('Submit for verification')}</button></div></form><aside className="panel survey-aside"><span className="panel-kicker">{t('Survey safeguards')}</span><h2>{t('Before submitting')}</h2><ul><li>{t('Collect minimum necessary personal information only.')}</li><li>{t('Do not record Aadhaar numbers.')}</li><li>{t('Photographs require documented consent.')}</li><li>{t('Submitted cases remain pending until authorised verification.')}</li></ul><div className="aside-stat"><span>{t('Saved device drafts')}</span><strong>{drafts}</strong></div><div className="priority-preview"><span>{t('Estimated review priority')}</span><strong>{text(score >= 75 ? 'Critical' : score >= 50 ? 'High' : score >= 25 ? 'Medium' : 'Low')} · {score}/100</strong><small>{t('Preview only — official verification required')}</small></div></aside></div></>
}

function LegacyDataView({ notify }: { notify: (title: string, copy: string) => void }) {
  const { t } = useI18n(); const validate = (file?: File) => file && notify(t('Validation preview ready'), `${file.name} · ${t('No data imported yet')}`); const jobs = [['success', 'GP population update — Aug 2026.csv', '1,284', t('Completed')], ['review', 'PMGSY road status — 31 Aug.geojson', '438', t('Needs review')], ['success', 'Government shelters Q2.csv', '12', t('Completed')]]
  return <><PageHeader eyebrow={t('Data governance')} title={t('Data sources and imports')} copy={t('Validate, preview and trace every dataset before it is used in an assessment.')} action={<button className="secondary-button" onClick={() => notify(t('Templates ready'), t('Population, shelter and infrastructure schemas'))}>{t('Download templates')}</button>} /><div className="data-grid"><section className="panel upload-card"><label className="upload-zone"><FileUp size={28} /><h2>{t('Upload dataset')}</h2><p>{t('CSV, GeoJSON, Shapefile ZIP or GeoTIFF')}</p><span className="primary-button">{t('Choose file')}</span><input type="file" accept=".csv,.geojson,.json,.zip,.tif,.tiff" hidden onChange={event => validate(event.target.files?.[0])} /><small>{t('Maximum 200 MB · source metadata required')}</small></label><div className="upload-checks"><span><CheckCircle2 />{t('Schema validation')}</span><span><CheckCircle2 />{t('Duplicate detection')}</span><span><CheckCircle2 />{t('Geometry checks')}</span><span><CheckCircle2 />{t('Rollback support')}</span></div></section><section className="panel import-panel"><div className="panel-header"><div><span>{t('Import history')}</span><h2>{t('Recent validation jobs')}</h2></div></div>{jobs.map(job => <div className="job-row" key={job[1]}><span className={`job-state ${job[0]}`}>{job[0] === 'success' ? <CheckCircle2 /> : <AlertTriangle />}</span><div><strong>{job[1]}</strong><small>{job[2]} {t('records checked')}</small></div><em>{job[3]}</em></div>)}</section></div><section className="panel source-panel"><div className="panel-header"><div><span>{t('Provenance register')}</span><h2>{t('Configured demonstration sources')}</h2></div><span className="count-badge">4 {t('sources')}</span></div><div className="source-grid">{[['GSI Bhusanket', t('Hazard layer'), t('Mock adapter')], ['IMD Public API', t('Warning schema'), t('Mock adapter')], ['PMGSY GeoSadak', t('Road network'), t('Review required')], ['LGD', t('Administrative codes'), t('Demo import')]].map(source => <article key={source[0]}><div className="source-logo">{source[0].slice(0, 2).toUpperCase()}</div><div><strong>{source[0]}</strong><span>{source[1]}</span></div><em>{source[2]}</em></article>)}</div></section></>
}

function SurveyView({ notify, locations, stateName }: { notify: (title: string, copy: string) => void; locations: Village[]; stateName: string }) {
  const { t, text } = useI18n()
  const [drafts, setDrafts] = useState(localStorage.getItem('disasterlens-draft') ? 1 : 0)
  const [score, setScore] = useState(8)
  const preview = (form: HTMLFormElement) => {
    const data = new FormData(form)
    const value = 8 + Number(data.get('children')) * 2 + Number(data.get('elderly')) * 3 + Number(data.get('pwd')) * 4 + Number(data.get('bedridden')) * 5 + (data.get('danger') === 'None visible' ? 0 : 18) + (data.get('road') === 'Blocked' ? 14 : data.get('road') === 'Restricted' ? 7 : 0) + (data.get('condition') === 'Unsafe' ? 14 : data.get('condition') === 'Damaged' ? 7 : 0)
    setScore(Math.min(100, value))
  }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const [latitude, longitude] = String(data.get('gps')).split(',').map(Number)
    const photos = data.getAll('photos').filter(value => value instanceof File && value.name).map(value => (value as File).name)
    const payload = { state: stateName, location: String(data.get('village')), coordinates: { latitude, longitude }, survey_time: String(data.get('survey_time')), officer_identifier: String(data.get('officer_id')), risk_observations: String(data.get('danger')), shelter_condition: String(data.get('shelter_condition')).toLowerCase(), road_accessibility: String(data.get('road')).toLowerCase(), affected_population: Number(data.get('affected_population')), notes: String(data.get('notes')), photo_references: photos, verification_status: String(data.get('verification')).toLowerCase().replace(' ', '_'), consent_acknowledged: data.get('consent') === 'on' }
    try { const response = await fetch(`${apiBase}/api/v1/field-surveys`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Demo-Role': 'field_surveyor' }, body: JSON.stringify(payload) }); if (!response.ok) throw new Error('offline'); notify(t('Survey submitted'), t('Pending official verification')) }
    catch { localStorage.setItem('disasterlens-draft', JSON.stringify(payload)); setDrafts(1); notify(t('Saved offline'), t('The survey will remain a draft until the API is available.')) }
    form.reset(); setScore(8)
  }
  return <><PageHeader eyebrow={t('Field operations')} title={t('Household hazard survey')} copy={t('Capture field observations with officer, time and verification provenance.')} action={<span className="review-chip safe"><CheckCircle2 size={15} />{t('Offline draft available')}</span>} />
    <div className="survey-layout"><form className="panel survey-form" onInput={event => preview(event.currentTarget)} onSubmit={submit}>
      <fieldset><legend>{t('Survey provenance')}</legend><div className="form-grid"><label>{t('Survey date and time')}<input name="survey_time" type="datetime-local" required /></label><label>{t('Officer ID')}<input name="officer_id" required placeholder="DDMA-RPG-042" /></label><label>{t('Verification status')}<select name="verification"><option value="Pending">{t('Pending')}</option><option value="Field checked">{t('Field checked')}</option></select></label><label>{t('Photographs')}<input name="photos" type="file" accept="image/*" multiple /></label></div></fieldset>
      <fieldset><legend>{t('Location and household')}</legend><div className="form-grid"><label>{t('Village')}<select name="village" required><option value="">{t('Select village')}</option>{locations.map(v => <option key={v.name}>{v.name}</option>)}</select></label><label>{t('Habitation or ward')}<input name="habitation" required placeholder={t('Enter habitation or ward')} /></label><label>{t('GPS coordinates')}<div className="input-action"><input name="gps" required placeholder={locations[0] ? `${locations[0].lat}, ${locations[0].lng}` : 'Latitude, longitude'} /><button type="button" onClick={event => { const input = event.currentTarget.previousElementSibling as HTMLInputElement; input.value = locations[0] ? `${locations[0].lat}, ${locations[0].lng}` : ''; notify(t('Location captured'), t('GPS accuracy ±8 metres')) }}>{t('Use GPS')}</button></div></label><label>{t('Affected population')}<input name="affected_population" type="number" min="0" required defaultValue="4" /></label></div></fieldset>
      <fieldset><legend>{t('Vulnerability details')}</legend><div className="count-grid">{[['Children','children'],['Elderly','elderly'],['Pregnant women','pregnant'],['Persons with disabilities','pwd'],['Bedridden','bedridden'],['Medical assistance','medical']].map(([label,name]) => <label key={name}>{t(label)}<input name={name} type="number" min="0" defaultValue="0" /></label>)}</div></fieldset>
      <fieldset><legend>{t('Observed danger and access')}</legend><div className="form-grid"><label>{t('House condition')}<select name="condition"><option value="Stable">{t('Stable')}</option><option value="Damaged">{t('Damaged')}</option><option value="Unsafe">{t('Unsafe')}</option></select></label><label>{t('Shelter condition')}<select name="shelter_condition"><option>{t('Usable')}</option><option>{t('Limited')}</option><option>{t('Unsafe')}</option></select></label><label>{t('Observed danger')}<select name="danger"><option value="None visible">{t('None visible')}</option><option value="Visible cracks">{t('Visible cracks')}</option><option value="Slope movement">{t('Slope movement')}</option><option value="Falling rocks">{t('Falling rocks')}</option><option value="Active flooding">{t('Active flooding')}</option></select></label><label>{t('Road access')}<select name="road"><option value="Open">{t('Open')}</option><option value="Restricted">{t('Restricted')}</option><option value="Blocked">{t('Blocked')}</option></select></label><label className="full-field">{t('Field notes')}<textarea name="notes" placeholder={t('Record only operationally relevant observations')} /></label></div></fieldset>
      <label className="consent"><input name="consent" type="checkbox" required /><span>{t('Consent and privacy acknowledgement recorded. No Aadhaar number is collected.')}</span></label>
      <label className="consent"><input name="photo_consent" type="checkbox" /><span>{t('Consent recorded for any attached photographs.')}</span></label>
      <div className="form-actions"><button type="button" className="secondary-button" onClick={event => { const form = event.currentTarget.form!; localStorage.setItem('disasterlens-draft', JSON.stringify(Object.fromEntries(new FormData(form)))); setDrafts(1); notify(t('Draft saved'), t('Synchronise when connectivity returns')) }}>{t('Save offline draft')}</button><button className="primary-button">{t('Submit for verification')}</button></div>
    </form><aside className="panel survey-aside"><span className="panel-kicker">{t('Survey safeguards')}</span><h2>{t('Before submitting')}</h2><ul><li>{t('Collect minimum necessary personal information only.')}</li><li>{t('Do not record Aadhaar numbers.')}</li><li>{t('Photographs require documented consent.')}</li><li>{t('Submitted cases remain pending until authorised verification.')}</li></ul><div className="aside-stat"><span>{t('Saved device drafts')}</span><strong>{drafts}</strong></div><div className="priority-preview"><span>{t('Estimated review priority')}</span><strong>{text(score >= 75 ? 'Critical' : score >= 50 ? 'High' : score >= 25 ? 'Medium' : 'Low')} · {score}/100</strong><small>{t('Preview only — official verification required')}</small></div></aside></div>
  </>
}

function VillageDrawer({ village, close }: { village: Village | null; close: () => void }) {
  const { t, text, number } = useI18n()
  if (!village) return null
  const components: [string, number, string][] = [
    [t('Human exposure'), village.riskComponents.humanExposure, '30%'],
    [t('Evacuation vulnerability'), village.riskComponents.evacuationVulnerability, '25%'],
    [t('Hazard probability and intensity'), village.riskComponents.hazard, '25%'],
    [t('Critical infrastructure'), village.riskComponents.criticalInfrastructure, '12%'],
    [t('Economic and physical assets'), village.riskComponents.economicAssets, '8%'],
  ]
  const confidence: [string, number, string][] = [
    [t('Source reliability'), village.confidenceBreakdown.source, '30%'],
    [t('Recency'), village.confidenceBreakdown.recency, '20%'],
    [t('Completeness'), village.confidenceBreakdown.completeness, '20%'],
    [t('Cross-source agreement'), village.confidenceBreakdown.agreement, '15%'],
    [t('Field verification'), village.confidenceBreakdown.fieldVerification, '15%'],
  ]
  return <><button className="drawer-backdrop" onClick={close} aria-label={t('Close')} /><aside className="detail-drawer" aria-label={`${village.name} ${t('profile')}`}>
    <button className="drawer-close" onClick={close} aria-label={t('Close')}><X size={18} /></button>
    <p className="eyebrow">{t('Habitation profile')} · LGD {village.lgdCode}</p><h2>{village.name}</h2>
    <p className="drawer-subtitle">{village.district}, {village.state} · {t('Synthetic demonstration record')}</p>
    <div className="drawer-risk"><div><span className={`status-pill ${scoreClass(village.score)}`}>{text(village.priority)}</span><small>{t('Official review priority')}</small></div><strong>{village.score}<small>/100</small></strong></div>
    <section className="drawer-section"><h3>{t('Human-safety-first risk breakdown')}</h3>{components.map(([label, value, weight]) => <div className="score-component" key={label}><div><span>{label}</span><small>{t('Weight')} {weight}</small></div><strong>{value}/100</strong></div>)}</section>
    <section className="drawer-section"><h3>{t('Confidence evidence')} · {village.confidence}%</h3>{confidence.map(([label, value, weight]) => <div className="score-component" key={label}><div><span>{label}</span><small>{t('Weight')} {weight}</small></div><strong>{value}/100</strong></div>)}<dl className="detail-list"><div><dt>{t('Last updated')}</dt><dd>{village.lastUpdated}</dd></div><div><dt>{t('Last field verified')}</dt><dd>{village.lastFieldVerified ?? t('Not yet field verified')}</dd></div></dl></section>
    <section className="drawer-section"><h3>{t('People and access')}</h3><dl className="detail-list"><div><dt>{t('Population')}</dt><dd>{number(village.population)}</dd></div><div><dt>{t('Vulnerable groups')}</dt><dd>{text(village.groups)}</dd></div><div><dt>{t('Recommended shelter')}</dt><dd>{text(village.shelter)}</dd></div><div><dt>LGD</dt><dd>{village.lgdCode}</dd></div></dl></section>
    <section className="drawer-section"><h3>{t('Source record')}</h3><div className="source-record"><span>GSI Bhusanket</span><strong>{t('Reference connector')}</strong></div><div className="source-record"><span>LGD / GP update</span><strong>{t('Demo import')}</strong></div><div className="source-record"><span>IMD warning schema</span><strong>{t('Reference connector')}</strong></div></section>
    <div className="official-note"><AlertTriangle size={17} /><p><strong>{t('Recommended next step')}</strong>{t('Verify the current hazard, route and shelter status before taking action.')}</p></div>
  </aside></>
}

function CaseReviewDrawer({ item, assigned, close, assign, markReviewed, locations }: { item: PriorityCase | null; assigned: boolean; close: () => void; assign: (id: string) => void; markReviewed: (id: string) => void; locations: Village[] }) {
  const { t, text, number } = useI18n()
  if (!item) return null
  const habitation = locations.find(village => village.name === item.village)
  const components = habitation ? [
    [t('Human exposure'), habitation.riskComponents.humanExposure, '30%'],
    [t('Evacuation vulnerability'), habitation.riskComponents.evacuationVulnerability, '25%'],
    [t('Hazard probability and intensity'), habitation.riskComponents.hazard, '25%'],
    [t('Critical infrastructure'), habitation.riskComponents.criticalInfrastructure, '12%'],
    [t('Economic and physical assets'), habitation.riskComponents.economicAssets, '8%'],
  ] as [string, number, string][] : []

  return <><button className="drawer-backdrop" onClick={close} aria-label={t('Close')} /><aside className="detail-drawer case-review-drawer" role="dialog" aria-modal="true" aria-labelledby="case-review-title">
    <button className="drawer-close" onClick={close} aria-label={t('Close')}><X size={18} /></button>
    <p className="eyebrow">{t('Hazard evidence review')} · {item.id}</p><h2 id="case-review-title">{text(item.name)}</h2>
    <p className="drawer-subtitle">{text(item.village)}, {text(item.district)} · {t('Synthetic demonstration record')}</p>
    <div className="drawer-risk"><div><span className={`status-pill ${scoreClass(item.score)}`}>{text(item.priority)}</span><small>{t('Human review required')}</small></div><strong>{item.score}<small>/100</small></strong></div>
    <section className="drawer-section"><h3>{t('Hazard and impact')}</h3><dl className="detail-list case-facts"><div><dt>{t('Hazard')}</dt><dd>{text(item.hazard)}</dd></div><div><dt>{t('Warning')}</dt><dd>{text(item.warning)}</dd></div><div><dt>{t('People at risk')}</dt><dd>{number(item.peopleAtRisk)}</dd></div><div><dt>{t('Vulnerable group')}</dt><dd>{text(item.vulnerable)}</dd></div><div><dt>{t('Verification')}</dt><dd>{text(item.verified)}</dd></div><div><dt>{t('Data confidence')}</dt><dd>{item.confidence}%</dd></div></dl><div className="case-reason"><span>{t('Why this case is prioritised')}</span><strong>{text(item.reason)}</strong><small>{t('Last updated')} · {item.lastUpdated}</small></div></section>
    {components.length > 0 && <section className="drawer-section"><h3>{t('Score evidence')}</h3>{components.map(([label,value,weight]) => <div className="score-component" key={label}><div><span>{label}</span><small>{t('Weight')} {weight}</small></div><strong>{value}/100</strong></div>)}</section>}
    <section className="drawer-section"><h3>{t('Official source references')}</h3><p className="section-copy">{t('These portals identify where operational evidence should be obtained. This demo does not claim a live connection.')}</p><HazardSourceList hazard={item.hazard} /></section>
    <div className="official-note"><AlertTriangle size={17} /><p><strong>{t('Decision safeguard')}</strong>{t('Verify the latest official bulletin, location, route and shelter status before taking action.')}</p></div>
    <footer className="case-review-actions"><button className="secondary-button" disabled={assigned} onClick={() => assign(item.id)}>{assigned ? t('Assigned') : t('Assign Survey')}</button><button className="primary-button" onClick={() => { markReviewed(item.id); close() }}>{t('Mark Reviewed')}</button></footer>
  </aside></>
}

function PriorityView({ notify, initialCases, locations }: { notify: (title: string, copy: string) => void; initialCases: PriorityCase[]; locations: Village[] }) {
  const { t, text, number } = useI18n()
  const [items, setItems] = useState(initialCases)
  const [query, setQuery] = useState('')
  const [priority, setPriority] = useState('All')
  const [assigned, setAssigned] = useState<Set<string>>(() => new Set())
  const [selectedCase, setSelectedCase] = useState<PriorityCase | null>(null)
  useEffect(() => { setItems(initialCases); setAssigned(new Set()); setSelectedCase(null) }, [initialCases])
  const rows = items.filter(item => (`${item.name} ${item.village} ${item.reason}`).toLowerCase().includes(query.toLowerCase()) && (priority === 'All' || item.priority === priority)).sort((a, b) => b.score - a.score)
  const assign = (id: string) => { setAssigned(previous => new Set(previous).add(id)); notify(t('Field survey assigned'), id) }
  const reviewed = (id: string) => { setItems(previous => previous.filter(item => item.id !== id)); notify(t('Case marked reviewed'), t('Queue ranks were recalculated')) }
  return <><PageHeader eyebrow={t('Official review workflow')} title={t('Relocation priority queue')} copy={t('Highest human-safety risk appears first. Reviewing an item removes it from the active queue and recalculates ranks.')} action={<button className="secondary-button" onClick={() => notify(t('Review brief prepared'), t('Score explanation and source record included'))}>{t('Export review brief')}</button>} />
    <div className="review-notice"><AlertTriangle size={18} /><div><strong>{t('Human authorisation is mandatory')}</strong><span>{t('A score can prioritise review, but cannot trigger evacuation or relocation.')}</span></div></div>
    <div className="summary-row"><div><span>{t('Active cases')}</span><strong>{items.length}</strong></div><div><span>{t('Pending field verification')}</span><strong>{items.filter(item => item.verified === 'Pending').length}</strong></div><div><span>{t('Assigned surveys')}</span><strong>{assigned.size}</strong></div></div>
    <div className="filter-toolbar"><div className="search-field"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('Search case, village or reason')} /></div><select value={priority} onChange={event => setPriority(event.target.value)}><option value="All">{t('All priorities')}</option><option value="Critical">{t('Critical')}</option><option value="High">{t('High')}</option><option value="Medium">{t('Medium')}</option></select><span>{rows.length} {t('cases')}</span></div>
    <section className="panel table-panel"><div className="table-scroll"><table className="data-table priority-table"><thead><tr><th>{t('Rank')}</th><th>{t('Case')}</th><th>{t('Reason')}</th><th>{t('People at risk')}</th><th>{t('Confidence')}</th><th>{t('Last updated')}</th><th>{t('Score')}</th><th>{t('Actions')}</th></tr></thead><tbody>{rows.map((item, index) => <tr key={item.id}><td><strong>#{index + 1}</strong></td><td><strong>{text(item.name)}</strong><small>{item.id} · {text(item.village)}</small></td><td className="reason-cell">{text(item.reason)}</td><td>{number(item.peopleAtRisk)}</td><td>{item.confidence}%</td><td>{item.lastUpdated}</td><td><span className={`queue-score ${scoreClass(item.score)}`}>{item.score}</span></td><td><div className="queue-actions"><button onClick={() => setSelectedCase(item)}>{t('Review')}</button><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.village}, ${item.district}, ${item.state}`)}`} target="_blank" rel="noreferrer">{t('Open Map')}</a><button disabled={assigned.has(item.id)} onClick={() => assign(item.id)}>{assigned.has(item.id) ? t('Assigned') : t('Assign Survey')}</button><button className="reviewed-action" onClick={() => reviewed(item.id)}>{t('Mark Reviewed')}</button></div></td></tr>)}</tbody></table></div></section>
    <CaseReviewDrawer item={selectedCase} assigned={selectedCase ? assigned.has(selectedCase.id) : false} close={() => setSelectedCase(null)} assign={assign} markReviewed={reviewed} locations={locations} />
  </>
}

type ImportJob = { id: string; source: string; dataset: string; status: string; started_at: string; finished_at: string; imported: number; updated: number; failed: number; error: string | null }

function DataView({ notify, stateName = 'Uttarakhand', hazardState = EMPTY_HAZARD_STATE }: { notify: (title: string, copy: string) => void; stateName?: string; hazardState?: HazardSnapshotState }) {
  const { t, number, dateTime } = useI18n()
  const fallbackJobs: ImportJob[] = [
    { id: 'job-demo-003', source: 'Demonstration shelter register', dataset: 'shelters', status: 'completed', started_at: '03 Sep 2026, 10:00', finished_at: '03 Sep 2026, 10:00', imported: 2, updated: 0, failed: 0, error: null },
    { id: 'job-demo-002', source: 'Demonstration road layer', dataset: 'roads', status: 'needs_review', started_at: '03 Sep 2026, 10:00', finished_at: '03 Sep 2026, 10:00', imported: 5, updated: 0, failed: 2, error: t('Two demonstration geometries require manual review.') },
  ]
  const [jobs, setJobs] = useState<ImportJob[]>(fallbackJobs)
  useEffect(() => {
    let active = true
    const poll = () => fetch(`${apiBase}/api/v1/import-jobs?state=${encodeURIComponent(stateName)}`).then(response => response.ok ? response.json() : Promise.reject()).then(data => { if (active && Array.isArray(data.items) && data.items.length) setJobs(data.items) }).catch(() => undefined)
    poll(); const timer = window.setInterval(poll, 15000)
    return () => { active = false; window.clearInterval(timer) }
  }, [stateName])
  const validate = (file?: File) => file && notify(t('Validation preview ready'), `${file.name} · ${t('No data imported yet')}`)
  const feedStatus = (id: string, fallback: string) => {
    const source = hazardState.snapshot?.sources.find(item => item.id === id)
    if (!source) return hazardState.loading ? t('Checking source…') : fallback
    const label = t(source.status === 'ok' ? 'Checked' : source.status === 'stale' ? 'Stale' : source.status === 'not_configured' ? 'Not configured' : 'Unavailable')
    return source.last_checked_at ? `${label} · ${dateTime(source.last_checked_at)}` : label
  }
  const ndmaStatus = hazardState.snapshot?.sources.find(source => source.id === 'ndma-sachet')?.status
  const usgsStatus = hazardState.snapshot?.sources.find(source => source.id === 'usgs-earthquakes')?.status
  const hasStaticMap = (hazardState.snapshot?.static_layers ?? []).some(layer => layer.status === 'available')
  const connectors = [
    { name: 'NDMA SACHET', detail: t('Public CAP alert feed'), status: feedStatus('ndma-sachet', t('Public feed adapter · open the risk map to check')), kind: ndmaStatus === 'ok' ? 'connected' : 'reference' },
    { name: 'USGS', detail: t('Observed earthquake epicentres · supplemental points only'), status: feedStatus('usgs-earthquakes', t('Supplemental feed adapter · open the risk map to check')), kind: usgsStatus === 'ok' ? 'connected' : 'reference' },
    { name: 'IMD', detail: t('Warnings and nowcasts'), status: t('Whitelisted API · not configured'), kind: 'reference' },
    { name: 'CWC', detail: t('Flood forecasts'), status: t('Public alerts are consumed through SACHET; no undocumented API is claimed'), kind: 'reference' },
    { name: 'ISRO Bhuvan', detail: t('Historical hazard WMS'), status: hasStaticMap ? t('Historical WMS available on the risk map') : t('No verified state WMS configured'), kind: hasStaticMap ? 'connected' : 'reference' },
    { name: 'Copernicus Data Space', detail: t('Sentinel-1/2 scene catalogue'), status: t('Public catalogue · not connected'), kind: 'reference' },
    { name: 'INCOIS', detail: t('Ocean hazard advisories'), status: t('Reference connector · credentials required'), kind: 'reference' },
    { name: 'SurakshaSetu', detail: t('Synthetic shelter and satellite demonstration'), status: t('Demonstration data'), kind: 'demo' },
  ]
  return <><PageHeader eyebrow={t('Data governance')} title={t('Data sources and imports')} copy={t('Validate, preview and trace every dataset before it is used in an assessment.')} action={<button className="secondary-button" onClick={() => notify(t('Templates ready'), t('Population, shelter and infrastructure schemas'))}>{t('Download templates')}</button>} />
    <div className="data-grid"><section className="panel upload-card"><label className="upload-zone"><FileUp size={28} /><h2>{t('Upload dataset')}</h2><p>{t('CSV, GeoJSON, Shapefile ZIP or GeoTIFF')}</p><span className="primary-button">{t('Choose file')}</span><input type="file" accept=".csv,.geojson,.json,.zip,.tif,.tiff" hidden onChange={event => validate(event.target.files?.[0])} /><small>{t('Maximum 200 MB · source metadata required')}</small></label><div className="upload-checks"><span><CheckCircle2 />{t('Schema validation')}</span><span><CheckCircle2 />{t('Duplicate detection')}</span><span><CheckCircle2 />{t('Geometry checks')}</span><span><CheckCircle2 />{t('Rollback support')}</span></div></section>
      <section className="panel import-panel"><div className="panel-header"><div><span>{t('Polling every 15 seconds')}</span><h2>{t('Recent import jobs')}</h2></div></div>{jobs.map(job => <div className="job-row expanded" key={job.id}><span className={`job-state ${job.status === 'completed' ? 'success' : 'review'}`}>{job.status === 'completed' ? <CheckCircle2 /> : <AlertTriangle />}</span><div><strong>{job.source} · {job.dataset}</strong><small>{number(job.imported)} {t('imported')} · {number(job.updated)} {t('updated')} · {number(job.failed)} {t('failed')}</small>{job.error && <small className="job-error">{job.error}</small>}<small>{job.started_at} → {job.finished_at}</small></div><em>{t(job.status === 'completed' ? 'Completed' : 'Needs review')}</em></div>)}</section></div>
    <section className="panel source-panel"><div className="panel-header"><div><span>{t('Provenance register')}</span><h2>{t('Official data connector readiness')}</h2></div><span className="count-badge">{connectors.length} {t('sources')}</span></div><div className="source-grid connector-grid">{connectors.map(source => <article key={source.name}><div className="source-logo">{source.name.slice(0,2).toUpperCase()}</div><div><strong>{source.name}</strong><span>{source.detail}</span></div><em className={source.kind}>{source.status}</em></article>)}</div></section>
  </>
}

function LegacyApplication() {
  const { t, language, setLanguage } = useI18n(); const [view, setView] = useState<ViewId>('overview'); const [menu, setMenu] = useState(false); const [selectedVillage, setSelectedVillage] = useState<Village | null>(null); const [toast, setToast] = useState<ToastState>(null); const [apiOnline, setApiOnline] = useState(false); const [role, setRole] = useState('District Officer')
  useEffect(() => { const controller = new AbortController(); fetch(`${apiBase}/health`, { signal: controller.signal }).then(response => { if (!response.ok) throw new Error('offline'); return response.json() }).then(() => setApiOnline(true)).catch(() => setApiOnline(false)); return () => controller.abort() }, [])
  const notify = (title: string, copy: string) => { setToast({ title, copy }); window.setTimeout(() => setToast(null), 2800) }; const inspect = (name: string) => setSelectedVillage(villages.find(village => village.name === name) ?? null)
  const nav: [ViewId, string, ReactNode][] = [['overview', t('Overview'), <BarChart3 />], ['map', t('Risk map'), <Map />], ['villages', t('Habitations'), <Users />], ['priority', t('Priority queue'), <AlertTriangle />], ['capacity', t('Site capacity'), <Building2 />], ['survey', t('Field survey'), <ClipboardList />], ['data', t('Data sources'), <Database />]]
  const changeView = (next: ViewId) => { setView(next); setMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const content: Record<ViewId, ReactNode> = { overview: <Overview navigate={changeView} inspect={inspect} notify={notify} locations={villages} shelterData={shelters} stateName="Uttarakhand" profile={getStateProfile('Uttarakhand')} />, map: <MapView inspect={inspect} notify={notify} locations={villages} shelterData={shelters} />, villages: <VillagesView inspect={inspect} notify={notify} locations={villages} />, capacity: <CapacityView notify={notify} candidateSites={sites} />, priority: <PriorityView notify={notify} initialCases={priorityCases} locations={villages} />, survey: <SurveyView notify={notify} locations={villages} stateName="Uttarakhand" />, data: <DataView notify={notify} /> }
  return <div className="app-shell"><aside className={`sidebar ${menu ? 'open' : ''}`}><button type="button" className="brand" onClick={() => changeView('overview')}><span className="brand-emblem"><img src="/surakshasetu-mark.svg" alt="" width="31" height="31" /></span><span><strong>SurakshaSetu</strong><small>{t('District risk decision support')}</small></span></button><div className="authority"><span>{t('District administration')}</span><strong>{t('Rudraprayag, Uttarakhand')}</strong><small>{t('Demonstration workspace')}</small></div><nav><p>{t('Operations')}</p>{nav.slice(0, 4).map(([id, label, icon]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => changeView(id)}><span>{icon}</span>{label}{id === 'priority' && <em>4</em>}</button>)}<p>{t('Preparedness')}</p>{nav.slice(4, 6).map(([id, label, icon]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => changeView(id)}><span>{icon}</span>{label}</button>)}<p>{t('Administration')}</p>{nav.slice(6).map(([id, label, icon]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => changeView(id)}><span>{icon}</span>{label}</button>)}</nav><div className="sidebar-footer"><div className={`system-state ${apiOnline ? 'online' : ''}`}><i /><div><strong>{apiOnline ? t('API connected') : t('Standalone demo')}</strong><span>{apiOnline ? t('Calculation service available') : t('Synthetic records active')}</span></div></div><label className="role-field"><span>AK</span><div><strong>Ajay Kumar</strong><select value={role} onChange={event => { setRole(event.target.value); notify(t('Role changed'), t(event.target.value)) }}><option value="District Officer">{t('District Officer')}</option><option value="Field Surveyor">{t('Field Surveyor')}</option><option value="Data Manager">{t('Data Manager')}</option><option value="Public Aggregate">{t('Public Aggregate')}</option></select></div></label></div></aside><div className="workspace"><div className="government-bar"><span>{t('Government of Uttarakhand')}</span><strong>{t('District Disaster Management Authority')}</strong><span>{t('Prototype · Not for operational use')}</span></div><header className="topbar"><button className="menu-button" onClick={() => setMenu(!menu)} aria-label={t('Open menu')}><Menu size={21} /></button><div className="district-selector"><span>{t('Active district')}</span><select onChange={event => notify(t('District changed'), `${t('Showing demonstration records for')} ${event.target.value}`)}><option>Rudraprayag, Uttarakhand</option><option>Dhemaji, Assam</option><option>Wayanad, Kerala</option></select></div><div className="topbar-actions"><div className="confidence-summary"><i /><div><strong>{t('Data confidence')} 87%</strong><span>6/7 {t('demo feeds current')}</span></div></div><label className="language-select"><Globe2 size={17} /><span>{t('Language')}</span><select value={language} onChange={event => setLanguage(event.target.value as Language)} aria-label={t('Change language')}>{languageOptions.map(option => <option key={option.code} value={option.code}>{option.nativeName}</option>)}</select></label></div></header><main>{content[view]}</main></div><VillageDrawer village={selectedVillage} close={() => setSelectedVillage(null)} />{menu && <button className="mobile-backdrop" onClick={() => setMenu(false)} aria-label={t('Close')} />}{toast && <div className="toast"><CheckCircle2 size={19} /><div><strong>{toast.title}</strong><span>{toast.copy}</span></div></div>}</div>
}

function StateEmptyView({ state, changeState }: { state: string; changeState: () => void }) {
  const { t } = useI18n()
  return <section className="panel state-empty-view">
    <div className="state-empty-icon"><MapPin size={28} /></div>
    <p className="eyebrow">{t('Selected monitoring area')}</p>
    <h1>{state}</h1>
    <p>{t('No verified operational dataset is configured for this state in the current prototype.')}</p>
    <div className="official-note"><AlertTriangle size={18} /><p><strong>{t('No locations have been invented.')}</strong>{t('Connect authorised state data adapters or choose Uttarakhand to review the clearly labelled demonstration dataset.')}</p></div>
    <button className="primary-button" onClick={changeState}><Globe2 size={16} />{t('Change State')}</button>
  </section>
}

function MethodologyModal({ open, role, close, notify }: { open: boolean; role: string; close: () => void; notify: (title: string, copy: string) => void }) {
  const { t } = useI18n()
  const [weights, setWeights] = useState({ hazard: 25, human_exposure: 30, evacuation_vulnerability: 25, critical_infrastructure: 12, economic_assets: 8 })
  if (!open) return null
  const entries: [keyof typeof weights, string][] = [['human_exposure', t('Human exposure')], ['evacuation_vulnerability', t('Evacuation vulnerability')], ['hazard', t('Hazard')], ['critical_infrastructure', t('Critical infrastructure')], ['economic_assets', t('Economic and physical assets')]]
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0)
  const save = async () => {
    if (total !== 100) { notify(t('Weights not saved'), t('Weights must add up to 100%.')); return }
    try {
      const response = await fetch(`${apiBase}/api/v1/admin/risk-weights`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Demo-Role': 'administrator' }, body: JSON.stringify(Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, value / 100]))) })
      if (!response.ok) throw new Error('unavailable')
      notify(t('Risk weights saved'), t('The administrator configuration was updated and must be audited.'))
    } catch { notify(t('Backend unavailable'), t('Weights were not changed. Deploy the API to enable administrator updates.')) }
  }
  return <><button className="drawer-backdrop" onClick={close} aria-label={t('Close')} /><section className="method-modal" role="dialog" aria-modal="true" aria-labelledby="method-title"><button className="drawer-close" onClick={close} aria-label={t('Close')}><X size={18} /></button><p className="eyebrow">{t('Transparent methodology')}</p><h2 id="method-title">{t('How Risk Is Calculated')}</h2><p>{t('Every location receives five scores from 0 to 100. Human safety receives the greatest combined weight. These are demonstration policy weights, not an official government standard.')}</p><div className="method-form">{entries.map(([key,label]) => <label key={key}><span>{label}</span><input type="number" min="0" max="100" value={weights[key]} disabled={role !== 'Administrator'} onChange={event => setWeights(previous => ({ ...previous, [key]: Number(event.target.value) }))} /><em>%</em></label>)}</div><div className={`weight-total ${total === 100 ? 'valid' : 'invalid'}`}><span>{t('Total weight')}</span><strong>{total}%</strong></div><div className="official-note"><ShieldCheck size={17} /><p><strong>{t('Human review is always required.')}</strong>{t('The score ranks locations for attention; it never issues an evacuation or relocation order.')}</p></div><footer><span>{role === 'Administrator' ? t('Administrator editing enabled') : t('Choose the Administrator role to edit weights.')}</span><button className="primary-button" disabled={role !== 'Administrator'} onClick={save}>{t('Save weights')}</button></footer></section></>
}

function Application() {
  const { t, language, setLanguage } = useI18n()
  const [view, setView] = useState<ViewId>('overview')
  const [menu, setMenu] = useState(false)
  const [selectedVillage, setSelectedVillage] = useState<Village | null>(null)
  const [toast, setToast] = useState<ToastState>(null)
  const [apiOnline, setApiOnline] = useState(false)
  const [role, setRole] = useState('District Officer')
  const [selectedState, setSelectedState] = useState<string | null>(() => localStorage.getItem('disasterlens-state'))
  const [stateGateOpen, setStateGateOpen] = useState(() => !localStorage.getItem('disasterlens-state'))
  const [methodOpen, setMethodOpen] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${apiBase}/health`, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('offline'); return response.json() })
      .then(() => setApiOnline(true))
      .catch(() => setApiOnline(false))
    return () => controller.abort()
  }, [])

  const notify = (title: string, copy: string) => {
    if (title === t('Risk weights')) { setMethodOpen(true); return }
    setToast({ title, copy })
    window.setTimeout(() => setToast(null), 2800)
  }
  const changeView = (next: ViewId) => { setView(next); setMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const chooseState = (state: string) => {
    localStorage.setItem('disasterlens-state', state)
    setSelectedState(state)
    setSelectedVillage(null)
    setView('overview')
    setStateGateOpen(false)
  }
  const isPilot = selectedState === 'Uttarakhand'
  const stateProfile = useMemo(() => getStateProfile(selectedState), [selectedState])
  const activeLocations = useMemo(() => isPilot ? villages : stateProfile ? buildDemoRiskLocations(stateProfile) : [], [isPilot, stateProfile])
  const activeShelters = useMemo(() => isPilot ? shelters : stateProfile ? buildDemoShelters(stateProfile) : [], [isPilot, stateProfile])
  const activeSites = useMemo(() => isPilot ? sites : stateProfile ? buildDemoCandidateSites(stateProfile) : [], [isPilot, stateProfile])
  const activeCases = useMemo(() => isPilot ? priorityCases : stateProfile ? buildDemoPriorityCases(stateProfile, activeLocations) : [], [isPilot, stateProfile, activeLocations])
  const hazardAnchor = stateProfile ?? activeLocations[0]
  const hazardState = useHazardSnapshot(selectedState, hazardAnchor?.lat, hazardAnchor?.lng)
  const inspect = (name: string) => setSelectedVillage(activeLocations.find(village => village.name === name) ?? null)
  const districtLabel = isPilot ? 'Rudraprayag, Uttarakhand' : stateProfile ? `${stateProfile.capital} ${t('demonstration')} · ${stateProfile.name}` : selectedState ?? t('No state selected')
  const nav: [ViewId, string, ReactNode][] = [
    ['overview', t('Overview'), <BarChart3 />], ['map', t('Risk map'), <Map />],
    ['villages', t('Habitations'), <Users />], ['priority', t('Priority queue'), <AlertTriangle />],
    ['capacity', t('Shelter Capacity'), <Building2 />], ['survey', t('Field survey'), <ClipboardList />],
    ['data', t('Data sources'), <Database />],
  ]
  const configuredContent: Record<ViewId, ReactNode> = {
    overview: <Overview navigate={changeView} inspect={inspect} notify={notify} locations={activeLocations} shelterData={activeShelters} stateName={selectedState ?? ''} profile={stateProfile} />,
    map: <MapView inspect={inspect} notify={notify} locations={activeLocations} shelterData={activeShelters} stateName={selectedState} hazardState={hazardState} />,
    villages: <VillagesView inspect={inspect} notify={notify} locations={activeLocations} />,
    capacity: <CapacityView notify={notify} candidateSites={activeSites} />,
    priority: <PriorityView notify={notify} initialCases={activeCases} locations={activeLocations} />,
    survey: <SurveyView notify={notify} locations={activeLocations} stateName={selectedState ?? ''} />,
    data: <DataView notify={notify} stateName={selectedState ?? ''} hazardState={hazardState} />,
  }
  const content = stateProfile ? configuredContent[view] : <StateEmptyView state={selectedState ?? ''} changeState={() => setStateGateOpen(true)} />

  return <div className="app-shell">
    <aside className={`sidebar ${menu ? 'open' : ''}`}>
      <button type="button" className="brand" onClick={() => changeView('overview')}><span className="brand-emblem"><img src="/surakshasetu-mark.svg" alt="" width="31" height="31" /></span><span><strong>SurakshaSetu</strong><small>{t('District risk decision support')}</small></span></button>
      <div className="authority"><span>{t('Monitoring jurisdiction')}</span><strong>{districtLabel}</strong><small>{t('Demonstration workspace')}</small></div>
      <nav>
        <p>{t('Operations')}</p>{nav.slice(0, 4).map(([id, label, icon]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => changeView(id)}><span>{icon}</span>{label}{id === 'priority' && selectedState && <em>{activeCases.length}</em>}</button>)}
        <p>{t('Preparedness')}</p>{nav.slice(4, 6).map(([id, label, icon]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => changeView(id)}><span>{icon}</span>{label}</button>)}
        <p>{t('Administration')}</p>{nav.slice(6).map(([id, label, icon]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => changeView(id)}><span>{icon}</span>{label}</button>)}
      </nav>
      <div className="sidebar-footer">
        <div className={`system-state ${apiOnline ? 'online' : ''}`}><i /><div><strong>{apiOnline ? t('API connected') : t('Standalone demo')}</strong><span>{apiOnline ? t('Calculation service available') : t('Synthetic records active')}</span></div></div>
        <label className="role-field"><span>AK</span><div><strong>Ajay Kumar</strong><select value={role} onChange={event => { setRole(event.target.value); notify(t('Role changed'), t(event.target.value)) }}><option value="District Officer">{t('District Officer')}</option><option value="Field Surveyor">{t('Field Surveyor')}</option><option value="Data Manager">{t('Data Manager')}</option><option value="Administrator">{t('Administrator')}</option><option value="Public Aggregate">{t('Public Aggregate')}</option></select></div></label>
      </div>
    </aside>
    <div className="workspace">
      <div className="government-bar"><span>{t('Government monitoring workspace')} · {selectedState ?? t('Select state')}</span><strong>{t('Disaster response demonstration workspace')}</strong><span>{t('Prototype · Not for operational use')}</span></div>
      <header className="topbar">
        <button className="menu-button" onClick={() => setMenu(!menu)} aria-label={t('Open menu')}><Menu size={21} /></button>
        <div className="jurisdiction-control"><span>{t('Active jurisdiction')}</span><strong>{districtLabel}</strong><button onClick={() => setStateGateOpen(true)}>{t('Change State')}</button></div>
        <div className="topbar-actions">
          <div className={`confidence-summary ${hazardState.error ? 'feed-offline' : hazardState.snapshot ? 'feed-checked' : ''}`}><i /><div><strong>{hazardState.snapshot?.status === 'partial' ? t('Hazard sources partially available') : hazardState.snapshot ? t('Official hazard sources checked') : t('Official baseline + demo scenarios')}</strong><span>{hazardState.error ? t('Official hazard feed unavailable · demo data remains labelled') : hazardState.snapshot?.status === 'partial' ? t('Unable to confirm a complete alert picture · verification required') : hazardState.snapshot ? t('SACHET and supplemental sources · check timestamps on the map') : t('Connecting to official hazard sources…')}</span></div></div>
          <label className="language-select"><Globe2 size={17} /><span>{t('Language')}</span><select value={language} onChange={event => setLanguage(event.target.value as Language)} aria-label={t('Change language')}>{languageOptions.map(option => <option key={option.code} value={option.code}>{option.nativeName}</option>)}</select></label>
        </div>
      </header>
      <main>{content}</main>
    </div>
    <VillageDrawer village={selectedVillage} close={() => setSelectedVillage(null)} />
    <MethodologyModal open={methodOpen} role={role} close={() => setMethodOpen(false)} notify={(title, copy) => { setToast({ title, copy }); window.setTimeout(() => setToast(null), 2800) }} />
    <StateGate current={selectedState} open={stateGateOpen} onClose={() => selectedState && setStateGateOpen(false)} onSelect={chooseState} />
    {menu && <button className="mobile-backdrop" onClick={() => setMenu(false)} aria-label={t('Close')} />}
    {toast && <div className="toast"><CheckCircle2 size={19} /><div><strong>{toast.title}</strong><span>{toast.copy}</span></div></div>}
  </div>
}

export default function App() { return <I18nProvider><Application /></I18nProvider> }
