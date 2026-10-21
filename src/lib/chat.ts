import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from './supabase';

export type MatchRow = {
  match_id: string;
  perro_id: string;
  nombre: string;
  dueno_nombre: string;
  colonia: string;
  foto: string | null;
  ultimo_texto: string | null;
  ultimo_autor: string | null;
  ultimo_creado: string | null;
  creado: string;
  sin_leer: number;
  visto: boolean;
  super_recibido: boolean;
  super_enviado: boolean;
};

export type Message = {
  id: string;
  match_id: string;
  autor_id: string;
  texto: string;
  creado: string;
  eliminado?: boolean;
  pending?: boolean;
};

export async function myUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function listMatches(): Promise<MatchRow[]> {
  const { data, error } = await supabase.rpc('mis_matches');
  if (error) throw error;
  return (data ?? []) as MatchRow[];
}

export async function fetchMessages(matchId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('mensajes')
    .select('id, match_id, autor_id, texto, creado, eliminado')
    .eq('match_id', matchId)
    .order('creado', { ascending: true })
    .limit(500);
  if (error) throw error;
  return data as Message[];
}

export async function sendMessage(matchId: string, authorId: string, text: string): Promise<Message> {
  const { data, error } = await supabase
    .from('mensajes')
    .insert({ match_id: matchId, autor_id: authorId, texto: text })
    .select('id, match_id, autor_id, texto, creado, eliminado')
    .single();
  if (error) throw error;
  return data as Message;
}

/** Elimina un mensaje mío: los dos verán "Se eliminó este mensaje". */
export async function deleteMessage(id: string): Promise<boolean> {
  const { error } = await supabase.rpc('eliminar_mensaje', { p_mensaje: id });
  if (error && __DEV__) console.warn('[Eliminar mensaje]', error.message);
  return !error;
}

/** Avisa a la pestaña de Matches que vuelva a contar (por ejemplo, al leer una conversación). */
const badgeListeners = new Set<() => void>();
const refreshBadge = () => badgeListeners.forEach((f) => f());

export async function markRead(matchId: string) {
  await supabase.rpc('marcar_leido', { p_match: matchId });
  refreshBadge();
}

/** Al abrir la pestaña Matches, los matches nuevos quedan como vistos. */
export async function markMatchesSeen() {
  await supabase.rpc('marcar_matches_vistos');
  refreshBadge();
}

let channelSeq = 0;

/**
 * Escucha en tiempo real los mensajes nuevos y los matches nuevos de la persona.
 * Las reglas de seguridad hacen que solo lleguen los de sus propias conversaciones.
 */
export function useRealtime(onChange: () => void, matchId?: string) {
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  });
  useEffect(() => {
    const name = `dogder-${matchId ?? 'todo'}-${++channelSeq}`;
    const ch = supabase.channel(name).on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'mensajes', ...(matchId ? { filter: `match_id=eq.${matchId}` } : {}) },
      () => cb.current(),
    );
    // Un mensaje eliminado llega como cambio (UPDATE).
    ch.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'mensajes', ...(matchId ? { filter: `match_id=eq.${matchId}` } : {}) },
      () => cb.current(),
    );
    if (!matchId) ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'matches' }, () => cb.current());
    ch.subscribe();
    // Al volver a la app, se actualiza por si llegó algo mientras estaba cerrada.
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active') cb.current();
    });
    return () => {
      supabase.removeChannel(ch);
      app.remove();
    };
  }, [matchId]);
}

/** Cuántos matches nuevos sin ver o conversaciones con mensajes sin leer hay, para la pestaña. */
export function useMatchesBadge(): number {
  const [count, setCount] = useState(0);
  const refresh = useCallback(() => {
    listMatches()
      .then((rows) => setCount(rows.filter((r) => r.sin_leer > 0 || !r.visto).length))
      .catch(() => {});
  }, []);
  useEffect(refresh, [refresh]);
  useEffect(() => {
    badgeListeners.add(refresh);
    return () => {
      badgeListeners.delete(refresh);
    };
  }, [refresh]);
  useRealtime(refresh);
  return count;
}

/** "14:05", "Ayer" o "12 oct", para la lista y el chat. */
export function shortTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

/**
 * ¿El mensaje comparte datos de contacto (teléfono, redes, links)?
 * Se permite, pero el chat muestra un recordatorio de seguridad.
 */
const LINK_RE =
  /https?:\/\/|www\.|\b[\w-]+\.(com|mx|net|org|app|me|ly|link)\b|(^|\s)@[a-z0-9_.]{3,}|\b(whats ?app|whats|wats|wsp|wa\.me|insta(gram)?|ig|telegram|facebook|fb|tiktok|tel[eé]fono|cel(ular)?)\b/i;
const PHONE_RE = /\+?\d[\d\s().-]{6,}\d/g;
export function sharesContact(text: string): boolean {
  if (LINK_RE.test(text)) return true;
  // Un número cuenta como teléfono si tiene al menos 8 dígitos y no es una fecha.
  return (text.match(PHONE_RE) ?? []).some((m) => !/^\d{4}-\d{1,2}-\d{1,2}$/.test(m.trim()) && m.replace(/\D/g, '').length >= 8);
}
