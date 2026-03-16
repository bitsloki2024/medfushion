"""
Disease Outbreak Alerts — CDC MMWR + WHO Outbreak News (RSS Feeds)
Sources :
  - CDC MMWR (Morbidity and Mortality Weekly Report) RSS
    https://www.cdc.gov/mmwr/rss/mmwr.xml  →  2000+ disease reports
  - ProMED RSS (if available; falls back to empty if URL has changed)
    https://www.promedmail.org/feed/
Auth    : None (public RSS feeds)
Covers  : Global — infectious disease outbreak reports and surveillance updates
Cache   : cache/promed.json  (TTL = 1 hour)
"""

import json
import re
import time

import feedparser
import httpx

from config import CACHE_DIR, COUNTRY_COORDS

CACHE_FILE  = CACHE_DIR / "promed.json"
TTL_SECONDS = 3600  # 1 hour

# Primary source: CDC MMWR (Morbidity & Mortality Weekly Report)
MMWR_RSS = "https://www.cdc.gov/mmwr/rss/mmwr.xml"

# Secondary sources
PROMED_RSS = "https://www.promedmail.org/feed/"

# Disease keywords to classify each alert
DISEASE_KEYWORDS = {
    "covid":    ["covid", "coronavirus", "sars-cov-2", "sars-cov"],
    "flu":      ["influenza", " flu ", "h1n1", "h3n2", "h5n1", "avian flu", "ili"],
    "malaria":  ["malaria", "plasmodium", "falciparum", "anopheles"],
    "tb":       ["tuberculosis", " tb ", "mycobacterium"],
    "dengue":   ["dengue", "denv"],
    "ebola":    ["ebola", "marburg", "hemorrhagic fever"],
    "cholera":  ["cholera", "vibrio"],
    "mpox":     ["mpox", "monkeypox"],
    "measles":  ["measles", "rubella", "mmr"],
    "rabies":   ["rabies"],
}


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


def _classify_disease(text: str) -> str:
    text_lower = text.lower()
    for disease, keywords in DISEASE_KEYWORDS.items():
        if any(kw in text_lower for kw in keywords):
            return disease
    return "other"


def _extract_country(text: str) -> tuple[str, float, float]:
    for country, coords in COUNTRY_COORDS.items():
        if country.lower() in text.lower():
            return country, coords[0], coords[1]
    return "United States", 37.09, -95.71  # CDC is US-based, default to US


def _estimate_severity(text: str) -> str:
    text_lower = text.lower()
    crit_kw = ["pandemic", "mass casualty", "widespread", "explosive growth", "emergency"]
    high_kw  = ["outbreak", "surge", "alert", "epidemic", "spread", "increase"]
    if any(kw in text_lower for kw in crit_kw):
        return "CRITICAL"
    if any(kw in text_lower for kw in high_kw):
        return "HIGH"
    return "MODERATE"


def _parse_feed(url: str, source_name: str, limit: int = 30) -> list[dict]:
    """
    Fetch and parse an RSS/Atom feed URL.
    Returns list of standardized alert dicts, or [] on failure.
    """
    try:
        # Fetch with follow_redirects to handle 301s (e.g. CDC redirects)
        resp = httpx.get(
            url,
            headers={"User-Agent": "CosmoSentinel/2.0 (Disease Surveillance)"},
            timeout=12,
            follow_redirects=True,
        )
        if resp.status_code != 200:
            return []
        feed = feedparser.parse(resp.text)
    except Exception:
        return []

    alerts = []
    for entry in feed.entries[:limit]:
        title   = entry.get("title", "")
        summary = re.sub(r"<[^>]+>", "", entry.get("summary", "") or "")[:400]
        link    = entry.get("link", "")

        published = ""
        for attr in ("published", "updated", "created"):
            if hasattr(entry, attr):
                published = getattr(entry, attr)
                break

        disease  = _classify_disease(title + " " + summary)
        country, lat, lng = _extract_country(title + " " + summary)
        severity = _estimate_severity(title + " " + summary)

        alerts.append({
            "title":    title,
            "summary":  summary,
            "disease":  disease,
            "country":  country,
            "lat":      lat,
            "lng":      lng,
            "date":     published,
            "severity": severity,
            "link":     link,
            "source":   source_name,
        })
    return alerts


def fetch_alerts(limit: int = 30) -> list[dict]:
    """
    Return disease outbreak alerts from CDC MMWR RSS (primary source).
    Falls back to ProMED if MMWR is unavailable, or returns [] if both fail.
    """
    cached = _load_cache()
    if cached and "alerts" in cached:
        return cached["alerts"]

    # Primary: CDC MMWR — most reliable, 2000+ disease reports
    alerts = _parse_feed(MMWR_RSS, "CDC MMWR", limit=limit)

    # Secondary: ProMED (try in case URL becomes available again)
    if len(alerts) < 5:
        alerts += _parse_feed(PROMED_RSS, "ProMED", limit=limit)

    existing = _load_cache() or {}
    existing["alerts"] = alerts
    _save_cache(existing)
    return alerts
