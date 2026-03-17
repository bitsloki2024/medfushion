// ─── Disease & Geographic Data ────────────────────────────────────────────────

export type DiseaseKey = 'covid' | 'malaria' | 'dengue' | 'flu' | 'tb';

export interface GlobePoint {
  lat: number;
  lng: number;
  country: string;
  iso2: string;
  risk_score: number;
  cases: number;
  deaths: number;
  population: number;
  region: string;
}

export interface CountryStats {
  country: string;
  iso2: string;
  population: number;
  totalCases: number;
  totalDeaths: number;
  activeCases: number;
  riskScore: number;
  riskLabel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  isAlarming: boolean;
  growthRate: number;
  fatalityRate: number;
  dataConfidence: number;
  dataFreshness: string;
  source: string;
  trendData: TrendPoint[];
  anomalies: number[];
}

export interface TrendPoint {
  year: number;
  cases: number;
  deaths: number;
  isAnomaly?: boolean;
  anomalyType?: 'numerical' | 'seasonal';
}

export interface SpreadArc {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string;
  intensity: number;
}

// ─── Country Coordinates ──────────────────────────────────────────────────────
export const COUNTRY_COORDS: Record<string, { lat: number; lng: number; population: number; region: string }> = {
  "Afghanistan":               { lat: 33.93, lng: 67.71, population: 40099462,  region: "Asia" },
  "Algeria":                   { lat: 28.03, lng: 1.66,  population: 44903225,  region: "Africa" },
  "Angola":                    { lat: -11.20, lng: 17.87, population: 34503774, region: "Africa" },
  "Argentina":                 { lat: -38.41, lng: -63.62, population: 45605826, region: "Americas" },
  "Australia":                 { lat: -25.27, lng: 133.77, population: 25921000, region: "Asia-Pacific" },
  "Bangladesh":                { lat: 23.68, lng: 90.35, population: 166303498, region: "Asia" },
  "Brazil":                    { lat: -14.24, lng: -51.93, population: 214326223, region: "Americas" },
  "Burkina Faso":              { lat: 12.36, lng: -1.53, population: 21497096, region: "Africa" },
  "Burundi":                   { lat: -3.37, lng: 29.92, population: 12255433, region: "Africa" },
  "Cambodia":                  { lat: 12.57, lng: 104.99, population: 16589023, region: "Asia" },
  "Cameroon":                  { lat: 7.37, lng: 12.35, population: 27224265, region: "Africa" },
  "Central African Republic":  { lat: 6.61, lng: 20.94, population: 4829767,  region: "Africa" },
  "Chad":                      { lat: 15.45, lng: 18.73, population: 17413580, region: "Africa" },
  "China":                     { lat: 35.86, lng: 104.19, population: 1411750000, region: "Asia" },
  "Colombia":                  { lat: 4.57, lng: -74.30, population: 51197000, region: "Americas" },
  "Democratic Republic of the Congo": { lat: -4.04, lng: 21.76, population: 99010212, region: "Africa" },
  "Ethiopia":                  { lat: 9.14, lng: 40.49, population: 120283026, region: "Africa" },
  "France":                    { lat: 46.23, lng: 2.21, population: 67876000, region: "Europe" },
  "Germany":                   { lat: 51.16, lng: 10.45, population: 83240525, region: "Europe" },
  "Ghana":                     { lat: 7.95, lng: -1.02, population: 32395450, region: "Africa" },
  "Guinea":                    { lat: 9.95, lng: -9.70, population: 13531906, region: "Africa" },
  "India":                     { lat: 20.59, lng: 78.96, population: 1393409038, region: "Asia" },
  "Indonesia":                 { lat: -0.79, lng: 113.92, population: 277534122, region: "Asia" },
  "Iran":                      { lat: 32.43, lng: 53.69, population: 86758304, region: "Asia" },
  "Iraq":                      { lat: 33.22, lng: 43.68, population: 41179350, region: "Asia" },
  "Italy":                     { lat: 41.87, lng: 12.57, population: 60360000, region: "Europe" },
  "Japan":                     { lat: 36.20, lng: 138.25, population: 125360000, region: "Asia" },
  "Kenya":                     { lat: -0.02, lng: 37.91, population: 54985698, region: "Africa" },
  "Madagascar":                { lat: -18.77, lng: 46.87, population: 27691019, region: "Africa" },
  "Malawi":                    { lat: -13.25, lng: 34.30, population: 19129952, region: "Africa" },
  "Malaysia":                  { lat: 4.21, lng: 101.98, population: 32776194, region: "Asia" },
  "Mali":                      { lat: 17.57, lng: -3.99, population: 22414000, region: "Africa" },
  "Mexico":                    { lat: 23.63, lng: -102.55, population: 130262216, region: "Americas" },
  "Mozambique":                { lat: -18.67, lng: 35.53, population: 32163047, region: "Africa" },
  "Myanmar":                   { lat: 21.91, lng: 95.96, population: 54417000, region: "Asia" },
  "Nepal":                     { lat: 28.39, lng: 84.12, population: 29136808, region: "Asia" },
  "Niger":                     { lat: 17.61, lng: 8.08, population: 25252000, region: "Africa" },
  "Nigeria":                   { lat: 9.08, lng: 8.68, population: 213401323, region: "Africa" },
  "Pakistan":                  { lat: 30.38, lng: 69.35, population: 225199937, region: "Asia" },
  "Peru":                      { lat: -9.19, lng: -75.02, population: 33035304, region: "Americas" },
  "Philippines":               { lat: 12.88, lng: 121.77, population: 111046913, region: "Asia" },
  "Russia":                    { lat: 61.52, lng: 105.32, population: 145912025, region: "Europe" },
  "Rwanda":                    { lat: -1.94, lng: 29.87, population: 13461888, region: "Africa" },
  "Senegal":                   { lat: 14.50, lng: -14.45, population: 17196301, region: "Africa" },
  "Sierra Leone":              { lat: 8.46, lng: -11.78, population: 8141343,  region: "Africa" },
  "Somalia":                   { lat: 5.15, lng: 46.20, population: 17065581, region: "Africa" },
  "South Africa":              { lat: -30.56, lng: 22.94, population: 60041995, region: "Africa" },
  "South Sudan":               { lat: 7.86, lng: 29.69, population: 11381000, region: "Africa" },
  "Spain":                     { lat: 40.46, lng: -3.75, population: 47431000, region: "Europe" },
  "Sri Lanka":                 { lat: 7.87, lng: 80.77, population: 21919000, region: "Asia" },
  "Sudan":                     { lat: 12.86, lng: 30.22, population: 44909353, region: "Africa" },
  "Tanzania":                  { lat: -6.37, lng: 34.89, population: 63298550, region: "Africa" },
  "Thailand":                  { lat: 15.87, lng: 100.99, population: 71601103, region: "Asia" },
  "Turkey":                    { lat: 38.96, lng: 35.24, population: 84680273, region: "Europe" },
  "Uganda":                    { lat: 1.37, lng: 32.29, population: 47123531, region: "Africa" },
  "United Kingdom":            { lat: 55.37, lng: -3.44, population: 68207116, region: "Europe" },
  "United States":             { lat: 37.09, lng: -95.71, population: 332915073, region: "Americas" },
  "Venezuela":                 { lat: 6.42, lng: -66.59, population: 28435943, region: "Americas" },
  "Vietnam":                   { lat: 14.06, lng: 108.28, population: 97338583, region: "Asia" },
  "Yemen":                     { lat: 15.55, lng: 48.52, population: 33696614, region: "Asia" },
  "Zambia":                    { lat: -13.13, lng: 27.85, population: 18920651, region: "Africa" },
  "Zimbabwe":                  { lat: -19.02, lng: 29.15, population: 15092171, region: "Africa" },
};

// ─── India States ──────────────────────────────────────────────────────────────
export const INDIA_STATES: Record<string, { lat: number; lng: number; population: number; capital: string }> = {
  "Andhra Pradesh":    { lat: 15.91, lng: 79.74, population: 49386799, capital: "Amaravati" },
  "Assam":             { lat: 26.20, lng: 92.94, population: 31205576, capital: "Dispur" },
  "Bihar":             { lat: 25.09, lng: 85.31, population: 104099452, capital: "Patna" },
  "Chhattisgarh":      { lat: 21.27, lng: 81.86, population: 29436231, capital: "Raipur" },
  "Delhi":             { lat: 28.70, lng: 77.10, population: 16787941, capital: "New Delhi" },
  "Goa":               { lat: 15.29, lng: 74.12, population: 1458545, capital: "Panaji" },
  "Gujarat":           { lat: 22.25, lng: 71.19, population: 60439692, capital: "Gandhinagar" },
  "Haryana":           { lat: 29.05, lng: 76.08, population: 25351462, capital: "Chandigarh" },
  "Himachal Pradesh":  { lat: 31.10, lng: 77.17, population: 6864602, capital: "Shimla" },
  "Jharkhand":         { lat: 23.61, lng: 85.27, population: 32988134, capital: "Ranchi" },
  "Karnataka":         { lat: 15.31, lng: 75.71, population: 61095297, capital: "Bengaluru" },
  "Kerala":            { lat: 10.85, lng: 76.27, population: 33406061, capital: "Thiruvananthapuram" },
  "Madhya Pradesh":    { lat: 23.47, lng: 77.95, population: 72626809, capital: "Bhopal" },
  "Maharashtra":       { lat: 19.75, lng: 75.71, population: 112374333, capital: "Mumbai" },
  "Manipur":           { lat: 24.66, lng: 93.90, population: 2855794, capital: "Imphal" },
  "Meghalaya":         { lat: 25.47, lng: 91.37, population: 2966889, capital: "Shillong" },
  "Mizoram":           { lat: 23.16, lng: 92.94, population: 1097206, capital: "Aizawl" },
  "Nagaland":          { lat: 26.16, lng: 94.56, population: 1978502, capital: "Kohima" },
  "Odisha":            { lat: 20.94, lng: 85.09, population: 41974218, capital: "Bhubaneswar" },
  "Punjab":            { lat: 31.14, lng: 75.34, population: 27743338, capital: "Chandigarh" },
  "Rajasthan":         { lat: 27.02, lng: 74.22, population: 68548437, capital: "Jaipur" },
  "Tamil Nadu":        { lat: 11.12, lng: 78.66, population: 72147030, capital: "Chennai" },
  "Telangana":         { lat: 17.12, lng: 79.01, population: 35003674, capital: "Hyderabad" },
  "Tripura":           { lat: 23.94, lng: 91.99, population: 3673917, capital: "Agartala" },
  "Uttar Pradesh":     { lat: 26.84, lng: 80.94, population: 199812341, capital: "Lucknow" },
  "Uttarakhand":       { lat: 30.06, lng: 79.55, population: 10086292, capital: "Dehradun" },
  "West Bengal":       { lat: 22.98, lng: 87.85, population: 91276115, capital: "Kolkata" },
};

// ─── Synthetic Disease Data per Disease ───────────────────────────────────────
const DISEASE_BASES: Record<DiseaseKey, Record<string, { baseCases: number; risk: number }>> = {
  malaria: {
    "Nigeria":        { baseCases: 61524000, risk: 0.92 },
    "Democratic Republic of the Congo": { baseCases: 28972000, risk: 0.89 },
    "Tanzania":       { baseCases: 8236000,  risk: 0.82 },
    "Mozambique":     { baseCases: 11045000, risk: 0.85 },
    "Uganda":         { baseCases: 11003000, risk: 0.80 },
    "Mali":           { baseCases: 7340000,  risk: 0.79 },
    "Burkina Faso":   { baseCases: 8521000,  risk: 0.81 },
    "Ghana":          { baseCases: 5263000,  risk: 0.76 },
    "Ethiopia":       { baseCases: 3527000,  risk: 0.68 },
    "Kenya":          { baseCases: 3482000,  risk: 0.67 },
    "India":          { baseCases: 5943000,  risk: 0.64 },
    "Cameroon":       { baseCases: 6031000,  risk: 0.75 },
    "Niger":          { baseCases: 6893000,  risk: 0.77 },
    "Chad":           { baseCases: 4561000,  risk: 0.73 },
    "Zambia":         { baseCases: 6012000,  risk: 0.76 },
    "Angola":         { baseCases: 3874000,  risk: 0.72 },
    "Malawi":         { baseCases: 7139000,  risk: 0.78 },
    "Rwanda":         { baseCases: 3245000,  risk: 0.69 },
    "Myanmar":        { baseCases: 289000,   risk: 0.48 },
    "Indonesia":      { baseCases: 343000,   risk: 0.42 },
    "Papua New Guinea": { baseCases: 1200000, risk: 0.70 },
    "Central African Republic": { baseCases: 2100000, risk: 0.75 },
    "Somalia":        { baseCases: 1950000,  risk: 0.71 },
    "South Sudan":    { baseCases: 2800000,  risk: 0.80 },
    "Sudan":          { baseCases: 3200000,  risk: 0.72 },
    "Sierra Leone":   { baseCases: 1890000,  risk: 0.73 },
    "Guinea":         { baseCases: 2100000,  risk: 0.74 },
    "Burundi":        { baseCases: 5900000,  risk: 0.81 },
  },
  covid: {
    "United States":  { baseCases: 103436829, risk: 0.62 },
    "China":          { baseCases: 99289124,  risk: 0.55 },
    "India":          { baseCases: 44685648,  risk: 0.58 },
    "France":         { baseCases: 38997490,  risk: 0.48 },
    "Germany":        { baseCases: 38249060,  risk: 0.45 },
    "Brazil":         { baseCases: 37076053,  risk: 0.52 },
    "South Korea":    { baseCases: 32376073,  risk: 0.41 },
    "Japan":          { baseCases: 33803572,  risk: 0.43 },
    "Italy":          { baseCases: 26155957,  risk: 0.46 },
    "United Kingdom": { baseCases: 24910387,  risk: 0.44 },
    "Russia":         { baseCases: 22104613,  risk: 0.50 },
    "Turkey":         { baseCases: 17212247,  risk: 0.47 },
    "Spain":          { baseCases: 13913743,  risk: 0.44 },
    "Vietnam":        { baseCases: 11526762,  risk: 0.40 },
    "Australia":      { baseCases: 11371987,  risk: 0.39 },
    "Argentina":      { baseCases: 10044957,  risk: 0.45 },
    "Netherlands":    { baseCases: 8633885,   risk: 0.43 },
    "Iran":           { baseCases: 7590000,   risk: 0.51 },
    "Mexico":         { baseCases: 7563251,   risk: 0.54 },
    "Indonesia":      { baseCases: 6815141,   risk: 0.49 },
    "Colombia":       { baseCases: 6363086,   risk: 0.48 },
    "Pakistan":       { baseCases: 1574527,   risk: 0.43 },
    "Nigeria":        { baseCases: 267578,    risk: 0.38 },
    "South Africa":   { baseCases: 4071651,   risk: 0.50 },
    "Peru":           { baseCases: 4490835,   risk: 0.51 },
    "Philippines":    { baseCases: 4167000,   risk: 0.46 },
    "Malaysia":       { baseCases: 5013000,   risk: 0.44 },
    "Thailand":       { baseCases: 4700000,   risk: 0.43 },
    "Bangladesh":     { baseCases: 2037000,   risk: 0.41 },
  },
  dengue: {
    "Brazil":         { baseCases: 1456000,  risk: 0.78 },
    "India":          { baseCases: 289427,   risk: 0.71 },
    "Philippines":    { baseCases: 221000,   risk: 0.74 },
    "Vietnam":        { baseCases: 180421,   risk: 0.68 },
    "Colombia":       { baseCases: 123000,   risk: 0.67 },
    "Indonesia":      { baseCases: 324000,   risk: 0.72 },
    "Malaysia":       { baseCases: 98421,    risk: 0.65 },
    "Thailand":       { baseCases: 87234,    risk: 0.64 },
    "Bangladesh":     { baseCases: 101234,   risk: 0.66 },
    "Myanmar":        { baseCases: 51234,    risk: 0.60 },
    "Mexico":         { baseCases: 67234,    risk: 0.58 },
    "Cambodia":       { baseCases: 43234,    risk: 0.61 },
    "Sri Lanka":      { baseCases: 61234,    risk: 0.63 },
    "Pakistan":       { baseCases: 41234,    risk: 0.59 },
    "Peru":           { baseCases: 82345,    risk: 0.65 },
    "Venezuela":      { baseCases: 76234,    risk: 0.66 },
    "Nepal":          { baseCases: 39281,    risk: 0.58 },
    "Laos":           { baseCases: 32100,    risk: 0.57 },
    "Honduras":       { baseCases: 45000,    risk: 0.60 },
    "El Salvador":    { baseCases: 23456,    risk: 0.55 },
  },
  flu: {
    "United States":  { baseCases: 35000000, risk: 0.55 },
    "China":          { baseCases: 28000000, risk: 0.52 },
    "India":          { baseCases: 21000000, risk: 0.50 },
    "Brazil":         { baseCases: 14000000, risk: 0.48 },
    "Russia":         { baseCases: 11000000, risk: 0.47 },
    "Germany":        { baseCases: 8500000,  risk: 0.44 },
    "France":         { baseCases: 7800000,  risk: 0.43 },
    "Japan":          { baseCases: 9200000,  risk: 0.45 },
    "United Kingdom": { baseCases: 6200000,  risk: 0.42 },
    "Australia":      { baseCases: 4500000,  risk: 0.41 },
    "Canada":         { baseCases: 3400000,  risk: 0.40 },
    "Mexico":         { baseCases: 5600000,  risk: 0.46 },
    "Italy":          { baseCases: 4200000,  risk: 0.43 },
    "Spain":          { baseCases: 3800000,  risk: 0.42 },
    "South Korea":    { baseCases: 3100000,  risk: 0.40 },
    "Indonesia":      { baseCases: 9800000,  risk: 0.49 },
    "Pakistan":       { baseCases: 7600000,  risk: 0.48 },
    "Bangladesh":     { baseCases: 6800000,  risk: 0.47 },
    "Nigeria":        { baseCases: 5900000,  risk: 0.46 },
    "Ethiopia":       { baseCases: 4300000,  risk: 0.45 },
  },
  tb: {
    "India":          { baseCases: 2990000,  risk: 0.77 },
    "China":          { baseCases: 780000,   risk: 0.62 },
    "Indonesia":      { baseCases: 969000,   risk: 0.73 },
    "Philippines":    { baseCases: 591000,   risk: 0.68 },
    "Pakistan":       { baseCases: 611000,   risk: 0.69 },
    "Nigeria":        { baseCases: 472000,   risk: 0.66 },
    "Bangladesh":     { baseCases: 375000,   risk: 0.65 },
    "Democratic Republic of the Congo": { baseCases: 340000, risk: 0.64 },
    "Ethiopia":       { baseCases: 294000,   risk: 0.64 },
    "Myanmar":        { baseCases: 175000,   risk: 0.62 },
    "South Africa":   { baseCases: 328000,   risk: 0.66 },
    "Kenya":          { baseCases: 128000,   risk: 0.58 },
    "Mozambique":     { baseCases: 152000,   risk: 0.61 },
    "Uganda":         { baseCases: 87000,    risk: 0.56 },
    "Tanzania":       { baseCases: 139000,   risk: 0.60 },
    "Vietnam":        { baseCases: 172000,   risk: 0.62 },
    "Russia":         { baseCases: 61000,    risk: 0.48 },
    "Brazil":         { baseCases: 68000,    risk: 0.49 },
    "Thailand":       { baseCases: 69000,    risk: 0.50 },
    "Cambodia":       { baseCases: 37000,    risk: 0.52 },
    "Nepal":          { baseCases: 38000,    risk: 0.52 },
    "Zimbabwe":       { baseCases: 23000,    risk: 0.50 },
    "Zambia":         { baseCases: 54000,    risk: 0.55 },
    "Angola":         { baseCases: 64000,    risk: 0.57 },
    "Somalia":        { baseCases: 33000,    risk: 0.54 },
  },
};

// ─── Deterministic seeded pseudo-random (xorshift32) ─────────────────────────
function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s ^= s >> 17; s ^= s << 5;
    return (s >>> 0) / 0xFFFFFFFF;
  };
}

// ─── Historical trend data generator ─────────────────────────────────────────
export function generateTrendData(disease: DiseaseKey, country: string): TrendPoint[] {
  const base = DISEASE_BASES[disease][country];
  if (!base) return [];

  const years = Array.from({ length: 18 }, (_, i) => 2006 + i);
  const data: TrendPoint[] = [];

  // Seed from country + disease string hash for determinism
  const seed = Array.from(country + disease).reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
  const rng = seeded(seed);

  let currentCases = base.baseCases * 0.4;
  const anomalyYears = new Set([
    years[Math.floor(rng() * 6) + 2],
    years[Math.floor(rng() * 6) + 10],
  ]);

  for (const year of years) {
    const trend = 1 + (year - 2006) * 0.02;
    const seasonal = disease === 'malaria' || disease === 'dengue'
      ? 1 + 0.15 * Math.sin((year - 2006) * Math.PI / 3)
      : 1;
    const noise = 0.85 + rng() * 0.3;
    const isAnomaly = anomalyYears.has(year);
    const anomalyMultiplier = isAnomaly ? (rng() > 0.5 ? 2.8 : 0.3) : 1;
    const anomalyType = isAnomaly
      ? (anomalyMultiplier > 1 ? 'numerical' : 'seasonal')
      : undefined;

    currentCases = Math.max(0, base.baseCases * trend * seasonal * noise * anomalyMultiplier);
    data.push({
      year,
      cases: Math.round(currentCases),
      deaths: Math.round(currentCases * (disease === 'malaria' ? 0.0022 : disease === 'tb' ? 0.015 : 0.0008)),
      isAnomaly,
      anomalyType,
    });
  }
  return data;
}

// ─── Globe heatmap data builder ───────────────────────────────────────────────
export function buildGlobeData(disease: DiseaseKey, region?: string): GlobePoint[] {
  const diseaseMap = DISEASE_BASES[disease] || {};
  const points: GlobePoint[] = [];

  for (const [country, coords] of Object.entries(COUNTRY_COORDS)) {
    if (region && region !== 'all' && region !== 'All Regions') {
      if (coords.region.toLowerCase() !== region.toLowerCase()) continue;
    }
    const d = diseaseMap[country];
    if (!d) continue;

    points.push({
      lat: coords.lat,
      lng: coords.lng,
      country,
      iso2: country.substring(0, 2).toUpperCase(),
      risk_score: d.risk,
      cases: d.baseCases,
      deaths: Math.round(d.baseCases * 0.002),
      population: coords.population,
      region: coords.region,
    });
  }
  return points;
}

// ─── Risk scoring ─────────────────────────────────────────────────────────────
export function computeRiskScore(cases: number, population: number, growthRate: number): {
  score: number;
  label: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  isAlarming: boolean;
} {
  const prevalence = cases / population;
  const prevalenceScore = Math.min(40, prevalence * 100000); // per 100k
  const growthScore = Math.min(40, Math.max(0, growthRate * 50));
  const baseScore = Math.min(20, prevalence * 1000000);
  const score = Math.round(Math.min(100, prevalenceScore + growthScore + baseScore));

  let label: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  if (score < 25) label = 'LOW';
  else if (score < 50) label = 'MODERATE';
  else if (score < 75) label = 'HIGH';
  else label = 'CRITICAL';

  return { score, label, isAlarming: score >= 50 };
}

// ─── Spread simulation arcs ───────────────────────────────────────────────────
export function buildSpreadArcs(disease: DiseaseKey, focusCountry?: string, period: 'week' | 'month' | 'year' = 'month'): SpreadArc[] {
  const data = DISEASE_BASES[disease];
  const arcs: SpreadArc[] = [];

  const topCountries = Object.entries(data)
    .sort((a, b) => b[1].risk - a[1].risk)
    .slice(0, focusCountry ? 5 : 12)
    .map(([c]) => c);

  const periodMultiplier = { week: 2, month: 6, year: 15 }[period];

  const sources = focusCountry
    ? [focusCountry, ...topCountries.slice(0, 3)]
    : topCountries.slice(0, 6);

  for (const src of sources) {
    const srcCoords = COUNTRY_COORDS[src];
    if (!srcCoords) continue;
    const srcRisk = data[src]?.risk ?? 0.5;

    const targets = topCountries
      .filter(c => c !== src)
      .slice(0, periodMultiplier)
      .filter((_, fi) => fi % 3 !== 2); // deterministic subset

    for (const tgt of targets) {
      const tgtCoords = COUNTRY_COORDS[tgt];
      if (!tgtCoords) continue;

      const intensity = (srcRisk + (data[tgt]?.risk ?? 0.5)) / 2;
      const color = intensity > 0.75
        ? `rgba(239,68,68,${0.4 + intensity * 0.4})`
        : intensity > 0.5
        ? `rgba(249,115,22,${0.4 + intensity * 0.4})`
        : `rgba(234,179,8,${0.3 + intensity * 0.3})`;

      arcs.push({
        startLat: srcCoords.lat,
        startLng: srcCoords.lng,
        endLat: tgtCoords.lat,
        endLng: tgtCoords.lng,
        color,
        intensity,
      });
    }
  }
  return arcs;
}

// ─── Live backend globe data fetcher ──────────────────────────────────────────
const BACKEND = 'http://localhost:8000';

export async function fetchGlobeData(disease: DiseaseKey, region?: string): Promise<GlobePoint[]> {
  try {
    const url = `${BACKEND}/api/v1/globe/heatmap?disease=${disease}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Backend ${res.status}`);
    const raw: any[] = await res.json();

    // Map backend snake_case → frontend camelCase (already matches GlobePoint)
    const points: GlobePoint[] = raw.map(p => ({
      lat:        p.lat,
      lng:        p.lng,
      country:    p.country,
      iso2:       p.iso2 ?? 'XX',
      risk_score: p.risk_score ?? 0,
      cases:      p.cases ?? 0,
      deaths:     p.deaths ?? 0,
      population: p.population ?? 1_000_000,
      region:     p.region ?? 'Unknown',
    }));

    // Optional region filter (backend doesn't filter by region)
    if (region && region !== 'all' && region !== 'All Regions') {
      return points.filter(p => p.region.toLowerCase() === region.toLowerCase());
    }
    return points;
  } catch {
    // Fallback to client-side mock data when backend is unreachable
    return buildGlobeData(disease, region);
  }
}

// ─── Risk color mapper ─────────────────────────────────────────────────────────
export function getRiskColor(score: number): string {
  if (score < 0.25) return '#22c55e';
  if (score < 0.5)  return '#eab308';
  if (score < 0.75) return '#f97316';
  return '#ef4444';
}

// ─── Disease metadata ──────────────────────────────────────────────────────────
export const DISEASE_META: Record<DiseaseKey, { label: string; color: string; icon: string; source: string }> = {
  covid:   { label: 'COVID-19',  color: '#3b82f6', icon: '🦠', source: 'disease.sh / WHO' },
  malaria: { label: 'Malaria',   color: '#ef4444', icon: '🦟', source: 'WHO GHO / IHME' },
  dengue:  { label: 'Dengue',    color: '#f97316', icon: '🦟', source: 'WHO / ECDC' },
  flu:     { label: 'Influenza', color: '#a855f7', icon: '🤧', source: 'CDC FluView / WHO' },
  tb:      { label: 'Tuberculosis', color: '#eab308', icon: '🫁', source: 'WHO Global TB Report' },
};

export const REGIONS = [
  { value: 'all',          label: 'All Regions' },
  { value: 'Africa',       label: 'Africa' },
  { value: 'Asia',         label: 'Asia' },
  { value: 'Americas',     label: 'Americas' },
  { value: 'Europe',       label: 'Europe' },
  { value: 'Asia-Pacific', label: 'Asia-Pacific' },
];

// ─── Disease Classification (ICD-10/11) ───────────────────────────────────────
export interface DiseaseClassification {
  icd10: string;
  icd11: string;
  fullName: string;
  taxonomy: string[];
  subtypes: { code: string; name: string; desc: string }[];
  mesh: string;
  snomed: string;
  doid: string;
  omim?: string;
}

export const DISEASE_CLASSIFICATION: Record<DiseaseKey, DiseaseClassification> = {
  covid: {
    icd10: 'U07.1', icd11: 'RA01.0',
    fullName: 'COVID-19, virus identified',
    taxonomy: ['Diseases of the respiratory system', 'COVID-19', 'SARS-CoV-2 infection'],
    subtypes: [
      { code: 'U07.1', name: 'COVID-19 (virus identified)', desc: 'Confirmed by lab test' },
      { code: 'U07.2', name: 'COVID-19 (virus not identified)', desc: 'Clinical/epidemiological diagnosis' },
      { code: 'U09.9', name: 'Post-COVID condition', desc: 'Long COVID sequelae' },
      { code: 'U10.9', name: 'MIS-C', desc: 'Multisystem inflammatory syndrome in children' },
    ],
    mesh: 'D000086382', snomed: '840539006', doid: 'DOID:0080600', omim: '—',
  },
  malaria: {
    icd10: 'B54', icd11: '1F40',
    fullName: 'Malaria (unspecified)',
    taxonomy: ['Certain infectious and parasitic diseases', 'Protozoal diseases', 'Malaria'],
    subtypes: [
      { code: 'B50', name: 'P. falciparum malaria', desc: 'Most severe form; cerebral malaria risk' },
      { code: 'B51', name: 'P. vivax malaria', desc: 'Relapsing malaria with dormant hypnozoites' },
      { code: 'B52', name: 'P. malariae malaria', desc: 'Quartan malaria; long incubation' },
      { code: 'B53.1', name: 'P. ovale malaria', desc: 'Mild relapsing malaria' },
    ],
    mesh: 'D008288', snomed: '61462000', doid: 'DOID:12365',
  },
  dengue: {
    icd10: 'A97', icd11: '1D2Z',
    fullName: 'Dengue fever',
    taxonomy: ['Certain infectious and parasitic diseases', 'Viral infections', 'Arboviral diseases', 'Dengue'],
    subtypes: [
      { code: 'A97.0', name: 'Dengue fever (classical)', desc: 'Self-limiting febrile illness' },
      { code: 'A97.1', name: 'Dengue haemorrhagic fever', desc: 'Plasma leakage; thrombocytopenia' },
      { code: 'A97.2', name: 'Severe dengue', desc: 'Organ impairment; shock syndrome' },
    ],
    mesh: 'D003715', snomed: '38362002', doid: 'DOID:12205',
  },
  flu: {
    icd10: 'J11', icd11: '1E32',
    fullName: 'Influenza, virus not identified',
    taxonomy: ['Diseases of the respiratory system', 'Influenza and pneumonia', 'Influenza'],
    subtypes: [
      { code: 'J09', name: 'Influenza A (novel)', desc: 'Novel subtype; pandemic potential' },
      { code: 'J10', name: 'Influenza A/B (identified)', desc: 'Seasonal strains H1N1/H3N2/B' },
      { code: 'J11', name: 'Influenza (unspecified)', desc: 'Clinical diagnosis without lab ID' },
    ],
    mesh: 'D007251', snomed: '6142004', doid: 'DOID:8469',
  },
  tb: {
    icd10: 'A15', icd11: '1B10',
    fullName: 'Respiratory tuberculosis, bacteriologically confirmed',
    taxonomy: ['Certain infectious and parasitic diseases', 'Tuberculosis', 'Pulmonary TB'],
    subtypes: [
      { code: 'A15', name: 'Pulmonary TB (confirmed)', desc: 'Bacteriologically confirmed by sputum/culture' },
      { code: 'A16', name: 'Pulmonary TB (not confirmed)', desc: 'Clinical/radiological diagnosis' },
      { code: 'A17', name: 'TB of nervous system', desc: 'Tuberculous meningitis; encephalitis' },
      { code: 'A19', name: 'Miliary tuberculosis', desc: 'Haematogenous dissemination; high mortality' },
    ],
    mesh: 'D014376', snomed: '56717001', doid: 'DOID:399', omim: '607948',
  },
};

// ─── Genomic Associations ─────────────────────────────────────────────────────
export interface GeneAssociation {
  symbol: string;
  fullName: string;
  evidenceScore: number; // 0–1
  associationType: string;
  source: string;
  omimId?: string;
  chromosome: string;
  function: string;
}

export const DISEASE_GENES: Record<DiseaseKey, GeneAssociation[]> = {
  covid: [
    { symbol: 'ACE2',    fullName: 'Angiotensin Converting Enzyme 2',     evidenceScore: 0.98, associationType: 'Viral entry receptor',    source: 'Open Targets', chromosome: 'Xp22.2',  function: 'SARS-CoV-2 spike binding' },
    { symbol: 'TMPRSS2', fullName: 'Transmembrane Serine Protease 2',     evidenceScore: 0.95, associationType: 'Host protease',           source: 'Open Targets', chromosome: '21q22.3', function: 'Spike protein priming' },
    { symbol: 'TLR7',    fullName: 'Toll-Like Receptor 7',                evidenceScore: 0.87, associationType: 'Innate immunity',         source: 'OMIM',         chromosome: 'Xp22.2',  omimId: '300365', function: 'Viral RNA sensing' },
    { symbol: 'IFITM3',  fullName: 'Interferon Induced Transmembrane Protein 3', evidenceScore: 0.82, associationType: 'Antiviral defense', source: 'GWAS',     chromosome: '11p15.5', function: 'Blocks viral fusion' },
    { symbol: 'OAS1',    fullName: '2\'-5\'-Oligoadenylate Synthetase 1', evidenceScore: 0.79, associationType: 'Interferon pathway',      source: 'GWAS',         chromosome: '12q24.1', function: 'Activates RNase L antiviral' },
    { symbol: 'LZTFL1',  fullName: 'Leucine Zipper Transcription Factor 1',evidenceScore: 0.76, associationType: 'Risk locus',            source: 'GWAS',         chromosome: '3p21.3',  function: 'Severe COVID-19 risk' },
  ],
  malaria: [
    { symbol: 'HBB',   fullName: 'Hemoglobin Subunit Beta',              evidenceScore: 0.97, associationType: 'Protective variant',  source: 'OMIM', chromosome: '11p15.4', omimId: '141900', function: 'Sickle-cell protects against P. falciparum' },
    { symbol: 'G6PD',  fullName: 'Glucose-6-Phosphate Dehydrogenase',   evidenceScore: 0.93, associationType: 'Protective variant',  source: 'OMIM', chromosome: 'Xq28',    omimId: '305900', function: 'G6PD deficiency confers resistance' },
    { symbol: 'DARC',  fullName: 'Duffy Antigen Receptor for Chemokines',evidenceScore: 0.91, associationType: 'Receptor / resistance',source: 'OMIM', chromosome: '1q23.2', omimId: '110700', function: 'P. vivax invasion receptor' },
    { symbol: 'CR1',   fullName: 'Complement Receptor 1',               evidenceScore: 0.85, associationType: 'Susceptibility',     source: 'Open Targets', chromosome: '1q32.2', function: 'Rosetting and cerebral malaria' },
    { symbol: 'FCGR2B',fullName: 'Fc Gamma Receptor IIb',               evidenceScore: 0.78, associationType: 'Immune modulation',  source: 'GWAS', chromosome: '1q23.3', function: 'Antibody-mediated protection' },
    { symbol: 'IL12B', fullName: 'Interleukin 12 Subunit Beta',          evidenceScore: 0.72, associationType: 'Cytokine response', source: 'Open Targets', chromosome: '5q33.3', function: 'Th1 immune polarization' },
  ],
  dengue: [
    { symbol: 'CD209',  fullName: 'CD209 Molecule (DC-SIGN)',            evidenceScore: 0.94, associationType: 'Viral entry receptor',source: 'Open Targets', chromosome: '19p13.2', function: 'Dengue virus attachment to DCs' },
    { symbol: 'PLCE1',  fullName: 'Phospholipase C Epsilon 1',           evidenceScore: 0.86, associationType: 'Vascular permeability',source: 'GWAS',        chromosome: '10q23.3', function: 'DHF plasma leakage mechanism' },
    { symbol: 'STAT4',  fullName: 'Signal Transducer and Activator 4',   evidenceScore: 0.81, associationType: 'Immune response',   source: 'GWAS',         chromosome: '2q32.2',  function: 'IFN-γ production; severe dengue' },
    { symbol: 'MICA',   fullName: 'MHC Class I Polypeptide-Related Seq A',evidenceScore: 0.77, associationType: 'Innate immunity',  source: 'GWAS',         chromosome: '6p21.3',  function: 'NK cell activation' },
    { symbol: 'TNF',    fullName: 'Tumor Necrosis Factor',               evidenceScore: 0.74, associationType: 'Cytokine storm',   source: 'Open Targets', chromosome: '6p21.3',  function: 'Inflammatory cascade in DHF' },
  ],
  flu: [
    { symbol: 'IFITM3', fullName: 'Interferon Induced Transmembrane Protein 3', evidenceScore: 0.93, associationType: 'Severe disease risk', source: 'GWAS', chromosome: '11p15.5', function: 'Restricts influenza replication' },
    { symbol: 'TMPRSS2',fullName: 'Transmembrane Serine Protease 2',     evidenceScore: 0.88, associationType: 'Host protease',    source: 'Open Targets', chromosome: '21q22.3', function: 'HA cleavage for cell entry' },
    { symbol: 'MX1',    fullName: 'MX Dynamin-Like GTPase 1',           evidenceScore: 0.85, associationType: 'Antiviral defense',source: 'Open Targets', chromosome: '21q22.3', function: 'Interferon-induced viral restriction' },
    { symbol: 'IRF7',   fullName: 'Interferon Regulatory Factor 7',     evidenceScore: 0.80, associationType: 'Innate antiviral', source: 'OMIM',         chromosome: '11p15.5', omimId: '605047', function: 'Master regulator of type I IFN' },
    { symbol: 'FCGR2A', fullName: 'Fc Gamma Receptor IIa',              evidenceScore: 0.72, associationType: 'Antibody response',source: 'GWAS',         chromosome: '1q23.3',  function: 'Influenza-specific Ab binding' },
  ],
  tb: [
    { symbol: 'SLC11A1',fullName: 'Solute Carrier Family 11 Member 1',  evidenceScore: 0.95, associationType: 'Macrophage resistance', source: 'OMIM', chromosome: '2q35',    omimId: '600266', function: 'Phagocyte iron transport; TB susceptibility' },
    { symbol: 'HLA-DRB1',fullName: 'HLA Class II Histocompatibility DR Beta 1',evidenceScore: 0.90, associationType: 'Immune presentation', source: 'OMIM', chromosome: '6p21.3', omimId: '142857', function: 'MHC-II TB antigen presentation' },
    { symbol: 'VDR',    fullName: 'Vitamin D Receptor',                 evidenceScore: 0.86, associationType: 'Immune modulation', source: 'Open Targets', chromosome: '12q13.1', function: 'Vitamin D–mediated TB defense' },
    { symbol: 'IL12B',  fullName: 'Interleukin 12 Subunit Beta',        evidenceScore: 0.82, associationType: 'Cytokine deficiency',source: 'OMIM',        chromosome: '5q33.3',  omimId: '161561', function: 'IL-12 pathway; Mendelian susceptibility' },
    { symbol: 'IRGM',   fullName: 'Immunity Related GTPase M',          evidenceScore: 0.78, associationType: 'Autophagy',         source: 'GWAS',         chromosome: '5q33.1',  function: 'Mycobacterial autophagy clearance' },
    { symbol: 'NOD2',   fullName: 'Nucleotide Binding Oligomerization 2',evidenceScore: 0.73, associationType: 'Pattern recognition',source: 'Open Targets', chromosome: '16q12.1', function: 'Innate sensing of mycobacterial MDP' },
  ],
};

// ─── Therapeutic / Drug Data ──────────────────────────────────────────────────
export interface DrugInfo {
  name: string;
  genericName: string;
  mechanism: string;
  whoEssential: boolean;
  line: 'First' | 'Second' | 'Third';
  pubchemCID: number;
  approvedYear: number;
  route: string;
}

export const DISEASE_DRUGS: Record<DiseaseKey, DrugInfo[]> = {
  covid: [
    { name: 'Paxlovid (Nirmatrelvir/Ritonavir)', genericName: 'Nirmatrelvir',  mechanism: '3CL protease inhibitor — blocks viral polyprotein cleavage',          whoEssential: false, line: 'First',  pubchemCID: 145996610, approvedYear: 2021, route: 'Oral' },
    { name: 'Remdesivir',                         genericName: 'Remdesivir',    mechanism: 'RNA-dependent RNA polymerase inhibitor — premature chain termination', whoEssential: false, line: 'First',  pubchemCID: 121304016, approvedYear: 2020, route: 'IV Infusion' },
    { name: 'Dexamethasone',                      genericName: 'Dexamethasone', mechanism: 'Corticosteroid — suppresses cytokine storm and inflammation',           whoEssential: true,  line: 'First',  pubchemCID: 5743,      approvedYear: 1958, route: 'IV / Oral' },
    { name: 'Molnupiravir',                       genericName: 'Molnupiravir',  mechanism: 'Nucleoside analogue — induces RNA mutagenesis in replicating virus',    whoEssential: false, line: 'Second', pubchemCID: 2761788,   approvedYear: 2021, route: 'Oral' },
    { name: 'Tocilizumab',                        genericName: 'Tocilizumab',   mechanism: 'IL-6 receptor antagonist — reduces hyperinflammation in severe disease', whoEssential: false, line: 'Second', pubchemCID: 0,        approvedYear: 2021, route: 'IV Infusion' },
  ],
  malaria: [
    { name: 'Artemether-Lumefantrine', genericName: 'Artemether/Lumefantrine', mechanism: 'Artemisinin derivative + blood schizonticide — rapidly clears parasitemia', whoEssential: true, line: 'First',  pubchemCID: 68911,   approvedYear: 1999, route: 'Oral' },
    { name: 'Artesunate (IV)',          genericName: 'Artesunate',              mechanism: 'Artemisinin analogue — rapid parasite killing; preferred for severe malaria', whoEssential: true, line: 'First',  pubchemCID: 5490342, approvedYear: 2007, route: 'IV/IM' },
    { name: 'Chloroquine',             genericName: 'Chloroquine',             mechanism: 'Heme polymerization inhibitor — accumulates in parasite food vacuole',       whoEssential: true, line: 'First',  pubchemCID: 2719,    approvedYear: 1947, route: 'Oral' },
    { name: 'Primaquine',              genericName: 'Primaquine',              mechanism: '8-aminoquinoline — eliminates hypnozoites; radical cure of P. vivax',        whoEssential: true, line: 'Second', pubchemCID: 4908,    approvedYear: 1952, route: 'Oral' },
    { name: 'Quinine + Doxycycline',   genericName: 'Quinine sulfate',         mechanism: 'Alkaloid schizonticide + protein synthesis inhibitor synergy',              whoEssential: true, line: 'Second', pubchemCID: 3034034, approvedYear: 1944, route: 'Oral' },
  ],
  dengue: [
    { name: 'Dengvaxia (Vaccine)',     genericName: 'CYD-TDV',              mechanism: 'Tetravalent live attenuated chimeric vaccine — activates humoral immunity',   whoEssential: false, line: 'First',  pubchemCID: 0,     approvedYear: 2015, route: 'Subcutaneous' },
    { name: 'Paracetamol',            genericName: 'Acetaminophen',         mechanism: 'COX inhibitor — antipyretic; preferred over NSAIDs to avoid bleeding risk',   whoEssential: true,  line: 'First',  pubchemCID: 1983,  approvedYear: 1955, route: 'Oral' },
    { name: 'IV Fluid Resuscitation', genericName: 'Crystalloid / Colloid',  mechanism: 'Plasma volume replacement — counteracts vascular leakage in DHF',           whoEssential: true,  line: 'First',  pubchemCID: 0,     approvedYear: 1960, route: 'IV Infusion' },
    { name: 'Ibuprofen (AVOID)',       genericName: 'Ibuprofen',             mechanism: 'NSAID — CONTRAINDICATED in dengue; increases hemorrhage risk',               whoEssential: false, line: 'Third',  pubchemCID: 3672,  approvedYear: 1961, route: 'Oral (avoided)' },
  ],
  flu: [
    { name: 'Oseltamivir (Tamiflu)',  genericName: 'Oseltamivir',  mechanism: 'Neuraminidase inhibitor — prevents viral release and spread between cells',           whoEssential: true,  line: 'First',  pubchemCID: 65028,   approvedYear: 1999, route: 'Oral' },
    { name: 'Zanamivir (Relenza)',    genericName: 'Zanamivir',    mechanism: 'Inhaled neuraminidase inhibitor — high local concentration in respiratory tract',     whoEssential: false, line: 'First',  pubchemCID: 60855,   approvedYear: 1999, route: 'Inhaled' },
    { name: 'Baloxavir Marboxil',     genericName: 'Baloxavir',    mechanism: 'Cap-dependent endonuclease inhibitor — blocks viral mRNA synthesis',                  whoEssential: false, line: 'First',  pubchemCID: 49803313,approvedYear: 2018, route: 'Oral' },
    { name: 'Peramivir',              genericName: 'Peramivir',    mechanism: 'IV neuraminidase inhibitor — for hospitalized patients unable to take oral drugs',    whoEssential: false, line: 'Second', pubchemCID: 154234,  approvedYear: 2014, route: 'IV Infusion' },
  ],
  tb: [
    { name: 'Isoniazid (H)',           genericName: 'Isoniazid',    mechanism: 'Inhibits mycolic acid synthesis — bactericidal against actively dividing mycobacteria', whoEssential: true, line: 'First',  pubchemCID: 3767,  approvedYear: 1952, route: 'Oral/IM' },
    { name: 'Rifampicin (R)',          genericName: 'Rifampicin',   mechanism: 'RNA polymerase inhibitor — inhibits bacterial transcription initiation',              whoEssential: true, line: 'First',  pubchemCID: 5360416,approvedYear: 1967, route: 'Oral' },
    { name: 'Pyrazinamide (Z)',        genericName: 'Pyrazinamide', mechanism: 'Disrupts membrane potential — bactericidal in acidic environment of macrophages',    whoEssential: true, line: 'First',  pubchemCID: 1046,  approvedYear: 1954, route: 'Oral' },
    { name: 'Ethambutol (E)',          genericName: 'Ethambutol',   mechanism: 'Arabinogalactan synthesis inhibitor — prevents cell wall assembly',                  whoEssential: true, line: 'First',  pubchemCID: 14052, approvedYear: 1961, route: 'Oral' },
    { name: 'Bedaquiline',             genericName: 'Bedaquiline',  mechanism: 'ATP synthase inhibitor — bactericidal for drug-resistant TB strains',               whoEssential: true, line: 'Second', pubchemCID: 5388906,approvedYear: 2012, route: 'Oral' },
    { name: 'Linezolid',              genericName: 'Linezolid',    mechanism: 'Ribosomal 23S rRNA binding — inhibits protein synthesis in XDR-TB',                whoEssential: false, line: 'Second', pubchemCID: 441401, approvedYear: 2000, route: 'Oral/IV' },
  ],
};
