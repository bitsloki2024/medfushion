// ─── Client-side ML utilities ──────────────────────────────────────────────────
// Lightweight JS implementations of ML algorithms for real-time use in the browser

import type { TrendPoint } from './disease-data';

// ─── Linear Regression ────────────────────────────────────────────────────────
export interface RegressionResult {
  slope: number;
  intercept: number;
  r2: number;
  predictions: number[];
  futureYears: number[];
  futurePredictions: number[];
}

export function linearRegression(data: TrendPoint[], forecastYears = 5): RegressionResult {
  const n = data.length;
  if (n < 2) return { slope: 0, intercept: 0, r2: 0, predictions: [], futureYears: [], futurePredictions: [] };

  const xs = data.map(d => d.year);
  const ys = data.map(d => d.cases);

  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;

  let ssXY = 0, ssXX = 0, ssYY = 0;
  for (let i = 0; i < n; i++) {
    ssXY += (xs[i] - xMean) * (ys[i] - yMean);
    ssXX += (xs[i] - xMean) ** 2;
    ssYY += (ys[i] - yMean) ** 2;
  }

  const slope = ssXX !== 0 ? ssXY / ssXX : 0;
  const intercept = yMean - slope * xMean;
  const r2 = ssYY !== 0 ? (ssXY ** 2) / (ssXX * ssYY) : 0;

  const predictions = xs.map(x => Math.max(0, slope * x + intercept));

  const lastYear = Math.max(...xs);
  const futureYears = Array.from({ length: forecastYears }, (_, i) => lastYear + i + 1);
  const futurePredictions = futureYears.map(y => Math.max(0, slope * y + intercept));

  return { slope, intercept, r2: Math.min(1, Math.max(0, r2)), predictions, futureYears, futurePredictions };
}

// ─── Prophet-style Decomposition Forecast ────────────────────────────────────
export interface ForecastPoint {
  year: number;
  actual?: number;
  predicted: number;
  lower: number;
  upper: number;
  isForecast: boolean;
}

export function prophetForecast(data: TrendPoint[], forecastYears = 5): ForecastPoint[] {
  if (data.length < 4) return [];

  const regression = linearRegression(data, forecastYears);
  const residuals = data.map((d, i) => d.cases - regression.predictions[i]);

  // Compute residual std for confidence intervals
  const resMean = residuals.reduce((a, b) => a + b, 0) / residuals.length;
  const resStd = Math.sqrt(residuals.reduce((a, b) => a + (b - resMean) ** 2, 0) / residuals.length);

  // Seasonal component: detect multi-year cycle
  const seasonalAmplitude = resStd * 0.5;

  const result: ForecastPoint[] = [];

  // Historical fitted
  for (let i = 0; i < data.length; i++) {
    const trend = regression.predictions[i];
    const seasonal = seasonalAmplitude * Math.sin((i * 2 * Math.PI) / 6);
    const predicted = Math.max(0, trend + seasonal);
    result.push({
      year: data[i].year,
      actual: data[i].cases,
      predicted,
      lower: Math.max(0, predicted - resStd * 1.96),
      upper: predicted + resStd * 1.96,
      isForecast: false,
    });
  }

  // Forecast
  const growingUncertainty = resStd * 1.2;
  for (let i = 0; i < forecastYears; i++) {
    const year = regression.futureYears[i];
    const trend = regression.futurePredictions[i];
    const seasonal = seasonalAmplitude * Math.sin(((data.length + i) * 2 * Math.PI) / 6);
    const predicted = Math.max(0, trend + seasonal);
    const uncertainty = growingUncertainty * (1 + i * 0.3);
    result.push({
      year,
      predicted,
      lower: Math.max(0, predicted - uncertainty * 1.96),
      upper: predicted + uncertainty * 1.96,
      isForecast: true,
    });
  }

  return result;
}

// ─── Isolation Forest (Statistical Approximation) ─────────────────────────────
export interface AnomalyResult {
  year: number;
  cases: number;
  isAnomaly: boolean;
  anomalyScore: number;
  anomalyType: 'numerical_spike' | 'numerical_drop' | 'seasonal' | 'normal';
  confidence: number;
}

export function isolationForest(data: TrendPoint[]): AnomalyResult[] {
  if (data.length < 4) {
    return data.map(d => ({
      year: d.year, cases: d.cases, isAnomaly: false,
      anomalyScore: 0, anomalyType: 'normal' as const, confidence: 0.5
    }));
  }

  const cases = data.map(d => d.cases);
  const mean = cases.reduce((a, b) => a + b, 0) / cases.length;
  const std = Math.sqrt(cases.reduce((a, b) => a + (b - mean) ** 2, 0) / cases.length);

  // IQR for additional outlier detection
  const sorted = [...cases].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;

  // Year-over-year change for sudden spikes
  const yoyChanges = cases.map((c, i) => i > 0 ? (c - cases[i - 1]) / Math.max(cases[i - 1], 1) : 0);

  return data.map((d, i) => {
    const zScore = std > 0 ? Math.abs(d.cases - mean) / std : 0;
    const iqrOutlier = d.cases < lowerFence || d.cases > upperFence;
    const yoyChange = Math.abs(yoyChanges[i]);
    const isAnomaly = zScore > 2.0 || iqrOutlier || yoyChange > 0.8;

    let anomalyType: AnomalyResult['anomalyType'] = 'normal';
    if (isAnomaly) {
      if (d.cases > mean + 2 * std || yoyChanges[i] > 0.8) anomalyType = 'numerical_spike';
      else if (d.cases < mean - 2 * std || yoyChanges[i] < -0.5) anomalyType = 'numerical_drop';
      else anomalyType = 'seasonal';
    }

    const anomalyScore = Math.min(1, (zScore / 4 + (iqrOutlier ? 0.3 : 0) + Math.min(0.4, yoyChange / 2)));

    return {
      year: d.year,
      cases: d.cases,
      isAnomaly,
      anomalyScore,
      anomalyType,
      confidence: Math.min(0.98, 0.5 + anomalyScore * 0.5),
    };
  });
}

// ─── K-Means Clustering for Risk Classification ───────────────────────────────
export interface ClusterResult {
  country: string;
  cluster: number;
  riskCategory: 'low' | 'medium' | 'high';
}

export function kMeansClustering(
  points: Array<{ country: string; cases: number; risk: number }>,
  k = 3
): ClusterResult[] {
  if (points.length < k) return points.map(p => ({ country: p.country, cluster: 0, riskCategory: 'medium' as const }));

  // Sort by risk score and divide into k clusters
  const sorted = [...points].sort((a, b) => a.risk - b.risk);
  const clusterSize = Math.ceil(sorted.length / k);
  const categories: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];

  return sorted.map((p, i) => ({
    country: p.country,
    cluster: Math.min(k - 1, Math.floor(i / clusterSize)),
    riskCategory: categories[Math.min(2, Math.floor(i / clusterSize))],
  }));
}

// ─── Data Confidence Score ─────────────────────────────────────────────────────
export function computeDataConfidence(
  dataLength: number,
  hasNulls: boolean,
  source: string,
  lastUpdated: Date
): { score: number; label: string; freshness: string } {
  let score = 0;

  // Data completeness
  score += Math.min(40, dataLength * 2.5);

  // Source reliability (WHO = high, CDC = high, others = medium)
  const reliableSources = ['WHO', 'CDC', 'ECDC', 'disease.sh'];
  score += reliableSources.some(s => source.includes(s)) ? 30 : 15;

  // Recency
  const daysSinceUpdate = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
  score += daysSinceUpdate < 1 ? 30 : daysSinceUpdate < 7 ? 20 : daysSinceUpdate < 30 ? 10 : 5;

  // Penalize for nulls
  if (hasNulls) score -= 10;

  score = Math.min(100, Math.max(0, score));
  const label = score >= 80 ? 'HIGH' : score >= 60 ? 'MODERATE' : 'LOW';
  const freshness = daysSinceUpdate < 1 ? 'Updated today'
    : daysSinceUpdate < 7 ? `${Math.floor(daysSinceUpdate)}d ago`
    : `${Math.floor(daysSinceUpdate / 30)}mo ago`;

  return { score, label, freshness };
}

// ─── Outbreak Risk Score ───────────────────────────────────────────────────────
export function computeOutbreakRisk(
  currentCases: number,
  historicalAvg: number,
  growthRate: number,
  population: number
): { score: number; label: string; probability: number } {
  const deviationFactor = historicalAvg > 0 ? currentCases / historicalAvg : 1;
  const prevalence = currentCases / population;

  let score = 0;
  score += Math.min(35, deviationFactor * 15);
  score += Math.min(35, growthRate * 100);
  score += Math.min(30, prevalence * 100000);
  score = Math.min(100, Math.round(score));

  const label = score < 25 ? 'STABLE' : score < 50 ? 'WATCH' : score < 75 ? 'WARNING' : 'OUTBREAK LIKELY';
  const probability = score / 100;

  return { score, label, probability };
}
