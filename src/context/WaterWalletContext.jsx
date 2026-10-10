/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { SEASONAL_WEIGHTS, calculateCanonicalDemand } from '../utils/waterConstants';

// ─── Default seed values mirror the old hardcoded dummy data ─────────────────
//   so the ROI Dashboard is never blank on first load.
const defaultBillingRows = [
  { id: 1, month: 'April',    year: '2025', bill: '18500', tankers: 14, costPerTanker: '1500', tankerCapacity: 10000 },
  { id: 2, month: 'May',      year: '2025', bill: '21200', tankers: 18, costPerTanker: '1500', tankerCapacity: 10000 },
  { id: 3, month: 'June',     year: '2025', bill: '19800', tankers: 11, costPerTanker: '1600', tankerCapacity: 10000 },
  { id: 4, month: 'March',    year: '2025', bill: '15300', tankers: 7,  costPerTanker: '1400', tankerCapacity: 10000 },
  { id: 5, month: 'February', year: '2025', bill: '12800', tankers: 4,  costPerTanker: '1400', tankerCapacity: 10000 },
  { id: 6, month: 'January',  year: '2025', bill: '13500', tankers: 3,  costPerTanker: '1400', tankerCapacity: 10000 },
];

const calcBillingTotals = (rows) => {
  const tankerSpend = rows.reduce((s, r) => s + Number(r.tankers || 0) * Number(r.costPerTanker || 0), 0);
  const municipal   = rows.reduce((s, r) => s + Number(r.bill || 0), 0);
  const tankerVolume = rows.reduce((s, r) => s + Number(r.tankers || 0) * Number(r.tankerCapacity || 10000), 0);
  return { totalTankerSpend: tankerSpend, totalMunicipal: municipal, totalTankerVolume: tankerVolume, billingMonths: rows.length || 1 };
};

const seedTotals = calcBillingTotals(defaultBillingRows);

// ─── Context ──────────────────────────────────────────────────────────────────
const WaterWalletContext = createContext(null);

export function WaterWalletProvider({ children }) {
  // ── Phase 1: Virtual Meter outputs ──
  const [societyId, setSocietyId] = useState(() => {
    const saved = localStorage.getItem("waterwallet_society_id");
    return saved ? parseInt(saved, 10) : null;
  });

  useEffect(() => {
    if (societyId) {
      localStorage.setItem("waterwallet_society_id", societyId.toString());
    } else {
      localStorage.removeItem("waterwallet_society_id");
    }
  }, [societyId]);

  const [societyName,      setSocietyName]      = useState('Evergreen Heights CHS');
  const [flats,            setFlats]             = useState(50);
  const [occupants,        setOccupants]         = useState(4);
  const [pincode,          setPincode]          = useState('400071');
  const [roofSurfaceType,  setRoofSurfaceType]  = useState('concrete');
  const [totalTankerSpend, setTotalTankerSpend]  = useState(seedTotals.totalTankerSpend);
  const [totalMunicipal,   setTotalMunicipal]    = useState(seedTotals.totalMunicipal);
  const [totalTankerVolume, setTotalTankerVolume] = useState(seedTotals.totalTankerVolume);
  const [billingMonths,    setBillingMonths]      = useState(seedTotals.billingMonths);

  // ── Phase 2: Map Studio outputs ──
  // One-time parametric capex in ₹
  const [estimatedCapex,  setEstimatedCapex]  = useState(1200 * 0.80 * 450);
  // Annual harvestable yield in litres (Turf area × rainfall × runoff)
  const [annualYield,     setAnnualYield]     = useState(1500000);
  // Annual water demand in litres
  const defaultDemandSeed = calculateCanonicalDemand({
    numFlats: 50,
    occupantsPerFlat: 4,
    includeLosses: true,
  }).adjustedDemand * 365;
  const [annualDemand, setAnnualDemand] = useState(defaultDemandSeed);
  const defaultRainfallNormals = [1, 1, 2, 18, 110, 510, 710, 580, 300, 95, 18, 2];
  const [monthlyRainfall, setMonthlyRainfall] = useState(defaultRainfallNormals);
  const [capexRatePerSqm, setCapexRatePerSqm] = useState(600);
  const [siteLatitude, setSiteLatitude] = useState(19.076);
  const [siteLongitude, setSiteLongitude] = useState(72.877);

  // ── ML Site Parameters ──
  const [borewell,        setBorewellState]   = useState(1);
  const [borewellDepth,   setBorewellDepth]   = useState(95.0);
  const [soilPerm,        setSoilPerm]        = useState(3);
  const [coastalKm,       setCoastalKm]       = useState(25.0);

  const setBorewell = (val) => {
    const num = Number(val);
    setBorewellState(num);
    if (num === 0) {
      setBorewellDepth(0.0);
    }
  };

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
    totalTankerVolume, setTotalTankerVolume,
    billingMonths,    setBillingMonths,

    // Phase 2
    estimatedCapex,   setEstimatedCapex,
    annualYield,      setAnnualYield,
    annualDemand,     setAnnualDemand,
    monthlyDemand,
    monthlyRainfall,  setMonthlyRainfall,
    capexRatePerSqm,  setCapexRatePerSqm,
    siteLatitude,     setSiteLatitude,
    siteLongitude,    setSiteLongitude,

    // ML Site Parameters
    borewell,         setBorewell,
    borewellDepth,    setBorewellDepth,
    soilPerm,         setSoilPerm,
    coastalKm,        setCoastalKm,
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
