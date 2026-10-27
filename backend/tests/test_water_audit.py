import unittest
from types import SimpleNamespace

from services.water_audit import build_water_audit


class WaterAuditTests(unittest.TestCase):
    def _society(self, records):
        return SimpleNamespace(
            num_flats=1,
            occupants=1.0,
            billing_entries=records,
        )

    def _record(self, month, **values):
        defaults = {
            "year": 2024,
            "month": month,
            "municipal_volume_kl": 2.0,
            "tankers": 1,
            "tanker_capacity_l": 10000.0,
            "borewell_volume_kl": 0.0,
        }
        defaults.update(values)
        return SimpleNamespace(**defaults)

    def test_complete_year_counts_measured_zero_and_leap_february(self):
        records = [self._record(month) for month in range(1, 13)]
        result = build_water_audit(self._society(records), 2024)

        self.assertTrue(result.complete_year)
        self.assertEqual(result.source, "derived_from_recorded_inputs")
        self.assertEqual(len(result.months), 12)
        self.assertEqual(result.months[0].supply_source, "recorded_unverified")
        self.assertEqual(
            result.months[0].demand_source,
            "derived_from_standard_assumption",
        )
        self.assertEqual(result.months[1].borewell_volume_kl, 0.0)
        self.assertEqual(result.months[1].demand_kl, 4.96)
        self.assertAlmostEqual(result.observed_period_tanker_volume_kl, 120.0)
        self.assertIsNotNone(result.observed_period_tanker_dependency_percent)

    def test_missing_source_volume_withholds_shortage_not_measured_zero(self):
        records = [
            self._record(month, borewell_volume_kl=None)
            for month in range(1, 13)
        ]
        result = build_water_audit(self._society(records), 2024)

        self.assertFalse(result.complete_year)
        self.assertIsNone(result.months[0].shortage_kl)
        self.assertIn("borewell volume or confirmed zero", result.months[0].missing_inputs)
        self.assertEqual(result.months[0].known_supply_kl, 12.0)
        self.assertIsNotNone(result.observed_period_tanker_dependency_percent)

    def test_missing_month_is_not_assumed_to_have_zero_supply(self):
        result = build_water_audit(
            self._society([self._record(1)]),
            2024,
        )

        self.assertFalse(result.complete_year)
        self.assertIsNone(result.months[1].tanker_volume_kl)
        self.assertIsNone(result.observed_period_tanker_volume_kl)
        self.assertIn("municipal volume", result.months[1].missing_inputs)


if __name__ == "__main__":
    unittest.main()
