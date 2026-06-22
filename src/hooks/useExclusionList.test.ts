import { renderHook, act } from '@testing-library/react';
import { useExclusionList } from './useExclusionList';

beforeEach(() => { localStorage.clear(); });

describe('useExclusionList', () => {
  it('returns empty exclusions when storage is empty', () => {
    const { result } = renderHook(() => useExclusionList());
    expect(result.current.exclusions).toHaveLength(0);
    expect(result.current.excludedSciNames.size).toBe(0);
  });

  it('addExclusion adds an entry and updates excludedSciNames', () => {
    const { result } = renderHook(() => useExclusionList());
    act(() => { result.current.addExclusion('Branta canadensis', 'Canada Goose'); });
    expect(result.current.exclusions).toHaveLength(1);
    expect(result.current.exclusions[0]).toEqual({ sciName: 'Branta canadensis', comName: 'Canada Goose' });
    expect(result.current.excludedSciNames.has('Branta canadensis')).toBe(true);
  });

  it('addExclusion ignores duplicate sciName', () => {
    const { result } = renderHook(() => useExclusionList());
    act(() => { result.current.addExclusion('Branta canadensis', 'Canada Goose'); });
    act(() => { result.current.addExclusion('Branta canadensis', 'Canada Goose'); });
    expect(result.current.exclusions).toHaveLength(1);
  });

  it('removeExclusion removes by sciName', () => {
    const { result } = renderHook(() => useExclusionList());
    act(() => { result.current.addExclusion('Branta canadensis', 'Canada Goose'); });
    act(() => { result.current.removeExclusion('Branta canadensis'); });
    expect(result.current.exclusions).toHaveLength(0);
    expect(result.current.excludedSciNames.has('Branta canadensis')).toBe(false);
  });

  it('reads existing exclusions from localStorage on mount', () => {
    localStorage.setItem('bird_exclusions_v1', JSON.stringify([
      { sciName: 'Branta canadensis', comName: 'Canada Goose' },
    ]));
    const { result } = renderHook(() => useExclusionList());
    expect(result.current.exclusions).toHaveLength(1);
    expect(result.current.excludedSciNames.has('Branta canadensis')).toBe(true);
  });

  it('persists additions to localStorage', () => {
    const { result } = renderHook(() => useExclusionList());
    act(() => { result.current.addExclusion('Branta canadensis', 'Canada Goose'); });
    const stored = JSON.parse(localStorage.getItem('bird_exclusions_v1') ?? '[]') as unknown[];
    expect(stored).toHaveLength(1);
  });

  it('persists removals to localStorage', () => {
    const { result } = renderHook(() => useExclusionList());
    act(() => { result.current.addExclusion('Branta canadensis', 'Canada Goose'); });
    act(() => { result.current.removeExclusion('Branta canadensis'); });
    const stored = JSON.parse(localStorage.getItem('bird_exclusions_v1') ?? '[]') as unknown[];
    expect(stored).toHaveLength(0);
  });
});
