"""
HealthMap — Real-Time Disease Outbreak Alerts
Source  : https://healthmap.org
Auth    : None required for public API endpoint
Covers  : Global — geolocated outbreak alerts aggregated from news, WHO, ProMED, etc.
Cache   : cache/healthmap.json  (TTL = 1 hour)

HealthMap aggregates alerts from hundreds of sources and provides
a public JSON API. Each alert contains disease, location, and severity.
Falls back gracefully to empty list if unavailable.
"""

import json
import re
import time
from datetime import datetime

import httpx

from config import HEALTHMAP_API, CACHE_DIR, COUNTRY_COORDS

CACHE_FILE  = CACHE_DIR / "healthmap.json"
TTL_SECONDS = 3600  # 1 hour


# ─── Cache helpers ──────────────────────────────────────────────────────────────

def _load_cache() -> dict | None:
    if CACHE_FILE.exists():
        try:
            data = json.loads(CACHE_FILE.read_text())
            if time.time() - data.get("_fetched_at", 0) < TTL_SECONDS:
                return data
        except Exception:
            pass
    return None


def _save_cache(data: dict):
    data["_fetched_at"] = time.time()
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_FILE.write_text(json.dumps(data, default=str))


def _clean_text(text: str) -> str:
    """Strip HTML tags and truncate."""
    return re.sub(r"<[^>]+>", "", text or "")[:300]


def fetch_alerts(limit: int = 30) -> list[dict]:
    """
    Fetch real-time outbreak alerts from HealthMap public API.
    Returns list of standardized alert dicts.
    Falls back to empty list if the API is unavailable.
    """
    cached = _load_cache()
    if cached and "alerts" in cached:
        return cached["alerts"]

    alerts = []

    try:
        params = {
            "auth":   "healthmap",
            "limit":  limit,
            "since":  "7",   # days back
            "json":   "1",
        }
        resp = httpx.get(HEALTHMAP_API, params=params, timeout=12)
        resp.raise_for_status()
        data = resp.json()

        raw_alerts = data if isinstance(data, list) else data.get("alerts", [])

        for item in raw_alerts:
            # HealthMap fields vary — handle both old and new API formats
            lat = float(item.get("lat") or item.get("place_lat") or 0)
            lng = float(item.get("lng") or item.get("place_lng") or 0)

            disease_name = (
                item.get("disease") or
                item.get("disease_name") or
                item.get("category") or
                "unknown"
            )
            country = item.get("country") or item.get("place_country_name") or "Unknown"
            title   = _clean_text(item.get("summary") or item.get("description") or "")
            date    = item.get("date") or item.get("add_date") or ""

            alerts.append({
                "title":    title,
                "disease":  disease_name.lower().replace(" ", "_"),
                "country":  country,
                "lat":      lat,
                "lng":      lng,
                "date":     date,
                "severity": "MODERATE",
                "link":     item.get("link") or "",
                "source":   "HealthMap",
            })

    except Exception:
        # HealthMap API may be rate-limited or unavailable — fail silently
        pass

    existing = _load_cache() or {}
    existing["alerts"] = alerts
    _save_cache(existing)
    return alerts
