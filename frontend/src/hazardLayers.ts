import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiBase } from './api'

export type HazardPointGeometry = { type: 'Point'; coordinates: [number, number] }
export type HazardPolygonGeometry = { type: 'Polygon'; coordinates: number[][][] }
export type HazardMultiPolygonGeometry = { type: 'MultiPolygon'; coordinates: number[][][][] }
export type HazardGeometry = HazardPointGeometry | HazardPolygonGeometry | HazardMultiPolygonGeometry
export type HazardVerification = 'official_source' | 'supplemental_official_source'
export type HazardGeometryOrigin = 'official_polygon' | 'official_circle' | 'official_point' | 'unavailable'

export interface HazardFeatureProperties {
  external_id: string
  title: string
  description: string
  hazard_type: string
  severity: string
  urgency: string
  certainty: string
  status: string
  scope: string
  issued_at: string | null
  effective_at: string | null
  expires_at: string | null
  is_active: boolean
  state: string | null
  area_description: string
  source_id: string
  source_name: string
  source_url: string
  verification_status: HazardVerification
  geometry_origin: HazardGeometryOrigin
  synthetic: false
  provenance: {
    fetched_at: string | null
    original_format: string
    source_identifier: string
    transformation: string
  }
}

export interface HazardFeature {
  type: 'Feature'
  id: string
  geometry: HazardGeometry | null
  properties: HazardFeatureProperties
}

export interface StaticHazardLayer {
  id: string
  title: string
  hazard_type: string
  layer_type: 'wms'
  service_url: string
  capabilities_url: string
  layer_name: string | null
  version: string
  format: string
  transparent: boolean
  opacity: number
  attribution: string
  status: 'available' | 'capabilities_required'
  source: {
    organisation: string
    source_url: string
    licence_or_restrictions: string
  }
}

export interface HazardSourceStatus {
  id: string
  name: string
  status: 'ok' | 'not_configured' | 'error' | 'stale'
  official: boolean
  last_checked_at: string | null
  last_success_at: string | null
  error: string | null
}

export interface HazardSnapshot {
  type: 'FeatureCollection'
  features: HazardFeature[]
  state: string
  query: { latitude: number | null; longitude: number | null }
  generated_at: string
  cache: { hit: boolean; ttl_seconds: number }
  verified_active_alerts: number
  status: 'active_alerts' | 'no_verified_active_alerts' | 'partial'
  notice: string
  synthetic: false
  static_layers: StaticHazardLayer[]
  sources: HazardSourceStatus[]
}

export interface HazardSnapshotState {
  snapshot: HazardSnapshot | null
  loading: boolean
  error: string | null
  refresh: () => void
}

export type ShelterBoundaryStatus = 'inside_active_zone' | 'outside_mapped_active_zones' | 'verification_required'

export interface HazardShelterPoint {
  id: string
  name: string
  latitude: number
  longitude: number
}

export interface ShelterBoundaryAssessment {
  shelter_id: string
  shelter_name: string
  status: ShelterBoundaryStatus
  matched_zone_ids: string[]
  matched_sources: string[]
  evaluated_at: string | null
  notice: string
}

export interface ShelterScreeningResponse {
  state: string
  items: ShelterBoundaryAssessment[]
  notice: string
}

export interface ShelterScreeningState {
  result: ShelterScreeningResponse | null
  loading: boolean
  error: string | null
}

function validSnapshot(value: unknown): value is HazardSnapshot {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<HazardSnapshot>
  return candidate.type === 'FeatureCollection' && Array.isArray(candidate.features) && Array.isArray(candidate.static_layers) && Array.isArray(candidate.sources)
}

export function useHazardSnapshot(state: string | null, latitude?: number, longitude?: number): HazardSnapshotState {
  const [snapshot, setSnapshot] = useState<HazardSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision(value => value + 1), [])

  useEffect(() => {
    if (!state) { setSnapshot(null); setError(null); return }
    const controller = new AbortController()
    const url = new URL(`${apiBase}/api/v1/hazards/snapshot`, window.location.origin)
    url.searchParams.set('state', state)
    if (Number.isFinite(latitude)) url.searchParams.set('latitude', String(latitude))
    if (Number.isFinite(longitude)) url.searchParams.set('longitude', String(longitude))
    // Do not leave the previous jurisdiction's geometry visible while a new
    // state request is in flight.
    setSnapshot(null)
    setLoading(true)
    setError(null)
    fetch(url, { signal: controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then(data => {
        if (!validSnapshot(data)) throw new Error('Invalid hazard snapshot')
        if (data.state.localeCompare(state, undefined, { sensitivity: 'accent' }) !== 0) throw new Error('Hazard snapshot state mismatch')
        setSnapshot(data)
      })
      .catch(reason => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setSnapshot(null)
        setError(reason instanceof Error ? reason.message : 'Hazard snapshot unavailable')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [state, latitude, longitude, revision])

  return useMemo(() => ({ snapshot, loading, error, refresh }), [snapshot, loading, error, refresh])
}

const screeningStatuses = new Set<ShelterBoundaryStatus>(['inside_active_zone', 'outside_mapped_active_zones', 'verification_required'])

function validScreening(value: unknown): value is ShelterScreeningResponse {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ShelterScreeningResponse>
  return typeof candidate.state === 'string' && typeof candidate.notice === 'string' && Array.isArray(candidate.items)
    && candidate.items.every(item => Boolean(item) && typeof item === 'object'
      && typeof item.shelter_id === 'string'
      && screeningStatuses.has(item.status)
      && Array.isArray(item.matched_zone_ids)
      && Array.isArray(item.matched_sources))
}

export function useShelterScreening(state: string | null, latitude: number | undefined, longitude: number | undefined, shelters: readonly HazardShelterPoint[], refreshKey?: string | null): ShelterScreeningState {
  const [result, setResult] = useState<ShelterScreeningResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!state || shelters.length === 0) { setResult(null); setError(null); setLoading(false); return }
    const controller = new AbortController()
    // Shelter IDs repeat in demonstration state datasets. Clear the previous
    // result before changing jurisdiction so statuses can never bleed across.
    setResult(null)
    setLoading(true)
    setError(null)
    fetch(`${apiBase}/api/v1/hazards/screen-shelters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        state,
        latitude: Number.isFinite(latitude) ? latitude : null,
        longitude: Number.isFinite(longitude) ? longitude : null,
        shelters,
      }),
    })
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then(data => {
        if (!validScreening(data)) throw new Error('Invalid shelter screening response')
        if (data.state.localeCompare(state, undefined, { sensitivity: 'accent' }) !== 0) throw new Error('Shelter screening state mismatch')
        setResult(data)
      })
      .catch(reason => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setResult(null)
        setError(reason instanceof Error ? reason.message : 'Shelter boundary check unavailable')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [state, latitude, longitude, shelters, refreshKey])

  return useMemo(() => ({ result, loading, error }), [result, loading, error])
}

export const isOfficialAlert = (feature: HazardFeature) => feature.properties.verification_status === 'official_source'
  && feature.properties.is_active

export const isOfficialZone = (feature: HazardFeature) => isOfficialAlert(feature)
  && (feature.geometry?.type === 'Polygon' || feature.geometry?.type === 'MultiPolygon')

export const isSupplementalEvent = (feature: HazardFeature) => feature.properties.verification_status === 'supplemental_official_source'

export const availableStaticLayers = (snapshot: HazardSnapshot | null) => snapshot?.static_layers.filter(layer => layer.status === 'available' && Boolean(layer.layer_name)) ?? []

export const latestSourceCheck = (snapshot: HazardSnapshot | null) => {
  const timestamps = snapshot?.sources.map(source => source.last_checked_at).filter((value): value is string => Boolean(value)) ?? []
  return timestamps.sort().at(-1) ?? snapshot?.generated_at ?? null
}
