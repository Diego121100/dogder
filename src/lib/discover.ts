import { supabase } from './supabase';
import type { Cercania } from './distance';

/** Un perro en Descubrir, tal como lo manda el servidor (sin coordenadas de nadie). */
export type NearbyDog = {
  perro_id: string;
  nombre: string;
  edad: number;
  raza: string;
  tamano: 'Chico' | 'Mediano' | 'Grande';
  energia: number;
  sexo: 'Macho' | 'Hembra' | null;
  bio: string;
  dueno_nombre: string;
  colonia: string;
  cercania: Cercania;
  distancia_km: number;
  fotos: string[];
};

export type Filters = {
  maxKm: number;
  sizes: string[];
  ages: string[];
  energies: number[];
  breeds: string[];
  sexes: string[];
};

export const DEFAULT_FILTERS: Filters = {
  maxKm: 10,
  sizes: ['Chico', 'Mediano', 'Grande'],
  ages: [],
  energies: [],
  breeds: [],
  sexes: [],
};

/** Caché en memoria para abrir el perfil completo sin volver a pedirlo al servidor. */
const cache = new Map<string, NearbyDog>();
export const cachedDog = (id: string) => cache.get(id);
export const rememberDog = (d: NearbyDog) => cache.set(d.perro_id, d);

export async function fetchNearby(f: Filters = DEFAULT_FILTERS): Promise<NearbyDog[]> {
  const { data, error } = await supabase.rpc('perros_cercanos', {
    p_max_km: f.maxKm,
    p_tamanos: f.sizes,
    p_edades: f.ages.length ? f.ages : null,
    p_energias: f.energies.length ? f.energies : null,
    p_razas: f.breeds.length ? f.breeds : null,
    p_limite: 20,
    p_sexos: f.sexes.length ? f.sexes : null,
  });
  if (error) throw error;
  const dogs = (data ?? []) as NearbyDog[];
  dogs.forEach(rememberDog);
  return dogs;
}

export type SwipeKind = 'like' | 'nope' | 'super';
export type SwipeResult =
  | { ok: true; matchId: string | null }
  | { ok: false; reason: 'super_agotado'; availableAt: Date }
  | { ok: false; reason: 'error'; message: string };

export async function sendSwipe(dogId: string, kind: SwipeKind): Promise<SwipeResult> {
  const { data, error } = await supabase.rpc('dar_like', { p_a_perro: dogId, p_tipo: kind });
  if (error) return { ok: false, reason: 'error', message: error.message };
  const r = data as { ok: boolean; motivo?: string; disponible?: string; match_id?: string | null };
  if (!r.ok && r.motivo === 'super_agotado') {
    return { ok: false, reason: 'super_agotado', availableAt: new Date(r.disponible ?? Date.now()) };
  }
  return { ok: true, matchId: r.match_id ?? null };
}

export async function undoSwipe(dogId: string): Promise<boolean> {
  const { error } = await supabase.rpc('deshacer_like', { p_a_perro: dogId });
  return !error;
}

/** Cuándo vuelve a estar disponible el súper hueso (null = disponible ya). */
export async function superAvailableAt(): Promise<Date | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data } = await supabase.from('perfiles').select('super_hueso_usado').eq('id', u.user.id).single();
  if (!data?.super_hueso_usado) return null;
  const next = new Date(new Date(data.super_hueso_usado).getTime() + 24 * 3600_000);
  return next > new Date() ? next : null;
}

export function waitLabel(at: Date): string {
  const mins = Math.max(1, Math.ceil((at.getTime() - Date.now()) / 60_000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
}

/** Datos de mi perro para la pantalla de match. */
export type MyDog = { id: string; nombre: string; sexo: 'Macho' | 'Hembra' | null; foto?: string };
export async function myDogSummary(): Promise<MyDog | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data } = await supabase
    .from('perros')
    .select('id, nombre, sexo, fotos(ruta, orden)')
    .eq('dueno_id', u.user.id)
    .order('orden', { referencedTable: 'fotos' })
    .limit(1, { referencedTable: 'fotos' })
    .single();
  return data ? { id: data.id, nombre: data.nombre, sexo: data.sexo, foto: data.fotos?.[0]?.ruta } : null;
}

/** Guarda el sexo de mi perro (para perfiles creados antes de que existiera esta pregunta). */
export async function setMyDogSex(dogId: string, sexo: 'Macho' | 'Hembra'): Promise<boolean> {
  const { error } = await supabase.from('perros').update({ sexo }).eq('id', dogId);
  return !error;
}

export const ENERGY_NAMES = ['Muy tranquilo', 'Tranquilo', 'Moderado', 'Activo', 'Incansable'];
export const ageGroup = (a: number) => (a <= 1 ? 'Cachorro' : a <= 3 ? 'Joven' : a <= 7 ? 'Adulto' : 'Senior');

/**
 * Acción elegida desde el perfil completo (Rechazar / Súper hueso / Me gusta).
 * Descubrir la aplica al volver, animando la tarjeta como si se hubiera deslizado.
 */
let pending: { id: string; kind: SwipeKind } | null = null;
export const setPendingSwipe = (id: string, kind: SwipeKind) => {
  pending = { id, kind };
};
export const takePendingSwipe = () => {
  const p = pending;
  pending = null;
  return p;
};
