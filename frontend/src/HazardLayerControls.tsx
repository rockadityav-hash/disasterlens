import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, ExternalLink, FileCode2, RefreshCw, WifiOff, X } from 'lucide-react'
import { availableStaticLayers, isOfficialAlert, isOfficialZone, isSupplementalEvent, latestSourceCheck, type HazardFeature, type HazardSnapshotState } from './hazardLayers'
import { useI18n } from './i18n'

export type HazardLayerVisibility = {
  official: boolean
  supplemental: boolean
  staticMaps: boolean
  synthetic: boolean
  habitations: boolean
  shelters: boolean
}

const safeUrl = (value: string) => {
  try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined }
  catch { return undefined }
}

function AlertDetailDrawer({ feature, close }: { feature: HazardFeature; close: () => void }) {
  const { t, text, dateTime } = useI18n()
  const properties = feature.properties
  const href = safeUrl(properties.source_url)
  const rawLabel = properties.provenance.original_format.toLowerCase().includes('cap') ? t('View original CAP-XML') : t('View original source data')
  const geometryLabel = isOfficialZone(feature) ? t('Official mapped boundary') : properties.verification_status === 'official_source' ? t('Boundary unavailable') : t('Point event · not a boundary')
  const controlledLabel = (value: string | null | undefined) => value ? t({ flood: 'Flood', earthquake: 'Earthquake', landslide: 'Landslide', cyclone: 'Cyclone', heatwave: 'Heat wave', wildfire: 'Forest fire', thunderstorm: 'Thunderstorm / lightning', heavy_rain: 'Heavy rainfall', other: 'Other' }[value.toLowerCase()] ?? text(value)) : '—'

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [close])

  return <>
    <button className="drawer-backdrop" onClick={close} aria-label={t('Close')} />
    <aside className="detail-drawer alert-detail-drawer" role="dialog" aria-modal="true" aria-labelledby="official-alert-title">
      <button className="drawer-close" onClick={close} aria-label={t('Close')}><X size={18} /></button>
      <p className="eyebrow">{t('Official alert details')}</p>
      <h2 id="official-alert-title">{properties.title}</h2>
      <p className="drawer-subtitle">{properties.source_name} · {t('Machine-readable record')}</p>

      <div className={`alert-detail-status ${isOfficialZone(feature) ? 'mapped' : 'unmapped'}`}>
        <CheckCircle2 size={17} />
        <div><strong>{t('Official source')}</strong><span>{geometryLabel}</span></div>
      </div>

      <section className="drawer-section">
        <h3>{t('Description supplied by source')}</h3>
        <p className="alert-description">{properties.description || t('No description supplied by source.')}</p>
      </section>

      <section className="drawer-section">
        <h3>{t('Alert classification')}</h3>
        <dl className="detail-list alert-detail-grid">
          <div><dt>{t('Hazard type')}</dt><dd>{controlledLabel(properties.hazard_type)}</dd></div>
          <div><dt>{t('Severity')}</dt><dd>{controlledLabel(properties.severity)}</dd></div>
          <div><dt>{t('Urgency')}</dt><dd>{controlledLabel(properties.urgency)}</dd></div>
          <div><dt>{t('Certainty')}</dt><dd>{controlledLabel(properties.certainty)}</dd></div>
          <div><dt>{t('Status')}</dt><dd>{controlledLabel(properties.status)}</dd></div>
          <div><dt>{t('Scope')}</dt><dd>{controlledLabel(properties.scope)}</dd></div>
        </dl>
      </section>

      <section className="drawer-section">
        <h3>{t('Affected area')}</h3>
        <p className="alert-description">{properties.area_description || '—'}</p>
        <dl className="detail-list alert-detail-grid alert-time-grid">
          <div><dt>{t('Issued')}</dt><dd>{dateTime(properties.issued_at)}</dd></div>
          <div><dt>{t('Effective from')}</dt><dd>{dateTime(properties.effective_at)}</dd></div>
          <div><dt>{t('Expires')}</dt><dd>{dateTime(properties.expires_at)}</dd></div>
          <div><dt>{t('Retrieved')}</dt><dd>{dateTime(properties.provenance.fetched_at)}</dd></div>
        </dl>
      </section>

      <section className="drawer-section">
        <h3>{t('Data provenance')}</h3>
        <dl className="detail-list alert-detail-grid">
          <div><dt>{t('Original format')}</dt><dd>{properties.provenance.original_format || '—'}</dd></div>
          <div><dt>{t('Source identifier')}</dt><dd>{properties.provenance.source_identifier || properties.external_id}</dd></div>
        </dl>
        <div className="machine-record-note"><FileCode2 size={17} /><p>{t('This is the original machine-readable government record. Your browser may display raw XML or JSON.')}</p></div>
      </section>

      {href && <footer className="alert-detail-actions"><a href={href} target="_blank" rel="noreferrer">{rawLabel}<ExternalLink size={13} /></a></footer>}
    </aside>
  </>
}

export default function HazardLayerControls({ hazardState, visibility, onToggle, hazardFilter, onHazardFilter }: {
  hazardState: HazardSnapshotState
  visibility: HazardLayerVisibility
  onToggle: (key: keyof HazardLayerVisibility) => void
  hazardFilter: string
  onHazardFilter: (value: string) => void
}) {
  const { t, text, dateTime } = useI18n()
  const [selectedRecord, setSelectedRecord] = useState<HazardFeature | null>(null)
  const { snapshot, loading, error, refresh } = hazardState

  useEffect(() => { setSelectedRecord(null) }, [snapshot?.state])

  const officialAlerts = snapshot?.features.filter(isOfficialAlert) ?? []
  const officialZones = snapshot?.features.filter(isOfficialZone) ?? []
  const supplementalEvents = snapshot?.features.filter(isSupplementalEvent) ?? []
  const verifiedAlerts = snapshot?.verified_active_alerts ?? officialAlerts.length
  const sourceRecords = [...officialAlerts, ...supplementalEvents.filter(feature => !officialAlerts.some(alert => alert.id === feature.id))]
  const staticLayers = availableStaticLayers(snapshot)
  const hazardTypes = [...new Set([
    ...(snapshot?.features.map(feature => feature.properties.hazard_type) ?? []),
    ...staticLayers.map(layer => layer.hazard_type),
  ].filter(Boolean))].sort()
  const lastChecked = latestSourceCheck(snapshot)
  const sourceProblem = snapshot?.status === 'partial' || snapshot?.sources.some(source => source.status === 'error' || source.status === 'stale')
  const controlledLabel = (value: string) => t({ flood: 'Flood', earthquake: 'Earthquake', landslide: 'Landslide', cyclone: 'Cyclone', heatwave: 'Heat wave', wildfire: 'Forest fire', thunderstorm: 'Thunderstorm / lightning', heavy_rain: 'Heavy rainfall', other: 'Other' }[value] ?? value)

  const layer = (key: keyof HazardLayerVisibility, label: string, detail: string, count?: number, disabled = false) => <label className={`hazard-layer-row ${disabled ? 'disabled' : ''}`}>
    <input type="checkbox" checked={visibility[key]} disabled={disabled} onChange={() => onToggle(key)} />
    <span className={`layer-swatch ${key}`} />
    <span><strong>{label}</strong><small>{detail}</small></span>
    {count !== undefined && <em>{count}</em>}
  </label>

  return <>
    <div className="panel-header small"><h2>{t('Hazard intelligence')}</h2><button className="text-button" onClick={refresh} disabled={loading}><RefreshCw size={13} className={loading ? 'spin' : ''} />{t('Refresh')}</button></div>
    <div className={`hazard-feed-state ${error ? 'offline' : officialZones.length ? 'active' : verifiedAlerts ? 'boundary-missing' : sourceProblem ? 'partial' : 'calm'}`}>
      {error ? <WifiOff size={17} /> : officialZones.length || verifiedAlerts || sourceProblem ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}
      <div>
        <strong>{error ? t('Hazard feed unavailable') : loading && !snapshot ? t('Loading hazard sources…') : officialZones.length ? t('Active official alert geometry') : verifiedAlerts ? t('Official alert active · boundary unavailable.') : sourceProblem ? t('Hazard sources partially available') : t('No verified active alert')}</strong>
        <span>{error ? t('Showing no official red zone.') : officialZones.length ? `${verifiedAlerts} ${t('verified alerts')} · ${officialZones.length} ${t('official mapped zones')}${sourceProblem ? ` · ${t('Source coverage incomplete')}` : ''}` : verifiedAlerts ? t('The alert remains listed, but no red zone is drawn without source geometry.') : sourceProblem ? snapshot?.notice ?? t('One or more official sources could not be checked.') : t('No official alert geometry is available for this area.')}</span>
        {lastChecked && <small>{t('Last checked')} · {dateTime(lastChecked)}</small>}
      </div>
    </div>

    {snapshot?.sources.length ? <div className="hazard-source-health" aria-label={t('Source status')}>
      {snapshot.sources.map(source => <div key={source.id}><i className={source.status} /><span><strong>{source.name}</strong><small>{t(source.status === 'ok' ? 'Checked' : source.status === 'not_configured' ? 'Not configured' : source.status === 'stale' ? 'Stale' : 'Unavailable')}</small></span></div>)}
    </div> : null}

    <div className="hazard-layer-group">
      <span>{t('Hazard layers')}</span>
      {layer('official', t('Official active alert boundaries'), t('Only source-issued polygon or circle geometry'), officialZones.length, officialZones.length === 0)}
      {layer('supplemental', t('Supplemental official events'), t('Points are not red-zone boundaries'), supplementalEvents.length, supplementalEvents.length === 0)}
      {layer('staticMaps', t('Official static hazard maps'), t('Optional Bhuvan WMS overlay'), staticLayers.length, staticLayers.length === 0)}
      {layer('synthetic', t('Synthetic demonstration zones'), t('Hidden until explicitly enabled'))}
    </div>
    <div className="hazard-layer-group operational">
      <span>{t('Operational context')}</span>
      {layer('habitations', t('Habitations'), t('Demonstration location markers'))}
      {layer('shelters', t('Shelters'), t('Demonstration shelter markers'))}
    </div>

    <div className="field-block hazard-filter"><label>{t('Hazard type')}</label><select value={hazardFilter} onChange={event => onHazardFilter(event.target.value)}><option value="all">{t('All hazards')}</option>{hazardTypes.map(hazard => <option key={hazard} value={hazard}>{controlledLabel(hazard)}</option>)}</select></div>

    {(officialAlerts.length > 0 || supplementalEvents.length > 0) && <div className="hazard-evidence-list">
      <span>{t('Current source records')}</span>
      {sourceRecords.slice(0, 5).map(feature => {
        const properties = feature.properties
        return <article key={feature.id}>
          <div><strong>{properties.title}</strong><em className={properties.verification_status === 'official_source' ? 'official' : 'supplemental'}>{t(properties.verification_status === 'official_source' ? 'Official source' : 'Supplemental source')}</em></div>
          <p>{properties.source_name}</p>
          <dl><div><dt>{t('Issued')}</dt><dd>{dateTime(properties.issued_at)}</dd></div>{properties.expires_at && <div><dt>{t('Expires')}</dt><dd>{dateTime(properties.expires_at)}</dd></div>}</dl>
          <small className={isOfficialZone(feature) ? 'geometry-available' : properties.verification_status === 'official_source' ? 'geometry-unavailable' : 'point-event'}>{t(isOfficialZone(feature) ? 'Official mapped boundary' : properties.verification_status === 'official_source' ? 'Boundary unavailable' : 'Point event · not a boundary')}</small>
          <button className="alert-detail-button" type="button" onClick={() => setSelectedRecord(feature)}>{t('View alert details')}</button>
        </article>
      })}
      <small className="source-text-note">{t('Official alert text is shown as issued by the source.')}</small>
    </div>}

    {staticLayers.length > 0 && <div className="static-layer-source"><strong>{t('Static historical reference')}</strong>{staticLayers.map(layer => {
      const href = safeUrl(layer.source.source_url)
      return href ? <a key={layer.id} href={href} target="_blank" rel="noreferrer">{text(layer.title)}<ExternalLink size={10} /></a> : <span key={layer.id}>{text(layer.title)}</span>
    })}<small>{t('These WMS layers are historical context, not a current alert. Verify licence before operational reuse.')}</small></div>}
    {selectedRecord && <AlertDetailDrawer feature={selectedRecord} close={() => setSelectedRecord(null)} />}
  </>
}
