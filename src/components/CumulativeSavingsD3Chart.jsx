import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import * as d3 from 'd3';
import { TrendingUp, ShieldCheck, Droplets, Award } from 'lucide-react';
import { formatRupees } from '../utils/formatters';

const HORIZONS = [
  { value: 5, label: '5 Years' },
  { value: 10, label: '10 Years' },
  { value: 20, label: '20 Years' },
];

/**
 * D3 Line Chart projecting cumulative water expenditure trajectories:
 * - Cumulative Spend without RWH (Do-Nothing Baseline)
 * - Cumulative Cost with RWH (Upfront Capex + AMC + residual water purchases)
 * - Highlighted break-even intersection landmark
 * - Interactive D3 crosshair tooltip tracking year-by-year cumulative savings
 */
export default function CumulativeSavingsD3Chart({
  capex = 250000,
  effectiveAnnualYield = 1200000,
  nonPotableDemandLitres = 4500000,
  annualTanker = 2.0, // in Lakhs
  annualTankerVolumeLitres = 1333333,
  annualMunicipal = 0.46, // in Lakhs
  municipalTariffPerKl = 15.0,
  inflationRate = 0.08,
  deterministicPayback = null,
}) {
  const [selectedHorizon, setSelectedHorizon] = useState(10);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(760);

  // Measure container for responsive D3 layout
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0] && entries[0].contentRect.width > 0) {
        setContainerWidth(Math.floor(entries[0].contentRect.width));
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute 20-year yearly financial projection data
  const fullProjectionData = useMemo(() => {
    const annualDemand = Math.max(1, Number(nonPotableDemandLitres || 4500000));
    const annualYield = Math.max(0, Number(effectiveAnnualYield || 0));
    const effectiveYield = Math.min(annualYield, annualDemand);

    const tankerSpendInr = (Number(annualTanker) || 0) * 100000;
    const municipalSpendInr = (Number(annualMunicipal) || 0) * 100000;
    const tankerVolumeLitres = Number(annualTankerVolumeLitres) || 0;

    const offsetTankerLitres = Math.min(effectiveYield, tankerVolumeLitres);
    const offsetMunicipalLitres = Math.min(
      effectiveYield - offsetTankerLitres,
      Math.max(0, annualDemand - tankerVolumeLitres)
    );

    const offsetTankerKl = offsetTankerLitres / 1000.0;
    const offsetMunicipalKl = offsetMunicipalLitres / 1000.0;

    const initialTankerRatePerKl =
      tankerVolumeLitres > 0
        ? tankerSpendInr / (tankerVolumeLitres / 1000.0)
        : 150.0;
    const initialMunicipalRatePerKl = Number(municipalTariffPerKl) || 15.0;

    const annualAMC = capex * 0.03;
    const escalation = Number(inflationRate) || 0.08;

    let cumulativeWithoutRwh = 0.0;
    let cumulativeWithRwh = capex; // Start with capex invested at year 0
    let cumulativeNetSavings = 0.0;
    let exactBreakEven = null;

    const rows = [
      {
        year: 0,
        cumulativeWithoutRwh: 0,
        cumulativeWithRwh: Math.round(capex),
        cumulativeNetSavings: -Math.round(capex),
        yearSavings: 0,
        yearWithoutRwh: 0,
        yearWithRwh: 0,
      },
    ];

    let currentTankerRate = initialTankerRatePerKl;
    let currentMunicipalRate = initialMunicipalRatePerKl;
    let currBaseTanker = tankerSpendInr;
    let currBaseMunicipal = municipalSpendInr;

    for (let yr = 1; yr <= 20; yr++) {
      const grossYearSavings =
        offsetTankerKl * currentTankerRate +
        offsetMunicipalKl * currentMunicipalRate;
      const netYearSavings = grossYearSavings - annualAMC;

      const yearSpendWithoutRwh = currBaseTanker + currBaseMunicipal;
      const yearSpendWithRwh =
        yearSpendWithoutRwh - grossYearSavings + annualAMC;

      cumulativeWithoutRwh += yearSpendWithoutRwh;
      cumulativeWithRwh += yearSpendWithRwh;
      cumulativeNetSavings += netYearSavings;

      if (
        exactBreakEven === null &&
        netYearSavings > 0 &&
        cumulativeNetSavings >= capex
      ) {
        const excess = cumulativeNetSavings - capex;
        exactBreakEven = Math.round((yr - excess / netYearSavings) * 10) / 10;
      }

      rows.push({
        year: yr,
        cumulativeWithoutRwh: Math.round(cumulativeWithoutRwh),
        cumulativeWithRwh: Math.round(cumulativeWithRwh),
        cumulativeNetSavings: Math.round(cumulativeNetSavings - capex),
        yearSavings: Math.round(netYearSavings),
        yearWithoutRwh: Math.round(yearSpendWithoutRwh),
        yearWithRwh: Math.round(yearSpendWithRwh),
        tankerRatePerKl: Math.round(currentTankerRate),
        avoidedTankersYear: Math.round(offsetTankerLitres / 10000),
      });

      currentTankerRate *= 1 + escalation;
      currentMunicipalRate *= 1.05;
      currBaseTanker *= 1 + escalation;
      currBaseMunicipal *= 1.05;
    }

    return { rows, exactBreakEven };
  }, [
    capex,
    effectiveAnnualYield,
    nonPotableDemandLitres,
    annualTanker,
    annualTankerVolumeLitres,
    annualMunicipal,
    municipalTariffPerKl,
    inflationRate,
  ]);

  // Current horizon sliced data
  const chartData = useMemo(() => {
    return fullProjectionData.rows.filter((r) => r.year <= selectedHorizon);
  }, [fullProjectionData, selectedHorizon]);

  // Dimensions & Margins
  const margin = { top: 28, right: 32, bottom: 44, left: 68 };
  const height = 340;
  const innerWidth = Math.max(100, containerWidth - margin.left - margin.right);
  const innerHeight = height - margin.top - margin.bottom;

  // D3 Scales & Generators
  const { xScale, yScale, lineBaseline, lineWithRwh, areaSavings, xTicks, yTicks } =
    useMemo(() => {
      const xSc = d3.scaleLinear().domain([0, selectedHorizon]).range([0, innerWidth]);

      const maxVal = d3.max(chartData, (d) =>
        Math.max(d.cumulativeWithoutRwh, d.cumulativeWithRwh)
      ) || 1000000;
      const yLimit = Math.ceil(maxVal * 1.12);

      const ySc = d3.scaleLinear().domain([0, yLimit]).range([innerHeight, 0]);

      const lBaseline = d3
        .line()
        .x((d) => xSc(d.year))
        .y((d) => ySc(d.cumulativeWithoutRwh))
        .curve(d3.curveMonotoneX);

      const lWithRwh = d3
        .line()
        .x((d) => xSc(d.year))
        .y((d) => ySc(d.cumulativeWithRwh))
        .curve(d3.curveMonotoneX);

      // Area between curves where With RWH is cheaper than Baseline
      const aSavings = d3
        .area()
        .x((d) => xSc(d.year))
        .y0((d) => ySc(d.cumulativeWithoutRwh))
        .y1((d) => ySc(d.cumulativeWithRwh))
        .curve(d3.curveMonotoneX);

      const xTickValues = Array.from({ length: selectedHorizon + 1 }, (_, i) => i).filter(
        (y) => {
          if (selectedHorizon === 20) return y % 2 === 0;
          return true;
        }
      );

      const yTickValues = ySc.ticks(5);

      return {
        xScale: xSc,
        yScale: ySc,
        lineBaseline: lBaseline,
        lineWithRwh: lWithRwh,
        areaSavings: aSavings,
        xTicks: xTickValues,
        yTicks: yTickValues,
        yMax: yLimit,
      };
    }, [chartData, selectedHorizon, innerWidth, innerHeight]);

  // Pointer hover tracking via D3 Bisector
  const handlePointerMove = useCallback(
    (e) => {
      if (!chartData || chartData.length === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX - rect.left - margin.left;

      if (mouseX < 0 || mouseX > innerWidth) {
        setHoveredPoint(null);
        return;
      }

      const yearVal = xScale.invert(mouseX);
      const bisect = d3.bisector((d) => d.year).center;
      const index = bisect(chartData, yearVal);
      const point = chartData[Math.min(chartData.length - 1, Math.max(0, index))];
      setHoveredPoint(point);
    },
    [chartData, xScale, innerWidth, margin.left]
  );

  const handlePointerLeave = useCallback(() => {
    setHoveredPoint(null);
  }, []);

  // Break-even determination
  const breakEvenYear = fullProjectionData.exactBreakEven || (deterministicPayback ? parseFloat(String(deterministicPayback).replace(/[^0-9.]/g, '')) : null);
  const isBreakEvenInView = breakEvenYear !== null && breakEvenYear <= selectedHorizon;

  // Horizon KPI metrics
  const horizonEndData = chartData[chartData.length - 1] || {};
  const horizonNetBenefit = (horizonEndData.cumulativeWithoutRwh || 0) - (horizonEndData.cumulativeWithRwh || 0);
  const horizonRoiPercent = capex > 0 ? Math.round((horizonNetBenefit / capex) * 100) : 0;
  const avoidedTankersTotal = Math.round(
    ((effectiveAnnualYield * selectedHorizon) / 10000) * 0.9
  );

  return (
    <div className="ww-card p-6 border border-slate-200 bg-white rounded-2xl shadow-sm mt-6">
      {/* Header and Horizon Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="ww-section-kicker">Long-Term D3 Projections</span>
            <span className="text-slate-300">·</span>
            <span className="text-xs text-slate-500 font-medium">
              Compounding Savings Trajectory
            </span>
          </div>
          <h3 className="text-xl font-bold text-slate-900 tracking-tight mt-0.5">
            Cumulative Water Cost Savings Horizon
          </h3>
        </div>

        {/* Horizon Tabs (Segmented Button Controls) */}
        <div className="inline-flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 self-start sm:self-auto">
          {HORIZONS.map((h) => {
            const isActive = selectedHorizon === h.value;
            return (
              <button
                key={h.value}
                onClick={() => setSelectedHorizon(h.value)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-white text-blue-900 shadow-sm border border-slate-200/50'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {h.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Trajectory Legend */}
      <div className="flex flex-wrap items-center gap-y-2 gap-x-5 text-xs pt-4 pb-2 text-slate-600">
        <div className="flex items-center gap-2">
          <span className="inline-block w-3.5 h-0.5 bg-slate-400 border-t border-dashed border-slate-600"></span>
          <span className="font-medium text-slate-700">Baseline (Do-Nothing Spend)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3.5 h-1 bg-blue-600 rounded-full"></span>
          <span className="font-semibold text-blue-900">With RWH (Capex + Operating Spend)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 bg-emerald-500/20 border border-emerald-500/60 rounded"></span>
          <span className="font-medium text-emerald-800">Net Cumulative Benefit Area</span>
        </div>
        {isBreakEvenInView && (
          <div className="flex items-center gap-1.5 text-emerald-700 font-semibold ml-auto">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Break-Even Landmark: Year {breakEvenYear}</span>
          </div>
        )}
      </div>

      {/* Responsive SVG Chart Canvas */}
      <div ref={containerRef} className="relative w-full overflow-hidden select-none">
        <svg
          width={containerWidth}
          height={height}
          className="overflow-visible"
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          <defs>
            {/* Shaded Area Benefit Gradient */}
            <linearGradient id="wwSavingsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.04" />
            </linearGradient>

            {/* With RWH Path Glow Filter */}
            <filter id="wwPathGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#1261a0" floodOpacity="0.18" />
            </filter>
          </defs>

          <g transform={`translate(${margin.left}, ${margin.top})`}>
            {/* Horizontal Gridlines & Y-Axis Labels */}
            {yTicks.map((tick) => {
              const yPos = yScale(tick);
              return (
                <g key={`y-${tick}`} className="text-slate-400">
                  <line
                    x1={0}
                    x2={innerWidth}
                    y1={yPos}
                    y2={yPos}
                    stroke="#e2e8f0"
                    strokeDasharray="3 3"
                    strokeWidth={1}
                  />
                  <text
                    x={-10}
                    y={yPos + 4}
                    textAnchor="end"
                    className="text-[11px] font-mono tabular-nums fill-slate-500"
                  >
                    ₹{(tick / 100000).toFixed(1)}L
                  </text>
                </g>
              );
            })}

            {/* X-Axis Horizontal Baseline Line */}
            <line
              x1={0}
              x2={innerWidth}
              y1={innerHeight}
              y2={innerHeight}
              stroke="#cbd5e1"
              strokeWidth={1.5}
            />

            {/* X-Axis Ticks & Year Labels */}
            {xTicks.map((year) => {
              const xPos = xScale(year);
              return (
                <g key={`x-${year}`}>
                  <line
                    x1={xPos}
                    x2={xPos}
                    y1={innerHeight}
                    y2={innerHeight + 6}
                    stroke="#94a3b8"
                    strokeWidth={1.2}
                  />
                  <text
                    x={xPos}
                    y={innerHeight + 20}
                    textAnchor="middle"
                    className="text-[11px] font-mono tabular-nums fill-slate-600 font-medium"
                  >
                    {year === 0 ? 'Now' : `Y${year}`}
                  </text>
                </g>
              );
            })}

            {/* Shaded Cumulative Savings Region (where Baseline > With RWH) */}
            <path
              d={areaSavings(chartData) || ''}
              fill="url(#wwSavingsGradient)"
              className="pointer-events-none transition-all duration-300"
            />

            {/* Baseline Spend Path (Do Nothing) */}
            <path
              d={lineBaseline(chartData) || ''}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="5 4"
              className="pointer-events-none"
            />

            {/* With RWH Path */}
            <path
              d={lineWithRwh(chartData) || ''}
              fill="none"
              stroke="#1261a0"
              strokeWidth={3}
              filter="url(#wwPathGlow)"
              className="pointer-events-none transition-all duration-300"
            />

            {/* Initial Capex Origin Marker (Year 0) */}
            <circle
              cx={xScale(0)}
              cy={yScale(capex)}
              r={4.5}
              fill="#1261a0"
              stroke="#ffffff"
              strokeWidth={2}
            />

            {/* Break-Even Landmark Annotation */}
            {isBreakEvenInView && (
              <g
                transform={`translate(${xScale(breakEvenYear)}, 0)`}
                className="pointer-events-none"
              >
                <line
                  x1={0}
                  x2={0}
                  y1={0}
                  y2={innerHeight}
                  stroke="#10b981"
                  strokeWidth={1.8}
                  strokeDasharray="4 3"
                />
                <circle
                  cx={0}
                  cy={yScale(
                    (chartData.find((d) => d.year === Math.round(breakEvenYear)) ||
                      chartData[Math.min(chartData.length - 1, Math.round(breakEvenYear))])
                      ?.cumulativeWithRwh || 0
                  )}
                  r={5}
                  fill="#10b981"
                  stroke="#ffffff"
                  strokeWidth={2}
                />
                <rect
                  x={-42}
                  y={4}
                  width={84}
                  height={20}
                  rx={4}
                  fill="#ecfdf5"
                  stroke="#a7f3d0"
                  strokeWidth={1}
                />
                <text
                  x={0}
                  y={17}
                  textAnchor="middle"
                  className="text-[10px] font-bold fill-emerald-800"
                >
                  Payback Y{breakEvenYear}
                </text>
              </g>
            )}

            {/* Interactive Crosshair & Hover Snapping */}
            {hoveredPoint && (
              <g className="pointer-events-none">
                {/* Hairline Crosshair */}
                <line
                  x1={xScale(hoveredPoint.year)}
                  x2={xScale(hoveredPoint.year)}
                  y1={0}
                  y2={innerHeight}
                  stroke="#0284c7"
                  strokeWidth={1.2}
                  strokeDasharray="3 2"
                />

                {/* Baseline Dot */}
                <circle
                  cx={xScale(hoveredPoint.year)}
                  cy={yScale(hoveredPoint.cumulativeWithoutRwh)}
                  r={5}
                  fill="#64748b"
                  stroke="#ffffff"
                  strokeWidth={2}
                />

                {/* With RWH Dot */}
                <circle
                  cx={xScale(hoveredPoint.year)}
                  cy={yScale(hoveredPoint.cumulativeWithRwh)}
                  r={6}
                  fill="#1261a0"
                  stroke="#ffffff"
                  strokeWidth={2.5}
                />
              </g>
            )}

            {/* Invisible Pointer Overlay */}
            <rect
              x={0}
              y={0}
              width={innerWidth}
              height={innerHeight}
              fill="transparent"
              className="cursor-crosshair"
            />
          </g>
        </svg>

        {/* Floating Crosshair HTML Tooltip */}
        {hoveredPoint && (
          <div
            className="absolute z-20 pointer-events-none bg-slate-900/95 backdrop-blur-sm text-white rounded-xl p-3.5 shadow-xl border border-slate-700/60 text-xs transition-transform duration-75"
            style={{
              left: `${Math.min(
                Math.max(margin.left + 10, margin.left + xScale(hoveredPoint.year) - 110),
                containerWidth - 230
              )}px`,
              top: '14px',
            }}
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700">
              <span className="font-bold text-slate-200">
                {hoveredPoint.year === 0 ? 'Project Initiation' : `Year ${hoveredPoint.year} Projection`}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {hoveredPoint.year === 0 ? 'Initial Capex' : `Tariff: ₹${hoveredPoint.tankerRatePerKl}/kL`}
              </span>
            </div>

            <div className="space-y-1.5 font-mono tabular-nums">
              <div className="flex items-center justify-between gap-4 text-slate-300">
                <span>Baseline Spend:</span>
                <span className="font-medium text-slate-100">
                  {formatRupees(hoveredPoint.cumulativeWithoutRwh)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 text-slate-300">
                <span>Total with RWH:</span>
                <span className="font-medium text-blue-300">
                  {formatRupees(hoveredPoint.cumulativeWithRwh)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 pt-1.5 mt-1 border-t border-slate-800 font-semibold">
                <span className="text-emerald-400">Net Cumulative Benefit:</span>
                <span
                  className={
                    hoveredPoint.cumulativeWithoutRwh >= hoveredPoint.cumulativeWithRwh
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }
                >
                  {hoveredPoint.cumulativeWithoutRwh >= hoveredPoint.cumulativeWithRwh
                    ? `+${formatRupees(hoveredPoint.cumulativeWithoutRwh - hoveredPoint.cumulativeWithRwh)}`
                    : `-${formatRupees(hoveredPoint.cumulativeWithRwh - hoveredPoint.cumulativeWithoutRwh)}`}
                </span>
              </div>
              {hoveredPoint.year > 0 && (
                <div className="text-[10px] text-slate-400 pt-1 flex justify-between">
                  <span>Annual Savings:</span>
                  <span className="text-slate-200">+{formatRupees(hoveredPoint.yearSavings)}/yr</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Horizon Cumulative KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-4 mt-2 border-t border-slate-100">
        <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/70">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <span>Net {selectedHorizon}-Year Savings</span>
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono tabular-nums">
            {horizonNetBenefit >= 0 ? `+${formatRupees(horizonNetBenefit)}` : `-${formatRupees(Math.abs(horizonNetBenefit))}`}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            After 3% annual maintenance deduction
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/70">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mb-1">
            <Award className="w-3.5 h-3.5 text-blue-600" />
            <span>Capex Return Multiple</span>
          </div>
          <div className="text-lg font-bold text-blue-900 font-mono tabular-nums">
            {horizonRoiPercent > 0 ? `+${horizonRoiPercent}%` : 'Amortizing'}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Net return on initial ₹{(capex / 100000).toFixed(1)}L capex
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/70">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mb-1">
            <Droplets className="w-3.5 h-3.5 text-teal-600" />
            <span>Avoided Tanker Deliveries</span>
          </div>
          <div className="text-lg font-bold text-teal-900 font-mono tabular-nums">
            ~{avoidedTankersTotal.toLocaleString()} tankers
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Based on ~10,000 L tanker truck capacity
          </p>
        </div>
      </div>
    </div>
  );
}
