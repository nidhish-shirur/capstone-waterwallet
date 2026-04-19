import React, { createContext, useContext, useState } from 'react';

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
  const [societyName,      setSocietyName]      = useState('Evergreen Heights CHS');
  const [flats,            setFlats]             = useState(50);
  const [occupants,        setOccupants]         = useState(4);
  const [totalTankerSpend, setTotalTankerSpend]  = useState(seedTotals.totalTankerSpend);
  const [totalMunicipal,   setTotalMunicipal]    = useState(seedTotals.totalMunicipal);
  const [billingMonths,    setBillingMonths]      = useState(seedTotals.billingMonths);

  // ── Phase 2: Map Studio outputs ──
  const [estimatedCapex, setEstimatedCapex] = useState(1200 * 0.80 * 450); // default tracedArea=1200

  const value = {
    // Phase 1
    societyName,      setSocietyName,
    flats,            setFlats,
    occupants,        setOccupants,
    totalTankerSpend, setTotalTankerSpend,
    totalMunicipal,   setTotalMunicipal,
    billingMonths,    setBillingMonths,

    // Phase 2
    estimatedCapex,   setEstimatedCapex,
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
