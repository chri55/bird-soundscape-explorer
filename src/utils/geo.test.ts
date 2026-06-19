import { describe, it, expect } from 'vitest';
import { haversineKm } from './geo';

describe('haversineKm', () => {
  it('returns 0 for identical points', () => {
    expect(haversineKm({ lat: 51.5, lng: -0.1 }, { lat: 51.5, lng: -0.1 })).toBe(0);
  });

  it('returns ~341 km between London and Paris', () => {
    const km = haversineKm({ lat: 51.5074, lng: -0.1278 }, { lat: 48.8566, lng: 2.3522 });
    expect(km).toBeGreaterThan(330);
    expect(km).toBeLessThan(350);
  });

  it('returns less than 10 for points 5 km apart', () => {
    // Move ~5 km north from (51.5, -0.1): 1 degree lat ≈ 111 km, so 0.045 deg ≈ 5 km
    const km = haversineKm({ lat: 51.5, lng: -0.1 }, { lat: 51.545, lng: -0.1 });
    expect(km).toBeLessThan(10);
  });

  it('returns more than 10 for points 15 km apart', () => {
    // 0.135 deg lat ≈ 15 km
    const km = haversineKm({ lat: 51.5, lng: -0.1 }, { lat: 51.635, lng: -0.1 });
    expect(km).toBeGreaterThan(10);
  });
});
