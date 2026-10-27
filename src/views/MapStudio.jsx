import React, { useState, useMemo, useEffect, useCallback, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Cloud, Maximize2, Droplets, Landmark, ChevronRight, Trash2,
  MousePointerClick, CheckCircle2, AlertTriangle, Undo, MapPin
} from 'lucide-react';
import { MapContainer, TileLayer, Polygon, Marker, useMapEvents, useMap } from 'react-leaflet';
import * as turf from '@turf/turf';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  ComposedChart, Line, Area, Legend
} from 'recharts';
import { useWaterWallet } from '../context/WaterWalletContext';
import { fetchCatchmentData, fetchRainfallForecast, getMLYield } from '../api/waterwallet';
import { ROOF_RUNOFF_COEFFICIENTS, SEASONAL_WEIGHTS } from '../utils/waterConstants';
import { formatLitres, formatRupees, formatRainfall, formatArea } from '../utils/formatters';
import { calculateForecastOutlook } from '../utils/forecastOutlook';
import { lookupMMRPincode } from '../utils/mmrPincodes';


// ─── Fix Leaflet's broken default marker icons in Vite ───────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ─── Constants ───────────────────────────────────────────────────────────────
const THANE_CENTER = [19.2183, 72.9781];
const CAPEX_RATE_PER_SQM = 600;  // ₹ per m² (MMR parametric DSR rate)
const OBSTACLE_FACTOR = 0.80; // 20% deduction for roof obstacles
const MMR_DEFAULT_MONTHLY_RAINFALL = [1, 1, 2, 18, 110, 510, 710, 580, 300, 95, 18, 2];
const MMR_DEFAULT_ANNUAL_RAINFALL = 2447;

// Open-Meteo direct fetch removed, logic moved to backend

// ─── Esri World Imagery ──────────────────────────────────────────────────────
const ESRI_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ESRI_ATTRIBUTION =
  'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Monsoon months: June(5), July(6), August(7), September(8) — 0-indexed
const MONSOON_IDX = [5, 6, 7, 8];
const DEFAULT_OUTLOOK_TANK_CAPACITY_LITRES = 10_000;

function ForecastWaterOutlook({
  forecastData,
  forecastLoading,
  forecastError,
  grossRoofAreaSqm,
  roofSurfaceType,
  annualNonPotableDemandLitres,
}) {
  const [tankCapacityLitres, setTankCapacityLitres] = useState(DEFAULT_OUTLOOK_TANK_CAPACITY_LITRES);
  const [startingStorageLitres, setStartingStorageLitres] = useState(0);
  const monthlyDemandLitres = useMemo(() => {
    const weightTotal = SEASONAL_WEIGHTS.reduce((sum, weight) => sum + weight, 0);
    return SEASONAL_WEIGHTS.map((weight) => (
      annualNonPotableDemandLitres * weight / weightTotal
    ));
  }, [annualNonPotableDemandLitres]);
  const outlook = useMemo(() => {
    if (!forecastData) return null;
    return calculateForecastOutlook({
      forecastData,
      monthlyDemandLitres,
      grossRoofAreaSqm,
      runoffCoefficient: ROOF_RUNOFF_COEFFICIENTS[roofSurfaceType] || 0.90,
      tankCapacityLitres,
      startingStorageLitres,
    });
  }, [
    forecastData,
    grossRoofAreaSqm,
    monthlyDemandLitres,
    roofSurfaceType,
    startingStorageLitres,
    tankCapacityLitres,
  ]);

  if (!forecastData && !forecastLoading && !forecastError) return null;

  const formatRange = (low, expected, high) => (
    <span title={`Low ${formatLitres(low)} · Expected ${formatLitres(expected)} · High ${formatLitres(high)}`}>
      {formatLitres(low)} / {formatLitres(expected)} / {formatLitres(high)}
    </span>
  );
  const statusStyles = {
    surplus: 'bg-emerald-50 text-emerald-800',
    balanced: 'bg-slate-100 text-slate-700',
    shortfall: 'bg-amber-50 text-amber-800',
    dry: 'bg-red-50 text-red-800',
  };
  const shortfallRange = outlook
    ? {
        low: Math.min(
          outlook.summary.total_shortfall_litres.low,
          outlook.summary.total_shortfall_litres.high,
        ),
        high: Math.max(
          outlook.summary.total_shortfall_litres.low,
          outlook.summary.total_shortfall_litres.high,
        ),
      }
    : null;

  return (
    <section className="ww-card p-4 space-y-4" aria-labelledby="forecast-outlook-heading">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="forecast-outlook-heading" className="text-sm font-semibold text-slate-800">
            Next 12-Month Water Outlook
          </h3>
          {outlook && (
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
              outlook.fallback_used
                ? 'bg-amber-100 text-amber-900'
                : 'bg-emerald-100 text-emerald-800'
            }`}>
              {outlook.fallback_used
                ? 'Synthetic regional history — illustrative only'
                : 'Open-Meteo historical'}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Forecast-based estimate. Historical rainfall remains the basis for baseline yield, ROI, and tank sizing.
        </p>
      </div>

      {outlook?.fallback_used === true && (
        <div
          role="status"
          className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900"
        >
          Illustrative — based on synthetic regional history, not a site-specific forecast.
          Operational guidance is suppressed; the monthly scenarios are shown for context only.
        </div>
      )}

      {forecastLoading && !forecastData && (
        <p role="status" className="text-sm text-slate-600">Loading the rainfall forecast and outlook…</p>
      )}
      {forecastError && !forecastData && (
        <p role="status" className="text-sm text-amber-800">
          The rainfall forecast is unavailable. The historical yield estimate is unchanged.
        </p>
      )}

      {forecastData && (
        <>
          <p className="text-[11px] text-slate-500">
            Monthly low / expected / high scenarios propagate the rainfall confidence bounds through harvested yield
            and the tank balance. These monthly bounds are not a joint annual probability interval. Yield applies
            80% usable roof area, the selected runoff coefficient, and 5% first-flush loss.
            Low / expected / high always refers to the rainfall scenario, so lower rainfall can mean a higher shortfall.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs font-medium text-slate-700">
              Outlook tank capacity (L)
              <input
                type="number"
                min="1000"
                max="500000"
                step="1000"
                value={tankCapacityLitres}
                onChange={(event) => {
                  const capacity = Math.min(500000, Math.max(1000, Number(event.target.value) || 1000));
                  setTankCapacityLitres(capacity);
                  setStartingStorageLitres((current) => Math.min(current, capacity));
                }}
                className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-700">
              Starting tank level (L)
              <input
                type="number"
                min="0"
                max={tankCapacityLitres}
                step="500"
                value={startingStorageLitres}
                onChange={(event) => {
                  setStartingStorageLitres(Math.min(
                    tankCapacityLitres,
                    Math.max(0, Number(event.target.value) || 0),
                  ));
                }}
                className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <span className="block font-normal text-slate-500">Defaults to empty; limited to the selected tank capacity.</span>
            </label>
          </div>

          {outlook && (
            <>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600">
                <span>Starting storage: {formatLitres(outlook.starting_storage_litres)}</span>
                <span>Tank capacity: {formatLitres(outlook.tank_capacity_litres)}</span>
                <span>Usable roof: {formatArea(outlook.usable_roof_area_sqm)}</span>
              </div>

              {outlook.fallback_used ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Illustrative regional pattern only. Site-specific operational planning requires a valid forecast.
                </p>
              ) : (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Expected non-potable shortfall across the next 12 months:{' '}
                  <strong>{formatLitres(outlook.summary.total_shortfall_litres.expected)}</strong>
                  {' '}(scenario range {formatLitres(shortfallRange.low)}–{formatLitres(shortfallRange.high)}).
                  This is a planning estimate, not a tanker purchase instruction.
                </p>
              )}

              <div className="overflow-x-auto">
                <table className="min-w-[1050px] w-full border-collapse text-left text-xs">
                  <caption className="sr-only">Monthly rainfall outlook and low, expected, and high water-balance scenarios</caption>
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-500">
                      <th className="p-2">Month</th>
                      <th className="p-2">Rainfall mm<br />L / E / H</th>
                      <th className="p-2">Yield L<br />L / E / H</th>
                      <th className="p-2">Demand</th>
                      <th className="p-2">Served L<br />L / E / H</th>
                      <th className="p-2">Unmet L<br />L / E / H</th>
                      <th className="p-2">Storage L<br />L / E / H</th>
                      <th className="p-2">Overflow L<br />L / E / H</th>
                      <th className="p-2">Expected status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outlook.monthly.map((month) => {
                      const monthLabel = new Date(`${month.month}-01T00:00:00Z`)
                        .toLocaleDateString('en', { month: 'short', year: 'numeric', timeZone: 'UTC' });
                      return (
                        <tr key={month.month} className="border-b border-slate-100 text-slate-700">
                          <th scope="row" className="p-2 font-medium">{monthLabel}</th>
                          <td className="p-2">{formatRange(month.rainfall_mm.low, month.rainfall_mm.expected, month.rainfall_mm.high)}</td>
                          <td className="p-2">{formatRange(month.yield_litres.low, month.yield_litres.expected, month.yield_litres.high)}</td>
                          <td className="p-2">{formatLitres(month.demand_litres)}</td>
                          <td className="p-2">{formatRange(month.served_litres.low, month.served_litres.expected, month.served_litres.high)}</td>
                          <td className="p-2">{formatRange(month.shortfall_litres.low, month.shortfall_litres.expected, month.shortfall_litres.high)}</td>
                          <td className="p-2">{formatRange(month.storage_litres.low, month.storage_litres.expected, month.storage_litres.high)}</td>
                          <td className="p-2">{formatRange(month.overflow_litres.low, month.overflow_litres.expected, month.overflow_litres.high)}</td>
                          <td className="p-2">
                            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${statusStyles[month.status]}`}>
                              {month.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function MapClickHandler({ onMapClick }) {
  useMapEvents({ click(e) { onMapClick([e.latlng.lat, e.latlng.lng]); } });
  return null;
}

function MapResizeHandler() {
  const map = useMap();
  useEffect(() => {
    // Invalidate size immediately
    map.invalidateSize();
    
    // Also trigger it after a delay to ensure parent container rendering completes
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);
    
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

function MapViewController({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [center, map]);
  return null;
}

// ─── Monthly Rainfall vs Demand Chart (Historical & Auto-SARIMA Forecast) ─────
const RainfallDemandChart = memo(function RainfallDemandChart({
  monthlyMm,
  monthlyDemand,
  forecastData,
  chartMode = 'historical',
  onToggleMode,
}) {
  const isForecast = chartMode === 'forecast' && forecastData;
  const forecastRain = forecastData?.monthly_rainfall_mm || [];
  const confInts = forecastData?.confidence_intervals || [];

  const data = MONTH_LABELS.map((m, i) => {
    const demandKl = monthlyDemand ? Math.round((monthlyDemand[i] || 0) / 1000) : 0;
    if (isForecast) {
      const rainVal = Math.round(forecastRain[i] || 0);
      const lower = Math.max(0, Math.round(confInts[i]?.lower_mm || 0));
      const upper = Math.round(confInts[i]?.upper_mm || 0);
      return {
        month: m,
        rain: rainVal,
        ciLower: lower,
        ciUpper: upper,
        demand: demandKl,
      };
    }
    return {
      month: m,
      rain: Math.round(monthlyMm[i] || 0),
      demand: demandKl,
    };
  });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => onToggleMode?.('historical')}
            className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all ${
              chartMode === 'historical'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            15-Yr Historical
          </button>
          <button
            type="button"
            onClick={() => forecastData && onToggleMode?.('forecast')}
            disabled={!forecastData}
            title={forecastData ? 'View 12-month Auto-SARIMA forecast' : 'Trace rooftop to fetch forecast'}
            className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all ${
              chartMode === 'forecast'
                ? 'bg-white text-sky-700 shadow-xs'
                : forecastData
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-slate-300 cursor-not-allowed'
            }`}
          >
            Auto-SARIMA Forecast
          </button>
        </div>

        {isForecast && forecastData?.model_order && (
          <span className="text-[10px] font-mono text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md">
            SARIMA({forecastData.model_order.order?.join(',')})({forecastData.model_order.seasonal_order?.slice(0, 3)?.join(',')})₁₂ · 95% CI
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={175}>
        <ComposedChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
          <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />

          {/* Left Y-axis: Rainfall (mm) */}
          <YAxis
            yAxisId="rain"
            orientation="left"
            tick={{ fontSize: 9, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />

          {/* Right Y-axis: Demand (kL) */}
          <YAxis
            yAxisId="demand"
            orientation="right"
            tick={{ fontSize: 9, fill: '#d97706' }}
            axisLine={false}
            tickLine={false}
          />

          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
            formatter={(value, name) => {
              if (name === 'rain') return [`${value} mm`, isForecast ? 'Forecast Rain' : 'Historical Rain'];
              if (name === 'ciUpper') return [`${value} mm`, '95% CI Upper'];
              if (name === 'ciLower') return [`${value} mm`, '95% CI Lower'];
              if (name === 'demand') return [`${value} kL`, 'Water Demand'];
              return [value, name];
            }}
          />

          <Legend
            wrapperStyle={{ fontSize: '10px' }}
            formatter={(value) => {
              if (value === 'rain') return isForecast ? 'Forecast (mm)' : 'Historical Rain (mm)';
              if (value === 'ciUpper') return '95% CI Band';
              if (value === 'demand') return 'Demand (kL)';
              return value;
            }}
          />

          {isForecast ? (
            <>
              {/* Shaded 95% Confidence Interval band */}
              <Area
                yAxisId="rain"
                type="monotone"
                dataKey="ciUpper"
                name="ciUpper"
                stroke="#38bdf8"
                strokeDasharray="3 3"
                fill="#e0f2fe"
                fillOpacity={0.5}
              />
              <Line
                yAxisId="rain"
                type="monotone"
                dataKey="ciLower"
                stroke="#38bdf8"
                strokeDasharray="3 3"
                dot={false}
                legendType="none"
              />
              <Line
                yAxisId="rain"
                type="monotone"
                dataKey="rain"
                name="rain"
                stroke="#0284c7"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#0284c7' }}
                activeDot={{ r: 5 }}
              />
            </>
          ) : (
            <Bar yAxisId="rain" dataKey="rain" name="rain" radius={[3, 3, 0, 0]}>
              {data.map((_, idx) => (
                <Cell key={idx} fill={MONSOON_IDX.includes(idx) ? '#3b82f6' : '#bfdbfe'} />
              ))}
            </Bar>
          )}

          <Line
            yAxisId="demand"
            type="monotone"
            dataKey="demand"
            name="demand"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={{ r: 3, fill: '#f59e0b', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
});

// ─── Main Component ──────────────────────────────────────────────────────────
export default function MapStudio() {
  const navigate = useNavigate();
  const {
    pincode,
    setEstimatedCapex,
    setAnnualYield,
    setMlAnnualYield,
    setMlMonthlyYield,
    setMonthlyRainfall,
    setGrossRoofArea,
    siteLatitude,
    setSiteLatitude,
    siteLongitude,
    setSiteLongitude,
    setRainfallSource,
    monthlyDemand,
    roofSurfaceType,
    nonPotableDemand,
    borewell, setBorewell,
    borewellDepth, setBorewellDepth,
    soilPerm, setSoilPerm,
    coastalKm, setCoastalKm,
    roofPolygonPoints, setRoofPolygonPoints,
    setPolygonGeoJSON,
  } = useWaterWallet();

  // ─── Pincode MMR Lookup & Map Positioning ──────────────────────────────────
  const mmrInfo = useMemo(() => lookupMMRPincode(pincode), [pincode]);
  const [mapCenter, setMapCenter] = useState(
    siteLatitude && siteLongitude ? [siteLatitude, siteLongitude] : THANE_CENTER
  );
  const [pincodeBannerDismissed, setPincodeBannerDismissed] = useState(false);

  useEffect(() => {
    if (mmrInfo) {
      const newCenter = [mmrInfo.lat, mmrInfo.lng];
      setMapCenter(newCenter);
      setSiteLatitude(mmrInfo.lat);
      setSiteLongitude(mmrInfo.lng);
      // Auto-suggest regional parameters if still at initial defaults
      if (coastalKm === 15 || coastalKm == null) {
        setCoastalKm(mmrInfo.coastalKm);
      }
      if (soilPerm === 3 || soilPerm == null) {
        setSoilPerm(mmrInfo.soilPerm);
      }
    }
  }, [mmrInfo]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Live weather & forecast state ─────────────────────────────────────────
  const [annualRainfall, setAnnualRainfall] = useState(null);
  const [monthlyMm, setMonthlyMm] = useState(MMR_DEFAULT_MONTHLY_RAINFALL);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState(false);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const [forecastData, setForecastData] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState(false);
  const [chartMode, setChartMode] = useState('historical');
  const [historicalPeriod, setHistoricalPeriod] = useState(null);
  const rainfallRequestId = useRef(0);

  const effectiveRainfall = annualRainfall || MMR_DEFAULT_ANNUAL_RAINFALL;

  // ─── Polygon state & Restoration ──────────────────────────────────────────
  const [points, setPoints] = useState(() => (
    Array.isArray(roofPolygonPoints) && roofPolygonPoints.length > 0 ? roofPolygonPoints : []
  ));

  useEffect(() => {
    if (Array.isArray(roofPolygonPoints) && roofPolygonPoints.length >= 3 && points.length === 0) {
      setPoints(roofPolygonPoints);
    }
  }, [roofPolygonPoints]); // eslint-disable-line react-hooks/exhaustive-deps

  const addPoint = useCallback((latlng) => {
    setPoints((prev) => {
      const next = [...prev, latlng];
      setRoofPolygonPoints(next);
      return next;
    });
  }, [setRoofPolygonPoints]);

  const clearPoints = () => {
    setPoints([]);
    setRoofPolygonPoints([]);
    setPolygonGeoJSON(null);
  };

  const undoPoint = () => {
    setPoints((prev) => {
      const next = prev.slice(0, -1);
      setRoofPolygonPoints(next);
      return next;
    });
  };

  // ─── Centroid computation via Turf.js ────────────────────────────────────
  const centroid = useMemo(() => {
    if (points.length < 3) return null;
    const turfCoords = points.map(([lat, lng]) => [lng, lat]);
    turfCoords.push(turfCoords[0]);
    try {
      const cent = turf.centroid(turf.polygon([turfCoords]));
      return [cent.geometry.coordinates[1], cent.geometry.coordinates[0]]; // [lat, lng]
    } catch { return null; }
  }, [points]);

  // If a restored polygon centroid exists, ensure map centers on it
  useEffect(() => {
    if (centroid && centroid[0] && centroid[1]) {
      setMapCenter(centroid);
    }
  }, [centroid]);

  // ─── Step 1: Polygon area & GeoJSON via Turf.js ───────────────────────────
  const tracedPolygon = useMemo(() => {
    if (points.length < 3) return null;
    const turfCoords = points.map(([lat, lng]) => [lng, lat]);
    turfCoords.push(turfCoords[0]);
    try {
      const poly = turf.polygon([turfCoords]);
      const area = turf.area(poly);
      if (!Number.isFinite(area) || area <= 0) return null;
      return {
        area,
        geoJSON: {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [turfCoords],
          },
          properties: {
            gross_roof_area_sqm: Math.round(area * 10) / 10,
          },
        },
      };
    } catch {
      return null;
    }
  }, [points]);
  const tracedArea = tracedPolygon?.area ?? 0;

  useEffect(() => {
    setPolygonGeoJSON(tracedPolygon?.geoJSON ?? null);
  }, [tracedPolygon, setPolygonGeoJSON]);

  // ─── Step 2: Derived metrics ──────────────────────────────────────────────
  const { maxYield, estimatedCapex } = useMemo(() => {
    const usable = tracedArea * OBSTACLE_FACTOR;
    const runoffCoeff = ROOF_RUNOFF_COEFFICIENTS[roofSurfaceType] || 0.90;
    const yld = usable * effectiveRainfall * runoffCoeff;
    const cost = usable * CAPEX_RATE_PER_SQM;
    return { maxYield: yld, estimatedCapex: cost };
  }, [tracedArea, effectiveRainfall, roofSurfaceType]);

  // ─── State to hold backend-computed catchment yield ──────────────────────
  const [backendYield, setBackendYield] = useState(0);
  const [mlYieldSource, setMlYieldSource] = useState(null);
  const [mlYieldDeviation, setMlYieldDeviation] = useState(null);

  // ─── Fetch rainfall data dynamically from backend based on centroid coordinates
  // ─── Fetch rainfall data dynamically from backend based on centroid coordinates
  useEffect(() => {
    const requestId = ++rainfallRequestId.current;

    if (!centroid || tracedArea <= 0) {
      // Resetting request state when the selected catchment is cleared is
      // intentional; these values are derived from an external API request.
      setBackendYield(0);
      setMlYieldSource(null);
      setMlYieldDeviation(null);
      setForecastData(null);
      setForecastLoading(false);
      setForecastError(false);
      setChartMode('historical');
      setMlAnnualYield(0);
      setMlMonthlyYield(null);
      setHistoricalPeriod(null);
      setAnnualRainfall(null);
      setMonthlyMm(MMR_DEFAULT_MONTHLY_RAINFALL);
      setGrossRoofArea(0);
      setRainfallSource('seed');
      setWeatherLoading(false);
      setWeatherError(false);
      return;
    }

    setWeatherLoading(true);
    setWeatherError(false);
    setAnnualRainfall(null);
    setMonthlyMm(MMR_DEFAULT_MONTHLY_RAINFALL);
    setMonthlyRainfall(MMR_DEFAULT_MONTHLY_RAINFALL);
    setRainfallSource('seed');
    setBackendYield(0);
    setForecastData(null);
    setForecastLoading(true);
    setForecastError(false);
    setChartMode('historical');
    setMlYieldSource(null);
    setMlYieldDeviation(null);
    setMlAnnualYield(0);
    setMlMonthlyYield(null);
    const catchmentPayload = {
      latitude: centroid[0],
      longitude: centroid[1],
      roof_area_sqm: tracedArea,
      roof_surface_type: roofSurfaceType,
    };

    fetchCatchmentData(catchmentPayload)
      .then((historicalData) => {
        if (requestId !== rainfallRequestId.current) return null;

        // The historical climatological normal is the authoritative planning
        // baseline. A forecast is a scenario, not a replacement for the
        // long-run annual rainfall used for yield calculations.
        setAnnualRainfall(historicalData.annual_rainfall_mm);
        setMonthlyMm(historicalData.monthly_rainfall_mm);
        setMonthlyRainfall(historicalData.monthly_rainfall_mm);
        setGrossRoofArea(tracedArea);
        setRainfallSource(historicalData.fallback_used ? 'regional_fallback' : 'phase2_historical');
        setBackendYield(historicalData.annual_yield_litres);
        setWeatherError(Boolean(historicalData.fallback_used));
        setHistoricalPeriod(historicalData.fallback_used
          ? 'Regional climatological baseline · fallback'
          : `${historicalData.historical_start_year}–${historicalData.historical_end_year}`);

        // Historical rainfall is authoritative. ML yield and forecasting are
        // optional enrichments and must not turn a successful rainfall load
        // into a false "rainfall unavailable" state.
        setWeatherLoading(false);
        return Promise.allSettled([
          getMLYield({
            rooftop_area_m2: tracedArea,
            monthly_rainfall_mm: historicalData.monthly_rainfall_mm,
          }),
          fetchRainfallForecast(catchmentPayload),
        ]);
      })
      .then((results) => {
        if (!results || requestId !== rainfallRequestId.current) return null;
        const [mlResult, forecastResult] = results;

        if (mlResult.status === 'fulfilled') {
          return {
            mlData: mlResult.value,
            forecastData: forecastResult.status === 'fulfilled' ? forecastResult.value : null,
            forecastError: forecastResult.status === 'rejected',
          };
        }
        console.warn('ML yield unavailable; retaining physics-based rainfall yield.', mlResult.reason);
        return {
          mlData: null,
          forecastData: forecastResult.status === 'fulfilled' ? forecastResult.value : null,
          forecastError: forecastResult.status === 'rejected',
        };
      })
      .then((result) => {
        if (!result || requestId !== rainfallRequestId.current) return;

        if (result.forecastData) {
          setForecastData(result.forecastData);
        } else {
          setForecastError(result.forecastError);
          console.warn('Auto-SARIMA forecast unavailable; retaining historical rainfall baseline.');
        }
        setForecastLoading(false);
        if (result.mlData) {
          setMlYieldSource(result.mlData.source);
          setMlYieldDeviation(result.mlData.ml_deviation_percent);
          // Sync ML yield values to global context (converting kL to Litres)
          setMlAnnualYield(result.mlData.annual_yield_kl * 1000);
          if (result.mlData.monthly_yield_kl) {
            setMlMonthlyYield(result.mlData.monthly_yield_kl.map((v) => v * 1000));
          }
        }
        setWeatherLoading(false);
      })
      .catch((err) => {
        if (requestId !== rainfallRequestId.current) return;

        console.warn("Backend calculation error, applying MMR regional baseline fallback:", err);
        const usable = tracedArea * OBSTACLE_FACTOR;
        const runoffCoeff = ROOF_RUNOFF_COEFFICIENTS[roofSurfaceType] || 0.90;
        const fallbackYield = usable * MMR_DEFAULT_ANNUAL_RAINFALL * runoffCoeff;

        setAnnualRainfall(MMR_DEFAULT_ANNUAL_RAINFALL);
        setMonthlyMm(MMR_DEFAULT_MONTHLY_RAINFALL);
        setMonthlyRainfall(MMR_DEFAULT_MONTHLY_RAINFALL);
        setGrossRoofArea(tracedArea);
        setRainfallSource('seed');
        setBackendYield(fallbackYield);
        setHistoricalPeriod('MMR Regional Climatological Baseline');
        setWeatherError(true);
        setWeatherLoading(false);
        setForecastLoading(false);
        setForecastError(true);
      });
    setSiteLatitude(centroid[0]);
    setSiteLongitude(centroid[1]);
  }, [centroid, tracedArea, roofSurfaceType, retryTrigger, setGrossRoofArea, setMonthlyRainfall, setRainfallSource, setSiteLatitude, setSiteLongitude, setMlAnnualYield, setMlMonthlyYield]);

  // ─── Monsoon dependency score ─────────────────────────────────────────────
  const monsoonPct = useMemo(() => {
    const total = monthlyMm.reduce((s, v) => s + v, 0);
    if (!total) return 0;
    const monsoon = MONSOON_IDX.reduce((s, i) => s + (monthlyMm[i] || 0), 0);
    return Math.round((monsoon / total) * 100);
  }, [monthlyMm]);

  // ─── Step 3: Sync to global context ──────────────────────────────────────
  useEffect(() => {
    setEstimatedCapex(estimatedCapex);
    setGrossRoofArea(tracedArea);
    setAnnualYield(tracedArea > 0 ? backendYield || maxYield : 0);
    if (monthlyMm && monthlyMm.some(v => v > 0)) {
      setMonthlyRainfall(monthlyMm);
    }
  }, [estimatedCapex, backendYield, maxYield, monthlyMm, tracedArea, setEstimatedCapex, setGrossRoofArea, setAnnualYield, setMonthlyRainfall]);

  // ─── KPI sidebar cards ─────────────────────────────────────────────────────
  const canTrace = points.length >= 3;
  const hasMonsoonData = monthlyMm.some((v) => v > 0);

  const liveMetrics = [
    {
      icon: Cloud,
      label: 'Rainfall Planning Baseline',
      value: weatherLoading ? 'Fetching…' : formatRainfall(effectiveRainfall),
      unit: weatherError
        ? 'Regional fallback applied · not site-specific'
        : annualRainfall == null
        ? 'Regional IMD Normal · Trace roof to calculate site yield'
        : `${historicalPeriod || '15-year historical normal'} · Open-Meteo`,
      action: canTrace ? (
        <button
          type="button"
          onClick={() => setRetryTrigger((prev) => prev + 1)}
          className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer bg-transparent border-0 p-0 ml-1.5"
          title="Retry fetching site-specific rainfall"
        >
          {weatherLoading ? 'Refreshing…' : 'Refresh'}
        </button>
      ) : null,
      color: 'text-blue-600', bg: 'bg-blue-50', highlight: false,
    },
    {
      icon: Maximize2, label: 'Traced Gross Area',
      value: formatArea(tracedArea), unit: 'live from map',
      color: 'text-slate-700', bg: 'bg-slate-50', highlight: false,
    },
    {
      icon: Droplets, label: 'Max Harvestable Yield',
      value: formatLitres(backendYield || maxYield),
      unit: mlYieldSource
        ? `Physics authoritative · ML deviation ${mlYieldDeviation == null ? 'N/A' : `${mlYieldDeviation}%`}`
        : 'per year',
      color: 'text-teal-600', bg: 'bg-teal-50', highlight: false,
    },
    {
      icon: Landmark, label: 'Parametric RWH Capex',
      value: formatRupees(estimatedCapex), unit: 'Estimated Project Budget',
      color: 'text-blue-700', bg: 'bg-blue-50', highlight: true,
    },
  ];

  return (
    <div className="page-content p-4 sm:p-6 lg:p-8">
      <div className="mb-6 rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-700 to-blue-900 px-5 py-5 text-white shadow-md sm:px-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-100">Turn the roof into evidence</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Trace your catchment and test its potential</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-teal-50">Map the roof once. WaterWallet combines its area, rainfall, and surface type into a transparent yield estimate.</p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-teal-50">2 of 3 · Catchment audit</span>
        </div>
      </div>
      <div className="grid min-h-0 gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.85fr)]">

        {/* ── Left: Live Leaflet Map (60%) ── */}
        <div className="min-w-0">
          <div className="ww-card p-3 sm:p-4 h-full min-h-[520px] flex flex-col">

            {/* Map header */}
            <div className="flex flex-col gap-3 mb-4 px-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Interactive Catchment Map</h2>
                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                  <MousePointerClick size={11} />
                  Click on your rooftop to trace a polygon — area calculates live
                </p>
              </div>
              <div className="flex items-center gap-2">
                {canTrace && (
                  <span className="flex items-center gap-1 text-xs bg-green-50 text-green-700 font-semibold px-3 py-1 rounded-full border border-green-200">
                    <CheckCircle2 size={12} />
                    {points.length} points traced
                  </span>
                )}
                {points.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <button aria-label="Undo last rooftop point"
                      onClick={undoPoint}
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl transition-colors"
                    >
                      <Undo size={12} />
                      Undo
                    </button>
                    <button aria-label="Clear rooftop trace"
                      onClick={clearPoints}
                      className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-xl transition-colors"
                    >
                      <Trash2 size={12} />
                      Clear
                    </button>
                  </div>
                )}
                <span className="text-xs bg-amber-50 text-amber-700 font-semibold px-3 py-1 rounded-full border border-amber-200">
                  Satellite View
                </span>
              </div>
            </div>

            {/* MMR Pincode Auto-Location Alert Strip */}
            {mmrInfo && !pincodeBannerDismissed && (
              <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900 shadow-xs">
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-blue-600 flex-shrink-0" />
                  <span>
                    <strong>Pincode {mmrInfo.pincode} Located:</strong> {mmrInfo.suburb}, {mmrInfo.region} · Est. Coast: {mmrInfo.coastalKm} km · Suggested Soil: {mmrInfo.soilLabel}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPincodeBannerDismissed(true)}
                  className="text-blue-500 hover:text-blue-700 font-bold px-1 text-xs"
                  aria-label="Dismiss banner"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Leaflet Map */}
            <div className="flex-1 rounded-xl overflow-hidden min-h-[360px] sm:min-h-[460px] relative">
              <div className="absolute inset-0">
                <MapContainer
                  center={mapCenter}
                  zoom={18}
                  style={{ height: '100%', width: '100%', zIndex: 0 }}
                  scrollWheelZoom
                  className="crosshair-map"
                >
                  <MapResizeHandler />
                  <MapViewController center={mapCenter} />
                  <TileLayer 
                    url={ESRI_TILE_URL} 
                    attribution={ESRI_ATTRIBUTION} 
                    maxZoom={20} 
                    maxNativeZoom={19}
                    crossOrigin="anonymous" 
                  />
                  <MapClickHandler onMapClick={addPoint} />
                  {points.map(([lat, lng], i) => (
                    <Marker key={i} position={[lat, lng]} />
                  ))}
                  {canTrace && (
                    <Polygon
                      positions={points}
                      pathOptions={{
                        color: '#3b82f6', weight: 2, dashArray: '8 4',
                        fillColor: 'rgba(59,130,246,0.20)', fillOpacity: 1,
                      }}
                    />
                  )}
                </MapContainer>
              </div>
            </div>

            {/* Instruction strip below map */}
            {!canTrace && (
              <div role="status" aria-live="polite" className="mt-3 px-2 py-2.5 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 font-medium text-center">
                {points.length === 0
                  ? '📍 Click anywhere on the satellite map to start tracing your rooftop boundary'
                  : `📍 ${3 - points.length} more click${3 - points.length > 1 ? 's' : ''} needed to form a polygon`}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Live Calculation Sidebar (40%) ── */}
        <div className="space-y-4 flex flex-col min-w-0">
          <h2 className="text-base font-semibold text-slate-900 px-1">Live Calculations</h2>

          <div className="grid grid-cols-2 gap-4">
            {liveMetrics.map((m, idx) => {
              const Icon = m.icon;
              return (
                <div
                  key={idx}
                  className={`ww-card p-4 transition-all ${
                    m.highlight
                      ? 'border-2 border-blue-500 shadow-blue-100 shadow-sm'
                      : 'border border-slate-100'
                  }`}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${m.bg}`}>
                        <Icon size={16} className={m.color} />
                      </div>
                      {m.highlight && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded-md">KEY</span>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium leading-tight">{m.label}</p>
                      <p className={`text-xl font-bold mt-1 ${m.color} ${!canTrace && m.label !== 'Live Rainfall Data' ? 'opacity-30' : ''}`}>
                        {m.value}
                      </p>
                      <div className="flex items-center flex-wrap gap-1 mt-0.5">
                        <p className="text-[10px] text-slate-400 leading-tight">{m.unit}</p>
                        {m.action}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Feature 4: Monthly Rainfall vs Demand Chart ── */}
          {hasMonsoonData && (
            <div className="ww-card p-4">
              <div className="mb-2">
                <p className="text-xs font-semibold text-slate-700">Seasonal Rainfall vs Demand</p>
                <p className="text-xs text-slate-400">
                  {chartMode === 'forecast'
                    ? '12-Month Auto-SARIMA dynamic forecast with 95% confidence bands'
                    : '15-yr climatological avg · Blue = monsoon months (Jun–Sep)'}
                </p>
              </div>
              <RainfallDemandChart
                monthlyMm={monthlyMm}
                monthlyDemand={monthlyDemand}
                forecastData={forecastData}
                chartMode={chartMode}
                onToggleMode={setChartMode}
              />
            </div>
          )}

          <ForecastWaterOutlook
            forecastData={forecastData}
            forecastLoading={forecastLoading}
            forecastError={forecastError}
            grossRoofAreaSqm={tracedArea}
            roofSurfaceType={roofSurfaceType}
            annualNonPotableDemandLitres={Number(nonPotableDemand) || 0}
          />

          {/* ── Feature 5: Monsoon Dependency Score ── */}
          {hasMonsoonData && (
            <div className={`rounded-2xl p-4 border ${monsoonPct >= 80
                ? 'bg-amber-50 border-amber-200'
                : 'bg-green-50 border-green-200'
              }`}>
              <div className="flex items-center gap-2 mb-1">
                {monsoonPct >= 80
                  ? <AlertTriangle size={14} className="text-amber-600" />
                  : <Droplets size={14} className="text-green-600" />
                }
                <p className={`text-xs font-semibold ${monsoonPct >= 80 ? 'text-amber-700' : 'text-green-700'}`}>
                  Monsoon Dependency Score
                </p>
              </div>
              <p className={`text-3xl font-extrabold ${monsoonPct >= 80 ? 'text-amber-600' : 'text-green-600'}`}>
                {monsoonPct}%
              </p>
              <p className={`text-xs mt-1 ${monsoonPct >= 80 ? 'text-amber-600' : 'text-green-600'}`}>
                {monsoonPct >= 80
                  ? 'of annual yield falls in Jun–Sep. Tank sizing is critical to bridge the dry season.'
                  : 'of yield from monsoon — relatively well distributed.'
                }
              </p>
            </div>
          )}
          
          {/* ── ML Site Inputs ── */}
          <div className="ww-card p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-700">Site Conditions</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">Optional assumptions used to explain the recommended configuration.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Model inputs</span>
          </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Existing Borewells</label>
                <input type="number" min="0" value={borewell} onChange={e => setBorewell(Number(e.target.value))} className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Avg Depth (m)</label>
                <input type="number" min="0" value={borewellDepth} onChange={e => setBorewellDepth(Number(e.target.value))} className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-blue-500" disabled={borewell === 0} />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Soil Permeability</label>
                <select value={soilPerm} onChange={e => setSoilPerm(Number(e.target.value))} className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 bg-white">
                  <option value={1}>1 - Very Poor (Clay)</option>
                  <option value={2}>2 - Poor (Silt)</option>
                  <option value={3}>3 - Moderate (Loam)</option>
                  <option value={4}>4 - Good (Sand)</option>
                  <option value={5}>5 - High (Gravel)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Distance to Coast (km)</label>
                <input type="number" min="0" value={coastalKm} onChange={e => setCoastalKm(Number(e.target.value))} className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          {/* Peer-reviewed math note */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-xs text-green-700 mt-auto">
            <span className="font-semibold">✓ Peer-Reviewed Math:</span> Turf.js geospatial engine.
            Capex calibrated at ₹600/m² using 0.90 runoff coefficient and 20% obstacle deduction
            for the Mumbai Metropolitan Region (MMR).
          </div>

          {/* Proceed Button */}
          <button
            onClick={() => navigate('/roi-dashboard')}
            className="ww-primary-button flex items-center justify-center gap-2 w-full px-6 py-3.5 text-sm mt-2"
          >
            Generate 10-Year ROI Simulation
            <ChevronRight size={16} />
          </button>
        </div>

      </div>
    </div>
  );
}