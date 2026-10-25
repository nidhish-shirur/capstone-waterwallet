import unittest
from unittest.mock import patch

from models.schemas import CatchmentRequest, RainfallForecastRequest
from routers import geospatial


class GeospatialMetadataTests(unittest.IsolatedAsyncioTestCase):
    async def test_catchment_response_marks_regional_fallback(self):
        with patch(
            "routers.geospatial.fetch_monthly_rainfall",
            return_value=([100.0] * 12, "regional_mmr_fallback"),
        ):
            result = await geospatial.catchment_calculate(
                CatchmentRequest(
                    latitude=19.0,
                    longitude=72.0,
                    roof_area_sqm=100.0,
                )
            )

        self.assertTrue(result.fallback_used)
        self.assertEqual(result.source, "regional_mmr_fallback")

    async def test_forecast_response_marks_synthetic_history(self):
        with (
            patch(
                "routers.geospatial.fetch_monthly_rainfall_history",
                return_value=([100.0] * 180, "synthetic_regional_fallback"),
            ),
            patch(
                "routers.geospatial.forecast_monthly_rainfall",
                return_value={
                    "monthly_rainfall_mm": [120.0],
                    "model_order": {"order": [1, 0, 0], "seasonal_order": [0, 1, 1, 12]},
                    "training_months": 180,
                    "confidence_intervals": [{"lower": 90.0, "upper": 150.0}],
                },
            ),
        ):
            result = await geospatial.catchment_forecast(
                RainfallForecastRequest(
                    latitude=19.0,
                    longitude=72.0,
                    roof_area_sqm=100.0,
                    periods=1,
                )
            )

        self.assertEqual(result.source, "auto_sarima")
        self.assertEqual(result.history_source, "synthetic_regional_fallback")
        self.assertTrue(result.fallback_used)


if __name__ == "__main__":
    unittest.main()
