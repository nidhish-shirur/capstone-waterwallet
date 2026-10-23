import React, { useMemo, useState, memo, useCallback, useEffect, useRef } from 'react';
import { Download, TrendingDown, IndianRupee, Clock, Droplets, SlidersHorizontal, Cpu, ShieldAlert, Sparkles, HelpCircle, FileSpreadsheet, FileCode } from 'lucide-react';
import {
  Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, ComposedChart, BarChart, Bar, Cell
} from 'recharts';
import { simulateROI, runMonteCarlo, getMLRecommendation, getWaterAdvisory, saveSocietyAnalysis, sizeTank } from '../api/waterwallet';
import { useWaterWallet } from '../context/WaterWalletContext';
import { ROOF_RUNOFF_COEFFICIENTS } from '../utils/waterConstants';
import { escapeCsvCell } from '../utils/csv';

// ─── Tank Visualizer Component (Faithful 3D Cylinder & Monthly Water Balance) ──
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MMR_RAIN_FRACTIONS = [0.0002, 0.0001, 0.0003, 0.0005, 0.0070, 0.2200, 0.3800, 0.2600, 0.1200, 0.0110, 0.0007, 0.0002];
const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function TankVisualizer({ tankSizerResult, nonPotableDailyDemand }) {
  const [activeMonth, setActiveMonth] = useState(7); // August (index 7, like in the reference image)
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTrends, setShowTrends] = useState(false);
  const playRef = useRef(null);

  // Compute steady-state monthly water balance for the selected tank capacity
  const monthlyData = useMemo(() => {
    if (!tankSizerResult?.selected_candidate?.years) return null;
    const years = tankSizerResult.selected_candidate.years;
    const capacity = Number(tankSizerResult.selected_candidate.capacity_litres);
    const avgAnnualInflow = years.reduce((s, y) => s + (y.total_inflow_litres || 0), 0) / years.length;
    const dailyDemand = nonPotableDailyDemand;

    // Simulate 2 consecutive years to reach cyclic steady-state tank storage
    let currentLevel = 0;
    const monthStats = [];

    for (let cycle = 0; cycle < 2; cycle++) {
      for (let i = 0; i < 12; i++) {
        const supply = avgAnnualInflow * MMR_RAIN_FRACTIONS[i];
        const demand = dailyDemand * DAYS_PER_MONTH[i];
        const netChange = supply - demand;
        const available = currentLevel + supply;
        const served = Math.min(available, demand);
        currentLevel = Math.max(0, Math.min(capacity, available - demand));
        const fillPct = capacity > 0 ? Math.min(100, Math.max(0, Math.round((currentLevel / capacity) * 100))) : 0;

        if (cycle === 1) {
          monthStats.push({
            month: MONTHS[i],
            supplyLitres: supply,
            demandLitres: demand,
            netChangeLitres: netChange,
            tankLevelLitres: currentLevel,
            servedLitres: served,
            unmetLitres: Math.max(0, demand - served),
            fillPct,
          });
        }
      }
    }
    return monthStats;
  }, [tankSizerResult, nonPotableDailyDemand]);

  useEffect(() => {
    if (isPlaying) {
      playRef.current = setInterval(() => {
        setActiveMonth(m => {
          if (m >= 11) {
            return 0; // Loop smoothly
          }
          return m + 1;
        });
      }, 1000);
    } else {
      clearInterval(playRef.current);
    }
    return () => clearInterval(playRef.current);
  }, [isPlaying]);

  if (!monthlyData || monthlyData.length === 0) return null;

  const current = monthlyData[activeMonth];
  const capacityLitres = Number(tankSizerResult.selected_candidate.capacity_litres);
  const capacityKL = (capacityLitres / 1000).toFixed(2);
  const currentKL = (current.tankLevelLitres / 1000).toFixed(2);
  const fillPct = current.fillPct;

  // Formatted numbers in "k" (e.g. +21.82 k, -16.74 k, +5.08 kl)
  const supplyFormatted = (current.supplyLitres / 1000).toFixed(2);
  const demandFormatted = (current.demandLitres / 1000).toFixed(2);
  const netChangeVal = current.netChangeLitres / 1000;
  const netChangeFormatted = Math.abs(netChangeVal).toFixed(2);
  const isNetPositive = netChangeVal >= 0;

  // Geometry parameters for 3D Cylinder SVG (matching reference mockup)
  const cylinderX = 75;
  const cylinderWidth = 150;
  const cylinderRadiusX = 75;
  const cylinderRadiusY = 16;
  const cylinderTopY = 28;
  const cylinderHeight = 190;
  const cylinderBottomY = cylinderTopY + cylinderHeight; // 218
  const waterHeight = (fillPct / 100) * cylinderHeight;
  const waterTopY = cylinderBottomY - waterHeight;

  return (
    <div className="mt-6 bg-[#fbfdfd] border border-slate-200/90 rounded-3xl p-6 md:p-8 shadow-sm">
      {/* Top Header matching reference image */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            TANK LEVEL — {MONTHS[activeMonth].toUpperCase()}
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl md:text-4xl font-serif font-extrabold text-[#231f1c]">
              {currentKL} kL
            </span>
            <span className="text-sm md:text-base text-slate-400 font-normal">
              of {capacityKL} kL
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsPlaying(prev => !prev)}
          className="flex items-center gap-1.5 bg-[#3a2e28] hover:bg-[#4d3e36] text-white text-xs font-semibold px-5 py-2 rounded-full transition-all shadow-sm cursor-pointer"
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
      </div>

      {/* Center Visualization: 3D Tank with Ticks and Readouts */}
      <div className="my-6 flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10">
        <div className="relative flex items-center justify-center">
          <svg width="270" height="260" viewBox="0 0 270 260" className="overflow-visible select-none">
            <defs>
              {/* Glass wall gradient with realistic lighting */}
              <linearGradient id="glassWallGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.5" />
                <stop offset="8%" stopColor="#cbd5e1" stopOpacity="0.25" />
                <stop offset="45%" stopColor="#f8fafc" stopOpacity="0.1" />
                <stop offset="92%" stopColor="#cbd5e1" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#64748b" stopOpacity="0.6" />
              </linearGradient>

              {/* Water body gradient */}
              <linearGradient id="tankWaterGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#0891b2" stopOpacity="0.95" />
                <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#0e7490" stopOpacity="0.98" />
              </linearGradient>

              {/* Water surface elliptical lid gradient */}
              <linearGradient id="waterSurfaceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#67e8f9" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>

              {/* Top glass rim gradient */}
              <linearGradient id="topRimGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#64748b" />
                <stop offset="50%" stopColor="#94a3b8" />
                <stop offset="100%" stopColor="#475569" />
              </linearGradient>

              {/* Clip path for water within cylinder */}
              <clipPath id="cylinderClip">
                <rect x={cylinderX} y={cylinderTopY} width={cylinderWidth} height={cylinderHeight + cylinderRadiusY} />
              </clipPath>
            </defs>

            {/* Drop shadow on floor beneath cylinder */}
            <ellipse
              cx={cylinderX + cylinderRadiusX}
              cy={cylinderBottomY + 8}
              rx={cylinderRadiusX + 6}
              ry={cylinderRadiusY}
              fill="#94a3b8"
              opacity="0.28"
            />

            {/* Percentage Tick Marks on Left side of cylinder */}
            {[
              { pct: 75, y: cylinderBottomY - 0.75 * cylinderHeight },
              { pct: 50, y: cylinderBottomY - 0.50 * cylinderHeight },
              { pct: 25, y: cylinderBottomY - 0.25 * cylinderHeight },
            ].map(({ pct, y }) => (
              <g key={pct}>
                <text
                  x={cylinderX - 16}
                  y={y + 4}
                  textAnchor="end"
                  className="text-[11px] font-medium fill-slate-400 select-none"
                >
                  {pct}%
                </text>
                <line
                  x1={cylinderX - 10}
                  y1={y}
                  x2={cylinderX}
                  y2={y}
                  stroke="#94a3b8"
                  strokeWidth="1.2"
                />
              </g>
            ))}

            {/* Back half of bottom base ellipse */}
            <ellipse
              cx={cylinderX + cylinderRadiusX}
              cy={cylinderBottomY}
              rx={cylinderRadiusX}
              ry={cylinderRadiusY}
              fill="#e2e8f0"
              opacity="0.6"
            />

            {/* Water Fill Layer */}
            {fillPct > 0 && (
              <g clipPath="url(#cylinderClip)">
                {/* Lower body of water */}
                <path
                  d={`
                    M ${cylinderX},${waterTopY}
                    L ${cylinderX},${cylinderBottomY}
                    A ${cylinderRadiusX} ${cylinderRadiusY} 0 0 0 ${cylinderX + cylinderWidth},${cylinderBottomY}
                    L ${cylinderX + cylinderWidth},${waterTopY}
                    Z
                  `}
                  fill="url(#tankWaterGrad)"
                  style={{ transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}
                />
                {/* 3D Top surface of water */}
                <ellipse
                  cx={cylinderX + cylinderRadiusX}
                  cy={waterTopY}
                  rx={cylinderRadiusX - 1}
                  ry={cylinderRadiusY - 1}
                  fill="url(#waterSurfaceGrad)"
                  stroke="#22d3ee"
                  strokeWidth="0.8"
                  style={{ transition: 'cy 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}
                />
              </g>
            )}

            {/* Translucent Cylinder Glass Body */}
            <rect
              x={cylinderX}
              y={cylinderTopY}
              width={cylinderWidth}
              height={cylinderHeight}
              fill="url(#glassWallGrad)"
              stroke="none"
            />

            {/* Left and Right vertical edge strokes of cylinder */}
            <line
              x1={cylinderX}
              y1={cylinderTopY}
              x2={cylinderX}
              y2={cylinderBottomY}
              stroke="#475569"
              strokeWidth="1.5"
            />
            <line
              x1={cylinderX + cylinderWidth}
              y1={cylinderTopY}
              x2={cylinderX + cylinderWidth}
              y2={cylinderBottomY}
              stroke="#475569"
              strokeWidth="1.5"
            />

            {/* Front half arc of bottom base */}
            <path
              d={`
                M ${cylinderX},${cylinderBottomY}
                A ${cylinderRadiusX} ${cylinderRadiusY} 0 0 0 ${cylinderX + cylinderWidth},${cylinderBottomY}
              `}
              fill="none"
              stroke="#475569"
              strokeWidth="1.5"
            />

            {/* Top 3D Elliptical Rim of Cylinder */}
            <ellipse
              cx={cylinderX + cylinderRadiusX}
              cy={cylinderTopY}
              rx={cylinderRadiusX}
              ry={cylinderRadiusY}
              fill="none"
              stroke="url(#topRimGrad)"
              strokeWidth="1.6"
            />
          </svg>
        </div>

        {/* Readout on the Right (Supply / Demand / Net change) */}
        <div className="flex flex-row md:flex-col justify-center gap-6 md:gap-5 min-w-[130px]">
          <div>
            <p className="text-xs text-slate-500 font-medium">Supply</p>
            <p className="text-base font-bold text-emerald-600 tracking-tight">
              +{supplyFormatted} k
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Demand</p>
            <p className="text-base font-bold text-[#b94723] tracking-tight">
              −{demandFormatted} k
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Net change</p>
            <p className={`text-base font-bold tracking-tight ${isNetPositive ? 'text-emerald-600' : 'text-[#b94723]'}`}>
              {isNetPositive ? '+' : '−'}{netChangeFormatted} kl
            </p>
          </div>
        </div>
      </div>

      {/* Month Scrubber Pills matching reference mockup */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 md:gap-2 mt-4">
        {MONTHS.map((m, idx) => {
          const isActive = idx === activeMonth;
          return (
            <button
              key={m}
              type="button"
              onClick={() => {
                setActiveMonth(idx);
                setIsPlaying(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#3a2e28] text-white shadow-sm scale-105'
                  : 'bg-[#f1f3f5] text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {m}
            </button>
          );
        })}
      </div>

      {/* Bottom capacity summary caption */}
      <p className="text-center text-xs text-slate-400 mt-3 font-normal">
        Tank at {fillPct}% capacity.
      </p>

      {/* Expandable Monthly Trends & Breakdown Chart */}
      <div className="mt-5 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={() => setShowTrends(prev => !prev)}
          className="mx-auto flex items-center gap-1.5 text-xs text-cyan-800 hover:text-cyan-900 font-semibold"
        >
          {showTrends ? 'Hide monthly supply vs demand chart ▲' : 'Show monthly supply vs demand chart ▼'}
        </button>

        {showTrends && (
          <div className="mt-4 pt-2">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart
                data={monthlyData}
                barGap={2}
                barSize={12}
                onClick={(e) => {
                  if (e?.activeTooltipIndex != null) {
                    setActiveMonth(e.activeTooltipIndex);
                    setIsPlaying(false);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 9, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v, name) => [`${(v / 1000).toFixed(2)} kL`, name]}
                  labelStyle={{ fontWeight: 'bold', fontSize: 11 }}
                  contentStyle={{ borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 11 }}
                />
                <Bar dataKey="supplyLitres" name="Rain Harvested" fill="#06b6d4" radius={[3, 3, 0, 0]}>
                  {monthlyData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={i === activeMonth ? '#0891b2' : '#06b6d4'}
                      opacity={i === activeMonth ? 1 : 0.65}
                    />
                  ))}
                </Bar>
                <Bar dataKey="demandLitres" name="Demand" fill="#f59e0b" radius={[3, 3, 0, 0]}>
                  {monthlyData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={i === activeMonth ? '#b45309' : '#f59e0b'}
                      opacity={i === activeMonth ? 1 : 0.6}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Scenario definitions ────────────────────────────────────────────────────
const SCENARIOS = [
  { key: 'conservative', label: 'Conservative',  gamma: 0.06, color: '#f59e0b', dash: '6 3' },
  { key: 'current',      label: 'Current',        gamma: 0.08, color: '#dc2626', dash: null  },
  { key: 'highRisk',     label: 'High-Risk',      gamma: 0.12, color: '#7c3aed', dash: '3 3' },
];
const ROI_HORIZON_YEARS = 10;
const DISPLAYED_SAVINGS_YEARS = 10;
const ROOF_USABLE_FACTOR = 0.80;
const NON_POTABLE_LPCD = 65;

function _escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// ─── ROI engine (pure function) ─────────────────────────────────────────────
function runScenario({
  annualTanker,
  annualMunicipal,
  annualTankerVolumeLitres,
  capex,
  gamma,
  annualYield,
  annualDemand,
  waterTariffPerKl = 15,
}) {
  const municipalInflation = 0.05;
  const rwhAmc             = 0.03;
  let cumulativeDoNothing  = 0;
  let cumulativeRWH        = capex;
  let breakEven            = null;
  const rows               = [];

  // Volumetric calculation in Litres
  const demandL = annualDemand || 0;
  const yieldL = annualYield || 0;
  // Effective harvestable yield capped by society annual demand
  // Annual yield is already rainfall/roof based; a refillable tank is not an
  // annual volume limit. Demand-gate the yield, but do not use tank * 4.
  const effectiveYield = Math.min(yieldL, demandL);

  const annualTankerVolumeL = Math.max(0, annualTankerVolumeLitres || 0);
  const tankerRatePerLitre = annualTankerVolumeL > 0
    ? (annualTanker * 100000) / annualTankerVolumeL
    : 0;
  const municipalRatePerLitre = waterTariffPerKl / 1000;
  
  const offsetTankerL = Math.min(effectiveYield, annualTankerVolumeL);
  const offsetMunicipalL = Math.min(effectiveYield - offsetTankerL, Math.max(0, demandL - annualTankerVolumeL));

  const savingsTankerLakhs = (offsetTankerL * tankerRatePerLitre) / 100000;
  const savingsMunicipalLakhs = (offsetMunicipalL * municipalRatePerLitre) / 100000;

  for (let i = 1; i <= ROI_HORIZON_YEARS; i++) {
    const thisYearTankerSavings = savingsTankerLakhs * Math.pow(1 + gamma, i - 1);
    const thisYearMunicipalSavings = savingsMunicipalLakhs * Math.pow(1 + municipalInflation, i - 1);
    const thisYearSavings = thisYearTankerSavings + thisYearMunicipalSavings;

    const thisYearTankerSpend = annualTanker * Math.pow(1 + gamma, i - 1);
    const thisYearMunicipalSpend = annualMunicipal * Math.pow(1 + municipalInflation, i - 1);
    
    const thisYearDoNothing = thisYearTankerSpend + thisYearMunicipalSpend;
    const thisYearRwhMaint = capex * rwhAmc;

    const thisYearWithRWH = thisYearDoNothing - thisYearSavings + thisYearRwhMaint;

    cumulativeDoNothing += thisYearDoNothing;
    cumulativeRWH       += thisYearWithRWH;

    if (!breakEven && cumulativeRWH < cumulativeDoNothing) breakEven = `Y${i}`;

    rows.push({
      year:        `Y${i}`,
      doNothing:   parseFloat(cumulativeDoNothing.toFixed(2)),
      withRWH:     parseFloat(cumulativeRWH.toFixed(2)),
    });
  }
  return {
    rows,
    breakEven: breakEven || `> ${ROI_HORIZON_YEARS} Yrs`,
    finalDoNothing: cumulativeDoNothing,
    annualSavings: Math.max(0, savingsTankerLakhs + savingsMunicipalLakhs - (capex * rwhAmc)),
  };
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────
const CustomTooltip = memo(function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xl p-4 text-xs min-w-[210px]">
      <p className="font-bold text-slate-700 mb-2">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-500 flex-1">{entry.name}:</span>
          <span className="font-semibold tabular-nums" style={{ color: entry.color }}>
            ₹{entry.value.toFixed(2)} L
          </span>
        </div>
      ))}
    </div>
  );
});

// ─── Break-Even Chart ───────────────────────────────────────────────────────
const BreakEvenChart = memo(function BreakEvenChart({ chartData, breakEvens }) {
  return (
    <ResponsiveContainer width="100%" height={340}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
        <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#f1f5f9" />
        <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 500 }}
               axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v) => `₹${v}L`}
               tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={58} />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }}
          formatter={(value) => <span style={{ color: '#64748b', fontWeight: 500 }}>{value}</span>}
        />

        {SCENARIOS.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={`Without RWH · ${s.label} (${(s.gamma * 100).toFixed(0)}% inflation)`}
            stroke={s.color}
            strokeWidth={2}
            strokeDasharray={s.dash || undefined}
            dot={false}
            activeDot={{ r: 5, fill: s.color }}
          />
        ))}

        <Area
          type="monotone"
          dataKey="withRWH"
          name="Cost with RWH"
          stroke="#16a34a"
          strokeWidth={2.5}
          fill="rgba(22,163,74,0.07)"
          dot={{ r: 3, fill: '#16a34a', strokeWidth: 0 }}
          activeDot={{ r: 6, fill: '#16a34a' }}
        />

        {SCENARIOS.map((s) =>
          breakEvens[s.key] &&           breakEvens[s.key] !== `> ${ROI_HORIZON_YEARS} Yrs` ? (
            <ReferenceLine
              key={`ref-${s.key}`}
              x={breakEvens[s.key]}
              stroke={s.color}
              strokeDasharray="4 2"
              strokeWidth={1}
              label={{
                value: `${s.label} B/E`,
                position: 'insideTopRight',
                fontSize: 9,
                fill: s.color,
                fontWeight: 700,
              }}
            />
          ) : null
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
});

// ─── Monte Carlo Payback Probability Distribution Component ──────────────────
const MonteCarloChart = memo(function MonteCarloChart({ probData }) {
  if (!probData) return null;
  const chartData = Object.keys(probData).map((yr) => ({
    year: `Year ${yr}`,
    probability: Math.round(probData[yr] * 100),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} domain={[0, 100]} />
        <Tooltip formatter={(val) => [`${val}% Probability`, 'Break-even Achieved']} />
        <Bar dataKey="probability" radius={[6, 6, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.probability > 70 ? '#16a34a' : entry.probability > 30 ? '#3b82f6' : '#94a3b8'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});

function ImplementationPlan({ payback, recommendedConfiguration }) {
  const [expanded, setExpanded] = useState(false);
  const steps = [
    'Verify rooftop structural capacity and available storage area.',
    'Obtain at least two installation quotations using the estimated configuration.',
    'Confirm tank placement, filtration, overflow, and maintenance responsibilities.',
    'Track actual water usage through the first monsoon and compare it with this forecast.',
  ];

  return (
    <section className="bg-white rounded-2xl shadow-md border border-slate-100">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="w-full flex items-center justify-between gap-4 p-6 text-left"
        aria-expanded={expanded}
      >
        <div>
          <h2 className="text-base font-bold text-slate-800">Suggested Implementation Plan</h2>
          <p className="text-xs text-slate-500 mt-1">
            Optional practical next steps based on the current simulation.
          </p>
        </div>
        <span className="text-xs font-semibold text-indigo-700">{expanded ? 'Hide' : 'Show'} steps</span>
      </button>
      {expanded && (
        <div className="px-6 pb-6">
          <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4 mb-4 text-sm text-indigo-900">
            Start by validating the recommended <strong>{recommendedConfiguration}</strong> configuration.
            The current estimate indicates a payback of <strong>{payback}</strong>, subject to site
            verification and actual rainfall.
          </div>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-700">
            {steps.map((step) => <li key={step}>{step}</li>)}
          </ol>
        </div>
      )}
    </section>
  );
}

// ─── Site & Simulation Parameters Controls ───────────────────────────────────
function SiteSimulationControls({
  rooftopArea,
  onRooftopChange,
  borewell,
  onBorewellChange,
  borewellDepth,
  onBorewellDepthChange,
  soilPerm,
  onSoilPermChange,
  coastalKm,
  onCoastalKmChange,
  capexRatePerSqm,
  onCapexRateChange,
  tankCapacityLitres,
  onTankCapacityChange,
  rainfallReductionPercent,
  onRainfallReductionChange,
}) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-6 border border-slate-100 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="text-blue-600" size={18} />
          <h2 className="text-sm font-bold text-slate-800">
            Interactive What-If Simulator & Site Parameters
          </h2>
        </div>
        <span className="text-xs text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full font-medium">
          Modify any parameter below to recalculate AI recommendation live
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Rooftop Area */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex justify-between items-center mb-1">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Rooftop Area
            </label>
            <span className="text-xs font-black text-blue-700">
              {Math.round(rooftopArea)} m²
            </span>
          </div>
          <input
            type="range"
            min={100}
            max={1800}
            step={25}
            value={Math.round(rooftopArea)}
            onChange={(e) => onRooftopChange(Number(e.target.value))}
            className="w-full accent-blue-600 mt-1"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>100 m²</span>
            <span className="text-blue-600 font-semibold">500 m² (Threshold)</span>
            <span>1800 m²</span>
          </div>
        </div>

        {/* Storage capacity sensitivity */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex justify-between items-center mb-1">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Tank Capacity
            </label>
            <span className="text-xs font-black text-blue-700">{tankCapacityLitres.toLocaleString()} L</span>
          </div>
          <input
            type="range"
            min={10000}
            max={100000}
            step={5000}
            value={tankCapacityLitres}
            onChange={(e) => onTankCapacityChange(Number(e.target.value))}
            className="w-full accent-blue-600 mt-1"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>10,000 L</span><span>100,000 L</span>
          </div>
        </div>

        {/* Rainfall sensitivity */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex justify-between items-center mb-1">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Rainfall Reduction
            </label>
            <span className="text-xs font-black text-blue-700">{rainfallReductionPercent}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={50}
            step={5}
            value={rainfallReductionPercent}
            onChange={(e) => onRainfallReductionChange(Number(e.target.value))}
            className="w-full accent-blue-600 mt-1"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>Current rainfall</span><span>50% lower</span>
          </div>
        </div>

        {/* 2. Existing Borewells & Depth */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex justify-between items-center mb-1">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Borewell Presence
            </label>
            <div className="flex rounded-md overflow-hidden border border-slate-300">
              <button
                type="button"
                onClick={() => onBorewellChange(1)}
                className={`px-2.5 py-0.5 text-xs font-bold transition-colors ${
                  borewell === 1
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => onBorewellChange(0)}
                className={`px-2.5 py-0.5 text-xs font-bold transition-colors ${
                  borewell === 0
                    ? 'bg-red-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                No
              </button>
            </div>
          </div>

          <div className="mt-2">
            <div className="flex justify-between items-center text-[11px] text-slate-600 mb-0.5">
              <span>Borewell Depth:</span>
              <span className={`font-bold ${borewell === 0 ? 'text-slate-400' : 'text-blue-700'}`}>
                {borewell === 1 ? `${Math.round(borewellDepth)} m` : 'N/A (No Borewell)'}
              </span>
            </div>
            <input
              type="range"
              min={15}
              max={180}
              step={5}
              disabled={borewell === 0}
              value={borewell === 1 ? Math.round(borewellDepth) : 0}
              onChange={(e) => onBorewellDepthChange(Number(e.target.value))}
              className="w-full accent-blue-600 disabled:opacity-30"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
              <span className={borewellDepth < 30 && borewell === 1 ? "text-amber-600 font-bold" : ""}>&lt; 30m (Unsafe)</span>
              <span>80m</span>
              <span>180m</span>
            </div>
          </div>
        </div>

        {/* 3. Soil Permeability */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex justify-between items-center mb-1">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Soil Permeability
            </label>
            <span className="text-xs font-bold text-blue-700">
              Class {soilPerm}
            </span>
          </div>
          <select
            value={soilPerm}
            onChange={(e) => onSoilPermChange(Number(e.target.value))}
            className="w-full mt-1 border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-medium focus:ring-1 focus:ring-blue-500 bg-white"
          >
            <option value={1}>1 - Clay (Impermeable)</option>
            <option value={2}>2 - Silt (Poor Infiltration)</option>
            <option value={3}>3 - Loam (Moderate - MMR Standard)</option>
            <option value={4}>4 - Sandy Loam / Laterite (Good)</option>
            <option value={5}>5 - Gravel / Coarse Sand (High)</option>
          </select>
          <p className="text-[10px] text-slate-400 mt-1 leading-snug">
            {soilPerm <= 1
              ? '⚠️ Class 1 impermeable clay forces Storage-Only.'
              : soilPerm >= 3
              ? '✓ Permeable subsoil supports borewell recharge.'
              : 'Moderate absorption capacity.'}
          </p>
        </div>

        {/* 4. Distance to Coast */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex justify-between items-center mb-1">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Coastal Proximity
            </label>
            <span className={`text-xs font-black ${coastalKm <= 2.5 ? 'text-amber-600' : 'text-blue-700'}`}>
              {coastalKm.toFixed(1)} km
            </span>
          </div>
          <input
            type="range"
            min={0.5}
            max={35}
            step={0.5}
            value={coastalKm}
            onChange={(e) => onCoastalKmChange(Number(e.target.value))}
            className="w-full accent-blue-600 mt-1"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span className={coastalKm <= 2.5 ? "text-amber-600 font-bold" : ""}>&le; 2.5 km (Salinity Risk)</span>
            <span>15 km</span>
            <span>35 km</span>
          </div>
        </div>

        {/* 5. Capex Sensitivity */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 md:col-span-2">
          <div className="flex justify-between items-center mb-1">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Capex Rate (Sensitivity)
            </label>
            <span className="text-xs font-bold text-blue-700">₹{capexRatePerSqm}/m²</span>
          </div>
          <input
            type="range"
            min={400}
            max={800}
            step={50}
            value={capexRatePerSqm}
            onChange={(e) => onCapexRateChange(Number(e.target.value))}
            className="w-full accent-blue-600 mt-1"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>₹400 (Economy)</span>
            <span className="text-blue-600 font-semibold">₹600 (MMR DSR Standard)</span>
            <span>₹800 (Premium)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Self-Sufficiency Badge ──────────────────────────────────────────────────
function SelfSufficiencyBadge({ annualYield, annualDemand }) {
  if (!annualYield || !annualDemand) return null;
  const pct    = Math.min(100, Math.round((annualYield / annualDemand) * 100));
  const isGood = pct >= 50;
  return (
    <div className={`rounded-2xl p-5 border shadow-md flex items-center gap-4 ${
      isGood ? 'bg-teal-50 border-teal-200' : 'bg-amber-50 border-amber-200'
    }`}>
      <div className={`w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 border-4 ${
        isGood ? 'border-teal-400 bg-teal-100' : 'border-amber-400 bg-amber-100'
      }`}>
        <span className={`text-xl font-extrabold ${isGood ? 'text-teal-700' : 'text-amber-700'}`}>
          {pct}%
        </span>
      </div>
      <div>
        <p className={`text-sm font-bold ${isGood ? 'text-teal-800' : 'text-amber-800'}`}>
          Rooftop Self-Sufficiency
        </p>
        <p className={`text-xs mt-0.5 leading-relaxed ${isGood ? 'text-teal-700' : 'text-amber-700'}`}>
          Your roof can supply <strong>{pct}%</strong> of annual water demand.{' '}
          {isGood
            ? 'Excellent coverage — RWH is strongly viable.'
            : 'Supplement with a larger tank or expanded catchment area.'}
        </p>
      </div>
      <Droplets size={24} className={`flex-shrink-0 ${isGood ? 'text-teal-400' : 'text-amber-400'}`} />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ROIDashboard() {
  const {
    societyId,
    totalTankerSpend, totalMunicipal, totalTankerVolume, billingMonths,
    estimatedCapex, setEstimatedCapex,
    annualYield, setAnnualYield,
    mlAnnualYield,
    annualDemand, capexRatePerSqm, setCapexRatePerSqm,
    grossRoofArea, setGrossRoofArea,
    societyName, flats, occupants, pincode,
    borewell, setBorewell,
    borewellDepth, setBorewellDepth,
    soilPerm, setSoilPerm,
    coastalKm, setCoastalKm,
    monthlyRainfall,
    roofSurfaceType, siteLatitude, siteLongitude,
    nonPotableDemand,
    rainfallSource,
    tankCapacityLitres, setTankCapacityLitres,
    roofPolygonPoints, polygonGeoJSON,
  } = useWaterWallet();

  // ─── ML vs Physics yield source toggle ───────────────────────────────────
  const [yieldSource, setYieldSource] = useState('physics'); // 'physics' | 'ml'
  const hasMlYield = mlAnnualYield != null && mlAnnualYield > 0;
  // Active yield: use ML if toggle is set to 'ml' and ML data is available
  const activeAnnualYield = yieldSource === 'ml' && hasMlYield ? mlAnnualYield : annualYield;
  const mlDeviationPct = hasMlYield && annualYield > 0
    ? (((mlAnnualYield - annualYield) / annualYield) * 100).toFixed(1)
    : null;

  // Phase 2 prices usable roof area (gross area × obstacle factor). Recover
  // the gross area for display/ML while preserving the exact Phase 2 capex.
  const tracedAreaProxy = Math.max(0, Number(grossRoofArea) || 0);
  const adjustedCapex = Math.max(0, Number(estimatedCapex) || tracedAreaProxy * ROOF_USABLE_FACTOR * capexRatePerSqm);

  const months          = billingMonths || 1;
  const annualTanker    = ((totalTankerSpend / months) * 12) / 100000;
  const annualMunicipal = ((totalMunicipal   / months) * 12) / 100000;
  const annualTankerVolumeLitres = ((totalTankerVolume / months) * 12) || 0;
  const capex           = adjustedCapex / 100000;
  const nonPotableDemandLitres = Number(nonPotableDemand) > 0
    ? Number(nonPotableDemand)
    : Math.max(0, Number(flats || 0) * Number(occupants || 0) * NON_POTABLE_LPCD * 365);
  const nonPotableDailyDemand = nonPotableDemandLitres / 365;
  const municipalVolumeLitres = Math.max(0, nonPotableDemandLitres - annualTankerVolumeLitres);
  const fallbackMunicipalTariffPerKl = 15.0;
  const municipalTariffIsFallback = !(municipalVolumeLitres > 0 && annualMunicipal > 0);
  const municipalTariffPerKl = !municipalTariffIsFallback
    ? (annualMunicipal * 100000) / (municipalVolumeLitres / 1000)
    : fallbackMunicipalTariffPerKl;
  const [rainfallReductionPercent, setRainfallReductionPercent] = useState(0);
  const [tankSizerResult, setTankSizerResult] = useState(null);
  const [tankSizerLoading, setTankSizerLoading] = useState(false);
  const [tankSizerError, setTankSizerError] = useState(null);
  const [tankApplied, setTankApplied] = useState(false);
  const effectiveAnnualYield = activeAnnualYield * (1 - rainfallReductionPercent / 100);

  // ─── Apply Tank Sizer recommendation to ROI slider ───────────────────────
  const handleApplyRecommendedTank = useCallback(() => {
    if (tankSizerResult?.selected_candidate?.capacity_litres) {
      const cap = Number(tankSizerResult.selected_candidate.capacity_litres);
      if (cap > 0) {
        setTankCapacityLitres(Math.min(Math.max(cap, 5000), 100000));
        setTankApplied(true);
      }
    }
  }, [tankSizerResult, setTankCapacityLitres]);

  const handleRunTankSizer = useCallback(async () => {
    setTankSizerLoading(true);
    setTankSizerError(null);
    try {
      const result = await sizeTank({
        latitude: Number(siteLatitude),
        longitude: Number(siteLongitude),
        gross_roof_area_sqm: tracedAreaProxy,
        roof_surface_type: roofSurfaceType || 'concrete',
        daily_demand_litres: nonPotableDemandLitres / 365,
        tanker_rate_per_litre: annualTankerVolumeLitres > 0
          ? (annualTanker * 100000) / annualTankerVolumeLitres
          : 0.8,
        tank_cost_per_litre: 4,
        fixed_system_cost: 7200,
        reliability_target_percent: 40,
        recharge_enabled: Boolean(borewell),
      });
      setTankSizerResult(result);
    } catch (error) {
      setTankSizerError(error.response?.data?.detail || error.message || 'Daily tank sizing failed.');
    } finally {
      setTankSizerLoading(false);
    }
  }, [siteLatitude, siteLongitude, tracedAreaProxy, roofSurfaceType, nonPotableDemandLitres, annualTankerVolumeLitres, annualTanker, borewell]);

  const handleRooftopChange = useCallback((newArea) => {
    const area = Math.max(50, Number(newArea));
    setGrossRoofArea(area);
    setEstimatedCapex(area * ROOF_USABLE_FACTOR * capexRatePerSqm);
    const annualRainfall = monthlyRainfall?.some((value) => value > 0)
      ? monthlyRainfall.reduce((sum, value) => sum + Number(value || 0), 0)
      : 2424;
    const runoffCoefficient = ROOF_RUNOFF_COEFFICIENTS[roofSurfaceType] || 0.90;
    setAnnualYield(Math.round(area * ROOF_USABLE_FACTOR * annualRainfall * runoffCoefficient));
  }, [capexRatePerSqm, monthlyRainfall, roofSurfaceType, setEstimatedCapex, setAnnualYield, setGrossRoofArea]);

  const handleCapexRateChange = useCallback((rate) => {
    setCapexRatePerSqm(rate);
    setEstimatedCapex(tracedAreaProxy * ROOF_USABLE_FACTOR * rate);
  }, [setCapexRatePerSqm, setEstimatedCapex, tracedAreaProxy]);

  // Local fallback if backend fails
  const localChartData = useMemo(() => {
    const results = {};
    SCENARIOS.forEach((s) => {
      results[s.key] = runScenario({
        annualTanker,
        annualMunicipal,
        annualTankerVolumeLitres,
        capex,
        gamma: s.gamma,
        annualYield: effectiveAnnualYield,
        annualDemand: nonPotableDemandLitres,
        tankCapacityLitres,
      });
    });

    const rows = results.conservative.rows.map((r, i) => ({
      year:         r.year,
      conservative: results.conservative.rows[i].doNothing,
      current:      results.current.rows[i].doNothing,
      highRisk:     results.highRisk.rows[i].doNothing,
      withRWH:      results.current.rows[i].withRWH,
      withRWHConservative: results.conservative.rows[i].withRWH,
      withRWHCurrent: results.current.rows[i].withRWH,
      withRWHHighRisk: results.highRisk.rows[i].withRWH,
    }));

    return {
      chartData: rows,
      breakEvens: {
        conservative: results.conservative.breakEven,
        current:      results.current.breakEven,
        highRisk:     results.highRisk.breakEven,
      },
      tenYearBleedRange: {
        low:  results.conservative.finalDoNothing.toFixed(2),
        high: results.highRisk.finalDoNothing.toFixed(2),
      },
      investmentSummary: {
        annualSavings: results.current.annualSavings,
        tenYearNetBenefit: results.current.rows[9]
          ? results.current.rows[9].doNothing - results.current.rows[9].withRWH
          : 0,
      },
    };
  }, [annualTanker, annualMunicipal, annualTankerVolumeLitres, capex, effectiveAnnualYield, nonPotableDemandLitres, tankCapacityLitres]);

  // ─── ML & Monte Carlo & ROI States ────────────────────────────────────────
  const [monteCarloResult, setMonteCarloResult] = useState(null);
  const [mlRecommendResult, setMlRecommendResult] = useState(null);
  const [roiResult, setRoiResult] = useState(null);
  const [loadingML, setLoadingML] = useState(true);
  const [errorStatus, setErrorStatus] = useState(null);
  const roiRequestId = useRef(0);
  const [waterAdvisory, setWaterAdvisory] = useState(null);
  const [advisoryLoading, setAdvisoryLoading] = useState(false);
  const [advisoryError, setAdvisoryError] = useState(null);
  const [advisoryFocus, setAdvisoryFocus] = useState('overall decision');

  // ─── Fetch ML Recommendation & Monte Carlo from Backend ─────────────────────
  useEffect(() => {
    const requestId = ++roiRequestId.current;
    const cancelStaleRequest = () => {
      if (roiRequestId.current === requestId) roiRequestId.current += 1;
    };
    if (!tracedAreaProxy || !annualDemand) {
      setMonteCarloResult(null);
      setMlRecommendResult(null);
      setRoiResult(null);
      setErrorStatus(null);
      setLoadingML(false);
      return cancelStaleRequest;
    }
    setLoadingML(true);
    setErrorStatus(null);

    // Case A: RWH is modelled for eligible non-potable uses only.
    const monthlyDemandKl = (nonPotableDemandLitres / 12) / 1000;
    const rooftopSqm = tracedAreaProxy;
    const rainMm = (monthlyRainfall && monthlyRainfall.some(v => v > 0))
      ? monthlyRainfall.reduce((a, b) => a + b, 0)
      : 2424;
    const maxMonthRain = (monthlyRainfall && monthlyRainfall.length > 0) ? Math.max(...monthlyRainfall) : 710;
    const peakDay = Math.max(50, (maxMonthRain / 4) || 120);
    const tankerRatePerKl = (annualTanker > 0 && annualTankerVolumeLitres > 0)
      ? ((annualTanker * 100000) / (annualTankerVolumeLitres / 1000))
      : 150.0;

    // 1. Monte Carlo API
    const mcPromise = runMonteCarlo({
      rooftop_area_m2: rooftopSqm,
      monthly_demand_kl: monthlyDemandKl,
      monthly_rainfall_mm: (rainfallSource === 'phase2_historical' && monthlyRainfall?.length === 12)
        ? monthlyRainfall
        : undefined,
      capex_inr: adjustedCapex,
      tank_capacity_litres: tankCapacityLitres,
      roof_surface_type: roofSurfaceType || 'concrete',
      rainfall_reduction_percent: rainfallReductionPercent,
      tanker_rate_per_kl: tankerRatePerKl,
      annual_tanker_volume_litres: annualTankerVolumeLitres,
      water_tariff_per_kl: municipalTariffPerKl,
      inflation_rate: 0.08,
      n_scenarios: 1000,
    }).catch(() => { console.error("Monte Carlo Failed"); return null; });

    // 2. Dual-Tier ML Recommendation API
    const recPromise = getMLRecommendation({
      rooftop_area: rooftopSqm,
      borewell: Number(borewell) || 0,
      borewell_depth: Number(borewell) === 1 ? (Number(borewellDepth) || 0) : 0,
      soil_perm: Number(soilPerm) || 3,
      coastal_km: Number.isFinite(Number(coastalKm)) ? Number(coastalKm) : 10,
      annual_rain_mm: rainMm,
      peak_day_mm: peakDay,
    }).catch(e => { console.error("ML Recommend Failed", e); return null; });

    // 3. ROI Backend Simulator (3 Scenarios)
    const roiPromises = SCENARIOS.map(s => 
      simulateROI({
        daily_demand_lpd: nonPotableDailyDemand,
        annual_yield_litres: effectiveAnnualYield,
        tank_capacity_litres: tankCapacityLitres,
        water_tariff_per_kl: municipalTariffPerKl,
        installation_cost: adjustedCapex,
        years: ROI_HORIZON_YEARS,
        tariff_escalation_rate: s.gamma,
        annual_tanker_spend: annualTanker * 100000,
        annual_tanker_volume_litres: annualTankerVolumeLitres,
        annual_municipal_spend: annualMunicipal * 100000
      }).catch(() => null)
    );

    Promise.all([mcPromise, recPromise, ...roiPromises])
      .then(([mcData, recData, ...roiDataArray]) => {
        if (requestId !== roiRequestId.current) return;
        setMonteCarloResult(mcData);
        setMlRecommendResult(recData);
        
        // If all 3 ROI calls succeeded, map them to UI structure
        if (roiDataArray[0] && roiDataArray[1] && roiDataArray[2]) {
           // Older backend processes may still return the legacy 10-year
           // payload. Use the local canonical calculation until the full
           // horizon response is available instead of indexing missing rows.
           const hasFullHorizon = roiDataArray.every(
             (result) => result.yearly_breakdown.length >= ROI_HORIZON_YEARS
           );
           if (!hasFullHorizon) {
             setRoiResult(null);
             setErrorStatus('The backend returned an incomplete ROI horizon; showing local estimates instead.');
             setLoadingML(false);
             return;
           }
           const rows = [];
           const bEvens = {};
           
           for (let i = 0; i < ROI_HORIZON_YEARS; i++) {
             rows.push({
               year: `Y${i+1}`,
               conservative: roiDataArray[0].yearly_breakdown[i].cumulative_without_rwh / 100000,
               current: roiDataArray[1].yearly_breakdown[i].cumulative_without_rwh / 100000,
               highRisk: roiDataArray[2].yearly_breakdown[i].cumulative_without_rwh / 100000,
               withRWH: roiDataArray[1].yearly_breakdown[i].cumulative_with_rwh / 100000,
               withRWHConservative: roiDataArray[0].yearly_breakdown[i].cumulative_with_rwh / 100000,
               withRWHCurrent: roiDataArray[1].yearly_breakdown[i].cumulative_with_rwh / 100000,
               withRWHHighRisk: roiDataArray[2].yearly_breakdown[i].cumulative_with_rwh / 100000,
             });
           }
           
           const formatPayback = (years) =>
             Number.isFinite(years) && years > 0
               ? `Y${Math.ceil(years)}`
               : `> ${ROI_HORIZON_YEARS} Yrs`;
           bEvens.conservative = formatPayback(roiDataArray[0].payback_years);
           bEvens.current = formatPayback(roiDataArray[1].payback_years);
           bEvens.highRisk = formatPayback(roiDataArray[2].payback_years);
           
           const roiState = {
             chartData: rows,
             breakEvens: bEvens,
             tenYearBleedRange: {
               low: (roiDataArray[0].yearly_breakdown[9].cumulative_without_rwh / 100000).toFixed(2),
               high: (roiDataArray[2].yearly_breakdown[9].cumulative_without_rwh / 100000).toFixed(2)
             }
           };
           
           setRoiResult(roiState);
           
           if (societyId) {
             saveSocietyAnalysis(societyId, {
               estimated_capex: adjustedCapex,
               annual_yield_l: effectiveAnnualYield,
               annual_demand_l: annualDemand,
               computed_data: {
                 monte_carlo: mcData,
                 ml_recommend: recData,
                 roi: roiState,
                 eligible_non_potable_demand_l: nonPotableDemandLitres,
                 gross_roof_area_sqm: tracedAreaProxy,
                 monthly_rainfall_mm: monthlyRainfall,
                 site_latitude: siteLatitude,
                 site_longitude: siteLongitude,
                 roof_surface_type: roofSurfaceType,
                 tank_capacity_litres: tankCapacityLitres,
                 roof_polygon_points: roofPolygonPoints || null,
                 polygon_geojson: polygonGeoJSON || (roofPolygonPoints && roofPolygonPoints.length >= 3 ? {
                   type: 'Feature',
                   geometry: {
                     type: 'Polygon',
                     coordinates: [[...roofPolygonPoints.map(([lat, lng]) => [lng, lat]), [roofPolygonPoints[0][1], roofPolygonPoints[0][0]]]]
                   },
                   properties: { gross_roof_area_sqm: tracedAreaProxy }
                 } : null),
               }
             }).catch(e => console.error("Analysis save error", e));
           }
        } else {
          setRoiResult(null);
        }
        
        if (!mcData || !recData || roiDataArray.some((result) => !result)) {
          setErrorStatus('Some backend analyses failed; local estimates are shown where available.');
        }
        setLoadingML(false);
      })
      .catch((err) => {
        if (requestId !== roiRequestId.current) return;
        console.error("Dashboard fetch error:", err);
        setErrorStatus("API connection failed. Using local estimations.");
        setLoadingML(false);
      });
    return cancelStaleRequest;
  }, [societyId, tracedAreaProxy, annualDemand, nonPotableDemandLitres, nonPotableDailyDemand, adjustedCapex, borewell, borewellDepth, soilPerm, coastalKm, monthlyRainfall, rainfallSource, annualYield, effectiveAnnualYield, tankCapacityLitres, rainfallReductionPercent, annualTanker, annualTankerVolumeLitres, annualMunicipal, municipalTariffPerKl, roofSurfaceType, siteLatitude, siteLongitude, roofPolygonPoints, polygonGeoJSON]);

  // Use API result or fallback to local
  const chartData = roiResult?.chartData || localChartData.chartData;
  const breakEvens = roiResult?.breakEvens || localChartData.breakEvens;
  const currentPayback = breakEvens.current || `> ${ROI_HORIZON_YEARS} Yrs`;
  const recommendationStatus = currentPayback === `> ${ROI_HORIZON_YEARS} Yrs`
    ? 'Recommended with caution'
    : effectiveAnnualYield <= 0
    ? 'Not currently recommended'
    : 'Recommended';
  const recommendationTone = recommendationStatus === 'Recommended'
    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
    : recommendationStatus === 'Recommended with caution'
    ? 'bg-amber-50 border-amber-200 text-amber-800'
    : 'bg-slate-100 border-slate-200 text-slate-700';
  const paybackYear = Number.parseInt(currentPayback.replace('Y', ''), 10);
  const paybackComparisonIndex = Number.isFinite(paybackYear)
    ? Math.min(Math.max(paybackYear, 1), chartData.length) - 1
    : chartData.length - 1;
  const costWithoutRwhAtPayback = chartData[paybackComparisonIndex]?.current
    ?? chartData[chartData.length - 1]?.current
    ?? 0;
  const investmentSummary = localChartData.investmentSummary;
  const annualAMC = adjustedCapex * 0.03;
  const isSafetyFlagged = Boolean(mlRecommendResult?.safety_triggered);

  const yearlyData = useMemo(() => {
    return chartData.map((row, index) => {
      const cumWithout = (row.current || 0) * 100000;
      const cumWith = (row.withRWH || 0) * 100000;
      const netBenefit = cumWithout - cumWith;
      const prevNetBenefit = index > 0
        ? ((chartData[index - 1].current || 0) - (chartData[index - 1].withRWH || 0)) * 100000
        : 0;
      const savings = index === 0 ? netBenefit : netBenefit - prevNetBenefit;
      return {
        year: row.year,
        cumulativeWithoutRwh: cumWithout,
        cumulativeWithRwh: cumWith,
        savings: Math.max(0, savings),
        netBenefit,
      };
    });
  }, [chartData]);
  const featureLabels = {
    rooftop_area: 'Rooftop area provides collection potential',
    borewell: 'Existing borewell availability affects recharge options',
    borewell_depth: 'Borewell depth affects recharge feasibility',
    soil_perm: 'Soil permeability affects groundwater recharge',
    coastal_km: 'Coastal distance affects groundwater safety',
    annual_rain_mm: 'Annual rainfall affects available water',
    peak_day_mm: 'Peak rainfall affects storage requirements',
  };

  const handleGenerateAdvisory = useCallback(async (focus = advisoryFocus) => {
    setAdvisoryLoading(true);
    setAdvisoryError(null);
    setAdvisoryFocus(focus);
    try {
      const advisoryPayload = {
        focus: String(focus || 'overall decision'),
        society_name: String(societyName || 'Society'),
        flats: Number(flats),
        occupants_per_flat: Number(occupants),
        annual_demand_litres: Number(nonPotableDemandLitres),
        annual_yield_litres: Number(effectiveAnnualYield),
        estimated_capex_inr: Number(adjustedCapex),
        current_annual_water_cost_inr: Number((annualTanker + annualMunicipal) * 100000),
        payback_years: String(breakEvens.current || `> ${ROI_HORIZON_YEARS} Yrs`),
        self_sufficiency_percent: Math.min(
          100,
          Math.max(0, Math.round((Number(effectiveAnnualYield) / Number(nonPotableDemandLitres)) * 100)),
        ),
        recommended_configuration: String(mlRecommendResult?.config || 'Pending'),
        monte_carlo_median_breakeven_year: monteCarloResult?.median_breakeven_year ?? null,
        monte_carlo_never_break_even_percent: monteCarloResult?.never_break_even_pct ?? null,
      };
      const advisory = await getWaterAdvisory(advisoryPayload);
      setWaterAdvisory(advisory);
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (detail) {
        setAdvisoryError(detail);
      } else if (error.request) {
        setAdvisoryError('The advisory service could not be reached. Make sure the FastAPI backend is running on port 8000.');
      } else {
        setAdvisoryError(error.message || 'Unable to generate the advisory right now.');
      }
    } finally {
      setAdvisoryLoading(false);
    }
  }, [
    societyName, flats, occupants, nonPotableDemandLitres, effectiveAnnualYield, adjustedCapex,
    annualTanker, annualMunicipal, breakEvens, mlRecommendResult,
    monteCarloResult, advisoryFocus,
  ]);

  const handleDownloadReport = useCallback(() => {
    // Trigger direct print using our refined @media print stylesheet
    window.print();
  }, []);

  // ─── Audit CSV Export ────────────────────────────────────────────────────────
  const handleExportCSV = useCallback(() => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeSociety = (societyName || 'Society').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `waterwallet_audit_${safeSociety}_${timestamp}.csv`;

    const effectiveTankerTariffVal = (annualTankerVolumeLitres > 0)
      ? (annualTanker * 100000) / (annualTankerVolumeLitres / 1000)
      : 150.0;

    const csvRows = [
      ['WATERWALLET COMPREHENSIVE RWH AUDIT REPORT'],
      ['Generated At', new Date().toLocaleString('en-IN')],
      ['Application', 'WaterWallet Decision-Support System (MMR)'],
      [],
      ['=== 1. SOCIETY & CATCHMENT PROFILE ==='],
      ['Field', 'Value', 'Unit'],
      ['Society Name', societyName || 'Residential Society', ''],
      ['Pincode', pincode || 'N/A', ''],
      ['Flats / Units', flats || 0, 'units'],
      ['Occupants per Flat', occupants || 0, 'persons/flat'],
      ['Total Estimated Population', (Number(flats) || 0) * (Number(occupants) || 0), 'persons'],
      ['Gross Rooftop Catchment Area', Number(grossRoofArea).toFixed(1), 'm²'],
      ['Usable Catchment Area (80% factor)', (Number(grossRoofArea) * ROOF_USABLE_FACTOR).toFixed(1), 'm²'],
      ['Roof Surface Material', roofSurfaceType || 'Concrete (RCC)', ''],
      ['Runoff Coefficient', ROOF_RUNOFF_COEFFICIENTS[roofSurfaceType] || 0.90, ''],
      ['Annual Rainfall Baseline', Number(effectiveAnnualYield > 0 && grossRoofArea > 0 ? (effectiveAnnualYield / (grossRoofArea * ROOF_USABLE_FACTOR * 0.9)).toFixed(0) : 2200), 'mm/yr'],
      [],
      ['=== 2. WATER DEMAND & UTILITY BILLING ==='],
      ['Field', 'Value', 'Unit'],
      ['Daily Non-Potable Demand', nonPotableDailyDemand.toFixed(0), 'L/day'],
      ['Annual Non-Potable Demand', (nonPotableDemandLitres / 1000).toFixed(1), 'kL/year'],
      ['Annual Tanker Water Spend', (annualTanker * 100000).toFixed(0), 'INR/yr'],
      ['Annual Tanker Water Volume', (annualTankerVolumeLitres / 1000).toFixed(1), 'kL/yr'],
      ['Effective Tanker Water Tariff', effectiveTankerTariffVal.toFixed(2), 'INR/kL'],
      ['Annual Municipal Water Spend', (annualMunicipal * 100000).toFixed(0), 'INR/yr'],
      ['Municipal Water Tariff', municipalTariffPerKl.toFixed(2), 'INR/kL'],
      [],
      ['=== 3. RWH SYSTEM & TANK SIZING AUDIT ==='],
      ['Field', 'Value', 'Unit'],
      ['Selected Tank Capacity', tankSizerResult?.selected_candidate?.capacity_litres ? `${Number(tankSizerResult.selected_candidate.capacity_litres).toLocaleString()}` : `${tankCapacityLitres.toLocaleString()}`, 'Litres'],
      ['Useful Harvested Water', tankSizerResult?.selected_candidate?.useful_water_litres ? Math.round(tankSizerResult.selected_candidate.useful_water_litres).toLocaleString() : (effectiveAnnualYield).toFixed(0), 'L/year'],
      ['Annual Reliability Score', tankSizerResult?.selected_candidate?.reliability_percent ? `${tankSizerResult.selected_candidate.reliability_percent}%` : `${Math.min(100, Math.round((effectiveAnnualYield / (nonPotableDemandLitres || 1)) * 100))}%`, ''],
      ['Recharge Pit Overflow', tankSizerResult?.selected_candidate?.recharge_overflow_litres ? Math.round(tankSizerResult.selected_candidate.recharge_overflow_litres).toLocaleString() : '0', 'L/year'],
      ['Lost Overflow', tankSizerResult?.selected_candidate?.lost_overflow_litres ? Math.round(tankSizerResult.selected_candidate.lost_overflow_litres).toLocaleString() : '0', 'L/year'],
      ['Estimated Capital Cost (Capex)', (capex * 100000).toFixed(0), 'INR'],
      ['Estimated Annual Maintenance (AMC)', (annualAMC).toFixed(0), 'INR/yr'],
      [],
      ['=== 4. MACHINE LEARNING & HYDROGEOLOGY ==='],
      ['Field', 'Value', 'Unit'],
      ['ML Recommended Configuration', mlRecommendResult?.recommended_config || 'Storage-Only', ''],
      ['ML Recommendation Confidence', mlRecommendResult?.confidence_pct ? `${mlRecommendResult.confidence_pct}%` : 'N/A', ''],
      ['Tier 1 Safety Gate Status', isSafetyFlagged ? 'Flagged / Storage Only' : 'Safe for Recharge', ''],
      ['Coastal Distance', `${coastalKm || 15}`, 'km'],
      ['Borewell Presence', borewell ? 'Yes' : 'No', ''],
      ['Borewell Depth', `${borewellDepth || 0}`, 'meters'],
      ['Yield Source Mode', yieldSource === 'ml' ? 'Random Forest Regressor' : 'Physics Formula', ''],
      ['Physics Annual Yield', `${(annualYield / 1000).toFixed(1)}`, 'kL/yr'],
      ['ML Regressor Annual Yield', mlAnnualYield > 0 ? `${(mlAnnualYield / 1000).toFixed(1)}` : 'N/A', 'kL/yr'],
      [],
      ['=== 5. DETERMINISTIC 10-YEAR FINANCIAL TRAJECTORY ==='],
      ['Year', 'Without RWH (Cumulative INR)', 'With RWH (Cumulative INR)', 'Net Annual Savings (INR)', 'Cumulative Net Benefit (INR)'],
      ...(yearlyData.map(row => [
        row.year,
        Math.round(row.cumulativeWithoutRwh || 0),
        Math.round(row.cumulativeWithRwh || 0),
        Math.round(row.savings || 0),
        Math.round(row.netBenefit || 0),
      ])),
      [],
      ['=== 6. MONTE CARLO STOCHASTIC RISK AUDIT (1,000 SCENARIOS) ==='],
      ['Metric', 'Value', 'Interpretation'],
      ['Median Break-Even Year', monteCarloResult?.median_breakeven_year != null ? `Year ${Math.ceil(monteCarloResult.median_breakeven_year)}` : `>${ROI_HORIZON_YEARS} years`, 'P50 most likely break-even horizon'],
      ['Optimistic Break-Even (P10)', monteCarloResult?.percentiles?.p10 != null ? `Year ${monteCarloResult.percentiles.p10}` : 'N/A', 'Top 10% high-rainfall scenario'],
      ['Conservative Break-Even (P90)', monteCarloResult?.percentiles?.p90 != null ? `Year ${monteCarloResult.percentiles.p90}` : 'N/A', 'Worst 10% drought scenario'],
      ['Never Break-Even Risk', `${monteCarloResult?.never_break_even_pct || 0}%`, 'Probability of not recovering capex within 10 years'],
      ['Total Scenarios Simulated', monteCarloResult?.n_scenarios || 1000, 'Stochastic samples across historical P10-P90 rain'],
    ];

    const csvContent = csvRows
      .map(row => row.map(escapeCsvCell).join(','))
      .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [
    societyName, pincode, flats, occupants, grossRoofArea, roofSurfaceType,
    effectiveAnnualYield, nonPotableDailyDemand, nonPotableDemandLitres,
    annualTanker, annualTankerVolumeLitres,
    annualMunicipal, municipalTariffPerKl, tankSizerResult, tankCapacityLitres,
    capex, annualAMC, mlRecommendResult, isSafetyFlagged, coastalKm, borewell,
    borewellDepth, yieldSource, annualYield, mlAnnualYield, yearlyData, monteCarloResult
  ]);

  // ─── Audit JSON Export ───────────────────────────────────────────────────────
  const handleExportJSON = useCallback(() => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeSociety = (societyName || 'Society').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `waterwallet_audit_${safeSociety}_${timestamp}.json`;

    const effectiveTankerTariffVal = (annualTankerVolumeLitres > 0)
      ? (annualTanker * 100000) / (annualTankerVolumeLitres / 1000)
      : 150.0;

    const auditData = {
      auditMetadata: {
        tool: 'WaterWallet MMR RWH Decision-Support Engine',
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        societyName: societyName || 'Residential Housing Society',
        pincode: pincode || null,
      },
      societyProfile: {
        flats: Number(flats) || 0,
        occupantsPerFlat: Number(occupants) || 0,
        totalPopulation: (Number(flats) || 0) * (Number(occupants) || 0),
        dailyNonPotableDemandLitres: Math.round(nonPotableDailyDemand),
        annualNonPotableDemandLitres: Math.round(nonPotableDemandLitres),
      },
      catchmentAndYield: {
        grossRooftopAreaSqm: Number(grossRoofArea),
        usableRooftopAreaSqm: Number(grossRoofArea) * ROOF_USABLE_FACTOR,
        roofSurfaceType: roofSurfaceType || 'concrete',
        runoffCoefficient: ROOF_RUNOFF_COEFFICIENTS[roofSurfaceType] || 0.90,
        yieldSourceMode: yieldSource,
        physicsAnnualYieldLitres: Math.round(annualYield),
        mlRegressorAnnualYieldLitres: Math.round(mlAnnualYield || 0),
        activeAnnualYieldLitres: Math.round(activeAnnualYield),
        rainfallReductionScenarioPercent: rainfallReductionPercent,
      },
      utilityBillingAndTariffs: {
        annualTankerSpendInr: Math.round(annualTanker * 100000),
        annualTankerVolumeLitres: Math.round(annualTankerVolumeLitres),
        effectiveTankerTariffPerKl: Number(effectiveTankerTariffVal.toFixed(2)),
        annualMunicipalSpendInr: Math.round(annualMunicipal * 100000),
        municipalTariffPerKl: Number(municipalTariffPerKl.toFixed(2)),
      },
      tankSizingAudit: tankSizerResult?.selected_candidate ? {
        selectedCapacityLitres: Number(tankSizerResult.selected_candidate.capacity_litres),
        usefulWaterLitresPerYear: Math.round(tankSizerResult.selected_candidate.useful_water_litres),
        annualReliabilityPercent: tankSizerResult.selected_candidate.reliability_percent,
        rechargeOverflowLitresPerYear: Math.round(tankSizerResult.selected_candidate.recharge_overflow_litres),
        lostOverflowLitresPerYear: Math.round(tankSizerResult.selected_candidate.lost_overflow_litres),
        selectionStatus: tankSizerResult.selection_status,
        selectionReason: tankSizerResult.selection_reason,
        paybackYears: tankSizerResult.selected_candidate.payback_years,
      } : {
        selectedCapacityLitres: tankCapacityLitres,
        note: 'Default slider capacity; tank sizer not yet run for this session.',
      },
      mlRecommendationAndSafety: {
        recommendedConfig: mlRecommendResult?.recommended_config || 'Storage-Only',
        confidencePercent: mlRecommendResult?.confidence_pct || null,
        tier1SafetyPassed: !isSafetyFlagged,
        coastalDistanceKm: coastalKm,
        borewellExists: Boolean(borewell),
        borewellDepthMeters: borewellDepth,
        shapFeatureContributions: mlRecommendResult?.shap_contributions || [],
      },
      deterministicFinancials: {
        capexInr: Math.round(capex * 100000),
        annualAmcInr: Math.round(annualAMC),
        deterministicPaybackYears: currentPayback,
        yearlyBreakdown: yearlyData.map(row => ({
          year: row.year,
          cumulativeWithoutRwhInr: Math.round(row.cumulativeWithoutRwh || 0),
          cumulativeWithRwhInr: Math.round(row.cumulativeWithRwh || 0),
          netSavingsInr: Math.round(row.savings || 0),
          cumulativeNetBenefitInr: Math.round(row.netBenefit || 0),
        })),
      },
      monteCarloRiskAnalysis: monteCarloResult ? {
        medianBreakevenYear: monteCarloResult.median_breakeven_year,
        meanBreakevenYear: monteCarloResult.mean_breakeven_year,
        percentiles: monteCarloResult.percentiles,
        neverBreakevenRiskPercent: monteCarloResult.never_break_even_pct,
        totalScenarios: monteCarloResult.n_scenarios,
        isSiteSpecific: monteCarloResult.is_site_specific,
      } : null,
    };

    const jsonContent = JSON.stringify(auditData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [
    societyName, pincode, flats, occupants, nonPotableDailyDemand, nonPotableDemandLitres,
    grossRoofArea, roofSurfaceType, yieldSource, annualYield, mlAnnualYield, activeAnnualYield,
    rainfallReductionPercent, annualTanker, annualTankerVolumeLitres,
    annualMunicipal, municipalTariffPerKl, tankSizerResult, tankCapacityLitres, mlRecommendResult,
    isSafetyFlagged, coastalKm, borewell, borewellDepth, capex, annualAMC, currentPayback,
    yearlyData, monteCarloResult
  ]);

  const kpiCards = [
    {
      icon: TrendingDown,
      label: 'Cost Without RWH by Payback',
      value: `₹${Number(costWithoutRwhAtPayback).toFixed(2)} L`,
      sub: `Cumulative cost by the deterministic payback period (${currentPayback})`,
      valueColor: 'text-red-600', iconBg: 'bg-red-50', iconColor: 'text-red-500', border: 'border-red-100',
    },
    {
      icon: IndianRupee,
      label: 'RWH Project Budget',
      value: `₹${capex.toFixed(2)} L`,
      sub: `₹${capexRatePerSqm}/m² · ${tracedAreaProxy} m² rooftop area`,
      valueColor: 'text-blue-700', iconBg: 'bg-blue-50', iconColor: 'text-blue-600', border: 'border-blue-100',
    },
    {
      icon: Cpu,
      label: 'Deterministic Payback Period',
      value: loadingML ? 'Simulating...' : currentPayback,
      sub: `Fixed historical baseline; Monte Carlo typical case: ${monteCarloResult?.median_breakeven_year != null && monteCarloResult.median_breakeven_year <= ROI_HORIZON_YEARS ? `Year ${Math.ceil(monteCarloResult.median_breakeven_year)}` : `>${ROI_HORIZON_YEARS} years`} (${monteCarloResult?.never_break_even_pct || 0}% risk)`,
      valueColor: 'text-green-600', iconBg: 'bg-green-50', iconColor: 'text-green-600', border: 'border-green-100',
    },
  ];

  return (
    <div className="page-content p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 -mt-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="ww-section-kicker">3 of 3 · Investment decision</p>
          <h1 className="text-2xl font-bold text-slate-950 flex items-center gap-2 tracking-tight">
            Compare the investment case
            <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles size={12} /> ML Models Active
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Bring together project cost, savings, payback period, and implementation risks before your society makes a decision.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="download-pdf-btn"
            onClick={handleDownloadReport}
            className="ww-secondary-button flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold"
          >
            <Download size={14} />
            Print / PDF Report
          </button>
          <button
            id="export-csv-btn"
            onClick={handleExportCSV}
            className="ww-secondary-button flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
            title="Export complete society, catchment, sizing, and cashflow audit to CSV"
          >
            <FileSpreadsheet size={14} className="text-emerald-600" />
            Export Audit CSV
          </button>
          <button
            id="export-json-btn"
            onClick={handleExportJSON}
            className="ww-secondary-button flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
            title="Export full machine-readable audit report to JSON"
          >
            <FileCode size={14} className="text-blue-600" />
            Export Audit JSON
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        {[
          ['Explain my result', 'overall decision'],
          ['Reduce payback period', 'ways to reduce payback period'],
          ['Prepare committee summary', 'committee-ready summary'],
          ['Highlight risks', 'risks and discussion points'],
        ].map(([label, focus]) => (
          <button
            key={focus}
            type="button"
            onClick={() => handleGenerateAdvisory(focus)}
            disabled={advisoryLoading}
            className="ww-secondary-button text-xs font-semibold text-indigo-700 border-indigo-200 px-3 py-2 hover:bg-indigo-50 disabled:opacity-60"
          >
            {label}
          </button>
        ))}
      </div>

      <section aria-live="polite" className={`rounded-2xl border p-5 shadow-sm ${recommendationTone}`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider opacity-70">Decision summary</p>
            <h2 className="text-xl font-extrabold mt-1">{recommendationStatus}</h2>
            <p className="text-sm mt-1 opacity-80">
              Based on the current yield, project cost, and calculated non-potable payback scenario.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-white/70 rounded-xl px-4 py-3">
              <p className="text-xs opacity-70">Self-sufficiency</p>
              <p className="font-bold text-lg">{Math.min(100, Math.round((effectiveAnnualYield / nonPotableDemandLitres) * 100))}%</p>
            </div>
            <div className="bg-white/70 rounded-xl px-4 py-3">
              <p className="text-xs opacity-70">Deterministic payback</p>
              <p className="font-bold text-lg">{currentPayback}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Self-Sufficiency Badge */}
      <SelfSufficiencyBadge annualYield={effectiveAnnualYield} annualDemand={nonPotableDemandLitres} />

      {/* ─── ML vs Physics Yield Source Toggle ─── */}
      <div className="ww-card p-5 border border-indigo-100">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Cpu size={16} className="text-indigo-600" />
              <p className="text-sm font-bold text-slate-800">Annual Yield Source</p>
            </div>
            <p className="text-xs text-slate-500 max-w-md leading-relaxed">
              Choose between the physics-based formula (area × rainfall × runoff) and the Random
              Forest ML regressor trained on site characteristics. All financial metrics update
              automatically.
            </p>
          </div>
          {/* Segmented toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200 self-start shrink-0">
            <button
              type="button"
              id="yield-source-physics"
              onClick={() => setYieldSource('physics')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                yieldSource === 'physics'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Physics Formula
            </button>
            <button
              type="button"
              id="yield-source-ml"
              onClick={() => hasMlYield && setYieldSource('ml')}
              disabled={!hasMlYield}
              title={hasMlYield ? 'Use Random Forest ML regressor yield' : 'Trace rooftop in Map Studio to load ML yield'}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                yieldSource === 'ml'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : hasMlYield
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-300 cursor-not-allowed'
              }`}
            >
              ML Regressor
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3">
            <p className="text-xs text-slate-500">Physics Yield (annual)</p>
            <p className="font-bold text-slate-800 mt-1">
              {annualYield > 0 ? `${(annualYield / 1000).toFixed(0)} kL` : '—'}
            </p>
          </div>
          <div className={`rounded-xl border p-3 ${hasMlYield ? 'bg-violet-50 border-violet-100' : 'bg-slate-50 border-slate-100'}`}>
            <p className="text-xs text-slate-500">ML Regressor Yield (annual)</p>
            <p className={`font-bold mt-1 ${hasMlYield ? 'text-violet-700' : 'text-slate-400'}`}>
              {hasMlYield ? `${(mlAnnualYield / 1000).toFixed(0)} kL` : 'Not loaded'}
            </p>
          </div>
          {mlDeviationPct != null && (
            <div className={`rounded-xl border p-3 ${
              Math.abs(Number(mlDeviationPct)) <= 10
                ? 'bg-green-50 border-green-100'
                : 'bg-amber-50 border-amber-100'
            }`}>
              <p className="text-xs text-slate-500">ML vs Physics deviation</p>
              <p className={`font-bold mt-1 ${
                Math.abs(Number(mlDeviationPct)) <= 10 ? 'text-green-700' : 'text-amber-700'
              }`}>
                {Number(mlDeviationPct) >= 0 ? '+' : ''}{mlDeviationPct}%
              </p>
            </div>
          )}
        </div>

        {yieldSource === 'ml' && hasMlYield && (
          <p className="mt-3 text-xs text-violet-800 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
            <strong>ML Regressor active:</strong> All charts, payback periods, and financial totals are
            computed using the {(mlAnnualYield / 1000).toFixed(0)} kL/yr ML estimate. Switch back to
            Physics Formula to compare scenarios.
          </p>
        )}
      </div>

      {/* Daily historical tank sizing */}
      <section className="bg-cyan-50 rounded-2xl shadow-sm p-6 border border-cyan-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Droplets size={19} className="text-cyan-700" /> Daily Historical Tank Sizer
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Tests tank capacities against the latest 15 complete years of daily rainfall. Demand uses
              {` ${NON_POTABLE_LPCD} LPCD per occupant`} ({Math.round(nonPotableDailyDemand).toLocaleString()} L/day).
            </p>
          </div>
          <button type="button" onClick={handleRunTankSizer} disabled={tankSizerLoading}
            className="ww-primary-button bg-cyan-700 px-4 py-2.5 text-sm hover:bg-cyan-800 disabled:opacity-60">
            {tankSizerLoading ? 'Sizing...' : 'Run Tank Sizer'}
          </button>
        </div>
        {tankSizerError && <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{tankSizerError}</p>}
        {tankSizerResult?.selected_candidate && (
          <>
          {tankSizerResult.selection_status === 'optimal_diminishing_returns_knee' ? (
            <p className="mt-4 text-sm text-teal-800 bg-teal-50 border border-teal-200 rounded-lg p-3">
              ✓ {tankSizerResult.selection_reason}
            </p>
          ) : (!tankSizerResult.reliability_target_met || tankSizerResult.selection_status !== 'meets_reliability_target') ? (
            <p className="mt-4 text-sm text-amber-800 bg-amber-100 border border-amber-200 rounded-lg p-3">
              {tankSizerResult.selection_reason || `No tested tank reaches the ${tankSizerResult.reliability_target_percent}% reliability target.`}
              {' '}Showing the best available non-zero capacity instead of the 0 L baseline.
            </p>
          ) : null}
          <div className="mt-5 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            {[
              [Number(tankSizerResult.selected_candidate.capacity_litres) === 0 ? 'Do nothing baseline' : 'Selected capacity', `${Number(tankSizerResult.selected_candidate.capacity_litres).toLocaleString()} L`],
              ['Useful water', `${Math.round(tankSizerResult.selected_candidate.useful_water_litres).toLocaleString()} L/yr`],
              ['Reliability', `${tankSizerResult.selected_candidate.reliability_percent}%`],
              ['Recharge overflow', `${Math.round(tankSizerResult.selected_candidate.recharge_overflow_litres).toLocaleString()} L/yr`],
              ['Lost overflow', `${Math.round(tankSizerResult.selected_candidate.lost_overflow_litres).toLocaleString()} L/yr`],
              ['Payback', tankSizerResult.selected_candidate.payback_years == null ? 'Not achieved' : `${tankSizerResult.selected_candidate.payback_years} yrs`],
            ].map(([label, value]) => (
              <div key={label} className="bg-white/80 rounded-xl p-3">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="font-bold text-slate-800 mt-1">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-600 mt-3">
            Demand used: {Math.round(nonPotableDailyDemand).toLocaleString()} L/day non-potable
            ({NON_POTABLE_LPCD} LPCD per occupant; source range 60–70 LPCD).
          </p>

          {/* Apply Recommended Tank to ROI Simulation */}
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleApplyRecommendedTank}
              disabled={!tankSizerResult?.selected_candidate?.capacity_litres}
              className="inline-flex items-center gap-2 bg-cyan-700 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-cyan-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Droplets size={14} />
              Apply Recommended Tank to ROI Simulation
            </button>
            {tankApplied && (
              <span className="text-xs text-cyan-800 bg-cyan-100 border border-cyan-200 px-3 py-1.5 rounded-xl font-semibold">
                ✓ Tank set to {Number(tankSizerResult.selected_candidate.capacity_litres).toLocaleString()} L — charts updated
              </span>
            )}
          </div>
          {/* Tank Visualizer */}
          <TankVisualizer tankSizerResult={tankSizerResult} nonPotableDailyDemand={nonPotableDailyDemand} />
          </>
        )}
        <p className="text-xs text-slate-500 mt-4">
          Financial savings include useful consumed water only. Recharge overflow is reported separately and is not counted as rupee savings.
        </p>
      </section>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {kpiCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className={`ww-card p-5 border ${card.border}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.iconBg}`}>
                  <Icon size={20} className={card.iconColor} />
                </div>
                <p className="text-sm font-medium text-slate-600">{card.label}</p>
              </div>
              <p className={`text-3xl font-extrabold ${card.valueColor} tracking-tight leading-tight`}>
                {card.value}
              </p>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">{card.sub}</p>
            </div>
          );
        })}
      </div>

      <section className="ww-card p-5 sm:p-6">
        <div className="mb-4">
          <h2 className="text-base font-bold text-slate-800">Investment Summary</h2>
          <p className="text-xs text-slate-500 mt-1">
            Local estimates use the current scenario and the same assumptions as the ROI chart.
            Municipal tariff: ₹{municipalTariffPerKl.toFixed(2)}/kL
            {municipalTariffIsFallback ? ' (fallback; valid billing volume unavailable)' : ' (derived from billing data)'}.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            ['Installation cost', `₹${(adjustedCapex / 100000).toFixed(2)} L`],
            ['Annual maintenance', `₹${((adjustedCapex * 0.03) / 100000).toFixed(2)} L`],
            ['Estimated annual saving', `₹${investmentSummary.annualSavings.toFixed(2)} L`],
            ['10-year net benefit', `₹${investmentSummary.tenYearNetBenefit.toFixed(2)} L`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-slate-50 border border-slate-100 p-4">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-lg font-extrabold text-slate-800 mt-1">{value}</p>
            </div>
          ))}
        </div>
      </section>

      {errorStatus && (
        <div className="bg-amber-50 text-amber-800 p-4 rounded-xl flex items-center gap-2 border border-amber-200">
          <HelpCircle size={18} />
          <span className="text-sm font-medium">{errorStatus}</span>
        </div>
      )}

      <section className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl shadow-md p-6 border border-indigo-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="text-indigo-600" size={20} />
              <h2 className="text-base font-bold text-slate-800">AI Water Advisory</h2>
            </div>
            <p className="text-sm text-slate-600 mt-1">
              Get a committee-ready explanation grounded in the calculations above.
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerateAdvisory}
            disabled={advisoryLoading}
            className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white font-semibold px-4 py-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-sm"
          >
            <Sparkles size={16} />
            {advisoryLoading ? 'Generating...' : 'Generate Advisory'}
          </button>
        </div>

        {advisoryError && (
          <p className="mt-4 text-sm text-amber-800 bg-amber-100 border border-amber-200 rounded-lg p-3">
            {advisoryError}
          </p>
        )}

        {waterAdvisory && (
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
            <div className="md:col-span-2 bg-white/80 rounded-xl p-4">
              <h3 className="font-bold text-slate-800 mb-1">Summary</h3>
              <p className="text-slate-700 leading-relaxed">{waterAdvisory.summary}</p>
            </div>
            <div className="bg-white/80 rounded-xl p-4">
              <h3 className="font-bold text-slate-800 mb-2">Recommendations</h3>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                {waterAdvisory.recommendations.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
            <div className="bg-white/80 rounded-xl p-4">
              <h3 className="font-bold text-slate-800 mb-2">Risks and assumptions</h3>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                {[...waterAdvisory.risks, ...waterAdvisory.assumptions].map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </div>
        )}
      </section>

      {/* ─── Interactive What-If Simulator & Site Parameters Controls ─── */}
      <SiteSimulationControls
        rooftopArea={tracedAreaProxy}
        onRooftopChange={handleRooftopChange}
        borewell={borewell}
        onBorewellChange={setBorewell}
        borewellDepth={borewellDepth}
        onBorewellDepthChange={setBorewellDepth}
        soilPerm={soilPerm}
        onSoilPermChange={setSoilPerm}
        coastalKm={coastalKm}
        onCoastalKmChange={setCoastalKm}
        capexRatePerSqm={capexRatePerSqm}
        onCapexRateChange={handleCapexRateChange}
        tankCapacityLitres={tankCapacityLitres}
        onTankCapacityChange={setTankCapacityLitres}
        rainfallReductionPercent={rainfallReductionPercent}
        onRainfallReductionChange={setRainfallReductionPercent}
      />

      {/* ─── Dual-Tier ML Recommendation & SHAP AI Card ─── */}
      <div className="ww-card p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Cpu className="text-blue-600" size={20} />
            <h2 className="text-base font-bold text-slate-800">Random Forest Configuration Classifier & SHAP AI</h2>
          </div>
          {mlRecommendResult?.safety_triggered ? (
            <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-800 font-bold px-3 py-1 rounded-full border border-amber-300">
              <ShieldAlert size={14} /> Tier 1 Safety Gate Override
            </span>
          ) : mlRecommendResult ? (
            <span className="flex items-center gap-1 text-xs bg-green-100 text-green-800 font-bold px-3 py-1 rounded-full">
              <Sparkles size={14} /> {((mlRecommendResult.confidence || 0) * 100).toFixed(1)}% RF Confidence
            </span>
          ) : (
            <span className="text-xs text-slate-400">Loading AI prediction...</span>
          )}
        </div>
        <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 mb-4">
          Model confidence shows how strongly the classifier favors a configuration. It is not a
          guarantee of water savings, recharge performance, or financial returns.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className={`p-5 rounded-xl border transition-all duration-300 ${
            mlRecommendResult?.config === 'Storage-Only'
              ? 'bg-sky-50 border-sky-200'
              : mlRecommendResult?.config === 'Borewell-Recharge'
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-indigo-50 border-indigo-200'
          }`}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recommended System</p>
            {loadingML ? (
              <div className="animate-pulse space-y-2 mt-2">
                <div className="h-8 bg-slate-200 rounded w-48"></div>
                <div className="h-4 bg-slate-200 rounded w-64"></div>
              </div>
            ) : (
              <>
                <p className={`text-2xl font-black mt-1 ${
                  mlRecommendResult?.config === 'Storage-Only'
                    ? 'text-sky-700'
                    : mlRecommendResult?.config === 'Borewell-Recharge'
                    ? 'text-emerald-700'
                    : 'text-indigo-700'
                }`}>
                  {mlRecommendResult?.config || 'Calculating...'}
                </p>
                <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                  {mlRecommendResult?.plain_language || 'Analyzing hydrogeological and site inputs...'}
                </p>
              </>
            )}
          </div>

          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              {mlRecommendResult?.safety_triggered ? 'Physical Safety Constraint' : 'SHAP Feature Drivers'}
            </p>
            {loadingML ? (
              <div className="animate-pulse space-y-2 mt-3">
                <div className="h-4 bg-slate-200 rounded w-full"></div>
                <div className="h-4 bg-slate-200 rounded w-3/4"></div>
              </div>
            ) : mlRecommendResult?.safety_triggered ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 leading-relaxed">
                <span className="font-bold flex items-center gap-1 mb-1">
                  <ShieldAlert size={14} className="text-amber-600" /> Physical Hydrogeological Limit:
                </span>
                {mlRecommendResult.safety_reason}
              </div>
            ) : mlRecommendResult?.shap_values && mlRecommendResult.shap_values.length > 0 ? (
              <div className="space-y-2">
                {mlRecommendResult.shap_values.slice(0, 3).map((item, i) => (
                  <div key={i} className="flex justify-between items-center text-xs">
                    <span className="font-medium text-slate-700">{item.feature}:</span>
                    <span className={`font-bold ${item.shap > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {item.shap > 0 ? `+${item.shap.toFixed(3)}` : item.shap.toFixed(3)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No feature attribution available.</p>
            )}
          </div>
        </div>
        <div className="mt-5 rounded-xl bg-indigo-50 border border-indigo-100 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-800 mb-2">
            Why this recommendation?
          </h3>
          {mlRecommendResult?.safety_triggered ? (
            <p className="text-sm text-indigo-900 leading-relaxed">
              The recommendation is constrained by a physical safety rule: {mlRecommendResult.safety_reason}
            </p>
          ) : mlRecommendResult?.shap_values?.length ? (
            <ul className="list-disc pl-5 space-y-1 text-sm text-indigo-900">
              {mlRecommendResult.shap_values.slice(0, 3).map((item) => (
                <li key={`reason-${item.feature}`}>
                  {item.shap >= 0 ? '+' : '-'} {featureLabels[item.feature] || item.feature}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-indigo-900">The model is still evaluating the site inputs.</p>
          )}
        </div>
      </div>

      {/* ─── 1,000-Scenario Monte Carlo Payback Chart ─── */}
      <div className="ww-card p-5 sm:p-6">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            1,000-Scenario Monte Carlo Payback Probability
            <span className="text-xs font-normal text-slate-400">(Sampling 15-Yr P10–P90 Rainfall Percentiles)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Stochastic risk simulation incorporating seasonal rainfall concentration and finite tank storage ({tankCapacityLitres.toLocaleString()} L).
            Because monsoon inflows exceed tank capacity while dry months have minimal rainfall, excess water spills as overflow.
            This physical storage constraint makes the typical break-even here more conservative than the unconstrained deterministic ceiling above.
          </p>
        </div>

        {/* is_site_specific is the stable contract; scenarios_used remains diagnostic metadata. */}
        {monteCarloResult?.is_site_specific === false && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Monte Carlo is using regional historical rainfall percentiles (Thane/MMR) because site-specific rainfall has not been traced in Map Studio. Complete rooftop tracing in Phase 2 for site-calibrated estimates.
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            ['Best case', monteCarloResult?.percentiles?.p10, 'text-emerald-700'],
            ['Typical case (Monte Carlo)', monteCarloResult?.median_breakeven_year, 'text-blue-700'],
            ['Conservative', monteCarloResult?.percentiles?.p90, 'text-amber-700'],
            ['No break-even risk', monteCarloResult ? `${monteCarloResult.never_break_even_pct}%` : '—', 'text-red-700'],
          ].map(([label, value, color]) => (
            <div key={label} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
              <p className="text-xs text-slate-500">{label}</p>
              <p className={`text-lg font-extrabold mt-1 ${color}`}>
                {value == null ? '—' : label === 'No break-even risk' ? value : `Year ${value}`}
              </p>
            </div>
          ))}
        </div>

        {monteCarloResult ? (
          <MonteCarloChart probData={monteCarloResult.prob_breakeven_by_year} />
        ) : (
          <div className="h-56 flex items-center justify-center text-slate-400 bg-slate-50 rounded-xl border border-slate-100 text-sm">
            {loadingML ? 'Simulating 1,000 variance scenarios...' : 'Monte Carlo data unavailable'}
          </div>
        )}
      </div>

      <ImplementationPlan
        payback={currentPayback}
        recommendedConfiguration={mlRecommendResult?.config || 'pending'}
      />

      {/* Long-horizon What-If Scenario Comparator */}
      <div className="ww-card p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap justify-between items-start gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{ROI_HORIZON_YEARS}-Year Water Cost Trajectories</h2>
            <p className="text-xs text-slate-500 mt-1">
              Overlaid trajectory comparison of non-RWH water expenditures vs. RWH investment.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {SCENARIOS.map((scenario) => {
            const scenarioPayback = breakEvens[scenario.key] || `> ${ROI_HORIZON_YEARS} Yrs`;
            const savingsRow = chartData[DISPLAYED_SAVINGS_YEARS - 1];
            const savingsWithRwh = savingsRow
              ? Number(savingsRow[`withRWH${scenario.key === 'current' ? 'Current' : scenario.key === 'conservative' ? 'Conservative' : 'HighRisk'}`])
              : 0;
            const scenarioNetBenefit = savingsRow
              ? Number(savingsRow[scenario.key]) - savingsWithRwh
              : 0;
            return (
              <div key={scenario.key} className="rounded-xl border p-4" style={{ borderColor: scenario.color }}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-slate-800">{scenario.label}</h3>
                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-slate-100" style={{ color: scenario.color }}>
                    {(scenario.gamma * 100).toFixed(0)}% inflation
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Payback</p>
                    <p className="font-extrabold text-slate-800 mt-1">{scenarioPayback}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">10-year net benefit</p>
                    <p className={`font-extrabold mt-1 ${scenarioNetBenefit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      ₹{scenarioNetBenefit.toFixed(2)} L
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Yield Harmonization & Model Methodology Notice */}
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900 leading-relaxed">
          <div className="flex items-start gap-2.5">
            <HelpCircle size={18} className="text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1.5 w-full">
              <p className="font-bold text-blue-950 text-sm">
                Yield Harmonization: Theoretical Ceiling vs. Storage-Constrained Reality
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                <div className="bg-white/80 rounded-lg p-3 border border-blue-100">
                  <span className="font-bold text-blue-900 block mb-1">
                    Deterministic Payback ({currentPayback}): Theoretical Unconstrained Ceiling
                  </span>
                  <p className="text-slate-600">
                    Assumes 100% of harvestable annual rainwater is utilized up to the eligible non-potable annual demand ({Math.round(nonPotableDemandLitres).toLocaleString()} L). It models an ideal operational state where seasonal buffers or continuous recharge prevent monsoon spillage.
                  </p>
                </div>
                <div className="bg-white/80 rounded-lg p-3 border border-blue-100">
                  <span className="font-bold text-blue-900 block mb-1">
                    Monte Carlo Payback ({monteCarloResult?.median_breakeven_year ? `Year ${monteCarloResult.median_breakeven_year}` : 'Storage-Gated'}): Finite Storage Reality
                  </span>
                  <p className="text-slate-600">
                    Enforces a physical monthly tank water balance with a {tankCapacityLitres.toLocaleString()} L tank. Because ~85% of MMR precipitation is concentrated in 4 monsoon months, tank overflows result in uncaptured water, producing a more conservative payback timeline.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <BreakEvenChart chartData={chartData} breakEvens={breakEvens} />
        <p className="text-xs text-slate-500 mt-3 leading-relaxed">
          The project reaches break-even when cumulative spending with RWH becomes lower than
          continuing tanker and municipal purchases. Dashed markers show the expected break-even
          year for each inflation scenario.
        </p>
      </div>
    </div>
  );
}