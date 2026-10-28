// Testes das funções de busca, formatação e conversão. Rodar: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { norm, fuzzyHas, searchDiseases, searchSigns, md, fieldVal, diseaseFromRow, diseaseToRow } from '../src/util.js';

const spName = id => ({ caes: 'Cães', gatos: 'Gatos', bovinos: 'Bovinos' }[id] || id);
const base = {
  id: 'd1', name: 'Doença Exemplo', synonyms: 'Mal exemplar', popular: 'Exemplite', scientific: 'Morbus exempli', agent: 'Agentus testis',
  species: ['caes', 'gatos'], shared: { sinais: 'apatia' }, versions: { caes: { sinais: 'febre, anemia' }, gatos: {} }
};
const other = { id: 'd2', name: 'Outra Condição', agent: 'Outro agente', species: ['bovinos'], shared: {}, versions: { bovinos: { exames: 'ALT aumentada' } } };

test('normaliza acentos e maiúsculas', () => {
  assert.equal(norm('  Cães ÁGUA '), 'caes agua');
});

test('aceita pequenos erros de digitação', () => {
  assert.ok(fuzzyHas('doenca exemplo', 'exenplo'));
  assert.ok(fuzzyHas('leptospirose canina', 'leptopsirose'));
  assert.ok(!fuzzyHas('doenca exemplo', 'xyz'));
});

test('pesquisa por nome, sinônimo, nome popular, científico, agente e espécie', () => {
  const list = [base, other];
  assert.equal(searchDiseases(list, 'exemplo', spName)[0].id, 'd1');
  assert.equal(searchDiseases(list, 'exemplar', spName)[0].id, 'd1');
  assert.equal(searchDiseases(list, 'exemplite', spName)[0].id, 'd1');
  assert.equal(searchDiseases(list, 'morbus', spName)[0].id, 'd1');
  assert.equal(searchDiseases(list, 'agentus', spName)[0].id, 'd1');
  assert.equal(searchDiseases(list, 'bovinos', spName)[0].id, 'd2');
  assert.equal(searchDiseases(list, 'gatos', spName).length, 1);
  assert.equal(searchDiseases(list, '', spName).length, 0);
});

test('conteúdo da espécie tem prioridade sobre o geral', () => {
  assert.equal(fieldVal(base, 'caes', 'sinais'), 'febre, anemia');
  assert.equal(fieldVal(base, 'gatos', 'sinais'), 'apatia');
});

test('pesquisa por sinais separa encontrados e não encontrados, por espécie', () => {
  const { res } = searchSigns([base, other], 'febre, anemia, convulsão');
  assert.equal(res.length, 1);
  assert.equal(res[0].sp, 'caes');
  assert.deepEqual(res[0].hit, ['febre', 'anemia']);
  assert.deepEqual(res[0].miss, ['convulsão']);
  assert.equal(searchSigns([base, other], 'alt aumentada').res[0].d.id, 'd2');
  assert.equal(searchSigns([base, other], 'apatia', 'caes').res.length, 0);
});

test('formatação escapa HTML e monta listas e subtítulos', () => {
  const out = md('## Título\n- item **forte**\n<script>x</script>');
  assert.match(out, /<h4>Título<\/h4>/);
  assert.match(out, /<li>item <strong>forte<\/strong><\/li>/);
  assert.ok(!out.includes('<script>'));
  assert.match(md('[link](https://exemplo.com)'), /href="https:\/\/exemplo.com"/);
  assert.ok(!md('[x](javascript:alert(1))').includes('href'));
});

test('conversão banco <-> tela preserva versões por espécie e descarta campos vazios', () => {
  const { row, species } = diseaseToRow({ ...base, procedures: [{ name: '', indication: '' }, { name: 'OSH', indication: 'x' }] });
  assert.equal(row.procedures.length, 1);
  assert.deepEqual(species.find(s => s.species_id === 'gatos').content, {});
  const back = diseaseFromRow({ ...row, disease_species: species });
  assert.deepEqual(back.species, ['caes', 'gatos']);
  assert.equal(back.versions.caes.sinais, 'febre, anemia');
  assert.equal(back.hideAgent, false);
});
