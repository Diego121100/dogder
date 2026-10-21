import { useEffect } from 'react';
import { Alert, AppState } from 'react-native';
import { router } from 'expo-router';
import { supabase, supabaseConfigured } from './supabase';

export type MyStatus = {
  suspendida: boolean;
  motivo_suspension: string | null;
  advertencia: string | null;
  moderador: boolean;
};

/** ¿Mi cuenta está suspendida?, ¿tengo una advertencia pendiente?, ¿soy moderador? */
export async function myStatus(): Promise<MyStatus | null> {
  if (!supabaseConfigured) return null;
  const { data, error } = await supabase.rpc('mi_estado');
  if (error) throw error;
  return ((data ?? [])[0] as MyStatus | undefined) ?? null;
}

/**
 * Al abrir la app (y cada vez que vuelve a primer plano):
 * si la cuenta está suspendida, manda a la pantalla de suspensión;
 * si hay una advertencia, la muestra una sola vez.
 */
export function useModerationGate() {
  useEffect(() => {
    let showing = false;
    const check = () => {
      myStatus()
        .then((s) => {
          if (!s) return;
          if (s.suspendida) {
            router.replace({ pathname: '/suspendida', params: { motivo: s.motivo_suspension ?? '' } });
          } else if (s.advertencia && !showing) {
            showing = true;
            Alert.alert('Aviso del equipo de Dogder', s.advertencia, [
              {
                text: 'Entendido',
                onPress: () => {
                  showing = false;
                  supabase.rpc('leer_advertencia').then(() => {});
                },
              },
            ]);
          }
        })
        .catch(() => {});
    };
    check();
    const sub = AppState.addEventListener('change', (st) => st === 'active' && check());
    return () => sub.remove();
  }, []);
}

export type ModAction = 'descartar' | 'advertir' | 'suspender';

export type ReportMessage = { id?: string; texto: string; creado: string; de_reportado: boolean; eliminado?: boolean };

export type ModReport = {
  id: string;
  motivo: string;
  detalles: string;
  creado: string;
  estado: string;
  accion: ModAction | null;
  nota: string | null;
  resuelto: string | null;
  reportado: string | null;
  dueno: string | null;
  email: string | null;
  perro_nombre: string | null;
  perro_bio: string | null;
  fotos: string[];
  reportador_perro: string | null;
  total_reportes: number;
  suspendida: boolean;
  mensajes: ReportMessage[];
  mensaje_id: string | null;
};

export async function listReports(pending: boolean): Promise<ModReport[]> {
  const { data, error } = await supabase.rpc('mod_reportes', { p_pendientes: pending });
  if (error) throw error;
  return (data ?? []) as ModReport[];
}

export async function resolveReport(id: string, action: ModAction, note?: string): Promise<boolean> {
  const { error } = await supabase.rpc('mod_resolver', { p_reporte: id, p_accion: action, p_nota: note ?? null });
  if (error && __DEV__) console.warn('[Moderación]', error.message);
  return !error;
}

export async function reactivate(userId: string): Promise<boolean> {
  const { error } = await supabase.rpc('mod_reactivar', { p_usuario: userId });
  return !error;
}

/** Texto sugerido de advertencia según el motivo del reporte (el moderador lo puede cambiar). */
export function suggestedWarning(motivo: string): string {
  const base: Record<string, string> = {
    'Fotos o contenido inapropiado': 'Algunas de tus fotos o textos no cumplen las Normas de la comunidad. Usa solo fotos de tu perro.',
    'Acoso o mensajes ofensivos': 'Recibimos reportes por mensajes ofensivos. En Dogder tratamos a todos con respeto.',
    'Venta o cruza de animales': 'En Dogder no se permite vender, comprar ni ofrecer cruzas de animales.',
    'Perfil falso o spam': 'Recibimos reportes de que tu perfil podría ser falso o enviar spam. Usa datos y fotos reales.',
    'Maltrato animal': 'Recibimos un reporte relacionado con el bienestar de tu perro. En Dogder no toleramos el maltrato animal.',
  };
  return `${base[motivo] ?? 'Recibimos reportes sobre tu cuenta.'} Si se repite, tu cuenta será suspendida.`;
}
