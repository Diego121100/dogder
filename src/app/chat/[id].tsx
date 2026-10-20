import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { fetchMessages, listMatches, markRead, MatchRow, Message, myUserId, sendMessage, useRealtime } from '@/lib/chat';
import { photoUrl } from '@/lib/photos';
import { SafetySheet } from '@/components/SafetySheet';
import { fonts, radius, useColors } from '@/theme';

const MAX = 1000;

/** Conversación de un match, con mensajes que llegan al instante. */
export default function Chat() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [text, setText] = useState('');
  const [sendError, setSendError] = useState('');
  const list = useRef<FlatList<Message>>(null);
  const [safety, setSafety] = useState(false);

  const load = useCallback(() => {
    Promise.all([fetchMessages(id), myUserId()])
      .then(([msgs, uid]) => {
        setMessages((prev) => {
          // Conserva los que se están enviando y aún no confirma el servidor.
          const pending = prev.filter((m) => m.pending && !msgs.some((x) => x.texto === m.texto && x.autor_id === m.autor_id));
          return [...msgs, ...pending];
        });
        setMe(uid);
        setStatus('ready');
        markRead(id);
      })
      .catch(() => setStatus('error'));
  }, [id]);

  useEffect(() => {
    listMatches()
      .then((rows) => setMatch(rows.find((r) => r.match_id === id) ?? null))
      .catch(() => {});
    load();
  }, [id, load]);
  useRealtime(load, id);

  async function send() {
    const t = text.trim();
    if (!t || !me) return;
    setText('');
    setSendError('');
    const temp: Message = { id: `tmp-${Date.now()}`, match_id: id, autor_id: me, texto: t, creado: new Date().toISOString(), pending: true };
    setMessages((m) => [...m, temp]);
    try {
      const saved = await sendMessage(id, me, t);
      setMessages((m) => {
        const without = m.filter((x) => x.id !== temp.id);
        return without.some((x) => x.id === saved.id) ? without : [...without, saved];
      });
    } catch {
      setMessages((m) => m.filter((x) => x.id !== temp.id));
      setText(t);
      setSendError('No se envió. Revisa tu conexión e inténtalo de nuevo.');
    }
  }

  const sorted = [...messages].sort((a, b) => a.creado.localeCompare(b.creado));
  const dayLabel = (iso: string) =>
    new Date(iso).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: c.line }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/matches'))} accessibilityRole="button"
          accessibilityLabel="Volver a Matches" hitSlop={8} style={[styles.back, { borderColor: c.line, backgroundColor: c.surface }]}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={c.ink} strokeWidth={2.5} strokeLinecap="round">
            <Path d="M15 5l-7 7 7 7" />
          </Svg>
        </Pressable>
        <View style={[styles.av, { backgroundColor: c.surface }]}>
          {match?.foto ? <Image source={{ uri: photoUrl(match.foto) }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.name, { color: c.ink }]} numberOfLines={1}>{match?.nombre ?? ' '}</Text>
          <Text style={[styles.sub, { color: c.muted }]} numberOfLines={1}>
            {match ? `con ${match.dueno_nombre} · ${match.colonia}` : ' '}
          </Text>
        </View>
        <Pressable onPress={() => setSafety(true)} disabled={!match} accessibilityRole="button" accessibilityLabel="Opciones: reportar o bloquear"
          hitSlop={8} style={[styles.back, { borderColor: c.line, backgroundColor: c.surface }]}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill={c.ink}>
            <Path d="M5 10a2 2 0 110 4 2 2 0 010-4zm7 0a2 2 0 110 4 2 2 0 010-4zm7 0a2 2 0 110 4 2 2 0 010-4z" />
          </Svg>
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {status === 'loading' ? (
          <ActivityIndicator color={c.ink} style={{ flex: 1 }} />
        ) : status === 'error' ? (
          <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
            <Text style={[styles.sys, { color: c.muted }]}>No pudimos cargar la conversación. Revisa tu conexión.</Text>
          </View>
        ) : (
          <FlatList
            ref={list}
            data={sorted}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: 16, gap: 6, flexGrow: 1, justifyContent: sorted.length ? 'flex-end' : 'center' }}
            onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <Text style={[styles.sys, { color: c.muted }]}>
                {match
                  ? `${match.super_recibido ? `${match.nombre} te mandó un súper hueso e hicieron match` : match.super_enviado ? `Le mandaste un súper hueso a ${match.nombre} e hicieron match` : `Hiciste match con ${match.nombre}`} el ${dayLabel(match.creado)}. ¡Saluda a ${match.nombre}!`
                  : 'Hiciste match. ¡Saluda!'}
              </Text>
            }
            renderItem={({ item: m }) => {
              const mine = m.autor_id === me;
              return (
                <View style={[styles.bubble, mine
                  ? { alignSelf: 'flex-end', backgroundColor: c.ink, borderBottomRightRadius: 6 }
                  : { alignSelf: 'flex-start', backgroundColor: c.surface, borderColor: c.line, borderWidth: 1, borderBottomLeftRadius: 6 },
                  m.pending && { opacity: 0.6 }]}>
                  <Text style={[styles.msg, { color: mine ? c.bg : c.ink }]}>{m.texto}</Text>
                  <Text style={[styles.time, { color: mine ? c.bg : c.muted }]}>
                    {m.pending ? 'Enviando…' : new Date(m.creado).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              );
            }}
          />
        )}

        {sendError ? <Text style={[styles.err, { color: c.coral }]}>{sendError}</Text> : null}
        <View style={styles.composer}>
          <TextInput
            value={text}
            onChangeText={(t) => setText(t.slice(0, MAX))}
            placeholder="Escribe un mensaje…"
            placeholderTextColor={c.muted}
            multiline
            accessibilityLabel="Mensaje"
            style={[styles.input, { borderColor: c.line, backgroundColor: c.surface, color: c.ink }]}
          />
          <Pressable onPress={send} disabled={!text.trim()} accessibilityRole="button" accessibilityLabel="Enviar"
            style={[styles.send, { backgroundColor: c.ball, opacity: text.trim() ? 1 : 0.5 }]}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={c.ballInk} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M5 12h14M13 6l6 6-6 6" />
            </Svg>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      {match && (
        <SafetySheet
          dogId={match.perro_id}
          dogName={match.nombre}
          visible={safety}
          onClose={() => setSafety(false)}
          onBlocked={() => {
            Alert.alert(`Bloqueaste a ${match.nombre}`, 'Ya no se verán entre ustedes.');
            router.replace('/matches');
          }}
          onReported={(blocked) => {
            Alert.alert('Gracias por avisarnos', blocked
              ? `Revisaremos tu reporte. También bloqueamos a ${match.nombre}.`
              : 'Revisaremos tu reporte lo antes posible.');
            if (blocked) router.replace('/matches');
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  av: { width: 42, height: 42, borderRadius: 21, overflow: 'hidden' },
  name: { fontFamily: fonts.bodyBold, fontSize: 16 },
  sub: { fontFamily: fonts.body, fontSize: 13 },
  sys: { fontFamily: fonts.body, fontSize: 13, textAlign: 'center', alignSelf: 'center', maxWidth: 280, lineHeight: 19, marginBottom: 10 },
  bubble: { maxWidth: '80%', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8 },
  msg: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21 },
  time: { fontFamily: fonts.body, fontSize: 10.5, opacity: 0.7, marginTop: 2, alignSelf: 'flex-end' },
  err: { fontFamily: fonts.bodyBold, fontSize: 13, paddingHorizontal: 16 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontFamily: fonts.body, fontSize: 15.5, maxHeight: 120 },
  send: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});
