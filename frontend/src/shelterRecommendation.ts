import type { CandidateSite } from './data'

export type DisasterType = 'flood' | 'landslide' | 'earthquake' | 'cyclone' | 'heatwave' | 'wildfire'
export type Condition = 'good' | 'limited' | 'poor'
export type RiskLevel = 'low' | 'moderate' | 'high'
export type Verification = 'verified' | 'conditional' | 'failed'
export type SatelliteSignal = 'clear' | 'watch' | 'unsafe'
export type SatelliteQuality = 'usable' | 'limited' | 'unusable'

export interface SatelliteEvidence {
  mode: 'synthetic_demo' | 'analyst_verified'
  sourceName: string
  sensor: 'optical' | 'sar' | 'derived_product'
  sceneId: string
  capturedAt: string
  analysisRadiusM: number
  resolutionM: number | null
  quality: SatelliteQuality
  analystReviewed: boolean
  hazardSignals: Partial<Record<DisasterType, SatelliteSignal>>
  sourceUrl: string | null
}

export interface ShelterSafetyProfile {
  dataMode: 'synthetic_demo' | 'official_verified'
  dataConfidence: number
  recordDate: string
  surveyedElevationM: number | null
  planningFloodLevelM: number | null
  inNotifiedFloodplain: boolean | null
  drainage: Condition | null
  landslideSusceptibility: RiskLevel | null
  inLandslideRunout: boolean | null
  slopeStability: Condition | null
  structuralAudit: Verification | null
  seismicCompliance: Verification | null
  liquefactionRisk: RiskLevel | null
  windResistance: Verification | null
  inStormSurgeZone: boolean | null
  waterReliability: Condition | null
  sanitationCondition: Condition | null
  backupPower: Condition | null
  ventilation: Condition | null
  medicalAccess: Condition | null
  fireClearanceM: number | null
  vegetationRisk: RiskLevel | null
  satelliteEvidence: SatelliteEvidence | null
}

export type ShelterDecision = 'eligible' | 'verification_required' | 'rejected'

export interface ShelterEvaluation {
  site: CandidateSite
  decision: ShelterDecision
  score: number | null
  rank: number | null
  factors: { hazardSafety: number; satelliteInterpretation: number; routeAccess: number; capacity: number; essentialServices: number; proximity: number }
  reasons: string[]
  blockers: string[]
  missingFields: string[]
  confidence: number
}

export const disasterOptions: { value: DisasterType; label: string }[] = [
  { value: 'flood', label: 'Flood' },
  { value: 'landslide', label: 'Landslide' },
  { value: 'earthquake', label: 'Earthquake' },
  { value: 'cyclone', label: 'Cyclone' },
  { value: 'heatwave', label: 'Heat wave' },
  { value: 'wildfire', label: 'Forest fire' },
]

export const recommendationWeights = {
  hazardSafety: 0.45,
  routeAccess: 0.20,
  capacity: 0.15,
  essentialServices: 0.15,
  proximity: 0.05,
} as const

export const satelliteShareOfHazard = 0.20

const conditionScore = (value: Condition | null) => value === 'good' ? 100 : value === 'limited' ? 60 : value === 'poor' ? 20 : 0
const riskScore = (value: RiskLevel | null) => value === 'low' ? 100 : value === 'moderate' ? 55 : 0
const verificationScore = (value: Verification | null) => value === 'verified' ? 100 : value === 'conditional' ? 60 : 0
const booleanScore = (value: boolean | null, safeWhen: boolean) => value === null ? 0 : value === safeWhen ? 100 : 0
const missing = (profile: ShelterSafetyProfile, fields: (keyof ShelterSafetyProfile)[]) => fields.filter(field => profile[field] === null).map(String)

type HazardAssessment = { score: number; reasons: string[]; blockers: string[]; missingFields: string[] }

function assessSatellite(disaster: DisasterType, evidence: SatelliteEvidence | null): HazardAssessment {
  const reasons: string[] = []
  const blockers: string[] = []
  const missingFields: string[] = []
  if (!evidence) return { score: 0, reasons, blockers, missingFields: ['satelliteEvidence'] }
  if (evidence.quality === 'unusable') return { score: 0, reasons, blockers, missingFields: ['satelliteImageQuality'] }
  if (evidence.mode === 'analyst_verified' && !evidence.analystReviewed) missingFields.push('satelliteAnalystReview')
  const signal = evidence.hazardSignals[disaster]
  if (!signal) return { score: 0, reasons, blockers, missingFields: [...missingFields, 'satelliteHazardSignal'] }
  if (evidence.quality === 'limited') missingFields.push('satelliteImageQuality')
  if (signal === 'unsafe') blockers.push('Satellite interpretation indicates an unsafe condition for the selected disaster.')
  else if (signal === 'watch') {
    reasons.push('Satellite interpretation shows a warning signal that needs field confirmation.')
    missingFields.push('satelliteFieldConfirmation')
  } else reasons.push('No disaster-specific warning signal was identified in the supplied satellite interpretation.')
  const signalScore = signal === 'clear' ? 100 : signal === 'watch' ? 55 : 0
  const qualityScore = evidence.quality === 'usable' ? 100 : 55
  return { score: Math.round(signalScore * .80 + qualityScore * .20), reasons, blockers, missingFields }
}

function assessHazard(disaster: DisasterType, profile: ShelterSafetyProfile): HazardAssessment {
  const reasons: string[] = []
  const blockers: string[] = []

  if (disaster === 'flood') {
    const missingFields = missing(profile, ['surveyedElevationM', 'planningFloodLevelM', 'inNotifiedFloodplain', 'drainage', 'landslideSusceptibility'])
    if (missingFields.length) return { score: 0, reasons, blockers, missingFields }
    const margin = profile.surveyedElevationM! - profile.planningFloodLevelM!
    if (margin <= 0) blockers.push('Ground level is not above the recorded planning flood level.')
    else reasons.push('Surveyed ground is above the recorded planning flood level.')
    if (profile.inNotifiedFloodplain) blockers.push('Site is inside the recorded floodplain.')
    else reasons.push('Site is outside the recorded floodplain.')
    if (profile.landslideSusceptibility === 'high') blockers.push('The elevated site has high landslide susceptibility.')
    else reasons.push('Slope stability is not marked high risk.')
    const elevationScore = margin <= 0 ? 0 : margin < 1 ? 35 : margin < 3 ? 75 : 100
    const score = Math.round(elevationScore * .40 + booleanScore(profile.inNotifiedFloodplain, false) * .25 + conditionScore(profile.drainage) * .20 + riskScore(profile.landslideSusceptibility) * .15)
    return { score, reasons, blockers, missingFields }
  }

  if (disaster === 'landslide') {
    const missingFields = missing(profile, ['landslideSusceptibility', 'inLandslideRunout', 'slopeStability', 'structuralAudit'])
    if (missingFields.length) return { score: 0, reasons, blockers, missingFields }
    if (profile.landslideSusceptibility === 'high' || profile.inLandslideRunout) blockers.push('Site is in a high-susceptibility or landslide run-out area.')
    else reasons.push('Site is outside recorded high-susceptibility and run-out areas.')
    if (profile.slopeStability === 'poor') blockers.push('Field or geotechnical slope condition is marked poor.')
    const score = Math.round(riskScore(profile.landslideSusceptibility) * .40 + booleanScore(profile.inLandslideRunout, false) * .25 + conditionScore(profile.slopeStability) * .20 + verificationScore(profile.structuralAudit) * .15)
    return { score, reasons, blockers, missingFields }
  }

  if (disaster === 'earthquake') {
    const missingFields = missing(profile, ['structuralAudit', 'seismicCompliance', 'liquefactionRisk'])
    if (missingFields.length) return { score: 0, reasons, blockers, missingFields }
    if (profile.structuralAudit === 'failed' || profile.seismicCompliance === 'failed') blockers.push('Building failed the structural or seismic safety check.')
    else reasons.push('Structural and seismic records do not show a failed check.')
    if (profile.liquefactionRisk === 'high') blockers.push('Ground liquefaction risk is marked high.')
    const score = Math.round(verificationScore(profile.structuralAudit) * .45 + verificationScore(profile.seismicCompliance) * .40 + riskScore(profile.liquefactionRisk) * .15)
    return { score, reasons, blockers, missingFields }
  }

  if (disaster === 'cyclone') {
    const missingFields = missing(profile, ['structuralAudit', 'windResistance', 'inStormSurgeZone', 'drainage'])
    if (missingFields.length) return { score: 0, reasons, blockers, missingFields }
    if (profile.structuralAudit === 'failed' || profile.windResistance === 'failed') blockers.push('Building failed the structural or wind-resistance check.')
    if (profile.inStormSurgeZone) blockers.push('Site is inside the recorded storm-surge zone.')
    else reasons.push('Site is outside the recorded storm-surge zone.')
    const score = Math.round(verificationScore(profile.windResistance) * .40 + verificationScore(profile.structuralAudit) * .30 + booleanScore(profile.inStormSurgeZone, false) * .20 + conditionScore(profile.drainage) * .10)
    return { score, reasons, blockers, missingFields }
  }

  if (disaster === 'heatwave') {
    const missingFields = missing(profile, ['waterReliability', 'backupPower', 'ventilation', 'medicalAccess'])
    if (missingFields.length) return { score: 0, reasons, blockers, missingFields }
    if (profile.waterReliability === 'poor' || profile.ventilation === 'poor') blockers.push('Reliable drinking water or safe ventilation is inadequate.')
    else reasons.push('Drinking water and ventilation checks are usable.')
    const score = Math.round(conditionScore(profile.waterReliability) * .35 + conditionScore(profile.backupPower) * .20 + conditionScore(profile.ventilation) * .30 + conditionScore(profile.medicalAccess) * .15)
    return { score, reasons, blockers, missingFields }
  }

  const missingFields = missing(profile, ['fireClearanceM', 'vegetationRisk', 'structuralAudit'])
  if (missingFields.length) return { score: 0, reasons, blockers, missingFields }
  if (profile.fireClearanceM! < 30 || profile.vegetationRisk === 'high') blockers.push('Vegetation/fire-break clearance fails the configurable demo rule.')
  else reasons.push('Recorded vegetation risk and clearance pass the demo rule.')
  const clearanceScore = Math.min(100, Math.round(profile.fireClearanceM! / 60 * 100))
  const score = Math.round(clearanceScore * .35 + riskScore(profile.vegetationRisk) * .40 + verificationScore(profile.structuralAudit) * .25)
  return { score, reasons, blockers, missingFields }
}

/**
 * A conservative two-stage policy. Unsafe and unverified sites cannot receive a
 * rank; among eligible sites, disaster safety outweighs convenience.
 */
export function evaluateShelters(disaster: DisasterType, people: number, sites: CandidateSite[]): ShelterEvaluation[] {
  const requestedPeople = Math.max(1, Math.round(people))
  const results: ShelterEvaluation[] = sites.map(site => {
    const profile = site.safetyProfile
    const reasons: string[] = []
    const blockers: string[] = []
    const missingFields: string[] = []
    if (site.status === 'Closed') blockers.push('Shelter is closed.')
    if (site.available < requestedPeople) blockers.push('Available capacity does not cover the selected group.')
    else reasons.push('Available capacity covers the selected group.')
    if (site.routeSafety === 'Unsafe') blockers.push('Access route is marked unsafe.')
    else reasons.push('Access route has not been marked unsafe.')
    if (!site.landStatus.toLowerCase().startsWith('verified')) missingFields.push('landVerification')

    if (!profile) {
      return { site, decision: 'verification_required' as const, score: null, rank: null, factors: { hazardSafety: 0, satelliteInterpretation: 0, routeAccess: 0, capacity: 0, essentialServices: 0, proximity: 0 }, reasons, blockers, missingFields: ['safetyProfile', ...missingFields], confidence: 0 }
    }
    if (profile.structuralAudit === 'failed') blockers.push('Shelter failed its structural audit.')
    const hazard = assessHazard(disaster, profile)
    const satellite = assessSatellite(disaster, profile.satelliteEvidence)
    reasons.push(...hazard.reasons)
    reasons.push(...satellite.reasons)
    blockers.push(...hazard.blockers)
    blockers.push(...satellite.blockers)
    missingFields.push(...hazard.missingFields)
    missingFields.push(...satellite.missingFields)
    const uniqueMissing = [...new Set(missingFields)].sort()
    const serviceValues = [profile.waterReliability, profile.sanitationCondition, profile.backupPower, profile.medicalAccess].filter((value): value is Condition => value !== null)
    const factors = {
      hazardSafety: Math.round(hazard.score * (1 - satelliteShareOfHazard) + satellite.score * satelliteShareOfHazard),
      satelliteInterpretation: satellite.score,
      routeAccess: site.routeSafety === 'Clear' ? 100 : site.routeSafety === 'Caution' ? 55 : 0,
      capacity: Math.min(100, Math.round(site.available / requestedPeople * 100)),
      essentialServices: serviceValues.length ? Math.round(serviceValues.reduce((sum, value) => sum + conditionScore(value), 0) / serviceValues.length) : 0,
      proximity: Math.max(0, Math.round(100 - Math.min(100, site.distance * 5))),
    }
    const preliminaryScore = Math.round(Object.entries(recommendationWeights).reduce((sum, [key, weight]) => sum + factors[key as keyof typeof factors] * weight, 0))
    const decision: ShelterDecision = blockers.length ? 'rejected' : uniqueMissing.length ? 'verification_required' : 'eligible'
    return { site, decision, score: decision === 'eligible' ? preliminaryScore : null, rank: null, factors, reasons, blockers, missingFields: uniqueMissing, confidence: Math.max(0, profile.dataConfidence - uniqueMissing.length * 12) }
  })
  const eligible = results.filter(result => result.decision === 'eligible').sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.site.name.localeCompare(b.site.name))
  eligible.forEach((result, index) => { result.rank = index + 1 })
  return results.sort((a, b) => ({ eligible: 0, verification_required: 1, rejected: 2 }[a.decision] - { eligible: 0, verification_required: 1, rejected: 2 }[b.decision]) || (b.score ?? 0) - (a.score ?? 0))
}

export function createDemoSafetyProfile(index: number): ShelterSafetyProfile {
  const satelliteEvidence: SatelliteEvidence[] = [
    { mode: 'synthetic_demo', sourceName: 'Copernicus demonstration workflow', sensor: 'derived_product', sceneId: 'DEMO-SAT-001', capturedAt: '04 Sep 2026', analysisRadiusM: 1000, resolutionM: 10, quality: 'usable', analystReviewed: false, hazardSignals: { flood: 'clear', landslide: 'clear', earthquake: 'clear', cyclone: 'clear', heatwave: 'clear', wildfire: 'clear' }, sourceUrl: 'https://browser.dataspace.copernicus.eu/' },
    { mode: 'synthetic_demo', sourceName: 'Copernicus demonstration workflow', sensor: 'derived_product', sceneId: 'DEMO-SAT-002', capturedAt: '04 Sep 2026', analysisRadiusM: 1000, resolutionM: 10, quality: 'limited', analystReviewed: false, hazardSignals: { flood: 'watch', landslide: 'watch', earthquake: 'clear', cyclone: 'watch', heatwave: 'watch', wildfire: 'watch' }, sourceUrl: 'https://browser.dataspace.copernicus.eu/' },
    { mode: 'synthetic_demo', sourceName: 'Copernicus demonstration workflow', sensor: 'derived_product', sceneId: 'DEMO-SAT-003', capturedAt: '04 Sep 2026', analysisRadiusM: 1000, resolutionM: 10, quality: 'usable', analystReviewed: false, hazardSignals: { flood: 'clear', landslide: 'watch', earthquake: 'watch', cyclone: 'clear', heatwave: 'watch', wildfire: 'unsafe' }, sourceUrl: 'https://browser.dataspace.copernicus.eu/' },
    { mode: 'synthetic_demo', sourceName: 'Copernicus demonstration workflow', sensor: 'derived_product', sceneId: 'DEMO-SAT-004', capturedAt: '04 Sep 2026', analysisRadiusM: 1000, resolutionM: 10, quality: 'usable', analystReviewed: false, hazardSignals: { flood: 'unsafe', landslide: 'unsafe', earthquake: 'unsafe', cyclone: 'unsafe', heatwave: 'unsafe', wildfire: 'unsafe' }, sourceUrl: 'https://browser.dataspace.copernicus.eu/' },
  ]
  const profiles: ShelterSafetyProfile[] = [
    { dataMode: 'synthetic_demo', dataConfidence: 86, recordDate: 'Demo record · 04 Sep 2026', surveyedElevationM: 112, planningFloodLevelM: 105, inNotifiedFloodplain: false, drainage: 'good', landslideSusceptibility: 'low', inLandslideRunout: false, slopeStability: 'good', structuralAudit: 'verified', seismicCompliance: 'verified', liquefactionRisk: 'low', windResistance: 'verified', inStormSurgeZone: false, waterReliability: 'good', sanitationCondition: 'good', backupPower: 'good', ventilation: 'good', medicalAccess: 'good', fireClearanceM: 60, vegetationRisk: 'low', satelliteEvidence: satelliteEvidence[0] },
    { dataMode: 'synthetic_demo', dataConfidence: 72, recordDate: 'Demo record · 04 Sep 2026', surveyedElevationM: 107, planningFloodLevelM: 105, inNotifiedFloodplain: false, drainage: 'limited', landslideSusceptibility: 'moderate', inLandslideRunout: false, slopeStability: 'limited', structuralAudit: 'conditional', seismicCompliance: 'conditional', liquefactionRisk: 'moderate', windResistance: 'conditional', inStormSurgeZone: false, waterReliability: 'good', sanitationCondition: 'limited', backupPower: 'limited', ventilation: 'good', medicalAccess: 'limited', fireClearanceM: 38, vegetationRisk: 'moderate', satelliteEvidence: satelliteEvidence[1] },
    { dataMode: 'synthetic_demo', dataConfidence: 68, recordDate: 'Demo record · 04 Sep 2026', surveyedElevationM: 121, planningFloodLevelM: 105, inNotifiedFloodplain: false, drainage: 'limited', landslideSusceptibility: 'moderate', inLandslideRunout: false, slopeStability: 'limited', structuralAudit: 'verified', seismicCompliance: 'conditional', liquefactionRisk: 'low', windResistance: 'conditional', inStormSurgeZone: false, waterReliability: 'limited', sanitationCondition: 'limited', backupPower: 'poor', ventilation: 'good', medicalAccess: 'limited', fireClearanceM: 34, vegetationRisk: 'moderate', satelliteEvidence: satelliteEvidence[2] },
    { dataMode: 'synthetic_demo', dataConfidence: 52, recordDate: 'Demo record · 04 Sep 2026', surveyedElevationM: 132, planningFloodLevelM: 105, inNotifiedFloodplain: false, drainage: 'poor', landslideSusceptibility: 'high', inLandslideRunout: true, slopeStability: 'poor', structuralAudit: 'failed', seismicCompliance: 'failed', liquefactionRisk: 'high', windResistance: 'failed', inStormSurgeZone: true, waterReliability: 'poor', sanitationCondition: 'poor', backupPower: 'poor', ventilation: 'poor', medicalAccess: 'poor', fireClearanceM: 12, vegetationRisk: 'high', satelliteEvidence: satelliteEvidence[3] },
  ]
  return profiles[index % profiles.length]
}
