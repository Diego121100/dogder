import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Button } from '@/components/ui';
import { listMatches, markMatchesSeen, MatchRow, myUserId, shortTime, useRealtime } from '@/lib/chat';
import { photoUrl } from '@/lib/photos';
import { BoneIcon, PawIcon } from '@/components/ActionBar';
import { PlusBadge } from '@/components/PlusPrompt';
import { myPlan, Plan } from '@/lib/plan';
import { fonts, useColors } from '@/theme';

/** Matches: arriba los nuevos (sin mensajes), abajo las conversaciones. */
export default function Matches() {
  const c = useColors();
  const [rows, setRows] = useState<MatchRow[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);

  const load = useCallback(() => {
    myPlan().then(setPlan).catch(() => {});
    Promise.all([listMatches(), myUserId()])
      .then(([r, id]) => {
        setRows(r);
        setMe(id);
        setStatus('ready');
        // Ya los viste: el aviso de la pestaña se apaga para estos matches.
        if (r.some((m) => !m.visto)) markMatchesSeen();
      })
      .catch(() => setStatus('error'))
      .finally(() => setRefreshing(false));
  }, []);

  useFocusEffect(load);
  useRealtime(load);

  const fresh = rows.filter((r) => !r.ultimo_texto);
  const convos = rows.filter((r) => r.ultimo_texto);
  const open = (r: MatchRow) => router.push({ pathname: '/chat/[id]', params: { id: r.match_id } });

  const avatar = (foto: string | null, size: number, ring?: string) => (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: c.surface,
      borderWidth: ring ? 3 : 0, borderColor: ring }}>
      {foto ? <Image source={{ uri: photoUrl(foto) }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <Text style={[styles.title, { color: c.ink }]} accessibilityRole="header">Matches</Text>
      {!!plan?.likesRecibidos && (
        <Pressable onPress={() => router.push('/likes')} accessibilityRole="button"
          style={({ pressed }) => [styles.likes, { backgroundColor: c.surface, borderColor: c.ball, opacity: pressed ? 0.7 : 1 }]}>
          <View style={[styles.likesIcon, { backgroundColor: c.ball }]}>
            <PawIcon color={c.ballInk} size={22} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.likesTitle, { color: c.ink }]}>
              {plan.likesRecibidos === 1 ? 'A 1 perro le gusta el tuyo' : `A ${plan.likesRecibidos} perros les gusta el tuyo`}
            </Text>
            <Text style={[styles.likesSub, { color: c.muted }]}>
              {plan.plus ? 'Míralos y haz match al instante' : 'Descubre quiénes son con Dogder Plus'}
            </Text>
          </View>
          {!plan.plus && <PlusBadge small />}
        </Pressable>
      )}

      {status === 'loading' && <ActivityIndicator color={c.ink} style={{ marginTop: 40 }} />}
      {status === 'error' && (
        <View style={styles.empty}>
          <Text style={[styles.hint, { color: c.muted }]}>No pudimos cargar tus matches. Revisa tu conexión a internet.</Text>
          <Button title="Intentar de nuevo" onPress={load} />
        </View>
      )}
      {status === 'ready' && rows.length === 0 && (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: c.ink }]}>Todavía no tienes matches</Text>
          <Text style={[styles.hint, { color: c.muted }]}>
            Da me gusta a los perros que te gusten en Descubrir. Si a su dueño también le gusta tu perro, aparecerán aquí
            para que platiquen y organicen un paseo.
          </Text>
          <Button title="Ir a Descubrir" variant="secondary" onPress={() => router.navigate('/descubrir')} />
        </View>
      )}

      {status === 'ready' && rows.length > 0 && (
        <FlatList
          data={convos}
          keyExtractor={(r) => r.match_id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={c.ink} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          ListHeaderComponent={
            <>
              {fresh.length > 0 && (
                <>
                  <Text style={[styles.label, { color: c.muted }]}>Nuevos · {fresh.length}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 6 }}>
                    {fresh.map((r) => (
                      <Pressable key={r.match_id} onPress={() => open(r)} accessibilityRole="button"
                        accessibilityLabel={`Nuevo match: ${r.nombre}.${r.super_recibido ? ' Te mandó un súper hueso.' : ''} Toca para enviarle un mensaje`} style={styles.fresh}>
                        <View>
                          {avatar(r.foto, 72, r.super_recibido ? c.sky : c.ball)}
                          {r.super_recibido && (
                            <View style={[styles.boneBadge, { backgroundColor: c.sky, borderColor: c.bg }]}>
                              <BoneIcon color="#FFFFFF" size={13} />
                            </View>
                          )}
                        </View>
                        <Text style={[styles.freshName, { color: c.ink }]} numberOfLines={1}>{r.nombre}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </>
              )}
              <Text style={[styles.label, { color: c.muted }]}>Mensajes</Text>
              {convos.length === 0 && (
                <Text style={[styles.hint, { color: c.muted }]}>Toca un match nuevo para empezar la conversación.</Text>
              )}
            </>
          }
          renderItem={({ item: r }) => (
            <Pressable onPress={() => open(r)} accessibilityRole="button"
              accessibilityLabel={`${r.nombre}, con ${r.dueno_nombre}. ${r.sin_leer ? `${r.sin_leer} mensajes sin leer` : ''}`}
              style={({ pressed }) => [styles.row, { borderBottomColor: c.line, opacity: pressed ? 0.7 : 1 }]}>
              {avatar(r.foto, 56)}
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={[styles.name, { color: c.ink }]} numberOfLines={1}>
                    {r.nombre} <Text style={{ fontFamily: fonts.bodySemi, color: c.muted }}>· {r.dueno_nombre}</Text>
                  </Text>
                  {r.ultimo_creado && <Text style={[styles.time, { color: c.muted }]}>{shortTime(r.ultimo_creado)}</Text>}
                </View>
                {(r.super_recibido || r.super_enviado) && (
                  <View style={[styles.superTag, { backgroundColor: c.sky }]}>
                    <BoneIcon color="#FFFFFF" size={11} />
                    <Text style={styles.superTagText}>
                      {r.super_recibido ? 'Te mandó un súper hueso' : 'Le mandaste un súper hueso'}
                    </Text>
                  </View>
                )}
                <Text style={[styles.last, { color: r.sin_leer ? c.ink : c.muted, fontFamily: r.sin_leer ? fonts.bodyBold : fonts.body }]}
                  numberOfLines={1}>
                  {r.ultimo_autor === me ? 'Tú: ' : ''}{r.ultimo_texto}
                </Text>
              </View>
              {r.sin_leer > 0 && (
                <View style={[styles.unread, { backgroundColor: c.coral }]}>
                  <Text style={styles.unreadText}>{r.sin_leer}</Text>
                </View>
              )}
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  likes: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 8, borderWidth: 2, borderRadius: 16, padding: 12 },
  likesIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  likesTitle: { fontFamily: fonts.bodyBold, fontSize: 15 },
  likesSub: { fontFamily: fonts.body, fontSize: 13 },
  title: { fontFamily: fonts.display, fontSize: 28, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  label: { fontFamily: fonts.bodyBold, fontSize: 11.5, letterSpacing: 1, textTransform: 'uppercase', marginTop: 16, marginBottom: 10 },
  fresh: { width: 78, alignItems: 'center', gap: 5 },
  freshName: { fontFamily: fonts.bodyBold, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  name: { fontFamily: fonts.bodyBold, fontSize: 16, flexShrink: 1 },
  time: { fontFamily: fonts.body, fontSize: 12.5 },
  last: { fontSize: 14.5, marginTop: 2 },
  boneBadge: { position: 'absolute', right: -2, bottom: 2, width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  superTag: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginTop: 3 },
  superTagText: { color: '#FFFFFF', fontFamily: fonts.bodyBold, fontSize: 11 },
  unread: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadText: { color: '#FFFFFF', fontFamily: fonts.bodyBold, fontSize: 12 },
  empty: { flex: 1, padding: 24, gap: 14, justifyContent: 'center' },
  emptyTitle: { fontFamily: fonts.display, fontSize: 22 },
  hint: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
});
