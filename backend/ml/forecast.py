"""
ML — Forecasting
Tries Prophet first (best accuracy); falls back to LinearRegression
if Prophet is not installed or fitting fails.
"""

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression


def run_prophet_forecast(years: list[int], cases: list[int], periods: int = 5) -> dict:
    """
    Forecast future disease cases using Facebook Prophet.
    Falls back to LinearRegression if Prophet is unavailable.

    Parameters
    ----------
    years   : list of historical year integers, e.g. [2010, 2011, ...]
    cases   : list of case counts matching each year
    periods : number of future years to predict

    Returns
    -------
    dict with keys: method, years, predicted, lower, upper
    """
    try:
        from prophet import Prophet

        df_p = pd.DataFrame({
            "ds": pd.to_datetime([f"{y}-01-01" for y in years]),
            "y":  [max(0, c) for c in cases],
        })
        m = Prophet(
            yearly_seasonality=False,
            daily_seasonality=False,
            weekly_seasonality=False,
        )
        m.fit(df_p)
        future = m.make_future_dataframe(periods=periods, freq="YE")
        fc     = m.predict(future)
        future_only = fc.tail(periods)

        return {
            "method":    "Prophet",
            "years":     [int(d.year) for d in future_only["ds"]],
            "predicted": [max(0, int(v)) for v in future_only["yhat"]],
            "lower":     [max(0, int(v)) for v in future_only["yhat_lower"]],
            "upper":     [max(0, int(v)) for v in future_only["yhat_upper"]],
        }

    except Exception:
        return run_linear_forecast(years, cases, periods)


def run_linear_forecast(years: list[int], cases: list[int], periods: int = 5) -> dict:
    """
    Simple linear-regression forecast as a fallback.
    """
    X = np.array(years, dtype=float).reshape(-1, 1)
    y = np.array(cases, dtype=float)

    model = LinearRegression()
    model.fit(X, y)

    future_years  = list(range(max(years) + 1, max(years) + periods + 1))
    preds         = [max(0, int(model.predict([[yr]])[0])) for yr in future_years]
    residual_std  = float(np.std(y - model.predict(X)))
    margin        = int(residual_std * 1.96)

    return {
        "method":    "LinearRegression",
        "years":     future_years,
        "predicted": preds,
        "lower":     [max(0, p - margin) for p in preds],
        "upper":     [p + margin for p in preds],
    }
