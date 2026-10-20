/**
 * Texto de distancia que ven los demás. El servidor solo manda la categoría
 * (nunca metros exactos ni coordenadas), para proteger la ubicación de los dueños.
 */
export type Cercania = 'muy_cerca' | 'menos_1km' | 'km';

export function distanceLabel(cercania: Cercania, km: number): string {
  if (cercania === 'muy_cerca') return 'Muy cerca de ti';
  if (cercania === 'menos_1km') return 'A menos de 1 km';
  return `A ${Math.max(1, Math.round(km))} km`;
}
