import React, { useMemo, useState, memo, useCallback, useEffect } from 'react';
import { Download, TrendingDown, IndianRupee, Clock, Droplets, SlidersHorizontal } from 'lucide-react';
import {
  Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, ComposedChart,
} from 'recharts';
import { useWaterWallet } from '../context/WaterWalletContext';
import { simulateROI, downloadReport } from '../api/waterwallet';

// ─── Scenario definitions ────────────────────────────────────────────────────
const SCENARIOS = [
  { key: 'conservative', label: 'Conservative',  gamma: 0.06, color: '#f59e0b', dash: '6 3' },
  { key: 'current',      label: 'Current',        gamma: 0.08, color: '#dc2626', dash: null  },
  { key: 'highRisk',     label: 'High-Risk',      gamma: 0.12, color: '#7c3aed', dash: '3 3' },
];

// ─── ROI engine (pure function — no API) ────────────────────────────────────
function runScenario({ annualTanker, annualMunicipal, capex, gamma }) {
  const municipalInflation = 0.05;
  const rwhAmc             = 0.03;
  let cumulativeDoNothing  = 0;
  let cumulativeRWH        = capex;
  let breakEven            = null;
  const rows               = [];

  for (let i = 1; i <= 10; i++) {
    const thisYearTanker     = annualTanker    * Math.pow(1 + gamma,             i - 1);
    const thisYearMunicipal  = annualMunicipal * Math.pow(1 + municipalInflation, i - 1);
    const thisYearRwhMaint   = capex * rwhAmc;

    cumulativeDoNothing += (thisYearTanker + thisYearMunicipal);
    cumulativeRWH       += (thisYearMunicipal + thisYearRwhMaint);

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

// ─── Break-Even Chart (React.memo — Feature 6) ───────────────────────────────
const BreakEvenChart = memo(function BreakEvenChart({ chartData, breakEvens }) {
  return (
    <ResponsiveContainer width="100%" height={360}>
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

        {/* Three "Doing Nothing" scenario curves */}
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

        {/* Single "With RWH" line — same regardless of tanker inflation assumption */}
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

        {/* Break-even reference lines — one per scenario */}
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
}, (prev, next) =>
  JSON.stringify(prev.chartData) === JSON.stringify(next.chartData) &&
  JSON.stringify(prev.breakEvens) === JSON.stringify(next.breakEvens)
);

// ─── Capex Slider (Feature 7) ─────────────────────────────────────────────────
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

// ─── Self-Sufficiency Badge (Feature 3) ──────────────────────────────────────
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

  // ─── Local capex override for sensitivity slider ──────────────────────────
  // The slider drives local capex; global estimatedCapex comes from Map Studio.
  // We recalculate capex based on slider rate × (estimatedCapex / 600) area proxy.
  const tracedAreaProxy  = estimatedCapex / 600; // reverse-derive usable area from stored capex
  const adjustedCapex    = tracedAreaProxy * capexRatePerSqm;

  // ─── Annualise billing totals (₹ Lakhs / year) ───────────────────────────
  const months          = billingMonths || 1;
  const annualTanker    = ((totalTankerSpend / months) * 12) / 100000 || 2.0;
  const annualMunicipal = ((totalMunicipal   / months) * 12) / 100000 || 0.46;
  const capex           = (adjustedCapex / 100000) || 4.8;

  // ─── Run all three scenarios ──────────────────────────────────────────────
  const { chartData, breakEvens, tenYearBleedRange } = useMemo(() => {
    const results = {};
    SCENARIOS.forEach((s) => {
      results[s.key] = runScenario({ annualTanker, annualMunicipal, capex, gamma: s.gamma });
    });

    // Merge rows into unified chart data object
    const rows = results.conservative.rows.map((r, i) => ({
      year:         r.year,
      conservative: results.conservative.rows[i].doNothing,
      current:      results.current.rows[i].doNothing,
      highRisk:     results.highRisk.rows[i].doNothing,
      withRWH:      r.withRWH, // same across all scenarios
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
  }, [annualTanker, annualMunicipal, capex]);

  // ─── State to hold backend-computed ROI payback
  const [backendROI, setBackendROI] = useState(null);
  const [loadingROI, setLoadingROI] = useState(false);

  // ─── Run ROI simulation on FastAPI backend ───
  useEffect(() => {
    if (!annualDemand || !annualYield || !adjustedCapex) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingROI(true);
    simulateROI({
      daily_demand_lpd: annualDemand / 365,
      annual_yield_litres: annualYield,
      tank_capacity_litres: 50000,
      water_tariff_per_kl: 15.0,
      installation_cost: adjustedCapex,
      years: 10,
      tariff_escalation_rate: 0.08 // 8% current scenario rate
    })
      .then((data) => {
        setBackendROI(data);
        setLoadingROI(false);
      })
      .catch((err) => {
        console.error("Backend ROI simulation error:", err);
        setLoadingROI(false);
      });
  }, [annualDemand, annualYield, adjustedCapex]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const handleDownloadReport = useCallback(async () => {
    try {
      const payload = {
        society_name: societyName,
        society_data: {
          total_occupants: Number(flats * occupants) || 200,
          daily_demand_lpd: Math.round(annualDemand / 365) || 27000,
          daily_demand_with_buffer_lpd: Math.round(annualDemand / 365) || 27000,
        },
        catchment_data: {
          annual_rainfall_mm: 2500,
          monthly_rainfall_mm: Array(12).fill(200),
          annual_yield_litres: Math.round(annualYield) || 100000,
          monthly_yield_litres: Array(12).fill(Math.round(annualYield / 12) || 8000),
        },
        roi_data: {
          payback_years: backendROI?.payback_years ?? 5.5,
          total_period_savings: backendROI?.total_period_savings ?? 120000.0,
          ten_year_savings: backendROI?.ten_year_savings ?? 120000.0,
          yearly_breakdown: backendROI?.yearly_breakdown ?? Array.from({ length: 10 }, (_, i) => ({
            year: i + 1,
            savings: 12000.0,
            cumulative_savings: 12000.0 * (i + 1),
            net_benefit: 12000.0 * (i + 1) - capex * 100000,
          })),
        },
      };

      await downloadReport(payload);
    } catch (err) {
      console.warn("Backend PDF generation failed or not supported. Falling back to in-browser print.", err);
      // Fallback in-browser printing
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>WaterWallet Report — ${societyName}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #1a1a2e; }
    h1 { color: #0f3460; border-bottom: 2px solid #0f3460; padding-bottom: 8px; }
    h2 { color: #16213e; margin-top: 32px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #ccc; padding: 8px 12px; text-align: left; }
    th { background: #0f3460; color: #fff; }
    tr:nth-child(even) { background: #f4f6fb; }
    .badge { display: inline-block; background: #1d4ed8; color: #fff;
             padding: 4px 12px; border-radius: 4px; font-weight: bold; }
    .kpi { display: inline-block; margin: 8px 16px 8px 0; }
    .kpi-val { font-size: 24px; font-weight: 800; color: #0f3460; }
    .kpi-lbl { font-size: 11px; color: #64748b; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <h1>💧 WaterWallet — Rainwater Harvesting Report</h1>
  <p><strong>Society:</strong> ${societyName}</p>
  <p><strong>Units:</strong> ${flats} flats · ${occupants} occupants/flat</p>

  <h2>1. Financial Summary</h2>
  <div>
    <div class="kpi">
      <div class="kpi-val">₹${tenYearBleedRange.low}–${tenYearBleedRange.high} L</div>
      <div class="kpi-lbl">10-Year Cost of Doing Nothing (Conservative → High-Risk)</div>
    </div>
    <div class="kpi">
      <div class="kpi-val">₹${capex.toFixed(2)} L</div>
      <div class="kpi-lbl">RWH Project Budget (Parametric at ₹${capexRatePerSqm}/m²)</div>
    </div>
  </div>

  <h2>2. Break-Even Analysis</h2>
  <table>
    <tr><th>Scenario</th><th>Tanker Inflation</th><th>Break-Even Year</th></tr>
    <tr><td>Conservative</td><td>6% per annum</td><td>${breakEvens.conservative}</td></tr>
    <tr><td>Current</td><td>8% per annum</td><td>${breakEvens.current}</td></tr>
    <tr><td>High-Risk</td><td>12% per annum</td><td>${breakEvens.highRisk}</td></tr>
  </table>

  <h2>3. Rainwater Self-Sufficiency</h2>
  <p>
    Annual Harvestable Yield: <strong>${Math.round(annualYield).toLocaleString('en-IN')} L</strong><br/>
    Annual Water Demand: <strong>${Math.round(annualDemand).toLocaleString('en-IN')} L</strong><br/>
    Coverage: <strong class="badge">${annualYield && annualDemand ? Math.min(100, Math.round((annualYield / annualDemand) * 100)) : '—'}%</strong>
  </p>

  <h2>4. 10-Year Year-by-Year Projection (Current Scenario)</h2>
  <table>
    <tr><th>Year</th><th>Cost — Doing Nothing (₹L)</th><th>Cost — With RWH (₹L)</th><th>Net Benefit (₹L)</th></tr>
    ${chartData.map((r) => `
    <tr>
      <td>${r.year}</td>
      <td>${r.current}</td>
      <td>${r.withRWH}</td>
      <td style="color:${r.withRWH < r.current ? '#16a34a' : '#dc2626'};font-weight:bold">
        ${(r.current - r.withRWH).toFixed(2)}
      </td>
    </tr>`).join('')}
  </table>

  <p style="margin-top:48px;font-size:11px;color:#888;">
    Generated by WaterWallet · IS 1172 Compliant · Methodology: MMR DSR ₹${capexRatePerSqm}/m² · Open-Meteo rainfall data
  </p>
</body>
</html>`;

      const win = window.open('', '_blank');
      if (!win) { alert('Please allow pop-ups to download the report.'); return; }
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 400);
    }
  }, [societyName, flats, occupants, capex, capexRatePerSqm, breakEvens, chartData, annualYield, annualDemand, tenYearBleedRange, backendROI]);

  // ─── KPI Cards ───────────────────────────────────────────────────────────
  const kpiCards = [
    {
      icon: TrendingDown,
      label: '10-Year Water Bleed',
      value: `₹${tenYearBleedRange.low}–${tenYearBleedRange.high} L`,
      sub: 'Conservative → High-Risk range (tankers + municipal)',
      valueColor: 'text-red-600', iconBg: 'bg-red-50', iconColor: 'text-red-500', border: 'border-red-100',
    },
    {
      icon: IndianRupee,
      label: 'RWH Project Budget',
      value: `₹${capex.toFixed(2)} L`,
      sub: `Parametric Capex at ₹${capexRatePerSqm}/m² (adjustable below)`,
      valueColor: 'text-blue-700', iconBg: 'bg-blue-50', iconColor: 'text-blue-600', border: 'border-blue-100',
    },
    {
      icon: Clock,
      label: 'Break-Even Range',
      value: `${breakEvens.conservative} – ${breakEvens.highRisk}`,
      sub: `Conservative → High-Risk inflation scenario (FastAPI payback: ${
        loadingROI
          ? 'calculating...'
          : backendROI?.payback_years
            ? `${backendROI.payback_years} yrs`
            : 'N/A'
      })`,
      valueColor: 'text-green-600', iconBg: 'bg-green-50', iconColor: 'text-green-500', border: 'border-green-100',
    },
  ];

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center -mt-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Phase 3: ROI Simulator</h1>
          <p className="text-sm text-slate-500">
            What-If Scenario Matrix — three tanker inflation trajectories vs. RWH investment.
          </p>
        </div>
        <button
          id="download-pdf-btn"
          onClick={handleDownloadReport}
          className="flex items-center gap-2 border-2 border-blue-700 text-blue-700 font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-50 transition-colors text-sm shadow-sm"
        >
          <Download size={15} />
          Download PDF Report
        </button>
      </div>

      {/* Self-Sufficiency Badge (Feature 3) */}
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

      {/* Capex Sensitivity Slider (Feature 7) */}
      <CapexSlider value={capexRatePerSqm} onChange={setCapexRatePerSqm} />

      {/* Scenario Pill Selector + Chart */}
      <div className="bg-white rounded-2xl shadow-md p-6 border border-slate-100">
        <div className="mb-5 flex flex-wrap justify-between items-start gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">10-Year What-If Scenario Comparator</h2>
            <p className="text-xs text-slate-500 mt-1">
              Three tanker inflation trajectories overlaid on a single chart.
              Break-even lines shown where each scenario crosses the RWH cost curve.
            </p>
          </div>
          {/* Scenario legend pills */}
          <div className="flex flex-wrap gap-2">
            {SCENARIOS.map((s) => (
              <span
                key={s.key}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border"
                style={{ borderColor: s.color, color: s.color, backgroundColor: `${s.color}15` }}
              >
                <span
                  className="inline-block w-5 h-0.5 rounded"
                  style={{ backgroundColor: s.color, borderStyle: s.dash ? 'dashed' : 'solid' }}
                />
                {s.label} ({(s.gamma * 100).toFixed(0)}%)
              </span>
            ))}
            <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-green-500 text-green-700 bg-green-50">
              <span className="inline-block w-5 h-0.5 rounded bg-green-600" />
              With RWH
            </span>
          </div>
        </div>

        <BreakEvenChart chartData={chartData} breakEvens={breakEvens} />

        {/* Legend annotation */}
        <div className="mt-4 flex flex-wrap items-center gap-6 pt-4 border-t border-slate-50 text-xs text-slate-500">
          {SCENARIOS.map((s) => (
            <div key={s.key} className="flex items-center gap-2">
              <div className="w-8 h-0.5 rounded-full" style={{ backgroundColor: s.color }} />
              <span>
                <strong style={{ color: s.color }}>{s.label}</strong>: Break-even at{' '}
                <span className="font-bold text-slate-700">{breakEvens[s.key]}</span>
              </span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-green-600 rounded-full" />
            <span>With RWH: flat after Capex recovery (3% AMC + 5% municipal escalation only)</span>
          </div>
        </div>
      </div>
    </div>
  );
}