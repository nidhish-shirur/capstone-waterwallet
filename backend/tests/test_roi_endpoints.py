import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from main import app


class RoiEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def _payload(self, **overrides):
        payload = {
            "latitude": 19.0,
            "longitude": 72.0,
            "gross_roof_area_sqm": 100,
            "roof_surface_type": "concrete",
            "daily_non_potable_demand_litres": 100,
            "tank_capacity_litres": 1000,
            "coastal_distance_km": 10,
            "soil_permeability_class": 3,
            "borewell_present": 1,
            "borewell_depth_m": 50,
            "annual_tanker_volume_litres": 10000,
            "annual_tanker_spend_inr": 20000,
            "recharge_connection_cost_inr": 5000,
        }
        payload.update(overrides)
        return payload

    def test_unsafe_recharge_scenarios_are_blocked_by_backend_route(self):
        with patch(
            "routers.roi.fetch_daily_rainfall",
            new=AsyncMock(return_value={2021: [0.0] * 365}),
        ):
            response = self.client.post(
                "/api/roi/configuration-comparison",
                json=self._payload(coastal_distance_km=1),
            )

        self.assertEqual(response.status_code, 200)
        scenarios = response.json()["scenarios"]
        self.assertTrue(scenarios[0]["eligible"])
        self.assertFalse(scenarios[1]["eligible"])
        self.assertFalse(scenarios[2]["eligible"])
        self.assertIsNotNone(scenarios[1]["safety_reason"])

    def test_safe_route_returns_all_three_backend_scenarios(self):
        with patch(
            "routers.roi.fetch_daily_rainfall",
            new=AsyncMock(return_value={2021: [0.0] * 365}),
        ):
            response = self.client.post(
                "/api/roi/configuration-comparison",
                json=self._payload(),
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(
            [scenario["configuration"] for scenario in body["scenarios"]],
            ["storage_only", "recharge_only", "hybrid"],
        )
        self.assertTrue(all(scenario["eligible"] for scenario in body["scenarios"]))
        self.assertEqual(body["fallback_used"], False)

    def test_route_returns_unavailable_when_daily_rainfall_is_missing(self):
        with patch(
            "routers.roi.fetch_daily_rainfall",
            new=AsyncMock(return_value={}),
        ):
            response = self.client.post(
                "/api/roi/configuration-comparison",
                json=self._payload(),
            )

        self.assertEqual(response.status_code, 503)
        self.assertIn("not fabricated", response.json()["detail"])


if __name__ == "__main__":
    unittest.main()
