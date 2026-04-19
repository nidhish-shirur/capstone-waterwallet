import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cloud, Maximize2, Droplets, Landmark, ChevronRight, Trash2, MousePointerClick, CheckCircle2 } from 'lucide-react';
import { MapContainer, TileLayer, Polygon, Marker, useMapEvents } from 'react-leaflet';
import * as turf from '@turf/turf';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useWaterWallet } from '../context/WaterWalletContext';

// ─── Fix Leaflet's broken default marker icons in Vite ───────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ─── Constants ───────────────────────────────────────────────────────────────
const THANE_CENTER       = [19.2183, 72.9781];
const CAPEX_RATE_PER_SQM = 600;  // ₹ per m² (MMR parametric DSR rate)

// Open-Meteo archive: 10 full years of daily precipitation for Thane
const WEATHER_API_URL =
  'https://archive-api.open-meteo.com/v1/archive' +
  '?latitude=19.2183&longitude=72.9781' +
  '&start_date=2015-01-01&end_date=2024-12-31' +
  '&daily=precipitation_sum&timezone=Asia/Kolkata';
const OBSTACLE_FACTOR    = 0.80; // 20% deduction for roof obstacles
const RUNOFF_COEFF       = 0.90; // Concrete runoff coefficient

// ─── Esri World Imagery (satellite, free, no key needed) ────────────────────
const ESRI_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ESRI_ATTRIBUTION =
  'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics';

// ─── Sub-component: captures map clicks ─────────────────────────────────────
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

// ─── Number formatter ────────────────────────────────────────────────────────
const fmt = (num) => Number(Math.round(num)).toLocaleString('en-IN');

// ─── Main Component ──────────────────────────────────────────────────────────
export default function MapStudio() {
  const navigate = useNavigate();
  const { setEstimatedCapex } = useWaterWallet();

  // ─── Live weather state ──────────────────────────────────────────────────
  const [annualRainfall,   setAnnualRainfall]   = useState(null);  // mm, fetched
  const [weatherLoading,   setWeatherLoading]   = useState(true);
  const [weatherError,     setWeatherError]     = useState(false);

  // Fetch on mount — compute 10-year average annual rainfall
  useEffect(() => {
    fetch(WEATHER_API_URL)
      .then((r) => r.json())
      .then((data) => {
        const times  = data.daily.time;
        const precip = data.daily.precipitation_sum;

        // Group daily totals by year, sum each year, then average
        const yearTotals = {};
        times.forEach((dateStr, i) => {
          const yr = dateStr.slice(0, 4);
          yearTotals[yr] = (yearTotals[yr] || 0) + (precip[i] || 0);
        });
        const years  = Object.values(yearTotals);
        const avgMm  = Math.round(years.reduce((s, v) => s + v, 0) / years.length);
        setAnnualRainfall(avgMm);
        setWeatherLoading(false);
      })
      .catch(() => {
        setWeatherError(true);
        setWeatherLoading(false);
        setAnnualRainfall(2500); // Thane metro fallback
      });
  }, []);

  // Effective rainfall used in math — fall back to 2500 while loading
  const effectiveRainfall = annualRainfall || 2500;

  // Array of [lat, lng] pairs — each map click appends one
  const [points, setPoints] = useState([]);

  const addPoint = useCallback((latlng) => {
    setPoints((prev) => [...prev, latlng]);
  }, []);

  const clearPoints = () => setPoints([]);

  // ─── Step 1: Calculate polygon area via Turf.js ────────────────────────────
  // Turf expects [lng, lat] and a closed ring (first === last point)
  const tracedArea = useMemo(() => {
    if (points.length < 3) return 0;
    const turfCoords = points.map(([lat, lng]) => [lng, lat]);
    turfCoords.push(turfCoords[0]); // close the ring
    try {
      const poly = turf.polygon([turfCoords]);
      return turf.area(poly); // m²
    } catch {
      return 0;
    }
  }, [points]);

  // ─── Step 2: Karnal Research Paper math on the live area ──────────────────
  const { usableArea, maxYield, estimatedCapex } = useMemo(() => {
    const usable = tracedArea * OBSTACLE_FACTOR;
    const yld    = usable * effectiveRainfall * RUNOFF_COEFF;
    const cost   = usable * CAPEX_RATE_PER_SQM;
    return { usableArea: usable, maxYield: yld, estimatedCapex: cost };
  }, [tracedArea, effectiveRainfall]);

  // ─── Step 3: Sync live Capex to global context ────────────────────────────
  useEffect(() => {
    setEstimatedCapex(estimatedCapex);
  }, [estimatedCapex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── KPI sidebar cards ─────────────────────────────────────────────────────
  const liveMetrics = [
    {
      icon: Cloud,
      label: 'Live Rainfall Data',
      value: weatherLoading ? 'Fetching…' : `${effectiveRainfall} mm`,
      unit: weatherError
        ? 'Thane fallback (API error)'
        : weatherLoading
        ? 'Open-Meteo · Thane, MH'
        : `10-year avg (2015–2024) · Open-Meteo`,
      color: 'text-blue-600',  bg: 'bg-blue-50',  highlight: false,
    },
    {
      icon: Maximize2, label: 'Traced Gross Area',
      value: fmt(tracedArea),  unit: 'm² (live from map)',
      color: 'text-slate-700', bg: 'bg-slate-50', highlight: false,
    },
    {
      icon: Droplets,  label: 'Max Harvestable Yield',
      value: fmt(maxYield),    unit: 'Liters / Year',
      color: 'text-teal-600',  bg: 'bg-teal-50',  highlight: false,
    },
    {
      icon: Landmark,  label: 'Parametric RWH Capex',
      value: `₹${fmt(estimatedCapex)}`, unit: 'Estimated Project Budget',
      color: 'text-blue-700',  bg: 'bg-blue-50',  highlight: true,
    },
  ];

  const canTrace = points.length >= 3;

  return (
    <div className="p-8">
      <div className="flex gap-6 h-full">

        {/* ── Left: Live Leaflet Map (65%) ── */}
        <div className="flex-1" style={{ flex: '0 0 65%' }}>
          <div className="bg-white rounded-2xl shadow-md p-4 h-full min-h-[520px] flex flex-col">

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
                  <button
                    onClick={clearPoints}
                    className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-xl transition-colors"
                  >
                    <Trash2 size={12} />
                    Clear
                  </button>
                )}
                <span className="text-xs bg-amber-50 text-amber-700 font-semibold px-3 py-1 rounded-full border border-amber-200">
                  Satellite View
                </span>
              </div>
            </div>

            {/* Leaflet Map */}
            <div className="flex-1 rounded-xl overflow-hidden min-h-[400px]">
              <MapContainer
                center={THANE_CENTER}
                zoom={18}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom
              >
                <TileLayer url={ESRI_TILE_URL} attribution={ESRI_ATTRIBUTION} maxZoom={20} />

                <MapClickHandler onMapClick={addPoint} />

                {/* Render marker dots for each clicked point */}
                {points.map(([lat, lng], i) => (
                  <Marker key={i} position={[lat, lng]} />
                ))}

                {/* Render filled polygon when ≥ 3 points */}
                {canTrace && (
                  <Polygon
                    positions={points}
                    pathOptions={{
                      color: '#3b82f6',
                      weight: 2,
                      dashArray: '8 4',
                      fillColor: 'rgba(59,130,246,0.20)',
                      fillOpacity: 1,
                    }}
                  />
                )}
              </MapContainer>
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

        {/* ── Right: Live Calculation Sidebar (35%) ── */}
        <div className="space-y-4 flex flex-col" style={{ flex: '0 0 35%' }}>
          <h2 className="text-base font-semibold text-slate-900 px-1">Live Calculations</h2>

          {liveMetrics.map((m, idx) => {
            const Icon = m.icon;
            return (
              <div
                key={idx}
                className={`bg-white rounded-2xl shadow-md p-5 transition-all ${
                  m.highlight
                    ? 'border-2 border-blue-500 shadow-blue-100 shadow-lg'
                    : 'border border-slate-100'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${m.bg}`}>
                    <Icon size={17} className={m.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 font-medium leading-tight">{m.label}</p>
                    <p className={`text-2xl font-bold mt-1 ${m.color} ${!canTrace && m.label !== 'Live Rainfall Data' ? 'opacity-30' : ''}`}>
                      {m.value}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{m.unit}</p>
                  </div>
                  {m.highlight && (
                    <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-md">KEY</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Peer-reviewed math note */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-xs text-green-700 mt-auto">
            <span className="font-semibold">✓ Peer-Reviewed Math:</span> Turf.js geospatial engine.
            Capex calibrated at ₹600/m² using 0.90 runoff coefficient and 20% obstacle deduction for the Mumbai Metropolitan Region (MMR).
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