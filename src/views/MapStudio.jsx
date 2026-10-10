import React, { useState, useMemo, useEffect, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Cloud, Maximize2, Droplets, Landmark, ChevronRight, Trash2,
  MousePointerClick, CheckCircle2, AlertTriangle, Undo
} from 'lucide-react';
import { MapContainer, TileLayer, Polygon, Marker, useMapEvents, useMap } from 'react-leaflet';
import * as turf from '@turf/turf';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  ComposedChart, Line, Legend
} from 'recharts';
import { useWaterWallet } from '../context/WaterWalletContext';
import { fetchCatchmentData, fetchRainfallForecast, getMLYield } from '../api/waterwallet';
import { ROOF_RUNOFF_COEFFICIENTS } from '../utils/waterConstants';
import { formatLitres, formatRupees, formatRainfall, formatArea } from '../utils/formatters';


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

// Open-Meteo direct fetch removed, logic moved to backend

// ─── Esri World Imagery ──────────────────────────────────────────────────────
const ESRI_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ESRI_ATTRIBUTION =
  'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Monsoon months: June(5), July(6), August(7), September(8) — 0-indexed
const MONSOON_IDX = [5, 6, 7, 8];

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



// ─── Monthly Rainfall vs Demand Chart ───────────────────────────────────────
const RainfallDemandChart = memo(function RainfallDemandChart({ monthlyMm, monthlyDemand }) {
  const data = MONTH_LABELS.map((m, i) => ({
    month: m,
    rain: Math.round(monthlyMm[i] || 0),
    demand: monthlyDemand ? Math.round((monthlyDemand[i] || 0) / 1000) : 0 // kL
  }));
  // isMonsoon helper defined but unused in charts

  return (
    <ResponsiveContainer width="100%" height={160}>
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
            if (name === 'rain') return [`${value} mm`, 'Rainfall'];
            if (name === 'demand') return [`${value} kL`, 'Water Demand'];
            return [value, name];
          }}
        />

        <Legend
          wrapperStyle={{ fontSize: '10px' }}
          formatter={(value) => {
            if (value === 'rain') return 'Rainfall (mm)';
            if (value === 'demand') return 'Demand (kL)';
            return value;
          }}
        />

        <Bar yAxisId="rain" dataKey="rain" name="rain" radius={[3, 3, 0, 0]}>
          {data.map((_, idx) => (
            <Cell key={idx} fill={MONSOON_IDX.includes(idx) ? '#3b82f6' : '#bfdbfe'} />
          ))}
        </Bar>

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
  );
});

// ─── Main Component ──────────────────────────────────────────────────────────
export default function MapStudio() {
  const navigate = useNavigate();
  const {
    setEstimatedCapex,
    setAnnualYield,
    setMonthlyRainfall,
    setSiteLatitude,
    setSiteLongitude,
    monthlyDemand,
    roofSurfaceType,
    borewell, setBorewell,
    borewellDepth, setBorewellDepth,
    soilPerm, setSoilPerm,
    coastalKm, setCoastalKm,
  } = useWaterWallet();

  // ─── Live weather state ──────────────────────────────────────────────────
  const [annualRainfall, setAnnualRainfall] = useState(null);
  const [monthlyMm, setMonthlyMm] = useState(Array(12).fill(0));
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState(false);
  const [rainfallSource, setRainfallSource] = useState(null);

  const effectiveRainfall = annualRainfall || 0;

  // ─── Polygon state ───────────────────────────────────────────────────────
  const [points, setPoints] = useState([]);
  const addPoint = useCallback((latlng) => setPoints((prev) => [...prev, latlng]), []);
  const clearPoints = () => setPoints([]);
  const undoPoint = () => setPoints((prev) => prev.slice(0, -1));

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

  // ─── Step 1: Polygon area via Turf.js ────────────────────────────────────
  const tracedArea = useMemo(() => {
    if (points.length < 3) return 0;
    const turfCoords = points.map(([lat, lng]) => [lng, lat]);
    turfCoords.push(turfCoords[0]);
    try {
      return turf.area(turf.polygon([turfCoords]));
    } catch { return 0; }
  }, [points]);

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
  useEffect(() => {
    if (!centroid || tracedArea <= 0) {
      setBackendYield(0);
      setMlYieldSource(null);
      setMlYieldDeviation(null);
      setRainfallSource(null);
      setAnnualRainfall(null);
      setMonthlyMm(Array(12).fill(0));
      setWeatherLoading(false);
      return;
    }

    setWeatherLoading(true);
    setWeatherError(false);
    const catchmentPayload = {
      latitude: centroid[1],
      longitude: centroid[0],
      roof_area_sqm: tracedArea,
      roof_surface_type: roofSurfaceType,
    };

    fetchCatchmentData(catchmentPayload)
      .then((historicalData) =>
        fetchRainfallForecast(catchmentPayload)
          .then((forecastData) => ({ data: forecastData, source: forecastData.source }))
          .catch((forecastError) => {
            console.warn('Auto-SARIMA forecast unavailable; using historical rainfall average.', forecastError);
            return { data: historicalData, source: 'historical_average' };
          })
      )
      .then(({ data, source }) => {
        setRainfallSource(source);
        setAnnualRainfall(data.annual_rainfall_mm);
        setMonthlyMm(data.monthly_rainfall_mm);
        setMonthlyRainfall(data.monthly_rainfall_mm);
        setBackendYield(data.annual_yield_litres);
        
        return getMLYield({
          rooftop_area_m2: tracedArea,
          monthly_rainfall_mm: data.monthly_rainfall_mm
        });
      })
      .then((mlData) => {
        setMlYieldSource(mlData.source);
        setMlYieldDeviation(mlData.ml_deviation_percent);
        setWeatherLoading(false);
      })
      .catch((err) => {
        console.error("Backend calculation error:", err);
        setWeatherError(true);
        setWeatherLoading(false);
      });
    setSiteLatitude(centroid[1]);
    setSiteLongitude(centroid[0]);
  }, [centroid, tracedArea, roofSurfaceType, setMonthlyRainfall, setSiteLatitude, setSiteLongitude]);

  // ─── Monsoon dependency score ─────────────────────────────────────────────
  const monsoonPct = useMemo(() => {
    const total = monthlyMm.reduce((s, v) => s + v, 0);
    if (!total) return 0;
    const monsoon = MONSOON_IDX.reduce((s, i) => s + (monthlyMm[i] || 0), 0);
    return Math.round((monsoon / total) * 100);
  }, [monthlyMm]);

  // ─── Step 3: Sync to global context ──────────────────────────────────────
  useEffect(() => {
    if (estimatedCapex > 0) {
      setEstimatedCapex(estimatedCapex);
    }
    if (backendYield > 0 || maxYield > 0) {
      setAnnualYield(backendYield || maxYield);
    }
    if (monthlyMm && monthlyMm.some(v => v > 0)) {
      setMonthlyRainfall(monthlyMm);
    }
  }, [estimatedCapex, backendYield, maxYield, monthlyMm]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── KPI sidebar cards ─────────────────────────────────────────────────────
  const liveMetrics = [
    {
      icon: Cloud,
      label: 'Live Rainfall Data',
      value: weatherLoading ? 'Fetching…' : formatRainfall(effectiveRainfall),
      unit: weatherError
        ? 'Rainfall unavailable'
        : annualRainfall == null
        ? 'Trace a valid roof polygon to fetch rainfall'
        : rainfallSource === 'auto_sarima'
        ? '12-month Auto-SARIMA forecast · Open-Meteo history'
        : '15-year average (2010–2024) · Open-Meteo',
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

  const canTrace = points.length >= 3;
  const hasMonsoonData = monthlyMm.some((v) => v > 0);

  return (
    <div className="p-8">
      <div className="flex gap-6 h-full">

        {/* ── Left: Live Leaflet Map (60%) ── */}
        <div className="flex-1" style={{ flex: '0 0 60%' }}>
          <div className="bg-white rounded-2xl shadow-md p-4 h-full min-h-[400px] flex flex-col">

            {/* Map header */}
            <div className="flex items-center justify-between mb-4 px-2">
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
                    <button
                      onClick={undoPoint}
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl transition-colors"
                    >
                      <Undo size={12} />
                      Undo
                    </button>
                    <button
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

            {/* Leaflet Map */}
            <div className="flex-1 rounded-xl overflow-hidden min-h-[400px] relative">
              <div className="absolute inset-0">
                <MapContainer
                  center={THANE_CENTER}
                  zoom={18}
                  style={{ height: '100%', width: '100%', zIndex: 0 }}
                  scrollWheelZoom
                  className="crosshair-map"
                >
                  <MapResizeHandler />
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
              <div className="mt-3 px-2 py-2.5 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 font-medium text-center">
                {points.length === 0
                  ? '📍 Click anywhere on the satellite map to start tracing your rooftop boundary'
                  : `📍 ${3 - points.length} more click${3 - points.length > 1 ? 's' : ''} needed to form a polygon`}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Live Calculation Sidebar (40%) ── */}
        <div className="space-y-4 flex flex-col" style={{ flex: '0 0 40%' }}>
          <h2 className="text-base font-semibold text-slate-900 px-1">Live Calculations</h2>

          <div className="grid grid-cols-2 gap-4">
            {liveMetrics.map((m, idx) => {
              const Icon = m.icon;
              return (
                <div
                  key={idx}
                  className={`bg-white rounded-2xl shadow-md p-4 transition-all ${
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
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{m.unit}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Feature 4: Monthly Rainfall vs Demand Chart ── */}
          {hasMonsoonData && (
            <div className="bg-white rounded-2xl shadow-md p-4 border border-slate-100">
              <p className="text-xs font-semibold text-slate-700 mb-1">Seasonal Rainfall vs Demand</p>
              <p className="text-xs text-slate-400 mb-3">
                15-yr avg · <span className="text-blue-600 font-medium">Blue = monsoon months</span>
              </p>
              <RainfallDemandChart monthlyMm={monthlyMm} monthlyDemand={monthlyDemand} />
            </div>
          )}

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
          <div className="bg-white rounded-2xl shadow-md p-4 border border-slate-100">
            <p className="text-xs font-semibold text-slate-700 mb-3">Site Conditions (for ML Models)</p>
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
            className="flex items-center justify-center gap-2 w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold px-6 py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 text-sm mt-2"
          >
            Generate 10-Year ROI Simulation
            <ChevronRight size={16} />
          </button>
        </div>

      </div>
    </div>
  );
}