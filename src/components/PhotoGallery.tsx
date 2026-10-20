import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { MAX_PHOTOS, pickPhotos } from '@/lib/photos';
import { fonts, radius, useColors } from '@/theme';

/**
 * Galería de hasta 6 fotos. La primera es la principal (la que ven primero los demás).
 * Tocar una foto la vuelve principal; la × la quita; un espacio vacío abre la galería del teléfono.
 */
export function PhotoGallery({ photos, onChange }: { photos: string[]; onChange: (p: string[]) => void }) {
  const c = useColors();
  const [loading, setLoading] = useState(false);
  const [width, setWidth] = useState(0);
  const gap = 8;
  const small = (width - gap * 2) / 3;
  const big = small * 2 + gap;

  async function add() {
    if (loading) return;
    setLoading(true);
    try {
      const picked = await pickPhotos(MAX_PHOTOS - photos.length);
      if (picked.length) onChange([...photos, ...picked].slice(0, MAX_PHOTOS));
    } finally {
      setLoading(false);
    }
  }
  const remove = (i: number) => onChange(photos.filter((_, j) => j !== i));
  const makeMain = (i: number) => {
    if (i === 0) return;
    const next = [...photos];
    const [p] = next.splice(i, 1);
    onChange([p, ...next]);
  };

  const slot = (i: number, size: number) => {
    const uri = photos[i];
    const box = { width: size, height: size, borderRadius: radius.md };
    if (uri) {
      return (
        <Pressable
          key={i}
          onPress={() => makeMain(i)}
          accessibilityRole="button"
          accessibilityLabel={i === 0 ? 'Foto principal' : `Hacer principal la foto ${i + 1}`}
          style={[box, styles.filled]}
        >
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          {i === 0 && (
            <View style={[styles.mainTag, { backgroundColor: c.ball }]}>
              <Text style={[styles.mainTagText, { color: c.ballInk }]}>Principal</Text>
            </View>
          )}
          <Pressable
            onPress={() => remove(i)}
            accessibilityRole="button"
            accessibilityLabel={`Quitar foto ${i + 1}`}
            hitSlop={8}
            style={styles.remove}
          >
            <Text style={styles.removeText}>×</Text>
          </Pressable>
        </Pressable>
      );
    }
    const isNext = i === photos.length;
    return (
      <Pressable
        key={i}
        onPress={add}
        accessibilityRole="button"
        accessibilityLabel="Agregar fotos"
        style={[box, styles.empty, { borderColor: c.line, backgroundColor: c.surface }]}
      >
        {loading && isNext ? (
          <ActivityIndicator color={c.ink} />
        ) : (
          <>
            <Text style={[styles.plus, { color: c.ink }]}>+</Text>
            {i === 0 && <Text style={[styles.emptyText, { color: c.muted }]}>Foto principal</Text>}
          </>
        )}
      </Pressable>
    );
  };

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ gap }}>
      {width > 0 && (
        <>
          <View style={{ flexDirection: 'row', gap }}>
            {slot(0, big)}
            <View style={{ gap }}>
              {slot(1, small)}
              {slot(2, small)}
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap }}>
            {slot(3, small)}
            {slot(4, small)}
            {slot(5, small)}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  filled: { overflow: 'hidden' },
  empty: { borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 2 },
  plus: { fontFamily: fonts.bodyBold, fontSize: 28, lineHeight: 30 },
  emptyText: { fontFamily: fonts.bodyBold, fontSize: 12.5 },
  mainTag: { position: 'absolute', left: 8, bottom: 8, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  mainTagText: { fontFamily: fonts.bodyBold, fontSize: 11 },
  remove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(10,14,22,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: '#FFFFFF', fontSize: 18, lineHeight: 20, fontFamily: fonts.bodyBold },
});
