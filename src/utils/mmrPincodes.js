/**
 * Reliable offline geographic and geological reference dataset for
 * supported Mumbai Metropolitan Region (MMR) postal pincodes.
 *
 * Coordinates are verified centroids of the respective postal wards / suburbs.
 * Coastal proximity (km) represents approximate straight-line geodesic distance
 * to the Arabian Sea coastline.
 * Soil permeability class follows NBSS&LUP Maharashtra soil survey classifications:
 *   Class 1: Dense Impermeable Clay / Hard Basalt (Very low percolation)
 *   Class 2: Silty Clay / Estuarine Marine Fill (Poor percolation)
 *   Class 3: Loam / Weathered Basalt Subsoil (Moderate — MMR Urban Standard)
 *   Class 4: Sandy Loam / Konkan Laterite (Good percolation)
 *   Class 5: Coarse Sandy Alluvium / Gravel (High percolation)
 */

export const MMR_PINCODES = {
  // ── Mumbai City (Island City) ──
  '400001': {
    name: 'Fort / Colaba, Mumbai South',
    subdistrict: 'Mumbai City',
    lat: 18.9322,
    lon: 72.8335,
    coastalKm: 1.2,
    soilPerm: 2,
    soilDescription: 'Coastal reclaimed marine alluvium and weathered trap.',
  },
  '400005': {
    name: 'Colaba, Mumbai South',
    subdistrict: 'Mumbai City',
    lat: 18.9067,
    lon: 72.8147,
    coastalKm: 0.8,
    soilPerm: 2,
    soilDescription: 'Coastal strip with high saline intrusion vulnerability.',
  },
  '400012': {
    name: 'Parel / Lalbaug, Mumbai South',
    subdistrict: 'Mumbai City',
    lat: 18.9934,
    lon: 72.8397,
    coastalKm: 3.2,
    soilPerm: 3,
    soilDescription: 'Urban brown clayey loam over basalt.',
  },
  '400018': {
    name: 'Worli, Mumbai South',
    subdistrict: 'Mumbai City',
    lat: 19.0178,
    lon: 72.8174,
    coastalKm: 0.9,
    soilPerm: 2,
    soilDescription: 'Coastal littoral tract; high saline risk for injection.',
  },
  '400028': {
    name: 'Dadar West, Mumbai',
    subdistrict: 'Mumbai City',
    lat: 19.0178,
    lon: 72.8300,
    coastalKm: 1.5,
    soilPerm: 2,
    soilDescription: 'Coastal sandy loam within 2 km of shoreline.',
  },

  // ── Mumbai Eastern Suburbs ──
  '400071': {
    name: 'Chembur, Mumbai',
    subdistrict: 'Mumbai Suburban',
    lat: 19.0622,
    lon: 72.8988,
    coastalKm: 7.5,
    soilPerm: 3,
    soilDescription: 'Medium black clayey loam over weathered Deccan trap.',
  },
  '400074': {
    name: 'Mahul / Chembur East, Mumbai',
    subdistrict: 'Mumbai Suburban',
    lat: 19.0330,
    lon: 72.9000,
    coastalKm: 4.8,
    soilPerm: 2,
    soilDescription: 'Mudflat-adjacent alluvium with high groundwater table.',
  },
  '400075': {
    name: 'Pant Nagar / Ghatkopar East, Mumbai',
    subdistrict: 'Mumbai Suburban',
    lat: 19.0820,
    lon: 72.9120,
    coastalKm: 8.5,
    soilPerm: 3,
    soilDescription: 'Medium loam with moderate permeability.',
  },
  '400076': {
    name: 'Powai, Mumbai',
    subdistrict: 'Mumbai Suburban',
    lat: 19.1176,
    lon: 72.9060,
    coastalKm: 11.2,
    soilPerm: 3,
    soilDescription: 'Residual weathered trap loam around lake catchment.',
  },
  '400077': {
    name: 'Ghatkopar West, Mumbai',
    subdistrict: 'Mumbai Suburban',
    lat: 19.0860,
    lon: 72.9080,
    coastalKm: 8.8,
    soilPerm: 3,
    soilDescription: 'Loamy soil over fractured basalt bedrock.',
  },
  '400080': {
    name: 'Mulund West, Mumbai',
    subdistrict: 'Mumbai Suburban',
    lat: 19.1726,
    lon: 72.9425,
    coastalKm: 18.5,
    soilPerm: 3,
    soilDescription: 'Sanjay Gandhi National Park foothills; fractured basalt loam.',
  },
  '400081': {
    name: 'Mulund East, Mumbai',
    subdistrict: 'Mumbai Suburban',
    lat: 19.1680,
    lon: 72.9600,
    coastalKm: 17.5,
    soilPerm: 3,
    soilDescription: 'Saline creek-adjacent loam; moderate percolation.',
  },
  '400088': {
    name: 'Govandi / Deonar, Mumbai',
    subdistrict: 'Mumbai Suburban',
    lat: 19.0550,
    lon: 72.9150,
    coastalKm: 6.2,
    soilPerm: 3,
    soilDescription: 'Deep clayey loam.',
  },

  // ── Mumbai Western Suburbs ──
  '400049': {
    name: 'Juhu / Vile Parle West, Mumbai',
    subdistrict: 'Mumbai Suburban',
    lat: 19.1075,
    lon: 72.8263,
    coastalKm: 0.8,
    soilPerm: 2,
    soilDescription: 'Coastal littoral sand and shell fragments; shallow water table.',
  },
  '400050': {
    name: 'Bandra West, Mumbai',
    subdistrict: 'Mumbai Suburban',
    lat: 19.0544,
    lon: 72.8402,
    coastalKm: 1.0,
    soilPerm: 2,
    soilDescription: 'Coastal rocky spur with coastal alluvium; salinity buffer required.',
  },
  '400051': {
    name: 'Bandra East / BKC, Mumbai',
    subdistrict: 'Mumbai Suburban',
    lat: 19.0657,
    lon: 72.8687,
    coastalKm: 4.2,
    soilPerm: 3,
    soilDescription: 'Mithi River basin alluvium and engineered fill.',
  },
  '400053': {
    name: 'Andheri West, Mumbai',
    subdistrict: 'Mumbai Suburban',
    lat: 19.1363,
    lon: 72.8277,
    coastalKm: 2.2,
    soilPerm: 2,
    soilDescription: 'Low-lying coastal strip near Versova creek.',
  },
  '400058': {
    name: 'Andheri West / Lokhandwala, Mumbai',
    subdistrict: 'Mumbai Suburban',
    lat: 19.1415,
    lon: 72.8290,
    coastalKm: 1.8,
    soilPerm: 2,
    soilDescription: 'Near coastal backwaters; strict storage priority.',
  },
  '400059': {
    name: 'Andheri East, Mumbai',
    subdistrict: 'Mumbai Suburban',
    lat: 19.1136,
    lon: 72.8697,
    coastalKm: 6.5,
    soilPerm: 3,
    soilDescription: 'Central suburban loam over compact Deccan trap.',
  },
  '400062': {
    name: 'Goregaon West, Mumbai',
    subdistrict: 'Mumbai Suburban',
    lat: 19.1663,
    lon: 72.8370,
    coastalKm: 3.2,
    soilPerm: 3,
    soilDescription: 'Alluvial loam with clay sub-layers.',
  },
  '400064': {
    name: 'Malad West, Mumbai',
    subdistrict: 'Mumbai Suburban',
    lat: 19.1860,
    lon: 72.8340,
    coastalKm: 2.5,
    soilPerm: 2,
    soilDescription: 'Creek-adjacent lowlands; borderline coastal threshold.',
  },
  '400067': {
    name: 'Kandivali West, Mumbai',
    subdistrict: 'Mumbai Suburban',
    lat: 19.2060,
    lon: 72.8350,
    coastalKm: 2.8,
    soilPerm: 3,
    soilDescription: 'Weathered basalt alluvium.',
  },
  '400092': {
    name: 'Borivali West, Mumbai',
    subdistrict: 'Mumbai Suburban',
    lat: 19.2307,
    lon: 72.8567,
    coastalKm: 3.5,
    soilPerm: 3,
    soilDescription: 'Silt loam over weathered trap rock.',
  },
  '400101': {
    name: 'Kandivali East, Mumbai',
    subdistrict: 'Mumbai Suburban',
    lat: 19.2100,
    lon: 72.8650,
    coastalKm: 6.0,
    soilPerm: 3,
    soilDescription: 'Foothill loam with good drainage.',
  },
  '400103': {
    name: 'Borivali East, Mumbai',
    subdistrict: 'Mumbai Suburban',
    lat: 19.2310,
    lon: 72.8680,
    coastalKm: 6.5,
    soilPerm: 3,
    soilDescription: 'National Park edge; porous weathered basalt zone.',
  },

  // ── Thane City & Sub-districts ──
  '400601': {
    name: 'Thane West (Station / Central), Thane',
    subdistrict: 'Thane',
    lat: 19.1970,
    lon: 72.9645,
    coastalKm: 25.0,
    soilPerm: 3,
    soilDescription: 'Weathered Deccan basalt loam with moderate absorption.',
  },
  '400602': {
    name: 'Thane West (Charai / Naupada), Thane',
    subdistrict: 'Thane',
    lat: 19.1910,
    lon: 72.9710,
    coastalKm: 25.5,
    soilPerm: 3,
    soilDescription: 'Urbanized clay loam with bedrock at 4–8 m.',
  },
  '400604': {
    name: 'Thane West (Kopri), Thane',
    subdistrict: 'Thane',
    lat: 19.1780,
    lon: 72.9750,
    coastalKm: 24.5,
    soilPerm: 3,
    soilDescription: 'Thane creek basin; silt loam over basalt.',
  },
  '400606': {
    name: 'Thane West (Vartak Nagar), Thane',
    subdistrict: 'Thane',
    lat: 19.2150,
    lon: 72.9550,
    coastalKm: 25.8,
    soilPerm: 3,
    soilDescription: 'Lateritic clay loam suitable for artificial recharge.',
  },
  '400607': {
    name: 'Thane West (Ghodbunder Road), Thane',
    subdistrict: 'Thane',
    lat: 19.2600,
    lon: 72.9600,
    coastalKm: 26.0,
    soilPerm: 4,
    soilDescription: 'Yeoor foothills; porous laterite and gravelly sandy loam.',
  },
  '400610': {
    name: 'Thane West (Majiwada / Kapurbawdi), Thane',
    subdistrict: 'Thane',
    lat: 19.2183,
    lon: 72.9781,
    coastalKm: 25.5,
    soilPerm: 3,
    soilDescription: 'Central Thane loam over fractured basalt; reference pilot site.',
  },
  '400615': {
    name: 'Thane (Wagle Estate), Thane',
    subdistrict: 'Thane',
    lat: 19.1915,
    lon: 72.9463,
    coastalKm: 24.0,
    soilPerm: 3,
    soilDescription: 'Industrial foothill tract; weathered basalt subsoil.',
  },

  // ── Navi Mumbai ──
  '400703': {
    name: 'Vashi, Navi Mumbai',
    subdistrict: 'Navi Mumbai',
    lat: 19.0771,
    lon: 72.9986,
    coastalKm: 18.0,
    soilPerm: 3,
    soilDescription: 'Reclaimed tidal mudflat loam with engineered drainage.',
  },
  '400705': {
    name: 'Sanpada, Navi Mumbai',
    subdistrict: 'Navi Mumbai',
    lat: 19.0630,
    lon: 73.0100,
    coastalKm: 18.5,
    soilPerm: 3,
    soilDescription: 'Estuarine loam over weathered basalt.',
  },
  '400706': {
    name: 'Nerul, Navi Mumbai',
    subdistrict: 'Navi Mumbai',
    lat: 19.0330,
    lon: 73.0160,
    coastalKm: 19.0,
    soilPerm: 3,
    soilDescription: 'Parsik foothill alluvium with good permeability.',
  },
  '400708': {
    name: 'Airoli, Navi Mumbai',
    subdistrict: 'Navi Mumbai',
    lat: 19.1550,
    lon: 72.9980,
    coastalKm: 20.0,
    soilPerm: 3,
    soilDescription: 'Thane creek fringe alluvium over basalt bedrock.',
  },
  '400709': {
    name: 'Kopar Khairane, Navi Mumbai',
    subdistrict: 'Navi Mumbai',
    lat: 19.1020,
    lon: 73.0080,
    coastalKm: 19.5,
    soilPerm: 3,
    soilDescription: 'Medium loam with moderate absorption.',
  },
  '400710': {
    name: 'Ghansoli, Navi Mumbai',
    subdistrict: 'Navi Mumbai',
    lat: 19.1230,
    lon: 73.0050,
    coastalKm: 20.0,
    soilPerm: 3,
    soilDescription: 'Reclaimed alluvial soil over shallow weathered trap.',
  },
  '410210': {
    name: 'Kharghar, Navi Mumbai',
    subdistrict: 'Navi Mumbai',
    lat: 19.0269,
    lon: 73.0673,
    coastalKm: 24.0,
    soilPerm: 4,
    soilDescription: 'Kharghar hill base; porous sandy loam and laterite.',
  },
  '410206': {
    name: 'Panvel, Raigad / MMR',
    subdistrict: 'Raigad / MMR',
    lat: 18.9894,
    lon: 73.1175,
    coastalKm: 28.0,
    soilPerm: 3,
    soilDescription: 'Riverine alluvium along Gadhi river basin.',
  },

  // ── Mira-Bhayandar, Kalyan & Dombivli ──
  '401107': {
    name: 'Mira Road, Mira-Bhayandar',
    subdistrict: 'Thane / Mira-Bhayandar',
    lat: 19.2812,
    lon: 72.8561,
    coastalKm: 5.5,
    soilPerm: 3,
    soilDescription: 'Creek-adjacent alluvial plain over basalt.',
  },
  '401105': {
    name: 'Bhayandar West, Mira-Bhayandar',
    subdistrict: 'Thane / Mira-Bhayandar',
    lat: 19.2980,
    lon: 72.8450,
    coastalKm: 3.5,
    soilPerm: 2,
    soilDescription: 'Tidal marshland fringe; high salt-water proximity.',
  },
  '421201': {
    name: 'Dombivli East, Thane District',
    subdistrict: 'Thane / Kalyan-Dombivli',
    lat: 19.2184,
    lon: 73.0867,
    coastalKm: 36.0,
    soilPerm: 3,
    soilDescription: 'Inland black cotton and loamy subsoil.',
  },
  '421301': {
    name: 'Kalyan West, Thane District',
    subdistrict: 'Thane / Kalyan-Dombivli',
    lat: 19.2437,
    lon: 73.1355,
    coastalKm: 42.0,
    soilPerm: 3,
    soilDescription: 'Ulhas river basin; deep alluvial loam over fractured basalt.',
  },
};

/**
 * Look up geographic and geological defaults for a given MMR postal pincode.
 * Returns null when the pincode is not in the offline table, so callers can
 * safely suppress the auto-location banner when no match is found.
 *
 * @param {string|number} pincode
 * @returns {{ pincode, suburb, region, lat, lng, lon, coastalKm, soilPerm, soilLabel, soilDescription } | null}
 */

const SOIL_LABELS = {
  1: 'Very Poor (Clay/Basalt)',
  2: 'Poor (Silt/Marine Fill)',
  3: 'Moderate (Loam/Weathered Basalt)',
  4: 'Good (Sandy Loam/Laterite)',
  5: 'High (Coarse Sandy/Gravel)',
};

export function lookupMMRPincode(pincode) {
  const code = String(pincode || '').trim();
  if (!code) return null;

  const entry = MMR_PINCODES[code];
  if (!entry) return null;

  const nameParts = entry.name.split(',').map((p) => p.trim());
  const suburb = nameParts[0] || entry.name;
  const region = entry.subdistrict || 'MMR';

  return {
    pincode: code,
    suburb,
    region,
    lat: entry.lat,
    lng: entry.lon,   // convenience alias — MapStudio expects .lng
    lon: entry.lon,   // original field preserved for other consumers
    coastalKm: entry.coastalKm,
    soilPerm: entry.soilPerm,
    soilLabel: SOIL_LABELS[entry.soilPerm] || `Class ${entry.soilPerm}`,
    soilDescription: entry.soilDescription,
  };
}

