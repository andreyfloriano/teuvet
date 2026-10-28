// Supabase falso, em memória, só para testar as telas no navegador (tests/e2e/smoke.py).
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()));
const now = () => new Date().toISOString();
const DB = {
  profiles: [{ id: 'u-criador', name: 'Criador Teste', email: 'criador@teste.com', role: 'criador', created_at: now() }],
  app_config: [{ id: 1, editors_publish: true }],
  species: [
    { id: 'caes', name: 'Cães', scientific: 'Canis lupus familiaris', category: 'pequenos', parent_id: null, sort_order: 10, chars: {} },
    { id: 'gatos', name: 'Gatos', scientific: 'Felis catus', category: 'pequenos', parent_id: null, sort_order: 20, chars: {} },
    { id: 'peqrum', name: 'Pequenos ruminantes', scientific: '', category: 'grandes', parent_id: null, sort_order: 40, chars: {} },
    { id: 'ovinos', name: 'Ovinos', scientific: 'Ovis aries', category: 'grandes', parent_id: 'peqrum', sort_order: 10, chars: {} }
  ],
  diseases: [], disease_species: [], disease_versions: [], suggestions: [], favorites: [], recent_views: []
};
window.__DB = DB;
let session = null; const listeners = [];
const emit = (ev, s) => listeners.forEach(fn => fn(ev, s));

class Q {
  constructor(t) { this.t = t; this.op = 'select'; this.filters = []; this.ord = null; this.lim = null; this.rng = null; this.one = null; this.payload = null; this.ret = false; }
  select(cols) { if (this.op === 'select') this.cols = cols; else this.ret = true; return this; }
  eq(c, v) { this.filters.push(r => r[c] === v); return this; }
  in(c, vs) { this.filters.push(r => vs.includes(r[c])); return this; }
  not(c, op, list) { const vs = list.replace(/[()"]/g, '').split(','); this.filters.push(r => !vs.includes(r[c])); return this; }
  order(c, o = {}) { this.ord = [c, o.ascending !== false]; return this; }
  limit(n) { this.lim = n; return this; }
  range(a, b) { this.rng = [a, b]; return this; }
  maybeSingle() { this.one = 'maybe'; return this; }
  single() { this.one = 'single'; return this; }
  insert(p) { this.op = 'insert'; this.payload = [].concat(p); return this; }
  upsert(p) { this.op = 'upsert'; this.payload = [].concat(p); return this; }
  update(p) { this.op = 'update'; this.payload = p; return this; }
  delete() { this.op = 'delete'; return this; }
  then(res, rej) { try { return Promise.resolve(this.run()).then(res, rej); } catch (e) { return Promise.resolve({ data: null, error: e }).then(res, rej); } }
  key(r) { return this.t === 'disease_species' ? r.disease_id + '|' + r.species_id : this.t === 'favorites' || this.t === 'recent_views' ? r.user_id + '|' + r.disease_id : r.id; }
  run() {
    const T = DB[this.t]; let rows;
    if (this.op === 'insert' || this.op === 'upsert') {
      rows = this.payload.map(p => {
        const r = Object.assign({}, p);
        if (!r.id && !['disease_species', 'favorites', 'recent_views'].includes(this.t)) r.id = this.t === 'species' ? 'sp' + uid().slice(0, 8) : uid();
        if (this.t === 'diseases') { r.updated_at = now(); r.updated_by = session && session.user.id; }
        if (this.t === 'suggestions') { r.created_by = session.user.id; r.created_at = now(); r.status = 'aberta'; }
        if (this.t === 'disease_versions') { r.created_by = session.user.id; r.created_at = now(); }
        const i = T.findIndex(x => this.key(x) === this.key(r));
        if (i >= 0 && this.op === 'upsert') { T[i] = Object.assign({}, T[i], r); return T[i]; }
        if (i >= 0) throw { message: 'duplicate', code: '23505' };
        if (this.t === 'diseases') r.created_at = now();
        T.push(r); return r;
      });
    } else {
      rows = T.filter(r => this.filters.every(f => f(r)));
      if (this.op === 'update') rows.forEach(r => Object.assign(r, this.payload));
      if (this.op === 'delete') { DB[this.t] = T.filter(r => !rows.includes(r)); return { data: null, error: null }; }
    }
    rows = rows.map(r => Object.assign({}, r));
    if (this.t === 'diseases' && this.cols && this.cols.includes('disease_species')) rows.forEach(r => { r.disease_species = DB.disease_species.filter(x => x.disease_id === r.id).map(x => ({ species_id: x.species_id, content: x.content })); });
    if (this.ord) { const [c, asc] = this.ord; rows.sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1)); }
    if (this.rng) rows = rows.slice(this.rng[0], this.rng[1] + 1);
    if (this.lim) rows = rows.slice(0, this.lim);
    if (this.one) return { data: rows[0] || null, error: (this.one === 'single' && !rows[0]) ? { message: 'no rows' } : null };
    return { data: rows, error: null };
  }
}

export function createClient() {
  return {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      onAuthStateChange: fn => { listeners.push(fn); setTimeout(() => fn('INITIAL_SESSION', session), 0); return { data: { subscription: { unsubscribe() {} } } }; },
      signInWithPassword: async ({ email }) => {
        const p = DB.profiles.find(x => x.email === email);
        if (!p) return { data: null, error: { message: 'Invalid login credentials' } };
        session = { user: { id: p.id, email } }; setTimeout(() => emit('SIGNED_IN', session), 0);
        return { data: { session }, error: null };
      },
      signUp: async ({ email, options }) => { DB.profiles.push({ id: uid(), name: options.data.name, email, role: 'usuario', created_at: now() }); return { data: { session: null }, error: null }; },
      signOut: async () => { session = null; emit('SIGNED_OUT', null); return { error: null }; },
      resetPasswordForEmail: async () => ({ data: {}, error: null }),
      updateUser: async () => ({ data: {}, error: null })
    },
    from: t => new Q(t),
    rpc: async (fn, { ids }) => ({ data: DB.profiles.filter(p => ids.includes(p.id)).map(p => ({ id: p.id, name: p.name })), error: null }),
    channel: () => { const c = { on: () => c, subscribe: () => c }; return c; },
    removeChannel: () => {}
  };
}
