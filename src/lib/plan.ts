import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase, supabaseConfigured } from './supabase';
import { NearbyDog, rememberDog } from './discover';

/** Lo que el servidor dice del plan de la persona (ventanas de 24 h). */
export type Plan = {
  plus: boolean;
  plusHasta: Date | null;
  likesRestantes: number | null; // null = sin límite (Plus)
  likesVuelven: Date | null;
  supersRestantes: number;
  superVuelve: Date | null;
  deshacerVuelve: Date | null; // null = disponible
  viaje: string | null; // nombre del lugar del modo viaje
  likesRecibidos: number;
};

export const FREE_PLAN: Plan = {
  plus: false,
  plusHasta: null,
  likesRestantes: 50,
  likesVuelven: null,
  supersRestantes: 1,
  superVuelve: null,
  deshacerVuelve: null,
  viaje: null,
  likesRecibidos: 0,
};

const date = (v: unknown) => (typeof v === 'string' ? new Date(v) : null);

export async function myPlan(): Promise<Plan> {
  if (!supabaseConfigured) return FREE_PLAN;
  const { data, error } = await supabase.rpc('mi_plan');
  if (error) throw error;
  const p = (data ?? {}) as Record<string, unknown>;
  return {
    plus: !!p.plus,
    plusHasta: date(p.plus_hasta),
    likesRestantes: typeof p.likes_restantes === 'number' ? p.likes_restantes : null,
    likesVuelven: date(p.likes_vuelven),
    supersRestantes: typeof p.supers_restantes === 'number' ? p.supers_restantes : 0,
    superVuelve: date(p.super_vuelve),
    deshacerVuelve: date(p.deshacer_vuelve),
    viaje: typeof p.viaje === 'string' ? p.viaje : null,
    likesRecibidos: typeof p.likes_recibidos === 'number' ? p.likes_recibidos : 0,
  };
}

/** El plan, recargado cada vez que la pantalla vuelve a estar a la vista. */
export function usePlan() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const reload = useCallback(() => {
    myPlan().then(setPlan).catch(() => {});
  }, []);
  useFocusEffect(reload);
  return { plan, reload, setPlan };
}

/** Avisa a las pantallas que el plan cambió (por ejemplo, después de deslizar). */
const listeners = new Set<() => void>();
export const planChanged = () => listeners.forEach((f) => f());
export function usePlanListener(cb: () => void) {
  useEffect(() => {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, [cb]);
}

/** Los perros que le dieron me gusta a mi perro (solo con Plus). */
export async function likesReceived(): Promise<NearbyDog[]> {
  const { data, error } = await supabase.rpc('likes_recibidos');
  if (error) throw error;
  const dogs = (data ?? []) as NearbyDog[];
  dogs.forEach(rememberDog);
  return dogs;
}

/** Modo viaje (Plus): buscar perros como si estuvieras en otro lugar. */
export async function setTravel(lat: number, lng: number, name: string): Promise<boolean> {
  const { error } = await supabase.rpc('activar_viaje', { p_lat: lat, p_lng: lng, p_nombre: name });
  if (error && __DEV__) console.warn('[Modo viaje]', error.message);
  return !error;
}

export async function clearTravel(): Promise<boolean> {
  const { error } = await supabase.rpc('quitar_viaje');
  return !error;
}

/** Lo que incluye Dogder Plus, para la pantalla de Plus. */
export const PLUS_FEATURES = [
  { key: 'likes', title: 'Mira quién le dio me gusta', text: 'Ve a los perros que ya le dieron me gusta al tuyo y haz match al instante.' },
  { key: 'unlimited', title: 'Me gusta sin límite', text: 'Gratis tienes 50 al día. Con Plus, desliza todo lo que quieras.' },
  { key: 'super', title: '5 súper huesos al día', text: 'En lugar de 1. Destaca con más perros.' },
  { key: 'undo', title: 'Deshacer sin límite', text: '¿Te equivocaste de lado? Regresa las veces que quieras.' },
  { key: 'filters', title: 'Filtros avanzados', text: 'Busca por edad, nivel de energía y raza.' },
  { key: 'travel', title: 'Modo viaje', text: '¿Te vas de vacaciones con tu perro? Busca amigos en otra ciudad antes de llegar.' },
] as const;

export type PlusFeature = (typeof PLUS_FEATURES)[number]['key'];
