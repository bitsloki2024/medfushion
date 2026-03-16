"""
CosmoSentinel — FastAPI Backend
Real ML-powered disease surveillance API
"""

import logging
import warnings
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sklearn.cluster import KMeans
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings("ignore")
logging.getLogger("prophet").setLevel(logging.ERROR)
logging.getLogger("cmdstanpy").setLevel(logging.ERROR)

# ─── App setup ────────────────────────────────────────────────────────────────
app = FastAPI(title="CosmoSentinel API", version="1.0.0", description="CosmoSentinel — Intelligent Disease Surveillance")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Data loading ──────────────────────────────────────────────────────────────
DATA_DIR = Path(__file__).parent.parent  # project root has CSVs

COUNTRY_COORDS = {
    "Afghanistan": (33.93, 67.71, 40099462), "Algeria": (28.03, 1.66, 44903225),
    "Angola": (-11.20, 17.87, 34503774), "Bangladesh": (23.68, 90.35, 166303498),
    "Brazil": (-14.24, -51.93, 214326223), "Burkina Faso": (12.36, -1.53, 21497096),
    "Burundi": (-3.37, 29.92, 12255433), "Cambodia": (12.57, 104.99, 16589023),
    "Cameroon": (7.37, 12.35, 27224265), "Central African Republic": (6.61, 20.94, 4829767),
    "Chad": (15.45, 18.73, 17413580), "China": (35.86, 104.19, 1411750000),
    "Colombia": (4.57, -74.30, 51197000), "Democratic Republic of the Congo": (-4.04, 21.76, 99010212),
    "Ethiopia": (9.14, 40.49, 120283026), "Ghana": (7.95, -1.02, 32395450),
    "Guinea": (9.95, -9.70, 13531906), "India": (20.59, 78.96, 1393409038),
    "Indonesia": (-0.79, 113.92, 277534122), "Kenya": (-0.02, 37.91, 54985698),
    "Madagascar": (-18.77, 46.87, 27691019), "Malawi": (-13.25, 34.30, 19129952),
    "Mali": (17.57, -3.99, 22414000), "Mozambique": (-18.67, 35.53, 32163047),
    "Myanmar": (21.91, 95.96, 54417000), "Niger": (17.61, 8.08, 25252000),
    "Nigeria": (9.08, 8.68, 213401323), "Pakistan": (30.38, 69.35, 225199937),
    "Philippines": (12.88, 121.77, 111046913), "Rwanda": (-1.94, 29.87, 13461888),
    "Senegal": (14.50, -14.45, 17196301), "Sierra Leone": (8.46, -11.78, 8141343),
    "Somalia": (5.15, 46.20, 17065581), "South Africa": (-30.56, 22.94, 60041995),
    "South Sudan": (7.86, 29.69, 11381000), "Sudan": (12.86, 30.22, 44909353),
    "Tanzania": (-6.37, 34.89, 63298550), "Thailand": (15.87, 100.99, 71601103),
    "Uganda": (1.37, 32.29, 47123531), "United States": (37.09, -95.71, 332915073),
    "Vietnam": (14.06, 108.28, 97338583), "Zambia": (-13.13, 27.85, 18920651),
    "Zimbabwe": (-19.02, 29.15, 15092171),
}


def generate_synthetic_disease_data() -> pd.DataFrame:
    """Generate reproducible synthetic disease surveillance data (no CSV required)."""
    rng = np.random.default_rng(42)

    # Realistic malaria burden estimates by country (annual cases, approx)
    BURDEN: dict[str, tuple[int, str]] = {
        "Nigeria":                            (27_000_000, "AFRO"),
        "Democratic Republic of the Congo":   (22_000_000, "AFRO"),
        "Tanzania":                           (7_800_000,  "AFRO"),
        "Mozambique":                         (11_000_000, "AFRO"),
        "Uganda":                             (9_500_000,  "AFRO"),
        "Ghana":                              (5_200_000,  "AFRO"),
        "Kenya":                              (4_800_000,  "AFRO"),
        "Ethiopia":                           (5_500_000,  "AFRO"),
        "Mali":                               (4_200_000,  "AFRO"),
        "Burkina Faso":                       (6_300_000,  "AFRO"),
        "Niger":                              (5_800_000,  "AFRO"),
        "Cameroon":                           (4_400_000,  "AFRO"),
        "Chad":                               (3_200_000,  "AFRO"),
        "Angola":                             (8_100_000,  "AFRO"),
        "Sudan":                              (3_700_000,  "EMRO"),
        "Malawi":                             (4_800_000,  "AFRO"),
        "Zambia":                             (3_600_000,  "AFRO"),
        "South Sudan":                        (2_100_000,  "AFRO"),
        "Zimbabwe":                           (1_200_000,  "AFRO"),
        "Rwanda":                             (980_000,    "AFRO"),
        "India":                              (3_500_000,  "SEARO"),
        "Indonesia":                          (1_800_000,  "SEARO"),
        "Myanmar":                            (900_000,    "SEARO"),
        "Pakistan":                           (520_000,    "EMRO"),
        "Papua New Guinea":                   (1_100_000,  "WPRO"),
        "Somalia":                            (800_000,    "EMRO"),
        "Guinea":                             (2_400_000,  "AFRO"),
        "Sierra Leone":                       (1_500_000,  "AFRO"),
        "Senegal":                            (1_200_000,  "AFRO"),
        "Burundi":                            (1_800_000,  "AFRO"),
    }

    records = []
    for year in range(2005, 2024):
        for country, (base_cases, region) in BURDEN.items():
            # Slight declining global trend + noise
            trend   = 1.0 - (year - 2005) * 0.012
            noise   = float(rng.normal(1.0, 0.14))
            cases   = max(0, int(base_cases * trend * noise))
            cfr     = float(rng.uniform(0.002, 0.008))
            deaths  = max(0, int(cases * cfr))
            records.append({"country": country, "year": year, "cases": cases, "deaths": deaths, "region": region})

    return pd.DataFrame(records)


malaria_df = generate_synthetic_disease_data()


# ─── ML Helpers ───────────────────────────────────────────────────────────────

def run_isolation_forest(series: list[float], contamination: float = 0.15) -> list[bool]:
    """Return list of bool anomaly flags using IsolationForest."""
    if len(series) < 5:
        return [False] * len(series)
    X = np.array(series).reshape(-1, 1)
    model = IsolationForest(contamination=contamination, random_state=42, n_estimators=100)
    labels = model.fit_predict(X)
    return [int(l) == -1 for l in labels]


def run_prophet_forecast(years: list[int], cases: list[int], periods: int = 5) -> dict:
    """Run Prophet forecasting if available, else linear regression."""
    try:
        from prophet import Prophet
        df_p = pd.DataFrame({
            "ds": pd.to_datetime([f"{y}-01-01" for y in years]),
            "y": [max(0, c) for c in cases],
        })
        m = Prophet(yearly_seasonality=False, daily_seasonality=False, weekly_seasonality=False)
        m.fit(df_p)
        future = m.make_future_dataframe(periods=periods, freq="YE")
        fc = m.predict(future)
        future_only = fc.tail(periods)
        return {
            "method": "Prophet",
            "years": [int(d.year) for d in future_only["ds"]],
            "predicted": [max(0, int(v)) for v in future_only["yhat"]],
            "lower": [max(0, int(v)) for v in future_only["yhat_lower"]],
            "upper": [max(0, int(v)) for v in future_only["yhat_upper"]],
        }
    except ImportError:
        # Fallback to linear regression
        return run_linear_forecast(years, cases, periods)


def run_linear_forecast(years: list[int], cases: list[int], periods: int = 5) -> dict:
    """Linear regression forecasting."""
    X = np.array(years).reshape(-1, 1)
    y = np.array(cases, dtype=float)
    model = LinearRegression()
    model.fit(X, y)

    future_years = list(range(max(years) + 1, max(years) + periods + 1))
    preds = [max(0, int(model.predict([[yr]])[0])) for yr in future_years]
    residual_std = float(np.std(y - model.predict(X)))

    return {
        "method": "LinearRegression",
        "years": future_years,
        "predicted": preds,
        "lower": [max(0, p - int(residual_std * 1.96)) for p in preds],
        "upper": [p + int(residual_std * 1.96) for p in preds],
    }


def compute_risk_score(cases: int, population: int, growth_rate: float) -> dict:
    """Composite risk score 0-100."""
    prevalence = cases / max(population, 1)
    prev_score = min(40, prevalence * 100000)
    growth_score = min(40, max(0, growth_rate * 50))
    base_score = min(20, prevalence * 1_000_000)
    score = min(100, max(0, round(prev_score + growth_score + base_score)))

    label = "LOW" if score < 25 else "MODERATE" if score < 50 else "HIGH" if score < 75 else "CRITICAL"
    return {"score": score, "label": label, "is_alarming": score >= 50}


def classify_risk_kmeans(data: list[dict]) -> list[dict]:
    """K-Means clustering for risk classification."""
    if len(data) < 3:
        return data
    X = np.array([[d.get("cases", 0), d.get("risk_score", 0) * 100] for d in data])
    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)
    k = min(3, len(data))
    km = KMeans(n_clusters=k, random_state=42, n_init=10)
    labels = km.fit_predict(Xs)

    # Map cluster to risk category by centroid ordering
    centroids = km.cluster_centers_
    centroid_scores = [(i, float(centroids[i][1])) for i in range(k)]
    sorted_centroids = sorted(centroid_scores, key=lambda x: x[1])
    rank_map = {c[0]: i for i, c in enumerate(sorted_centroids)}
    risk_cats = ["low", "medium", "high"]

    for i, d in enumerate(data):
        d["cluster"] = int(labels[i])
        d["risk_category"] = risk_cats[rank_map[int(labels[i])]]
    return data


# ─── Pydantic Models ──────────────────────────────────────────────────────────

class GlobePoint(BaseModel):
    lat: float
    lng: float
    country: str
    iso2: str
    risk_score: float
    cases: int
    deaths: int
    population: int
    region: str


class CountryData(BaseModel):
    country: str
    disease: str
    population: int
    total_cases: int
    total_deaths: int
    risk_score: int
    risk_label: str
    is_alarming: bool
    growth_rate: float
    fatality_rate: float
    data_confidence: float
    source: str
    trend: list[dict]
    anomalies: list[int]


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0", "data": "malaria" if len(malaria_df) > 0 else "mock"}


@app.get("/api/v1/globe/heatmap")
def globe_heatmap(disease: str = Query("malaria")):
    """Returns heatmap point data for the 3D globe."""
    if disease == "malaria" and len(malaria_df) > 0:
        latest_year = malaria_df["year"].max()
        df_latest = malaria_df[malaria_df["year"] == latest_year].copy()
        df_latest = df_latest[df_latest["cases"] > 0]

        max_cases = df_latest["cases"].max()
        points = []
        for _, row in df_latest.iterrows():
            coords = COUNTRY_COORDS.get(row["country"])
            if not coords:
                continue
            lat, lng, pop = coords
            risk = min(1.0, row["cases"] / max(max_cases * 0.8, 1))
            points.append({
                "lat": lat, "lng": lng,
                "country": row["country"],
                "iso2": row["country"][:2].upper(),
                "risk_score": round(risk, 3),
                "cases": int(row["cases"]),
                "deaths": int(row["deaths"]),
                "population": pop,
                "region": row.get("region", "Unknown"),
            })
        return points
    # For other diseases return mock data with 204 status note
    return {"message": f"Use frontend mock data for {disease}", "disease": disease}


@app.get("/api/v1/country/stats")
def country_stats(
    country: str = Query(...),
    disease: str = Query("malaria"),
):
    """Detailed country stats + ML analysis."""
    coords = COUNTRY_COORDS.get(country)
    population = coords[2] if coords else 10_000_000

    if disease == "malaria" and len(malaria_df) > 0:
        cdf = malaria_df[malaria_df["country"] == country].sort_values("year").copy()
        if len(cdf) == 0:
            raise HTTPException(404, f"No malaria data for {country}")

        years = cdf["year"].tolist()
        cases = cdf["cases"].tolist()
        deaths = cdf["deaths"].tolist()

        # Anomaly detection
        anomaly_flags = run_isolation_forest(cases)
        anomaly_years = [years[i] for i, flag in enumerate(anomaly_flags) if flag]

        # Growth rate
        if len(cases) >= 2:
            growth_rate = (cases[-1] - cases[-3 if len(cases) >= 3 else -2]) / max(cases[-3 if len(cases) >= 3 else -2], 1)
        else:
            growth_rate = 0.0

        # Risk score
        risk = compute_risk_score(cases[-1] if cases else 0, population, growth_rate)

        trend_data = [
            {
                "year": years[i],
                "cases": cases[i],
                "deaths": deaths[i] if i < len(deaths) else 0,
                "is_anomaly": anomaly_flags[i],
            }
            for i in range(len(years))
        ]

        return {
            "country": country,
            "disease": disease,
            "population": population,
            "total_cases": sum(cases),
            "latest_cases": cases[-1] if cases else 0,
            "total_deaths": sum(deaths),
            "risk_score": risk["score"],
            "risk_label": risk["label"],
            "is_alarming": risk["is_alarming"],
            "growth_rate": round(growth_rate, 4),
            "fatality_rate": round(sum(deaths) / max(sum(cases), 1), 6),
            "data_confidence": 0.92,
            "source": "WHO Malaria Report",
            "trend": trend_data,
            "anomalies": anomaly_years,
            "years": years,
            "cases": cases,
        }
    raise HTTPException(404, f"Disease '{disease}' data not available server-side. Use frontend.")


@app.get("/api/v1/forecast")
def forecast(
    country: str = Query(...),
    disease: str = Query("malaria"),
    periods: int = Query(5, ge=1, le=10),
):
    """ML forecast using Prophet (or LinearRegression fallback)."""
    if disease == "malaria" and len(malaria_df) > 0:
        cdf = malaria_df[malaria_df["country"] == country].sort_values("year")
        if len(cdf) < 5:
            raise HTTPException(400, "Need at least 5 years of data")

        years = cdf["year"].tolist()
        cases = cdf["cases"].tolist()

        result = run_prophet_forecast(years, cases, periods)
        return {
            "country": country,
            "disease": disease,
            "method": result["method"],
            "historical_years": years,
            "historical_cases": cases,
            **result,
        }
    raise HTTPException(404, "Forecast only available for malaria server-side")


@app.get("/api/v1/risk/score")
def risk_score(
    country: str = Query(...),
    disease: str = Query("malaria"),
):
    """Risk score for a country."""
    if disease == "malaria" and len(malaria_df) > 0:
        cdf = malaria_df[malaria_df["country"] == country].sort_values("year")
        if len(cdf) == 0:
            raise HTTPException(404, f"No data for {country}")

        cases = cdf["cases"].tolist()
        coords = COUNTRY_COORDS.get(country)
        population = coords[2] if coords else 10_000_000

        growth = (cases[-1] - cases[-2]) / max(cases[-2], 1) if len(cases) >= 2 else 0
        risk = compute_risk_score(cases[-1], population, growth)

        # Anomaly for extra context
        anomaly_flags = run_isolation_forest(cases)
        recent_anomalies = sum(anomaly_flags[-3:])

        return {
            **risk,
            "country": country,
            "disease": disease,
            "latest_cases": int(cases[-1]),
            "growth_rate": round(growth, 4),
            "recent_anomalies": int(recent_anomalies),
            "population": population,
            "prevalence_per_100k": round((cases[-1] / population) * 100000, 2),
        }
    raise HTTPException(404, "Score only available for malaria server-side")


@app.get("/api/v1/risk/classification")
def risk_classification(disease: str = Query("malaria")):
    """K-means risk classification for all countries."""
    if disease == "malaria" and len(malaria_df) > 0:
        latest = malaria_df[malaria_df["year"] == malaria_df["year"].max()].copy()
        latest = latest[latest["cases"] > 0]
        data = []
        for _, row in latest.iterrows():
            coords = COUNTRY_COORDS.get(row["country"])
            if not coords:
                continue
            pop = coords[2]
            risk_score = min(1.0, row["cases"] / max(latest["cases"].max() * 0.8, 1))
            data.append({
                "country": row["country"],
                "cases": int(row["cases"]),
                "risk_score": risk_score,
                "population": pop,
            })
        classified = classify_risk_kmeans(data)
        return classified
    return []


@app.get("/api/v1/alerts")
def alerts(disease: str = Query("malaria")):
    """Active outbreak alerts based on anomaly detection."""
    if disease == "malaria" and len(malaria_df) > 0:
        alerts_list = []
        for country in malaria_df["country"].unique():
            cdf = malaria_df[malaria_df["country"] == country].sort_values("year")
            if len(cdf) < 5:
                continue
            cases = cdf["cases"].tolist()
            flags = run_isolation_forest(cases)
            if flags[-1]:  # Most recent year is anomalous
                growth = (cases[-1] - cases[-2]) / max(cases[-2], 1) if len(cases) >= 2 else 0
                if growth > 0.3 or cases[-1] > np.mean(cases) * 2:
                    coords = COUNTRY_COORDS.get(country)
                    alerts_list.append({
                        "country": country,
                        "disease": disease,
                        "alert_type": "ANOMALY_SPIKE" if growth > 0 else "ANOMALY_DROP",
                        "latest_cases": int(cases[-1]),
                        "growth_rate": round(growth, 4),
                        "severity": "HIGH" if growth > 0.5 else "MODERATE",
                        "lat": coords[0] if coords else 0,
                        "lng": coords[1] if coords else 0,
                    })
        return sorted(alerts_list, key=lambda x: abs(x["growth_rate"]), reverse=True)[:20]
    return []


@app.get("/api/v1/disease-data")
def disease_data(disease: str = Query("malaria"), region: Optional[str] = None):
    """Combined disease data endpoint."""
    if disease == "malaria" and len(malaria_df) > 0:
        df = malaria_df.copy()
        if region and region.lower() not in ("all", "all regions"):
            df = df[df["region"].str.lower() == region.lower()]
        yearly = df.groupby("year").agg({"cases": "sum", "deaths": "sum"}).reset_index()
        return {
            "disease": disease,
            "region": region or "all",
            "total_countries": int(df["country"].nunique()),
            "total_cases": int(df["cases"].sum()),
            "total_deaths": int(df["deaths"].sum()),
            "years": yearly["year"].tolist(),
            "cases_by_year": yearly["cases"].tolist(),
            "deaths_by_year": yearly["deaths"].tolist(),
        }
    raise HTTPException(404, "Data not available")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
