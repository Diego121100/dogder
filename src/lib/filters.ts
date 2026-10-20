import { DEFAULT_FILTERS, Filters } from './discover';

/** Los filtros se recuerdan en el teléfono, para que no haya que elegirlos cada vez. */
const KEY = 'dogder:filtros';

export function loadFilters(): Filters {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return DEFAULT_FILTERS;
    return { ...DEFAULT_FILTERS, ...(JSON.parse(raw) as Partial<Filters>) };
  } catch {
    return DEFAULT_FILTERS;
  }
}

export function saveFilters(f: Filters) {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(f));
  } catch {
    // Si no se puede guardar, solo se pierden al cerrar la app.
  }
}

/** Cuántos filtros están activos (para el número del botón). */
export function activeFilters(f: Filters): number {
  return (
    Number(f.maxKm !== DEFAULT_FILTERS.maxKm) +
    Number(f.sizes.length < 3) +
    Number(f.sexes.length > 0) +
    Number(f.ages.length > 0) +
    Number(f.energies.length > 0) +
    Number(f.breeds.length > 0)
  );
}

export const DISTANCES = [1, 3, 5, 10, 20, 50];
export const AGE_GROUPS = [
  { k: 'Cachorro', t: '0–1 años' },
  { k: 'Joven', t: '2–3 años' },
  { k: 'Adulto', t: '4–7 años' },
  { k: 'Senior', t: '8+ años' },
];
