// IDs dos modulos principais (Kontrata.ai - so RH + Configuracoes)
export const MENU_MODULES = {
  DASHBOARD: 'dashboard',
  // RH no Radar
  RH_INDICADORES: 'rh-indicadores',
  RH_COLABORADORES: 'rh-colaboradores',
  RH_PONTO: 'rh-ponto',
  RH_RECRUTAMENTO: 'rh-recrutamento',
  RH_PESQUISA_CLIMA: 'rh-pesquisa-clima',
  RH_TREINAMENTOS: 'rh-treinamentos',
  RH_FINANCEIRO: 'rh-financeiro',
  RH_ESCALA: 'rh-escala',
  RH_DEPARTAMENTO_PESSOAL: 'rh-departamento-pessoal',
  RH_CONFIGURACOES: 'rh-configuracoes',
};

// IDs dos sub-menus (so RH)
export const MENU_SUBMENUS = {
  // Indicadores
  RH_INDICADORES_DASHBOARD: 'rh-indicadores-dashboard',

  // Colaboradores
  RH_CADASTRO_GERAL: 'rh-cadastro-geral',
  RH_DOCUMENTACAO: 'rh-documentacao',
  RH_SAUDE_OCUPACIONAL: 'rh-saude',
  RH_ADMISSOES: 'rh-admissoes',
  RH_DESLIGAMENTOS: 'rh-desligamentos',
  RH_RESULTADOS: 'rh-resultados',
  RH_CURRICULOS: 'rh-curriculo-banco',
  RH_MODELO_CURRICULO: 'rh-curriculo-modelo',

  // Ponto e Ausencias
  RH_AUSENCIAS: 'rh-ausencias',
  RH_ASO: 'rh-saude',

  // Recrutamento
  RH_VAGAS: 'rh-vagas',
  RH_RECRUTADOR_IA: 'rh-recrutador-ia',
  RH_METODO_DISC: 'rh-metodo-disc',
  RH_METODO_DISC_RESULTADOS: 'rh-metodo-disc-resultados',

  // Pesquisa de Clima
  RH_PESQUISA_CLIMA_CRIAR: 'rh-clima-criar',
  RH_PESQUISA_CLIMA_ANALISE: 'rh-clima-analise',

  // Treinamentos
  RH_TREINAMENTOS_LISTA: 'rh-cadastro-treinamento',

  // Financeiro
  RH_LANCAMENTOS: 'rh-lancamentos',
  RH_FOLHA: 'rh-folha',

  // Escala de Trabalho
  RH_ESCALA_GRID: 'rh-escala-grid',
  RH_ESCALA_TEMPLATE: 'rh-escala-template',
  RH_ESCALA_EVENTOS: 'rh-escala-eventos',
};

// Estrutura completa (usada pelo PermissionsSelector)
export const MENU_STRUCTURE = [
  // ========== RH NO RADAR ==========
  {
    id: MENU_MODULES.RH_INDICADORES,
    title: 'Indicadores RH',
    icon: 'chart',
    section: 'rh',
    submenus: [
      { id: MENU_SUBMENUS.RH_INDICADORES_DASHBOARD, title: 'Dashboards', path: '/rh/indicadores' },
    ],
  },
  {
    id: MENU_MODULES.RH_COLABORADORES,
    title: 'Colaboradores',
    icon: 'users',
    section: 'rh',
    submenus: [
      { id: MENU_SUBMENUS.RH_CADASTRO_GERAL, title: 'Cadastro Geral', path: '/rh/cadastro' },
      { id: MENU_SUBMENUS.RH_DOCUMENTACAO, title: 'Documentação', path: '/rh/documentacao' },
      { id: MENU_SUBMENUS.RH_ADMISSOES, title: 'Admissões', path: '/rh/admissoes' },
      { id: MENU_SUBMENUS.RH_DESLIGAMENTOS, title: 'Desligamentos', path: '/rh/desligamentos' },
      { id: MENU_SUBMENUS.RH_CURRICULOS, title: 'Banco de Currículos', path: '/rh/curriculos' },
      { id: MENU_SUBMENUS.RH_MODELO_CURRICULO, title: 'Modelo de Currículo', path: '/rh/modelo-curriculo' },
    ],
  },
  {
    id: MENU_MODULES.RH_PONTO,
    title: 'Ponto e Ausências',
    icon: 'clock',
    section: 'rh',
    submenus: [
      { id: MENU_SUBMENUS.RH_AUSENCIAS, title: 'Ausências', path: '/rh/ausencias' },
      { id: MENU_SUBMENUS.RH_ASO, title: 'Controle de ASO', path: '/rh/aso' },
    ],
  },
  {
    id: MENU_MODULES.RH_RECRUTAMENTO,
    title: 'Recrutamento',
    icon: 'briefcase',
    section: 'rh',
    submenus: [
      { id: MENU_SUBMENUS.RH_VAGAS, title: 'Vagas Abertas', path: '/rh/vagas' },
      { id: MENU_SUBMENUS.RH_RECRUTADOR_IA, title: 'Recrutador(a) Digital', path: '/rh/recrutador' },
      { id: MENU_SUBMENUS.RH_METODO_DISC, title: 'Método DISC', path: '/rh/metodo-disc' },
      { id: MENU_SUBMENUS.RH_METODO_DISC_RESULTADOS, title: 'Resultados DISC', path: '/rh/metodo-disc/resultados' },
    ],
  },
  {
    id: MENU_MODULES.RH_PESQUISA_CLIMA,
    title: 'Pesquisa de Clima',
    icon: 'smile',
    section: 'rh',
    submenus: [
      { id: MENU_SUBMENUS.RH_PESQUISA_CLIMA_ANALISE, title: 'Análise Pesquisas', path: '/rh/pesquisa-clima/analise' },
      { id: MENU_SUBMENUS.RH_PESQUISA_CLIMA_CRIAR, title: 'Criar Pesquisas', path: '/rh/pesquisa-clima/criar' },
    ],
  },
  {
    id: MENU_MODULES.RH_TREINAMENTOS,
    title: 'Treinamentos',
    icon: 'book',
    section: 'rh',
    submenus: [
      { id: MENU_SUBMENUS.RH_TREINAMENTOS_LISTA, title: 'Treinamentos', path: '/rh/treinamentos' },
    ],
  },
  {
    id: MENU_MODULES.RH_FINANCEIRO,
    title: 'Financeiro RH',
    icon: 'dollar',
    section: 'rh',
    submenus: [
      { id: MENU_SUBMENUS.RH_LANCAMENTOS, title: 'Lançamentos Financeiros', path: '/rh/lancamentos' },
      { id: MENU_SUBMENUS.RH_FOLHA, title: 'Folha de Pagamento', path: '/rh/folha' },
    ],
  },
  {
    id: MENU_MODULES.RH_ESCALA,
    title: 'Escala de Trabalho',
    icon: 'calendar',
    section: 'rh',
    submenus: [
      { id: MENU_SUBMENUS.RH_ESCALA_GRID, title: 'Grade da Escala', path: '/rh/escala' },
      { id: MENU_SUBMENUS.RH_ESCALA_TEMPLATE, title: 'Templates', path: '/rh/escala/template' },
      { id: MENU_SUBMENUS.RH_ESCALA_EVENTOS, title: 'Férias / Licenças', path: '/rh/escala/eventos' },
    ],
  },
  {
    id: MENU_MODULES.RH_DEPARTAMENTO_PESSOAL,
    title: 'Departamento Pessoal',
    icon: 'folder',
    section: 'rh',
    submenus: [],
  },
  {
    id: MENU_MODULES.RH_CONFIGURACOES,
    title: 'Configurações RH',
    icon: 'settings',
    section: 'rh',
    submenus: [],
  },
];
