import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { Button, Lead, Screen, Title } from '@/components/ui';
import { listReports, ModAction, ModReport, reactivate, resolveReport, suggestedWarning } from '@/lib/moderation';
import { photoUrl } from '@/lib/photos';
import { fonts, radius, useColors } from '@/theme';

function ago(iso: string) {
  const min = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} día${d === 1 ? '' : 's'}`;
}

const ACTION_NAMES: Record<ModAction, string> = {
  descartar: 'Descartado',
  advertir: 'Advertencia enviada',
  suspender: 'Cuenta suspendida',
};

type Pending = { report: ModReport; action: 'advertir' | 'suspender' };

/** Panel de moderación: solo lo ven las cuentas de la tabla "moderadores". */
export default function Moderation() {
  const c = useColors();
  const [tab, setTab] = useState<'pend' | 'done'>('pend');
  const [rows, setRows] = useState<ModReport[] | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<Pending | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    listReports(tab === 'pend')
      .then((r) => {
        setRows(r);
        setError(false);
      })
      .catch(() => setError(true));
  }, [tab]);
  useEffect(load, [load]);

  const switchTab = (t: 'pend' | 'done') => {
    if (t === tab) return;
    setRows(null);
    setTab(t);
  };

  function discard(r: ModReport) {
    Alert.alert('¿Descartar el reporte?', 'No se le avisa nada a la persona reportada.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Descartar',
        onPress: async () => {
          if (await resolveReport(r.id, 'descartar')) load();
          else Alert.alert('No se pudo guardar', 'Revisa tu conexión e inténtalo de nuevo.');
        },
      },
    ]);
  }

  function ask(report: ModReport, action: 'advertir' | 'suspender') {
    setNote(action === 'advertir' ? suggestedWarning(report.motivo) : report.motivo);
    setPending({ report, action });
  }

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    const ok = await resolveReport(pending.report.id, pending.action, note);
    setBusy(false);
    if (!ok) return Alert.alert('No se pudo guardar', 'Revisa tu conexión e inténtalo de nuevo.');
    setPending(null);
    load();
  }

  function unsuspend(r: ModReport) {
    if (!r.reportado) return;
    Alert.alert(`¿Reactivar a ${r.perro_nombre ?? 'esta cuenta'}?`, 'Podrá volver a usar la app y aparecer en Descubrir.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Reactivar',
        onPress: async () => {
          if (await reactivate(r.reportado!)) load();
          else Alert.alert('No se pudo reactivar', 'Revisa tu conexión e inténtalo de nuevo.');
        },
      },
    ]);
  }

  const seg = (t: 'pend' | 'done', label: string) => (
    <Pressable onPress={() => switchTab(t)} accessibilityRole="tab" accessibilityState={{ selected: tab === t }}
      style={[styles.segBtn, tab === t && { backgroundColor: c.ink }]}>
      <Text style={[styles.segText, { color: tab === t ? c.bg : c.ink }]}>{label}</Text>
    </Pressable>
  );

  return (
    <Screen>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Volver" hitSlop={6}
          style={[styles.back, { borderColor: c.line, backgroundColor: c.surface }]}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={c.ink} strokeWidth={2.5} strokeLinecap="round">
            <Path d="M15 5l-7 7 7 7" />
          </Svg>
        </Pressable>
        <Pressable onPress={() => { setRows(null); load(); }} accessibilityRole="button" hitSlop={8}>
          <Text style={[styles.link, { color: c.ink }]}>Actualizar</Text>
        </Pressable>
      </View>
      <Title>Moderación</Title>
      <Lead>Revisa cada reporte en menos de 24 horas. Solo tú y los demás moderadores ven esta pantalla.</Lead>

      <View style={[styles.seg, { borderColor: c.line, backgroundColor: c.surface }]} accessibilityRole="tablist">
        {seg('pend', tab === 'pend' && rows ? `Pendientes (${rows.length})` : 'Pendientes')}
        {seg('done', 'Resueltos')}
      </View>

      {error && <Lead>No se pudieron cargar los reportes. Revisa tu conexión y toca Actualizar.</Lead>}
      {!error && rows === null && <ActivityIndicator color={c.ink} />}
      {rows?.length === 0 && (
        <Lead>{tab === 'pend' ? '¡Todo al día! No hay reportes pendientes.' : 'Todavía no has resuelto reportes.'}</Lead>
      )}

      {rows?.map((r) => (
        <View key={r.id} style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
          <View style={styles.head}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.dog, { color: c.ink }]}>{r.perro_nombre ?? 'Cuenta eliminada'}</Text>
              {r.dueno ? <Text style={[styles.small, { color: c.muted }]}>{r.dueno}{r.email ? ` · ${r.email}` : ''}</Text> : null}
            </View>
            {r.suspendida && (
              <View style={[styles.tag, { backgroundColor: c.coral }]}>
                <Text style={[styles.tagText, { color: '#fff' }]}>Suspendida</Text>
              </View>
            )}
          </View>

          {r.fotos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {r.fotos.map((f) => (
                <Image key={f} source={{ uri: photoUrl(f) }} style={styles.photo} contentFit="cover" />
              ))}
            </ScrollView>
          )}
          {r.perro_bio ? <Text style={[styles.small, { color: c.muted }]} numberOfLines={3}>{r.perro_bio}</Text> : null}

          <View style={[styles.reason, { backgroundColor: c.bg }]}>
            <Text style={[styles.reasonTitle, { color: c.ink }]}>{r.motivo}</Text>
            {r.detalles ? <Text style={[styles.body, { color: c.ink }]}>“{r.detalles}”</Text> : null}
            <Text style={[styles.small, { color: c.muted }]}>
              Reportado por {r.reportador_perro ?? 'una cuenta eliminada'} · {ago(r.creado)}
            </Text>
            {r.total_reportes > 1 && (
              <Text style={[styles.small, { color: c.coral, fontFamily: fonts.bodyBold }]}>
                {r.total_reportes} reportes en total contra esta cuenta
              </Text>
            )}
          </View>

          {r.mensajes.length > 0 && (
            <View style={{ gap: 6 }}>
              <Pressable onPress={() => setOpen((o) => ({ ...o, [r.id]: !o[r.id] }))} accessibilityRole="button">
                <Text style={[styles.link, { color: c.ink }]}>
                  {open[r.id] ? 'Ocultar conversación' : `Ver conversación (${r.mensajes.length} mensajes)`}
                </Text>
              </Pressable>
              {open[r.id] &&
                r.mensajes.map((m, i) => (
                  <View key={i} style={[styles.bubble, m.de_reportado
                    ? { alignSelf: 'flex-start', backgroundColor: c.bg, borderColor: c.coral }
                    : { alignSelf: 'flex-end', backgroundColor: c.bg, borderColor: c.line }]}>
                    <Text style={[styles.who, { color: m.de_reportado ? c.coral : c.muted }]}>
                      {m.de_reportado ? r.perro_nombre ?? 'Reportado' : r.reportador_perro ?? 'Quien reportó'}
                    </Text>
                    <Text style={[styles.body, { color: c.ink }]}>{m.texto}</Text>
                  </View>
                ))}
            </View>
          )}

          {tab === 'pend' ? (
            <View style={styles.actions}>
              <Pressable onPress={() => discard(r)} accessibilityRole="button" style={[styles.act, { borderColor: c.line }]}>
                <Text style={[styles.actText, { color: c.ink }]}>Descartar</Text>
              </Pressable>
              <Pressable onPress={() => ask(r, 'advertir')} accessibilityRole="button" style={[styles.act, { borderColor: c.ink }]}>
                <Text style={[styles.actText, { color: c.ink }]}>Advertir</Text>
              </Pressable>
              <Pressable onPress={() => ask(r, 'suspender')} accessibilityRole="button"
                style={[styles.act, { borderColor: c.coral, backgroundColor: c.coral }]}>
                <Text style={[styles.actText, { color: '#fff' }]}>Suspender</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 6 }}>
              <Text style={[styles.reasonTitle, { color: c.ink }]}>
                {r.accion ? ACTION_NAMES[r.accion] : 'Revisado'}
                {r.resuelto ? <Text style={[styles.small, { color: c.muted }]}>  · {ago(r.resuelto)}</Text> : null}
              </Text>
              {r.nota ? <Text style={[styles.small, { color: c.muted }]}>{r.nota}</Text> : null}
              {r.suspendida && r.reportado && (
                <Button title="Reactivar cuenta" variant="secondary" onPress={() => unsuspend(r)} />
              )}
            </View>
          )}
        </View>
      ))}

      <Modal visible={!!pending} transparent animationType="slide" onRequestClose={() => setPending(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPending(null)} accessibilityLabel="Cerrar" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: c.surface }]}>
            {pending && (
              <View style={{ gap: 12 }}>
                <Text style={[styles.sheetTitle, { color: c.ink }]}>
                  {pending.action === 'advertir'
                    ? `Advertir a ${pending.report.perro_nombre ?? 'esta cuenta'}`
                    : `¿Suspender a ${pending.report.perro_nombre ?? 'esta cuenta'}?`}
                </Text>
                <Text style={[styles.small, { color: c.muted, fontSize: 14 }]}>
                  {pending.action === 'advertir'
                    ? 'La persona verá este mensaje la próxima vez que abra la app.'
                    : 'Ya no podrá usar la app ni aparecer en Descubrir. Verá este motivo en su pantalla. Se cierran también sus demás reportes pendientes.'}
                </Text>
                <TextInput
                  value={note}
                  onChangeText={(t) => setNote(t.slice(0, 500))}
                  multiline
                  accessibilityLabel={pending.action === 'advertir' ? 'Mensaje de advertencia' : 'Motivo de la suspensión'}
                  style={[styles.input, { borderColor: c.line, backgroundColor: c.bg, color: c.ink }]}
                />
                <Button
                  title={pending.action === 'advertir' ? 'Enviar advertencia' : 'Suspender cuenta'}
                  variant={pending.action === 'advertir' ? 'primary' : 'danger'}
                  loading={busy}
                  onPress={confirm}
                />
                <Button title="Cancelar" variant="secondary" onPress={() => setPending(null)} />
              </View>
            )}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  link: { fontFamily: fonts.bodyBold, fontSize: 14, textDecorationLine: 'underline' },
  seg: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.pill, padding: 3 },
  segBtn: { flex: 1, borderRadius: radius.pill, paddingVertical: 9, alignItems: 'center' },
  segText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: 14, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  dog: { fontFamily: fonts.display, fontSize: 22 },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  body: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 20 },
  tag: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  photo: { width: 84, height: 84, borderRadius: 12 },
  reason: { borderRadius: radius.md, padding: 12, gap: 4 },
  reasonTitle: { fontFamily: fonts.bodyBold, fontSize: 15 },
  bubble: { maxWidth: '85%', borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  who: { fontFamily: fonts.bodyBold, fontSize: 11.5 },
  actions: { flexDirection: 'row', gap: 8 },
  act: { flex: 1, borderWidth: 1.5, borderRadius: radius.sm, paddingVertical: 11, alignItems: 'center' },
  actText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: 'rgba(10,14,22,0.55)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  sheetTitle: { fontFamily: fonts.display, fontSize: 22 },
  input: { borderWidth: 1, borderRadius: radius.sm, padding: 12, minHeight: 100, fontFamily: fonts.body, fontSize: 15, textAlignVertical: 'top' },
});
