# CosmoSentinel — Backend

> **Real-Time Global Disease Intelligence Platform**
> FastAPI · 8 Live Data Sources · 3 ML Models · 140+ Countries

---

## What It Does

CosmoSentinel is a disease surveillance backend that continuously pulls real-world epidemiological data from 8 authoritative global health sources, normalises it into a unified format, runs machine learning models (anomaly detection, forecasting, risk classification), and serves the results through a clean REST API.

Diseases tracked: **COVID-19 · Influenza · Malaria · Tuberculosis · Dengue**
Coverage: **140+ countries, global scope**

---

## Tech Stack

| Layer | Technology | Why We Chose It |
|---|---|---|
| API Framework | **FastAPI** | Async, auto-generates `/docs`, Pydantic validation built-in |
| Language | **Python 3.11+** | Best ML ecosystem, all health APIs have Python SDKs |
| ML — Forecasting | **Prophet** (Facebook) | Handles seasonality and missing data better than ARIMA |
| ML — Fallback Forecast | **scikit-learn LinearRegression** | Lightweight, zero extra install, same output format |
| ML — Anomaly Detection | **scikit-learn IsolationForest** | Unsupervised, no labelled data needed |
| ML — Risk Clustering | **scikit-learn KMeans** | Interpretable clusters (Low / Medium / High) |
| Data Processing | **pandas + numpy** | Standard for tabular health data |
| HTTP Client | **httpx** | Async HTTP, used for all external API calls |
| RSS Parsing | **feedparser** | Parses ProMED and CDC FluView RSS feeds |
| Server | **uvicorn (ASGI)** | Production-grade ASGI server for FastAPI |
| Caching | **File-based JSON/CSV** | Avoids re-fetching during demo / rate limits |

---

## Project Structure

```
backend/
├── main.py                  # FastAPI app — all routes defined here
├── config.py                # Single source of truth: country coords, API URLs, cache TTLs
├── requirements.txt         # All Python dependencies
│
├── data_sources/            # One module per external data source
│   ├── __init__.py
│   ├── disease_sh.py        # Disease.sh API → COVID-19 + Flu (200+ countries)
│   ├── who_gho.py           # WHO GHO OData API → Malaria, TB, Dengue
│   ├── cdc.py               # CDC Open Data (Socrata) → US COVID deaths
│   ├── ecdc.py              # ECDC Open Data CSV → Europe COVID + Flu
│   ├── fluview.py           # CDC FluView RSS + Socrata → US Flu surveillance
│   ├── promed.py            # ProMED RSS → Global outbreak alerts
│   ├── ihme.py              # IHME GBD CSV (manual) → India disease burden
│   └── healthmap.py         # HealthMap API → Real-time geo-tagged alerts
│
├── ml/                      # Machine learning pipeline modules
│   ├── __init__.py
│   ├── anomaly.py           # IsolationForest anomaly detection
│   ├── forecast.py          # Prophet / LinearRegression forecasting
│   └── risk.py              # Composite risk score + KMeans classification
│
└── cache/                   # File-based cache (auto-created at runtime)
    ├── disease_sh.json      # TTL: 1 hour
    ├── who_gho.json         # TTL: 24 hours
    ├── ecdc.json            # TTL: 24 hours
    ├── promed.json          # TTL: 1 hour
    ├── healthmap.json       # TTL: 1 hour
    └── ihme_india.csv       # Permanent (manual IHME GBD download)
```

---

## Data Sources

| Module | Source | Diseases | Update Frequency | API Key? |
|---|---|---|---|---|
| `disease_sh.py` | [Disease.sh](https://disease.sh) | COVID-19, Flu | Live | ❌ Free |
| `who_gho.py` | [WHO GHO OData](https://www.who.int/data/gho) | Malaria, TB, Dengue | Annual | ❌ Free |
| `cdc.py` | [CDC Socrata Open Data](https://data.cdc.gov) | US COVID deaths | Weekly | ❌ Free |
| `ecdc.py` | [ECDC Open Data](https://www.ecdc.europa.eu) | Europe COVID, Flu | Weekly | ❌ Free |
| `fluview.py` | [CDC FluView](https://www.cdc.gov/flu/weekly) | US Flu ILI % | Weekly | ❌ Free |
| `promed.py` | [ProMED RSS](https://promedmail.org) | All outbreak alerts | Real-time | ❌ Free |
| `ihme.py` | [IHME GBD](https://ghdx.healthdata.org) | India burden (2010–2023) | Annual | ❌ Free (CSV) |
| `healthmap.py` | [HealthMap](https://healthmap.org) | Global geo-alerts | Real-time | Optional |

> **Note:** IHME data requires a one-time manual CSV download from IHME GBD Data Viz (2010–2023). Place the file at `backend/cache/ihme_india.csv`. All other sources are fully automatic.

---

## ML Pipeline

### 1. Anomaly Detection — `ml/anomaly.py`
- **Algorithm:** `IsolationForest` (scikit-learn)
- **Input:** Time series of case counts for a country
- **Output:** Boolean flag per time point — `True = anomaly`
- **Why IsolationForest:** Works unsupervised (no labelled outbreak data needed), handles high-dimensional data, robust to outliers in public health records
- **Contamination rate:** 15% (tunable)

### 2. Forecasting — `ml/forecast.py`
- **Primary:** Facebook **Prophet**
  - Handles yearly seasonality, missing data, and non-linear trends
  - Outputs prediction + 95% confidence interval
- **Fallback:** scikit-learn **LinearRegression**
  - Used when Prophet fitting fails (insufficient data)
  - Same output format — API consumers see no difference
- **Input:** Historical years + case counts (minimum 5 data points)
- **Output:** Next N years predicted cases with upper/lower bounds

### 3. Risk Scoring & Classification — `ml/risk.py`

**Composite Risk Score (0–100):**
| Component | Weight | Calculation |
|---|---|---|
| Prevalence | 40 pts | Cases per 100k population |
| Growth Rate | 40 pts | Recent % increase in cases |
| Absolute Burden | 20 pts | Raw scale of the outbreak |

**Labels:** `LOW (<25)` · `MODERATE (25–50)` · `HIGH (50–75)` · `CRITICAL (>75)`

**K-Means Classification:**
- Groups all countries with data into 3 clusters: `low`, `medium`, `high`
- Features: case count + risk score
- StandardScaler applied before clustering for fair comparison

---

## API Endpoints

Base URL: `http://localhost:8000`
Interactive docs: `http://localhost:8000/docs`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server health + data source status |
| `GET` | `/api/v1/globe/heatmap?disease=covid` | Heatmap points for 3D globe (all countries) |
| `GET` | `/api/v1/country/stats?country=India&disease=covid` | Full stats + anomaly detection for one country |
| `GET` | `/api/v1/forecast?country=India&disease=covid&periods=5` | ML forecast for next N years |
| `GET` | `/api/v1/risk/score?country=India&disease=covid` | Risk score for one country |
| `GET` | `/api/v1/risk/classification?disease=covid` | K-Means cluster labels for all countries |
| `GET` | `/api/v1/alerts?disease=all` | Real-time outbreak alerts (ProMED + HealthMap) |
| `GET` | `/api/v1/flu/surveillance` | US flu weekly ILI surveillance data |
| `GET` | `/api/v1/disease-data?disease=covid` | Aggregate totals across all countries |

### Example Response — `/api/v1/risk/score?country=India&disease=covid`
```json
{
  "score": 67,
  "label": "HIGH",
  "is_alarming": true,
  "country": "India",
  "disease": "covid",
  "latest_cases": 44690023,
  "growth_rate": 0.0012,
  "population": 1400000000,
  "prevalence_per_100k": 3192.14
}
```

---

## Caching Strategy

Every data source caches its response to disk to avoid repeated API calls during demos and to stay within rate limits.

| Cache File | TTL | Behaviour |
|---|---|---|
| `disease_sh.json` | 1 hour | Cache hit → instant response; miss → live API call |
| `who_gho.json` | 24 hours | WHO OData is rate-limited — daily cache essential |
| `ecdc.json` | 24 hours | ECDC CSV updated weekly — no need for hourly refresh |
| `promed.json` | 1 hour | Alerts need to be fresh |
| `healthmap.json` | 1 hour | Geo-alerts need to be fresh |
| `ihme_india.csv` | Permanent | Static IHME GBD file — never re-fetched |

---

## Setup & Running

### Prerequisites
- Python 3.11+
- pip

### 1. Install dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. (One-time) Place IHME data
Download the IHME GBD India CSV from [IHME GBD Data Viz](https://vizhub.healthdata.org/gbd-results/) (2010–2023) and place it at:
```
backend/cache/ihme_india.csv
```

### 3. Start the server
```bash
cd backend
uvicorn main:app --reload --port 8000
```

### 4. Verify it's running
```
http://localhost:8000/health
http://localhost:8000/docs
```

---

## Why This Architecture

| Decision | Reason |
|---|---|
| Modular `data_sources/` folder | Each source is independently testable and swappable |
| Single `config.py` | All country coordinates, API URLs, and cache TTLs in one place — no magic strings |
| Prophet with LinearRegression fallback | Ensures the forecast endpoint never fails, even with sparse data |
| IsolationForest over statistical thresholds | Adapts to each country's baseline — no hardcoded case thresholds |
| File-based cache over Redis/DB | Zero infrastructure overhead — works offline during demos |
| CORS `allow_origins=["*"]` | Allows any frontend (local or deployed) to consume the API |

---

## Team
**Aurora Labs**

Members-
Amrutha Kola
Rishika Redd 
Shruti Anubolu
Yamini Ceeba


**CosmoSentinel** — Disease Surveillance Backend
Built for real-world epidemiological data integration with production ML pipelines.

---

## License

Academic use only. Data from WHO, CDC, ECDC, IHME, Disease.sh, ProMED, and HealthMap — each subject to their respective terms of use.
