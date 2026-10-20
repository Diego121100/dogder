import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Button, Lead, Screen, Title } from '@/components/ui';
import { myDogSummary, MyDog } from '@/lib/discover';
import { photoUrl } from '@/lib/photos';
import { supabase } from '@/lib/supabase';
import { useSignup } from '@/lib/signup';
import { sexLabel } from '@/components/Choices';
import { fonts, radius, useColors } from '@/theme';

/** Mi perro (versión inicial): tu perfil y cerrar sesión. Editar el perfil llega en el siguiente paso. */
export default function MyDogTab() {
  const c = useColors();
  const { reset } = useSignup();
  const [dog, setDog] = useState<MyDog | null>(null);

  useEffect(() => {
    myDogSummary().then(setDog).catch(() => {});
  }, []);

  function logout() {
    Alert.alert('¿Cerrar sesión?', 'Podrás volver a entrar con tu correo y contraseña.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          reset();
          router.replace('/');
        },
      },
    ]);
  }

  return (
    <Screen>
      <Title>Mi perro</Title>
      {dog && (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
          {dog.foto ? <Image source={{ uri: photoUrl(dog.foto) }} style={styles.photo} contentFit="cover" /> : null}
          <View style={{ padding: 14, gap: 2 }}>
            <Text style={[styles.name, { color: c.ink }]}>{dog.nombre}</Text>
            {dog.sexo ? <Text style={{ fontFamily: fonts.bodyBold, color: c.muted }}>{sexLabel(dog.sexo)}</Text> : null}
          </View>
        </View>
      )}
      <Lead>Pronto podrás editar el perfil y las fotos, ver a quién bloqueaste y eliminar tu cuenta desde aquí.</Lead>
      <View style={{ flex: 1 }} />
      <Button title="Cerrar sesión" variant="secondary" onPress={logout} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  photo: { width: '100%', aspectRatio: 4 / 3 },
  name: { fontFamily: fonts.display, fontSize: 24 },
});
