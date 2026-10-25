import { readFileSync, writeFileSync } from 'fs';

const path = 'd:/VESIT/Capstone/src/utils/mmrPincodes.js';
let content = readFileSync(path, 'utf8');

// Find the start of the JSDoc comment before the original function
const marker = '/**\n * Look up geographic and geological defaults';
const oldStart = content.indexOf(marker);
if (oldStart === -1) {
  console.error('Pattern not found!');
  process.exit(1);
}

const newSection = `/**
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
    soilLabel: SOIL_LABELS[entry.soilPerm] || \`Class \${entry.soilPerm}\`,
    soilDescription: entry.soilDescription,
  };
}
`;

content = content.slice(0, oldStart) + newSection + '\n';
writeFileSync(path, content, 'utf8');
console.log('Done. New file length:', content.length);
