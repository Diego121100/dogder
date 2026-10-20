import { Alert, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { supabase } from './supabase';

export const MIN_PHOTOS = 2;
export const MAX_PHOTOS = 6;
const MAX_SIDE = 1600; // px: suficiente para verse nítida y pesar poco

/**
 * Pide el permiso de Fotos con el aviso del sistema
 * ("Permitir acceso completo", "Limitar acceso", "No permitir").
 * Si la persona ya lo negó antes, le explica cómo activarlo en Ajustes.
 */
export async function ensurePhotoPermission(): Promise<boolean> {
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (current.granted) return true;

  if (current.canAskAgain) {
    const asked = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (asked.granted) return true;
  }

  Alert.alert(
    'Permite el acceso a tus fotos',
    'Para subir las fotos de tu perro, Dogder necesita acceso a tus fotos. Actívalo en Ajustes → Dogder → Fotos.',
    [
      { text: 'Ahora no', style: 'cancel' },
      { text: 'Abrir Ajustes', onPress: () => Linking.openSettings() },
    ],
  );
  return false;
}

/** Abre la galería para elegir hasta `remaining` fotos. Devuelve las fotos ya reducidas y en JPEG. */
export async function pickPhotos(remaining: number): Promise<string[]> {
  if (remaining <= 0) return [];
  if (!(await ensurePhotoPermission())) return [];

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsMultipleSelection: true,
    selectionLimit: remaining,
    orderedSelection: true,
    quality: 1,
  });
  if (result.canceled) return [];

  const out: string[] = [];
  for (const asset of result.assets.slice(0, remaining)) {
    out.push(await shrink(asset));
  }
  return out;
}

/** Reduce la foto al lado mayor de 1600 px y la guarda como JPEG comprimido. */
async function shrink(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  const ctx = ImageManipulator.manipulate(asset.uri);
  const landscape = asset.width >= asset.height;
  if (Math.max(asset.width, asset.height) > MAX_SIDE) {
    ctx.resize(landscape ? { width: MAX_SIDE, height: null } : { width: null, height: MAX_SIDE });
  }
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.75 });
  return saved.uri;
}

/** Sube una foto al bucket "fotos" en la carpeta del usuario y devuelve su ruta. */
export async function uploadPhoto(userId: string, localUri: string): Promise<string> {
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  const body = await (await fetch(localUri)).arrayBuffer();
  const { error } = await supabase.storage.from('fotos').upload(path, body, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;
  return path;
}

/** URL pública de una foto guardada en el bucket. */
export function photoUrl(path: string): string {
  return supabase.storage.from('fotos').getPublicUrl(path).data.publicUrl;
}
