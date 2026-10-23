import { describe, expect, it } from 'vitest';
import { escapeCsvCell } from '../csv';

describe('escapeCsvCell', () => {
  it.each(['=1+1', '+SUM(A1:A2)', '-1+2', '@SUM(A1:A2)', ' \t=1+1'])(
    'neutralizes spreadsheet formulas beginning with %s',
    (value) => {
      expect(escapeCsvCell(value)).toBe(`'${value}`);
    },
  );

  it('quotes delimiters and escapes quotes', () => {
    expect(escapeCsvCell('Society, "A"')).toBe('"Society, ""A"""');
  });

  it('leaves numeric values numeric', () => {
    expect(escapeCsvCell(-12)).toBe('-12');
  });
});
