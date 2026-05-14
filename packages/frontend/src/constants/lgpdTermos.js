// Lista compartilhada dos termos LGPD obrigatorios.
// Usada em: LgpdTab.jsx (Configuracoes) e AdminSetup.jsx (wizard de primeiro acesso)
export const TERMOS_LGPD = [
  {
    id: 'termos_uso',
    versao: 'v1.0',
    titulo: 'Termos de Uso',
    descricao: 'Regras de uso da plataforma Kontrata.ai.',
    arquivo: '/docs/legal/01-TERMOS-DE-USO.md',
    obrigatorio: true,
  },
  {
    id: 'politica_privacidade',
    versao: 'v1.0',
    titulo: 'Política de Privacidade',
    descricao: 'Como coletamos, usamos e protegemos dados pessoais.',
    arquivo: '/docs/legal/02-POLITICA-DE-PRIVACIDADE.md',
    obrigatorio: true,
  },
  {
    id: 'dpa',
    versao: 'v1.0',
    titulo: 'DPA — Contrato de Operador',
    descricao: 'Contrato que define quem é Controlador (você) e Operador (Kontrata.ai) dos dados.',
    arquivo: '/docs/legal/03-DPA-CONTRATO-OPERADOR.md',
    obrigatorio: true,
  },
];
