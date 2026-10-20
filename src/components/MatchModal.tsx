import { Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Button, LinkButton } from './ui';
import { BoneIcon } from './ActionBar';
import { photoUrl } from '@/lib/photos';
import { fonts, useColors } from '@/theme';

type Dog = { nombre: string; foto?: string };
type Other = Dog & { superRecibido?: boolean; superEnviado?: boolean };

/** "¡Es un match!" con las fotos de los dos perros. */
export function MatchModal({
  mine,
  other,
  onClose,
  onMessage,
}: {
  mine: Dog | null;
  other: Other | null;
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
        {(other?.superRecibido || other?.superEnviado) && (
          <View style={[styles.superTag, { backgroundColor: c.sky }]}>
            <BoneIcon color="#FFFFFF" size={16} />
            <Text style={styles.superTagText}>
              {other.superRecibido ? 'Te mandó un súper hueso' : 'Le mandaste un súper hueso'}
            </Text>
          </View>
        )}
        <Text style={styles.text}>
          {other?.superRecibido
            ? `${other.nombre} te mandó un súper hueso y a ti también te gustó. ¡Organicen su primer paseo juntos!`
            : other?.superEnviado
              ? `Le mandaste un súper hueso a ${other.nombre} y ¡también le gustó ${mine?.nombre ?? 'tu perro'}! Organicen su primer paseo juntos.`
              : `${mine?.nombre ?? 'Tu perro'} y ${other?.nombre} se gustaron. ¡Organicen su primer paseo juntos!`}
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
  superTag: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  superTagText: { color: '#FFFFFF', fontFamily: fonts.bodyBold, fontSize: 14 },
  text: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.body, fontSize: 16, lineHeight: 24, textAlign: 'center', maxWidth: 300, alignSelf: 'center' },
});
