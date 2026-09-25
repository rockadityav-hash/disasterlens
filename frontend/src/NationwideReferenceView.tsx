import { useMemo, useState, type FormEvent } from 'react'
import { AlertTriangle, Calculator, CheckCircle2, ClipboardCheck, Database, Download, ExternalLink, FileUp, ShieldCheck } from 'lucide-react'
import GoogleRiskMap from './GoogleRiskMap'
import HazardSourceList from './HazardSourceList'
import { buildDemoRiskLocations, buildDemoShelters, nationwideSources, type StateProfile } from './nationwideData'
import { useI18n } from './i18n'

type ViewId = 'overview' | 'map' | 'villages' | 'capacity' | 'priority' | 'survey' | 'data'
type Notify = (title: string, copy: string) => void

function ReferenceBanner({ profile }: { profile: StateProfile }) {
  const { t } = useI18n()
  return <div className="reference-banner"><Database size={18} /><div><strong>{t('Nationwide public-data reference snapshot')}</strong><span>{t('Official public facts are shown as dated reference data. Scenario topics are for demonstrating workflow only and are not current warnings or red-zone findings.')}</span></div><em>{t('Snapshot prepared 02 Sep 2026')}</em></div>
}

function Header({ profile, title, copy }: { profile: StateProfile; title: string; copy: string }) {
  const { t } = useI18n()
  return <><div className="page-header"><div><p className="eyebrow">{profile.name} · {t('nationwide reference mode')}</p><h1>{title}</h1><p className="page-copy">{copy}</p></div><span className="review-chip"><ShieldCheck size={15} />{t('Reference, not operational')}</span></div><ReferenceBanner profile={profile} /></>
}

function Sources({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n()
  return <div className={compact ? 'reference-source-list compact' : 'reference-source-list'}>{nationwideSources.map(source => <article key={source.name}><div><strong>{source.name}</strong><span>{source.publisher}</span><small>{t(source.period)} · {t(source.use)}</small></div><a href={source.url} target="_blank" rel="noreferrer" aria-label={`Open ${source.name}`}>{t('Official page')} <ExternalLink size={13} /></a></article>)}</div>
}

function Overview({ profile }: { profile: StateProfile }) {
  const { t, text, number } = useI18n()
  const demoLocations = useMemo(() => buildDemoRiskLocations(profile), [profile])
  const demoShelters = useMemo(() => buildDemoShelters(profile), [profile])
  return <><Header profile={profile} title={`${profile.name} ${t('reference overview')}`} copy={t('A defensible hackathon snapshot built from official public baselines, with every limitation visible.')} />
    <div className="metric-grid reference-metrics">
      <article className="metric-card"><div className="metric-index">01</div><p>{t('Census population')}</p><strong>{number(profile.population2011)}</strong><small>{t('Population Census 2011 · not a current estimate')}</small></article>
      <article className="metric-card"><div className="metric-index">02</div><p>{t('Population density')}</p><strong>{profile.density2011 ? number(profile.density2011) : '—'}</strong><small>{profile.density2011 ? t('people per sq. km · Census 2011') : t('Not shown after territorial change')}</small></article>
      <article className="metric-card"><div className="metric-index">03</div><p>{t('Reference location')}</p><strong className="metric-place">{profile.capital}</strong><small>{t('Map anchor, not a red-zone declaration')}</small></article>
      <article className="metric-card"><div className="metric-index">04</div><p>{t('Operational alerts')}</p><strong>0</strong><small>{t('Live feeds deliberately disabled for this demo')}</small></article>
    </div>
    <div className="reference-layout"><section className="panel reference-map-panel"><div className="panel-header"><div><span>{t('Hackathon demonstration layer')}</span><h2>{profile.name} {t('demonstration risk zones')}</h2></div><a className="text-button" href={`https://www.openstreetmap.org/?mlat=${profile.lat}&mlon=${profile.lng}#map=9/${profile.lat}/${profile.lng}`} target="_blank" rel="noreferrer">{t('Open coordinates')} <ExternalLink size={13} /></a></div><div className="reference-map"><GoogleRiskMap locations={demoLocations} shelters={demoShelters} onSelect={() => {}} visibleLayers={{ risk: true, habitations: true, shelters: true }} /></div></section>
      <aside className="panel reference-profile"><span className="panel-kicker">{t('Hackathon scenario topics')}</span><h2>{t('Hazards to demonstrate')}</h2><p>{t('These coloured zones are synthetic hackathon scenarios, not current alerts or official red-zone declarations.')}</p><div className="hazard-chips">{profile.scenarioHazards.map(item => <span key={item}>{text(item)}</span>)}</div><dl><div><dt>{t('Demonstration zones')}</dt><dd>{demoLocations.length}</dd></div><div><dt>{t('Highest demo score')}</dt><dd>{Math.max(...demoLocations.map(item => item.score))}/100</dd></div><div><dt>{t('Demo shelters')}</dt><dd>{demoShelters.length}</dd></div></dl>{profile.territorialNote && <div className="official-note"><AlertTriangle size={17} /><p><strong>{t('Territorial note')}</strong>{t(profile.territorialNote)}</p></div>}</aside>
    </div>
    <section className="panel source-panel"><div className="panel-header"><div><span>{t('Auditable provenance')}</span><h2>{t('Sources used in this state profile')}</h2></div></div><Sources compact /></section>
  </>
}

function MapView({ profile }: { profile: StateProfile }) {
  const { t, text } = useI18n()
  const [hazards, setHazards] = useState(true)
  const [riskZones, setRiskZones] = useState(true)
  const [responseLocations, setResponseLocations] = useState(true)
  const [shelterLayer, setShelterLayer] = useState(true)
  const demoLocations = useMemo(() => buildDemoRiskLocations(profile), [profile])
  const demoShelters = useMemo(() => buildDemoShelters(profile), [profile])
  return <><Header profile={profile} title={`${profile.name} ${t('demonstration risk map')}`} copy={t('Explore a complete state-level hackathon scenario with clearly labelled synthetic risk zones and shelters.')} /><div className="map-workspace"><aside className="panel layer-panel"><div className="panel-header small"><h2>{t('Map layers')}</h2></div><label><input type="checkbox" checked={riskZones} onChange={() => setRiskZones(value => !value)} /><span className="layer-swatch risk" />{t('Demonstration risk zones')}</label><label><input type="checkbox" checked={responseLocations} onChange={() => setResponseLocations(value => !value)} /><span className="layer-swatch habitations" />{t('Response locations')}</label><label><input type="checkbox" checked={shelterLayer} onChange={() => setShelterLayer(value => !value)} /><span className="layer-swatch shelters" />{t('Demo shelters')}</label><label><input type="checkbox" checked={hazards} onChange={() => setHazards(value => !value)} /><span className="layer-swatch warnings" />{t('Scenario hazard topics')}</label><div className="scenario-list">{hazards ? profile.scenarioHazards.map(item => <span key={item}>{text(item)}<em>{t('scenario')}</em></span>) : <small>{t('Hazard topics hidden')}</small>}</div><div className="confidence-block"><span>{t('Scenario completeness')}</span><strong>{t('Hackathon demo')}</strong><div><i style={{width:'72%'}} /></div><small>{t('Synthetic zones · OpenStreetMap basemap')}</small></div></aside><section className="panel map-main"><div className="map-toolbar"><span>EPSG:4326 · {t('hackathon demonstration layer')}</span><strong>{demoLocations.length} {t('demo zones')}</strong></div><div className="large-map"><GoogleRiskMap locations={demoLocations} shelters={demoShelters} onSelect={() => {}} visibleLayers={{ risk: riskZones, habitations: responseLocations, shelters: shelterLayer }} /></div><div className="map-integrity-note"><ShieldCheck size={17} /><p><strong>{t('Demonstration data:')}</strong> {t('These coloured areas are synthetic hackathon scenarios—not live alerts. Operational use requires current government hazard feeds and field verification.')}</p></div></section></div></>
}

function RegisterView({ profile, notify }: { profile: StateProfile; notify: Notify }) {
  const { t, number } = useI18n()
  const exportRecord = () => {
    const payload = { ...profile, mode: 'reference_snapshot', operational: false, sources: nationwideSources }
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${profile.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-reference.json`; anchor.click(); URL.revokeObjectURL(url)
    notify(t('Reference exported'), t('The JSON includes its sources and non-operational label.'))
  }
  return <><Header profile={profile} title={t('Administrative reference register')} copy={t('The nationwide demo starts at state level. Habitation records appear only after an authorised district dataset is imported.')} /><section className="panel reference-table-panel"><div className="panel-header"><div><span>{t('1 sourced state record')}</span><h2>{t('Available administrative record')}</h2></div><button className="secondary-button" onClick={exportRecord}><Download size={15} />{t('Export reference')}</button></div><div className="table-wrap"><table><thead><tr><th>{t('State / UT')}</th><th>{t('Map anchor')}</th><th>{t('Population baseline')}</th><th>{t('Density')}</th><th>{t('Risk status')}</th></tr></thead><tbody><tr><td><strong>{profile.name}</strong></td><td>{profile.capital}<small>{profile.lat.toFixed(4)}, {profile.lng.toFixed(4)}</small></td><td>{number(profile.population2011)}<small>{t('Census 2011')}</small></td><td>{profile.density2011 ? `${number(profile.density2011)} / km²` : t('Not comparable')}</td><td><span className="status-pill medium">{t('Not assessed')}</span></td></tr></tbody></table></div></section><section className="panel missing-data-panel"><FileUp size={24} /><div><h2>{t('Habitation-level data is not bundled for this state')}</h2><p>{t('Import an authorised LGD-coded habitation file, hazard layer and verified access/shelter register to calculate local priorities. The app will not manufacture villages from a state total.')}</p></div><button className="primary-button" onClick={() => notify(t('Import workflow ready'), t('Use the data-sources screen to review the required fields and provenance rules.'))}><FileUp size={15} />{t('Prepare import')}</button></section></>
}

function CapacityView({ profile, notify }: { profile: StateProfile; notify: Notify }) {
  const { t, number } = useI18n()
  const [values, setValues] = useState({ housing: 500, water: 450, sanitation: 420, health: 300, school: 350, road: 380, existing: 90, allocated: 40 })
  const infrastructureLimit = Math.min(values.housing, values.water, values.sanitation, values.health, values.school, values.road)
  const available = Math.max(0, infrastructureLimit - values.existing - values.allocated)
  const update = (key: keyof typeof values, value: number) => setValues(previous => ({ ...previous, [key]: Math.max(0, value) }))
  const labels = { housing: t('Housing'), water: t('Water'), sanitation: t('Sanitation'), health: t('Health services'), school: t('School capacity'), road: t('Road access') }
  const bottleneck = Object.entries(values).slice(0,6).find(([,value]) => value === infrastructureLimit)?.[0] as keyof typeof labels | undefined
  return <><Header profile={profile} title={t('Shelter capacity planning')} copy={t('A working calculation tool for authorised local inputs. No site shown here is claimed to be an official shelter.')} /><div className="capacity-reference-grid"><section className="panel calculator-panel"><div className="panel-header"><div><span>{t('Editable planning scenario')}</span><h2>{t('Constraint-based capacity')}</h2></div><Calculator size={22} /></div><div className="capacity-input-grid">{(['housing','water','sanitation','health','school','road'] as const).map(key => <label key={key}><span>{labels[key]} · {t('limit')}</span><input type="number" min="0" value={values[key]} onChange={event => update(key, Number(event.target.value))} /></label>)}</div><div className="capacity-subtract"><label><span>{t('Current occupants')}</span><input type="number" min="0" value={values.existing} onChange={event => update('existing', Number(event.target.value))} /></label><label><span>{t('Already allocated')}</span><input type="number" min="0" value={values.allocated} onChange={event => update('allocated', Number(event.target.value))} /></label></div></section><aside className="panel capacity-result-card"><span>{t('Planning result')}</span><strong>{number(available)}</strong><p>{t('spaces available in this user-entered scenario')}</p><dl><div><dt>{t('Binding constraint')}</dt><dd>{bottleneck ? labels[bottleneck] : '—'}</dd></div><div><dt>{t('Maximum supported')}</dt><dd>{number(infrastructureLimit)}</dd></div><div><dt>{t('Official shelter status')}</dt><dd>{t('Not verified')}</dd></div></dl><button className="primary-button" onClick={() => notify(t('Scenario calculated'), `${number(available)} ${t('planning spaces; official site verification is still required.')}`)}>{t('Save scenario result')}</button></aside></div><div className="official-note capacity-warning"><AlertTriangle size={18} /><p><strong>{t('Do not use this as an occupancy register.')}</strong> {t('Capacity is the smallest infrastructure limit minus existing occupants and prior allocations. Land status, structural safety, access and district approval must be verified separately.')}</p></div></>
}

function PriorityView({ profile, notify }: { profile: StateProfile; notify: Notify }) {
  const { t, text } = useI18n()
  const [reviewHazard, setReviewHazard] = useState(profile.scenarioHazards[0])
  const selectedHazard = profile.scenarioHazards.includes(reviewHazard) ? reviewHazard : profile.scenarioHazards[0]
  const initial = useMemo(() => [
    { id: 'DATA-01', title: 'Import habitation exposure data', reason: 'State population cannot identify local red zones', done: false },
    { id: 'DATA-02', title: 'Verify district shelter register', reason: 'No nationally standardised open occupancy source', done: false },
    { id: 'DATA-03', title: 'Attach current hazard evidence', reason: `Scenario topics: ${profile.scenarioHazards.join(', ')}`, done: false },
  ], [profile])
  const [tasks, setTasks] = useState(initial)
  const toggle = (id: string) => setTasks(items => items.map(item => item.id === id ? { ...item, done: !item.done } : item))
  return <><Header profile={profile} title={t('Data-readiness priority queue')} copy={t('Before operational red-zone ranking, the system identifies the evidence that this state workspace is still missing.')} />
    <section className="panel hazard-review-panel"><div className="panel-header"><div><span>{t('Hazard evidence review')}</span><h2>{t('Official sources by hazard')}</h2></div><span className="count-badge">{profile.scenarioHazards.length} {t('hazards')}</span></div><div className="hazard-review-tabs">{profile.scenarioHazards.map(hazard => <button className={selectedHazard === hazard ? 'active' : ''} key={hazard} onClick={() => setReviewHazard(hazard)}>{text(hazard)}</button>)}</div><div className="hazard-review-body"><div><span className="panel-kicker">{t('Selected scenario')}</span><h3>{text(selectedHazard)}</h3><p>{t('Review the official portals that would supply alerts and evidence for this hazard. The map remains a synthetic hackathon demonstration.')}</p></div><HazardSourceList hazard={selectedHazard} /></div></section>
    <section className="panel reference-table-panel"><div className="panel-header"><div><span>{tasks.filter(item => !item.done).length} {t('actions open')}</span><h2>{t('Required verification work')}</h2></div></div><div className="table-wrap"><table><thead><tr><th>{t('Priority')}</th><th>{t('Work item')}</th><th>{t('Why it matters')}</th><th>{t('Status')}</th><th>{t('Action')}</th></tr></thead><tbody>{tasks.map((task,index) => <tr key={task.id}><td><span className={`status-pill ${index === 0 ? 'critical' : 'medium'}`}>{t(index === 0 ? 'Required' : 'Important')}</span></td><td><strong>{t(task.title)}</strong><small>{task.id} · {profile.name}</small></td><td className="reason-cell">{text(task.reason)}</td><td>{t(task.done ? 'Reviewed' : 'Pending')}</td><td><button className={task.done ? 'reviewed-action inline-action' : 'inline-action'} onClick={() => { toggle(task.id); notify(t(task.done ? 'Returned to queue' : 'Marked reviewed'), t(task.title)) }}>{t(task.done ? 'Reopen' : 'Mark reviewed')}</button></td></tr>)}</tbody></table></div></section><div className="official-note"><ShieldCheck size={18} /><p><strong>{t('No households are ranked in reference mode.')}</strong> {t('The queue demonstrates accountable review without fabricating people-at-risk records.')}</p></div></>
}

function SurveyView({ profile, notify }: { profile: StateProfile; notify: Notify }) {
  const { t } = useI18n()
  const [submitted, setSubmitted] = useState(false)
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); const record = Object.fromEntries(form.entries()); localStorage.setItem(`disasterlens-survey-${profile.name}`, JSON.stringify({ ...record, state: profile.name, savedAt: new Date().toISOString(), status: 'pending_review' })); setSubmitted(true); notify(t('Survey saved locally'), t('It is pending authorised review and did not overwrite official data.')) }
  return <><Header profile={profile} title={t('Field verification form')} copy={t('Capture a ground observation for review. The record stays separate from official sources and cannot create an alert.')} /><div className="survey-reference-layout"><form className="panel reference-survey-form" onSubmit={submit}><div className="panel-header"><div><span>{profile.name}</span><h2>{t('New observation')}</h2></div><ClipboardCheck size={22} /></div><label><span>{t('Observed location')} *</span><input name="location" required placeholder={`${t('Village / ward / landmark in')} ${profile.name}`} /></label><label><span>{t('Observation type')} *</span><select name="observationType" required defaultValue=""><option value="" disabled>{t('Select one')}</option><option>{t('Road access')}</option><option>{t('Flooding')}</option><option>{t('Landslide / slope')}</option><option>{t('Shelter verification')}</option><option>{t('Infrastructure damage')}</option><option>{t('Other')}</option></select></label><div className="two-fields"><label><span>{t('Latitude')}</span><input name="latitude" type="number" step="any" placeholder={String(profile.lat)} /></label><label><span>{t('Longitude')}</span><input name="longitude" type="number" step="any" placeholder={String(profile.lng)} /></label></div><label><span>{t('Observation')} *</span><textarea name="observation" required rows={4} placeholder={t('Describe only what was directly observed.')} /></label><label><span>{t('Officer / team identifier')} *</span><input name="officer" required placeholder={t('Official ID or team code')} /></label><label className="consent-line"><input name="consent" type="checkbox" required /><span>{t('I confirm this is a field observation submitted for authorised review.')}</span></label><button className="primary-button" type="submit">{t('Save for review')}</button></form><aside className="panel survey-evidence"><span className="panel-kicker">{t('Evidence handling')}</span><h2>{t(submitted ? 'Observation saved' : 'What happens next')}</h2>{submitted ? <div className="success-block"><CheckCircle2 size={30} /><p>{t('The record is stored on this device as')} <strong>{t('pending review')}</strong>. {t('It has not changed a risk score or official dataset.')}</p></div> : <ol><li>{t('A field officer records direct observations.')}</li><li>{t('An authorised reviewer checks identity, time and location.')}</li><li>{t('Accepted evidence is versioned; source records are never silently overwritten.')}</li></ol>}<div className="official-note"><AlertTriangle size={17} /><p><strong>{t('Privacy rule')}</strong>{t('Do not enter Aadhaar numbers, medical details, phone numbers or household names in this public demo.')}</p></div></aside></div></>
}

function DataView({ profile }: { profile: StateProfile }) {
  const { t } = useI18n()
  return <><Header profile={profile} title={t('Data sources and limitations')} copy={t('Every nationwide reference field is traceable; unavailable operational data is shown as unavailable.')} /><section className="panel source-panel"><div className="panel-header"><div><span>{nationwideSources.length} {t('public source families')}</span><h2>{t('Nationwide source register')}</h2></div></div><Sources /></section><div className="reference-data-grid"><section className="panel"><span className="panel-kicker">{t('Included')}</span><h2>{t('What this snapshot can support')}</h2><ul className="check-list"><li>{t('All 28 states and 8 union territories')}</li><li>{t('Census 2011 population baseline')}</li><li>{t('State capital geographic reference')}</li><li>{t('Administrative provenance and territorial notes')}</li><li>{t('Working field, capacity and review workflows')}</li></ul></section><section className="panel"><span className="panel-kicker">{t('Not included')}</span><h2>{t('What must not be inferred')}</h2><ul className="cross-list"><li>{t('No live warning or current hazard intensity')}</li><li>{t('No official red-zone declaration')}</li><li>{t('No verified shelter occupancy')}</li><li>{t('No household-level exposure records')}</li><li>{t('No automatic evacuation or relocation decision')}</li></ul></section></div><div className="official-note"><ShieldCheck size={18} /><p><strong>{t('Operational upgrade path')}</strong>{t('Connect NDMA SACHET/agency alerts under agreement, current LGD-coded local registers, authorised shelters and time-stamped field verification. Then calculate risk with an auditable model and human approval.')}</p></div></>
}

export default function NationwideReferenceView({ view, profile, notify }: { view: ViewId; profile: StateProfile; notify: Notify }) {
  if (view === 'map') return <MapView profile={profile} />
  if (view === 'villages') return <RegisterView profile={profile} notify={notify} />
  if (view === 'capacity') return <CapacityView profile={profile} notify={notify} />
  if (view === 'priority') return <PriorityView profile={profile} notify={notify} />
  if (view === 'survey') return <SurveyView profile={profile} notify={notify} />
  if (view === 'data') return <DataView profile={profile} />
  return <Overview profile={profile} />
}
