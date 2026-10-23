import { describe, it, expect } from 'vitest';
import { lookupMMRPincode, MMR_PINCODES } from '../mmrPincodes';

describe('mmrPincodes utility and geographic dataset', () => {
  it('contains verified MMR postal pincodes with complete geographic metadata', () => {
    expect(Object.keys(MMR_PINCODES).length).toBeGreaterThan(40);

    // Verify key test wards
    expect(MMR_PINCODES['400001']).toBeDefined(); // Colaba
    expect(MMR_PINCODES['400601']).toBeDefined(); // Thane
    expect(MMR_PINCODES['400076']).toBeDefined(); // Powai
    expect(MMR_PINCODES['401107']).toBeDefined(); // Mira Road
  });

  describe('lookupMMRPincode', () => {
    it('returns structured location metadata for valid MMR pincodes', () => {
      const thane = lookupMMRPincode('400601');
      expect(thane).toBeDefined();
      expect(thane.pincode).toBe('400601');
      expect(thane.region).toBe('Thane');
      expect(thane.lat).toBeCloseTo(19.1970, 2);
      expect(thane.lng).toBeCloseTo(72.9645, 2);
      expect(thane.lon).toBe(thane.lng);
      expect(thane.coastalKm).toBeGreaterThan(0);
      expect(thane.soilPerm).toBeGreaterThanOrEqual(1);
      expect(thane.soilPerm).toBeLessThanOrEqual(5);
      expect(typeof thane.soilLabel).toBe('string');
      expect(typeof thane.soilDescription).toBe('string');
    });

    it('works with numeric pincode inputs', () => {
      const colaba = lookupMMRPincode(400001);
      expect(colaba).toBeDefined();
      expect(colaba.pincode).toBe('400001');
      expect(colaba.coastalKm).toBeCloseTo(1.2, 1);
    });

    it('trims leading/trailing whitespace in pincode strings', () => {
      const powai = lookupMMRPincode('  400076  ');
      expect(powai).toBeDefined();
      expect(powai.pincode).toBe('400076');
    });

    it('returns null for non-existent, non-MMR, or invalid pincodes', () => {
      expect(lookupMMRPincode('110001')).toBeNull(); // New Delhi
      expect(lookupMMRPincode('999999')).toBeNull();
      expect(lookupMMRPincode('invalid')).toBeNull();
      expect(lookupMMRPincode('')).toBeNull();
      expect(lookupMMRPincode(null)).toBeNull();
      expect(lookupMMRPincode(undefined)).toBeNull();
    });
  });
});
