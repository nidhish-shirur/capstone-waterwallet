"""Auto-SARIMA rainfall forecasting service."""

from typing import Any


def forecast_monthly_rainfall(history: list[float], periods: int = 12) -> dict[str, Any]:
    """
    Forecast future monthly rainfall with seasonal Auto-SARIMA.

    ``pmdarima`` is imported lazily because the rest of the backend can still
    serve deterministic catchment calculations when the optional forecasting
    dependency is unavailable.
    """
    if len(history) < 36:
        raise ValueError("At least 36 monthly observations are required for seasonal forecasting.")
    if periods < 1 or periods > 24:
        raise ValueError("Forecast horizon must be between 1 and 24 months.")

    try:
        from pmdarima import auto_arima
    except ImportError as exc:
        raise RuntimeError(
            "Auto-SARIMA is unavailable because pmdarima is not installed. "
            "Install backend requirements and restart the API."
        ) from exc

    search_options = {
        "seasonal": True,
        "m": 12,
        "stepwise": True,
        "suppress_warnings": True,
        "error_action": "ignore",
        "max_p": 3,
        "max_q": 3,
        "max_P": 2,
        "max_Q": 2,
        "max_order": 8,
        "information_criterion": "aic",
    }
    try:
        model = auto_arima(history, **search_options)
    except ValueError:
        # Very regular or short histories can make the seasonal differencing
        # test singular. Keep the seasonal search but constrain differencing.
        model = auto_arima(history, d=0, D=0, **search_options)
    forecast, confidence_interval = model.predict(
        n_periods=periods,
        return_conf_int=True,
    )

    forecast_values = [round(max(0.0, float(value)), 2) for value in forecast]
    intervals = [
        {
            "lower_mm": round(max(0.0, float(row[0])), 2),
            "upper_mm": round(max(0.0, float(row[1])), 2),
        }
        for row in confidence_interval
    ]

    return {
        "monthly_rainfall_mm": forecast_values,
        "confidence_intervals": intervals,
        "model_order": {
            "order": list(model.order),
            "seasonal_order": list(model.seasonal_order),
        },
        "training_months": len(history),
    }
