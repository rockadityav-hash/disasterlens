import type { CandidateSite, PriorityCase, Shelter, Village } from './data'
import { createDemoSafetyProfile } from './shelterRecommendation'

export type ReferenceSource = {
  name: string
  publisher: string
  url: string
  period: string
  use: string
}

export type StateProfile = {
  name: string
  capital: string
  lat: number
  lng: number
  population2011: number
  density2011: number | null
  scenarioHazards: string[]
  territorialNote?: string
}

const censusSource: ReferenceSource = {
  name: 'Population Census 2011 – Primary Census Abstract',
  publisher: 'Office of the Registrar General & Census Commissioner, India',
  url: 'https://censusindia.gov.in/census.website/en/data/population-finder',
  period: '2011',
  use: 'Population and density reference baseline',
}

const lgdSource: ReferenceSource = {
  name: 'Local Government Directory',
  publisher: 'Ministry of Panchayati Raj, Government of India',
  url: 'https://lgdirectory.gov.in/demo/downloadDirectory.do',
  period: 'Directory accessed 02 Sep 2026',
  use: 'Current administrative-name verification',
}

const sachetSource: ReferenceSource = {
  name: 'SACHET National Disaster Alert Portal',
  publisher: 'National Disaster Management Authority',
  url: 'https://sachet.ndma.gov.in/CapFeed',
  period: 'Reference portal accessed 02 Sep 2026',
  use: 'Official hazard taxonomy and future CAP-alert integration',
}

const specialisedSource: ReferenceSource = {
  name: 'National hazard-source catalogue',
  publisher: 'IMD · CWC · GSI · INCOIS · FSI · NCS',
  url: 'https://api.imd.gov.in/public/api_reference.html',
  period: 'Integration references accessed 02 Sep 2026',
  use: 'Agency ownership and connector design; no live feed used here',
}

const copernicusSource: ReferenceSource = {
  name: 'Copernicus Data Space Ecosystem',
  publisher: 'European Union Copernicus programme',
  url: 'https://documentation.dataspace.copernicus.eu/APIs/STAC.html',
  period: 'Reference accessed 11 Sep 2026',
  use: 'Sentinel-1/2 scene discovery for a future analyst-verified workflow; no live scene is fetched in this demo',
}

export const nationwideSources = [censusSource, lgdSource, sachetSource, specialisedSource, copernicusSource]

const p = (name: string, capital: string, lat: number, lng: number, population2011: number, density2011: number | null, scenarioHazards: string[], territorialNote?: string): StateProfile => ({ name, capital, lat, lng, population2011, density2011, scenarioHazards, territorialNote })

export const stateProfiles: StateProfile[] = [
  p('Andhra Pradesh','Amaravati',16.5062,80.6480,49386799,308,['Cyclone','Coastal flood','Heat wave'],'2011 districts aligned to the post-bifurcation state.'),
  p('Arunachal Pradesh','Itanagar',27.0844,93.6053,1383727,17,['Landslide','Earthquake','River flood']),
  p('Assam','Dispur',26.1433,91.7898,31205576,398,['River flood','Erosion','Earthquake']),
  p('Bihar','Patna',25.5941,85.1376,104099452,1106,['River flood','Heat wave','Drought']),
  p('Chhattisgarh','Raipur',21.2514,81.6296,25545198,189,['Heat wave','Flood','Forest fire']),
  p('Goa','Panaji',15.4909,73.8278,1458545,394,['Coastal flood','Extreme rainfall','Landslide']),
  p('Gujarat','Gandhinagar',23.2156,72.6369,60439692,308,['Cyclone','Earthquake','Heat wave']),
  p('Haryana','Chandigarh',30.7333,76.7794,25351462,573,['Heat wave','Flood','Drought']),
  p('Himachal Pradesh','Shimla',31.1048,77.1734,6864602,123,['Landslide','Flash flood','Earthquake']),
  p('Jharkhand','Ranchi',23.3441,85.3096,32988134,414,['Heat wave','Drought','Flood']),
  p('Karnataka','Bengaluru',12.9716,77.5946,61095297,319,['Drought','Urban flood','Heat wave']),
  p('Kerala','Thiruvananthapuram',8.5241,76.9366,33406061,860,['Flood','Landslide','Coastal hazard']),
  p('Madhya Pradesh','Bhopal',23.2599,77.4126,72626809,236,['Heat wave','Flood','Drought']),
  p('Maharashtra','Mumbai',19.0760,72.8777,112374333,365,['Urban flood','Cyclone','Drought']),
  p('Manipur','Imphal',24.8170,93.9368,2855794,115,['Landslide','Earthquake','Flood'],'Uses the updated Census 2011 population.'),
  p('Meghalaya','Shillong',25.5788,91.8933,2966889,132,['Landslide','Extreme rainfall','Earthquake']),
  p('Mizoram','Aizawl',23.7271,92.7176,1097206,52,['Landslide','Earthquake','Forest fire']),
  p('Nagaland','Kohima',25.6751,94.1086,1978502,119,['Landslide','Earthquake','Flash flood']),
  p('Odisha','Bhubaneswar',20.2961,85.8245,41974218,270,['Cyclone','Coastal flood','Heat wave']),
  p('Punjab','Chandigarh',30.7333,76.7794,27743338,551,['Flood','Heat wave','Drought']),
  p('Rajasthan','Jaipur',26.9124,75.7873,68548437,200,['Heat wave','Drought','Flash flood']),
  p('Sikkim','Gangtok',27.3389,88.6065,610577,86,['Landslide','Glacial-lake flood','Earthquake']),
  p('Tamil Nadu','Chennai',13.0827,80.2707,72147030,555,['Cyclone','Coastal flood','Heat wave']),
  p('Telangana','Hyderabad',17.3850,78.4867,35193978,312,['Urban flood','Heat wave','Drought'],'2011 districts aligned to the post-bifurcation state.'),
  p('Tripura','Agartala',23.8315,91.2868,3673917,350,['Flood','Landslide','Earthquake']),
  p('Uttar Pradesh','Lucknow',26.8467,80.9462,199812341,828,['River flood','Heat wave','Drought']),
  p('Uttarakhand','Dehradun',30.3165,78.0322,10086292,189,['Landslide','Flash flood','Earthquake']),
  p('West Bengal','Kolkata',22.5726,88.3639,91276115,1028,['Cyclone','River flood','Coastal flood']),
  p('Andaman and Nicobar Islands','Sri Vijaya Puram',11.6234,92.7265,380581,46,['Cyclone','Tsunami','Earthquake'],'Capital name updated; Census values remain 2011.'),
  p('Chandigarh','Chandigarh',30.7333,76.7794,1055450,9252,['Urban flood','Heat wave','Earthquake']),
  p('Dadra and Nagar Haveli and Daman and Diu','Daman',20.3974,72.8328,586620,null,['Cyclone','Coastal flood','Heat wave'],'Population combines the two 2011 union-territory totals; no combined 2011 density is shown.'),
  p('Delhi','New Delhi',28.6139,77.2090,16787941,11320,['Heat wave','Urban flood','Earthquake'],'Census label: NCT of Delhi.'),
  p('Jammu and Kashmir','Srinagar',34.0837,74.7973,11992724,null,['Earthquake','Flood','Landslide'],'Current-boundary figure derived from 2011 district totals after excluding Leh and Kargil.'),
  p('Ladakh','Leh',34.1526,77.5771,274289,5,['Flash flood','Landslide','Earthquake'],'Population is the sum of Leh and Kargil Census 2011 district totals.'),
  p('Lakshadweep','Kavaratti',10.5593,72.6358,64473,2149,['Cyclone','Coastal flood','Sea erosion']),
  p('Puducherry','Puducherry',11.9416,79.8083,1247953,2547,['Cyclone','Coastal flood','Heat wave']),
]

export const getStateProfile = (state: string | null) => stateProfiles.find(item => item.name === state) ?? null

export function profileMapLocation(profile: StateProfile): Village {
  return {
    state: profile.name,
    district: `${profile.capital} reference point`,
    name: profile.capital,
    lat: profile.lat,
    lng: profile.lng,
    score: 0,
    priority: 'Low',
    population: profile.population2011,
    hazard: 'No operational risk score',
    shelter: 'No verified nationwide shelter record',
    groups: 'State aggregate only',
    confidence: 45,
    lgdCode: 'REFERENCE',
    lastUpdated: 'Reference snapshot · 02 Sep 2026',
    lastFieldVerified: null,
    confidenceBreakdown: { source: 90, recency: 15, completeness: 45, agreement: 55, fieldVerification: 0 },
    riskComponents: { hazard: 0, humanExposure: 0, evacuationVulnerability: 0, criticalInfrastructure: 0, economicAssets: 0 },
  }
}

const demoZoneTemplates = [
  { label: 'North response sector', lat: .075, lng: .025, score: 88, priority: 'Critical' as const },
  { label: 'Eastern response sector', lat: .015, lng: .09, score: 79, priority: 'Critical' as const },
  { label: 'River corridor', lat: -.065, lng: .055, score: 68, priority: 'High' as const },
  { label: 'Southern response sector', lat: -.09, lng: -.035, score: 57, priority: 'High' as const },
  { label: 'Western response sector', lat: .025, lng: -.085, score: 39, priority: 'Medium' as const },
]

const compactJurisdictions = new Set(['Chandigarh', 'Delhi', 'Lakshadweep', 'Puducherry'])

const profileHash = (profile: StateProfile) => [...profile.name].reduce((total, character) => (total * 31 + character.charCodeAt(0)) % 10007, 17)

function demoOffset(profile: StateProfile, lat: number, lng: number) {
  const scale = compactJurisdictions.has(profile.name) ? .42 : profile.name === 'Andaman and Nicobar Islands' ? .65 : 1
  const angle = (profileHash(profile) % 360) * Math.PI / 180
  return {
    lat: (lat * Math.cos(angle) - lng * Math.sin(angle)) * scale,
    lng: (lat * Math.sin(angle) + lng * Math.cos(angle)) * scale,
  }
}

const priorityForScore = (score: number): Village['priority'] => score >= 75 ? 'Critical' : score >= 50 ? 'High' : score >= 25 ? 'Medium' : 'Low'

/**
 * Deterministic hackathon-only geometry around each capital. These points make the
 * nationwide workflow demonstrable; they are never presented as current alerts or
 * official red-zone declarations.
 */
export function buildDemoRiskLocations(profile: StateProfile): Village[] {
  const hash = profileHash(profile)
  return demoZoneTemplates.map((zone, index) => {
    const offset = demoOffset(profile, zone.lat, zone.lng)
    const score = Math.max(30, Math.min(94, zone.score + ((hash >> index) % 9) - 4))
    const population = Math.max(420, Math.min(4800, Math.round(profile.population2011 * (.000018 + index * .000003))))
    return {
      state: profile.name,
      district: `${profile.capital} demonstration district`,
      name: `${profile.capital} · ${zone.label}`,
      lat: profile.lat + offset.lat,
      lng: profile.lng + offset.lng,
      score,
      priority: priorityForScore(score),
      population,
      hazard: profile.scenarioHazards[index % profile.scenarioHazards.length],
      shelter: `${profile.capital} demo relief centre`,
      groups: 'Synthetic demonstration population',
      confidence: 72 - index * 2,
      lgdCode: `DEMO-${String(index + 1).padStart(2, '0')}`,
      lastUpdated: 'Hackathon demonstration snapshot · 03 Sep 2026',
      lastFieldVerified: null,
      confidenceBreakdown: { source: 65, recency: 70, completeness: 72, agreement: 68, fieldVerification: 0 },
      riskComponents: { hazard: score, humanExposure: Math.max(30, score - 8), evacuationVulnerability: Math.max(25, score - 12), criticalInfrastructure: Math.max(20, score - 18), economicAssets: Math.max(20, score - 22) },
    }
  })
}

export function buildDemoShelters(profile: StateProfile): Shelter[] {
  const north = demoOffset(profile, .045, -.015)
  const community = demoOffset(profile, -.045, .005)
  return [
    { id: 'DEMO-SHELTER-01', name: `${profile.capital} North Relief Centre`, lat: profile.lat + north.lat, lng: profile.lng + north.lng, maximumCapacity: 800, currentOccupants: 210, availableCapacity: 590, status: 'Open' as const, routeSafety: 'Clear' as const },
    { id: 'DEMO-SHELTER-02', name: `${profile.capital} Community Shelter`, lat: profile.lat + community.lat, lng: profile.lng + community.lng, maximumCapacity: 620, currentOccupants: 180, availableCapacity: 440, status: 'Limited' as const, routeSafety: 'Caution' as const },
  ].map(shelter => ({ ...shelter, state: profile.name, district: `${profile.capital} demonstration district`, sourceType: 'demo' as const }))
}

export function buildDemoPriorityCases(profile: StateProfile, locations = buildDemoRiskLocations(profile)): PriorityCase[] {
  return locations.map((location, index) => ({
    state: profile.name,
    district: location.district,
    id: `DEMO-${profile.name.replace(/[^A-Z]/gi, '').slice(0, 3).toUpperCase()}-${String(index + 1).padStart(3, '0')}`,
    name: `${location.name} response cluster`,
    village: location.name,
    hazard: location.hazard,
    score: Math.min(96, location.score + (index % 2 ? 2 : 4)),
    priority: priorityForScore(Math.min(96, location.score + (index % 2 ? 2 : 4))),
    warning: location.score >= 75 ? 'Orange' : location.score >= 50 ? 'Yellow' : 'Advisory',
    vulnerable: `${Math.max(4, Math.round(location.population * .08))} children · ${Math.max(2, Math.round(location.population * .04))} elderly`,
    verified: index === 2 ? 'Field checked' : index === 4 ? 'Verified' : 'Pending',
    reason: 'Hazard scenario with elevated exposure and route verification pending',
    peopleAtRisk: Math.max(20, Math.round(location.population * (.16 + index * .025))),
    confidence: location.confidence,
    lastUpdated: '03 Sep 2026, 10:00 IST',
  }))
}

export function buildDemoCandidateSites(profile: StateProfile): CandidateSite[] {
  const demoShelters = buildDemoShelters(profile)
  const extra = demoOffset(profile, -.08, -.065)
  const inputs = [
    { shelter: demoShelters[0], landStatus: 'Verified government land', hazard: 'Low' as const, housing: 920, water: 800, sanitation: 860, health: 780, school: 840, road: 880, bottleneck: 'Health services' },
    { shelter: demoShelters[1], landStatus: 'Legal review pending', hazard: 'Moderate' as const, housing: 760, water: 690, sanitation: 720, health: 650, school: 620, road: 700, bottleneck: 'School capacity' },
    { shelter: { ...demoShelters[1], id: 'DEMO-SHELTER-03', name: `${profile.capital} Transit Site`, lat: profile.lat + extra.lat, lng: profile.lng + extra.lng, maximumCapacity: 360, currentOccupants: 80, availableCapacity: 0, status: 'Closed' as const, routeSafety: 'Unsafe' as const }, landStatus: 'Ownership unverified', hazard: 'High' as const, housing: 520, water: 480, sanitation: 450, health: 410, school: 430, road: 390, bottleneck: 'Land verification' },
  ]
  return inputs.map(({ shelter, ...input }, index) => {
    const effective = Math.min(input.housing, input.water, input.sanitation, input.health, input.school, input.road, shelter.maximumCapacity)
    return {
      id: `DEMO-SITE-${index + 1}`, state: profile.name, district: shelter.district, name: shelter.name, lat: shelter.lat, lng: shelter.lng,
      landStatus: input.landStatus, effective, available: input.landStatus === 'Ownership unverified' ? 0 : Math.max(0, effective - shelter.currentOccupants), distance: 3.8 + index * 4.6,
      bottleneck: input.bottleneck, hazard: input.hazard, housing: input.housing, water: input.water, sanitation: input.sanitation, health: input.health, school: input.school, road: input.road,
      maximumCapacity: shelter.maximumCapacity, currentOccupants: shelter.currentOccupants, status: shelter.status, routeSafety: shelter.routeSafety, travelTime: 14 + index * 11, safetyProfile: createDemoSafetyProfile(index),
    }
  })
}
