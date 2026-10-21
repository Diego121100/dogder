import { supabase } from './supabase';
import { MIN_PHOTOS, PhotosRejected, reviewPhotos, uploadPhoto } from './photos';
import type { DogDraft } from './dog';

export type MyProfile = {
  userId: string;
  email: string;
  nombre: string;
  apellido: string;
  colonia: string;
  desde: string;
  dog: { id: string; draft: DogDraft } | null;
};

/** Mis datos y los de mi perro, para la pestaña Mi perro y para editar. */
export async function loadMyProfile(): Promise<MyProfile | null> {
  const { data: s } = await supabase.auth.getSession();
  const user = s.session?.user;
  if (!user) return null;
  const [{ data: p }, { data: d }] = await Promise.all([
    supabase.from('perfiles').select('nombre, apellido, colonia, creado').eq('id', user.id).single(),
    supabase
      .from('perros')
      .select('id, nombre, edad, raza, tamano, sexo, energia, bio, fotos(ruta, orden)')
      .eq('dueno_id', user.id)
      .order('orden', { referencedTable: 'fotos' })
      .maybeSingle(),
  ]);
  return {
    userId: user.id,
    email: user.email ?? '',
    nombre: p?.nombre ?? '',
    apellido: p?.apellido ?? '',
    colonia: p?.colonia ?? '',
    desde: p?.creado ? new Date(p.creado).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }) : '',
    dog: d
      ? {
          id: d.id,
          draft: {
            photos: (d.fotos ?? []).map((f: { ruta: string }) => f.ruta),
            name: d.nombre,
            age: String(d.edad),
            breed: d.raza,
            sex: d.sexo ?? '',
            size: d.tamano,
            energy: d.energia,
            bio: d.bio ?? '',
          },
        }
      : null,
  };
}

const isLocal = (p: string) => /^(file|content|ph|assets-library):/.test(p);

/**
 * Guarda los cambios del perfil del perro.
 * Fotos: sube las nuevas, conserva las que siguen y borra del almacenamiento las que se quitaron.
 */
export async function saveDogEdits(userId: string, dogId: string, before: string[], d: DogDraft): Promise<void> {
  if (d.photos.length < MIN_PHOTOS) throw new Error('Se necesitan al menos 2 fotos');

  const { error } = await supabase
    .from('perros')
    .update({
      nombre: d.name.trim(),
      edad: Number(d.age),
      raza: d.breed.trim(),
      tamano: d.size,
      sexo: d.sex || null,
      energia: d.energy,
      bio: d.bio.trim() || `Hola, soy ${d.name.trim()}.`,
    })
    .eq('id', dogId);
  if (error) throw error;

  const uploaded: string[] = [];
  const finalPaths: string[] = [];
  try {
    for (const p of d.photos) {
      if (isLocal(p)) {
        const path = await uploadPhoto(userId, p);
        uploaded.push(path);
        finalPaths.push(path);
      } else {
        finalPaths.push(p);
      }
    }
    // Reemplaza la lista de fotos en el nuevo orden (la primera es la principal).
    const del = await supabase.from('fotos').delete().eq('perro_id', dogId);
    if (del.error) throw del.error;
    const ins = await supabase.from('fotos').insert(finalPaths.map((ruta, orden) => ({ perro_id: dogId, ruta, orden })));
    if (ins.error) throw ins.error;

    const removed = before.filter((p) => !finalPaths.includes(p) && !/^https?:/.test(p));
    if (removed.length) await supabase.storage.from('fotos').remove(removed);
  } catch (e) {
    if (uploaded.length) await supabase.storage.from('fotos').remove(uploaded);
    throw e;
  }

  // Solo se revisan las fotos nuevas; las que ya estaban aprobadas no cambian.
  const rejected = await reviewPhotos();
  if (rejected.length) throw new PhotosRejected(rejected.map((r) => finalPaths.indexOf(r)).filter((i) => i >= 0));
}

export type Blocked = { usuario: string; perro_nombre: string | null; foto: string | null };

export async function listBlocked(): Promise<Blocked[]> {
  const { data, error } = await supabase.rpc('mis_bloqueados');
  if (error) throw error;
  return (data ?? []) as Blocked[];
}

export async function unblock(userId: string): Promise<boolean> {
  const { error } = await supabase.from('bloqueos').delete().eq('bloqueado', userId);
  return !error;
}

export async function ownerOf(dogId: string): Promise<string | null> {
  const { data } = await supabase.rpc('dueno_de', { p_perro: dogId });
  return (data as string | null) ?? null;
}

export const REPORT_REASONS = [
  'Fotos o contenido inapropiado',
  'Acoso o mensajes ofensivos',
  'Venta o cruza de animales',
  'Perfil falso o spam',
  'Maltrato animal',
  'Otro motivo',
] as const;

export async function reportUser(dogId: string, motivo: string, detalles: string, mensajeId?: string): Promise<boolean> {
  const { data: s } = await supabase.auth.getSession();
  const me = s.session?.user.id;
  const owner = await ownerOf(dogId);
  if (!me || !owner) return false;
  const { error } = await supabase
    .from('reportes')
    .insert({ reportador: me, reportado: owner, motivo, detalles: detalles.trim(), ...(mensajeId ? { mensaje_id: mensajeId } : {}) });
  return !error;
}

/** Bloquea al dueño de un perro. El servidor borra el match y la conversación. */
export async function blockDogOwner(dogId: string): Promise<boolean> {
  const { data: s } = await supabase.auth.getSession();
  const me = s.session?.user.id;
  const owner = await ownerOf(dogId);
  if (!me || !owner) return false;
  const { error } = await supabase.from('bloqueos').insert({ bloqueador: me, bloqueado: owner });
  return !error || error.code === '23505'; // ya estaba bloqueado
}

/**
 * Elimina la cuenta: confirma la contraseña, borra las fotos y después la cuenta
 * con todo lo relacionado (perro, matches, mensajes…). No se puede deshacer.
 */
export async function deleteAccount(email: string, password: string): Promise<'ok' | 'wrong_password' | 'error'> {
  const check = await supabase.auth.signInWithPassword({ email, password });
  if (check.error) return check.error.code === 'invalid_credentials' ? 'wrong_password' : 'error';
  const userId = check.data.user.id;

  const { data: files } = await supabase.storage.from('fotos').list(userId, { limit: 100 });
  if (files?.length) await supabase.storage.from('fotos').remove(files.map((f) => `${userId}/${f.name}`));

  const { error } = await supabase.rpc('eliminar_cuenta');
  if (error) return 'error';
  await supabase.auth.signOut();
  return 'ok';
}
