import { createDemoSafetyProfile, type ShelterSafetyProfile } from './shelterRecommendation'

export type Priority = 'Critical' | 'High' | 'Medium' | 'Low'

export interface Village {
  state: string
  district: string
  name: string
  lat: number
  lng: number
  score: number
  priority: Priority
  population: number
  hazard: string
  shelter: string
  groups: string
  confidence: number
  lgdCode: string
  lastUpdated: string
  lastFieldVerified: string | null
  confidenceBreakdown: { source: number; recency: number; completeness: number; agreement: number; fieldVerification: number }
  riskComponents: { hazard: number; humanExposure: number; evacuationVulnerability: number; criticalInfrastructure: number; economicAssets: number }
}

export interface CandidateSite {
  id: string
  state: string
  district: string
  name: string
  lat: number
  lng: number
  landStatus: string
  effective: number
  available: number
  distance: number
  bottleneck: string
  hazard: 'Low' | 'Moderate' | 'High'
  housing: number
  water: number
  sanitation: number
  health: number
  school: number
  road: number
  maximumCapacity: number
  currentOccupants: number
  status: 'Open' | 'Limited' | 'Closed'
  routeSafety: 'Clear' | 'Caution' | 'Unsafe'
  travelTime: number
  safetyProfile: ShelterSafetyProfile
}

export interface PriorityCase {
  state: string
  district: string
  id: string
  name: string
  village: string
  hazard: string
  score: number
  priority: Priority
  warning: string
  vulnerable: string
  verified: 'Pending' | 'Field checked' | 'Verified'
  reason: string
  peopleAtRisk: number
  confidence: number
  lastUpdated: string
}

export interface Shelter {
  id: string
  state: string
  district: string
  name: string
  lat: number
  lng: number
  maximumCapacity: number
  currentOccupants: number
  availableCapacity: number
  status: 'Open' | 'Limited' | 'Closed'
  routeSafety: 'Clear' | 'Caution' | 'Unsafe'
  sourceType: 'demo'
}

export const villages: Village[] = [
  {state:'Uttarakhand',district:'Rudraprayag',name:'Tilwara',lat:30.3108,lng:78.9898,score:72,priority:'High',population:2410,hazard:'Flood + landslide',shelter:'Tilwara Inter College · 2.8 km',groups:'382 children · 196 elderly',confidence:89,lgdCode:'043219',lastUpdated:'01 Sep 2026, 08:42 IST',lastFieldVerified:'31 Aug 2026, 16:10 IST',confidenceBreakdown:{source:92,recency:88,completeness:90,agreement:86,fieldVerification:89},riskComponents:{hazard:78,humanExposure:74,evacuationVulnerability:69,criticalInfrastructure:61,economicAssets:58}},
  {state:'Uttarakhand',district:'Rudraprayag',name:'Agastyamuni',lat:30.4099,lng:79.0184,score:46,priority:'Medium',population:3860,hazard:'Flood',shelter:'Block Community Hall · 1.6 km',groups:'594 children · 321 elderly',confidence:91,lgdCode:'043220',lastUpdated:'01 Sep 2026, 08:40 IST',lastFieldVerified:'01 Sep 2026, 07:15 IST',confidenceBreakdown:{source:94,recency:92,completeness:89,agreement:90,fieldVerification:90},riskComponents:{hazard:49,humanExposure:61,evacuationVulnerability:34,criticalInfrastructure:38,economicAssets:42}},
  {state:'Uttarakhand',district:'Rudraprayag',name:'Ukhimath',lat:30.5183,lng:79.0915,score:88,priority:'Critical',population:1980,hazard:'Landslide',shelter:'Ukhimath School · 3.4 km',groups:'304 children · 187 elderly',confidence:86,lgdCode:'043221',lastUpdated:'01 Sep 2026, 08:47 IST',lastFieldVerified:'31 Aug 2026, 14:30 IST',confidenceBreakdown:{source:90,recency:89,completeness:84,agreement:85,fieldVerification:82},riskComponents:{hazard:93,humanExposure:84,evacuationVulnerability:92,criticalInfrastructure:76,economicAssets:61}},
  {state:'Uttarakhand',district:'Rudraprayag',name:'Guptkashi',lat:30.5264,lng:79.0803,score:23,priority:'Low',population:3220,hazard:'Earthquake',shelter:'Tourist Rest Centre · 1.2 km',groups:'477 children · 241 elderly',confidence:82,lgdCode:'043222',lastUpdated:'01 Sep 2026, 08:35 IST',lastFieldVerified:null,confidenceBreakdown:{source:88,recency:80,completeness:85,agreement:83,fieldVerification:62},riskComponents:{hazard:31,humanExposure:38,evacuationVulnerability:17,criticalInfrastructure:25,economicAssets:35}},
  {state:'Uttarakhand',district:'Rudraprayag',name:'Silli',lat:30.3548,lng:79.0121,score:69,priority:'High',population:1740,hazard:'Flood',shelter:'Silli Panchayat Hall · 4.1 km',groups:'262 children · 148 elderly',confidence:88,lgdCode:'043223',lastUpdated:'01 Sep 2026, 08:31 IST',lastFieldVerified:'31 Aug 2026, 17:05 IST',confidenceBreakdown:{source:90,recency:88,completeness:87,agreement:88,fieldVerification:85},riskComponents:{hazard:76,humanExposure:68,evacuationVulnerability:72,criticalInfrastructure:54,economicAssets:49}},
  {state:'Uttarakhand',district:'Rudraprayag',name:'Phata',lat:30.5746,lng:79.0445,score:91,priority:'Critical',population:1260,hazard:'Landslide + isolation',shelter:'Phata School · 5.7 km',groups:'189 children · 116 elderly',confidence:84,lgdCode:'043224',lastUpdated:'01 Sep 2026, 08:51 IST',lastFieldVerified:'31 Aug 2026, 12:25 IST',confidenceBreakdown:{source:89,recency:91,completeness:80,agreement:83,fieldVerification:78},riskComponents:{hazard:95,humanExposure:86,evacuationVulnerability:96,criticalInfrastructure:81,economicAssets:57}},
  {state:'Uttarakhand',district:'Rudraprayag',name:'Chopta',lat:30.4887,lng:79.1615,score:43,priority:'Medium',population:940,hazard:'Forest fire',shelter:'Chopta Community Hall · 2.2 km',groups:'138 children · 91 elderly',confidence:78,lgdCode:'043225',lastUpdated:'01 Sep 2026, 08:20 IST',lastFieldVerified:null,confidenceBreakdown:{source:82,recency:76,completeness:78,agreement:79,fieldVerification:58},riskComponents:{hazard:58,humanExposure:39,evacuationVulnerability:47,criticalInfrastructure:42,economicAssets:36}}
]

export const sites: CandidateSite[] = [
  {id:'SHEL-RPG-01',state:'Uttarakhand',district:'Rudraprayag',name:'Kund Plateau A',lat:30.4850,lng:79.0830,landStatus:'Verified government land',effective:820,available:610,distance:12.4,bottleneck:'Drinking water',hazard:'Low',housing:1240,water:820,sanitation:980,health:900,school:860,road:1100,maximumCapacity:820,currentOccupants:210,status:'Open',routeSafety:'Clear',travelTime:28,safetyProfile:createDemoSafetyProfile(0)},
  {id:'SHEL-RPG-02',state:'Uttarakhand',district:'Rudraprayag',name:'Agastyamuni Terrace',lat:30.4086,lng:79.0225,landStatus:'Legal review pending',effective:640,available:390,distance:8.7,bottleneck:'School capacity',hazard:'Low',housing:910,water:780,sanitation:720,health:690,school:640,road:830,maximumCapacity:640,currentOccupants:250,status:'Limited',routeSafety:'Caution',travelTime:22,safetyProfile:createDemoSafetyProfile(1)},
  {id:'SHEL-RPG-03',state:'Uttarakhand',district:'Rudraprayag',name:'Chopta Transit Site',lat:30.4907,lng:79.1570,landStatus:'Verified government land',effective:410,available:310,distance:18.2,bottleneck:'Road access',hazard:'Moderate',housing:760,water:620,sanitation:530,health:480,school:510,road:410,maximumCapacity:410,currentOccupants:100,status:'Open',routeSafety:'Caution',travelTime:44,safetyProfile:createDemoSafetyProfile(2)},
  {id:'SHEL-RPG-04',state:'Uttarakhand',district:'Rudraprayag',name:'Tilwara Expansion',lat:30.3150,lng:78.9980,landStatus:'Ownership unverified',effective:290,available:0,distance:4.3,bottleneck:'Land verification',hazard:'High',housing:520,water:470,sanitation:430,health:390,school:380,road:440,maximumCapacity:290,currentOccupants:290,status:'Closed',routeSafety:'Unsafe',travelTime:14,safetyProfile:createDemoSafetyProfile(3)}
]

export const priorityCases: PriorityCase[] = [
  {state:'Uttarakhand',district:'Rudraprayag',id:'SUR-0261',name:'Meena Devi household',village:'Phata',hazard:'Landslide',score:94,priority:'Critical',warning:'Orange',vulnerable:'2 elderly · 1 PwD',verified:'Pending',reason:'New landslide warning and no clear evacuation route',peopleAtRisk:5,confidence:81,lastUpdated:'01 Sep 2026, 08:51 IST'},
  {state:'Uttarakhand',district:'Rudraprayag',id:'SUR-0258',name:'Lower Phata cluster',village:'Phata',hazard:'Landslide',score:91,priority:'Critical',warning:'Orange',vulnerable:'11 children · 4 elderly',verified:'Field checked',reason:'High human exposure and reported road blockage',peopleAtRisk:86,confidence:88,lastUpdated:'01 Sep 2026, 08:48 IST'},
  {state:'Uttarakhand',district:'Rudraprayag',id:'SUR-0249',name:'Ward 3 riverside cluster',village:'Tilwara',hazard:'Flood',score:86,priority:'Critical',warning:'Orange',vulnerable:'18 children · 7 elderly',verified:'Pending',reason:'Rising river level and shelter route at risk',peopleAtRisk:124,confidence:84,lastUpdated:'01 Sep 2026, 08:44 IST'},
  {state:'Uttarakhand',district:'Rudraprayag',id:'SUR-0244',name:'Bhandari household',village:'Ukhimath',hazard:'Landslide',score:79,priority:'High',warning:'Advisory',vulnerable:'1 pregnant · 1 bedridden',verified:'Pending',reason:'Vulnerable household and long evacuation time',peopleAtRisk:6,confidence:76,lastUpdated:'01 Sep 2026, 08:33 IST'},
  {state:'Uttarakhand',district:'Rudraprayag',id:'SUR-0238',name:'Silli east cluster',village:'Silli',hazard:'Flood',score:73,priority:'High',warning:'Watch',vulnerable:'8 children · 3 elderly',verified:'Verified',reason:'Flood exposure and limited shelter availability',peopleAtRisk:61,confidence:91,lastUpdated:'01 Sep 2026, 08:25 IST'},
  {state:'Uttarakhand',district:'Rudraprayag',id:'SUR-0227',name:'Rana household',village:'Agastyamuni',hazard:'Flood',score:55,priority:'Medium',warning:'None',vulnerable:'2 children',verified:'Verified',reason:'Moderate flood exposure; route currently clear',peopleAtRisk:4,confidence:92,lastUpdated:'01 Sep 2026, 08:11 IST'}
]

export const shelters: Shelter[] = sites.map(site => ({ id: site.id, state: site.state, district: site.district, name: site.name, lat: site.lat, lng: site.lng, maximumCapacity: site.maximumCapacity, currentOccupants: site.currentOccupants, availableCapacity: site.available, status: site.status, routeSafety: site.routeSafety, sourceType: 'demo' }))

export type ShelterRecommendation = Shelter & { distanceKm: number; suitabilityScore: number; estimatedMinutes: number }

const distanceKm = (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
  const radians = (value: number) => value * Math.PI / 180
  const earthRadiusKm = 6371
  const deltaLat = radians(to.lat - from.lat)
  const deltaLng = radians(to.lng - from.lng)
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(deltaLng / 2) ** 2
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Demo recommendation policy: human safety and usable capacity outweigh raw distance.
 * Closed/full shelters are removed. Clear routes, available space and low-hazard sites
 * rank above a geographically closer shelter with unsafe access.
 */
export function recommendShelters(village: Village, candidates: Shelter[] = shelters): ShelterRecommendation[] {
  return candidates
    .filter(shelter => shelter.state === village.state && shelter.status !== 'Closed' && shelter.availableCapacity > 0)
    .map(shelter => {
      const distance = distanceKm(village, shelter)
      const routeSafety = shelter.routeSafety === 'Clear' ? 40 : shelter.routeSafety === 'Caution' ? 18 : 0
      const capacityRatio = Math.min(1, shelter.availableCapacity / Math.max(1, village.population)) * 30
      const availability = Math.min(20, shelter.availableCapacity / 30)
      const distancePenalty = Math.min(25, distance * 1.2)
      const statusPenalty = shelter.status === 'Limited' ? 10 : 0
      const suitabilityScore = Math.max(0, Math.round(routeSafety + capacityRatio + availability - distancePenalty - statusPenalty))
      return { ...shelter, distanceKm: Math.round(distance * 10) / 10, suitabilityScore, estimatedMinutes: Math.max(5, Math.round(distance * 3.2)) }
    })
    .sort((a, b) => b.suitabilityScore - a.suitabilityScore)
}
