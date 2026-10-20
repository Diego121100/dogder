import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { supabase, supabaseConfigured } from './supabase';

export type LocationResult =
  | { ok: true }
  | { ok: false; reason: 'denied' | 'blocked' | 'services_off' | 'timeout' | 'server' };

/** ¿La app ya tiene permiso de ubicación? (sin mostrar el aviso) */
export async function hasLocationPermission(): Promise<boolean> {
  return (await Location.getForegroundPermissionsAsync()).granted;
}

/** Envía la ubicación al servidor, que la redondea a ~500 m antes de guardarla. */
async function send(lat: number, lng: number): Promise<boolean> {
  if (!supabaseConfigured) return true;
  const { error } = await supabase.rpc('actualizar_ubicacion', { p_lat: lat, p_lng: lng });
  if (error && __DEV__) console.warn('[Ubicación]', error.message);
  return !error;
}

/**
 * Pide el permiso de ubicación con el aviso del sistema y guarda la ubicación.
 * Devuelve el motivo si no se pudo, para mostrar el mensaje adecuado.
 */
export async function requestAndSaveLocation(): Promise<LocationResult> {
  let perm = await Location.getForegroundPermissionsAsync();
  if (!perm.granted && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) return { ok: false, reason: perm.canAskAgain ? 'denied' : 'blocked' };

  if (!(await Location.hasServicesEnabledAsync())) return { ok: false, reason: 'services_off' };

  // Primero la última ubicación conocida (instantánea); si no hay, se pide una nueva.
  let pos = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 });
  if (!pos) {
    try {
      pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 15_000)),
      ]);
    } catch {
      return { ok: false, reason: 'timeout' };
    }
  }
  return (await send(pos.coords.latitude, pos.coords.longitude)) ? { ok: true } : { ok: false, reason: 'server' };
}

/** ¿Ya hay una ubicación guardada para esta cuenta? */
export async function hasSavedLocation(): Promise<boolean> {
  if (!supabaseConfigured) return true;
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return false;
  const { data } = await supabase.from('perfiles').select('lat').eq('id', u.user.id).maybeSingle();
  return data?.lat != null;
}

/**
 * Mientras la app está abierta, mantiene la ubicación al día sin que la persona haga nada.
 * Solo envía al servidor cuando te mueves unos 300 m. Si quitan el permiso, vuelve a pedirlo.
 */
export function useLocationWatch(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;

    async function start() {
      if (!(await hasLocationPermission())) {
        router.replace('/ubicacion');
        return;
      }
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 300 },
        (pos) => send(pos.coords.latitude, pos.coords.longitude),
      );
      if (cancelled) sub.remove();
    }
    start();

    // Al volver a la app, revisa que el permiso siga activo.
    const appState = AppState.addEventListener('change', async (s) => {
      if (s === 'active' && !(await hasLocationPermission())) router.replace('/ubicacion');
    });

    return () => {
      cancelled = true;
      sub?.remove();
      appState.remove();
    };
  }, [enabled]);
}
