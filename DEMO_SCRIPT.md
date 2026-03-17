# CosmoSentinel — Demo Video Script
## 4-Person Split | 7 Minutes

---

## PRE-RECORDING CHECKLIST (do this BEFORE pressing record)

- [ ] VS Code open with `~/Desktop/medfushion/backend/` as workspace, font size 16pt+
- [ ] 2 terminal windows ready (Terminal 1 = backend, Terminal 2 = frontend)
- [ ] Chrome tabs ready: blank tab, `http://localhost:8000/docs`, `http://localhost:3000`
- [ ] Backend NOT yet started → `kill $(lsof -ti:8000)` to make sure
- [ ] Frontend NOT yet started

---

## PERSON 1 — Shruti | Intro + Problem + Tech Stack
### 0:00 – 1:30

**[0:00 — Show frontend globe on screen]**

> "Hi, we're Team MedFushion and this is **CosmoSentinel** — a real-time global disease intelligence platform."

**[0:08 — Switch to VS Code, open backend folder in sidebar]**

> "The problem we're solving: tracking malaria, COVID, flu, TB, and dengue simultaneously means jumping between 6 different websites with data that's sometimes months old. We built one backend that pulls from **8 real-world sources** automatically — WHO, CDC, ECDC, Disease.sh, ProMED, HealthMap, CDC FluView, and IHME — and serves everything through one clean API."

**[0:30 — Open requirements.txt]**

> "Our tech stack choices — and why:

> **FastAPI over Flask** — FastAPI is async. When you call 8 external APIs, synchronous code means waiting for each one in sequence. FastAPI handles them concurrently, which is critical for performance.

> **httpx over requests** — same reason, native async HTTP client.

> **feedparser** — for CDC MMWR and ProMED RSS feeds. These are XML outbreak alert feeds that publish reports like 'Measles outbreak, New Mexico, 2026' — feedparser gives us clean Python dicts from raw XML.

> **scikit-learn + Prophet** — two different ML jobs. scikit-learn's IsolationForest for anomaly detection, Prophet for time-series forecasting with built-in seasonality handling.

> **Pydantic** — every API response has a validated schema. No surprise nulls."

**[1:20 — Show folder structure in sidebar]**

> "We organized it into three layers: `data_sources/` — one file per API. `ml/` — all the intelligence. `main.py` — routes only, nothing else."

**[1:30 — Hand off]**

---

## PERSON 2 — [Name] | Data Sources
### 1:30 – 3:15

**[1:30 — Open `config.py`]**

> "Everything starts with `config.py` — our single source of truth. Every API URL, every WHO indicator code, every CDC dataset ID, and coordinates for 140+ countries all live here. *Why centralize?* Every source returns data in a different format — some use country names, some ISO3 codes. We normalize everything against this one config so all 8 sources produce identical output."

**[1:50 — Open `data_sources/disease_sh.py`]**

> "**Disease.sh** — free, no API key. Input: GET to `disease.sh/v3/covid-19/countries`. Output: 200+ countries with cases, deaths, active counts. We transform it into our standard heatmap format here — lat, lng, cases, deaths, risk score, source tag."

**[Scroll to cache block]**

> "Every source has caching — check if the JSON file is less than 1 hour old, serve from cache, otherwise hit the API and save. This means the demo works even if the internet goes down."

**[2:10 — Open `data_sources/who_gho.py`]**

> "**WHO GHO** — the WHO's OData API for malaria, TB, and dengue. Each disease has a WHO indicator code: malaria is `MALARIA_EST_CASES`, TB is `MDG_0000000020`. We fetch the latest year per country and convert ISO3 codes to names using config. This is what powers the globe for those three diseases."

**[2:30 — Open `data_sources/promed.py`]**

> "**Outbreak alerts** — CDC MMWR RSS as primary, ProMED RSS as fallback. Input: XML feed. We use feedparser to parse it, keyword matching to classify disease type and severity. Right now this is returning 30 live alerts — the most recent is a real measles outbreak in New Mexico, March 12, 2026."

**[2:48 — Briefly show `data_sources/ihme.py`]**

> "IHME's Global Burden of Disease data for India — the gold standard for disease burden but not available via API. We manually exported the 2010–2023 CSV, placed it in the cache folder, and pandas reads it at startup. One manual step, fully integrated after."

**[3:05 — Point to sidebar showing ecdc.py, fluview.py, healthmap.py]**

> "We also have ECDC for European COVID and flu, CDC FluView for weekly US ILI percentage, and HealthMap for global real-time geo-tagged alerts."

**[3:15 — Hand off]**

---

## PERSON 3 — [Name] | ML Pipeline
### 3:15 – 4:45

**[3:15 — Open `ml/anomaly.py`]**

> "Three ML components. First: **IsolationForest** for anomaly detection. Input: a time series of annual case counts. Output: a boolean array — True means that year is an anomalous spike or drop.

> *Why IsolationForest?* Z-score assumes normal distribution — disease data never follows that. IsolationForest is non-parametric. It randomly partitions the data space and flags points that get isolated quickly. Perfect for epidemic spikes and reporting gaps."

**[3:40 — Open `ml/forecast.py`]**

> "Second: **Prophet** for forecasting, **LinearRegression** as fallback. Input: historical years and case counts. Output: future predicted cases with upper and lower confidence bounds.

> *Why Prophet?* Disease data has strong seasonality — flu peaks every winter, malaria peaks with rainy seasons. Prophet handles seasonality automatically and is robust to missing data, which is common in developing-country datasets. ARIMA would need manual parameter tuning and breaks on gaps."

**[4:05 — Open `ml/risk.py`]**

> "Third: **Risk Scoring**. `compute_risk_score` takes cases, population, and growth rate and outputs a 0–100 score: prevalence per 100k is up to 40 points, growth rate up to 40, absolute burden up to 20. Maps to LOW, MODERATE, HIGH, or CRITICAL.

> *Why not just raw case counts?* 50,000 cases in Nigeria — 200 million people — is very different from 50,000 in a country of 5 million. The prevalence component normalizes for population.

> `classify_risk_kmeans` then clusters all countries using K-Means k=3 to generate the risk tier bands you see on the globe."

**[4:45 — Hand off]**

---

## PERSON 4 — [Name] | Live Demo
### 4:45 – 7:00

**[4:45 — Terminal 1, type and run:]**
```bash
cd ~/Desktop/medfushion/backend
uvicorn main:app --reload --port 8000
```

> "Starting the backend. Uvicorn binds to port 8000. `--reload` auto-restarts on file changes — great for development."

**[Wait ~3 seconds. 4:55 — Open browser, navigate to:]**
```
http://localhost:8000/health
```

> "Health check — status OK, all 8 data sources registered."

**[5:05 — Navigate to:]**
```
http://localhost:8000/docs
```

> "FastAPI auto-generates this Swagger UI — every endpoint documented with parameters and response schemas. This is why we chose FastAPI."

**[5:15 — Navigate to:]**
```
http://localhost:8000/api/v1/globe/heatmap?disease=covid
```

> "The heatmap endpoint — 97 countries, real-time from Disease.sh. Each entry has coordinates, cases, deaths, population, and a computed risk score."

**[5:30 — Change disease to malaria:]**
```
http://localhost:8000/api/v1/globe/heatmap?disease=malaria
```

> "Switch to malaria — 61 countries, pulled from WHO GHO, data from 2024."

**[5:42 — Navigate to:]**
```
http://localhost:8000/api/v1/alerts
```

> "Live outbreak alerts from CDC MMWR RSS. First result: measles outbreak, New Mexico, March 12, 2026. Real, live CDC data."

**[5:52 — Terminal 2, run:]**
```bash
cd ~/Desktop/medfushion/frontend
npm run dev
```

**[6:00 — Navigate to `http://localhost:3000`]**

> "Frontend up. Every point on this globe is backed by the API we just walked through. Click a country—"

**[Click Nigeria or India on the globe]**

> "—the side panel loads: real historical trend data, anomaly flags from IsolationForest, risk score from our formula."

**[6:30 — Face cam or final screen]**

> "To wrap up: 8 real data sources, 3 ML models, one clean API, zero paid services, fully open-source. GitHub link is in the description. Thank you."

**[7:00 — End]**

---

## BACKUP LINES (if you blank out)

- **Why FastAPI?** "Async out of the box — calling 8 APIs sequentially would be too slow."
- **Why 8 sources?** "No single source covers everything. Disease.sh has no malaria. WHO has no alerts. We needed all of them."
- **Why cache?** "Reliability. If WHO goes down mid-demo, we serve from cache. Also instant responses."
- **Why IsolationForest?** "Disease data is never normally distributed — Z-score breaks. IsolationForest makes no distribution assumptions."
- **Why Prophet?** "ARIMA needs parameter tuning and breaks on missing data. Prophet handles both automatically."

---

## TIMING SUMMARY

| Person | Topic | Start | End | Duration |
|--------|-------|-------|-----|----------|
| Person 1 | Intro + Tech Stack | 0:00 | 1:30 | 1.5 min |
| Person 2 | Data Sources | 1:30 | 3:15 | 1.75 min |
| Person 3 | ML Pipeline | 3:15 | 4:45 | 1.5 min |
| Person 4 | Live Demo | 4:45 | 7:00 | 2.25 min |
| **Total** | | | | **7 min** |
