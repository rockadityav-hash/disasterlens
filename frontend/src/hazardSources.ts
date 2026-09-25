export type HazardSource = {
  name: string
  agency: string
  purpose: string
  url: string
  access: string
}

const sachet: HazardSource = {
  name: 'SACHET National Disaster Alert Portal',
  agency: 'National Disaster Management Authority (NDMA)',
  purpose: 'Multi-hazard alerts and Common Alerting Protocol reference',
  url: 'https://sachet.ndma.gov.in/CapFeed',
  access: 'Public reference portal',
}

const imd: HazardSource = {
  name: 'India Meteorological Department',
  agency: 'Ministry of Earth Sciences',
  purpose: 'Weather warnings, rainfall, cyclones and heat-wave bulletins',
  url: 'https://mausam.imd.gov.in/',
  access: 'Official public bulletins',
}

const cwc: HazardSource = {
  name: 'Central Water Commission Flood Forecast',
  agency: 'Department of Water Resources',
  purpose: 'Flood forecasts, river levels and basin advisories',
  url: 'https://ffs.india-water.gov.in/',
  access: 'Official public portal',
}

const gsi: HazardSource = {
  name: 'GSI Bhusanket',
  agency: 'Geological Survey of India',
  purpose: 'Landslide susceptibility and forecast reference',
  url: 'https://bhusanket.gsi.gov.in/',
  access: 'Official public portal',
}

const ncs: HazardSource = {
  name: 'National Center for Seismology',
  agency: 'Ministry of Earth Sciences',
  purpose: 'Reviewed earthquake events and seismic information',
  url: 'https://seismo.gov.in/',
  access: 'Official public portal',
}

const incois: HazardSource = {
  name: 'INCOIS Ocean Information Services',
  agency: 'Ministry of Earth Sciences',
  purpose: 'Tsunami, storm surge and ocean-state advisories',
  url: 'https://incois.gov.in/portal/index.jsp',
  access: 'Official public portal',
}

const fsi: HazardSource = {
  name: 'Forest Survey of India – Forest Fire',
  agency: 'Ministry of Environment, Forest and Climate Change',
  purpose: 'Forest-fire monitoring and alert reference',
  url: 'https://fsiforestfire.gov.in/',
  access: 'Official public portal',
}

const lgd: HazardSource = {
  name: 'Local Government Directory',
  agency: 'Ministry of Panchayati Raj',
  purpose: 'Administrative names and location-code verification',
  url: 'https://lgdirectory.gov.in/',
  access: 'Official public directory',
}

export function sourcesForHazard(hazard: string): HazardSource[] {
  const value = hazard.toLowerCase()
  const specific: HazardSource[] = []
  if (/flood|erosion|drought|river/.test(value)) specific.push(cwc, imd)
  if (/landslide|slope|glacial/.test(value)) specific.push(gsi, imd)
  if (/earthquake|seismic/.test(value)) specific.push(ncs)
  if (/cyclone|rain|heat|weather/.test(value)) specific.push(imd)
  if (/coastal|tsunami|sea|ocean|storm surge/.test(value)) specific.push(incois, imd)
  if (/forest fire|wildfire/.test(value)) specific.push(fsi, imd)
  const ordered = [...specific, sachet, lgd]
  return ordered.filter((source, index) => ordered.findIndex(item => item.name === source.name) === index)
}
