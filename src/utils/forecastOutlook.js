const MONTHS_IN_YEAR = 12;
const USABLE_ROOF_FACTOR = 0.8;
const DEFAULT_FIRST_FLUSH_FRACTION = 0.05;

const isFiniteNonNegative = (value) => Number.isFinite(value) && value >= 0;

function requireFiniteNonNegative(value, fieldName) {
  if (!isFiniteNonNegative(value)) {
    throw new TypeError(`${fieldName} must be a finite, non-negative number.`);
  }
}

function addMonths(month, offset) {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getRainfallScenarios(forecastData) {
  const rainfall = forecastData.monthly_rainfall_mm;
  const intervals = forecastData.confidence_intervals;
  if (rainfall?.length !== MONTHS_IN_YEAR || intervals?.length !== MONTHS_IN_YEAR) {
    throw new TypeError('The forecast must contain 12 rainfall values and 12 confidence intervals.');
  }

  return rainfall.map((expectedValue, index) => {
    const interval = intervals[index];
    const lower = interval?.lower_mm ?? interval?.lower;
    const upper = interval?.upper_mm ?? interval?.upper;
    requireFiniteNonNegative(expectedValue, `monthly_rainfall_mm[${index}]`);
    requireFiniteNonNegative(lower, `confidence_intervals[${index}].lower_mm`);
    requireFiniteNonNegative(upper, `confidence_intervals[${index}].upper_mm`);

    return {
      low: Math.min(lower, expectedValue),
      expected: expectedValue,
      high: Math.max(upper, expectedValue),
    };
  });
}

function simulateScenario({
  rainfall,
  monthlyDemandLitres,
  usableRoofAreaSqm,
  runoffCoefficient,
  tankCapacityLitres,
  startingStorageLitres,
  firstFlushFraction,
  forecastStartMonth,
}) {
  let storage = startingStorageLitres;
  let totalInflowLitres = 0;
  let totalServedLitres = 0;
  let totalShortfallLitres = 0;
  let totalOverflowLitres = 0;

  const months = rainfall.map((rainfallMm, index) => {
    const demandLitres = monthlyDemandLitres[index];
    const yieldLitres = rainfallMm * usableRoofAreaSqm * runoffCoefficient
      * (1 - firstFlushFraction);
    const availableLitres = storage + yieldLitres;
    const servedLitres = Math.min(availableLitres, demandLitres);
    const shortfallLitres = demandLitres - servedLitres;
    const overflowLitres = Math.max(0, availableLitres - servedLitres - tankCapacityLitres);
    storage = Math.min(tankCapacityLitres, Math.max(0, availableLitres - servedLitres));

    totalInflowLitres += yieldLitres;
    totalServedLitres += servedLitres;
    totalShortfallLitres += shortfallLitres;
    totalOverflowLitres += overflowLitres;

    return {
      month: addMonths(forecastStartMonth, index),
      rainfallMm,
      yieldLitres,
      demandLitres,
      storageLitres: storage,
      servedLitres,
      shortfallLitres,
      overflowLitres,
    };
  });

  return {
    months,
    totalInflowLitres,
    totalServedLitres,
    totalShortfallLitres,
    totalOverflowLitres,
  };
}

function getExpectedStatus(month) {
  if (month.yieldLitres === 0 && month.shortfallLitres > 0) return 'dry';
  if (month.overflowLitres > 0) return 'surplus';
  if (month.shortfallLitres > 0) return 'shortfall';
  return 'balanced';
}

/**
 * Propagate monthly rainfall confidence bounds through roof yield and a
 * sequential monthly tank balance. Each scenario begins from the same
 * configured starting storage and uses the same 5% first-flush loss.
 */
export function calculateForecastOutlook({
  forecastData,
  monthlyDemandLitres,
  grossRoofAreaSqm,
  runoffCoefficient,
  tankCapacityLitres,
  startingStorageLitres = 0,
  firstFlushFraction = DEFAULT_FIRST_FLUSH_FRACTION,
}) {
  if (!forecastData || typeof forecastData !== 'object') {
    throw new TypeError('forecastData is required.');
  }
  if (forecastData.source !== 'auto_sarima') {
    throw new TypeError('forecastData.source must be auto_sarima.');
  }
  if (typeof forecastData.fallback_used !== 'boolean') {
    throw new TypeError('forecastData.fallback_used must be a boolean.');
  }
  if (!['open_meteo_archive', 'synthetic_regional_fallback'].includes(forecastData.history_source)) {
    throw new TypeError('forecastData.history_source is not a supported source.');
  }
  if (forecastData.fallback_used !== (forecastData.history_source !== 'open_meteo_archive')) {
    throw new TypeError('Forecast fallback metadata is inconsistent.');
  }
  if (!Array.isArray(monthlyDemandLitres) || monthlyDemandLitres.length !== MONTHS_IN_YEAR) {
    throw new TypeError('monthlyDemandLitres must contain exactly 12 values.');
  }
  monthlyDemandLitres.forEach((value, index) => {
    requireFiniteNonNegative(value, `monthlyDemandLitres[${index}]`);
  });
  requireFiniteNonNegative(grossRoofAreaSqm, 'grossRoofAreaSqm');
  requireFiniteNonNegative(runoffCoefficient, 'runoffCoefficient');
  requireFiniteNonNegative(tankCapacityLitres, 'tankCapacityLitres');
  requireFiniteNonNegative(startingStorageLitres, 'startingStorageLitres');
  if (startingStorageLitres > tankCapacityLitres) {
    throw new RangeError('startingStorageLitres cannot exceed tankCapacityLitres.');
  }
  if (!Number.isFinite(firstFlushFraction) || firstFlushFraction < 0 || firstFlushFraction >= 1) {
    throw new RangeError('firstFlushFraction must be at least 0 and less than 1.');
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(forecastData.forecast_start_month || '')) {
    throw new TypeError('forecast_start_month must be provided in YYYY-MM format.');
  }

  const rainfallScenarios = getRainfallScenarios(forecastData);
  const usableRoofAreaSqm = grossRoofAreaSqm * USABLE_ROOF_FACTOR;
  const scenarios = Object.fromEntries(['low', 'expected', 'high'].map((scenarioName) => {
    const rainfall = rainfallScenarios.map((month) => month[scenarioName]);
    return [scenarioName, simulateScenario({
      rainfall,
      monthlyDemandLitres,
      usableRoofAreaSqm,
      runoffCoefficient,
      tankCapacityLitres,
      startingStorageLitres,
      firstFlushFraction,
      forecastStartMonth: forecastData.forecast_start_month,
    })];
  }));

  const months = rainfallScenarios.map((rainfallMm, index) => {
    const expectedMonth = scenarios.expected.months[index];
    return {
      month: expectedMonth.month,
      rainfall_mm: rainfallMm,
      yield_litres: {
        low: scenarios.low.months[index].yieldLitres,
        expected: expectedMonth.yieldLitres,
        high: scenarios.high.months[index].yieldLitres,
      },
      demand_litres: monthlyDemandLitres[index],
      storage_litres: {
        low: scenarios.low.months[index].storageLitres,
        expected: expectedMonth.storageLitres,
        high: scenarios.high.months[index].storageLitres,
      },
      served_litres: {
        low: scenarios.low.months[index].servedLitres,
        expected: expectedMonth.servedLitres,
        high: scenarios.high.months[index].servedLitres,
      },
      shortfall_litres: {
        low: scenarios.low.months[index].shortfallLitres,
        expected: expectedMonth.shortfallLitres,
        high: scenarios.high.months[index].shortfallLitres,
      },
      overflow_litres: {
        low: scenarios.low.months[index].overflowLitres,
        expected: expectedMonth.overflowLitres,
        high: scenarios.high.months[index].overflowLitres,
      },
      status: getExpectedStatus(expectedMonth),
    };
  });

  const sumBy = (field) => ({
    low: scenarios.low[field],
    expected: scenarios.expected[field],
    high: scenarios.high[field],
  });

  return {
    source: forecastData.source,
    history_source: forecastData.history_source === 'open_meteo_archive'
      ? 'open_meteo_historical'
      : 'synthetic_regional',
    fallback_used: forecastData.fallback_used,
    starting_storage_litres: startingStorageLitres,
    tank_capacity_litres: tankCapacityLitres,
    gross_roof_area_sqm: grossRoofAreaSqm,
    usable_roof_area_sqm: usableRoofAreaSqm,
    runoff_coefficient: runoffCoefficient,
    first_flush_fraction: firstFlushFraction,
    monthly: months,
    summary: {
      total_shortfall_litres: sumBy('totalShortfallLitres'),
      total_overflow_litres: sumBy('totalOverflowLitres'),
      months_with_shortfall: scenarios.expected.months.filter((month) => month.shortfallLitres > 0).length,
      months_with_overflow: scenarios.expected.months.filter((month) => month.overflowLitres > 0).length,
      total_inflow_litres: sumBy('totalInflowLitres'),
      total_served_litres: sumBy('totalServedLitres'),
    },
    scenarios,
  };
}