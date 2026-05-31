// Cataloga os DADOS que o Agente de Escala enxerga.
// Honesto: so lista o que ele REALMENTE recebe no system prompt (via contexto + banco).
// Ajuda o RH a entender ate onde o agente pode ir e o que ainda nao acessa.

const FONTES = [
  // ============ ACESSANDO HOJE ============
  {
    grupo: '✅ Acessando hoje',
    cor: 'emerald',
    desc: 'Tudo que o agente VÊ em cada conversa.',
    itens: [
      {
        tabela: 'rh_escala_lancamentos (resumo)',
        emoji: '📅',
        titulo: 'Escala vigente do mês',
        campos: ['mês', 'qtd dias úteis', 'qtd colaboradores no setor', 'turnos lançados'],
        nota: 'Resumo, não o grid célula-por-célula (pra economizar tokens)',
      },
      {
        tabela: 'rh_colaboradores',
        emoji: '👤',
        titulo: 'Colaboradores do setor',
        campos: ['nome', 'cargo (nome)', 'jornada', 'rotação (6x1/5x2/etc)', 'rotação de domingo', 'horas/mês'],
        nota: 'Até 20 colaboradores por requisição. Sem salário, sem CPF, sem dados pessoais sensíveis.',
      },
      {
        tabela: 'rh_escala_regras_setor',
        emoji: '📋',
        titulo: 'Regras do Setor',
        campos: ['rotação padrão', 'dias de pico', 'picos por dia', 'cobertura mínima por turno/dia', 'funcionamento (abre/fecha)', 'custo da hora extra'],
        nota: 'Carregado automaticamente pelo backend quando empresa + setor selecionados.',
      },
      {
        tabela: 'rh_escala_memoria (Vault)',
        emoji: '🧠',
        titulo: 'Memórias salvas (estilo Obsidian)',
        campos: ['notas tipo "colaborador / setor / regra / padrão"', 'tags', 'conteúdo markdown'],
        nota: 'Filtradas por relevância na pergunta. O agente atualiza/cria notas sozinho durante a conversa.',
      },
      {
        tabela: 'rh_escala_agente_config',
        emoji: '🎭',
        titulo: 'Persona e regras do próprio agente',
        campos: ['nome', 'persona', 'tom', 'instruções extras (CLT, NR-1, ética)'],
        nota: 'É o "system prompt" que define como ele responde.',
      },
    ],
  },

  // ============ DISPONÍVEL NO SISTEMA, AINDA NÃO PASSADO PRO AGENTE ============
  {
    grupo: '🟡 No banco, mas ainda não enviado',
    cor: 'amber',
    desc: 'O sistema TEM esses dados, só não estão sendo passados pro agente hoje. Posso conectar quando precisar.',
    itens: [
      {
        tabela: 'rh_escala_ferias',
        emoji: '🏖️',
        titulo: 'Férias programadas',
        campos: ['colaborador', 'período', 'status'],
        nota: 'Hoje só evita escalar quem está de férias (regra dura), mas não considera nas sugestões.',
      },
      {
        tabela: 'rh_escala_licencas',
        emoji: '🤒',
        titulo: 'Atestados e licenças',
        campos: ['colaborador', 'tipo', 'data início/fim', 'CID (se houver)'],
        nota: 'Mesma situação das férias.',
      },
      {
        tabela: 'rh_escala_excessoes',
        emoji: '⚠️',
        titulo: 'Exceções manuais',
        campos: ['colaborador', 'data', 'tipo (folga extra/troca/etc)', 'motivo'],
        nota: 'O agente não vê os "ajustes manuais" feitos pelo RH no grid.',
      },
      {
        tabela: 'rh_escala_templates',
        emoji: '📐',
        titulo: 'Template individual do colaborador',
        campos: ['turno padrão', 'turno de sábado', 'turno de domingo', 'dia de folga fixa', 'comportamento em feriado'],
        nota: 'Hoje envia só "rotacao" e "rotacao_domingo" resumido.',
      },
      {
        tabela: 'rh_colaboradores (campos extras)',
        emoji: '📇',
        titulo: 'Dados administrativos',
        campos: ['data de admissão', 'tipo de contrato (CLT/aprendiz/temporário/PJ)', 'experiência (tempo de casa)', 'gestor direto'],
        nota: 'Útil pra escalar aprendiz com restrição CLT, ou identificar veteranos vs. novos.',
      },
      {
        tabela: 'rh_aso',
        emoji: '🩺',
        titulo: 'ASO (atestado médico ocupacional)',
        campos: ['data exame', 'apto/inapto', 'restrições médicas', 'vencimento'],
        nota: 'Pra não escalar quem está com ASO vencido ou com restrição médica específica.',
      },
      {
        tabela: 'rh_apontamentos',
        emoji: '📊',
        titulo: 'Histórico de pontuação',
        campos: ['horas trabalhadas reais', 'atrasos', 'faltas', 'banco de horas'],
        nota: 'Pra sugerir trocas baseadas em quem tem saldo no banco de horas, ou comparar previsto x realizado.',
      },
      {
        tabela: 'rh_advertencias',
        emoji: '📝',
        titulo: 'Advertências e ocorrências',
        campos: ['data', 'tipo', 'motivo', 'status'],
        nota: 'Sensível — só faria sentido pra escalas críticas. Provavelmente NÃO deve ser passado pra IA.',
      },
    ],
  },

  // ============ NÃO DISPONÍVEL / RESTRITO ============
  {
    grupo: '❌ Não recomendado / sensível demais',
    cor: 'rose',
    desc: 'Dados que existem no sistema mas que por privacidade/LGPD NÃO devem ir pra IA.',
    itens: [
      {
        tabela: 'rh_colaboradores (sensíveis)',
        emoji: '🔒',
        titulo: 'Dados pessoais sensíveis',
        campos: ['CPF', 'RG', 'endereço completo', 'telefone pessoal', 'salário', 'conta bancária', 'documentos PDFs'],
        nota: 'LGPD — não passar pra IA externa. O agente decide escala SEM saber salário.',
      },
      {
        tabela: 'rh_fichas_admissao',
        emoji: '📂',
        titulo: 'Ficha de admissão completa',
        campos: ['filhos', 'estado civil', 'religião', 'dependentes', 'PIS/INSS'],
        nota: 'Idem — LGPD.',
      },
      {
        tabela: 'rh_curriculos',
        emoji: '📄',
        titulo: 'Currículos e DISC',
        campos: ['curriculum completo', 'perfil DISC', 'experiência anterior'],
        nota: 'Outro escopo (recrutamento, não escala).',
      },
    ],
  },
];

export default function AgenteEscalaDados() {
  return (
    <div className="space-y-5">
      {/* Card explicativo */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="text-3xl">🔍</div>
          <div>
            <h3 className="font-semibold text-blue-900">O que a agente "vê" no nosso banco?</h3>
            <p className="text-sm text-blue-700 mt-0.5">
              Transparência total: aqui você vê <strong>exatamente</strong> quais tabelas e campos o agente acessa em cada conversa, o que está disponível mas ainda não foi conectado, e o que <strong>não</strong> deve ser enviado pra IA por motivos de LGPD.
            </p>
          </div>
        </div>
      </div>

      {FONTES.map(g => (
        <div key={g.grupo} className={`border border-${g.cor}-200 rounded-xl overflow-hidden`}>
          <div className={`bg-${g.cor}-50 border-b border-${g.cor}-200 px-4 py-3`}>
            <h3 className={`font-bold text-${g.cor}-900`}>{g.grupo}</h3>
            <p className={`text-xs text-${g.cor}-700 mt-0.5`}>{g.desc}</p>
          </div>
          <div className="divide-y divide-gray-100">
            {g.itens.map(it => (
              <div key={it.tabela} className="p-4 hover:bg-gray-50">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{it.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <h4 className="font-semibold text-gray-900">{it.titulo}</h4>
                      <code className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{it.tabela}</code>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {it.campos.map(c => (
                        <span key={c} className="text-[11px] bg-white border border-gray-200 px-1.5 py-0.5 rounded text-gray-700">{c}</span>
                      ))}
                    </div>
                    {it.nota && (
                      <p className="text-xs text-gray-500 mt-2 italic">{it.nota}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600">
        💡 <strong>Quer que ele acesse algo novo?</strong> Peça pra eu conectar uma das tabelas em <em>"No banco, mas ainda não enviado"</em>. É só ajustar o backend pra incluir esses campos no contexto.
      </div>
    </div>
  );
}
