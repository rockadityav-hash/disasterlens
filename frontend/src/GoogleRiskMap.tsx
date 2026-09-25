import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Shelter, Village } from './data'
import { availableStaticLayers, isOfficialZone, isSupplementalEvent, type HazardFeature, type HazardSnapshot, type ShelterBoundaryAssessment, type ShelterBoundaryStatus } from './hazardLayers'
import type { HazardLayerVisibility } from './HazardLayerControls'
import { useI18n } from './i18n'

const riskColour = (score: number) => score >= 75 ? '#ba3434' : score >= 50 ? '#d87532' : score >= 25 ? '#c49a2f' : '#2e7d59'
const officialAlertColour = (severity: unknown) => {
  const level = String(severity ?? '').toLowerCase()
  if (level === 'extreme') return { stroke: '#861f2d', fill: '#a72835' }
  if (level === 'severe') return { stroke: '#a62f32', fill: '#c63e40' }
  if (level === 'moderate') return { stroke: '#ad5d16', fill: '#d77d2b' }
  if (level === 'minor') return { stroke: '#8a741a', fill: '#c3a42e' }
  return { stroke: '#465f70', fill: '#6f8796' }
}
const DEFAULT_LAYERS = { official: true, supplemental: true, staticMaps: false, synthetic: false, habitations: true, shelters: true }
const EMPTY_ROUTES: string[] = []
const EMPTY_ASSESSMENTS: ShelterBoundaryAssessment[] = []

type MapLayerVisibility = Partial<HazardLayerVisibility> & { risk?: boolean }

const safeUrl = (value: string) => {
  try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null }
  catch { return null }
}

function popupLine(root: HTMLElement, tag: 'strong' | 'span' | 'b' | 'small', value: string, className?: string) {
  const element = document.createElement(tag)
  element.textContent = value
  if (className) element.className = className
  root.appendChild(element)
}

function hazardPopup(feature: HazardFeature, labels: { issued: string; expires: string; source: string; official: string; supplemental: string; open: string }, formatTime: (value: string | null | undefined) => string, formatControlled: (value: string) => string) {
  const properties = feature.properties
  const root = document.createElement('div')
  root.className = 'leaflet-profile hazard-popup'
  popupLine(root, 'strong', properties.title)
  popupLine(root, 'b', isOfficialZone(feature) ? labels.official : labels.supplemental, isOfficialZone(feature) ? 'official' : 'supplemental')
  popupLine(root, 'span', `${formatControlled(properties.hazard_type)} · ${formatControlled(properties.severity)}`)
  popupLine(root, 'small', `${labels.source}: ${properties.source_name}`)
  if (properties.issued_at) popupLine(root, 'small', `${labels.issued}: ${formatTime(properties.issued_at)}`)
  if (properties.expires_at) popupLine(root, 'small', `${labels.expires}: ${formatTime(properties.expires_at)}`)
  const href = safeUrl(properties.source_url)
  if (href) {
    const anchor = document.createElement('a')
    anchor.href = href
    anchor.target = '_blank'
    anchor.rel = 'noreferrer'
    anchor.textContent = labels.open
    root.appendChild(anchor)
  }
  return root
}

function shelterPopup(shelter: Shelter, assessment: ShelterBoundaryAssessment | undefined, labels: { spaces: string; route: string; inside: string; outside: string; verify: string; pending: string; sources: string; insideNote: string; outsideNote: string; verifyNote: string; pendingNote: string }, localise: (value: string) => string) {
  const root = document.createElement('div')
  root.className = 'leaflet-profile shelter-boundary-popup'
  popupLine(root, 'strong', localise(shelter.name))
  popupLine(root, 'span', `${shelter.availableCapacity} ${labels.spaces}`)
  popupLine(root, 'small', `${localise(shelter.routeSafety)} ${labels.route}`)
  const statusText = assessment?.status === 'inside_active_zone' ? labels.inside
    : assessment?.status === 'outside_mapped_active_zones' ? labels.outside
      : assessment?.status === 'verification_required' ? labels.verify : labels.pending
  popupLine(root, 'b', statusText, `shelter-boundary-status ${assessment?.status ?? 'pending'}`)
  if (assessment?.matched_sources.length) popupLine(root, 'small', `${labels.sources}: ${assessment.matched_sources.join(', ')}`)
  const notice = assessment?.status === 'inside_active_zone' ? labels.insideNote
    : assessment?.status === 'outside_mapped_active_zones' ? labels.outsideNote
      : assessment?.status === 'verification_required' ? labels.verifyNote : labels.pendingNote
  popupLine(root, 'small', notice, 'shelter-boundary-notice')
  return root
}

function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = []
  let index = 0; let latitude = 0; let longitude = 0
  while (index < encoded.length) {
    let result = 0; let shift = 0; let byte: number
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5 } while (byte >= 0x20)
    latitude += result & 1 ? ~(result >> 1) : result >> 1
    result = 0; shift = 0
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5 } while (byte >= 0x20)
    longitude += result & 1 ? ~(result >> 1) : result >> 1
    points.push([latitude / 1e5, longitude / 1e5])
  }
  return points
}

export default function GoogleRiskMap({ locations, shelters, selectedName, onSelect, className = '', visibleLayers = DEFAULT_LAYERS, routePolylines = EMPTY_ROUTES, hazardSnapshot = null, hazardFilter = 'all', shelterAssessments = EMPTY_ASSESSMENTS }: { locations: Village[]; shelters: Shelter[]; selectedName?: string; onSelect: (name: string) => void; className?: string; visibleLayers?: MapLayerVisibility; routePolylines?: string[]; hazardSnapshot?: HazardSnapshot | null; hazardFilter?: string; shelterAssessments?: ShelterBoundaryAssessment[] }) {
  const { t, text, dateTime } = useI18n()
  const controlledLabel = (value: string) => t({ flood: 'Flood', earthquake: 'Earthquake', landslide: 'Landslide', cyclone: 'Cyclone', heatwave: 'Heat wave', wildfire: 'Forest fire', thunderstorm: 'Thunderstorm / lightning', heavy_rain: 'Heavy rainfall', other: 'Other', extreme: 'Extreme', severe: 'Severe', moderate: 'Moderate', minor: 'Minor', unknown: 'Unknown' }[value.toLowerCase()] ?? value)
  const host = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const onSelectRef = useRef(onSelect)

  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])

  useEffect(() => {
    if (!host.current) return
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    const map = L.map(host.current, { zoomControl: true, attributionControl: true, preferCanvas: true })
    mapRef.current = map
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19, crossOrigin: true }).addTo(map)
    const bounds = L.latLngBounds([])

    const syntheticVisible = visibleLayers.synthetic ?? visibleLayers.risk ?? false
    const shelterAssessmentById = new Map(shelterAssessments.map(item => [item.shelter_id, item]))
    const featureMatchesFilter = (feature: HazardFeature) => hazardFilter === 'all' || feature.properties.hazard_type === hazardFilter
    const officialFeatures = hazardSnapshot?.features.filter(feature => isOfficialZone(feature) && featureMatchesFilter(feature)) ?? []
    const supplementalFeatures = hazardSnapshot?.features.filter(feature => isSupplementalEvent(feature) && featureMatchesFilter(feature)) ?? []

    if (visibleLayers.staticMaps) availableStaticLayers(hazardSnapshot).filter(layer => hazardFilter === 'all' || layer.hazard_type === hazardFilter).forEach(layer => {
      L.tileLayer.wms(layer.service_url, {
        layers: layer.layer_name!, version: layer.version, format: layer.format,
        transparent: layer.transparent, opacity: layer.opacity, attribution: layer.attribution,
      }).addTo(map)
    })

    if (visibleLayers.official && officialFeatures.length) {
      const officialLayer = L.geoJSON({ type: 'FeatureCollection', features: officialFeatures } as unknown as GeoJSON.FeatureCollection, {
        style: feature => {
          const colour = officialAlertColour(feature?.properties?.severity)
          return { color: colour.stroke, weight: 3, opacity: .95, fillColor: colour.fill, fillOpacity: .28, dashArray: feature?.properties?.geometry_origin === 'official_circle' ? '8 4' : undefined }
        },
        onEachFeature: (_feature, layer) => {
          const hazard = _feature as unknown as HazardFeature
          layer.bindPopup(hazardPopup(hazard, { issued: t('Issued'), expires: t('Expires'), source: t('Source'), official: t('Official active alert'), supplemental: t('Supplemental official event'), open: t('Open source') }, dateTime, controlledLabel))
          const tooltip = document.createElement('span')
          tooltip.textContent = hazard.properties.title
          layer.bindTooltip(tooltip, { sticky: true })
        },
      }).addTo(map)
      const featureBounds = officialLayer.getBounds()
      if (featureBounds.isValid()) bounds.extend(featureBounds)
    }

    if (visibleLayers.supplemental && supplementalFeatures.length) {
      const supplementalLayer = L.geoJSON({ type: 'FeatureCollection', features: supplementalFeatures } as unknown as GeoJSON.FeatureCollection, {
        pointToLayer: (_feature, latlng) => L.circleMarker(latlng, { radius: 8, color: '#ffffff', weight: 2, fillColor: '#675a87', fillOpacity: 1, className: 'supplemental-event-marker' }),
        style: { color: '#675a87', weight: 2, opacity: .9, fillColor: '#81739e', fillOpacity: .18, dashArray: '5 4' },
        onEachFeature: (_feature, layer) => {
          const hazard = _feature as unknown as HazardFeature
          layer.bindPopup(hazardPopup(hazard, { issued: t('Issued'), expires: t('Expires'), source: t('Source'), official: t('Official active alert'), supplemental: t('Supplemental official event'), open: t('Open source') }, dateTime, controlledLabel))
        },
      }).addTo(map)
      // Supplemental events may be hundreds of kilometres from the selected
      // state anchor. Show them when the user pans, but do not zoom the local
      // operational map out to fit them automatically.
    }

    locations.forEach(location => {
      const position = L.latLng(location.lat, location.lng); bounds.extend(position)
      if (syntheticVisible && location.score > 0) {
        L.circle(position, { radius: 900 + location.score * 24, color: '#8b651d', weight: 2, opacity: .9, fillColor: '#d4a53b', fillOpacity: .16, dashArray: '7 5', className: `risk-zone-circle synthetic-risk-zone risk-${location.priority.toLowerCase()}` })
          .bindTooltip(`${text(location.name)} · ${t('Synthetic demo')} · ${text(location.priority)} ${location.score}/100`, { sticky: true }).addTo(map)
      }
      if (visibleLayers.habitations) {
        const selected = selectedName === location.name
        L.circleMarker(position, { radius: selected ? 15 : 12, color: '#ffffff', weight: 3, fillColor: location.score > 0 ? riskColour(location.score) : '#155f91', fillOpacity: 1 })
          .bindTooltip(String(location.score > 0 ? location.score : 'i'), { permanent: true, direction: 'center', className: 'risk-score-label' })
          .bindPopup(`<div class="leaflet-profile"><strong>${text(location.name)}</strong><span>${text(location.district)}</span><b style="color:${location.score > 0 ? riskColour(location.score) : '#155f91'}">${location.score > 0 ? `${text(location.priority)} · ${location.score}/100` : t('Reference location')}</b></div>`)
          .on('click', () => onSelectRef.current(location.name)).addTo(map)
      }
    })

    if (visibleLayers.shelters) shelters.filter(shelter => shelter.status !== 'Closed').forEach(shelter => {
      const position = L.latLng(shelter.lat, shelter.lng); bounds.extend(position)
      const assessment = shelterAssessmentById.get(shelter.id)
      const markerStatus: ShelterBoundaryStatus | 'pending' = assessment?.status ?? 'pending'
      L.marker(position, { icon: L.divIcon({ className: `shelter-map-icon shelter-screen-${markerStatus}`, html: '<span aria-hidden="true">S</span>', iconSize: [28,28], iconAnchor: [14,14] }) })
        .bindPopup(shelterPopup(shelter, assessment, {
          spaces: t('spaces available'), route: t('route'),
          inside: t('Inside an active official alert boundary'),
          outside: t('Outside mapped active alert boundaries · not certified safe'),
          verify: t('Verification required before use'),
          pending: t('Boundary screening pending or unavailable'),
          sources: t('Matched sources'),
          insideNote: t('This shelter intersects publisher-supplied active alert geometry and must be held for authorised review.'),
          outsideNote: t('No mapped active alert boundary intersects this point. This does not certify the shelter as safe.'),
          verifyNote: t('Incomplete source coverage or a missing alert boundary requires manual verification.'),
          pendingNote: t('No automatic boundary decision is available. Verify this shelter manually.'),
        }, text)).addTo(map)
    })

    routePolylines.forEach((encoded, index) => {
      try { L.polyline(decodePolyline(encoded), { color: index === 0 ? '#155f91' : '#687986', weight: index === 0 ? 6 : 4, opacity: index === 0 ? .95 : .7 }).addTo(map) } catch { /* Invalid geometry is ignored. */ }
    })
    const fitOperationalArea = () => {
      if (bounds.isValid()) {
        if (locations.length === 1 && shelters.length === 0) map.setView(bounds.getCenter(), 8)
        else {
          const padded = bounds.pad(.18)
          const zoom = Math.min(12, map.getBoundsZoom(padded))
          map.setView(padded.getCenter(), zoom, { animate: false })
        }
      } else map.setView([22.5, 79], 5)
    }
    fitOperationalArea()
    const resizeTimer = window.setTimeout(() => { map.invalidateSize(); fitOperationalArea() }, 80)
    return () => { window.clearTimeout(resizeTimer); map.remove(); if (mapRef.current === map) mapRef.current = null }
  }, [locations, shelters, selectedName, visibleLayers, routePolylines, hazardSnapshot, hazardFilter, shelterAssessments, text, dateTime, t])

  const mappedOfficialZones = hazardSnapshot?.features.filter(feature => isOfficialZone(feature) && (hazardFilter === 'all' || feature.properties.hazard_type === hazardFilter)).length ?? 0
  const syntheticVisible = visibleLayers.synthetic ?? visibleLayers.risk ?? false

  return <div className={`google-map-shell leaflet-map-shell ${className}`}>
    <div ref={host} className="leaflet-map-host" />
    <div className="map-mode-note osm-note">{t('OpenStreetMap interactive map · no API key required')}</div>
    {visibleLayers.official && mappedOfficialZones > 0 && <div className="red-zone-map-note official"><span />{t('Coloured areas are official alert boundaries · red means severe or extreme')}</div>}
    {syntheticVisible && locations.some(location => location.score > 0) && <div className="red-zone-map-note synthetic"><span />{t('Dashed amber circles are synthetic demonstrations')}</div>}
  </div>
}
