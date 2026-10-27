import { describe, expect, it } from 'vitest';
import { calculateForecastOutlook } from '../forecastOutlook';

const makeForecast = ({ rainfall = Array(12).fill(100), fallbackUsed = false } = {}) => ({
  source: 'auto_sarima',
  history_source: fallbackUsed ? 'synthetic_regional_fallback' : 'open_meteo_archive',
  fallback_used: fallbackUsed,
  forecast_start_month: '2026-10',
  monthly_rainfall_mm: rainfall,
  confidence_intervals: rainfall.map((value) => ({
    lower_mm: value * 0.8,
    upper_mm: value * 1.2,
  })),
});

const baseInput = {
  forecastData: makeForecast(),
  monthlyDemandLitres: Array(12).fill(1000),
  grossRoofAreaSqm: 100,
  runoffCoefficient: 0.9,
  tankCapacityLitres: 10_000,
  startingStorageLitres: 0,
};

describe('calculateForecastOutlook', () => {
  it('propagates confidence bounds through yield and the monthly tank balance', () => {
    const result = calculateForecastOutlook(baseInput);
    const firstMonth = result.monthly[0];

    expect(firstMonth.month).toBe('2026-10');
    expect(result.monthly[1].month).toBe('2026-11');
    expect(firstMonth.rainfall_mm).toEqual({ low: 80, expected: 100, high: 120 });
    expect(firstMonth.yield_litres).toEqual({ low: 5472, expected: 6840, high: 8208 });
    expect(firstMonth.demand_litres).toBe(1000);
    expect(firstMonth.served_litres).toEqual({ low: 1000, expected: 1000, high: 1000 });
    expect(firstMonth.storage_litres).toEqual({ low: 4472, expected: 5840, high: 7208 });
    expect(result.summary.total_shortfall_litres.expected).toBe(0);
    expect(result.summary.months_with_overflow).toBeGreaterThan(0);
    expect(result.usable_roof_area_sqm).toBe(80);
    expect(result.first_flush_fraction).toBe(0.05);
  });

  it('applies the same five-percent first-flush loss and caps storage overflow', () => {
    const result = calculateForecastOutlook({
      ...baseInput,
      forecastData: makeForecast({ rainfall: Array(12).fill(1000) }),
      monthlyDemandLitres: Array(12).fill(1000),
      tankCapacityLitres: 2000,
    });
    const firstMonth = result.monthly[0];

    expect(firstMonth.yield_litres.expected).toBe(68_400);
    expect(firstMonth.storage_litres.expected).toBe(2000);
    expect(firstMonth.overflow_litres.expected).toBe(65_400);
  });

  it('uses the selected starting storage for each independent rainfall scenario', () => {
    const result = calculateForecastOutlook({
      ...baseInput,
      forecastData: makeForecast({ rainfall: Array(12).fill(0) }),
      monthlyDemandLitres: Array(12).fill(1000),
      tankCapacityLitres: 5000,
      startingStorageLitres: 2500,
    });

    expect(result.monthly[0].served_litres.expected).toBe(1000);
    expect(result.monthly[0].storage_litres.expected).toBe(1500);
    expect(result.monthly[1].served_litres.expected).toBe(1000);
    expect(result.monthly[2].shortfall_litres.expected).toBe(500);
    expect(result.summary.total_shortfall_litres.expected).toBe(9500);
  });

  it('marks zero-rainfall demand as dry and identifies regional history as fallback', () => {
    const result = calculateForecastOutlook({
      ...baseInput,
      forecastData: makeForecast({ rainfall: Array(12).fill(0), fallbackUsed: true }),
    });

    expect(result.fallback_used).toBe(true);
    expect(result.history_source).toBe('synthetic_regional');
    expect(result.monthly[0].status).toBe('dry');
    expect(result.summary.months_with_shortfall).toBe(12);
  });

  it('rejects malformed forecast and storage inputs instead of fabricating values', () => {
    expect(() => calculateForecastOutlook({
      ...baseInput,
      forecastData: { ...baseInput.forecastData, confidence_intervals: [] },
    })).toThrow(/12 confidence intervals/);
    expect(() => calculateForecastOutlook({
      ...baseInput,
      startingStorageLitres: 10_001,
    })).toThrow(/cannot exceed/);
  });
});