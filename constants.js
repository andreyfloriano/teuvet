// Estrutura fixa da especificação do TeuVet

export const CATS = [
  { id: 'pequenos', name: 'Pequenos animais' },
  { id: 'grandes', name: 'Grandes animais' },
  { id: 'naoconv', name: 'Animais não convencionais' }
];

// Campos da página de patologia (o 14 — tratamento cirúrgico — é a seção própria de cirurgia)
export const FIELDS = [
  ['etiologia', 'Etiologia'], ['patogenia', 'Patogenia'], ['anamnese', 'Anamnese comum'], ['sinais', 'Sinais clínicos'],
  ['exames', 'Exames complementares e possíveis achados'], ['trat_imediato', 'Tratamento imediato'], ['trat_doenca', 'Tratamento da doença'],
  ['trat_secundarias', 'Tratamento de doenças secundárias'], ['graus', 'Graus da doença'], ['profilaxia', 'Profilaxia'],
  ['prognostico', 'Prognóstico'], ['observacoes', 'Observações complementares'], ['referencias', 'Referências bibliográficas (opcional)']
];

export const CHARS = [
  ['taxonomia', 'Classificação taxonômica'], ['anatomia', 'Anatomia'], ['fisiologia', 'Fisiologia'], ['comportamento', 'Comportamento'],
  ['parametros', 'Parâmetros fisiológicos'], ['hemato', 'Valores hematológicos'], ['bioq', 'Valores bioquímicos'], ['nutricao', 'Nutrição'],
  ['reproducao', 'Reprodução'], ['manejo', 'Manejo'], ['bemestar', 'Bem-estar'], ['contencao', 'Contenção'],
  ['particularidades', 'Particularidades clínicas'], ['observacoes', 'Observações complementares'], ['referencias', 'Referências (opcional)']
];

export const TOOLS = [
  ['Protocolos de emergência', 6], ['Calculadoras clínicas', 6], ['Exames laboratoriais', 6], ['Procedimentos cirúrgicos', 5],
  ['Comparador de patologias', 6], ['Casos clínicos comentados', 6], ['Zoonoses e biossegurança', 6]
];

export const SUGG_KINDS = ['Informação incorreta', 'Dose possivelmente desatualizada', 'Referência inadequada', 'Erro de digitação', 'Conteúdo incompleto', 'Outro problema'];

export const STATUS = { rascunho: ['Rascunho', ''], revisao: ['Em revisão', 'rev'], publicado: ['Publicado', 'pub'], arquivado: ['Arquivado', 'arq'] };

export const ROLES = { criador: 'Criador', editor: 'Editor', usuario: 'Usuário' };
