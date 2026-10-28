// Acesso ao Supabase: login, leitura e gravação. As permissões são conferidas pelo banco (supabase/schema.sql).
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.87.2/+esm';
import { diseaseFromRow, diseaseToRow } from './util.js';

const cfg = window.TEUVET_CONFIG || {};
export const configured = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && !String(cfg.supabaseUrl).includes('COLE'));
export const sb = configured ? createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' } }) : null;

const ok = ({ data, error }) => { if (error) throw error; return data; };
const appUrl = () => location.origin + location.pathname;

/* ---------- Login ---------- */
export const getSession = async () => ok(await sb.auth.getSession()).session;
export const onAuth = fn => sb.auth.onAuthStateChange((event, session) => fn(event, session));
export const signIn = (email, password) => sb.auth.signInWithPassword({ email, password }).then(ok);
export const signUp = (name, email, password) => sb.auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: appUrl() } }).then(ok);
export const sendReset = email => sb.auth.resetPasswordForEmail(email, { redirectTo: appUrl() }).then(ok);
export const setPassword = password => sb.auth.updateUser({ password }).then(ok);
export const signOut = () => sb.auth.signOut();

/* ---------- Leituras ---------- */
export async function loadProfile(uid) {
  return ok(await sb.from('profiles').select('id,name,email,role').eq('id', uid).maybeSingle());
}
export async function loadConfig() {
  const r = ok(await sb.from('app_config').select('editors_publish').eq('id', 1).maybeSingle());
  return { editorsPublish: r ? !!r.editors_publish : true };
}
export async function loadSpecies() {
  const rows = ok(await sb.from('species').select('*').order('sort_order'));
  const out = {};
  rows.forEach(r => { out[r.id] = { id: r.id, name: r.name, scientific: r.scientific || '', category: r.category, parent: r.parent_id, order: r.sort_order || 0, chars: r.chars || {}, updatedAt: r.updated_at, updatedBy: r.updated_by }; });
  return out;
}
export async function loadDiseases() {
  const rows = ok(await sb.from('diseases').select('*, disease_species(species_id, content)'));
  const out = {};
  rows.forEach(r => { out[r.id] = diseaseFromRow(r); });
  return out;
}
export async function loadFavorites() {
  return ok(await sb.from('favorites').select('disease_id').order('created_at', { ascending: false })).map(r => r.disease_id);
}
export async function loadRecent() {
  return ok(await sb.from('recent_views').select('disease_id').order('viewed_at', { ascending: false }).limit(20)).map(r => r.disease_id);
}
export async function loadSuggestions() {
  return ok(await sb.from('suggestions').select('*').order('created_at', { ascending: false }).limit(300));
}
export async function loadProfiles() {
  return ok(await sb.from('profiles').select('id,name,email,role,created_at').order('created_at'));
}
export async function profileNames(ids) {
  const rows = ok(await sb.rpc('profile_names', { ids }));
  const out = {}; (rows || []).forEach(r => { out[r.id] = r.name; }); return out;
}
export async function loadHistory(diseaseId) {
  return ok(await sb.from('disease_versions').select('id,label,snapshot,created_by,created_at').eq('disease_id', diseaseId).order('created_at', { ascending: false }).limit(25));
}

/* ---------- Ao vivo: avisa quando outra pessoa altera algo ---------- */
export function watch(onChange) {
  let t = null;
  const fire = table => { clearTimeout(t); t = setTimeout(() => onChange(table), 400); };
  return sb.channel('teuvet-conteudo')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'species' }, () => fire('species'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'diseases' }, () => fire('diseases'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'disease_species' }, () => fire('diseases'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'app_config' }, () => fire('config'))
    .subscribe();
}

/* ---------- Patologias ---------- */
// Grava patologia + conteúdo por espécie. Devolve o status final (o banco pode trocar para "Em revisão").
export async function saveDisease(d) {
  const { row, species } = diseaseToRow(d);
  const saved = ok(await sb.from('diseases').upsert(row).select('status,created_at,created_by,updated_at,updated_by').single());
  if (species.length) ok(await sb.from('disease_species').upsert(species));
  let del = sb.from('disease_species').delete().eq('disease_id', d.id);
  if (species.length) del = del.not('species_id', 'in', '(' + species.map(s => '"' + String(s.species_id).replace(/"/g, '') + '"').join(',') + ')');
  ok(await del);
  return saved;
}
export async function addVersion(diseaseId, label, snapshot) {
  ok(await sb.from('disease_versions').insert({ disease_id: diseaseId, label, snapshot }));
  // mantém as 25 versões mais recentes
  const old = ok(await sb.from('disease_versions').select('id').eq('disease_id', diseaseId).order('created_at', { ascending: false }).range(25, 200));
  if (old.length) ok(await sb.from('disease_versions').delete().in('id', old.map(x => x.id)));
}
export async function setDiseaseStatus(id, status) {
  return ok(await sb.from('diseases').update({ status }).eq('id', id).select('status').single());
}
export async function deleteDisease(id) { ok(await sb.from('diseases').delete().eq('id', id)); }

/* ---------- Espécies ---------- */
export async function addSpecies(s) {
  ok(await sb.from('species').insert({ name: s.name, scientific: s.scientific || '', category: s.category, parent_id: s.parent || null, sort_order: s.order || 0 }));
}
export async function updateSpecies(id, patch) {
  const row = {};
  if ('name' in patch) row.name = patch.name;
  if ('scientific' in patch) row.scientific = patch.scientific;
  if ('order' in patch) row.sort_order = patch.order;
  if ('chars' in patch) row.chars = patch.chars;
  ok(await sb.from('species').update(row).eq('id', id));
}
export async function deleteSpecies(id) { ok(await sb.from('species').delete().eq('id', id)); }

/* ---------- Usuário ---------- */
export async function toggleFavorite(uid, diseaseId, on) {
  if (on) ok(await sb.from('favorites').upsert({ user_id: uid, disease_id: diseaseId }));
  else ok(await sb.from('favorites').delete().eq('user_id', uid).eq('disease_id', diseaseId));
}
export async function markViewed(uid, diseaseId) {
  ok(await sb.from('recent_views').upsert({ user_id: uid, disease_id: diseaseId, viewed_at: new Date().toISOString() }));
}
export async function sendSuggestion(s) {
  ok(await sb.from('suggestions').insert({ disease_id: s.diseaseId, species_id: s.sp || null, kind: s.kind, text: s.text }));
}
export async function setSuggestionStatus(id, status) { ok(await sb.from('suggestions').update({ status }).eq('id', id)); }
export async function updateMyName(uid, name) { ok(await sb.from('profiles').update({ name }).eq('id', uid)); }
export async function setRole(uid, role) { ok(await sb.from('profiles').update({ role }).eq('id', uid)); }
export async function setEditorsPublish(v) { ok(await sb.from('app_config').update({ editors_publish: v, updated_at: new Date().toISOString() }).eq('id', 1)); }

/* ---------- Mensagens de erro em português ---------- */
export function errMsg(err) {
  const m = String((err && (err.message || err.error_description)) || err || '');
  const c = err && err.code;
  if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if (/User already registered/i.test(m)) return 'Já existe uma conta com esse e-mail. Use “Entrar” ou “Esqueci minha senha”.';
  if (/Password should be/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/rate limit|too many/i.test(m)) return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.';
  if (c === '23503') return 'Este item está ligado a outros cadastros e não pode ser excluído.';
  if (c === '42501' || /row-level security|permission/i.test(m)) return 'Sua conta não tem permissão para isso.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Sem conexão. Verifique a internet e tente de novo.';
  if (/Criador/.test(m)) return m;
  return 'Algo deu errado: ' + m;
}
