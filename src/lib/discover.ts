import { supabase } from './supabase';
import type { Seeking } from '@/components/Choices';
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
  te_dio_super: boolean;
};

export type Filters = {
  maxKm: number;
  sizes: string[];
  ages: string[];
  energies: number[];
  breeds: string[];
  sexes: string[]; // ya no se usa: ahora cada perro dice a quién busca (perros.busca)
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

/** `busca` solo se pasa para la vista previa de los filtros (antes de guardarlo). */
export async function fetchNearby(f: Filters = DEFAULT_FILTERS, busca?: Seeking): Promise<NearbyDog[]> {
  const { data, error } = await supabase.rpc('perros_cercanos', {
    p_max_km: f.maxKm,
    p_tamanos: f.sizes,
    p_edades: f.ages.length ? f.ages : null,
    p_energias: f.energies.length ? f.energies : null,
    p_razas: f.breeds.length ? f.breeds : null,
    p_limite: 20,
    ...(busca ? { p_busca: busca } : {}),
  });
  if (error) throw error;
  const dogs = (data ?? []) as NearbyDog[];
  dogs.forEach(rememberDog);
  return dogs;
}

export type SwipeKind = 'like' | 'nope' | 'super';
export type SwipeResult =
  | { ok: true; matchId: string | null }
  | { ok: false; reason: 'super_agotado' | 'likes_agotados'; availableAt: Date }
  | { ok: false; reason: 'error'; message: string };

export async function sendSwipe(dogId: string, kind: SwipeKind): Promise<SwipeResult> {
  const { data, error } = await supabase.rpc('dar_like', { p_a_perro: dogId, p_tipo: kind });
  if (error) return { ok: false, reason: 'error', message: error.message };
  const r = data as { ok: boolean; motivo?: string; disponible?: string; match_id?: string | null };
  if (!r.ok && (r.motivo === 'super_agotado' || r.motivo === 'likes_agotados')) {
    return { ok: false, reason: r.motivo, availableAt: new Date(r.disponible ?? Date.now()) };
  }
  return { ok: true, matchId: r.match_id ?? null };
}

export type UndoResult =
  | { ok: true }
  | { ok: false; reason: 'deshacer_agotado'; availableAt: Date }
  | { ok: false; reason: 'solo_ultimo' | 'error' };

/** Deshacer: gratis solo el último y 1 vez cada 24 h; con Plus, sin límite. */
export async function undoSwipe(dogId: string): Promise<UndoResult> {
  const { data, error } = await supabase.rpc('deshacer_like', { p_a_perro: dogId });
  if (error) return { ok: false, reason: 'error' };
  const r = data as { ok: boolean; motivo?: string; disponible?: string };
  if (r.ok) return { ok: true };
  if (r.motivo === 'deshacer_agotado') return { ok: false, reason: 'deshacer_agotado', availableAt: new Date(r.disponible ?? Date.now()) };
  if (r.motivo === 'solo_ultimo') return { ok: false, reason: 'solo_ultimo' };
  return { ok: false, reason: 'error' };
}

export function waitLabel(at: Date): string {
  const mins = Math.max(1, Math.ceil((at.getTime() - Date.now()) / 60_000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
}

/** Datos de mi perro para la pantalla de match. */
export type MyDog = { id: string; nombre: string; sexo: 'Macho' | 'Hembra' | null; busca: Seeking; foto?: string };
export async function myDogSummary(): Promise<MyDog | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data } = await supabase
    .from('perros')
    .select('id, nombre, sexo, busca, fotos(ruta, orden)')
    .eq('dueno_id', u.user.id)
    .order('orden', { referencedTable: 'fotos' })
    .limit(1, { referencedTable: 'fotos' })
    .single();
  return data
    ? { id: data.id, nombre: data.nombre, sexo: data.sexo, busca: (data.busca ?? 'Ambos') as Seeking, foto: data.fotos?.[0]?.ruta }
    : null;
}

/** Cambia a quién busca mi perro (Hembras, Machos o Ambos). */
export async function setMySeeking(dogId: string, busca: Seeking): Promise<boolean> {
  const { error } = await supabase.from('perros').update({ busca }).eq('id', dogId);
  return !error;
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

/**
 * Avisa en tiempo real cuando otro perro le manda un súper hueso a mi perro.
 * Solo llegan súper huesos: los "me gusta" normales siguen siendo secretos.
 */
export function onSuperReceived(myDogId: string, cb: (dogId: string) => void) {
  const ch = supabase
    .channel(`super-${myDogId}-${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'likes', filter: `a_perro=eq.${myDogId}` }, (p) => {
      const row = p.new as { de_perro?: string; tipo?: string } | undefined;
      if (row?.tipo === 'super' && row.de_perro) cb(row.de_perro);
    })
    .subscribe();
  return () => {
    supabase.removeChannel(ch);
  };
}

export async function dogName(dogId: string): Promise<string | null> {
  const { data } = await supabase.from('perros').select('nombre').eq('id', dogId).maybeSingle();
  return data?.nombre ?? null;
}
