import { describe, it, expect } from 'vitest';
import { snapToGrid, cellKey } from './hotspot-grid';

describe('snapToGrid', () => {
  it('floors positive decimals', () => {
    expect(snapToGrid(40.7829)).toBe(40);
    expect(snapToGrid(51.5074)).toBe(51);
    expect(snapToGrid(40.0)).toBe(40);
  });

  it('floors negative decimals toward negative infinity', () => {
    expect(snapToGrid(-73.9654)).toBe(-74);
    expect(snapToGrid(-0.1)).toBe(-1);
    expect(snapToGrid(-74.0)).toBe(-74);
  });
});

describe('cellKey', () => {
  it('produces a colon-separated string of floored lat and lng', () => {
    expect(cellKey(40.7829, -73.9654)).toBe('40:-74');
    expect(cellKey(51.5074, -0.1278)).toBe('51:-1');
  });

  it('produces the same key for all points within the same 1° cell', () => {
    expect(cellKey(40.0, -74.0)).toBe(cellKey(40.999, -73.001));
    expect(cellKey(40.0, -74.0)).toBe(cellKey(40.0, -74.0));
  });
});
