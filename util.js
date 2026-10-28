// Funções puras (sem banco nem tela) — testadas em tests/util.test.js

export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export const clone = o => JSON.parse(JSON.stringify(o == null ? {} : o));

export const byName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR', { sensitivity: 'base' });

export const fmtDate = v => v ? new Date(v).toLocaleDateString('pt-BR') : '—';
export const fmtDT = v => v ? new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

// Distância de edição (erros de digitação)
export function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

// O texto (já normalizado) contém o termo, aceitando 1 erro em termos de 4+ letras e 2 em termos de 7+
export function fuzzyHas(hay, term) {
  if (!term) return true;
  if (hay.includes(term)) return true;
  const tol = term.length >= 7 ? 2 : term.length >= 4 ? 1 : 0;
  if (!tol) return false;
  const words = hay.split(/[^a-z0-9]+/).filter(Boolean);
  if (words.some(w => Math.abs(w.length - term.length) <= tol && lev(w, term) <= tol)) return true;
  // termo de várias palavras: compara com janelas do mesmo tamanho
  const tw = term.split(/\s+/).length;
  if (tw > 1) {
    for (let i = 0; i + tw <= words.length; i++) {
      const win = words.slice(i, i + tw).join(' ');
      if (Math.abs(win.length - term.length) <= tol && lev(win, term) <= tol) return true;
    }
  }
  return false;
}

// Texto que vale para a espécie: o próprio da espécie ou, se vazio, o da aba Geral
export function fieldVal(d, sp, key) {
  const v = d.versions && d.versions[sp] && d.versions[sp][key];
  return (v && String(v).trim()) ? v : ((d.shared && d.shared[key]) || '');
}

// Pesquisa por doença: nome, sinônimos, nome popular, científico, agente e espécie
export function searchDiseases(list, q, spName) {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return list.map(d => {
    const spn = (d.species || []).map(spName).join(' ');
    const parts = [[norm(d.name), 6], [norm(d.synonyms) + ' ' + norm(d.popular) + ' ' + norm(d.scientific), 4], [norm(d.agent), 3], [norm(spn), 2]];
    let score = 0;
    for (const t of terms) {
      let best = 0;
      for (const [h, w] of parts) {
        if (h.includes(t)) best = Math.max(best, w + 1);
        else if (fuzzyHas(h, t)) best = Math.max(best, w);
      }
      if (!best) return null;
      score += best;
    }
    return { d, score };
  }).filter(Boolean).sort((a, b) => b.score - a.score || byName(a.d, b.d)).map(x => x.d);
}

// Pesquisa por sinais/exames: compara cada termo com Sinais, Exames e Anamnese de cada espécie
export function searchSigns(list, q, spFilter) {
  const terms = String(q || '').split(/[,;\n]+/).map(t => t.trim()).filter(Boolean);
  const res = [];
  if (!terms.length) return { terms, res };
  list.forEach(d => {
    (d.species || []).forEach(sp => {
      if (spFilter && sp !== spFilter) return;
      const hay = norm(['sinais', 'exames', 'anamnese'].map(k => fieldVal(d, sp, k)).join(' \n '));
      if (!hay) return;
      const hit = [], miss = [];
      terms.forEach(t => (fuzzyHas(hay, norm(t)) ? hit : miss).push(t));
      if (hit.length) res.push({ d, sp, hit, miss });
    });
  });
  res.sort((a, b) => b.hit.length - a.hit.length || byName(a.d, b.d));
  return { terms, res };
}

// Formatação simples: "## " subtítulo, "- " lista, **negrito**, *itálico*, [texto](https://link)
function inl(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}
export function md(t) {
  if (!t || !String(t).trim()) return '';
  const lines = esc(t).split('\n');
  let out = '', list = false, para = [];
  const flush = () => { if (para.length) { out += '<p>' + para.join('<br>') + '</p>'; para = []; } };
  for (const l of lines) {
    const s = l.trim();
    if (/^[-•] /.test(s)) { flush(); if (!list) { out += '<ul>'; list = true; } out += '<li>' + inl(s.slice(2)) + '</li>'; continue; }
    if (list) { out += '</ul>'; list = false; }
    if (s.startsWith('## ')) { flush(); out += '<h4>' + inl(s.slice(3)) + '</h4>'; continue; }
    if (!s) { flush(); continue; }
    para.push(inl(s));
  }
  flush();
  if (list) out += '</ul>';
  return out;
}

// Converte linha do banco (snake_case + disease_species) para o formato usado nas telas
export function diseaseFromRow(r) {
  const ds = r.disease_species || [];
  const versions = {};
  ds.forEach(x => { versions[x.species_id] = x.content || {}; });
  return {
    id: r.id, name: r.name || '', scientific: r.scientific || '', synonyms: r.synonyms || '', popular: r.popular || '',
    agent: r.agent || '', hideAgent: !!r.hide_agent, system: r.system || '', etiologyType: r.etiology_type || '',
    kind: r.kind || '', specialty: r.specialty || '', zoonotic: !!r.zoonotic, surgical: !!r.surgical,
    procedures: Array.isArray(r.procedures) ? r.procedures : [], shared: r.shared || {}, status: r.status || 'rascunho',
    species: ds.map(x => x.species_id), versions,
    createdAt: r.created_at, createdBy: r.created_by, updatedAt: r.updated_at, updatedBy: r.updated_by
  };
}

// Formato das telas -> linha do banco (sem autoria/datas: o banco preenche)
export function diseaseToRow(d) {
  const clean = o => { const out = {}; Object.keys(o || {}).forEach(k => { const v = String(o[k] ?? ''); if (v.trim()) out[k] = v; }); return out; };
  return {
    row: {
      id: d.id, name: String(d.name || '').trim(), scientific: d.scientific || '', synonyms: d.synonyms || '', popular: d.popular || '',
      agent: d.agent || '', hide_agent: !!d.hideAgent, system: d.system || '', etiology_type: d.etiologyType || '', kind: d.kind || '',
      specialty: d.specialty || '', zoonotic: !!d.zoonotic, surgical: !!d.surgical,
      procedures: (d.procedures || []).filter(p => String(p.name || '').trim() || String(p.indication || '').trim()),
      shared: clean(d.shared), status: d.status || 'rascunho'
    },
    species: (d.species || []).map(sp => ({ disease_id: d.id, species_id: sp, content: clean((d.versions || {})[sp]) }))
  };
}
