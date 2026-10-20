import { ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fonts, radius, space, useColors } from '@/theme';

/** Pantalla con scroll, márgenes seguros y teclado que no tapa los campos. */
export function Screen({ children, bg }: { children: ReactNode; bg?: string }) {
  const c = useColors();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg ?? c.bg }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.screen}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Logo({ color }: { color?: string }) {
  const c = useColors();
  return (
    <View style={styles.logoRow} accessibilityRole="header" accessibilityLabel="Dogder">
      <View style={[styles.ball, { backgroundColor: c.ball }]}>
        <View style={[styles.seam, { left: -19 }]} />
        <View style={[styles.seam, { right: -19 }]} />
      </View>
      <Text style={[styles.logoText, { color: color ?? c.ink }]}>Dogder</Text>
    </View>
  );
}

export function Title({ children, color }: { children: ReactNode; color?: string }) {
  const c = useColors();
  return <Text style={[styles.title, { color: color ?? c.ink }]}>{children}</Text>;
}

export function Lead({ children, color }: { children: ReactNode; color?: string }) {
  const c = useColors();
  return <Text style={[styles.lead, { color: color ?? c.muted }]}>{children}</Text>;
}

/** Barra de progreso del registro: Paso N de 4. */
export function Steps({ step, total, label }: { step: number; total: number; label: string }) {
  const c = useColors();
  return (
    <View style={{ gap: 8 }} accessibilityLabel={`Paso ${step} de ${total}: ${label}`}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[styles.stepBar, { backgroundColor: i < step ? c.ink : c.line }]} />
        ))}
      </View>
      <Text style={[styles.stepLabel, { color: c.muted }]}>
        Paso {step} de {total} · {label}
      </Text>
    </View>
  );
}

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ball' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

export function Button({ title, onPress, variant = 'primary', loading, disabled, style }: ButtonProps) {
  const c = useColors();
  const bg = { primary: c.ink, ball: c.ball, secondary: 'transparent', danger: c.coral }[variant];
  const fg = { primary: c.bg, ball: c.ballInk, secondary: c.ink, danger: '#FFFFFF' }[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: off ? 0.6 : pressed ? 0.85 : 1 },
        variant === 'secondary' && { borderWidth: 2, borderColor: c.ink },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function LinkButton({ title, onPress, color }: { title: string; onPress: () => void; color?: string }) {
  const c = useColors();
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8} style={{ alignSelf: 'center', padding: 4 }}>
      <Text style={[styles.link, { color: color ?? c.ink }]}>{title}</Text>
    </Pressable>
  );
}

export function ErrorText({ children }: { children?: string }) {
  const c = useColors();
  if (!children) return null;
  return (
    <Text style={[styles.error, { color: c.coral }]} accessibilityLiveRegion="polite">
      {children}
    </Text>
  );
}

type FieldProps = TextInputProps & { label: string; error?: string; help?: string; secret?: boolean };

/** Campo de texto con etiqueta, ayuda y error debajo. Con `secret` muestra el botón Mostrar/Ocultar. */
export function Field({ label, error, help, secret, style, ...input }: FieldProps) {
  const c = useColors();
  const [hidden, setHidden] = useState(true);
  return (
    <View style={{ gap: 5, flex: 1 }}>
      <Text style={[styles.label, { color: c.muted }]}>{label}</Text>
      <View>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={c.muted}
          secureTextEntry={secret ? hidden : undefined}
          style={[
            styles.input,
            { borderColor: error ? c.coral : c.line, backgroundColor: c.surface, color: c.ink },
            secret && { paddingRight: 84 },
            style,
          ]}
          {...input}
        />
        {secret && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Mostrar contraseña' : 'Ocultar contraseña'}
            onPress={() => setHidden((h) => !h)}
            style={styles.reveal}
            hitSlop={6}
          >
            <Text style={[styles.revealText, { color: c.muted }]}>{hidden ? 'Mostrar' : 'Ocultar'}</Text>
          </Pressable>
        )}
      </View>
      {help && !error ? <Text style={[styles.help, { color: c.muted }]}>{help}</Text> : null}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: space.sm }}>{children}</View>;
}

/** Aviso del modo de prueba mientras Supabase no está conectado. */
export function DemoBanner({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <View style={[styles.banner, { borderColor: c.coral, backgroundColor: c.surface }]}>
      <Text style={[styles.bannerTitle, { color: c.coral }]}>MODO DE PRUEBA</Text>
      <Text style={[styles.help, { color: c.muted }]}>{children}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flexGrow: 1, paddingHorizontal: 20, paddingVertical: space.lg, gap: space.lg },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ball: { width: 30, height: 30, borderRadius: 15, overflow: 'hidden' },
  seam: { position: 'absolute', top: 0, width: 30, height: 30, borderRadius: 15, borderWidth: 2.5, borderColor: '#FFFFFF' },
  logoText: { fontFamily: fonts.display, fontSize: 26, letterSpacing: -0.5 },
  title: { fontFamily: fonts.display, fontSize: 32, lineHeight: 34, letterSpacing: -0.6 },
  lead: { fontFamily: fonts.body, fontSize: 15.5, lineHeight: 23 },
  stepBar: { flex: 1, height: 5, borderRadius: 3 },
  stepLabel: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  button: { minHeight: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  buttonText: { fontFamily: fonts.bodyBold, fontSize: 16 },
  link: { fontFamily: fonts.bodyBold, fontSize: 14.5, textDecorationLine: 'underline' },
  label: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 12, fontFamily: fonts.body, fontSize: 16 },
  reveal: { position: 'absolute', right: 6, top: 0, bottom: 0, justifyContent: 'center', paddingHorizontal: 8 },
  revealText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  help: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  error: { fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 18 },
  banner: { borderWidth: 1.5, borderRadius: radius.md, padding: 12, gap: 4 },
  bannerTitle: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1 },
});
