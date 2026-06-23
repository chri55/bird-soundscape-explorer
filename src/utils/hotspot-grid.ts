export function snapToGrid(n: number): number {
  return Math.floor(n);
}

export function cellKey(lat: number, lng: number): string {
  return `${snapToGrid(lat)}:${snapToGrid(lng)}`;
}
