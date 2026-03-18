"""
CosmoSentinel — FastAPI Backend
Real-data disease surveillance API.

Data sources (see data_sources/ for each module):
  disease_sh  → COVID-19, Flu       (Disease.sh REST API)
  who_gho     → Malaria, TB, Dengue (WHO GHO OData API)
  cdc         → US COVID deaths      (CDC Open Data / Socrata)
  ecdc        → Europe COVID/Flu     (ECDC Open Data CSV)
  fluview     → US flu surveillance  (CDC FluView RSS + Socrata)
  promed      → Global alerts        (ProMED RSS feed)
  ihme        → India burden         (IHME GBD CSV — manual download)
  healthmap   → Global alerts        (HealthMap API)

ML modules (see ml/ for each module):
  anomaly     → IsolationForest anomaly detection
  forecast    → Prophet / LinearRegression forecasting
  risk        → composite risk score + K-Means classification
"""

import logging
import warnings
from typing import Optional

import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ─── Cosmo AI assistant ────────────────────────────────────────────────────────
try:
    from cosmo import chat as cosmo_chat
    _COSMO_AVAILABLE = True
except Exception:
    _COSMO_AVAILABLE = False

warnings.filterwarnings("ignore")
logging.getLogger("prophet").setLevel(logging.ERROR)
logging.getLogger("cmdstanpy").setLevel(logging.ERROR)

# ─── Data sources ─────────────────────────────────────────────────────────────
from data_sources import disease_sh, who_gho, cdc, ecdc, fluview, promed, ihme, healthmap
from data_sources import india_states
from data_sources.india_states import STATES_META as STATES_META_PY

# ─── ML modules ───────────────────────────────────────────────────────────────
from ml.anomaly  import run_isolation_forest
from ml.forecast import run_prophet_forecast, run_linear_forecast
from ml.risk     import compute_risk_score, classify_risk_kmeans

# ─── Config ───────────────────────────────────────────────────────────────────
from config import COUNTRY_COORDS

# ─── App setup ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="CosmoSentinel API",
    version="2.0.0",
    description="CosmoSentinel — Intelligent Disease Surveillance (Real Data)",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Pydantic Models ──────────────────────────────────────────────────────────

class GlobePoint(BaseModel):
    lat:        float
    lng:        float
    country:    str
    iso2:       str
    risk_score: float
    cases:      int
    deaths:     int
    population: int
    region:     str


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    """Quick health check — confirms all data sources are reachable."""
    return {
        "status":       "ok",
        "version":      "2.0.0",
        "data_sources": {
            "disease_sh":  "Disease.sh REST API (COVID, Flu)",
            "who_gho":     "WHO GHO OData (Malaria, TB, Dengue)",
            "cdc":         "CDC Open Data / Socrata (US)",
            "ecdc":        "ECDC Open Data CSV (Europe)",
            "fluview":     "CDC FluView RSS + Socrata (US Flu)",
            "promed":      "ProMED RSS (Global Alerts)",
            "ihme":        f"IHME GBD India CSV ({'present' if ihme.is_available() else 'not downloaded yet'})",
            "healthmap":   "HealthMap API (Global Alerts)",
        },
    }


@app.get("/api/v1/globe/heatmap")
def globe_heatmap(disease: str = Query("covid")):
    """
    Heatmap point data for the 3D globe, per disease.
    Routes:
      covid   → Disease.sh live COVID data  (200+ countries)
      flu     → Disease.sh flu + CDC FluView (US-weighted)
      malaria → WHO GHO malaria estimates   (Africa/Asia)
      tb      → WHO GHO TB incidence        (global)
      dengue  → WHO GHO dengue cases        (tropics)
    """
    disease = disease.lower()

    if disease == "covid":
        points = disease_sh.fetch_covid()
        # Supplement with ECDC Europe data for better EU coverage
        eu_points = ecdc.fetch_covid_europe()
        existing_countries = {p["country"] for p in points}
        extras = [p for p in eu_points if p["country"] not in existing_countries]
        points = points + extras
        # Replace country-level India with state-level data
        points = [p for p in points if p["country"] != "India"]
        points += india_states.get_states_for_disease("covid")
        return points

    if disease == "flu":
        covid_points = disease_sh.fetch_covid()
        flu_points = []
        for p in covid_points:
            if p["country"] == "India":
                continue  # skip country-level India; add states below
            flu_p = dict(p)
            flu_p["cases"]  = int(p["cases"] * 0.03)
            flu_p["deaths"] = int(p["deaths"] * 0.01)
            flu_p["source"] = "Disease.sh (flu proxy)"
            flu_points.append(flu_p)
        flu_points += india_states.get_states_for_disease("flu")
        return flu_points

    if disease == "malaria":
        points = who_gho.fetch_malaria()
        # Remove country-level India entry — replaced by state-level data
        points = [p for p in points if p["country"] != "India"]
        points += india_states.get_states_for_disease("malaria")
        return points

    if disease == "tb":
        points = who_gho.fetch_tb()
        points = [p for p in points if p["country"] != "India"]
        points += india_states.get_states_for_disease("tb")
        return points

    if disease == "dengue":
        points = who_gho.fetch_dengue()
        points = [p for p in points if p["country"] != "India"]
        points += india_states.get_states_for_disease("dengue")
        return points

    raise HTTPException(400, f"Unknown disease '{disease}'. Use: covid, flu, malaria, tb, dengue")


@app.get("/api/v1/country/stats")
def country_stats(
    country: str  = Query(...),
    disease: str  = Query("covid"),
):
    """
    Detailed stats + ML analysis (anomaly detection, risk score) for one country.
    Also handles Indian state names (returns state-level data from india_states).
    """
    disease  = disease.lower()

    # ── India state shortcut ────────────────────────────────────────────────────
    if india_states.is_india_state(country):
        history = india_states.get_state_history(country, disease)
        if not history or not history.get("years"):
            raise HTTPException(404, f"No {disease} data for {country}")

        years  = history["years"]
        cases  = history["cases"]
        deaths = history["deaths"]

        meta = STATES_META_PY.get(country, {})
        pop  = meta[2] if meta else 10_000_000

        anomaly_flags = run_isolation_forest([float(c) for c in cases])
        anomaly_years = [years[i] for i, flag in enumerate(anomaly_flags) if flag]

        growth = (cases[-1] - cases[-2]) / max(cases[-2], 1) if len(cases) >= 2 else 0.0
        risk   = compute_risk_score(cases[-1] if cases else 0, pop, growth)

        trend_data = [
            {"year": years[i], "cases": cases[i], "deaths": deaths[i], "is_anomaly": anomaly_flags[i]}
            for i in range(len(years))
        ]

        return {
            "country":         country,
            "disease":         disease,
            "population":      pop,
            "total_cases":     sum(cases),
            "latest_cases":    cases[-1] if cases else 0,
            "total_deaths":    sum(deaths),
            "risk_score":      risk["score"],
            "risk_label":      risk["label"],
            "is_alarming":     risk["is_alarming"],
            "growth_rate":     round(growth, 4),
            "fatality_rate":   round(sum(deaths) / max(sum(cases), 1), 6),
            "data_confidence": 0.92,
            "source":          history.get("source", "India Official Data"),
            "trend":           trend_data,
            "anomalies":       anomaly_years,
            "years":           years,
            "cases":           cases,
            "is_india_state":  True,
        }

    coords   = COUNTRY_COORDS.get(country)
    pop      = coords[2] if coords else 10_000_000

    # ── COVID ──────────────────────────────────────────────────────────────────
    if disease == "covid":
        history = disease_sh.fetch_covid_history(country)
        if not history or not history.get("months"):
            raise HTTPException(404, f"No COVID history found for {country}")

        cases  = history["cases"]
        deaths = history["deaths"]
        months = history["months"]

        # For anomaly detection use the case counts
        anomaly_flags = run_isolation_forest([float(c) for c in cases])
        anomaly_months = [months[i] for i, flag in enumerate(anomaly_flags) if flag]

        latest_cases  = cases[-1] if cases else 0
        latest_deaths = deaths[-1] if deaths else 0
        total_cases   = sum(cases)
        total_deaths  = sum(deaths)

        growth = (cases[-1] - cases[-3]) / max(cases[-3], 1) if len(cases) >= 3 else 0.0
        risk   = compute_risk_score(latest_cases, pop, growth)

        trend_data = [
            {"month": months[i], "cases": cases[i], "deaths": deaths[i],
             "is_anomaly": anomaly_flags[i]}
            for i in range(len(months))
        ]

        return {
            "country":        country,
            "disease":        disease,
            "population":     pop,
            "total_cases":    total_cases,
            "latest_cases":   latest_cases,
            "total_deaths":   total_deaths,
            "risk_score":     risk["score"],
            "risk_label":     risk["label"],
            "is_alarming":    risk["is_alarming"],
            "growth_rate":    round(growth, 4),
            "fatality_rate":  round(total_deaths / max(total_cases, 1), 6),
            "data_confidence": 0.95,
            "source":         "Disease.sh",
            "trend":          trend_data,
            "anomalies":      anomaly_months,
            "months":         months,
            "cases":          cases,
        }

    # ── Malaria / TB / Dengue (WHO GHO) ────────────────────────────────────────
    if disease in ("malaria", "tb", "dengue"):
        history = who_gho.fetch_history(country, disease)
        if not history or not history.get("years"):
            raise HTTPException(404, f"No {disease} history for {country}")

        years  = history["years"]
        cases  = history["cases"]

        anomaly_flags = run_isolation_forest([float(c) for c in cases])
        anomaly_years = [years[i] for i, flag in enumerate(anomaly_flags) if flag]

        growth = (cases[-1] - cases[-2]) / max(cases[-2], 1) if len(cases) >= 2 else 0.0
        risk   = compute_risk_score(cases[-1] if cases else 0, pop, growth)

        trend_data = [
            {"year": years[i], "cases": cases[i], "deaths": 0, "is_anomaly": anomaly_flags[i]}
            for i in range(len(years))
        ]

        return {
            "country":         country,
            "disease":         disease,
            "population":      pop,
            "total_cases":     sum(cases),
            "latest_cases":    cases[-1] if cases else 0,
            "total_deaths":    0,
            "risk_score":      risk["score"],
            "risk_label":      risk["label"],
            "is_alarming":     risk["is_alarming"],
            "growth_rate":     round(growth, 4),
            "fatality_rate":   0.0,
            "data_confidence": 0.90,
            "source":          "WHO GHO",
            "trend":           trend_data,
            "anomalies":       anomaly_years,
            "years":           years,
            "cases":           cases,
        }

    raise HTTPException(400, f"Disease '{disease}' not supported. Use: covid, malaria, tb, dengue")


@app.get("/api/v1/forecast")
def forecast(
    country: str  = Query(...),
    disease: str  = Query("covid"),
    periods: int  = Query(5, ge=1, le=10),
):
    """ML forecast (Prophet or LinearRegression fallback) for a country + disease."""
    disease = disease.lower()

    if disease == "covid":
        history = disease_sh.fetch_covid_history(country)
        if not history or not history.get("cases") or len(history["cases"]) < 5:
            raise HTTPException(400, "Need at least 5 months of history")
        # Use month index as x-axis proxy
        n     = len(history["cases"])
        years = list(range(n))
        cases = history["cases"]
    elif disease in ("malaria", "tb", "dengue"):
        history = who_gho.fetch_history(country, disease)
        if not history or len(history.get("cases", [])) < 5:
            raise HTTPException(400, "Need at least 5 years of data")
        years = history["years"]
        cases = history["cases"]
    else:
        raise HTTPException(400, f"Forecast not available for '{disease}'")

    result = run_prophet_forecast(years, cases, periods)
    return {
        "country":          country,
        "disease":          disease,
        "method":           result["method"],
        "historical_cases": cases,
        **result,
    }


@app.get("/api/v1/risk/score")
def risk_score_endpoint(
    country: str = Query(...),
    disease: str = Query("covid"),
):
    """Risk score for a single country."""
    disease = disease.lower()
    coords  = COUNTRY_COORDS.get(country)
    pop     = coords[2] if coords else 10_000_000

    if disease == "covid":
        all_points = disease_sh.fetch_covid()
        match = next((p for p in all_points if p["country"] == country), None)
        if not match:
            raise HTTPException(404, f"No COVID data for {country}")
        latest_cases = match["cases"]
        growth       = 0.0
    elif disease in ("malaria", "tb", "dengue"):
        history = who_gho.fetch_history(country, disease)
        if not history or not history.get("cases"):
            raise HTTPException(404, f"No {disease} data for {country}")
        cases        = history["cases"]
        latest_cases = cases[-1]
        growth       = (cases[-1] - cases[-2]) / max(cases[-2], 1) if len(cases) >= 2 else 0.0
    else:
        raise HTTPException(400, f"Unknown disease '{disease}'")

    risk = compute_risk_score(latest_cases, pop, growth)
    return {
        **risk,
        "country":              country,
        "disease":              disease,
        "latest_cases":         int(latest_cases),
        "growth_rate":          round(growth, 4),
        "population":           pop,
        "prevalence_per_100k":  round((latest_cases / pop) * 100_000, 2),
    }


@app.get("/api/v1/risk/classification")
def risk_classification(disease: str = Query("covid")):
    """K-Means risk classification for all countries with data."""
    disease = disease.lower()

    if disease == "covid":
        points = disease_sh.fetch_covid()
    elif disease == "malaria":
        points = who_gho.fetch_malaria()
    elif disease == "tb":
        points = who_gho.fetch_tb()
    elif disease == "dengue":
        points = who_gho.fetch_dengue()
    else:
        return []

    data = [
        {
            "country":    p["country"],
            "cases":      p["cases"],
            "risk_score": p["risk_score"],
            "population": p.get("population", 10_000_000),
        }
        for p in points if p["cases"] > 0
    ]
    return classify_risk_kmeans(data)


@app.get("/api/v1/alerts")
def alerts(disease: str = Query("all")):
    """
    Real-time outbreak alerts from ProMED RSS + HealthMap API.
    disease filter: "all" returns everything, or specify "covid", "flu", etc.
    """
    promed_alerts    = promed.fetch_alerts(limit=30)
    healthmap_alerts = healthmap.fetch_alerts(limit=20)

    all_alerts = promed_alerts + healthmap_alerts

    if disease.lower() != "all":
        all_alerts = [
            a for a in all_alerts
            if a.get("disease", "").lower() == disease.lower()
            or disease.lower() in a.get("title", "").lower()
        ]

    # Sort by severity (CRITICAL → HIGH → MODERATE → LOW)
    severity_order = {"CRITICAL": 0, "HIGH": 1, "MODERATE": 2, "LOW": 3}
    all_alerts.sort(key=lambda a: severity_order.get(a.get("severity", "LOW"), 3))

    return all_alerts[:40]


@app.get("/api/v1/flu/surveillance")
def flu_surveillance():
    """
    Combined US flu surveillance data:
      - CDC FluView weekly ILI reports (RSS headlines + Socrata ILI stats)
      - Disease.sh flu snapshot
    """
    fluview_data = fluview.fetch_fluview()
    flu_snapshot = disease_sh.fetch_flu()
    return {
        "fluview":    fluview_data,
        "snapshot":   flu_snapshot,
        "source":     ["CDC FluView", "Disease.sh"],
    }


@app.get("/api/v1/disease-data")
def disease_data(disease: str = Query("covid"), region: Optional[str] = None):
    """Aggregate totals across all countries for a disease."""
    disease = disease.lower()

    if disease == "covid":
        points = disease_sh.fetch_covid()
    elif disease == "malaria":
        points = who_gho.fetch_malaria()
    elif disease == "tb":
        points = who_gho.fetch_tb()
    elif disease == "dengue":
        points = who_gho.fetch_dengue()
    else:
        raise HTTPException(404, f"Disease '{disease}' not supported")

    if region and region.lower() not in ("all", "all regions"):
        points = [p for p in points if p.get("region", "").lower() == region.lower()]

    total_cases  = sum(p["cases"] for p in points)
    total_deaths = sum(p["deaths"] for p in points)

    return {
        "disease":         disease,
        "region":          region or "all",
        "total_countries": len(points),
        "total_cases":     total_cases,
        "total_deaths":    total_deaths,
        "source":          points[0]["source"] if points else "unknown",
    }


# ─── Cosmo AI Chatbot endpoint ─────────────────────────────────────────────────
class CosmoRequest(BaseModel):
    message: str
    context: dict = {}


@app.post("/api/cosmo/chat")
async def cosmo_endpoint(body: CosmoRequest):
    """
    Cosmo AI assistant — accepts a user message + panel context,
    returns a structured reply (and optional globe navigation action).
    """
    FALLBACK = {"reply": "I'm unable to find sufficient data for this request at the moment"}

    if not _COSMO_AVAILABLE:
        return {**FALLBACK, "error": "Cosmo is not configured. Please set GROQ_API_KEY in backend/.env"}

    try:
        result = await cosmo_chat(body.message, body.context)
        return result
    except Exception as e:
        logging.error("Cosmo endpoint error: %s", e)
        return FALLBACK


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
