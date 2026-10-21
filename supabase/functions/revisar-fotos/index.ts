// Dogder · revisar-fotos
// Revisa con OpenAI Moderation las fotos nuevas del perro de quien llama.
// Las que pasan quedan aprobadas (las ven los demás); las que no, se borran.
//
// Se configura en Supabase > Edge Functions (ver README, "Filtro de fotos").
// Necesita el secreto OPENAI_API_KEY. SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya vienen de fábrica.
import { createClient } from 'npm:@supabase/supabase-js@2';

// Categorías que hacen que una foto se rechace. "violence" sola no cuenta,
// para no rechazar perros jugando brusco.
const BLOQUEAR = ['sexual', 'violence/graphic', 'self-harm', 'self-harm/intent', 'self-harm/instructions'];

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  const url = Deno.env.get('SUPABASE_URL');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const openai = Deno.env.get('OPENAI_API_KEY');
  if (!url || !service) return json({ error: 'Faltan las claves de Supabase en la función' }, 500);
  if (!openai) return json({ error: 'Falta el secreto OPENAI_API_KEY' }, 500);

  const admin = createClient(url, service, { auth: { persistSession: false } });

  // ¿Quién llama? (con su sesión de la app)
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: u } = await admin.auth.getUser(token);
  if (!u?.user) return json({ error: 'Sin sesión' }, 401);

  const { data: perro } = await admin.from('perros').select('id').eq('dueno_id', u.user.id).maybeSingle();
  if (!perro) return json({ rechazadas: [] });

  const { data: fotos, error } = await admin.from('fotos').select('id, ruta').eq('perro_id', perro.id);
  if (error) return json({ error: error.message }, 500);
  const rutas = (fotos ?? []).map((f) => f.ruta);
  const { data: hechas } = await admin.from('fotos_revision').select('ruta').in('ruta', rutas.length ? rutas : ['-']);
  const yaRevisadas = new Set((hechas ?? []).map((h) => h.ruta));
  const pendientes = (fotos ?? []).filter((f) => !yaRevisadas.has(f.ruta));

  const rechazadas: string[] = [];
  for (const f of pendientes) {
    const externa = /^https?:/.test(f.ruta);
    const imageUrl = externa ? f.ruta : admin.storage.from('fotos').getPublicUrl(f.ruta).data.publicUrl;

    const r = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openai}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'omni-moderation-latest',
        input: [{ type: 'image_url', image_url: { url: imageUrl } }],
      }),
    });
    if (!r.ok) return json({ error: `OpenAI respondió ${r.status}: ${await r.text()}` }, 502);
    const result = (await r.json()).results?.[0];
    const motivos = BLOQUEAR.filter((c) => result?.categories?.[c]);
    const aprobada = motivos.length === 0;

    await admin.from('fotos_revision').upsert({ ruta: f.ruta, aprobada, motivo: motivos.join(', ') || null });
    if (!aprobada) {
      rechazadas.push(f.ruta);
      await admin.from('fotos').delete().eq('id', f.id);
      if (!externa) await admin.storage.from('fotos').remove([f.ruta]);
    }
  }

  return json({ rechazadas });
});
