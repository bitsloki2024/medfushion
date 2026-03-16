"""
ML — Anomaly Detection
Uses scikit-learn IsolationForest to flag statistically unusual
case counts in a time series (e.g. sudden spikes or drops).
"""

import numpy as np
from sklearn.ensemble import IsolationForest


def run_isolation_forest(series: list[float], contamination: float = 0.15) -> list[bool]:
    """
    Detect anomalies in a numeric time series.

    Parameters
    ----------
    series        : list of case counts (ordered by time)
    contamination : expected proportion of anomalies (0–0.5)

    Returns
    -------
    list of bool  : True = anomaly at that index
    """
    if len(series) < 5:
        return [False] * len(series)

    X      = np.array(series).reshape(-1, 1)
    model  = IsolationForest(contamination=contamination, random_state=42, n_estimators=100)
    labels = model.fit_predict(X)
    return [int(lbl) == -1 for lbl in labels]
