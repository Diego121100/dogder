import { DEFAULT_FILTERS, Filters } from './discover';

/** Los filtros se recuerdan en el teléfono, para que no haya que elegirlos cada vez. */
const KEY = 'dogder:filtros';

export function loadFilters(): Filters {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return DEFAULT_FILTERS;
    const f = { ...DEFAULT_FILTERS, ...(JSON.parse(raw) as Partial<Filters>) };
    // Las distancias que ya no existen pasan a la más cercana de la lista.
    if (!DISTANCES.some((d) => d.km === f.maxKm)) f.maxKm = f.maxKm > 10 ? FAR_KM : DEFAULT_FILTERS.maxKm;
    return f;
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
export function activeFilters(f: Filters, plus = true): number {
  return (
    Number(f.maxKm !== DEFAULT_FILTERS.maxKm) +
    Number(f.sizes.length < 3) +
    (plus ? Number(f.ages.length > 0) + Number(f.energies.length > 0) + Number(f.breeds.length > 0) : 0)
  );
}

/** "20+ km" busca hasta el máximo que permite el servidor (50 km). */
export const FAR_KM = 50;
export const DISTANCES = [
  { km: 1, t: '1 km' },
  { km: 3, t: '3 km' },
  { km: 5, t: '5 km' },
  { km: 10, t: '10 km' },
  { km: FAR_KM, t: '20+ km' },
];
export const AGE_GROUPS = [
  { k: 'Cachorro', t: '0–1 años' },
  { k: 'Joven', t: '2–3 años' },
  { k: 'Adulto', t: '4–7 años' },
  { k: 'Senior', t: '8+ años' },
];
