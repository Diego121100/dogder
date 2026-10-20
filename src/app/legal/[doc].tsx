import { Fragment } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Lead, Screen, Title } from '@/components/ui';
import { Block, isLegalKey, LEGAL } from '@/content/legal';
import { useSignup } from '@/lib/signup';
import { fonts, radius, useColors } from '@/theme';

/** Normas de la comunidad, Términos y Condiciones y Aviso de Privacidad. */
export default function LegalScreen() {
  const c = useColors();
  const { doc, from } = useLocalSearchParams<{ doc: string; from?: string }>();
  const { draft, setDraft } = useSignup();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!isLegalKey(doc)) {
    return (
      <Screen>
        <Title>No encontramos este documento</Title>
        <Button title="Volver" onPress={close} />
      </Screen>
    );
  }

  const d = LEGAL[doc];
  const acceptNorms = doc === 'normas' && from === 'registro';

  // Resalta en verde los datos por completar: [Razón social], [Domicilio]...
  const rich = (text: string) =>
    text.split(/(\[[^\]]+\])/g).map((part, i) =>
      part.startsWith('[') ? (
        <Text key={i} style={{ backgroundColor: c.ball, color: c.ballInk, fontFamily: fonts.bodyBold }}>
          {part}
        </Text>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      ),
    );

  const block = (b: Block, i: number) =>
    typeof b === 'string' ? (
      <Text key={i} style={[styles.body, { color: c.muted }]}>{rich(b)}</Text>
    ) : (
      <View key={i} style={{ gap: 4 }}>
        {b.bullets.map((t, j) => (
          <View key={j} style={{ flexDirection: 'row', gap: 8 }}>
            <Text style={[styles.body, { color: c.muted }]}>•</Text>
            <Text style={[styles.body, { color: c.muted, flex: 1 }]}>{rich(t)}</Text>
          </View>
        ))}
      </View>
    );

  return (
    <Screen>
      <Pressable accessibilityRole="button" accessibilityLabel={`Cerrar ${d.title}`} onPress={close}
        style={[styles.back, { borderColor: c.line, backgroundColor: c.surface }]} hitSlop={6}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={c.ink} strokeWidth={2.5} strokeLinecap="round">
          <Path d="M15 5l-7 7 7 7" />
        </Svg>
      </Pressable>
      <Title>{d.title}</Title>
      <Lead>{d.lead}</Lead>

      {d.sections.map((s, i) =>
        d.cards ? (
          <View key={s.title} style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Text style={[styles.cardTitle, { color: c.ink }]}>{s.title}</Text>
            {s.body.map(block)}
          </View>
        ) : (
          <View key={s.title} style={{ gap: 6 }}>
            <Text style={[styles.h3, { color: c.ink }]}>
              <Text style={{ color: c.muted }}>{i + 1}. </Text>
              {s.title}
            </Text>
            {s.body.map(block)}
          </View>
        ),
      )}

      <Text style={[styles.body, { color: c.muted, fontSize: 13 }]}>
        Última actualización: {new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
      </Text>
      <Button
        title={acceptNorms ? 'Acepto las normas' : 'Entendido'}
        onPress={() => {
          if (acceptNorms) setDraft({ ...draft, accepted: true });
          close();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  body: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 23 },
  h3: { fontFamily: fonts.displaySemi, fontSize: 18, lineHeight: 23 },
  card: { borderWidth: 1, borderRadius: radius.md, padding: 14, gap: 4 },
  cardTitle: { fontFamily: fonts.displaySemi, fontSize: 17 },
});
