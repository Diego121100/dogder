import { Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Button, LinkButton } from './ui';
import { photoUrl } from '@/lib/photos';
import { fonts, useColors } from '@/theme';

type Dog = { nombre: string; foto?: string };

/** "¡Es un match!" con las fotos de los dos perros. */
export function MatchModal({
  mine,
  other,
  onClose,
  onMessage,
}: {
  mine: Dog | null;
  other: Dog | null;
  onClose: () => void;
  onMessage: () => void;
}) {
  const c = useColors();
  const avatar = (d: Dog | null, style?: object) => (
    <View style={[styles.av, { backgroundColor: c.surface }, style]}>
      {d?.foto ? <Image source={{ uri: photoUrl(d.foto) }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
    </View>
  );
  return (
    <Modal visible={!!other} animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={[styles.wrap, { backgroundColor: c.welcomeBg }]}>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'center' }} accessible={false}>
          {avatar(mine)}
          {avatar(other, { marginLeft: -22 })}
        </View>
        <Text style={[styles.title, { color: c.ball }]} accessibilityRole="header">
          ¡Es un{'\n'}match!
        </Text>
        <Text style={styles.text}>
          {mine?.nombre ?? 'Tu perro'} y {other?.nombre} se gustaron. ¡Organicen su primer paseo juntos!
        </Text>
        <View style={{ flex: 1 }} />
        <Button title="Enviar mensaje" variant="ball" onPress={onMessage} />
        <LinkButton title="Seguir buscando" color="#FFFFFF" onPress={onClose} />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 24, paddingBottom: 16, gap: 22 },
  av: { width: 124, height: 124, borderRadius: 62, borderWidth: 4, borderColor: '#FFFFFF', overflow: 'hidden' },
  title: { fontFamily: fonts.display, fontSize: 48, lineHeight: 46, textAlign: 'center', letterSpacing: -1.2 },
  text: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.body, fontSize: 16, lineHeight: 24, textAlign: 'center', maxWidth: 300, alignSelf: 'center' },
});
