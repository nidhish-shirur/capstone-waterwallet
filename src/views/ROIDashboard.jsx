import React, { useMemo } from 'react';
import { Download, TrendingDown, IndianRupee, Clock } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, Area, ComposedChart
} from 'recharts';
import { useWaterWallet } from '../context/WaterWalletContext';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl p-4 text-xs">
        <p className="font-bold text-slate-700 mb-2">{label}</p>
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-500">{entry.name}:</span>
            <span className="font-semibold" style={{ color: entry.color }}>
              ₹{entry.value.toFixed(2)} L
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function ROIDashboard() {
  // ─── Pull live values from global context ───
  const { totalTankerSpend, totalMunicipal, billingMonths, estimatedCapex } = useWaterWallet();

  // ─── Annualise billing totals (raw ₹ → ₹ Lakhs / year) ───
  //   Formula: (total spent over N recorded months ÷ N) × 12 ÷ 1,00,000
  const months          = billingMonths || 1;
  const annualTanker    = ((totalTankerSpend / months) * 12) / 100000 || 2.0;
  const annualMunicipal = ((totalMunicipal   / months) * 12) / 100000 || 0.46;
  const capex           = (estimatedCapex / 100000) || 4.8;

  // Financial Variables
  const tankerInflation = 0.08; // 8% Annual increase in private tanker costs
  const municipalInflation = 0.05; // 5% Annual increase in municipal water tax
  const rwhAmc = 0.03; // 3% Annual Maintenance Contract for filters/cleaning

  // ─── The Comparator ROI Engine (10-Year Compounding Loop) ───
  const { chartData, breakEvenYear, tenYearTankerBleed } = useMemo(() => {
    let cumulativeDoNothing = 0;
    let cumulativeRWH = capex; // RWH starts with the massive upfront cost
    let detectedBreakEven = null;
    const generatedData = [];

    for (let i = 1; i <= 10; i++) {
      // 1. Calculate this year's inflated operational costs
      const thisYearTanker = annualTanker * Math.pow(1 + tankerInflation, i - 1);
      const thisYearMunicipal = annualMunicipal * Math.pow(1 + municipalInflation, i - 1);
      const thisYearRwhMaintenance = capex * rwhAmc;

      // 2. Add to running totals
      cumulativeDoNothing += (thisYearTanker + thisYearMunicipal);
      
      // RWH eliminates tankers, but you still pay municipal + RWH maintenance
      cumulativeRWH += (thisYearMunicipal + thisYearRwhMaintenance); 

      // 3. Check for mathematical intersection (Break-Even)
      if (!detectedBreakEven && cumulativeRWH < cumulativeDoNothing) {
        detectedBreakEven = `Y${i}`;
      }

      // 4. Push to array
      generatedData.push({
        year: `Y${i}`,
        doNothing: parseFloat(cumulativeDoNothing.toFixed(2)),
        withRWH: parseFloat(cumulativeRWH.toFixed(2))
      });
    }

    return { 
      chartData: generatedData, 
      breakEvenYear: detectedBreakEven || '> 10 Years',
      tenYearTankerBleed: cumulativeDoNothing.toFixed(2)
    };
  }, [capex, annualTanker, annualMunicipal]);

  // ─── Dynamic KPI Cards ───
  const kpiCards = [
    {
      icon: TrendingDown, label: '10-Year Water Bleed', value: `₹${tenYearTankerBleed} L`,
      sub: 'Cumulative cost doing nothing (tankers + municipal)',
      valueColor: 'text-red-600', iconBg: 'bg-red-50', iconColor: 'text-red-500', border: 'border-red-100',
    },
    {
      icon: IndianRupee, label: 'RWH Project Budget', value: `₹${capex.toFixed(2)} L`,
      sub: 'One-time parametric Capex for full RWH system',
      valueColor: 'text-blue-700', iconBg: 'bg-blue-50', iconColor: 'text-blue-600', border: 'border-blue-100',
    },
    {
      icon: Clock, label: 'Estimated Break-Even', value: breakEvenYear,
      sub: 'Time to recover full RWH investment via savings',
      valueColor: 'text-green-600', iconBg: 'bg-green-50', iconColor: 'text-green-500', border: 'border-green-100',
    },
  ];

  return (
    <div className="p-8 space-y-6">
      {/* Header action */}
      <div className="flex justify-between items-center -mt-2">
        <div>
           <h1 className="text-2xl font-bold text-slate-800">Phase 3: ROI Simulator</h1>
           <p className="text-sm text-slate-500">Predictive financial analytics based on current inflation metrics.</p>
        </div>
        <button className="flex items-center gap-2 border-2 border-blue-700 text-blue-700 font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-50 transition-colors text-sm shadow-sm">
          <Download size={15} />
          Download PDF Report
        </button>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-4">
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
              <p className={`text-4xl font-extrabold ${card.valueColor} tracking-tight`}>{card.value}</p>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">{card.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Chart Card */}
      <div className="bg-white rounded-2xl shadow-md p-6 border border-slate-100">
        <div className="mb-5 flex justify-between items-end">
          <div>
            <h2 className="text-base font-semibold text-slate-900">10-Year Compounding Simulation</h2>
            <p className="text-xs text-slate-500 mt-1">
              Intersection indicates Break-Even point at <span className="font-bold text-green-600">{breakEvenYear}</span>
            </p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={360}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
            <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#f1f5f9" />
            <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 500 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => `₹${v}L`} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={55} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }} formatter={(value) => <span style={{ color: '#64748b', fontWeight: 500 }}>{value}</span>} />
            
            {/* Dynamic Break-Even Line */}
            {breakEvenYear !== '> 10 Years' && (
              <ReferenceLine
                x={breakEvenYear} stroke="#22c55e" strokeDasharray="5 3" strokeWidth={1.5}
                label={{ value: 'Break-Even', position: 'insideTopRight', fontSize: 11, fill: '#22c55e', fontWeight: 700 }}
              />
            )}
            
            <Area
              type="monotone" dataKey="doNothing" name="Cost of Doing Nothing"
              stroke="#dc2626" strokeWidth={2.5} fill="rgba(220,38,38,0.06)"
              dot={{ r: 4, fill: '#dc2626', strokeWidth: 0 }} activeDot={{ r: 6, fill: '#dc2626' }}
            />
            <Line
              type="monotone" dataKey="withRWH" name="Cost with Rainwater Harvesting"
              stroke="#16a34a" strokeWidth={2.5}
              dot={{ r: 4, fill: '#16a34a', strokeWidth: 0 }} activeDot={{ r: 6, fill: '#16a34a' }}
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Legend annotation */}
        <div className="mt-4 flex flex-wrap items-center gap-6 pt-4 border-t border-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-red-500 rounded-full"></div>
            <span className="text-xs text-slate-500 font-medium">Doing Nothing: Escalates rapidly due to 8% tanker inflation.</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-green-600 rounded-full"></div>
            <span className="text-xs text-slate-500 font-medium">With RWH: Flattens out; only compounding 3% maintenance and baseline tax.</span>
          </div>
        </div>
      </div>
    </div>
  );
}