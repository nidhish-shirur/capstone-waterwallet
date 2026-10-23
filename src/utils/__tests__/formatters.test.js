import { describe, it, expect } from 'vitest';
import {
  formatLitres,
  formatRupees,
  formatRainfall,
  formatArea,
  formatChartValue,
} from '../formatters';

describe('formatters utility', () => {
  describe('formatLitres', () => {
    it('formats values under 1,000 as litres (L)', () => {
      expect(formatLitres(0)).toBe('0 L');
      expect(formatLitres(450)).toBe('450 L');
      expect(formatLitres(999)).toBe('999 L');
    });

    it('formats values of 1,000 or greater as kilolitres (kL) with Indian numbering', () => {
      expect(formatLitres(1000)).toBe('1 kL');
      expect(formatLitres(15000)).toBe('15 kL');
      expect(formatLitres(254260)).toBe('254.26 kL');
      expect(formatLitres(12345678)).toBe('12,345.68 kL');
    });
  });

  describe('formatRupees', () => {
    it('formats currency values in Indian Rupees (₹) with grouping', () => {
      const formattedZero = formatRupees(0);
      expect(formattedZero).toContain('0');

      const formatted250k = formatRupees(250000);
      expect(formatted250k).toMatch(/₹\s?2,50,000/);

      const formatted10Lakh = formatRupees(1000000);
      expect(formatted10Lakh).toMatch(/₹\s?10,00,000/);
    });
  });

  describe('formatRainfall', () => {
    it('formats rainfall in mm with 1 decimal place', () => {
      expect(formatRainfall(0)).toBe('0 mm');
      expect(formatRainfall(1234.56)).toBe('1,234.6 mm');
      expect(formatRainfall(850)).toBe('850 mm');
    });
  });

  describe('formatArea', () => {
    it('formats area in m² with 0 decimal places', () => {
      expect(formatArea(0)).toBe('0 m²');
      expect(formatArea(500)).toBe('500 m²');
      expect(formatArea(1200.45)).toBe('1,200 m²');
    });
  });

  describe('formatChartValue', () => {
    it('abbreviates values >= 1,00,000 as Lakhs (L)', () => {
      expect(formatChartValue(100000)).toBe('1.0L');
      expect(formatChartValue(250000)).toBe('2.5L');
      expect(formatChartValue(1500000)).toBe('15.0L');
    });

    it('abbreviates values between 1,000 and 99,999 as Thousands (K)', () => {
      expect(formatChartValue(1000)).toBe('1.0K');
      expect(formatChartValue(5000)).toBe('5.0K');
      expect(formatChartValue(25400)).toBe('25.4K');
    });

    it('returns string value for numbers under 1,000', () => {
      expect(formatChartValue(0)).toBe('0');
      expect(formatChartValue(450)).toBe('450');
    });
  });
});
