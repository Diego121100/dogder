import { supabase } from './supabase';
import { MAX_PHOTOS, MIN_PHOTOS, PhotosRejected, reviewPhotos, uploadPhoto } from './photos';
import type { Seeking, Sex, Size } from '@/components/Choices';

export type DogDraft = {
  photos: string[]; // rutas locales en el teléfono
  name: string;
  age: string;
  breed: string;
  sex: Sex | '';
  seeking: Seeking | ''; // a quién quiere conocer
  size: Size;
  energy: number; // 0 = sin elegir
  bio: string;
};

export type DogErrors = Partial<Record<keyof DogDraft, string>>;

export const emptyDog: DogDraft = { photos: [], name: '', age: '', breed: '', sex: '', seeking: '', size: 'Mediano', energy: 0, bio: '' };

export function validateDog(d: DogDraft): DogErrors {
  const e: DogErrors = {};
  if (d.photos.length < MIN_PHOTOS) {
    e.photos = d.photos.length === 0 ? 'Sube al menos 2 fotos de tu perro.' : 'Te falta 1 foto: sube al menos 2.';
  }
  if (!d.name.trim()) e.name = 'Escribe el nombre de tu perro.';
  const age = Number(d.age);
  if (d.age.trim() === '' || !Number.isInteger(age) || age < 0 || age > 25) {
    e.age = 'Escribe su edad en años (0 si es cachorro).';
  }
  if (!d.sex) e.sex = 'Elige si tu perro es macho o hembra.';
  if (!d.seeking) e.seeking = 'Elige a quién quiere conocer tu perro.';
  if (d.breed.trim().length < 2) e.breed = 'Elige la raza. Si no tiene raza definida, elige “Mestizo”.';
  if (!d.energy) e.energy = 'Elige qué tan activo es tu perro.';
  return e;
}

/**
 * ¿La persona con sesión ya completó el perfil de su perro (con al menos 2 fotos)?
 * Un perfil sin fotos (por ejemplo, si se cortó el internet al subirlas) cuenta como incompleto.
 */
export async function hasDog(): Promise<boolean> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return false;
  const { data } = await supabase
    .from('perros')
    .select('id, fotos(count)')
    .eq('dueno_id', u.user.id)
    .maybeSingle();
  const count = (data?.fotos as unknown as { count: number }[] | undefined)?.[0]?.count ?? 0;
  return !!data && count >= MIN_PHOTOS;
}

/**
 * Guarda el perfil del perro: crea (o completa) el registro, sube las fotos y las enlaza en orden.
 * Si falla la subida, borra las fotos que alcanzó a subir; el perfil queda incompleto
 * y la app vuelve a pedir este paso.
 */
export async function saveDog(d: DogDraft): Promise<void> {
  const { data: u, error: authErr } = await supabase.auth.getUser();
  if (authErr || !u.user) throw new Error('Tu sesión terminó. Inicia sesión de nuevo.');
  const userId = u.user.id;

  const fields = {
    nombre: d.name.trim(),
    edad: Number(d.age),
    raza: d.breed.trim(),
    tamano: d.size,
    sexo: d.sex || null,
    busca: d.seeking || 'Ambos',
    energia: d.energy,
    bio: d.bio.trim() || `Hola, soy ${d.name.trim()}.`,
  };

  // Si quedó un perfil incompleto de un intento anterior, se reutiliza.
  const { data: existing } = await supabase.from('perros').select('id').eq('dueno_id', userId).maybeSingle();
  let dogId: string;
  if (existing) {
    const { error } = await supabase.from('perros').update(fields).eq('id', existing.id);
    if (error) throw error;
    dogId = existing.id;
    const { data: old } = await supabase.from('fotos').select('ruta').eq('perro_id', dogId);
    if (old?.length) {
      await supabase.from('fotos').delete().eq('perro_id', dogId);
      await supabase.storage.from('fotos').remove(old.map((f) => f.ruta));
    }
  } else {
    const { data, error } = await supabase.from('perros').insert({ dueno_id: userId, ...fields }).select('id').single();
    if (error || !data) throw error ?? new Error('No se pudo crear el perfil');
    dogId = data.id;
  }

  const uploaded: string[] = [];
  try {
    for (const uri of d.photos.slice(0, MAX_PHOTOS)) uploaded.push(await uploadPhoto(userId, uri));
    const { error } = await supabase
      .from('fotos')
      .insert(uploaded.map((ruta, orden) => ({ perro_id: dogId, ruta, orden })));
    if (error) throw error;
  } catch (e) {
    if (uploaded.length) await supabase.storage.from('fotos').remove(uploaded);
    throw e;
  }

  // Revisión automática de las fotos (desnudos, violencia, etc.).
  const rejected = await reviewPhotos();
  if (rejected.length) throw new PhotosRejected(rejected.map((r) => uploaded.indexOf(r)).filter((i) => i >= 0));
}
