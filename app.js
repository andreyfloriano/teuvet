// TeuVet — telas, navegação e eventos
import * as api from './api.js';
import { CATS, FIELDS, CHARS, TOOLS, SUGG_KINDS, STATUS, ROLES } from './constants.js';
import { esc, norm, clone, byName, fmtDate, fmtDT, fuzzyHas, fieldVal, searchDiseases, searchSigns, md } from './util.js';

/* ---------- Estado ---------- */
const S = {
  session: null, recovery: false, authMode: 'entrar', authMsg: '', authErr: '', loadErr: '',
  me: { id: null, name: '', email: '', role: 'usuario', owner: false, editor: false },
  species: {}, diseases: {}, config: { editorsPublish: true }, favorites: [], recent: [], sugg: [], users: [], hist: null,
  ready: { species: false, diseases: false, boot: false },
  names: {}, viewed: {},
  ui: { q: '', qs: '', qsSp: '', mode: 'q', sp: {}, tab: 'pat', f: {}, edTab: 'geral', pFilter: 'todas', pq: '', editSp: null, addSp: null, confirm: null, suggOpen: false, histOpen: false },
  edit: null, editRoute: null, saveTimer: null, saving: false, lastRoute: null, channel: null
};
const app = document.getElementById('app');

function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2800); }
const ts = v => v ? Date.parse(v) || 0 : 0;

/* ---------- Ícones ---------- */
const svg = (w, body, extra = '') => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${body}</svg>`;
const I = {
  search: (w = 20) => svg(w, '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
  pulse: (w = 20) => svg(w, '<path d="M3 12h4l2-6 4 12 2-6h6"/>'),
  chev: '<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  back: svg(22, '<path d="M15 6l-6 6 6 6"/>'),
  heart: (w = 20) => svg(w, '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'),
  heartFill: svg(20, '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="currentColor"/>'),
  home: svg(22, '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
  pill: (w = 22) => svg(w, '<rect x="3" y="9" width="18" height="7" rx="3.5" transform="rotate(-45 12 12.5)"/><path d="M9.5 10l5 5"/>'),
  user: svg(22, '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
  grid: svg(16, '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
  edit: svg(18, '<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
  flag: svg(18, '<path d="M5 21V4h10l-1 4 1 4H5"/>'),
  shield: svg(22, '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M12 9v4M12 16h.01"/>'),
  scalpel: svg(22, '<path d="M4 20l9-9"/><path d="M13 11l3-7 4 4-7 3"/>'),
  paw: svg(24, '<circle cx="7" cy="8" r="2"/><circle cx="12" cy="5.5" r="2"/><circle cx="17" cy="8" r="2"/><path d="M12 11c-3.5 0-6 3.2-6 5.7 0 2 1.5 2.8 3.2 2.8 1.1 0 1.8-.5 2.8-.5s1.7.5 2.8.5c1.7 0 3.2-.8 3.2-2.8 0-2.5-2.5-5.7-6-5.7z"/>', ' stroke-width="1.8"'),
  cow: svg(24, '<path d="M5 6l-2-2M19 6l2-2"/><path d="M6 7h12l-1 6a5 5 0 0 1-10 0z"/><path d="M9 18.5c.8.8 1.8 1.5 3 1.5s2.2-.7 3-1.5"/>', ' stroke-width="1.8"'),
  bird: svg(24, '<path d="M16 7a3 3 0 0 0-5.8-1L4 14l2 2 4-1 3 3 3-1 1-5 3-2-3-1z"/>', ' stroke-width="1.8"')
};
const LOGO = s => `<svg width="${s}" height="${s}" viewBox="0 0 44 44" aria-hidden="true"><rect width="44" height="44" rx="12" fill="#0E5C63"/><circle cx="15" cy="16" r="3.2" fill="#BFE6D8"/><circle cx="22" cy="12.5" r="3.2" fill="#BFE6D8"/><circle cx="29" cy="16" r="3.2" fill="#BFE6D8"/><path d="M22 20.5c-4.6 0-8 4.3-8 7.6 0 2.6 2 3.9 4.3 3.9 1.5 0 2.4-.7 3.7-.7s2.2.7 3.7.7c2.3 0 4.3-1.3 4.3-3.9 0-3.3-3.4-7.6-8-7.6z" fill="#fff"/><path d="M22 24v5M19.5 26.5h5" stroke="#0E5C63" stroke-width="1.8" stroke-linecap="round"/></svg>`;

/* ---------- Dados derivados ---------- */
const spOrder = (a, b) => (a.order || 0) - (b.order || 0) || byName(a, b);
const spTop = cat => Object.values(S.species).filter(s => s.category === cat && !s.parent).sort(spOrder);
const spKids = id => Object.values(S.species).filter(s => s.parent === id).sort(spOrder);
const spName = id => (S.species[id] && S.species[id].name) || 'Espécie removida';
const canSee = d => d && (d.status === 'publicado' || (S.me.editor && d.status !== 'arquivado'));
const visibleDiseases = () => Object.values(S.diseases).filter(canSee);
const isFav = id => S.favorites.includes(id);
function nameOf(id) {
  if (!id) return '—';
  if (id === S.me.id) return S.me.name || 'Você';
  if (S.names[id] !== undefined) return S.names[id] || 'Alguém';
  S.names[id] = ''; clearTimeout(nameOf._t);
  nameOf._t = setTimeout(async () => {
    const ids = Object.keys(S.names).filter(k => S.names[k] === '');
    try { const m = await api.profileNames(ids); ids.forEach(k => { S.names[k] = m[k] || 'Alguém'; }); render(false); } catch (e) { ids.forEach(k => { S.names[k] = 'Alguém'; }); }
  }, 50);
  return '…';
}

/* ---------- Roteamento (#endereço) ---------- */
const route = () => (location.hash || '').slice(1) || 'inicio';
function go(h) { if (route() === h) render(true); else location.hash = h; }
window.addEventListener('hashchange', () => {
  flushAutosave();
  Object.assign(S.ui, { f: {}, tab: 'pat', confirm: null, suggOpen: false, histOpen: false, editSp: null, addSp: null });
  S.edit = null; S.editRoute = null;
  render(true); window.scrollTo(0, 0);
  // Painel: busca sugestões e contas mais recentes ao entrar
  if (route().startsWith('painel') && S.me.editor) { reload('sugg'); if (S.me.owner && route() === 'painel-usuarios') reload('users'); }
});

/* ---------- Componentes ---------- */
function bottomNav() {
  const r = route();
  const cur = r === 'inicio' || r.startsWith('cat-') || r.startsWith('esp-') || r.startsWith('doenca-') ? 'inicio' : ['pesquisar', 'medicacoes', 'favoritos', 'perfil'].includes(r) ? r : '';
  const it = (h, label, ic) => `<a href="#${h}"${cur === h ? ' aria-current="page"' : ''}>${ic}${label}</a>`;
  return `<nav class="bottom" aria-label="Navegação principal">${it('inicio', 'Início', I.home)}${it('pesquisar', 'Pesquisar', I.search(22))}${it('medicacoes', 'Medicações', I.pill(22))}${it('favoritos', 'Favoritos', I.heart(22))}${it('perfil', 'Perfil', I.user)}</nav>`;
}
const backBar = (h, title, extra = '') => `<div class="topbar"><a class="btn icon-btn" href="#${h}" aria-label="Voltar">${I.back}</a><h1 style="flex:1;min-width:0">${esc(title)}</h1>${extra}</div>`;
function badges(d) {
  let b = '';
  if (S.me.editor && d.status !== 'publicado') b += `<span class="badge ${STATUS[d.status || 'rascunho'][1]}">${STATUS[d.status || 'rascunho'][0]}</span>`;
  if (d.zoonotic) b += '<span class="badge zoo">Zoonose</span>';
  if (d.surgical) b += '<span class="badge cir">Cirúrgica</span>';
  return b;
}
function diseaseRow(d, sp) {
  const sub = d.hideAgent ? '' : (d.agent ? `<span class="s">${esc(d.agent)}</span>` : '');
  return `<a class="li" href="#doenca-${d.id}" data-act="pick-sp" data-d="${d.id}" data-sp="${esc(sp || '')}"><span class="grow"><span class="t">${esc(d.name)}</span>${sub}</span><span class="row" style="gap:6px;flex-wrap:wrap;justify-content:flex-end">${badges(d)}</span>${I.chev}</a>`;
}
const skeleton = n => `<div class="col">${'<div class="skel"></div>'.repeat(n)}</div>`;
const loadBanner = () => S.loadErr ? `<div class="alert-err">${esc(S.loadErr)} <button class="linkbtn" type="button" data-act="reload">Tentar de novo</button></div>` : '';
const srOnly = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)';

/* ---------- Login ---------- */
function viewSetup() {
  return `<div class="auth"><div class="logo">${LOGO(72)}<h1>TeuVet</h1></div>
  <div class="card col"><b>Falta conectar o banco de dados</b><p class="small muted" style="margin:0">Abra o arquivo <code>config.js</code> e cole a URL do projeto e a chave pública (anon) do Supabase, como explica o README.</p></div></div>`;
}
function viewAuth() {
  const m = S.authMode;
  const msg = S.authMsg ? `<div class="ok-box small">${esc(S.authMsg)}</div>` : '';
  const err = S.authErr ? `<div class="alert-err small" role="alert">${esc(S.authErr)}</div>` : '';
  let form;
  if (S.recovery) {
    form = `<form data-form="newpass"><h2 class="sec-title">Criar nova senha</h2>
      <div class="field"><label for="np">Nova senha</label><input id="np" class="input" type="password" name="password" minlength="6" autocomplete="new-password" required></div>
      <button class="btn pri" type="submit">Salvar senha</button></form>`;
  } else if (m === 'cadastrar') {
    form = `<form data-form="signup">
      <div class="field"><label for="su-name">Nome</label><input id="su-name" class="input" name="name" autocomplete="name" required></div>
      <div class="field"><label for="su-email">E-mail</label><input id="su-email" class="input" type="email" name="email" autocomplete="email" required></div>
      <div class="field"><label for="su-pass">Senha</label><input id="su-pass" class="input" type="password" name="password" minlength="6" autocomplete="new-password" required></div>
      <button class="btn pri" type="submit">Criar conta</button>
      <div class="links"><button class="linkbtn" type="button" data-act="auth" data-m="entrar">Já tenho conta</button></div></form>`;
  } else if (m === 'esqueci') {
    form = `<form data-form="reset">
      <div class="field"><label for="rs-email">E-mail da conta</label><input id="rs-email" class="input" type="email" name="email" autocomplete="email" required></div>
      <button class="btn pri" type="submit">Enviar link para criar nova senha</button>
      <div class="links"><button class="linkbtn" type="button" data-act="auth" data-m="entrar">Voltar para Entrar</button></div></form>`;
  } else {
    form = `<form data-form="signin">
      <div class="field"><label for="si-email">E-mail</label><input id="si-email" class="input" type="email" name="email" autocomplete="email" required></div>
      <div class="field"><label for="si-pass">Senha</label><input id="si-pass" class="input" type="password" name="password" autocomplete="current-password" required></div>
      <button class="btn pri" type="submit">Entrar</button>
      <div class="links"><button class="linkbtn" type="button" data-act="auth" data-m="esqueci">Esqueci minha senha</button><button class="linkbtn" type="button" data-act="auth" data-m="cadastrar">Criar conta</button></div></form>`;
  }
  return `<div class="auth"><div class="logo">${LOGO(72)}<h1>TeuVet</h1><span class="muted">Seu guia veterinário</span></div>${msg}${err}${form}</div>`;
}

/* ---------- Telas do app ---------- */
function viewHome() {
  const catCard = (c, ic, featured) => {
    const sub = c.id === 'med' ? 'Doses, concentrações e cálculo' : (spTop(c.id).map(s => s.name).join(' · ') || (S.ready.species ? 'Nenhuma espécie cadastrada' : 'Carregando…'));
    return `<a class="cat${featured ? ' featured' : ''}" href="#${c.id === 'med' ? 'medicacoes' : 'cat-' + c.id}"><span class="ic">${ic}</span><b>${esc(c.name)}</b><span class="sub">${esc(sub)}</span></a>`;
  };
  const tools = TOOLS.map(t => `<div class="li" aria-disabled="true"><span class="grow"><span class="t" style="font-size:15px;font-weight:600">${t[0]}</span></span><span class="badge">Etapa ${t[1]}</span></div>`).join('');
  return `<div class="shell">
  <header class="row between">
    <a class="brand" href="#inicio">${LOGO(44)}<span><b>TeuVet</b><span>Seu guia veterinário</span></span></a>
    ${S.me.editor ? `<a class="btn soft" href="#painel">${I.grid}Painel</a>` : ''}
  </header>
  ${loadBanner()}
  <section class="col" aria-label="Pesquisas">
    <form class="field" data-form="q"><label for="hq">Pesquisar doença</label>
      <div class="search">${I.search()}<input id="hq" type="search" name="q" placeholder="Nome, sinônimo, agente ou espécie" autocomplete="off" enterkeyhint="search"></div></form>
    <form class="field" data-form="qs"><label for="hqs">Pesquisar por sinais clínicos e exames</label>
      <div class="search">${I.pulse()}<input id="hqs" type="search" name="q" placeholder="Separe por vírgula: febre, anemia, ALT aumentada" autocomplete="off" enterkeyhint="search"></div></form>
  </section>
  <section class="col"><h2 class="sec-title">Categorias</h2>
    <div class="grid2">${catCard(CATS[0], I.paw)}${catCard(CATS[1], I.cow)}${catCard(CATS[2], I.bird)}${catCard({ id: 'med', name: 'Medicações' }, I.pill(24), true)}</div>
  </section>
  <section class="col"><div class="row between"><h2 class="sec-title">Ferramentas clínicas</h2><span class="tiny muted">Chegam nas próximas etapas</span></div>
    <div class="list">${tools}</div>
  </section>
  </div>${bottomNav()}`;
}

function viewCategory(catId) {
  const c = CATS.find(x => x.id === catId); if (!c) return viewNotFound();
  const tops = spTop(catId);
  let body;
  if (!S.ready.species) body = skeleton(3);
  else if (!tops.length) body = `<div class="note">Nenhuma espécie cadastrada nesta categoria.${S.me.editor ? ' Cadastre pelo <a href="#painel-especies">Painel › Espécies</a>.' : ''}</div>`;
  else body = `<div class="list">${tops.map(s => {
    const kids = spKids(s.id); const n = visibleDiseases().filter(d => (d.species || []).includes(s.id)).length;
    return `<a class="li" href="#esp-${s.id}"><span class="grow"><span class="t">${esc(s.name)}</span><span class="s">${kids.length ? esc(kids.map(k => k.name).join(' · ')) : (s.scientific ? `<i>${esc(s.scientific)}</i>` : '')}</span></span><span class="badge">${n} ${n === 1 ? 'patologia' : 'patologias'}</span>${I.chev}</a>`;
  }).join('')}</div>`;
  return `<div class="shell">${backBar('inicio', c.name, S.me.editor ? `<a class="btn soft" href="#painel-especies">Gerenciar</a>` : '')}${loadBanner()}${body}</div>${bottomNav()}`;
}

function viewSpecies(id) {
  if (!S.ready.species) return `<div class="shell">${skeleton(5)}</div>${bottomNav()}`;
  const s = S.species[id]; if (!s) return viewNotFound();
  const parent = s.parent ? S.species[s.parent] : null;
  const backH = parent ? 'esp-' + parent.id : 'cat-' + s.category;
  const kids = spKids(id);
  const tab = S.ui.tab;
  let content = '';
  if (tab === 'pat') {
    const f = S.ui.f;
    const all = visibleDiseases().filter(d => (d.species || []).includes(id));
    let list = all.slice();
    const opts = key => [...new Set(all.map(d => d[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const sel = (key, label) => { const o = opts(key); if (!o.length) return ''; return `<select class="input" id="f-${key}" style="flex:1 1 150px;min-height:40px;padding:6px 10px;font-size:13px" data-filter="${key}" aria-label="${label}"><option value="">${label}: todos</option>${o.map(v => `<option${f[key] === v ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>`; };
    const filters = `${sel('system', 'Sistema orgânico')}${sel('etiologyType', 'Etiologia')}${sel('kind', 'Tipo de doença')}${sel('specialty', 'Especialidade')}`;
    ['system', 'etiologyType', 'kind', 'specialty'].forEach(k => { if (f[k]) list = list.filter(d => d[k] === f[k]); });
    if (f.zoo) list = list.filter(d => d.zoonotic);
    list.sort(byName);
    let rows = '', prev = '';
    list.forEach(d => { const L = norm(d.name).charAt(0).toUpperCase(); if (L !== prev) { rows += `<div class="letter">${esc(L)}</div>`; prev = L; } rows += diseaseRow(d, id); });
    content = `<div class="row wrap" style="gap:8px">${filters}<label class="chip${f.zoo ? ' on' : ''}" style="gap:8px"><input type="checkbox" data-filter="zoo"${f.zoo ? ' checked' : ''} style="accent-color:currentColor"> Zoonoses</label></div>
      ${!S.ready.diseases ? skeleton(4) : !all.length ? `<div class="note">Nenhuma patologia publicada para ${esc(s.name)} ainda.${S.me.editor ? ' <a href="#nova-doenca">Cadastrar patologia</a>.' : ''}</div>` : !list.length ? '<div class="note">Nenhuma patologia com esses filtros.</div>' : `<div class="plain-list" style="display:flex;flex-direction:column">${rows}</div>`}`;
  } else {
    const ch = s.chars || {}; const filled = CHARS.filter(([k]) => ch[k] && String(ch[k]).trim());
    content = `${S.me.editor ? `<div><a class="btn soft" href="#carac-${id}">${I.edit}Editar características</a></div>` : ''}
      ${filled.length ? filled.map(([k, l], i) => `<details class="sec"${i === 0 ? ' open' : ''}><summary>${l}<span class="pm" aria-hidden="true"></span></summary><div class="prose">${md(ch[k])}</div></details>`).join('') : `<div class="note">As características de ${esc(s.name)} ainda não foram cadastradas.</div>`}`;
  }
  return `<div class="shell">
  <section class="hero">
    <div class="row between"><a class="btn icon-btn" href="#${backH}" aria-label="Voltar">${I.back}</a><span class="small" style="opacity:.85">${esc(parent ? parent.name : (CATS.find(c => c.id === s.category) || {}).name || '')}</span><span style="width:44px"></span></div>
    <div><h1>${esc(s.name)}</h1>${s.scientific ? `<div class="sci">${esc(s.scientific)}</div>` : ''}</div>
    ${kids.length ? `<div class="row wrap" style="gap:8px">${kids.map(k => `<a class="chip" style="background:rgba(255,255,255,.14);border-color:transparent;color:var(--accent-fg)" href="#esp-${k.id}">${esc(k.name)}</a>`).join('')}</div>` : ''}
    <div class="tabs" role="tablist"><button type="button" role="tab" aria-selected="${tab === 'pat'}" data-act="tab" data-tab="pat">Patologias</button><button type="button" role="tab" aria-selected="${tab === 'car'}" data-act="tab" data-tab="car">Características</button></div>
  </section>
  ${content}
  </div>${bottomNav()}`;
}

function viewDisease(id) {
  if (!S.ready.diseases) return `<div class="shell">${skeleton(6)}</div>${bottomNav()}`;
  const d = S.diseases[id];
  if (!d || !canSee(d)) return viewNotFound('Esta patologia não está disponível.');
  const spList = (d.species || []).filter(x => S.species[x]);
  let sp = S.ui.sp[id]; if (!spList.includes(sp)) sp = spList[0] || null;
  markViewed(id);
  const backH = sp ? 'esp-' + sp : 'inicio';
  const secs = FIELDS.map(([k, l]) => ({ k, l, v: sp ? fieldVal(d, sp, k) : (d.shared || {})[k] }));
  const filled = secs.filter(x => x.v && String(x.v).trim());
  const empty = secs.filter(x => !(x.v && String(x.v).trim()));
  const secHtml = filled.map((x, i) => `<details class="sec"${i === 0 ? ' open' : ''}><summary>${x.l}<span class="pm" aria-hidden="true"></span></summary><div class="prose">${md(x.v)}</div></details>`).join('');
  const procs = (d.procedures || []).filter(p => p.name);
  const surg = d.surgical ? `<section class="card soft col" aria-labelledby="cir-t"><div class="row" style="color:var(--accent-soft-fg)">${I.scalpel}<h2 id="cir-t" class="sec-title">Tratamento cirúrgico</h2></div>
    ${procs.length ? procs.map(p => `<div class="col" style="gap:8px"><div><b style="font-size:15px">${esc(p.name)}</b>${p.indication ? `<div class="small">${esc(p.indication)}</div>` : ''}</div><button class="btn pri" type="button" disabled>Ler sobre cirurgia · Etapa 5</button></div>`).join('<hr style="border:0;border-top:1px solid var(--line);margin:4px 0">') : '<span class="small muted">Nenhum procedimento cadastrado.</span>'}</section>` : '';
  const sugg = S.ui.suggOpen ? `<form class="card col" data-form="sugg" aria-labelledby="sg-t"><h2 id="sg-t" class="sec-title">Sugerir correção</h2>
      <div class="field"><label for="sg-kind">Tipo de problema</label><select id="sg-kind" class="input" name="kind">${SUGG_KINDS.map(k => `<option>${k}</option>`).join('')}</select></div>
      <div class="field"><label for="sg-text">O que deve ser corrigido?</label><textarea id="sg-text" class="input" name="text" required maxlength="4000" placeholder="Descreva o trecho e a correção sugerida"></textarea></div>
      <p class="tiny muted" style="margin:0">A sugestão vai para o Painel do Criador e não altera o conteúdo sozinha.</p>
      <div class="row wrap"><button class="btn pri" type="submit">Enviar sugestão</button><button class="btn" type="button" data-act="sugg-close">Cancelar</button></div></form>` : '';
  return `<div class="shell">
  <div class="row between"><a class="btn icon-btn" href="#${backH}" aria-label="Voltar">${I.back}</a>
    <div class="row" style="gap:8px">${S.me.editor ? `<a class="btn icon-btn" href="#editar-${d.id}" aria-label="Editar patologia">${I.edit}</a>` : ''}<button class="btn icon-btn" type="button" data-act="fav" data-id="${d.id}" aria-pressed="${isFav(d.id)}" aria-label="${isFav(d.id) ? 'Remover dos favoritos' : 'Favoritar'}" style="color:var(--accent)">${isFav(d.id) ? I.heartFill : I.heart()}</button></div></div>
  <header class="col" style="gap:8px">
    <h1 style="font-size:30px;font-weight:800;letter-spacing:-.02em">${esc(d.name)}</h1>
    ${d.scientific ? `<div class="muted" style="font-style:italic">${esc(d.scientific)}</div>` : ''}
    ${(d.synonyms || d.popular) ? `<div class="small muted">${d.synonyms ? 'Sinônimos: ' + esc(d.synonyms) : ''}${d.synonyms && d.popular ? ' · ' : ''}${d.popular ? 'Nome popular: ' + esc(d.popular) : ''}</div>` : ''}
    ${(!d.hideAgent && d.agent) ? `<div class="small"><b>Agente/etiologia:</b> ${esc(d.agent)}</div>` : ''}
    <div class="row wrap" style="gap:6px">${badges(d)}${d.system ? `<span class="badge">${esc(d.system)}</span>` : ''}</div>
  </header>
  ${spList.length > 1 ? `<div class="col" style="gap:8px"><span class="lbl muted">Versão por espécie</span><div class="row wrap" style="gap:8px">${spList.map(x => `<button type="button" class="chip${x === sp ? ' on' : ''}" data-act="sp" data-d="${d.id}" data-sp="${x}" aria-pressed="${x === sp}">${esc(spName(x))}</button>`).join('')}</div></div>` : (sp ? `<div class="small muted">Espécie: <b style="color:var(--fg)">${esc(spName(sp))}</b></div>` : '')}
  ${d.zoonotic ? `<div class="alert-zoo" role="note">${I.shield}<div><b>Doença com potencial zoonótico.</b><div class="small">Siga as medidas de biossegurança cadastradas em Profilaxia e Observações.</div></div></div>` : ''}
  <div>${secHtml || '<div class="note">Esta versão ainda não tem conteúdo publicado.</div>'}
  ${S.me.editor && empty.length ? `<p class="tiny muted" style="margin:12px 0 0">Campos vazios, ocultos para usuários: ${empty.map(x => x.l).join(', ')}.</p>` : ''}</div>
  ${surg}
  ${sugg}
  <footer class="col" style="gap:12px;padding-top:12px;border-top:1px solid var(--line)">
    <span class="tiny muted">${STATUS[d.status || 'rascunho'][0]} · atualizado em ${fmtDate(d.updatedAt)} por ${esc(nameOf(d.updatedBy))}</span>
    ${S.ui.suggOpen ? '' : `<button class="btn" type="button" data-act="sugg-open">${I.flag}Sugerir correção</button>`}
  </footer>
  </div>${bottomNav()}`;
}

function resultsHtml() {
  if (!S.ready.diseases) return skeleton(4);
  if (S.ui.mode === 'q') {
    if (!S.ui.q.trim()) return '<div class="note">Digite o nome, um sinônimo, o nome científico, o agente etiológico ou a espécie. Pequenos erros de digitação são aceitos.</div>';
    const r = searchDiseases(visibleDiseases(), S.ui.q, spName);
    return r.length ? `<p class="small muted" style="margin:0">${r.length} ${r.length === 1 ? 'resultado' : 'resultados'}</p><div class="list">${r.map(d => diseaseRow(d, (d.species || [])[0])).join('')}</div>` : '<div class="note">Nenhuma patologia encontrada com esse termo.</div>';
  }
  if (!S.ui.qs.trim()) return '<div class="note">Informe sinais clínicos, dados da anamnese ou achados de exames, separados por vírgula. A busca compara com os textos cadastrados em Sinais clínicos, Exames e Anamnese de cada espécie.</div>';
  const { res } = searchSigns(visibleDiseases(), S.ui.qs, S.ui.qsSp);
  if (!res.length) return '<div class="note">Nenhuma patologia cadastrada menciona esses termos.</div>';
  return `<p class="small muted" style="margin:0">Ordenado pelo número de termos encontrados no cadastro. Não é uma probabilidade diagnóstica.</p><div class="list">${res.map(x => `<a class="li" href="#doenca-${x.d.id}" data-act="pick-sp" data-d="${x.d.id}" data-sp="${x.sp}"><span class="grow"><span class="t">${esc(x.d.name)} <span class="small muted" style="font-weight:600">· ${esc(spName(x.sp))}</span></span><span class="s">Encontrado: ${esc(x.hit.join(', '))}</span>${x.miss.length ? `<span class="s">Não consta no cadastro: ${esc(x.miss.join(', '))}</span>` : ''}</span><span class="badge pub">${x.hit.length}/${x.hit.length + x.miss.length}</span>${I.chev}</a>`).join('')}</div>`;
}
function viewSearch() {
  const mode = S.ui.mode;
  const spOpts = Object.values(S.species).sort(spOrder).map(s => `<option value="${s.id}"${S.ui.qsSp === s.id ? ' selected' : ''}>${esc(s.name)}</option>`).join('');
  return `<div class="shell">
  <div class="topbar"><h1>Pesquisar</h1></div>
  <div class="row" style="gap:8px" role="tablist"><button type="button" role="tab" class="chip${mode === 'q' ? ' on' : ''}" aria-selected="${mode === 'q'}" data-act="mode" data-mode="q">Por doença</button><button type="button" role="tab" class="chip${mode === 'qs' ? ' on' : ''}" aria-selected="${mode === 'qs'}" data-act="mode" data-mode="qs">Por sinais e exames</button></div>
  ${mode === 'q' ? `<div class="search">${I.search()}<label for="sq" style="${srOnly}">Pesquisar doença</label><input id="sq" type="search" data-live="q" value="${esc(S.ui.q)}" placeholder="Nome, sinônimo, agente ou espécie" autocomplete="off"></div>`
    : `<div class="col"><div class="search">${I.pulse()}<label for="sqs" style="${srOnly}">Sinais e exames</label><input id="sqs" type="search" data-live="qs" value="${esc(S.ui.qs)}" placeholder="febre, anemia, ALT aumentada" autocomplete="off"></div>
      <div class="field"><label for="sqsp">Espécie</label><select id="sqsp" class="input" data-live="qsSp"><option value="">Todas as espécies</option>${spOpts}</select></div></div>`}
  <div id="results" class="col">${resultsHtml()}</div>
  </div>${bottomNav()}`;
}

const viewMeds = () => `<div class="shell"><div class="topbar"><h1>Medicações</h1></div>
  <div class="card col"><b>Doses, concentrações e calculadora</b><p class="muted" style="margin:0">O cadastro de medicamentos, as contraindicações em destaque e a aba Calcular fazem parte da Etapa 4. Esta área fica ativa quando ela for construída.</p></div></div>${bottomNav()}`;

function viewFavorites() {
  const favs = S.favorites.map(id => S.diseases[id]).filter(canSee);
  const rec = S.recent.map(id => S.diseases[id]).filter(canSee).slice(0, 10);
  return `<div class="shell"><div class="topbar"><h1>Favoritos</h1></div>
  <section class="col"><h2 class="sec-title">Patologias salvas</h2>${favs.length ? `<div class="list">${favs.map(d => diseaseRow(d, (d.species || [])[0])).join('')}</div>` : '<div class="note">Toque no coração de uma patologia para salvá-la aqui. Os favoritos acompanham sua conta em qualquer dispositivo.</div>'}</section>
  <section class="col"><h2 class="sec-title">Vistos recentemente</h2>${rec.length ? `<div class="list">${rec.map(d => diseaseRow(d, (d.species || [])[0])).join('')}</div>` : '<div class="note">As páginas que você abrir aparecem aqui.</div>'}</section>
  </div>${bottomNav()}`;
}

function themeNow() { try { return localStorage.getItem('teuvet-theme') || 'auto'; } catch (e) { return 'auto'; } }
function viewProfile() {
  const t = themeNow();
  return `<div class="shell"><div class="topbar"><h1>Perfil</h1></div>
  <div class="card row wrap">${I.user}<div style="flex:1;min-width:160px"><b style="font-size:17px">${esc(S.me.name || 'Sem nome')}</b><div class="small muted">${esc(S.me.email)} · ${ROLES[S.me.role] || 'Usuário'}</div></div>${S.me.editor ? `<a class="btn soft" href="#painel">${I.grid}Painel</a>` : ''}</div>
  <form class="inline-form" data-form="myname"><div class="field"><label for="my-name">Seu nome</label><input id="my-name" class="input" name="name" value="${esc(S.me.name)}" required></div><button class="btn" type="submit">Salvar nome</button></form>
  <section class="col"><h2 class="sec-title">Aparência</h2><div class="row wrap" style="gap:8px">${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']].map(([v, l]) => `<button type="button" class="chip${t === v ? ' on' : ''}" data-act="theme" data-v="${v}" aria-pressed="${t === v}">${l}</button>`).join('')}</div></section>
  <section class="col"><h2 class="sec-title">Instalar no celular</h2><p class="muted small" style="margin:0;max-width:68ch">No Android (Chrome), toque no menu ⋮ e em “Instalar app”. No iPhone (Safari), toque em Compartilhar e em “Adicionar à Tela de Início”.</p></section>
  <section class="col"><h2 class="sec-title">Sobre o conteúdo</h2><p class="muted small" style="margin:0;max-width:68ch">Todo o conteúdo veterinário do TeuVet é pesquisado, escrito e publicado pelo Criador e por editores autorizados. Se encontrar algo a corrigir, use “Sugerir correção” na página da patologia.</p></section>
  <div><button class="btn danger" type="button" data-act="logout">Sair da conta</button></div>
  </div>${bottomNav()}`;
}

const viewNotFound = msg => `<div class="shell">${backBar('inicio', 'Página não encontrada')}<div class="note">${esc(msg || 'Este endereço não existe ou o conteúdo foi removido.')}</div></div>${bottomNav()}`;

/* ---------- Painel do Criador ---------- */
function panelShell(sub, inner) {
  const L = (h, l, n) => `<a href="#${h}"${sub === h ? ' aria-current="page"' : ''}>${l}${n != null ? `<span class="badge">${n}</span>` : ''}</a>`;
  const open = S.sugg.filter(x => x.status !== 'resolvida').length;
  const later = [['Procedimentos cirúrgicos', 5], ['Medicações', 4], ['Protocolos terapêuticos', 4], ['Emergências', 6], ['Exames laboratoriais', 6], ['Calculadoras clínicas', 6], ['Casos clínicos', 6], ['Biblioteca de imagens', 2]];
  return `<div class="shell wide">
  <header class="row between wrap"><a class="brand" href="#inicio">${LOGO(40)}<span><b>TeuVet</b><span>Painel do Criador</span></span></a><a class="btn" href="#inicio">Ver o app</a></header>
  ${loadBanner()}
  <div class="panel">
    <nav class="pnav" aria-label="Menu do Painel">
      ${L('painel', 'Visão geral')}${L('painel-doencas', 'Patologias', Object.keys(S.diseases).length)}${L('painel-especies', 'Espécies e características')}${L('painel-sugestoes', 'Sugestões de correção', open || null)}${L('painel-usuarios', 'Usuários e permissões')}
      <span class="grp">Próximas etapas</span>
      ${later.map(([l, n]) => `<span>${l}<span class="badge">Etapa ${n}</span></span>`).join('')}
    </nav>
    <main class="pmain">${inner}</main>
  </div></div>`;
}
function viewPanel(sub) {
  if (!S.ready.boot) return `<div class="shell">${skeleton(4)}</div>`;
  if (!S.me.editor) return `<div class="shell">${backBar('inicio', 'Painel do Criador')}<div class="note">O Painel é restrito ao Criador e aos editores autorizados.</div></div>${bottomNav()}`;
  if (sub === 'painel-doencas') return panelShell(sub, panelDiseases());
  if (sub === 'painel-especies') return panelShell(sub, panelSpecies());
  if (sub === 'painel-sugestoes') return panelShell(sub, panelSugg());
  if (sub === 'painel-usuarios') return panelShell(sub, panelUsers());
  return panelShell('painel', panelOverview());
}
function panelOverview() {
  const all = Object.values(S.diseases);
  const c = st => all.filter(d => (d.status || 'rascunho') === st).length;
  const recent = all.slice().sort((a, b) => ts(b.updatedAt) - ts(a.updatedAt)).slice(0, 6);
  return `<div class="row between wrap"><div><h1 style="font-size:26px;font-weight:800">Visão geral</h1><span class="small muted">Tudo o que foi cadastrado no TeuVet</span></div><a class="btn pri" href="#nova-doenca">+ Nova patologia</a></div>
  <div class="kpis">
    <div class="kpi"><b>${all.length}</b><span>Patologias cadastradas</span></div>
    <div class="kpi"><b style="color:var(--ok)">${c('publicado')}</b><span>Publicadas</span></div>
    <div class="kpi"><b>${c('rascunho')}</b><span>Rascunhos</span></div>
    <div class="kpi"><b style="color:var(--warn)">${c('revisao')}</b><span>Em revisão</span></div>
    <div class="kpi"><b>${Object.keys(S.species).length}</b><span>Espécies e grupos</span></div>
    <div class="kpi"><b style="color:var(--warn)">${S.sugg.filter(x => x.status !== 'resolvida').length}</b><span>Sugestões abertas</span></div>
  </div>
  <section class="col"><h2 class="sec-title">Editadas recentemente</h2>
  ${recent.length ? `<div class="list">${recent.map(d => `<a class="li" href="#editar-${d.id}"><span class="grow"><span class="t">${esc(d.name)}</span><span class="s">${fmtDT(d.updatedAt)} · ${esc(nameOf(d.updatedBy))}</span></span><span class="badge ${STATUS[d.status || 'rascunho'][1]}">${STATUS[d.status || 'rascunho'][0]}</span>${I.chev}</a>`).join('')}</div>` : '<div class="note">Nenhuma patologia ainda. Comece por “Nova patologia”: escolha as espécies e preencha o conteúdo de cada uma.</div>'}
  </section>`;
}
function filteredPanelDiseases() {
  let all = Object.values(S.diseases).sort(byName);
  if (S.ui.pFilter !== 'todas') all = all.filter(d => (d.status || 'rascunho') === S.ui.pFilter);
  const q = norm(S.ui.pq);
  if (q) all = all.filter(d => fuzzyHas(norm([d.name, d.synonyms, d.agent, d.scientific, (d.species || []).map(spName).join(' ')].join(' ')), q));
  return all;
}
function panelDiseases() {
  const f = S.ui.pFilter;
  return `<div class="row between wrap"><h1 style="font-size:26px;font-weight:800">Patologias</h1><a class="btn pri" href="#nova-doenca">+ Nova patologia</a></div>
  <div class="row wrap" style="gap:8px">${['todas', 'publicado', 'rascunho', 'revisao', 'arquivado'].map(k => `<button type="button" class="chip${f === k ? ' on' : ''}" data-act="pfilter" data-v="${k}" aria-pressed="${f === k}">${k === 'todas' ? 'Todas' : STATUS[k][0]}</button>`).join('')}</div>
  <div class="search">${I.search()}<label for="pq" style="${srOnly}">Filtrar patologias</label><input id="pq" type="search" data-live="pq" value="${esc(S.ui.pq)}" placeholder="Filtrar por nome, agente ou espécie"></div>
  <div id="ptable">${diseaseTable(filteredPanelDiseases())}</div>`;
}
function diseaseTable(all) {
  if (!S.ready.diseases) return skeleton(4);
  if (!all.length) return '<div class="note">Nenhuma patologia neste filtro.</div>';
  return `<div class="table-wrap"><table><thead><tr><th>Patologia</th><th>Espécies</th><th>Status</th><th>Atualizada</th><th><span style="${srOnly}">Ações</span></th></tr></thead><tbody>
  ${all.map(d => `<tr><td><b>${esc(d.name)}</b>${d.agent ? `<div class="tiny muted">${esc(d.agent)}</div>` : ''}</td><td class="small">${esc((d.species || []).map(spName).join(', ') || '—')}</td><td><span class="badge ${STATUS[d.status || 'rascunho'][1]}">${STATUS[d.status || 'rascunho'][0]}</span></td><td class="small" style="white-space:nowrap">${fmtDate(d.updatedAt)}</td>
  <td style="white-space:nowrap"><div class="row" style="gap:6px;justify-content:flex-end">${S.me.owner && d.status === 'revisao' ? `<button class="btn soft" type="button" data-act="approve" data-id="${d.id}">Aprovar</button>` : ''}<a class="btn" href="#editar-${d.id}">Editar</a></div></td></tr>`).join('')}
  </tbody></table></div>`;
}
function panelSpecies() {
  const editRow = s => `<form class="inline-form" data-form="sp-edit" data-id="${s.id}"><div class="field"><label for="spn-${s.id}">Nome</label><input id="spn-${s.id}" class="input" name="name" value="${esc(s.name)}" required></div><div class="field"><label for="sps-${s.id}">Nome científico</label><input id="sps-${s.id}" class="input" name="scientific" value="${esc(s.scientific || '')}"></div><div class="field" style="flex:0 1 110px"><label for="spo-${s.id}">Ordem</label><input id="spo-${s.id}" class="input" type="number" name="order" value="${esc(s.order || 0)}"></div><button class="btn pri" type="submit">Salvar</button><button class="btn" type="button" data-act="sp-cancel">Cancelar</button></form>`;
  const addForm = (cat, parent) => { const k = cat + '-' + (parent || 'x'); return `<form class="inline-form" data-form="sp-add" data-cat="${cat}" data-parent="${parent || ''}"><div class="field"><label for="na-${k}">${parent ? 'Nova subdivisão de ' + esc(spName(parent)) : 'Nova espécie ou grupo'}</label><input id="na-${k}" class="input" name="name" required placeholder="${parent ? 'Ex.: Ovinos' : 'Ex.: Coelhos'}"></div><div class="field"><label for="ns-${k}">Nome científico (opcional)</label><input id="ns-${k}" class="input" name="scientific"></div><button class="btn pri" type="submit">Adicionar</button>${parent ? '<button class="btn" type="button" data-act="sp-cancel">Cancelar</button>' : ''}</form>`; };
  const row = (s, child) => {
    if (S.ui.editSp === s.id) return `<div class="sp-row${child ? ' child' : ''}" style="display:block">${editRow(s)}</div>`;
    const used = Object.values(S.diseases).filter(d => (d.species || []).includes(s.id)).length;
    const kidsN = spKids(s.id).length;
    const conf = S.ui.confirm === 'sp:' + s.id;
    return `<div class="sp-row${child ? ' child' : ''}"><div class="grow"><b>${esc(s.name)}</b>${s.scientific ? ` <i class="small muted">${esc(s.scientific)}</i>` : ''}<div class="tiny muted">${used} ${used === 1 ? 'patologia' : 'patologias'}${kidsN ? ` · ${kidsN} subdivisões` : ''}</div></div>
      ${conf ? ((used || kidsN) ? `<span class="small" style="color:var(--danger)">Remova antes as patologias e subdivisões ligadas.</span><button class="btn" type="button" data-act="sp-cancel">Ok</button>` : `<span class="small">Excluir ${esc(s.name)}?</span><button class="btn danger fill" type="button" data-act="sp-del" data-id="${s.id}">Excluir</button><button class="btn" type="button" data-act="sp-cancel">Cancelar</button>`)
      : `<a class="btn" href="#carac-${s.id}">Características</a>${child ? '' : `<button class="btn" type="button" data-act="sp-addkid" data-id="${s.id}">+ Subdivisão</button>`}<button class="btn" type="button" data-act="sp-edit" data-id="${s.id}">Editar</button>${S.me.owner ? `<button class="btn danger" type="button" data-act="sp-confirm" data-id="${s.id}">Excluir</button>` : ''}`}
    </div>${S.ui.addSp === s.id ? `<div class="sp-row child" style="display:block">${addForm(s.category, s.id)}</div>` : ''}`;
  };
  return `<div><h1 style="font-size:26px;font-weight:800">Espécies e características</h1><span class="small muted">Categorias, espécies e subdivisões que aparecem no app</span></div>
  ${!S.ready.species ? skeleton(4) : CATS.map(c => `<section class="col"><h2 class="sec-title">${c.name}</h2><div class="list">${spTop(c.id).map(s => row(s, false) + spKids(s.id).map(k => row(k, true)).join('')).join('') || '<div class="sp-row muted small">Nenhuma espécie ainda.</div>'}</div>${addForm(c.id, null)}</section>`).join('')}`;
}
function panelSugg() {
  const list = S.sugg.slice().sort((a, b) => (a.status === 'resolvida') - (b.status === 'resolvida') || ts(b.created_at) - ts(a.created_at));
  return `<div><h1 style="font-size:26px;font-weight:800">Sugestões de correção</h1><span class="small muted">Enviadas pelos usuários. Nenhuma altera o conteúdo automaticamente.</span></div>
  ${!list.length ? '<div class="note">Nenhuma sugestão recebida.</div>' : `<div class="list">${list.map(x => {
    const d = S.diseases[x.disease_id];
    return `<div class="li" style="align-items:flex-start;flex-wrap:wrap"><div class="grow" style="min-width:220px"><span class="t" style="font-size:15px">${esc(x.kind)} · ${d ? `<a href="#doenca-${d.id}">${esc(d.name)}</a>` : 'Patologia removida'}${x.species_id ? ` <span class="small muted">(${esc(spName(x.species_id))})</span>` : ''}</span><span class="s" style="white-space:pre-line;color:var(--fg)">${esc(x.text)}</span><span class="s">${fmtDT(x.created_at)} · ${esc(nameOf(x.created_by))}</span></div><div class="row" style="gap:8px"><span class="badge ${x.status === 'resolvida' ? 'pub' : 'rev'}">${x.status === 'resolvida' ? 'Resolvida' : 'Aberta'}</span><button class="btn" type="button" data-act="sugg-toggle" data-id="${esc(x.id)}" data-st="${x.status === 'resolvida' ? 'aberta' : 'resolvida'}">${x.status === 'resolvida' ? 'Reabrir' : 'Marcar resolvida'}</button></div></div>`;
  }).join('')}</div>`}`;
}
function panelUsers() {
  const users = S.me.owner ? `<section class="col"><h2 class="sec-title">Contas cadastradas</h2>
    ${!S.users.length ? '<div class="note">Carregando contas…</div>' : `<div class="table-wrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th></tr></thead><tbody>
    ${S.users.map(u => `<tr><td><b>${esc(u.name || '—')}</b>${u.id === S.me.id ? ' <span class="badge">você</span>' : ''}</td><td class="small">${esc(u.email || '')}</td><td><label for="role-${u.id}" style="${srOnly}">Perfil de ${esc(u.name || u.email)}</label><select id="role-${u.id}" class="input" style="min-height:40px;padding:6px 10px;min-width:130px" data-role="${u.id}">${Object.entries(ROLES).map(([k, l]) => `<option value="${k}"${u.role === k ? ' selected' : ''}>${l}</option>`).join('')}</select></td></tr>`).join('')}
    </tbody></table></div>`}</section>` : '';
  return `<div><h1 style="font-size:26px;font-weight:800">Usuários e permissões</h1></div>
  <div class="card col"><b>Perfis</b>
    <div class="small" style="max-width:68ch;line-height:1.6">
      <p style="margin:0 0 8px"><b>Criador:</b> controle completo, inclusive excluir conteúdo, aprovar publicações e mudar perfis.</p>
      <p style="margin:0 0 8px"><b>Editor:</b> cadastra e altera conteúdo.</p>
      <p style="margin:0"><b>Usuário:</b> consulta, salva favoritos e sugere correções, sem alterar o conteúdo oficial. Toda conta nova começa como Usuário.</p>
    </div>
    <p class="tiny muted" style="margin:0">As permissões são conferidas pelo banco de dados em cada leitura e gravação.</p>
  </div>
  <div class="card col"><b>Publicação pelos editores</b>
    ${S.me.owner ? `<label class="check${S.config.editorsPublish ? ' on' : ''}" style="max-width:520px"><input type="checkbox" data-act="cfg-pub"${S.config.editorsPublish ? ' checked' : ''}> Editores publicam direto, sem aprovação do Criador</label>
    <span class="small muted">Desligado: o que um editor publicar fica “Em revisão” até o Criador aprovar em Patologias.</span>` : `<span class="small">${S.config.editorsPublish ? 'Suas publicações vão direto ao ar.' : 'Suas publicações ficam em revisão até o Criador aprovar.'}</span>`}
  </div>${users}`;
}

/* ---------- Editor de patologia ---------- */
const blankDisease = () => ({ id: null, name: '', scientific: '', synonyms: '', popular: '', agent: '', hideAgent: false, system: '', etiologyType: '', kind: '', specialty: '', zoonotic: false, surgical: false, procedures: [], species: [], status: 'rascunho', shared: {}, versions: {} });
function viewEditor(id) {
  if (!S.ready.boot || !S.ready.diseases || !S.ready.species) return `<div class="shell">${skeleton(6)}</div>`;
  if (!S.me.editor) return viewPanel('painel');
  if (!S.edit) {
    if (id) { if (!S.diseases[id]) return viewNotFound('Patologia não encontrada.'); S.edit = clone(S.diseases[id]); S.edit.isNew = false; }
    else { S.edit = blankDisease(); S.edit.id = crypto.randomUUID(); S.edit.isNew = true; }
    ['shared', 'versions'].forEach(k => { S.edit[k] = S.edit[k] || {}; });
    S.edit.procedures = S.edit.procedures || []; S.edit.species = S.edit.species || [];
    S.ui.edTab = 'geral';
  }
  const e = S.edit;
  const inp = (k, l, ph) => `<div class="field" style="flex:1 1 220px"><label for="e-${k}">${l}</label><input id="e-${k}" class="input" data-bind="${k}" value="${esc(e[k])}"${ph ? ` placeholder="${esc(ph)}"` : ''}></div>`;
  const spChecks = CATS.map(c => {
    const all = []; spTop(c.id).forEach(s => { all.push(s); spKids(s.id).forEach(k => all.push(k)); });
    if (!all.length) return '';
    return `<div class="col" style="gap:8px"><span class="lbl muted">${c.name}</span><div class="checks">${all.map(s => `<label class="check${e.species.includes(s.id) ? ' on' : ''}"><input type="checkbox" data-spcheck="${s.id}"${e.species.includes(s.id) ? ' checked' : ''}>${s.parent ? '↳ ' : ''}${esc(s.name)}</label>`).join('')}</div></div>`;
  }).join('');
  const tabs = [['geral', 'Geral (todas)']].concat(e.species.filter(x => S.species[x]).map(x => [x, spName(x)]));
  if (!tabs.find(t => t[0] === S.ui.edTab)) S.ui.edTab = 'geral';
  const T = S.ui.edTab;
  const src = T === 'geral' ? e.shared : (e.versions[T] || {});
  const copyOpts = tabs.filter(t => t[0] !== T).map(t => `<option value="${t[0]}">${esc(t[1])}</option>`).join('');
  const fields = FIELDS.map(([k, l]) => `<div class="field"><label for="c-${k}">${l}</label><textarea id="c-${k}" class="input" data-bind="c:${T}:${k}" placeholder="${T === 'geral' ? 'Texto compartilhado por todas as espécies' : 'Deixe vazio para usar o texto da aba Geral'}">${esc(src[k] || '')}</textarea></div>`).join('');
  const procs = e.procedures.map((p, i) => `<div class="inline-form"><div class="field"><label for="pn-${i}">Procedimento</label><input id="pn-${i}" class="input" data-bind="p:${i}:name" value="${esc(p.name)}"></div><div class="field"><label for="pi-${i}">Indicação</label><input id="pi-${i}" class="input" data-bind="p:${i}:indication" value="${esc(p.indication)}"></div><button class="btn danger" type="button" data-act="proc-del" data-i="${i}">Remover</button></div>`).join('');
  const isNew = e.isNew;
  const pubLabel = (S.me.owner || S.config.editorsPublish) ? 'Publicar' : 'Enviar para revisão';
  const conf = S.ui.confirm === 'del';
  return `<div class="shell" style="max-width:900px;padding-bottom:24px">
  ${backBar(isNew ? 'painel-doencas' : 'doenca-' + e.id, isNew ? 'Nova patologia' : 'Editar patologia', `<span class="badge ${STATUS[e.status || 'rascunho'][1]}">${STATUS[e.status || 'rascunho'][0]}</span>`)}
  <section class="card col"><h2 class="sec-title">Identificação</h2>
    <div class="row wrap" style="align-items:flex-start">${inp('name', 'Nome da doença *')}${inp('scientific', 'Nomenclatura científica')}</div>
    <div class="row wrap" style="align-items:flex-start">${inp('synonyms', 'Sinônimos', 'Separe por vírgula')}${inp('popular', 'Nome popular')}</div>
    <div class="row wrap" style="align-items:flex-end">${inp('agent', 'Agente etiológico ou etiologia principal')}<label class="check" style="flex:0 1 auto"><input type="checkbox" data-bind="hideAgent"${e.hideAgent ? ' checked' : ''}> Ocultar segunda linha na lista</label></div>
    <div class="row wrap" style="align-items:flex-start">${inp('system', 'Sistema orgânico', 'Ex.: Reprodutor')}${inp('etiologyType', 'Etiologia (filtro)', 'Ex.: Viral')}</div>
    <div class="row wrap" style="align-items:flex-start">${inp('kind', 'Tipo de doença', 'Ex.: Infecciosa')}${inp('specialty', 'Especialidade', 'Ex.: Teriogenologia')}</div>
    <label class="check" style="max-width:360px"><input type="checkbox" data-bind="zoonotic"${e.zoonotic ? ' checked' : ''}> Potencial zoonótico</label>
  </section>
  <section class="card col"><h2 class="sec-title">Espécies</h2><span class="small muted">A doença aparece em cada espécie marcada, e cada uma ganha sua própria versão do conteúdo.</span>${spChecks || '<div class="note">Cadastre espécies primeiro.</div>'}</section>
  <section class="card col"><h2 class="sec-title">Conteúdo clínico</h2>
    <div class="edtabs" role="tablist">${tabs.map(t => `<button type="button" role="tab" class="chip${t[0] === T ? ' on' : ''}" aria-selected="${t[0] === T}" data-act="edtab" data-t="${t[0]}">${esc(t[1])}</button>`).join('')}</div>
    <p class="small muted" style="margin:0">${T === 'geral' ? 'O que for escrito aqui vale para todas as espécies, exceto nos campos que uma espécie preencher com texto próprio.' : 'Campos preenchidos aqui valem só para ' + esc(spName(T)) + ' e não alteram as outras espécies.'} Formatação: “## ” para subtítulo, “- ” para lista, **negrito**, [texto](https://link).</p>
    ${copyOpts ? `<div class="inline-form"><div class="field"><label for="copyfrom">Copiar campos vazios desta aba a partir de</label><select id="copyfrom" class="input">${copyOpts}</select></div><button class="btn" type="button" data-act="copy-from">Copiar</button></div>` : ''}
    ${fields}
  </section>
  <section class="card col"><h2 class="sec-title">Tratamento cirúrgico</h2>
    <label class="check" style="max-width:360px"><input type="checkbox" data-bind="surgical"${e.surgical ? ' checked' : ''}> Possui indicação cirúrgica</label>
    ${e.surgical ? `${procs}<div><button class="btn" type="button" data-act="proc-add">+ Adicionar procedimento</button></div><span class="tiny muted">A página completa de cada cirurgia chega na Etapa 5.</span>` : ''}
  </section>
  ${!isNew ? `<section class="card col"><div class="row between wrap"><h2 class="sec-title">Histórico de versões</h2><button class="btn" type="button" data-act="hist">${S.ui.histOpen ? 'Ocultar' : 'Ver histórico'}</button></div>${S.ui.histOpen ? histHtml() : ''}</section>` : ''}
  <div class="savebar">
    <span class="grow small muted" id="savestate">${isNew ? 'Ainda não salva' : 'Alterações salvas automaticamente'}</span>
    ${conf ? `<span class="small">Excluir definitivamente?</span><button class="btn danger fill" type="button" data-act="del-yes">Excluir</button><button class="btn" type="button" data-act="del-no">Cancelar</button>` : `
    ${!isNew && S.me.owner ? `<button class="btn danger" type="button" data-act="del">Excluir</button>` : ''}
    ${!isNew && e.status !== 'arquivado' ? `<button class="btn" type="button" data-act="save" data-st="arquivado">Arquivar</button>` : ''}
    <button class="btn" type="button" data-act="save" data-st="rascunho">Salvar rascunho</button>
    <button class="btn pri" type="button" data-act="save" data-st="publicar">${pubLabel}</button>`}
  </div></div>`;
}
function histHtml() {
  if (S.hist === null) return '<div class="small muted">Carregando…</div>';
  if (!S.hist.length) return '<div class="small muted">Nenhuma versão salva ainda.</div>';
  return `<div class="list">${S.hist.map(h => `<div class="li"><div class="grow"><span class="t" style="font-size:14px">${esc(h.label || 'Versão salva')}</span><span class="s">${fmtDT(h.created_at)} · ${esc(nameOf(h.created_by))}</span></div><button class="btn" type="button" data-act="restore" data-id="${h.id}">Restaurar</button></div>`).join('')}</div>`;
}

/* ---------- Editor de características ---------- */
function viewChars(spId) {
  if (!S.ready.species) return `<div class="shell">${skeleton(5)}</div>`;
  const s = S.species[spId]; if (!s) return viewNotFound();
  if (!S.me.editor) return viewSpecies(spId);
  if (!S.edit) S.edit = { id: spId, chars: clone(s.chars || {}) };
  return `<div class="shell" style="max-width:900px;padding-bottom:24px">${backBar('esp-' + spId, 'Características: ' + s.name)}
  <p class="small muted" style="margin:0">Campos vazios não aparecem para os usuários. Formatação: “## ” subtítulo, “- ” lista, **negrito**.</p>
  ${CHARS.map(([k, l]) => `<div class="field"><label for="ch-${k}">${l}</label><textarea id="ch-${k}" class="input" data-bind="ch:${k}">${esc(S.edit.chars[k] || '')}</textarea></div>`).join('')}
  <div class="savebar"><span class="grow small muted" id="savestate"></span><button class="btn pri" type="button" data-act="chars-save">Salvar características</button></div></div>`;
}

/* ---------- Render ---------- */
function render(force) {
  if (!api.configured) { app.innerHTML = viewSetup(); return; }
  if (!S.session || S.recovery) { app.innerHTML = viewAuth(); S.lastRoute = '#auth'; return; }
  const r = route();
  const editorView = r === 'nova-doenca' || r.startsWith('editar-') || r.startsWith('carac-');
  if (editorView && !force && S.editRoute === r) return; // não apaga o que está sendo digitado
  let html;
  if (r === 'inicio') html = viewHome();
  else if (r.startsWith('cat-')) html = viewCategory(r.slice(4));
  else if (r.startsWith('esp-')) html = viewSpecies(r.slice(4));
  else if (r.startsWith('doenca-')) html = viewDisease(r.slice(7));
  else if (r === 'pesquisar') html = viewSearch();
  else if (r === 'medicacoes') html = viewMeds();
  else if (r === 'favoritos') html = viewFavorites();
  else if (r === 'perfil') html = viewProfile();
  else if (r === 'painel' || r.startsWith('painel-')) html = viewPanel(r);
  else if (r === 'nova-doenca') html = viewEditor(null);
  else if (r.startsWith('editar-')) html = viewEditor(r.slice(7));
  else if (r.startsWith('carac-')) html = viewChars(r.slice(6));
  else html = viewNotFound();
  const ae = document.activeElement; const active = ae && ae.id; let sel = null;
  if (active) { try { if (ae.selectionStart != null) sel = [ae.selectionStart, ae.selectionEnd]; } catch (e) { /* campo sem seleção */ } }
  const keep = {};
  if (S.lastRoute === r) app.querySelectorAll('input[id],textarea[id],select[id]').forEach(el => { if (el.dataset.bind || el.dataset.live || el.dataset.spcheck || el.dataset.role || el.dataset.filter) return; keep[el.id] = el.type === 'checkbox' ? el.checked : el.value; });
  S.lastRoute = r;
  app.innerHTML = html;
  Object.keys(keep).forEach(id => { const el = document.getElementById(id); if (!el) return; if (el.type === 'checkbox') el.checked = keep[id]; else el.value = keep[id]; });
  if (editorView && S.edit) S.editRoute = r;
  if (active) { const el = document.getElementById(active); if (el) { el.focus({ preventScroll: true }); if (sel && el.setSelectionRange) { try { el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* ignore */ } } } }
}

/* ---------- Carregamento ---------- */
async function reload(what) {
  try {
    if (!what || what === 'species') { S.species = await api.loadSpecies(); S.ready.species = true; }
    if (!what || what === 'diseases') { S.diseases = await api.loadDiseases(); S.ready.diseases = true; }
    if (!what || what === 'config') S.config = await api.loadConfig();
    if (!what) { [S.favorites, S.recent] = await Promise.all([api.loadFavorites(), api.loadRecent()]); }
    if ((!what || what === 'sugg') && S.me.editor) S.sugg = await api.loadSuggestions();
    if ((!what || what === 'users') && S.me.owner) S.users = await api.loadProfiles();
    S.loadErr = '';
  } catch (err) {
    S.loadErr = 'Não foi possível carregar os dados. ' + api.errMsg(err);
    S.ready.species = true; S.ready.diseases = true;
  }
  render(false);
}
async function startSession(session) {
  S.session = session;
  try {
    const p = await api.loadProfile(session.user.id);
    const role = (p && p.role) || 'usuario';
    S.me = { id: session.user.id, name: (p && p.name) || '', email: session.user.email || '', role, owner: role === 'criador', editor: role === 'criador' || role === 'editor' };
  } catch (err) {
    S.me = { id: session.user.id, name: '', email: session.user.email || '', role: 'usuario', owner: false, editor: false };
  }
  S.ready.boot = true;
  render(true);
  await reload();
  if (!S.channel) S.channel = api.watch(table => reload(table));
}
function stopSession() {
  if (S.channel) { api.sb.removeChannel(S.channel); S.channel = null; }
  Object.assign(S, { session: null, species: {}, diseases: {}, favorites: [], recent: [], sugg: [], users: [], names: {}, viewed: {} });
  S.ready = { species: false, diseases: false, boot: false };
  S.me = { id: null, name: '', email: '', role: 'usuario', owner: false, editor: false };
}

/* ---------- Gravações ---------- */
function setSaveState(t) { const el = document.getElementById('savestate'); if (el) el.textContent = t; }
const hhmm = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
function snapshotOf(e) { const s = clone(e); delete s.isNew; return s; }
function markDirty() {
  const e = S.edit; if (!e) return;
  if (route().startsWith('carac-')) { setSaveState('Alterações não salvas'); return; }
  if (e.isNew) { setSaveState('Ainda não salva'); return; }
  setSaveState('Salvando…'); clearTimeout(S.saveTimer); S.saveTimer = setTimeout(autosave, 1500);
}
async function autosave() {
  S.saveTimer = null; const e = S.edit; if (!e || e.isNew) return;
  if (!String(e.name || '').trim()) { setSaveState('Informe o nome para salvar'); return; }
  try {
    const saved = await api.saveDisease(e);
    if (saved.status !== e.status) { e.status = saved.status; }
    setSaveState('Salvo automaticamente às ' + hhmm());
  } catch (err) { setSaveState('Não salvou: ' + api.errMsg(err)); }
}
function flushAutosave() { if (S.saveTimer) { clearTimeout(S.saveTimer); autosave(); } }
async function saveDisease(mode) {
  const e = S.edit; if (!e || S.saving) return;
  if (!String(e.name || '').trim()) { toast('Informe o nome da doença.'); document.getElementById('e-name')?.focus(); return; }
  const st = mode === 'publicar' ? 'publicado' : mode;
  if (st === 'publicado' && !e.species.length) { toast('Marque ao menos uma espécie antes de publicar.'); return; }
  clearTimeout(S.saveTimer); S.saveTimer = null; S.saving = true; setSaveState('Salvando…');
  const prev = e.status; e.status = st;
  try {
    const saved = await api.saveDisease(e);
    e.status = saved.status;
    const label = { publicado: 'Publicada', revisao: 'Enviada para revisão', rascunho: 'Rascunho salvo', arquivado: 'Arquivada' }[saved.status];
    await api.addVersion(e.id, label, snapshotOf(e));
    toast(label);
    const wasNew = e.isNew; e.isNew = false;
    await reload('diseases');
    if (wasNew) { const keep = S.edit; location.hash = 'editar-' + e.id; setTimeout(() => { S.edit = keep; render(true); }, 0); }
    else render(true);
  } catch (err) { e.status = prev; toast(api.errMsg(err)); setSaveState('Não salvou'); }
  finally { S.saving = false; }
}
async function loadHist() {
  S.hist = null; render(true);
  try { S.hist = await api.loadHistory(S.edit.id); } catch (err) { S.hist = []; toast(api.errMsg(err)); }
  render(true);
}
async function restore(hid) {
  const h = (S.hist || []).find(x => x.id === hid); if (!h || !S.edit) return;
  const snap = Object.assign(clone(h.snapshot), { id: S.edit.id, isNew: false });
  try {
    const saved = await api.saveDisease(snap);
    snap.status = saved.status;
    await api.addVersion(S.edit.id, 'Restaurada de ' + fmtDT(h.created_at), snapshotOf(snap));
    S.edit = snap; toast('Versão restaurada');
    await reload('diseases'); loadHist();
  } catch (err) { toast(api.errMsg(err)); }
}
function markViewed(id) {
  if (S.viewed[id]) return; S.viewed[id] = true;
  S.recent = [id].concat(S.recent.filter(x => x !== id)).slice(0, 20);
  api.markViewed(S.me.id, id).catch(() => {});
}

/* ---------- Eventos ---------- */
document.addEventListener('click', async ev => {
  const t = ev.target.closest('[data-act]'); if (!t) return;
  const a = t.dataset.act;
  try {
    if (a === 'auth') { S.authMode = t.dataset.m; S.authErr = ''; S.authMsg = ''; render(true); return; }
    if (a === 'reload') { reload(); return; }
    if (a === 'pick-sp') { if (t.dataset.sp) S.ui.sp[t.dataset.d] = t.dataset.sp; return; }
    if (a === 'tab') { S.ui.tab = t.dataset.tab; S.ui.f = {}; render(true); return; }
    if (a === 'sp') { S.ui.sp[t.dataset.d] = t.dataset.sp; render(true); return; }
    if (a === 'mode') { S.ui.mode = t.dataset.mode; render(true); return; }
    if (a === 'fav') {
      const id = t.dataset.id; const on = !isFav(id);
      S.favorites = on ? [id].concat(S.favorites) : S.favorites.filter(x => x !== id); render(true);
      try { await api.toggleFavorite(S.me.id, id, on); toast(on ? 'Salvo nos favoritos' : 'Removido dos favoritos'); }
      catch (err) { S.favorites = on ? S.favorites.filter(x => x !== id) : [id].concat(S.favorites); render(true); toast(api.errMsg(err)); }
      return;
    }
    if (a === 'theme') { const v = t.dataset.v; try { v === 'auto' ? localStorage.removeItem('teuvet-theme') : localStorage.setItem('teuvet-theme', v); } catch (e) { /* sem armazenamento */ } applyTheme(); render(true); return; }
    if (a === 'logout') { await api.signOut(); return; }
    if (a === 'sugg-open') { S.ui.suggOpen = true; render(true); document.getElementById('sg-text')?.focus(); return; }
    if (a === 'sugg-close') { S.ui.suggOpen = false; render(true); return; }
    if (a === 'pfilter') { S.ui.pFilter = t.dataset.v; render(true); return; }
    if (a === 'approve') { await api.setDiseaseStatus(t.dataset.id, 'publicado'); const d = S.diseases[t.dataset.id]; await api.addVersion(d.id, 'Aprovada e publicada', snapshotOf(Object.assign({}, d, { status: 'publicado' }))); toast('Publicada'); reload('diseases'); return; }
    if (a === 'edtab') { S.ui.edTab = t.dataset.t; render(true); return; }
    if (a === 'proc-add') { S.edit.procedures.push({ name: '', indication: '' }); render(true); markDirty(); return; }
    if (a === 'proc-del') { S.edit.procedures.splice(+t.dataset.i, 1); render(true); markDirty(); return; }
    if (a === 'copy-from') {
      const from = document.getElementById('copyfrom').value; const e = S.edit; const T = S.ui.edTab;
      const src = from === 'geral' ? e.shared : (e.versions[from] || {});
      const dst = T === 'geral' ? e.shared : (e.versions[T] = e.versions[T] || {});
      let n = 0; FIELDS.forEach(([k]) => { if (src[k] && !(dst[k] && String(dst[k]).trim())) { dst[k] = src[k]; n++; } });
      render(true); markDirty(); toast(n ? `${n} ${n === 1 ? 'campo copiado' : 'campos copiados'}` : 'Nenhum campo vazio para copiar'); return;
    }
    if (a === 'save') { saveDisease(t.dataset.st); return; }
    if (a === 'del') { S.ui.confirm = 'del'; render(true); return; }
    if (a === 'del-no') { S.ui.confirm = null; render(true); return; }
    if (a === 'del-yes') { clearTimeout(S.saveTimer); S.saveTimer = null; await api.deleteDisease(S.edit.id); S.edit = null; toast('Patologia excluída'); await reload('diseases'); location.hash = 'painel-doencas'; return; }
    if (a === 'hist') { S.ui.histOpen = !S.ui.histOpen; if (S.ui.histOpen) loadHist(); else render(true); return; }
    if (a === 'restore') { restore(t.dataset.id); return; }
    if (a === 'chars-save') { await api.updateSpecies(S.edit.id, { chars: S.edit.chars }); toast('Características salvas'); setSaveState('Salvo às ' + hhmm()); reload('species'); return; }
    if (a === 'sp-edit') { S.ui.editSp = t.dataset.id; S.ui.addSp = null; S.ui.confirm = null; render(true); return; }
    if (a === 'sp-addkid') { S.ui.addSp = t.dataset.id; S.ui.editSp = null; render(true); return; }
    if (a === 'sp-cancel') { S.ui.editSp = null; S.ui.addSp = null; S.ui.confirm = null; render(true); return; }
    if (a === 'sp-confirm') { S.ui.confirm = 'sp:' + t.dataset.id; render(true); return; }
    if (a === 'sp-del') { await api.deleteSpecies(t.dataset.id); S.ui.confirm = null; toast('Espécie excluída'); reload('species'); return; }
    if (a === 'sugg-toggle') { await api.setSuggestionStatus(t.dataset.id, t.dataset.st); reload('sugg'); return; }
  } catch (err) { toast(api.errMsg(err)); }
});

document.addEventListener('change', async ev => {
  const t = ev.target;
  try {
    if (t.dataset.act === 'cfg-pub') { await api.setEditorsPublish(t.checked); toast('Configuração salva'); reload('config'); return; }
    if (t.dataset.role) { await api.setRole(t.dataset.role, t.value); toast('Perfil atualizado'); reload('users'); return; }
    if (t.dataset.filter) { S.ui.f[t.dataset.filter] = t.type === 'checkbox' ? t.checked : t.value; render(true); return; }
    if (t.dataset.bind === 'surgical') { S.edit.surgical = t.checked; if (t.checked && !S.edit.procedures.length) S.edit.procedures.push({ name: '', indication: '' }); render(true); markDirty(); return; }
    if (t.dataset.spcheck) { const id = t.dataset.spcheck; const s = S.edit.species; S.edit.species = t.checked ? s.concat(id) : s.filter(x => x !== id); render(true); markDirty(); return; }
  } catch (err) {
    toast(api.errMsg(err));
    if (t.dataset.act === 'cfg-pub') t.checked = !t.checked;
    if (t.dataset.role) reload('users');
  }
});

document.addEventListener('input', ev => {
  const t = ev.target;
  if (t.dataset.live) {
    S.ui[t.dataset.live] = t.value;
    if (t.dataset.live === 'pq') { const box = document.getElementById('ptable'); if (box) box.innerHTML = diseaseTable(filteredPanelDiseases()); return; }
    const box = document.getElementById('results'); if (box) box.innerHTML = resultsHtml(); return;
  }
  const b = t.dataset.bind; if (!b || !S.edit || b === 'surgical') return;
  const v = t.type === 'checkbox' ? t.checked : t.value;
  if (b.startsWith('c:')) { const [, tab, key] = b.split(':'); if (tab === 'geral') S.edit.shared[key] = v; else (S.edit.versions[tab] = S.edit.versions[tab] || {})[key] = v; }
  else if (b.startsWith('p:')) { const [, i, k] = b.split(':'); S.edit.procedures[+i][k] = v; }
  else if (b.startsWith('ch:')) S.edit.chars[b.slice(3)] = v;
  else S.edit[b] = v;
  markDirty();
});

document.addEventListener('submit', async ev => {
  const f = ev.target; const kind = f.dataset.form; if (!kind) return; ev.preventDefault();
  const fd = new FormData(f); const val = k => String(fd.get(k) || '').trim();
  const btn = f.querySelector('button[type="submit"]'); if (btn) btn.disabled = true;
  try {
    if (kind === 'signin') { S.authErr = ''; await api.signIn(val('email'), String(fd.get('password'))); return; }
    if (kind === 'signup') {
      S.authErr = ''; const r = await api.signUp(val('name'), val('email'), String(fd.get('password')));
      if (!r.session) { S.authMode = 'entrar'; S.authMsg = 'Conta criada. Enviamos um link de confirmação para ' + val('email') + '. Confirme e depois entre.'; render(true); }
      return;
    }
    if (kind === 'reset') { await api.sendReset(val('email')); S.authMode = 'entrar'; S.authMsg = 'Se existir uma conta com esse e-mail, enviamos um link para criar nova senha.'; S.authErr = ''; render(true); return; }
    if (kind === 'newpass') { await api.setPassword(String(fd.get('password'))); S.recovery = false; S.authMsg = ''; toast('Senha atualizada'); const s = await api.getSession(); if (s) startSession(s); else render(true); return; }
    if (kind === 'q' || kind === 'qs') { S.ui.mode = kind; if (kind === 'q') S.ui.q = String(fd.get('q') || ''); else S.ui.qs = String(fd.get('q') || ''); go('pesquisar'); return; }
    if (kind === 'sugg') {
      const d = S.diseases[route().slice(7)]; if (!d) return;
      const text = val('text'); if (!text) { toast('Descreva a correção.'); return; }
      const sp = (d.species || []).includes(S.ui.sp[d.id]) ? S.ui.sp[d.id] : ((d.species || [])[0] || null);
      await api.sendSuggestion({ diseaseId: d.id, sp, kind: String(fd.get('kind')), text });
      S.ui.suggOpen = false; render(true); toast('Sugestão enviada ao Criador'); return;
    }
    if (kind === 'myname') { await api.updateMyName(S.me.id, val('name')); S.me.name = val('name'); toast('Nome salvo'); render(true); return; }
    if (kind === 'sp-add') {
      const name = val('name'); if (!name) return;
      const cat = f.dataset.cat, parent = f.dataset.parent || null;
      const sibs = parent ? spKids(parent) : spTop(cat);
      const ids = [...f.querySelectorAll('input[id]')].map(x => x.id);
      await api.addSpecies({ name, scientific: val('scientific'), category: cat, parent, order: sibs.reduce((m, s) => Math.max(m, s.order || 0), 0) + 10 });
      S.ui.addSp = null; toast('Espécie adicionada'); await reload('species');
      ids.forEach(x => { const el = document.getElementById(x); if (el) el.value = ''; });
      return;
    }
    if (kind === 'sp-edit') { await api.updateSpecies(f.dataset.id, { name: val('name'), scientific: val('scientific'), order: Number(fd.get('order')) || 0 }); S.ui.editSp = null; toast('Espécie atualizada'); reload('species'); }
  } catch (err) {
    if (['signin', 'signup', 'reset', 'newpass'].includes(kind)) { S.authErr = api.errMsg(err); S.authMsg = ''; render(true); }
    else toast(api.errMsg(err));
  } finally { if (btn && btn.isConnected) btn.disabled = false; }
});

/* ---------- Tema ---------- */
function applyTheme() { const v = themeNow(); if (v === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', v); }

/* ---------- Início ---------- */
async function boot() {
  applyTheme();
  if (!api.configured) { render(true); return; }
  // link de e-mail vencido ou inválido volta com o erro no endereço
  const h = location.hash || '';
  if (h.includes('error_description=')) {
    const p = new URLSearchParams(h.slice(1));
    S.authErr = /expired|invalid/i.test(p.get('error_description') || '') ? 'Este link expirou ou já foi usado. Peça um novo.' : (p.get('error_description') || 'Não foi possível concluir pelo link.');
    history.replaceState(null, '', location.pathname);
  }
  app.innerHTML = `<div class="auth"><div class="logo">${LOGO(72)}<h1>TeuVet</h1><span class="muted">Carregando…</span></div></div>`;
  api.onAuth((event, session) => {
    if (event === 'PASSWORD_RECOVERY') { S.recovery = true; S.session = session; render(true); return; }
    if (event === 'SIGNED_OUT') { stopSession(); render(true); return; }
    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session && !S.recovery && (!S.session || S.session.user.id !== session.user.id)) { setTimeout(() => startSession(session), 0); return; }
    if (event === 'TOKEN_REFRESHED' && session) S.session = session;
    if (event === 'INITIAL_SESSION' && !session) render(true);
  });
}
boot();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
