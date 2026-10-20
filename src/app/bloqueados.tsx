import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { Lead, Screen, Title } from '@/components/ui';
import { Blocked, listBlocked, unblock } from '@/lib/account';
import { photoUrl } from '@/lib/photos';
import { fonts, radius, useColors } from '@/theme';

/** Usuarios bloqueados, con la opción de desbloquear. */
export default function BlockedList() {
  const c = useColors();
  const [rows, setRows] = useState<Blocked[] | null>(null);

  const load = useCallback(() => {
    listBlocked().then(setRows).catch(() => setRows([]));
  }, []);
  useEffect(load, [load]);

  function confirmUnblock(b: Blocked) {
    const name = b.perro_nombre ?? 'este usuario';
    Alert.alert(`¿Desbloquear a ${name}?`, `${name} podrá volver a aparecer en Descubrir. El match y la conversación anteriores no se recuperan.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desbloquear',
        onPress: async () => {
          if (await unblock(b.usuario)) load();
          else Alert.alert('No se pudo desbloquear', 'Revisa tu conexión e inténtalo de nuevo.');
        },
      },
    ]);
  }

  return (
    <Screen>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Volver" hitSlop={6}
        style={[styles.back, { borderColor: c.line, backgroundColor: c.surface }]}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={c.ink} strokeWidth={2.5} strokeLinecap="round">
          <Path d="M15 5l-7 7 7 7" />
        </Svg>
      </Pressable>
      <Title>Usuarios bloqueados</Title>
      {rows === null && <ActivityIndicator color={c.ink} />}
      {rows?.length === 0 && (
        <Lead>No has bloqueado a nadie. Puedes bloquear a un usuario desde su chat o desde su perfil.</Lead>
      )}
      {rows?.map((b) => (
        <View key={b.usuario} style={[styles.row, { borderBottomColor: c.line }]}>
          <View style={[styles.av, { backgroundColor: c.surface }]}>
            {b.foto ? <Image source={{ uri: photoUrl(b.foto) }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          </View>
          <Text style={[styles.name, { color: c.ink }]} numberOfLines={1}>{b.perro_nombre ?? 'Usuario'}</Text>
          <Pressable onPress={() => confirmUnblock(b)} accessibilityRole="button"
            style={[styles.btn, { borderColor: c.ink }]}>
            <Text style={[styles.btnText, { color: c.ink }]}>Desbloquear</Text>
          </Pressable>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  av: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden' },
  name: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 16 },
  btn: { borderWidth: 1.5, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8 },
  btnText: { fontFamily: fonts.bodyBold, fontSize: 13 },
});
