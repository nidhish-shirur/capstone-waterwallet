import { describe, it, expect } from 'vitest';
import {
  IS_LPCD,
  POTABLE_LPCD,
  NON_POTABLE_LPCD,
  UFW_LOSS_FACTOR,
  DEMAND_BUFFER_FACTOR,
  ROOF_RUNOFF_COEFFICIENTS,
  calculateCanonicalDemand,
} from '../waterConstants';

describe('waterConstants and demand calculations', () => {
  it('preserves IS 1172 conservation of mass between potable and non-potable norms', () => {
    expect(IS_LPCD).toBe(135);
    expect(POTABLE_LPCD).toBe(70);
    expect(NON_POTABLE_LPCD).toBe(65);
    expect(POTABLE_LPCD + NON_POTABLE_LPCD).toBe(IS_LPCD);
  });

  it('provides verified roof runoff coefficients', () => {
    expect(ROOF_RUNOFF_COEFFICIENTS.concrete).toBe(0.90);
    expect(ROOF_RUNOFF_COEFFICIENTS.metal).toBe(0.90);
    expect(ROOF_RUNOFF_COEFFICIENTS.tiles).toBe(0.75);
    expect(ROOF_RUNOFF_COEFFICIENTS.gravel).toBe(0.45);
  });

  describe('calculateCanonicalDemand', () => {
    it('computes demand with 15% UFW losses and 10% peak buffer in strict sequence', () => {
      const result = calculateCanonicalDemand({
        numFlats: 100,
        occupantsPerFlat: 4, // 400 occupants
        includeLosses: true,
      });

      // 1. Base demand: 400 * 135 = 54,000 L
      expect(result.baseDemand).toBe(54000);

      // 2. After UFW: 54,000 * 1.15 = 62,100 L
      // 3. Adjusted demand (with 1.10 peak buffer): 62,100 * 1.10 = 68,310 L
      expect(result.adjustedDemand).toBe(68310);

      // 4. Potable component: 68,310 * (70 / 135) = 35,420 L
      expect(result.potableDemand).toBe(Math.round(68310 * (70 / 135)));

      // 5. Non-potable component: adjustedDemand - potableDemand
      expect(result.nonPotableDemand).toBe(result.adjustedDemand - result.potableDemand);
      expect(result.potableDemand + result.nonPotableDemand).toBe(result.adjustedDemand);
    });

    it('bypasses UFW losses when includeLosses is false', () => {
      const result = calculateCanonicalDemand({
        numFlats: 100,
        occupantsPerFlat: 4,
        includeLosses: false,
      });

      // Base: 400 * 135 = 54,000 L
      expect(result.baseDemand).toBe(54000);

      // Adjusted without UFW: 54,000 * 1.10 = 59,400 L
      expect(result.adjustedDemand).toBe(59400);
      expect(result.potableDemand + result.nonPotableDemand).toBe(59400);
    });

    it('uses half-up rounding to match the backend at demand tie boundaries', () => {
      const result = calculateCanonicalDemand({
        numFlats: 1,
        occupantsPerFlat: 1,
        includeLosses: false,
      });

      expect(result.adjustedDemand).toBe(149);
      expect(result.potableDemand).toBe(77);
      expect(result.nonPotableDemand).toBe(72);
    });

    it('handles zero occupants gracefully', () => {
      const result = calculateCanonicalDemand({
        numFlats: 0,
        occupantsPerFlat: 0,
      });

      expect(result.baseDemand).toBe(0);
      expect(result.adjustedDemand).toBe(0);
      expect(result.potableDemand).toBe(0);
      expect(result.nonPotableDemand).toBe(0);
    });
  });
});
