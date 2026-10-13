import React, { useMemo, useState, memo, useCallback, useEffect } from 'react';
import { Download, TrendingDown, IndianRupee, Clock, Droplets, SlidersHorizontal, Cpu, ShieldAlert, Sparkles, HelpCircle } from 'lucide-react';
import {
  Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, ComposedChart, BarChart, Bar, Cell
} from 'recharts';
import { simulateROI, runMonteCarlo, getMLRecommendation, getWaterAdvisory, saveSocietyAnalysis, sizeTank } from '../api/waterwallet';
import { useWaterWallet } from '../context/WaterWalletContext';

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

function escapeHtml(value) {
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
    annualDemand, capexRatePerSqm, setCapexRatePerSqm,
    grossRoofArea,
    societyName, flats, occupants,
    borewell, setBorewell,
    borewellDepth, setBorewellDepth,
    soilPerm, setSoilPerm,
    coastalKm, setCoastalKm,
    monthlyRainfall
    , roofSurfaceType, siteLatitude, siteLongitude
  } = useWaterWallet();

  // Phase 2 prices usable roof area (gross area × obstacle factor). Recover
  // the gross area for display/ML while preserving the exact Phase 2 capex.
  const tracedAreaProxy = Math.max(0, Number(grossRoofArea) || 0);
  const adjustedCapex = Math.max(0, Number(estimatedCapex) || tracedAreaProxy * ROOF_USABLE_FACTOR * capexRatePerSqm);

  const months          = billingMonths || 1;
  const annualTanker    = ((totalTankerSpend / months) * 12) / 100000;
  const annualMunicipal = ((totalMunicipal   / months) * 12) / 100000;
  const annualTankerVolumeLitres = ((totalTankerVolume / months) * 12) || 0;
  const capex           = adjustedCapex / 100000;
  const municipalVolumeLitres = Math.max(0, nonPotableDemandLitres - annualTankerVolumeLitres);
  const fallbackMunicipalTariffPerKl = 15.0;
  const municipalTariffIsFallback = !(municipalVolumeLitres > 0 && annualMunicipal > 0);
  const municipalTariffPerKl = !municipalTariffIsFallback
    ? (annualMunicipal * 100000) / (municipalVolumeLitres / 1000)
    : fallbackMunicipalTariffPerKl;
  const [tankCapacityLitres, setTankCapacityLitres] = useState(10000);
  const [rainfallReductionPercent, setRainfallReductionPercent] = useState(0);
  const [tankSizerResult, setTankSizerResult] = useState(null);
  const [tankSizerLoading, setTankSizerLoading] = useState(false);
  const [tankSizerError, setTankSizerError] = useState(null);
  const effectiveAnnualYield = annualYield * (1 - rainfallReductionPercent / 100);
  const nonPotableDemandLitres = Math.max(
    0,
    Number(flats || 0) * Number(occupants || 0) * NON_POTABLE_LPCD * 365,
  );
  const nonPotableDailyDemand = nonPotableDemandLitres / 365;

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
        reliability_target_percent: 80,
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
    setEstimatedCapex(area * ROOF_USABLE_FACTOR * capexRatePerSqm);
    const annualRainfall = monthlyRainfall?.some((value) => value > 0)
      ? monthlyRainfall.reduce((sum, value) => sum + Number(value || 0), 0)
      : 2424;
    setAnnualYield(Math.round(area * ROOF_USABLE_FACTOR * annualRainfall * 0.90));
  }, [capexRatePerSqm, monthlyRainfall, setEstimatedCapex, setAnnualYield]);

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
  const [waterAdvisory, setWaterAdvisory] = useState(null);
  const [advisoryLoading, setAdvisoryLoading] = useState(false);
  const [advisoryError, setAdvisoryError] = useState(null);
  const [advisoryFocus, setAdvisoryFocus] = useState('overall decision');

  // ─── Fetch ML Recommendation & Monte Carlo from Backend ─────────────────────
  useEffect(() => {
    if (!tracedAreaProxy || !annualDemand) return;
    setLoadingML(true);
    setErrorStatus(null);

    // Case A: RWH is modelled for eligible non-potable uses only.
    const monthlyDemandKl = (nonPotableDemandLitres / 12) / 1000;
    const rooftopSqm = Math.max(100, tracedAreaProxy);
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
      monthly_rainfall_mm: monthlyRainfall?.length === 12 ? monthlyRainfall : undefined,
      capex_inr: adjustedCapex,
      tank_capacity_litres: tankCapacityLitres,
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
      coastal_km: Number(coastalKm) || 10,
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
               }
             }).catch(e => console.error("Analysis save error", e));
           }
        }
        
        if (!mcData && !recData) setErrorStatus("Failed to load AI predictions");
        setLoadingML(false);
      })
      .catch((err) => {
        console.error("Dashboard fetch error:", err);
        setErrorStatus("API connection failed. Using local estimations.");
        setLoadingML(false);
      });
  }, [societyId, tracedAreaProxy, annualDemand, nonPotableDemandLitres, nonPotableDailyDemand, adjustedCapex, borewell, borewellDepth, soilPerm, coastalKm, monthlyRainfall, annualYield, effectiveAnnualYield, tankCapacityLitres, rainfallReductionPercent, annualTanker, annualTankerVolumeLitres, annualMunicipal, municipalTariffPerKl, roofSurfaceType, siteLatitude, siteLongitude]);

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
    const sysConfig = escapeHtml(mlRecommendResult?.config || 'Configuration Pending');
    const sysConf = mlRecommendResult?.confidence ? ((mlRecommendResult.confidence) * 100).toFixed(1) : 'N/A';
    const reportSocietyName = escapeHtml(societyName);
    const reportExplanation = escapeHtml(
      mlRecommendResult?.plain_language || 'Configuration recommended based on site hydrogeology.',
    );
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>WaterWallet ML Report — ${reportSocietyName}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #1a1a2e; }
    h1 { color: #0f3460; border-bottom: 2px solid #0f3460; padding-bottom: 8px; }
    h2 { color: #16213e; margin-top: 32px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #ccc; padding: 8px 12px; text-align: left; }
    th { background: #0f3460; color: #fff; }
    tr:nth-child(even) { background: #f4f6fb; }
    .badge { display: inline-block; background: #16a34a; color: #fff; padding: 4px 12px; border-radius: 4px; font-weight: bold; }
  </style>
</head>
<body>
  <h1>💧 WaterWallet — AI/ML Decision Report</h1>
  <p><strong>Society:</strong> ${reportSocietyName}</p>
  <p><strong>Units:</strong> ${escapeHtml(flats)} flats · ${escapeHtml(occupants)} occupants/flat</p>

  <h2>1. ML Recommended System Configuration</h2>
  <p><strong>System:</strong> <span class="badge">${sysConfig}</span> (${sysConf}% ML Confidence)</p>
  <p><strong>Explanation:</strong> ${reportExplanation}</p>

  <h2>2. 1,000-Scenario Monte Carlo Simulation</h2>
  <p><strong>Monte Carlo Typical Break-Even Year:</strong> ${monteCarloResult?.median_breakeven_year != null && monteCarloResult.median_breakeven_year <= ROI_HORIZON_YEARS ? `Year ${Math.ceil(monteCarloResult.median_breakeven_year)}` : `>${ROI_HORIZON_YEARS} years`}</p>
  <p><strong>Never Break-Even Risk:</strong> ${monteCarloResult?.never_break_even_pct || 0}%</p>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) { alert('Please allow pop-ups to download the report.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }, [societyName, flats, occupants, mlRecommendResult, monteCarloResult]);

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
        <button
          id="download-pdf-btn"
          onClick={handleDownloadReport}
          className="ww-secondary-button flex items-center justify-center gap-2 px-5 py-2.5 text-sm"
        >
          <Download size={15} />
          Download ML PDF Report
        </button>
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
          {(!tankSizerResult.reliability_target_met || tankSizerResult.selection_status !== 'meets_reliability_target') && (
            <p className="mt-4 text-sm text-amber-800 bg-amber-100 border border-amber-200 rounded-lg p-3">
              {tankSizerResult.selection_reason || `No tested tank reaches the ${tankSizerResult.reliability_target_percent}% reliability target.`}
              {' '}Showing the best available non-zero capacity instead of the 0 L baseline.
            </p>
          )}
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
        onCapexRateChange={setCapexRatePerSqm}
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
          <p className="text-xs text-slate-500 mt-1">
            This is a probabilistic range around the historical baseline,
            capped by eligible non-potable demand. Its typical case can differ
            from the deterministic payback above.
          </p>
        </div>

        {/* is_site_specific is the stable contract; scenarios_used remains diagnostic metadata. */}
        {monteCarloResult?.is_site_specific === false && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Monte Carlo is using a generic Thane-like rainfall fallback because the
            percentile dataset is unavailable. These results are not site-specific
            calibrated estimates.
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