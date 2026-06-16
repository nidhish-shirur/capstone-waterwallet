/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useMemo } from 'react';
import { SEASONAL_WEIGHTS, calculateCanonicalDemand } from '../utils/waterConstants';

// ─── Default seed values mirror the old hardcoded dummy data ─────────────────
//   so the ROI Dashboard is never blank on first load.
const defaultBillingRows = [
  { id: 1, month: 'April',    year: '2025', bill: '18500', tankers: 14, costPerTanker: '1500' },
  { id: 2, month: 'May',      year: '2025', bill: '21200', tankers: 18, costPerTanker: '1500' },
  { id: 3, month: 'June',     year: '2025', bill: '19800', tankers: 11, costPerTanker: '1600' },
  { id: 4, month: 'March',    year: '2025', bill: '15300', tankers: 7,  costPerTanker: '1400' },
  { id: 5, month: 'February', year: '2025', bill: '12800', tankers: 4,  costPerTanker: '1400' },
  { id: 6, month: 'January',  year: '2025', bill: '13500', tankers: 3,  costPerTanker: '1400' },
];

const calcBillingTotals = (rows) => {
  const tankerSpend = rows.reduce((s, r) => s + Number(r.tankers || 0) * Number(r.costPerTanker || 0), 0);
  const municipal   = rows.reduce((s, r) => s + Number(r.bill || 0), 0);
  return { totalTankerSpend: tankerSpend, totalMunicipal: municipal, billingMonths: rows.length || 1 };
};

const seedTotals = calcBillingTotals(defaultBillingRows);

// ─── Context ──────────────────────────────────────────────────────────────────
const WaterWalletContext = createContext(null);

export function WaterWalletProvider({ children }) {
  // ── Phase 1: Virtual Meter outputs ──
  const [societyId,        setSocietyId]        = useState(null);
  const [societyName,      setSocietyName]      = useState('Evergreen Heights CHS');
  const [flats,            setFlats]             = useState(50);
  const [occupants,        setOccupants]         = useState(4);
  const [pincode,          setPincode]          = useState('400071');
  const [roofSurfaceType,  setRoofSurfaceType]  = useState('concrete');
  const [totalTankerSpend, setTotalTankerSpend]  = useState(seedTotals.totalTankerSpend);
  const [totalMunicipal,   setTotalMunicipal]    = useState(seedTotals.totalMunicipal);
  const [billingMonths,    setBillingMonths]      = useState(seedTotals.billingMonths);

  // ── Phase 2: Map Studio outputs ──
  // One-time parametric capex in ₹
  const [estimatedCapex,  setEstimatedCapex]  = useState(1200 * 0.80 * 450);
  // Annual harvestable yield in litres (Turf area × rainfall × runoff)
  const [annualYield,     setAnnualYield]     = useState(0);
  // Annual water demand in litres — synced from VirtualMeter for Phase 3 badge.
  // Seed = same defaults as the VirtualMeter initial state (50 flats, 4 occ,
  // UFW on, no amenities) computed through the canonical demand function so
  // the seed and the live value are always produced by the same formula.
  const defaultDemandSeed = calculateCanonicalDemand({
    numFlats: 50,
    occupantsPerFlat: 4,
    includeLosses: true,
    amenityMultiplier: 0,
  }).adjustedDemand * 365;
  const [annualDemand,    setAnnualDemand]    = useState(defaultDemandSeed);
  // Monthly rainfall mm array (Jan–Dec, 12 values) for bar chart + monsoon score
  const [monthlyRainfall, setMonthlyRainfall] = useState(Array(12).fill(0));
  // Capex rate ₹/m² — adjustable via ROI Dashboard sensitivity slider
  const [capexRatePerSqm, setCapexRatePerSqm] = useState(600);

  // ── Derived State ──
  const monthlyDemand = useMemo(() => {
    const sumWeights = SEASONAL_WEIGHTS.reduce((a, b) => a + b, 0);
    return SEASONAL_WEIGHTS.map(w => annualDemand * (w / sumWeights));
  }, [annualDemand]);

  const value = {
    // Phase 1
    societyId,        setSocietyId,
    societyName,      setSocietyName,
    flats,            setFlats,
    occupants,        setOccupants,
    pincode,          setPincode,
    roofSurfaceType,  setRoofSurfaceType,
    totalTankerSpend, setTotalTankerSpend,
    totalMunicipal,   setTotalMunicipal,
    billingMonths,    setBillingMonths,

    // Phase 2
    estimatedCapex,   setEstimatedCapex,
    annualYield,      setAnnualYield,
    annualDemand,     setAnnualDemand,
    monthlyDemand,
    monthlyRainfall,  setMonthlyRainfall,
    capexRatePerSqm,  setCapexRatePerSqm,
  };

  return (
    <WaterWalletContext.Provider value={value}>
      {children}
    </WaterWalletContext.Provider>
  );
}

// ─── Custom hook ──────────────────────────────────────────────────────────────
export function useWaterWallet() {
  const ctx = useContext(WaterWalletContext);
  if (!ctx) throw new Error('useWaterWallet must be used inside <WaterWalletProvider>');
  return ctx;
}
