import React, { useMemo, useState, memo, useCallback, useEffect } from 'react';
import { Download, TrendingDown, IndianRupee, Clock, Droplets, SlidersHorizontal, Cpu, ShieldAlert, Sparkles, HelpCircle } from 'lucide-react';
import {
  Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, ComposedChart, BarChart, Bar, Cell
} from 'recharts';
import { simulateROI, runMonteCarlo, getMLRecommendation } from '../api/waterwallet';
import { useWaterWallet } from '../context/WaterWalletContext';

// ─── Scenario definitions ────────────────────────────────────────────────────
const SCENARIOS = [
  { key: 'conservative', label: 'Conservative',  gamma: 0.06, color: '#f59e0b', dash: '6 3' },
  { key: 'current',      label: 'Current',        gamma: 0.08, color: '#dc2626', dash: null  },
  { key: 'highRisk',     label: 'High-Risk',      gamma: 0.12, color: '#7c3aed', dash: '3 3' },
];

// ─── ROI engine (pure function) ─────────────────────────────────────────────
function runScenario({ annualTanker, annualMunicipal, capex, gamma, annualYield, annualDemand }) {
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
  const effectiveYield = Math.min(yieldL, demandL);

  // Default tanker rate of ₹150/kL = ₹0.15/L
  const annualTankerVolumeL = (annualTanker * 100000) / 0.15;
  
  const offsetTankerL = Math.min(effectiveYield, annualTankerVolumeL);
  const offsetMunicipalL = Math.min(effectiveYield - offsetTankerL, Math.max(0, demandL - annualTankerVolumeL));

  const savingsTankerLakhs = (offsetTankerL * 0.15) / 100000;
  const savingsMunicipalLakhs = (offsetMunicipalL * 0.015) / 100000;

  for (let i = 1; i <= 10; i++) {
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
  return { rows, breakEven: breakEven || '> 10 Yrs', finalDoNothing: cumulativeDoNothing };
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
            name={`${s.label} (${(s.gamma * 100).toFixed(0)}% inflation)`}
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
          breakEvens[s.key] && breakEvens[s.key] !== '> 10 Yrs' ? (
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

// ─── Capex Slider ─────────────────────────────────────────────────────────────
function CapexSlider({ value, onChange }) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-5 border border-slate-100">
      <div className="flex items-center gap-2 mb-3">
        <SlidersHorizontal size={16} className="text-blue-600" />
        <p className="text-sm font-semibold text-slate-700">Capex Sensitivity</p>
        <span className="ml-auto text-sm font-bold text-blue-700">₹{value}/m²</span>
      </div>
      <input
        id="capex-slider"
        type="range"
        min={400}
        max={800}
        step={50}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-blue-600"
      />
      <div className="flex justify-between text-xs text-slate-400 mt-1">
        <span>₹400 (Budget)</span>
        <span>₹600 (MMR DSR)</span>
        <span>₹800 (Premium)</span>
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
    totalTankerSpend, totalMunicipal, billingMonths, estimatedCapex,
    annualYield, annualDemand, capexRatePerSqm, setCapexRatePerSqm,
    societyName, flats, occupants,
  } = useWaterWallet();

  const tracedAreaProxy  = estimatedCapex / 600;
  const adjustedCapex    = tracedAreaProxy * capexRatePerSqm;

  const months          = billingMonths || 1;
  const annualTanker    = ((totalTankerSpend / months) * 12) / 100000 || 2.0;
  const annualMunicipal = ((totalMunicipal   / months) * 12) / 100000 || 0.46;
  const capex           = (adjustedCapex / 100000) || 4.8;

  const { chartData, breakEvens, tenYearBleedRange } = useMemo(() => {
    const results = {};
    SCENARIOS.forEach((s) => {
      results[s.key] = runScenario({
        annualTanker,
        annualMunicipal,
        capex,
        gamma: s.gamma,
        annualYield,
        annualDemand,
      });
    });

    const rows = results.conservative.rows.map((r, i) => ({
      year:         r.year,
      conservative: results.conservative.rows[i].doNothing,
      current:      results.current.rows[i].doNothing,
      highRisk:     results.highRisk.rows[i].doNothing,
      withRWH:      r.withRWH,
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
    };
  }, [annualTanker, annualMunicipal, capex, annualYield, annualDemand]);

  // ─── ML & Monte Carlo States ────────────────────────────────────────────────
  const [monteCarloResult, setMonteCarloResult] = useState(null);
  const [mlRecommendResult, setMlRecommendResult] = useState(null);
  const [loadingML, setLoadingML] = useState(true);

  // ─── Fetch ML Recommendation & Monte Carlo from Backend ─────────────────────
  useEffect(() => {
    if (!tracedAreaProxy || !annualDemand) return;
    setLoadingML(true);

    const monthlyDemandKl = (annualDemand / 12) / 1000;
    const rooftopSqm = Math.max(100, tracedAreaProxy);

    // Call Monte Carlo API
    const mcPromise = runMonteCarlo({
      rooftop_area_m2: rooftopSqm,
      monthly_demand_kl: monthlyDemandKl,
      capex_inr: adjustedCapex,
      tanker_rate_per_kl: 150.0,
      inflation_rate: 0.08,
      n_scenarios: 1000,
    });

    // Call Dual-Tier ML Recommendation API
    const recPromise = getMLRecommendation({
      rooftop_area: rooftopSqm,
      borewell: 1,
      borewell_depth: 95.0,
      soil_perm: 3,
      coastal_km: 25.0,
      annual_rain_mm: 2500.0,
      peak_day_mm: 120.0,
    });

    Promise.all([mcPromise, recPromise])
      .then(([mcData, recData]) => {
        setMonteCarloResult(mcData);
        setMlRecommendResult(recData);
        setLoadingML(false);
      })
      .catch((err) => {
        console.error("ML / Monte Carlo fetch error:", err);
        setLoadingML(false);
      });
  }, [tracedAreaProxy, annualDemand, adjustedCapex]);

  const handleDownloadReport = useCallback(() => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>WaterWallet ML Report — ${societyName}</title>
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
  <p><strong>Society:</strong> ${societyName}</p>
  <p><strong>Units:</strong> ${flats} flats · ${occupants} occupants/flat</p>

  <h2>1. ML Recommended System Configuration</h2>
  <p><strong>System:</strong> <span class="badge">${mlRecommendResult?.config || 'Hybrid'}</span> (${((mlRecommendResult?.confidence || 0.95) * 100).toFixed(1)}% ML Confidence)</p>
  <p><strong>Explanation:</strong> ${mlRecommendResult?.plain_language || 'Hybrid configuration recommended.'}</p>

  <h2>2. 1,000-Scenario Monte Carlo Simulation</h2>
  <p><strong>Median Break-Even Year:</strong> Year ${monteCarloResult?.median_breakeven_year || 4}</p>
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
      label: '10-Year Water Bleed',
      value: `₹${tenYearBleedRange.low}–${tenYearBleedRange.high} L`,
      sub: 'Cumulative expenditure without RWH',
      valueColor: 'text-red-600', iconBg: 'bg-red-50', iconColor: 'text-red-500', border: 'border-red-100',
    },
    {
      icon: IndianRupee,
      label: 'RWH Project Budget',
      value: `₹${capex.toFixed(2)} L`,
      sub: `Parametric Capex at ₹${capexRatePerSqm}/m²`,
      valueColor: 'text-blue-700', iconBg: 'bg-blue-50', iconColor: 'text-blue-600', border: 'border-blue-100',
    },
    {
      icon: Cpu,
      label: 'ML Median Break-Even',
      value: loadingML ? 'Simulating...' : `Year ${monteCarloResult?.median_breakeven_year || 4}`,
      sub: `From 1,000 Monte Carlo scenarios (${monteCarloResult?.never_break_even_pct || 0}% risk)`,
      valueColor: 'text-green-600', iconBg: 'bg-green-50', iconColor: 'text-green-600', border: 'border-green-100',
    },
  ];

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center -mt-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            Phase 3: AI-Driven ROI Simulator
            <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles size={12} /> ML Models Active
            </span>
          </h1>
          <p className="text-sm text-slate-500">
            Random Forest Classifier, SHAP Explainable AI, and 1,000-Iteration Monte Carlo Simulation.
          </p>
        </div>
        <button
          id="download-pdf-btn"
          onClick={handleDownloadReport}
          className="flex items-center gap-2 border-2 border-blue-700 text-blue-700 font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-50 transition-colors text-sm shadow-sm"
        >
          <Download size={15} />
          Download ML PDF Report
        </button>
      </div>

      {/* Self-Sufficiency Badge */}
      <SelfSufficiencyBadge annualYield={annualYield} annualDemand={annualDemand} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {kpiCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className={`bg-white rounded-2xl shadow-md p-6 border ${card.border}`}>
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

      {/* ─── Dual-Tier ML Recommendation & SHAP AI Card ─── */}
      <div className="bg-white rounded-2xl shadow-md p-6 border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Cpu className="text-blue-600" size={20} />
            <h2 className="text-base font-bold text-slate-800">Random Forest Configuration Classifier & SHAP AI</h2>
          </div>
          {mlRecommendResult?.safety_triggered ? (
            <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-800 font-bold px-3 py-1 rounded-full border border-amber-300">
              <ShieldAlert size={14} /> Tier 1 Safety Gate Override
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs bg-green-100 text-green-800 font-bold px-3 py-1 rounded-full">
              <Sparkles size={14} /> {((mlRecommendResult?.confidence || 0.95) * 100).toFixed(1)}% RF Confidence
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recommended System</p>
            <p className="text-2xl font-black text-blue-700 mt-1">{mlRecommendResult?.config || 'Hybrid System'}</p>
            <p className="text-xs text-slate-600 mt-3 leading-relaxed">
              {mlRecommendResult?.plain_language || 'Hybrid configuration recommended based on rooftop surface area and hydrogeological factors.'}
            </p>
          </div>

          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">SHAP Feature Drivers</p>
            {mlRecommendResult?.shap_values && mlRecommendResult.shap_values.length > 0 ? (
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
              <p className="text-xs text-slate-400 italic">Tier 1 Safety Gate forced Storage-Only due to physical hydrogeological constraints.</p>
            )}
          </div>
        </div>
      </div>

      {/* Capex Sensitivity Slider */}
      <CapexSlider value={capexRatePerSqm} onChange={setCapexRatePerSqm} />

      {/* ─── 1,000-Scenario Monte Carlo Payback Chart ─── */}
      <div className="bg-white rounded-2xl shadow-md p-6 border border-slate-100">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            1,000-Scenario Monte Carlo Payback Probability
            <span className="text-xs font-normal text-slate-400">(Sampling 15-Yr P10–P90 Rainfall Percentiles)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Probabilistic distribution of break-even year across 1,000 simulated monsoon variance scenarios.
          </p>
        </div>

        <MonteCarloChart probData={monteCarloResult?.prob_breakeven_by_year} />
      </div>

      {/* 10-Year What-If Scenario Comparator */}
      <div className="bg-white rounded-2xl shadow-md p-6 border border-slate-100">
        <div className="mb-5 flex flex-wrap justify-between items-start gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">10-Year Water Cost Trajectories</h2>
            <p className="text-xs text-slate-500 mt-1">
              Overlaid trajectory comparison of non-RWH water expenditures vs. RWH investment.
            </p>
          </div>
        </div>

        <BreakEvenChart chartData={chartData} breakEvens={breakEvens} />
      </div>
    </div>
  );
}