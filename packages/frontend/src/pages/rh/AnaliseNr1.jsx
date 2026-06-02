import { useEffect, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../utils/api';

import CanalDenunciaAdmin from './CanalDenunciaAdmin';

const ABAS = [
  { id: 'diagnostico', label: 'Diagnóstico',       icon: '📊' },
  { id: 'sugestoes',   label: 'Sugestões de Ação', icon: '💡' },
  { id: 'planos',      label: 'Planos de Ação',    icon: '📋' },
  { id: 'denuncia',    label: 'Canal de Denúncia', icon: '🛡️' },
];

// Catalogo de labels amigaveis das dimensoes (vs dimensao_nr1 que vem em snake_case)
const DIMENSAO_LABEL = {
  demandas_quantitativas:  'Sobrecarga / Demandas',
  demandas_cognitivas:     'Demandas Cognitivas',
  demandas_emocionais:     'Demandas Emocionais',
  autonomia:               'Autonomia',
  desenvolvimento:         'Desenvolvimento',
  significado:             'Significado do Trabalho',
  previsibilidade:         'Previsibilidade',
  reconhecimento:          'Reconhecimento',
  clareza_papel:           'Clareza de Papel',
  conflito_papel:          'Conflito de Papel',
  qualidade_lideranca:     'Qualidade da Liderança',
  apoio_gestor:            'Apoio do Gestor',
  apoio_colegas:           'Apoio dos Colegas',
  comunidade_social:       'Clima entre Colegas',
  inseguranca:             'Insegurança no Emprego',
  conflito_trabalho_familia:'Conflito Trabalho-Família',
  hiperconectividade:      'Hiperconectividade',
  confianca:               'Confiança na Direção',
  justica:                 'Justiça Organizacional',
  saude_geral:             'Saúde Geral',
  estresse:                'Estresse',
  burnout:                 'Burnout',
  sono:                    'Sono / Descanso',
  assedio_moral:           'Assédio Moral',
  assedio_sexual:          'Assédio Sexual',
  violencia_ameaca:        'Ameaças de Violência',
  violencia_fisica:        'Violência Física',
  discriminacao:           'Discriminação',
};

const BLOCO_LABEL = {
  exigencias: 'Exigências do Trabalho',
  organizacao: 'Organização e Conteúdo',
  relacoes: 'Relações e Liderança',
  interface: 'Trabalho ↔ Vida',
  valores: 'Valores no Trabalho',
  saude: 'Saúde e Bem-Estar',
  ofensivos: 'Comportamentos Ofensivos',
};

const COR_CLASS = {
  verde:    { bg: 'bg-emerald-500', border: 'border-emerald-700', text: 'text-white', dot: 'bg-emerald-500', label: 'Baixo' },
  amarelo:  { bg: 'bg-amber-500',   border: 'border-amber-700',   text: 'text-white', dot: 'bg-amber-500',   label: 'Moderado' },
  vermelho: { bg: 'bg-red-600',     border: 'border-red-800',     text: 'text-white', dot: 'bg-red-500',     label: 'Alto' },
  cinza:    { bg: 'bg-gray-100',    border: 'border-gray-300',    text: 'text-gray-500', dot: 'bg-gray-400', label: '—' },
};

export default function AnaliseNr1() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [aba, setAba] = useState('diagnostico');

  // Empresa global — TODAS as analises NR-1 ficam por loja (cada loja tem seu
  // PGR psicossocial proprio, conforme exigencia da NR-1). Setor (departamento)
  // do colaborador da empresa selecionada.
  const [empresas, setEmpresas] = useState([]);
  const [empresaSel, setEmpresaSel] = useState('');
  const [departamentos, setDepartamentos] = useState([]);  // todos
  const [colaboradores, setColaboradores] = useState([]);  // pra derivar setores por empresa

  useEffect(() => {
    (async () => {
      try {
        const [empR, depR, colR] = await Promise.all([
          api.get('/rh/empresas'),
          api.get('/rh/configuracoes/departamentos'),
          api.get('/rh/colaboradores?status=ativo&limit=500'),
        ]);
        const asArr = (resp, key) => {
          const d = resp?.data;
          if (Array.isArray(d)) return d;
          if (key && Array.isArray(d?.[key])) return d[key];
          if (Array.isArray(d?.data)) return d.data;
          return [];
        };
        const empList = asArr(empR, 'empresas');
        setEmpresas(empList);
        setDepartamentos(asArr(depR));
        setColaboradores(asArr(colR, 'colaboradores'));
        // Default: empresa principal ou primeira
        if (empList.length > 0) {
          const principal = empList.find(x => x.isPrincipal) || empList[0];
          setEmpresaSel(String(principal.id));
        }
      } catch (e) { console.error(e); }
    })();
  }, []);

  // Mostra TODOS os setores cadastrados (rh_departamentos e global, nao por empresa).
  // colaboradores fica disponivel pra outras heuristicas se precisar.
  void colaboradores;
  const empresaCtx = { empresaSel, empresas, departamentos };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 overflow-y-auto">
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white px-6 py-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">🧠 Análise NR-1</h1>
              <p className="text-orange-100 text-sm">Diagnóstico de riscos psicossociais (NR-1) — farol por dimensão, sugestões e planos de ação</p>
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2 border border-white/30">
              <span className="text-xs font-semibold uppercase tracking-wide">🏪 Loja:</span>
              <select value={empresaSel} onChange={e => setEmpresaSel(e.target.value)}
                className="bg-white text-gray-800 px-3 py-1.5 rounded text-sm font-medium min-w-[200px]">
                {empresas.length === 0 && <option value="">(carregando...)</option>}
                {empresas.map(e => (
                  <option key={e.id} value={e.id}>{e.apelido || e.nomeFantasia || e.razaoSocial || '(sem nome)'}</option>
                ))}
              </select>
            </div>
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-purple-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Abas */}
        <div className="px-6 bg-white border-b border-gray-200 flex gap-1 overflow-x-auto sticky top-0 z-10">
          {ABAS.map(a => (
            <button key={a.id} onClick={() => setAba(a.id)}
              className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition ${
                aba === a.id
                  ? 'border-purple-600 text-purple-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}>
              <span className="mr-1.5">{a.icon}</span>
              {a.label}
            </button>
          ))}
        </div>

        <div className="p-4 md:p-6">
          {aba === 'diagnostico' && <AbaDiagnostico empresaCtx={empresaCtx} />}
          {aba === 'sugestoes' && <AbaSugestoes empresaCtx={empresaCtx} />}
          {aba === 'planos' && <AbaPlanos empresaCtx={empresaCtx} />}
          {aba === 'denuncia' && <CanalDenunciaAdmin empresaCtx={empresaCtx} />}
        </div>
      </div>
    </div>
  );
}

function AbaDiagnostico({ empresaCtx }) {
  const [loading, setLoading] = useState(true);
  const [modeloId, setModeloId] = useState(null);
  const [data, setData] = useState(null);
  const empresaSel = empresaCtx?.empresaSel;

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const r = await api.get('/pesquisa-clima/modelos');
        const modelos = Array.isArray(r.data) ? r.data : [];
        const nr1 = modelos.find(m => /NR-1/i.test(m.nome) || /Riscos Psicossociais/i.test(m.nome));
        if (!nr1) { setLoading(false); return; }
        setModeloId(nr1.id);
        const qs = empresaSel ? `?empresa_id=${empresaSel}` : '';
        const d = await api.get(`/pesquisa-clima/nr1/diagnostico/${nr1.id}${qs}`);
        setData(d.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [empresaSel]);

  if (loading) return <div className="p-12 text-center text-gray-400">Carregando diagnóstico...</div>;
  if (!modeloId) return <div className="p-12 text-center text-gray-500">Template NR-1 não encontrado.</div>;
  if (!data || !data.setores?.length) {
    return (
      <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
        <div className="text-5xl mb-3">📊</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Sem respostas ainda</h2>
        <p className="text-gray-600">Crie uma rodada da pesquisa NR-1 e colete respostas pra ver o diagnóstico.</p>
      </div>
    );
  }

  // Calcula alertas criticos: top 8 (rodada, dimensao) com score vermelho
  const alertas = [];
  for (const s of data.setores) {
    for (const d of s.dimensoes) {
      if (d.classificacao === 'vermelho') {
        alertas.push({ ...d, setor: s.rodada_nome, total: s.total_respostas });
      }
    }
  }
  alertas.sort((a, b) => (a.score || 0) - (b.score || 0));
  const topAlertas = alertas.slice(0, 8);

  // Lista de blocos pra agrupar o heatmap
  const blocosOrdem = ['exigencias','organizacao','relacoes','interface','valores','saude','ofensivos'];

  // Mapa dimensao -> bloco (pega do primeiro setor que tenha)
  const dimBloco = {};
  for (const s of data.setores) {
    for (const d of s.dimensoes) {
      if (!dimBloco[d.dimensao]) dimBloco[d.dimensao] = d.bloco;
    }
  }
  const dimensoesAgrupadas = blocosOrdem.map(b => ({
    bloco: b,
    label: BLOCO_LABEL[b] || b,
    dimensoes: (data.todasDimensoes || []).filter(d => dimBloco[d] === b),
  })).filter(g => g.dimensoes.length > 0);

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard emoji="🏪" label="Setores avaliados"      value={data.setores.length} />
        <StatCard emoji="👥" label="Total de respostas"     value={data.setores.reduce((a, s) => a + (s.total_respostas || 0), 0)} />
        <StatCard emoji="🚨" label="Alertas críticos (🔴)" value={alertas.length} color="red" />
        <StatCard emoji="📐" label="Dimensões avaliadas"    value={(data.todasDimensoes || []).length} />
      </div>

      {/* Alertas críticos */}
      {topAlertas.length > 0 && (
        <div className="bg-white rounded-lg border border-red-200 overflow-hidden">
          <div className="bg-red-50 px-4 py-3 border-b border-red-200">
            <h2 className="text-lg font-bold text-red-800 flex items-center gap-2">
              🚨 Alertas Críticos — Risco Alto (priorize estes)
            </h2>
            <p className="text-xs text-red-700 mt-0.5">A NR-1 exige plano de ação documentado pra todos os fatores em risco alto.</p>
          </div>
          <div className="divide-y divide-gray-100">
            {topAlertas.map((a, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3 hover:bg-red-50/40">
                <span className="text-2xl">🔴</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-800">{DIMENSAO_LABEL[a.dimensao] || a.dimensao}</div>
                  <div className="text-xs text-gray-500">{a.setor} · {a.n_respostas} resposta(s)</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-red-700">{a.score}<span className="text-sm font-normal text-gray-400">/100</span></div>
                  <div className="text-[10px] uppercase tracking-wide text-red-600 font-bold">Risco Alto</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Heatmap setor × dimensão, agrupado por bloco */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">Heatmap por Setor × Dimensão</h2>
          <p className="text-xs text-gray-500">Score 0-100: quanto menor, mais grave. Plano de ação obrigatório pros itens em risco alto.</p>
          <LegendaRiscos />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-gray-600 sticky left-0 bg-gray-50 z-10">Dimensão</th>
                {data.setores.map(s => (
                  <th key={s.rodada_id} className="text-center px-3 py-2 font-semibold text-gray-600 min-w-[110px]">
                    <div className="truncate" title={s.rodada_nome}>{s.rodada_nome.replace(/^NR-1.*— /, '')}</div>
                    <div className="text-[10px] font-normal text-gray-400">{s.total_respostas} resp.</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dimensoesAgrupadas.map(grupo => (
                <>
                  <tr key={`g-${grupo.bloco}`} className="bg-gray-100">
                    <td colSpan={data.setores.length + 1} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-gray-600">{grupo.label}</td>
                  </tr>
                  {grupo.dimensoes.map(dim => (
                    <tr key={dim} className="border-t border-gray-100 hover:bg-gray-50/50">
                      <td className="px-3 py-2 text-gray-700 sticky left-0 bg-white">{DIMENSAO_LABEL[dim] || dim}</td>
                      {data.setores.map(s => {
                        const cell = s.dimensoes.find(d => d.dimensao === dim);
                        if (!cell || cell.score === null) {
                          const c = COR_CLASS.cinza;
                          return <td key={s.rodada_id} className={`px-3 py-2 text-center text-xs ${c.text}`}>—</td>;
                        }
                        const c = COR_CLASS[cell.classificacao] || COR_CLASS.cinza;
                        return (
                          <td key={s.rodada_id} className="px-2 py-1.5 text-center">
                            <div className={`inline-flex flex-col items-center justify-center w-20 py-1.5 rounded-md border-2 ${c.bg} ${c.border} ${c.text} font-bold shadow-sm`}
                                 title={`Score ${cell.score}/100 — Risco ${c.label}`}>
                              <span className="text-lg leading-none">{cell.score}</span>
                              <span className="text-[9px] font-bold uppercase tracking-wide opacity-90">{c.label}</span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ emoji, label, value, color }) {
  const bar = color === 'red' ? 'bg-red-500' : 'bg-purple-500';
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden flex items-stretch">
      <div className="flex-1 p-3 flex items-center gap-3">
        <div className="text-2xl">{emoji}</div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">{label}</p>
          <p className="text-xl font-bold text-gray-800">{value}</p>
        </div>
      </div>
      <div className={`w-1.5 ${bar}`} />
    </div>
  );
}

function LegendaRiscos() {
  return (
    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
      <div className="flex items-center gap-3 bg-red-50 border-2 border-red-300 rounded-lg px-3 py-2">
        <span className="w-5 h-5 bg-red-500 rounded-full shrink-0"></span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-red-800">🚨 Risco Alto</div>
          <div className="text-[11px] text-red-700">Score 0-33 · ação urgente exigida</div>
        </div>
      </div>
      <div className="flex items-center gap-3 bg-amber-50 border-2 border-amber-300 rounded-lg px-3 py-2">
        <span className="w-5 h-5 bg-amber-500 rounded-full shrink-0"></span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-amber-800">⚠️ Risco Moderado</div>
          <div className="text-[11px] text-amber-700">Score 34-66 · monitorar e prevenir</div>
        </div>
      </div>
      <div className="flex items-center gap-3 bg-emerald-50 border-2 border-emerald-300 rounded-lg px-3 py-2">
        <span className="w-5 h-5 bg-emerald-500 rounded-full shrink-0"></span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-emerald-800">✅ Risco Baixo</div>
          <div className="text-[11px] text-emerald-700">Score 67-100 · situação saudável</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ABA 2 — SUGESTÕES DE AÇÃO
// ============================================================

const CATEGORIA_LABEL = {
  treinamento:    { label: 'Treinamento',    color: 'blue',   icon: '🎓' },
  programa:       { label: 'Programa',        color: 'purple', icon: '📋' },
  politica:       { label: 'Política',        color: 'amber',  icon: '📜' },
  reorganizacao:  { label: 'Reorganização',   color: 'orange', icon: '🔄' },
  canal:          { label: 'Canal de Escuta', color: 'teal',   icon: '📞' },
};

function AbaSugestoes({ empresaCtx }) { // eslint-disable-line no-unused-vars
  const [sugestoes, setSugestoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroDim, setFiltroDim] = useState('');
  const [busca, setBusca] = useState('');
  const [sugSelec, setSugSelec] = useState(null); // sugestao escolhida pra criar plano
  const [novaSug, setNovaSug] = useState(null); // dimensao pra criar nova sugestao

  const carregar = async () => {
    try {
      const r = await api.get('/pesquisa-clima/nr1/sugestoes');
      setSugestoes(Array.isArray(r.data) ? r.data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { carregar(); }, []);

  const dimensoes = Array.from(new Set(sugestoes.map(s => s.dimensao_nr1)));
  const filtradas = sugestoes.filter(s => {
    if (filtroDim && s.dimensao_nr1 !== filtroDim) return false;
    if (busca) {
      const q = busca.toLowerCase();
      if (!s.titulo.toLowerCase().includes(q) && !s.descricao.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Agrupa por dimensao pra exibir
  const grupos = {};
  for (const s of filtradas) {
    if (!grupos[s.dimensao_nr1]) grupos[s.dimensao_nr1] = [];
    grupos[s.dimensao_nr1].push(s);
  }

  if (loading) return <div className="p-12 text-center text-gray-400">Carregando catálogo...</div>;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 flex flex-col md:flex-row gap-3">
        <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por título ou descrição..."
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
        <select value={filtroDim} onChange={e => setFiltroDim(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
          <option value="">Todas as dimensões ({sugestoes.length})</option>
          {dimensoes.map(d => (
            <option key={d} value={d}>{DIMENSAO_LABEL[d] || d}</option>
          ))}
        </select>
      </div>

      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-800">
        💡 <strong>{sugestoes.length} sugestões</strong> pré-cadastradas baseadas no Manual GRO/PGR do MTE. Clique em <strong>"+ Adicionar ao Plano"</strong> pra criar um plano de ação a partir de uma sugestão.
      </div>

      <BibliotecaMateriais />


      {Object.keys(grupos).length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
          Nenhuma sugestão encontrada com os filtros aplicados.
        </div>
      )}

      {Object.entries(grupos).map(([dim, lista]) => (
        <div key={dim} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between gap-2">
            <h3 className="font-bold text-gray-700">{DIMENSAO_LABEL[dim] || dim} <span className="text-xs font-normal text-gray-400">({lista.length})</span></h3>
            <button onClick={() => setNovaSug({ dimensao_nr1: dim })}
              className="text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 font-bold px-3 py-1 rounded-lg shrink-0">
              + Nova sugestão
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {lista.map(s => {
              const cat = CATEGORIA_LABEL[s.categoria] || { label: s.categoria, color: 'gray', icon: '•' };
              return (
                <div key={s.id} className="p-3 hover:bg-gray-50/60 flex items-start gap-3">
                  <div className="text-xl mt-0.5">{cat.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800">{s.titulo}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wide bg-${cat.color}-100 text-${cat.color}-700 border border-${cat.color}-200 px-1.5 py-0.5 rounded`}>
                        {cat.label}
                      </span>
                      {s.prazo_sugerido_dias != null && (
                        <span className="text-[10px] text-gray-500">⏱ {s.prazo_sugerido_dias}d</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">{s.descricao}</div>
                  </div>
                  <button onClick={() => setSugSelec(s)}
                    className="shrink-0 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                    + Adicionar ao Plano
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {sugSelec && (
        <ModalNovoPlano sugestao={sugSelec} onClose={() => setSugSelec(null)} onSaved={() => setSugSelec(null)} />
      )}
      {novaSug && (
        <ModalNovaSugestao
          dimensaoInicial={novaSug.dimensao_nr1}
          onClose={() => setNovaSug(null)}
          onSaved={() => { setNovaSug(null); carregar(); }}
        />
      )}
    </div>
  );
}

// ============================================================
// BIBLIOTECA DE MATERIAIS PRA CONSCIENTIZACAO
// ============================================================

const MATERIAIS_GERADOS = [
  {
    tipo: 'canal-denuncia',
    icone: '🚫',
    titulo: 'Cartaz "Assédio Zero"',
    descricao: 'Canal de denúncia da empresa em destaque, lista os 4 tipos de assédio, formato A4 pra mural.',
    cor: 'red',
  },
  {
    tipo: 'saude-mental',
    icone: '🧠',
    titulo: 'Cartaz "Sua Saúde Mental Importa"',
    descricao: '5 sinais de alerta + CVV 188 em destaque. A4 pra refeitório, vestiário ou sala de descanso.',
    cor: 'purple',
  },
  {
    tipo: 'a-quem-recorrer',
    icone: '🆘',
    titulo: 'Folder "A Quem Recorrer"',
    descricao: 'Lista de contatos importantes (CVV, polícia, RH interno, CIPA). Pra recortar e levar.',
    cor: 'cyan',
  },
  {
    tipo: 'direitos-nr1',
    icone: '📋',
    titulo: 'Pôster "Seus Direitos — NR-1"',
    descricao: '7 direitos garantidos pela NR-1, com canal de reporte. A4 pra mural e área comum.',
    cor: 'emerald',
  },
];

// 12 cartazes mensais — em ordem cronologica Jan → Dez
const CARTAZES_MENSAIS = [
  { mes: 1,  tipo: 'janeiro-branco',    titulo: 'Janeiro Branco',     subtitulo: 'Saúde Mental',              cor: 'gray' },
  { mes: 2,  tipo: 'fevereiro-roxo',    titulo: 'Fevereiro Roxo',     subtitulo: 'Alzheimer · Lúpus · Fibro', cor: 'purple' },
  { mes: 3,  tipo: 'marco-lilas',       titulo: 'Março Lilás',        subtitulo: 'Câncer de Colo do Útero',   cor: 'fuchsia' },
  { mes: 4,  tipo: 'abril-azul',        titulo: 'Abril Azul',         subtitulo: 'Autismo',                   cor: 'blue' },
  { mes: 5,  tipo: 'maio-amarelo',      titulo: 'Maio Amarelo',       subtitulo: 'Segurança no Trânsito',     cor: 'yellow' },
  { mes: 6,  tipo: 'junho-vermelho',    titulo: 'Junho Vermelho',     subtitulo: 'Doação de Sangue',          cor: 'red' },
  { mes: 7,  tipo: 'julho-amarelo',     titulo: 'Julho Amarelo',      subtitulo: 'Hepatites Virais',          cor: 'amber' },
  { mes: 8,  tipo: 'agosto-dourado',    titulo: 'Agosto Dourado',     subtitulo: 'Aleitamento Materno',       cor: 'yellow' },
  { mes: 9,  tipo: 'setembro-amarelo',  titulo: 'Setembro Amarelo',   subtitulo: 'Prevenção ao Suicídio',     cor: 'yellow' },
  { mes: 10, tipo: 'outubro-rosa',      titulo: 'Outubro Rosa',       subtitulo: 'Câncer de Mama',            cor: 'pink' },
  { mes: 11, tipo: 'novembro-azul',     titulo: 'Novembro Azul',      subtitulo: 'Saúde do Homem',            cor: 'blue' },
  { mes: 12, tipo: 'dezembro-vermelho', titulo: 'Dezembro Vermelho',  subtitulo: 'HIV/AIDS · ISTs',           cor: 'red' },
];

const MATERIAIS_NR1_OFICIAIS = [
  {
    icone: '📕',
    titulo: 'Cartilha Assédio Moral e Sexual',
    descricao: 'Material oficial do Tribunal Superior do Trabalho (TST).',
    fonte: 'TST',
    url: 'https://www.tst.jus.br/documents/10157/26144164/Campanha+ass%C3%A9dio+moral+e+sexual+-+a5+-+12092022.pdf/f10d0579-f70f-2a1e-42ae-c9dcfcc1fd47',
  },
  {
    icone: '🤍',
    titulo: 'Janeiro Branco — Saúde Mental',
    descricao: 'Cartazes A3, banners e folders sobre saúde mental no trabalho.',
    fonte: 'janeirobranco.org.br',
    url: 'https://janeirobranco.org.br/produto/materiais-para-download-janeiro-branco-2026/',
  },
  {
    icone: '💛',
    titulo: 'Setembro Amarelo — Prevenção ao Suicídio',
    descricao: 'Materiais oficiais da campanha. CVV, CFM e ABP.',
    fonte: 'setembroamarelo.com',
    url: 'https://www.setembroamarelo.com/',
  },
  {
    icone: '📘',
    titulo: 'Manual GRO/PGR da NR-1',
    descricao: 'Manual oficial do MTE de interpretação e aplicação da NR-1.',
    fonte: 'gov.br',
    url: 'https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/manuais-e-publicacoes/manual_gro_pgr_da_nr_1.pdf',
  },
];


function BibliotecaMateriais() {
  const [aberto, setAberto] = useState(false);
  const [baixando, setBaixando] = useState(null);

  const baixarMaterial = async (tipo) => {
    setBaixando(tipo);
    try {
      const r = await api.get(`/pesquisa-clima/nr1/material/${tipo}`, { responseType: 'blob' });
      const blob = new Blob([r.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      // libera depois pra nao vazar memoria
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) {
      console.error(e);
      alert('Erro ao gerar PDF');
    } finally { setBaixando(null); }
  };

  return (
    <div className="bg-white rounded-lg border-2 border-blue-200 overflow-hidden">
      <button onClick={() => setAberto(!aberto)}
        className="w-full px-4 py-3 bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 flex items-center justify-between text-left">
        <div className="flex items-center gap-3">
          <div className="text-2xl">📥</div>
          <div>
            <div className="font-bold text-gray-800">Materiais para Conscientização</div>
            <div className="text-xs text-gray-600">Cartazes em PDF personalizados com o nome da sua empresa + materiais oficiais</div>
          </div>
        </div>
        <div className={`transition-transform ${aberto ? 'rotate-180' : ''}`}>▼</div>
      </button>

      {aberto && (
        <div className="p-4 space-y-6">
          {/* 1. Cartazes NR-1 fixos */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">📄 Cartazes NR-1 — sempre úteis</h4>
            <p className="text-xs text-gray-500 mb-3">PDFs personalizados com o nome da sua empresa. Imprima e fixe em murais, sala de descanso, refeitório.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {MATERIAIS_GERADOS.map(m => (
                <button key={m.tipo} onClick={() => baixarMaterial(m.tipo)} disabled={baixando === m.tipo}
                  className={`text-left p-3 bg-${m.cor}-50 border-2 border-${m.cor}-200 rounded-lg hover:border-${m.cor}-400 hover:shadow-sm transition group disabled:opacity-60`}>
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">{m.icone}</div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-bold text-${m.cor}-800`}>{m.titulo}</div>
                      <div className={`text-xs text-${m.cor}-700 mt-0.5`}>{m.descricao}</div>
                      <div className={`text-xs font-bold text-${m.cor}-600 mt-2 group-hover:underline`}>
                        {baixando === m.tipo ? '⏳ Gerando PDF...' : '📥 Baixar PDF →'}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Calendário do RH — 1 cartaz por mês */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">📅 Calendário do RH — 1 cartaz por mês</h4>
            <p className="text-xs text-gray-500 mb-3">Imprima e fixe o cartaz do mês vigente. Estimule conscientização contínua ao longo do ano.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {CARTAZES_MENSAIS.map(c => (
                <button key={c.tipo} onClick={() => baixarMaterial(c.tipo)} disabled={baixando === c.tipo}
                  className={`text-left p-3 bg-${c.cor}-50 border-2 border-${c.cor}-200 rounded-lg hover:border-${c.cor}-500 hover:shadow-sm transition group disabled:opacity-60 relative overflow-hidden`}>
                  <div className={`absolute top-0 left-0 bg-${c.cor}-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-br-lg`}>
                    {String(c.mes).padStart(2, '0')}/12
                  </div>
                  <div className="mt-3">
                    <div className={`font-bold text-${c.cor}-800`}>{c.titulo}</div>
                    <div className={`text-xs text-${c.cor}-700 mt-0.5`}>{c.subtitulo}</div>
                    <div className={`text-xs font-bold text-${c.cor}-600 mt-2 group-hover:underline`}>
                      {baixando === c.tipo ? '⏳ Gerando PDF...' : '📥 Baixar PDF →'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Materiais oficiais externos */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">🔗 Materiais oficiais NR-1 — fontes externas</h4>
            <p className="text-xs text-gray-500 mb-3">Cartilhas e manuais de referência publicados por órgãos oficiais (TST, MTE, Movimentos).</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {MATERIAIS_NR1_OFICIAIS.map(m => (
                <a key={m.url} href={m.url} target="_blank" rel="noreferrer"
                  className="block p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 hover:border-gray-400 transition group">
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">{m.icone}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-800">{m.titulo}</div>
                      <div className="text-xs text-gray-600 mt-0.5">{m.descricao}</div>
                      <div className="text-xs font-semibold text-blue-600 mt-2 group-hover:underline">↗ Abrir em {m.fonte}</div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ModalNovaSugestao({ dimensaoInicial, onClose, onSaved }) {
  const [form, setForm] = useState({
    dimensao_nr1: dimensaoInicial || '',
    titulo: '',
    descricao: '',
    categoria: 'programa',
    prazo_sugerido_dias: 30,
  });
  const [salvando, setSalvando] = useState(false);
  const dimensoesOptions = Object.keys(DIMENSAO_LABEL);
  const categoriasOptions = Object.keys(CATEGORIA_LABEL);

  const salvar = async () => {
    if (!form.titulo.trim() || !form.descricao.trim() || !form.dimensao_nr1) return;
    setSalvando(true);
    try {
      await api.post('/pesquisa-clima/nr1/sugestoes', form);
      onSaved();
    } catch (e) {
      console.error(e);
      alert('Erro ao criar sugestão');
    } finally { setSalvando(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xl">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-800">Nova Sugestão de Ação</h3>
          <p className="text-xs text-gray-500">Adicione uma medida customizada ao catálogo. Ficará disponível pra você e sua equipe usarem em planos futuros.</p>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs font-semibold uppercase text-gray-500">Dimensão NR-1 *</label>
            <select value={form.dimensao_nr1} onChange={e => setForm({ ...form, dimensao_nr1: e.target.value })}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
              <option value="">Selecione...</option>
              {dimensoesOptions.map(d => (
                <option key={d} value={d}>{DIMENSAO_LABEL[d]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-gray-500">Título *</label>
            <input type="text" value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })}
              placeholder="Ex: Implementar reunião 1:1 quinzenal"
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-gray-500">Descrição *</label>
            <textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })}
              rows={3} placeholder="O que essa ação faz, como implementar, quem beneficia..."
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase text-gray-500">Categoria</label>
              <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                {categoriasOptions.map(c => (
                  <option key={c} value={c}>{CATEGORIA_LABEL[c].icon} {CATEGORIA_LABEL[c].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-gray-500">Prazo sugerido (dias)</label>
              <input type="number" min="1" value={form.prazo_sugerido_dias}
                onChange={e => setForm({ ...form, prazo_sugerido_dias: parseInt(e.target.value) || 0 })}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold">
            Cancelar
          </button>
          <button onClick={salvar} disabled={salvando || !form.titulo.trim() || !form.descricao.trim() || !form.dimensao_nr1}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed">
            {salvando ? 'Salvando...' : 'Adicionar ao Catálogo'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ABA 3 — PLANOS DE AÇÃO (CRUD)
// ============================================================

const STATUS_LABEL = {
  pendente:      { label: 'Pendente',      color: 'amber',   icon: '⏳' },
  em_andamento:  { label: 'Em andamento',  color: 'blue',    icon: '⚙️' },
  concluido:     { label: 'Concluído',     color: 'emerald', icon: '✅' },
  cancelado:     { label: 'Cancelado',     color: 'gray',    icon: '✖' },
};

function AbaPlanos({ empresaCtx }) {
  const [planos, setPlanos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [novoPlano, setNovoPlano] = useState(null); // {} pra abrir modal vazio
  const [editPlano, setEditPlano] = useState(null);

  const carregar = async () => {
    try {
      const params = new URLSearchParams();
      if (filtroStatus) params.append('status', filtroStatus);
      if (empresaCtx?.empresaSel) params.append('empresa_id', empresaCtx.empresaSel);
      const qs = params.toString();
      const url = `/pesquisa-clima/nr1/planos${qs ? '?' + qs : ''}`;
      const r = await api.get(url);
      setPlanos(Array.isArray(r.data) ? r.data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [filtroStatus, empresaCtx?.empresaSel]);

  if (loading) return <div className="p-12 text-center text-gray-400">Carregando planos...</div>;

  const contagens = {
    todos: planos.length,
    pendente: planos.filter(p => p.status === 'pendente').length,
    em_andamento: planos.filter(p => p.status === 'em_andamento').length,
    concluido: planos.filter(p => p.status === 'concluido').length,
  };

  return (
    <div className="space-y-4">
      {/* Header com filtros e botão Novo */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex flex-wrap gap-2 flex-1">
          {[
            { id: '',             label: 'Todos',          n: contagens.todos,         color: 'gray' },
            { id: 'pendente',     label: 'Pendentes',      n: contagens.pendente,      color: 'amber' },
            { id: 'em_andamento', label: 'Em andamento',   n: contagens.em_andamento,  color: 'blue' },
            { id: 'concluido',    label: 'Concluídos',     n: contagens.concluido,     color: 'emerald' },
          ].map(f => (
            <button key={f.id} onClick={() => setFiltroStatus(f.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition ${
                filtroStatus === f.id
                  ? `bg-${f.color}-100 border-${f.color}-300 text-${f.color}-800`
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {f.label} <span className="ml-1 text-xs opacity-70">({f.n})</span>
            </button>
          ))}
        </div>
        <button onClick={() => setNovoPlano({})}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap">
          + Novo Plano Manual
        </button>
      </div>

      {planos.length === 0 && (
        <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <div className="text-5xl mb-3">📋</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Nenhum plano de ação ainda</h2>
          <p className="text-gray-600 mb-4">Vá em <strong>💡 Sugestões de Ação</strong> e adicione medidas ao plano, ou clique em <strong>+ Novo Plano Manual</strong>.</p>
        </div>
      )}

      {planos.map(p => {
        const st = STATUS_LABEL[p.status] || STATUS_LABEL.pendente;
        const dimLabel = DIMENSAO_LABEL[p.dimensao_nr1] || p.dimensao_nr1;
        const atrasado = p.prazo_data && new Date(p.prazo_data) < new Date() && p.status !== 'concluido';
        return (
          <div key={p.id} className={`bg-white rounded-lg border-2 p-4 hover:shadow-sm transition ${atrasado ? 'border-red-200' : 'border-gray-200'}`}>
            <div className="flex items-start gap-3">
              <div className="text-2xl">{st.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-bold text-gray-800">{p.titulo}</h3>
                  <span className={`text-[10px] font-bold uppercase bg-${st.color}-100 text-${st.color}-700 border border-${st.color}-200 px-2 py-0.5 rounded-full`}>
                    {st.label}
                  </span>
                  <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                    {dimLabel}
                  </span>
                  {atrasado && (
                    <span className="text-[10px] font-bold uppercase bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">
                      🚨 Atrasado
                    </span>
                  )}
                </div>
                {p.descricao && <div className="text-sm text-gray-600 mb-2">{p.descricao}</div>}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  {p.responsavel && <div>👤 <strong>{p.responsavel}</strong></div>}
                  {p.setor_alvo && <div>🏪 {p.setor_alvo}</div>}
                  {p.prazo_data && <div>📅 Prazo: <strong className={atrasado ? 'text-red-600' : ''}>{new Date(p.prazo_data).toLocaleDateString('pt-BR')}</strong></div>}
                  {p.rodada_nome && <div>📊 {p.rodada_nome}</div>}
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button onClick={() => setEditPlano(p)}
                  className="text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 px-3 py-1 rounded font-semibold">✏️ Editar</button>
                <button onClick={async () => {
                  if (!window.confirm('Excluir este plano?')) return;
                  await api.delete(`/pesquisa-clima/nr1/planos/${p.id}`);
                  carregar();
                }}
                  className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded font-semibold">🗑️ Excluir</button>
              </div>
            </div>
          </div>
        );
      })}

      {(novoPlano || editPlano) && (
        <ModalNovoPlano
          plano={editPlano}
          sugestao={novoPlano?.sugestao}
          empresaCtx={empresaCtx}
          onClose={() => { setNovoPlano(null); setEditPlano(null); }}
          onSaved={() => { setNovoPlano(null); setEditPlano(null); carregar(); }}
        />
      )}
    </div>
  );
}

// ============================================================
// MODAL — NOVO/EDITAR PLANO
// ============================================================

function ModalNovoPlano({ sugestao, plano, empresaCtx, onClose, onSaved }) {
  const editando = !!plano?.id;
  const prazoDefault = sugestao?.prazo_sugerido_dias
    ? new Date(Date.now() + sugestao.prazo_sugerido_dias * 86400000).toISOString().slice(0, 10)
    : '';

  const [form, setForm] = useState({
    id:              plano?.id || null,
    sugestao_id:     sugestao?.id || plano?.sugestao_id || null,
    dimensao_nr1:    sugestao?.dimensao_nr1 || plano?.dimensao_nr1 || '',
    titulo:          sugestao?.titulo || plano?.titulo || '',
    descricao:       sugestao?.descricao || plano?.descricao || '',
    setor_alvo:      plano?.setor_alvo || '',
    responsavel:     plano?.responsavel || '',
    prazo_data:      plano?.prazo_data?.slice(0, 10) || prazoDefault,
    status:          plano?.status || 'pendente',
    observacoes:     plano?.observacoes || '',
    empresa_id:      plano?.empresa_id || empresaCtx?.empresaSel || '',
    departamento_id: plano?.departamento_id || '',
  });
  const [salvando, setSalvando] = useState(false);

  const dimensoesOptions = Object.keys(DIMENSAO_LABEL);

  const salvar = async () => {
    if (!form.titulo.trim() || !form.dimensao_nr1) return;
    setSalvando(true);
    try {
      if (editando) {
        await api.put(`/pesquisa-clima/nr1/planos/${form.id}`, form);
      } else {
        await api.post('/pesquisa-clima/nr1/planos', form);
      }
      onSaved();
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar plano');
    } finally { setSalvando(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-800">{editando ? 'Editar Plano de Ação' : 'Novo Plano de Ação'}</h3>
          {sugestao && <p className="text-xs text-purple-700">A partir da sugestão: <strong>{sugestao.titulo}</strong></p>}
        </div>
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs font-semibold uppercase text-gray-500">Título *</label>
              <input type="text" value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold uppercase text-gray-500">Descrição</label>
              <textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })}
                rows={3} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-gray-500">Dimensão NR-1 *</label>
              <select value={form.dimensao_nr1} onChange={e => setForm({ ...form, dimensao_nr1: e.target.value })}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                <option value="">Selecione...</option>
                {dimensoesOptions.map(d => (
                  <option key={d} value={d}>{DIMENSAO_LABEL[d]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-gray-500">Loja *</label>
              <select value={form.empresa_id}
                onChange={e => setForm({ ...form, empresa_id: e.target.value, departamento_id: '' })}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                <option value="">SELECIONE...</option>
                {(empresaCtx?.empresas || []).map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.apelido || emp.nomeFantasia || emp.razaoSocial || '(sem nome)'}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-gray-500">Setor-alvo</label>
              <select value={form.departamento_id}
                onChange={e => {
                  const id = e.target.value;
                  const dep = (empresaCtx?.departamentos || []).find(d => String(d.id) === id);
                  setForm({ ...form, departamento_id: id, setor_alvo: dep?.nome || form.setor_alvo });
                }}
                disabled={!form.empresa_id}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm disabled:bg-gray-100">
                <option value="">{form.empresa_id ? 'TODOS OS SETORES' : 'ESCOLHA A LOJA PRIMEIRO'}</option>
                {(empresaCtx?.departamentos || []).map(d => (
                  <option key={d.id} value={d.id}>{d.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-gray-500">Responsável</label>
              <input type="text" value={form.responsavel} onChange={e => setForm({ ...form, responsavel: e.target.value })}
                placeholder="Nome do responsável"
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-gray-500">Prazo</label>
              <input type="date" value={form.prazo_data} onChange={e => setForm({ ...form, prazo_data: e.target.value })}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-gray-500">Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                <option value="pendente">Pendente</option>
                <option value="em_andamento">Em andamento</option>
                <option value="concluido">Concluído</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold uppercase text-gray-500">Observações</label>
              <textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })}
                rows={2} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold">
            Cancelar
          </button>
          <button onClick={salvar} disabled={salvando || !form.titulo.trim() || !form.dimensao_nr1}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed">
            {salvando ? 'Salvando...' : (editando ? 'Salvar Alterações' : 'Criar Plano')}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmConstrucao({ titulo, descricao, proximo }) {
  return (
    <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
      <div className="text-5xl mb-3">🚧</div>
      <h2 className="text-xl font-bold text-gray-800 mb-2">{titulo}</h2>
      <p className="text-gray-600 mb-4 max-w-2xl mx-auto">{descricao}</p>
      <div className="inline-block bg-purple-50 border border-purple-200 text-purple-700 text-sm rounded-lg px-4 py-2">
        {proximo}
      </div>
    </div>
  );
}
