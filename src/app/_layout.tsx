import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  NunitoSans_400Regular,
  NunitoSans_600SemiBold,
  NunitoSans_800ExtraBold,
} from '@expo-google-fonts/nunito-sans';
import { useColors } from '@/theme';
import { SignupProvider } from '@/lib/signup';

export default function RootLayout() {
  const c = useColors();
  const [loaded] = useFonts({
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_800ExtraBold,
    NunitoSans_400Regular,
    NunitoSans_600SemiBold,
    NunitoSans_800ExtraBold,
  });

  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SignupProvider>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="registro/cuenta" />
            <Stack.Screen name="registro/verificar" />
            <Stack.Screen name="registro/perro" options={{ gestureEnabled: false }} />
            <Stack.Screen name="ubicacion" options={{ gestureEnabled: false }} />
            <Stack.Screen name="registro/listo" options={{ gestureEnabled: false }} />
            <Stack.Screen name="inicio" options={{ gestureEnabled: false }} />
            <Stack.Screen name="(tabs)" options={{ gestureEnabled: false, animation: 'fade' }} />
            <Stack.Screen name="chat/[id]" />
            <Stack.Screen name="editar-perro" options={{ presentation: 'modal' }} />
            <Stack.Screen name="bloqueados" />
            <Stack.Screen name="eliminar-cuenta" options={{ presentation: 'modal' }} />
            <Stack.Screen name="perro/[id]" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="legal/[doc]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="moderacion" />
            <Stack.Screen name="suspendida" options={{ gestureEnabled: false, animation: 'fade' }} />
          </Stack>
        </SignupProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
