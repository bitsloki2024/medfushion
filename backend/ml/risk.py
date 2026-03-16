"""
ML — Risk Scoring and Classification
Composite risk score (0–100) + K-Means clustering across countries.
"""

import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler


def compute_risk_score(cases: int, population: int, growth_rate: float) -> dict:
    """
    Compute a composite risk score on a 0–100 scale.

    Components
    ----------
    prevalence_score : case rate per 100k  (max 40 pts)
    growth_score     : recent growth rate  (max 40 pts)
    base_score       : absolute burden     (max 20 pts)

    Returns
    -------
    { score, label, is_alarming }
    """
    prevalence   = cases / max(population, 1)
    prev_score   = min(40, prevalence * 100_000)
    growth_score = min(40, max(0, growth_rate * 50))
    base_score   = min(20, prevalence * 1_000_000)
    score        = min(100, max(0, round(prev_score + growth_score + base_score)))

    label = (
        "LOW"      if score < 25 else
        "MODERATE" if score < 50 else
        "HIGH"     if score < 75 else
        "CRITICAL"
    )
    return {"score": score, "label": label, "is_alarming": score >= 50}


def classify_risk_kmeans(data: list[dict]) -> list[dict]:
    """
    Apply K-Means (k=3) to cluster countries by case count and risk score.
    Adds "cluster" (int) and "risk_category" ("low"|"medium"|"high") to each dict.

    Parameters
    ----------
    data : list of dicts, each with "cases" and "risk_score" keys
    """
    if len(data) < 3:
        return data

    X = np.array([
        [d.get("cases", 0), d.get("risk_score", 0) * 100]
        for d in data
    ])

    scaler = StandardScaler()
    Xs     = scaler.fit_transform(X)

    k  = min(3, len(data))
    km = KMeans(n_clusters=k, random_state=42, n_init=10)
    km.fit(Xs)
    labels = km.labels_

    # Rank clusters by centroid risk score (ascending → low/medium/high)
    centroids     = km.cluster_centers_
    sorted_idx    = np.argsort(centroids[:, 1])          # sort by risk score dimension
    rank_map      = {int(sorted_idx[i]): i for i in range(k)}
    risk_cats     = ["low", "medium", "high"]

    for i, d in enumerate(data):
        d["cluster"]       = int(labels[i])
        d["risk_category"] = risk_cats[rank_map[int(labels[i])]]

    return data
