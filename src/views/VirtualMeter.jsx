import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Building2, Zap, Plus, Trash2, Droplets, TrendingUp, Calculator } from 'lucide-react';
import { useWaterWallet } from '../context/WaterWalletContext';
import { fetchSocietyBaseline, createSociety, getSociety, getSocietyFromDatabase, getLatestSocietyAnalysis, getSocietyWaterAudit, updateSociety, saveBillingEntries, fetchSocieties, fetchDatabaseSocieties } from '../api/waterwallet';
import {
  IS_LPCD,
  UFW_LOSS_FACTOR,
  calculateCanonicalDemand,
} from '../utils/waterConstants';
import { formatRupees as fmtINR } from '../utils/formatters';

// ─── Constants ────────────────────────────────────────────────────────────────
// IS_LPCD (135 L/person/day) is imported from waterConstants — single source
// of truth shared with the backend constant IS_LPCD in models/constants.py.

// Amenities options removed

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 4 }, (_, i) => String(currentYear - i));

// ─── Pre-filled dummy billing rows (1 year of logs: Jan to Dec)
const defaultBillingRows = [
  { id: 1,  month: 'January',   year: '2025', bill: '14200', tankers: 16, costPerTanker: '1500', tankerCapacity: 10000, municipalVolumeKl: '', borewellVolumeKl: '' },
  { id: 2,  month: 'February',  year: '2025', bill: '14500', tankers: 18, costPerTanker: '1500', tankerCapacity: 10000, municipalVolumeKl: '', borewellVolumeKl: '' },
  { id: 3,  month: 'March',     year: '2025', bill: '15800', tankers: 22, costPerTanker: '1500', tankerCapacity: 10000, municipalVolumeKl: '', borewellVolumeKl: '' },
  { id: 4,  month: 'April',     year: '2025', bill: '17200', tankers: 24, costPerTanker: '1500', tankerCapacity: 10000, municipalVolumeKl: '', borewellVolumeKl: '' },
  { id: 5,  month: 'May',       year: '2025', bill: '18500', tankers: 25, costPerTanker: '1500', tankerCapacity: 10000, municipalVolumeKl: '', borewellVolumeKl: '' },
  { id: 6,  month: 'June',      year: '2025', bill: '16900', tankers: 21, costPerTanker: '1500', tankerCapacity: 10000, municipalVolumeKl: '', borewellVolumeKl: '' },
  { id: 7,  month: 'July',      year: '2025', bill: '14000', tankers: 15, costPerTanker: '1500', tankerCapacity: 10000, municipalVolumeKl: '', borewellVolumeKl: '' },
  { id: 8,  month: 'August',    year: '2025', bill: '13800', tankers: 15, costPerTanker: '1500', tankerCapacity: 10000, municipalVolumeKl: '', borewellVolumeKl: '' },
  { id: 9,  month: 'September', year: '2025', bill: '14100', tankers: 16, costPerTanker: '1500', tankerCapacity: 10000, municipalVolumeKl: '', borewellVolumeKl: '' },
  { id: 10, month: 'October',   year: '2025', bill: '15200', tankers: 19, costPerTanker: '1500', tankerCapacity: 10000, municipalVolumeKl: '', borewellVolumeKl: '' },
  { id: 11, month: 'November',  year: '2025', bill: '14800', tankers: 20, costPerTanker: '1500', tankerCapacity: 10000, municipalVolumeKl: '', borewellVolumeKl: '' },
  { id: 12, month: 'December', year: '2025', bill: '14400', tankers: 17, costPerTanker: '1500', tankerCapacity: 10000, municipalVolumeKl: '', borewellVolumeKl: '' },
];

// ─── Toggle Switch ──────────────────────────────────────────────────────────
function ToggleSwitch({ checked, onChange, label }) {
  return (
    <label className="toggle-switch" aria-label={label}>
      <input type="checkbox" checked={checked} onChange={onChange} aria-label={label} />
      <span className="toggle-slider"></span>
    </label>
  );
}

// AmenityCheckbox component removed



// ─── Main Component ───────────────────────────────────────────────────────────
let nextId = 100;

export default function VirtualMeter() {
  const navigate = useNavigate();
  const {
    societyId,
    setSocietyId,
    pincode: ctxPincode,
    setPincode: setCtxPincode,
    roofSurfaceType: ctxRoofSurfaceType,
    setRoofSurfaceType: setCtxRoofSurfaceType,
    setSocietyName: setCtxSocietyName,
    setFlats: setCtxFlats,
    setOccupants: setCtxOccupants,
    setTotalTankerSpend,
    setTotalMunicipal,
    setTotalTankerVolume,
    setBillingMonths,
    setAnnualDemand,
    setPotableDemand,
    setNonPotableDemand,
    setEstimatedCapex,
    setAnnualYield,
    setMonthlyRainfall,
    setGrossRoofArea,
    setSiteLatitude,
    setSiteLongitude,
    setRoofPolygonPoints,
    setPolygonGeoJSON,
    setTankCapacityLitres,
    societyName: ctxSocietyName,
    flats: ctxFlats,
    occupants: ctxOccupants,
  } = useWaterWallet();

  // ── Card 1 state
  const [societyName, setSocietyName] = useState(ctxSocietyName || 'Evergreen Heights CHS');
  const [flats, setFlats] = useState(ctxFlats || 50);
  const [occupants, setOccupants] = useState(ctxOccupants || 4);
  const [pincode, setPincode] = useState(ctxPincode || '400071');
  const [roofSurfaceType, setRoofSurfaceType] = useState(ctxRoofSurfaceType || 'concrete');
  const [includeLosses, setIncludeLosses] = useState(true); // 15% UFW (Unaccounted for Water)
  const [useMeteredData, setUseMeteredData] = useState(false);
  const [meteredFrequency, setMeteredFrequency] = useState('Quarterly');
  const [meteredConsumption, setMeteredConsumption] = useState('');
  const [meteredBill, setMeteredBill] = useState('');
  const [meteredTankerVolume, setMeteredTankerVolume] = useState('');

  // ── Database states
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [waterAudit, setWaterAudit] = useState(null);
  const [waterAuditError, setWaterAuditError] = useState(null);
  const [waterAuditLoading, setWaterAuditLoading] = useState(false);
  
  // ── Load Society state
  const [savedSocieties, setSavedSocieties] = useState([]);

  useEffect(() => {
    fetchDatabaseSocieties()
      .catch(() => fetchSocieties())
      .then((data) => setSavedSocieties(data))
      .catch((err) => console.error("Error loading saved societies", err));
  }, []);

  // ── Card 2 state
  const [billingRows, setBillingRows] = useState(defaultBillingRows);

  // ── Live demand calculation — delegates to the canonical formula in waterConstants
  // Layers applied in sequence:
  //   1. baseDemand    = flats × occupants × IS_LPCD
  //   2. afterAmenities = base × (1 + amenity multipliers)
  //   3. afterUFW      = afterAmenities × 1.15  [if includeLosses]
  //   4. adjustedDemand = afterUFW × 1.10        [peak-demand buffer, always applied]
  // ── Live demand calculation — delegates to the canonical formula in waterConstants
  // Layers applied in sequence:
  //   1. baseDemand    = flats × occupants × IS_LPCD
  //   2. afterUFW      = base × 1.15  [if includeLosses]
  //   3. adjustedDemand = afterUFW × 1.10 [peak-demand buffer, always applied]
  //   4. potableDemand = 70 LPCD proportional share
  //   5. nonPotableDemand = 65 LPCD proportional share (RWH Target)
  const {
    baseDemand,
    adjustedDemand,
    potableDemand,
    nonPotableDemand,
  } = useMemo(() => {
    return calculateCanonicalDemand({
      numFlats: Number(flats),
      occupantsPerFlat: Number(occupants),
      lpcd: IS_LPCD,
      includeLosses,
    });
  }, [flats, occupants, includeLosses]);

  // ── Billing totals
  const { totalTankerSpend, totalMunicipal, avgMonthly, totalTankerVolume } = useMemo(() => {
    const tankerSpend = billingRows.reduce((s, r) => s + Number(r.tankers || 0) * Number(r.costPerTanker || 0), 0);
    const municipal = billingRows.reduce((s, r) => s + Number(r.bill || 0), 0);
    const volume = billingRows.reduce((s, r) => s + Number(r.tankers || 0) * Number(r.tankerCapacity || 0), 0);
    const avg = billingRows.length ? Math.round((tankerSpend + municipal) / billingRows.length) : 0;
    return { totalTankerSpend: tankerSpend, totalMunicipal: municipal, avgMonthly: avg, totalTankerVolume: volume };
  }, [billingRows]);

  // ── State to hold backend-computed annual demand (default to local calculation fallback)
  const [backendDemand, setBackendDemand] = useState(adjustedDemand * 365);

  // ── Fetch demand baseline from FastAPI backend ──
  useEffect(() => {
    if (!flats || !occupants) return;

    const handler = setTimeout(() => {
      fetchSocietyBaseline({
        num_flats: Number(flats),
        occupants_per_flat: Number(occupants),
        include_losses: includeLosses,
      })
        .then((data) => {
          setBackendDemand(data.daily_demand_lpd * 365);
        })
        .catch((err) => {
          console.error("Backend baseline calculation error:", err);
        });
    }, 250);

    return () => clearTimeout(handler);
  }, [flats, occupants, includeLosses]);

  // ── Sync computed totals to global context whenever they change ──
  useEffect(() => {
    setCtxSocietyName(societyName);
    setCtxFlats(Number(flats));
    setCtxOccupants(Number(occupants));
    setCtxPincode(pincode);
    setCtxRoofSurfaceType(roofSurfaceType);
    
    if (useMeteredData) {
      const multipliers = { 'Monthly': 12, 'Quarterly': 4, 'Half-Yearly': 2, 'Yearly': 1 };
      const m = multipliers[meteredFrequency] || 4;
      const tankerMonths = billingRows.length || 1;
      const annualisedTanker = (totalTankerSpend / tankerMonths) * 12;
      setTotalTankerSpend(annualisedTanker);
      setTotalMunicipal(Number(meteredBill || 0) * m);
      setTotalTankerVolume(Number(meteredTankerVolume || 0) * m);
      setBillingMonths(12);
      const meteredAnnualDemand = Number(meteredConsumption || 0) * m;
      setAnnualDemand(meteredAnnualDemand);
      setPotableDemand(Math.round(meteredAnnualDemand * (70 / 135)));
      setNonPotableDemand(Math.round(meteredAnnualDemand * (65 / 135)));
    } else {
      setTotalTankerSpend(totalTankerSpend);
      setTotalMunicipal(totalMunicipal);
      setTotalTankerVolume(totalTankerVolume);
      setBillingMonths(billingRows.length || 1);
      setAnnualDemand(backendDemand);
      setPotableDemand(potableDemand * 365);
      setNonPotableDemand(nonPotableDemand * 365);
    }
  }, [
    societyName, flats, occupants, pincode, roofSurfaceType, totalTankerSpend, totalMunicipal,
    billingRows.length, backendDemand, useMeteredData,
    meteredFrequency, meteredConsumption, meteredBill, meteredTankerVolume, totalTankerVolume,
    potableDemand, nonPotableDemand,
    setAnnualDemand, setBillingMonths, setCtxFlats, setCtxOccupants, setCtxPincode, setCtxRoofSurfaceType, setCtxSocietyName, setNonPotableDemand, setPotableDemand, setTotalMunicipal, setTotalTankerSpend, setTotalTankerVolume
  ]);

  // ── Row handlers
  const addRow = () => {
    setBillingRows((prev) => [
      ...prev,
      { id: ++nextId, month: 'July', year: String(currentYear), bill: '', tankers: 0, costPerTanker: '1500', tankerCapacity: 10000, municipalVolumeKl: '', borewellVolumeKl: '' },
    ]);
  };

  const deleteRow = (id) => setBillingRows((prev) => prev.filter((r) => r.id !== id));

  const updateRow = (id, field, value) =>
    setBillingRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));

  // ── Load society data on mount if societyId is present ──
  useEffect(() => {
    if (societyId) {
      setIsLoading(true);
      getSocietyFromDatabase(societyId)
        .catch((error) => {
        if (![404, 503].includes(error.response?.status)) {
            throw error;
          }
          return getSociety(societyId);
        })
        .then((data) => {
          setSocietyName(data.name);
          setFlats(data.num_flats);
          setOccupants(data.occupants);
          setPincode(data.pincode);
          if (data.roof_surface_type) {
            setRoofSurfaceType(data.roof_surface_type);
          }
          if (data.billing_entries && data.billing_entries.length > 0) {
            const mappedRows = data.billing_entries.map((entry) => ({
              id: entry.id,
              month: MONTHS[entry.month - 1] || 'January',
              year: String(entry.year),
              bill: entry.municipal_bill == null ? '' : String(entry.municipal_bill),
              tankers: entry.tankers == null ? '' : entry.tankers,
              costPerTanker: entry.cost_per_tanker == null ? '' : String(entry.cost_per_tanker),
              tankerCapacity: entry.tanker_capacity_l == null ? '' : entry.tanker_capacity_l,
              municipalVolumeKl: entry.municipal_volume_kl == null ? '' : String(entry.municipal_volume_kl),
              borewellVolumeKl: entry.borewell_volume_kl == null ? '' : String(entry.borewell_volume_kl),
            }));
            setBillingRows(mappedRows);
          }
          setWaterAuditLoading(true);
          getSocietyWaterAudit(societyId)
            .then((audit) => {
              setWaterAudit(audit);
              setWaterAuditError(null);
            })
            .catch((error) => {
              console.error('Error loading monthly water audit:', error);
              setWaterAuditError(error.response?.data?.detail || 'Could not load the saved monthly water audit.');
            })
            .finally(() => setWaterAuditLoading(false));
        })
        .then(() => getLatestSocietyAnalysis(societyId).catch((error) => {
          if (error.response?.status === 404) return null;
          throw error;
        }))
        .then((analysis) => {
          if (!analysis) return;
          if (analysis.estimated_capex != null) setEstimatedCapex(analysis.estimated_capex);
          if (analysis.annual_yield_l != null) setAnnualYield(analysis.annual_yield_l);
          if (analysis.annual_demand_l != null) setAnnualDemand(analysis.annual_demand_l);
          const computed = analysis.computed_data || {};
          if (computed.gross_roof_area_sqm > 0) setGrossRoofArea(computed.gross_roof_area_sqm);
          if (Array.isArray(computed.monthly_rainfall_mm) && computed.monthly_rainfall_mm.length === 12) {
            setMonthlyRainfall(computed.monthly_rainfall_mm);
          }
          if (Number.isFinite(computed.site_latitude)) setSiteLatitude(computed.site_latitude);
          if (Number.isFinite(computed.site_longitude)) setSiteLongitude(computed.site_longitude);
          if (computed.tank_capacity_litres != null) setTankCapacityLitres(Number(computed.tank_capacity_litres));
          if (Array.isArray(computed.roof_polygon_points) && computed.roof_polygon_points.length >= 3) {
            setRoofPolygonPoints(computed.roof_polygon_points);
          } else if (computed.polygon_geojson?.geometry?.coordinates?.[0]?.length >= 4) {
            const rawCoords = computed.polygon_geojson.geometry.coordinates[0];
            const pts = rawCoords.slice(0, -1).map(([lng, lat]) => [lat, lng]);
            setRoofPolygonPoints(pts);
          }
          if (computed.polygon_geojson) setPolygonGeoJSON(computed.polygon_geojson);
        })
        .catch((err) => {
          console.error("Error loading society:", err);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [societyId, setAnnualDemand, setAnnualYield, setEstimatedCapex, setGrossRoofArea, setMonthlyRainfall, setSiteLatitude, setSiteLongitude, setRoofPolygonPoints, setPolygonGeoJSON, setTankCapacityLitres]);

  // ── Save/Update society data and billing rows ──
  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus(null);
    try {
      let savedSociety;
      const societyPayload = {
        name: societyName,
        pincode: pincode,
        num_flats: Number(flats),
        occupants: Number(occupants),
        roof_surface_type: roofSurfaceType,
      };

      if (societyId) {
        savedSociety = await updateSociety(societyId, societyPayload);
      } else {
        savedSociety = await createSociety(societyPayload);
        setSocietyId(savedSociety.id);
      }

      // Map UI billing rows to API schema format
      const billingPayload = billingRows.map((row) => {
        const monthIndex = MONTHS.indexOf(row.month) + 1;
        return {
          month: monthIndex > 0 ? monthIndex : 1,
          year: Number(row.year),
          municipal_bill: row.bill ? Number(row.bill) : null,
          tankers: row.tankers === '' || row.tankers == null ? null : Number(row.tankers),
          cost_per_tanker: row.costPerTanker === '' || row.costPerTanker == null ? null : Number(row.costPerTanker),
          tanker_capacity_l: row.tankerCapacity === '' || row.tankerCapacity == null ? null : Number(row.tankerCapacity),
          municipal_volume_kl: row.municipalVolumeKl === '' || row.municipalVolumeKl == null ? null : Number(row.municipalVolumeKl),
          borewell_volume_kl: row.borewellVolumeKl === '' || row.borewellVolumeKl == null ? null : Number(row.borewellVolumeKl),
        };
      });

      await saveBillingEntries(savedSociety.id, billingPayload);
      setSaveStatus({ type: 'success', message: 'Society data saved successfully!' });
      setTimeout(() => setSaveStatus(null), 3000);
      setWaterAuditLoading(true);
      setWaterAuditError(null);
      try {
        setWaterAudit(await getSocietyWaterAudit(savedSociety.id));
      } catch (error) {
        console.error('Error calculating monthly water audit:', error);
        setWaterAuditError(error.response?.data?.detail || 'Billing rows were saved, but the water audit could not be loaded.');
      } finally {
        setWaterAuditLoading(false);
      }
    } catch (err) {
      console.error("Error saving society:", err);
      setSaveStatus({ type: 'error', message: 'Failed to save data. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="page-content p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="ww-page-intro rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-700 to-blue-900 px-5 py-5 text-white shadow-md sm:px-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-100">Start with the baseline</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Describe your society’s water demand</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-blue-100">Use planning assumptions or your own bills. WaterWallet carries these inputs into the rooftop and return analysis.</p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-50">1 of 3 · Society profile</span>
        </div>
      </div>

      {/* ── Card 1: Society Baseline Data ── */}
      <div className="ww-card p-4 sm:p-6 relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/75 backdrop-blur-[1px] flex items-center justify-center rounded-2xl z-10">
            <div className="flex items-center gap-2 text-blue-700 font-semibold text-sm">
              <span className="w-5 h-5 border-2 border-blue-700 border-t-transparent rounded-full animate-spin"></span>
              Loading society data...
            </div>
          </div>
        )}
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <Building2 size={20} className="text-blue-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Society Baseline Data</h2>
            <p className="text-xs text-slate-500">Configure your society's parameters to calculate baseline water demand</p>
          </div>
          
          {savedSocieties.length > 0 && (
            <div className="sm:ml-auto flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Load Saved:</label>
              <select
                className="ww-input border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={societyId || ""}
                onChange={(e) => setSocietyId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">-- New Society --</option>
                {savedSocieties.map(soc => (
                  <option key={soc.id} value={soc.id}>{soc.name} ({soc.pincode})</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Society Name */}
          <div className="lg:col-span-2 space-y-1.5">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Society Name</label>
            <input
              type="text"
              value={societyName}
              onChange={(e) => setSocietyName(e.target.value)}
              placeholder="e.g. Evergreen Heights CHS"
              className="ww-input w-full px-4 py-2.5 text-sm font-medium placeholder-slate-300 bg-slate-50 transition"
            />
          </div>

          {/* Pincode */}
          <div className="lg:col-span-1 space-y-1.5">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Pincode</label>
            <input
              type="text"
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              placeholder="e.g. 400071"
              maxLength={6}
              className="ww-input w-full px-4 py-2.5 text-sm font-semibold bg-slate-50 transition"
            />
          </div>

          {/* Total Flats */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Number of Flats</label>
            <input
              type="number"
              min={1}
              value={flats}
              onChange={(e) => setFlats(e.target.value)}
              className="ww-input w-full px-4 py-2.5 text-sm font-semibold bg-slate-50 transition"
            />
          </div>

          {/* Avg Occupants */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Occupants per Flat</label>
            <input
              type="number"
              min={1}
              value={occupants}
              onChange={(e) => setOccupants(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 transition"
            />
          </div>

          {/* Roof Surface Type Dropdown */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Roof Surface Type</label>
            <select
              value={roofSurfaceType}
              onChange={(e) => setRoofSurfaceType(e.target.value)}
              className="ww-input w-full px-4 py-2.5 text-sm font-semibold bg-slate-50 transition"
            >
              <option value="concrete">Concrete (Runoff: 0.90)</option>
              <option value="metal">Metal (Runoff: 0.90)</option>
              <option value="gravel">Gravel (Runoff: 0.45)</option>
              <option value="tiles">Clay Tiles (Runoff: 0.75)</option>
            </select>
          </div>

          {/* Live Demand Calculator */}
          <div className="lg:col-span-3 space-y-1.5">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Base Daily Demand</label>
            <div className="border border-blue-200 bg-blue-50 rounded-xl px-4 py-3 flex items-center gap-3">
              <Calculator size={18} className="text-blue-500 flex-shrink-0" />
              <div>
                <p className="text-base font-bold text-blue-700">{baseDemand.toLocaleString('en-IN')} L / day</p>
                <p className="text-xs text-blue-400">{flats} flats × {occupants} occ × {IS_LPCD} LPCD</p>
              </div>
            </div>
          </div>

          {/* Adjusted Daily Demand — always shown as it incorporates peak buffers */}
          <div className="lg:col-span-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-amber-600" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Adjusted Total Daily Demand</p>
                  <p className="text-xs text-amber-600">
                    Includes 10% peak buffer headroom{includeLosses ? ' and 15% UFW distribution losses' : ''} (135 LPCD standard)
                  </p>
                </div>
              </div>
              <p className="text-xl font-extrabold text-amber-700">{adjustedDemand.toLocaleString('en-IN')} L/day</p>
            </div>
          </div>

          {/* Disaggregated Potable (70 LPCD) vs Non-Potable (65 LPCD) Demand Breakdown */}
          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Potable */}
            <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-sky-800 uppercase tracking-wider">Potable Demand</span>
                <span className="text-[11px] font-bold bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">70 LPCD (51.9%)</span>
              </div>
              <p className="text-lg font-extrabold text-sky-900">{potableDemand.toLocaleString('en-IN')} L / day</p>
              <p className="text-[11px] text-sky-700 mt-1">
                Drinking, cooking, bathing, and food preparation. Requires municipal purification standards.
              </p>
            </div>

            {/* Non-Potable (RWH Target) */}
            <div className="rounded-xl border border-teal-300 bg-teal-50/90 p-3.5 shadow-sm">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1">
                  Non-Potable Demand
                </span>
                <span className="text-[11px] font-bold bg-teal-600 text-white px-2 py-0.5 rounded-full">
                  65 LPCD (48.1%) · RWH Target
                </span>
              </div>
              <p className="text-lg font-extrabold text-teal-900">{nonPotableDemand.toLocaleString('en-IN')} L / day</p>
              <p className="text-[11px] text-teal-800 mt-1 font-medium">
                Toilet flushing, gardening, cleaning, and car washing. <strong>Directly offset by rooftop rainwater harvesting</strong> without expensive potable treatment.
              </p>
            </div>
          </div>

          {/* Real-World Losses (UFW) Toggle */}
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5">
              <div className="flex items-center gap-2">
                <Droplets size={16} className="text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-700">Include Distribution Losses (UFW)?</p>
                  <p className="text-xs text-slate-400">Adds 15% standard Unaccounted For Water loss for real-world accuracy</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${includeLosses ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                  {includeLosses ? '+15% Active' : 'Off'}
                </span>
                <ToggleSwitch label="Include distribution losses" checked={includeLosses} onChange={() => setIncludeLosses(!includeLosses)} />
              </div>
            </div>
          </div>

          {/* Actual Metered Data Toggle */}
          <div className="lg:col-span-3">
            <div className="flex flex-col bg-slate-50 border border-slate-200 rounded-xl overflow-hidden transition-all">
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <Zap size={16} className="text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">Use Actual Metered Data?</p>
                    <p className="text-xs text-slate-400">Override theoretical math with your actual metered bills</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${useMeteredData ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                    {useMeteredData ? 'Active' : 'Off'}
                  </span>
                  <ToggleSwitch label="Use actual metered data" checked={useMeteredData} onChange={() => setUseMeteredData(!useMeteredData)} />
                </div>
              </div>
              
              {useMeteredData && (
                <div className="px-5 py-5 border-t border-slate-200 bg-blue-50/50 grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Bill Frequency</label>
                    <select value={meteredFrequency} onChange={(e) => setMeteredFrequency(e.target.value)} className="w-full border border-blue-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-blue-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>Monthly</option>
                      <option>Quarterly</option>
                      <option>Half-Yearly</option>
                      <option>Yearly</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Consumption (L / {meteredFrequency.split('-')[0]})</label>
                    <input type="number" min="0" value={meteredConsumption} onChange={(e) => setMeteredConsumption(e.target.value)} className="w-full border border-blue-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-blue-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. 450000" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Municipal Bill (₹)</label>
                    <input type="number" min="0" value={meteredBill} onChange={(e) => setMeteredBill(e.target.value)} className="w-full border border-blue-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-blue-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. 45000" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tanker Volume (L)</label>
                    <input type="number" min="0" value={meteredTankerVolume} onChange={(e) => setMeteredTankerVolume(e.target.value)} className="w-full border border-blue-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-blue-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Optional" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Card 2: Historical Billing Logs ── */}
      <div className="ww-card p-4 sm:p-6">
        <div className="flex flex-col gap-4 mb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <Droplets size={20} className="text-red-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Historical Billing Logs</h2>
              <p className="text-xs text-slate-500">The "water bleed" data — municipal bills + private tanker procurement</p>
            </div>
          </div>
          <button
            onClick={addRow}
            className="ww-secondary-button flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs text-blue-700 transition-colors"
          >
            <Plus size={14} />
            Add Month
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 py-2.5 rounded-l-xl">Month & Year</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 py-2.5">Municipal Bill (₹)</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 py-2.5">Municipal Volume (kL)</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 py-2.5">Tankers Bought</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 py-2.5">Capacity (L)</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 py-2.5">Cost / Tanker (₹)</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 py-2.5">Borewell Volume (kL)</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 py-2.5">Tanker Total</th>
                <th className="px-3 py-2.5 rounded-r-xl"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {billingRows.map((row) => {
                const tankerTotal = Number(row.tankers || 0) * Number(row.costPerTanker || 0);
                const isHighUsage = Number(row.tankers) >= 10;
                return (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition-colors group">
                    {/* Month & Year */}
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <select
                          value={row.month}
                          onChange={(e) => updateRow(row.id, 'month', e.target.value)}
                          className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                        >
                          {MONTHS.map((m) => <option key={m}>{m}</option>)}
                        </select>
                        <select
                          value={row.year}
                          onChange={(e) => updateRow(row.id, 'year', e.target.value)}
                          className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 w-20"
                        >
                          {YEARS.map((y) => <option key={y}>{y}</option>)}
                        </select>
                      </div>
                    </td>

                    {/* Municipal Bill */}
                    <td className="px-3 py-2">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">₹</span>
                        <input
                          type="number"
                          value={row.bill}
                          onChange={(e) => updateRow(row.id, 'bill', e.target.value)}
                          className="border border-slate-200 rounded-lg pl-6 pr-3 py-1.5 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 w-28"
                        />
                      </div>
                    </td>

                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={row.municipalVolumeKl ?? ''}
                        onChange={(e) => updateRow(row.id, 'municipalVolumeKl', e.target.value)}
                        aria-label={`Municipal supply volume in kL for ${row.month} ${row.year}; leave blank if unknown`}
                        placeholder="Unknown"
                        className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 w-24"
                      />
                    </td>

                    {/* Tankers Bought */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          value={row.tankers}
                          onChange={(e) => updateRow(row.id, 'tankers', e.target.value)}
                          className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 w-16"
                        />
                        {isHighUsage && (
                          <span className="text-xs bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-md">HIGH</span>
                        )}
                      </div>
                    </td>

                    {/* Tanker Capacity */}
                    <td className="px-3 py-2">
                      <div className="flex items-center">
                        <input
                          type="number"
                          step="1000"
                          value={row.tankerCapacity}
                          onChange={(e) => updateRow(row.id, 'tankerCapacity', e.target.value)}
                          className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 w-20"
                        />
                      </div>
                    </td>

                    {/* Cost per Tanker */}
                    <td className="px-3 py-2">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">₹</span>
                        <input
                          type="number"
                          value={row.costPerTanker}
                          onChange={(e) => updateRow(row.id, 'costPerTanker', e.target.value)}
                          className="border border-slate-200 rounded-lg pl-6 pr-3 py-1.5 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 w-24"
                        />
                      </div>
                    </td>

                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={row.borewellVolumeKl ?? ''}
                        onChange={(e) => updateRow(row.id, 'borewellVolumeKl', e.target.value)}
                        aria-label={`Borewell supply volume in kL for ${row.month} ${row.year}; enter 0 if confirmed unused, leave blank if unknown`}
                        placeholder="Unknown"
                        className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 w-24"
                      />
                    </td>

                    {/* Tanker Total (computed) */}
                    <td className="px-3 py-2">
                      <span className={`text-xs font-bold ${tankerTotal > 15000 ? 'text-red-600' : 'text-slate-600'}`}>
                        {fmtINR(tankerTotal)}
                      </span>
                    </td>

                    {/* Delete */}
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        aria-label={`Delete ${row.month} ${row.year} billing row`}
                        title="Delete billing row"
                        onClick={() => deleteRow(row.id)}
                        className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Summary row */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-slate-500 font-medium">Total Municipal Bills</p>
            <p className="text-lg font-bold text-slate-800 mt-0.5">{fmtINR(totalMunicipal)}</p>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-red-500 font-medium">Total Tanker Spend</p>
            <p className="text-lg font-bold text-red-600 mt-0.5">{fmtINR(totalTankerSpend)}</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-amber-600 font-medium">Avg Monthly Bleed</p>
            <p className="text-lg font-bold text-amber-700 mt-0.5">{fmtINR(avgMonthly)}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-blue-600 font-medium">Total Tanker Vol.</p>
            <p className="text-lg font-bold text-blue-700 mt-0.5">{(totalTankerVolume / 1000).toLocaleString('en-IN')} kL</p>
          </div>
        </div>
      </div>

      <section className="ww-card p-4 sm:p-6" aria-labelledby="monthly-water-audit-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="monthly-water-audit-title" className="text-base font-semibold text-slate-900">Monthly Water Audit</h2>
            <p className="mt-1 text-xs text-slate-500">
              Demand and supply reconciliation is calculated by the backend from saved society records. Enter a measured zero explicitly; blank volumes remain unknown.
            </p>
          </div>
          {waterAudit?.available_years?.length > 0 && (
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
              Audit year
              <select
                value={waterAudit.year ?? ''}
                onChange={(event) => {
                  const year = Number(event.target.value);
                  setWaterAuditLoading(true);
                  getSocietyWaterAudit(societyId, year)
                    .then((audit) => {
                      setWaterAudit(audit);
                      setWaterAuditError(null);
                    })
                    .catch((error) => {
                      console.error('Error loading monthly water audit:', error);
                      setWaterAuditError(error.response?.data?.detail || 'Could not load the selected water audit.');
                    })
                    .finally(() => setWaterAuditLoading(false));
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5"
              >
                {waterAudit.available_years.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </label>
          )}
        </div>
        {waterAuditLoading ? (
          <p className="mt-4 text-sm text-slate-500" role="status">Loading saved audit…</p>
        ) : waterAuditError ? (
          <p className="mt-4 text-sm text-red-700" role="alert">{waterAuditError}</p>
        ) : waterAudit?.year ? (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${waterAudit.complete_year ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
                {waterAudit.complete_year ? '12 months complete · entries not independently verified' : 'Incomplete supply data — shortage withheld where inputs are missing'}
              </span>
              <span className="text-xs text-slate-500">
                Tanker dependency: {waterAudit.observed_period_tanker_dependency_percent == null
                  ? 'Unavailable; complete measured tanker volume for all 12 months is required'
                  : `${waterAudit.observed_period_tanker_dependency_percent.toFixed(1)}% of modelled demand (from recorded entries)`}
              </span>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[850px] text-xs">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="p-2">Month</th><th className="p-2">Demand (kL)</th>
                    <th className="p-2">Municipal (kL)</th><th className="p-2">Tanker (kL)</th>
                    <th className="p-2">Borewell (kL)</th><th className="p-2">Known supply (kL)</th>
                    <th className="p-2">Shortage (kL)</th><th className="p-2">Data quality</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {waterAudit.months.map((month) => (
                    <tr key={month.month}>
                      <td className="p-2 font-medium">{MONTHS[month.month - 1]}</td>
                      <td className="p-2">{month.demand_kl.toLocaleString('en-IN')}</td>
                      <td className="p-2">{month.municipal_volume_kl == null ? 'Unknown' : month.municipal_volume_kl.toLocaleString('en-IN')}</td>
                      <td className="p-2">{month.tanker_volume_kl == null ? 'Unknown' : month.tanker_volume_kl.toLocaleString('en-IN')}</td>
                      <td className="p-2">{month.borewell_volume_kl == null ? 'Unknown' : month.borewell_volume_kl.toLocaleString('en-IN')}</td>
                      <td className="p-2">{month.known_supply_kl.toLocaleString('en-IN')}</td>
                      <td className="p-2">{month.shortage_kl == null ? 'Unavailable' : month.shortage_kl.toLocaleString('en-IN')}</td>
                      <td className="p-2 text-slate-500">{month.missing_inputs.length ? `Missing: ${month.missing_inputs.join(', ')}` : 'Required entries complete; not independently verified'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-slate-500">Save monthly billing records to see the backend-calculated audit.</p>
        )}
      </section>

      {/* ── Action Buttons ── */}
      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:justify-end sm:items-center">
        {saveStatus && (
          <div role="status" aria-live="polite" className={`flex items-center text-xs font-semibold px-3 py-2 rounded-xl border ${
            saveStatus.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            {saveStatus.message}
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={isSaving || isLoading}
          className="ww-secondary-button flex items-center justify-center gap-2 px-5 py-3 text-sm disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <span className="w-4 h-4 border-2 border-slate-700 border-t-transparent rounded-full animate-spin"></span>
              Saving...
            </>
          ) : (
            'Save Society Data'
          )}
        </button>
        <button
          onClick={() => navigate('/map-studio')}
          className="ww-primary-button flex items-center justify-center gap-2 px-6 py-3 text-sm"
        >
          Process Data & Continue
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
