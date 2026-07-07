import { useState, useEffect, Fragment } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import RadarLoading from '../components/RadarLoading';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  ArcElement, Tooltip, Legend, Title, Filler,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Title, Filler);

// Abas espelhando os modulos do menu RH (cada uma vai consumir dados da sua tela origem)
// "Geral" foi movida pra dentro de Colaboradores como sub-aba
const ABAS = [
  { id: 'colaboradores', label: 'Colaboradores', icon: '👥',
    desc: 'Perfil demográfico, distribuição, evolução do quadro',
    origem: 'RH > Colaboradores (Cadastro Geral)' },
  { id: 'ponto-ausencias', label: 'Ponto e Ausências', icon: '⏰',
    desc: 'Absenteísmo, gravidade, atestados, faltas',
    origem: 'RH > Ponto e Ausências' },
  { id: 'recrutamento', label: 'Recrutamento', icon: '💼',
    desc: 'Tempo de contratação, vagas abertas/preenchidas, funil de seleção',
    origem: 'RH > Recrutamento' },
  { id: 'pesquisa-clima', label: 'Pesquisa de Clima', icon: '😊',
    desc: 'eNPS, satisfação, evolução entre rodadas',
    origem: 'RH > Pesquisa de Clima' },
  { id: 'treinamentos', label: 'Treinamentos', icon: '📚',
    desc: 'Horas, custos, certificações, avaliação',
    origem: 'RH > Treinamentos' },
  { id: 'financeiro', label: 'Financeiro RH', icon: '💵',
    desc: 'Folha mensal, evolução salarial, custo por setor',
    origem: 'RH > Financeiro RH (Lançamentos + Folha)' },
  { id: 'escala', label: 'Escala de Trabalho', icon: '📅',
    desc: 'Cobertura, horas extras, banco de horas, férias',
    origem: 'RH > Escala de Trabalho' },
  { id: 'dp', label: 'Departamento Pessoal', icon: '📂',
    desc: 'Documentos vencidos, pastas, conformidade',
    origem: 'RH > Departamento Pessoal' },
];

export default function RhIndicadores() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [aba, setAba] = useState('colaboradores');
  const [ano, setAno] = useState(new Date().getFullYear());
  const [empresas, setEmpresas] = useState([]);
  const [empresaId, setEmpresaId] = useState(''); // '' = todas

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, ativos: 0, desligados: 0, clts: 0, aprendizes: 0 });
  const [colaboradores, setColaboradores] = useState([]);

  // Carrega empresas uma vez
  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/rh/empresas/stores/list');
        const data = Array.isArray(r.data) ? r.data : (r.data?.companies || []);
        setEmpresas(data);
      } catch { /* ignore */ }
    })();
  }, []);

  // Recarrega dados quando troca empresa
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line
  }, [empresaId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('limit', '500');
      if (empresaId) params.set('company_id', empresaId);
      const statsParams = empresaId ? `?empresa_id=${empresaId}` : '';
      const [statsRes, colabRes] = await Promise.all([
        api.get(`/rh/colaboradores/stats${statsParams}`).catch(() => ({ data: {} })),
        api.get(`/rh/colaboradores?${params.toString()}`).catch(() => ({ data: [] })),
      ]);
      setStats({
        total: statsRes.data?.total || 0,
        ativos: statsRes.data?.ativos || 0,
        desligados: statsRes.data?.desligados || 0,
        clts: statsRes.data?.clts || 0,
        aprendizes: statsRes.data?.aprendizes || 0,
      });
      setColaboradores(colabRes.data?.colaboradores || colabRes.data?.data || colabRes.data || []);
    } catch (err) {
      toast.error('Erro ao carregar indicadores');
    } finally {
      setLoading(false);
    }
  };

  const abaAtual = ABAS.find(a => a.id === aba);

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-purple-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold">📊 Indicadores RH</h1>
                <p className="text-purple-100 text-sm">Dashboards consolidados — todos os KPIs em uma única tela</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5">
                <label className="text-xs font-bold">🏪 EMPRESA:</label>
                <select value={empresaId} onChange={e => setEmpresaId(e.target.value)}
                  className="bg-white text-gray-800 rounded px-2 py-1 text-sm font-bold cursor-pointer min-w-[180px]">
                  <option value="">Todas as lojas</option>
                  {empresas.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.apelido ? `Loja ${e.cod_loja} - ${e.apelido}` : (e.label || e.nome_fantasia || `Loja ${e.cod_loja}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5">
                <label className="text-xs font-bold">📅 ANO:</label>
                <select value={ano} onChange={e => setAno(Number(e.target.value))}
                  className="bg-white text-gray-800 rounded px-2 py-1 text-sm font-bold cursor-pointer">
                  {[2024, 2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Abas */}
        <div className="bg-white border-b shadow-sm sticky top-0 z-20">
          <div className="flex overflow-x-auto px-2">
            {ABAS.map(a => (
              <button key={a.id} onClick={() => setAba(a.id)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${
                  aba === a.id
                    ? 'border-rose-500 text-rose-600 bg-rose-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}>
                <span>{a.icon}</span>
                <span>{a.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Conteudo */}
        <div className="p-4 md:p-6">
          {/* Descricao da aba — escondida na aba Colaboradores (vai pra dentro da sub-aba) */}
          {aba !== 'colaboradores' && (
            <div className="bg-white rounded-lg border p-4 mb-4 flex items-start gap-3">
              <span className="text-3xl">{abaAtual?.icon}</span>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-gray-800">{abaAtual?.label}</h2>
                <p className="text-sm text-gray-600">{abaAtual?.desc}</p>
                <p className="text-[11px] text-rose-600 mt-1">📍 Dados de: <strong>{abaAtual?.origem}</strong></p>
              </div>
            </div>
          )}

          {/* Aba Colaboradores — funcional (Geral virou sub-aba interna) */}
          {aba === 'colaboradores' && <AbaColaboradores loading={loading} stats={stats} colaboradores={colaboradores} ano={ano} />}

          {/* Aba Ponto e Ausências — funcional (apuração RHiD agregada) */}
          {aba === 'ponto-ausencias' && <AbaPontoAusencias ano={ano} empresaId={empresaId} />}

          {/* Aba Recrutamento — funcional (rh_vagas + curriculos) */}
          {aba === 'recrutamento' && <AbaRecrutamento ano={ano} />}

          {/* Aba Pesquisa de Clima — funcional (pesquisa_* + NR-1) */}
          {aba === 'pesquisa-clima' && <AbaPesquisaClima ano={ano} />}

          {/* Outras abas — esqueleto que vai ser conectado conforme cada tela origem fica pronta */}
          {aba !== 'colaboradores' && aba !== 'ponto-ausencias' && aba !== 'recrutamento' && aba !== 'pesquisa-clima' && <Esqueleto aba={aba} ano={ano} />}
        </div>
      </div>
    </div>
  );
}

// Lista expandida de nomes (com data opcional e motivo de desligamento opcional)
function ExpandNomes({ pessoas, campoData, motivo }) {
  return (
    <div className="bg-indigo-50/60 border-l-2 border-indigo-300 rounded-r p-2 my-1 text-xs space-y-0.5 max-h-56 overflow-auto">
      {(!pessoas || pessoas.length === 0) ? <div className="text-gray-400">Sem colaboradores</div> :
        pessoas.map((p, i) => (
          <div key={i} className="flex items-baseline gap-2 py-0.5 border-b border-indigo-100/60 last:border-0">
            <span className="font-medium text-gray-700 whitespace-nowrap">{i + 1}. {p.nome}</span>
            {campoData && p[campoData] && <span className="text-indigo-600 font-semibold whitespace-nowrap">— {MES_ABREV[new Date(p[campoData]).getMonth()]}/{new Date(p[campoData]).getFullYear()} <span className="text-gray-400 font-normal">({new Date(p[campoData]).toLocaleDateString('pt-BR')})</span></span>}
            {motivo && (p.motivo_desligamento_nome || p.tipo_desligamento_nome) && <span className="text-rose-500 font-medium whitespace-nowrap">· {p.motivo_desligamento_nome || p.tipo_desligamento_nome}</span>}
          </div>
        ))}
    </div>
  );
}

// Bloco de ranking (label + qtd + barra + expandir nomes)
function RankBloco({ titulo, entries, campoData, motivo }) {
  const [aberto, setAberto] = useState(null);
  const max = entries[0]?.[1]?.length || 1;
  return (
    <div className="bg-white rounded-lg border shadow-sm p-4">
      <h3 className="font-bold text-gray-700 text-sm mb-2">{titulo}</h3>
      {entries.length === 0 ? <div className="text-gray-400 text-xs py-4 text-center">Sem dados</div> : (
        <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
          {entries.map(([label, pessoas], i) => {
            const ab = aberto === label;
            const pct = Math.round(pessoas.length / max * 100);
            return (
              <div key={label}>
                <div className="flex items-center gap-2 text-xs">
                  <button onClick={() => setAberto(ab ? null : label)} title="Ver nomes" className="w-4 h-4 inline-flex items-center justify-center rounded bg-gray-200 text-gray-600 font-bold hover:bg-indigo-200 flex-shrink-0">{ab ? '−' : '+'}</button>
                  <span className="w-5 text-right font-bold text-gray-400">#{i + 1}</span>
                  <span className="flex-1 truncate font-medium text-gray-700" title={label}>{label}</span>
                  <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-bold">{pessoas.length}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded overflow-hidden mt-0.5"><div className="h-full bg-rose-400" style={{ width: `${pct}%` }}></div></div>
                {ab && <ExpandNomes pessoas={pessoas} campoData={campoData} motivo={motivo} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Ranking de desligamentos por Setor / Tipo / Motivo
function DesligamentosRanking({ colaboradores }) {
  const deslig = colaboradores.filter(c => c.status === 'desligado');
  const contar = (keyFn) => {
    const m = {};
    deslig.forEach(c => { const k = keyFn(c) || 'Não informado'; (m[k] ||= []).push(c); });
    return Object.entries(m).map(([k, ps]) => [k, ps.sort((a, b) => new Date(b.data_desligamento) - new Date(a.data_desligamento))]).sort((a, b) => b[1].length - a[1].length);
  };
  return (
    <div className="mb-4">
      <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2">❌ Desligamentos — Ranking <span className="text-xs font-normal text-gray-400">({deslig.length} no total · clique no + pra ver nomes)</span></h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <RankBloco titulo="🏭 Por Setor" entries={contar(c => c.setor_departamento_nome || c.setor_nome)} campoData="data_desligamento" motivo />
        <RankBloco titulo="📋 Por Tipo de Desligamento" entries={contar(c => c.tipo_desligamento_nome)} campoData="data_desligamento" motivo />
        <RankBloco titulo="💬 Por Motivo" entries={contar(c => c.motivo_desligamento_nome)} campoData="data_desligamento" />
      </div>
    </div>
  );
}

function AbaGeral({ loading, stats, colaboradores, ano }) {
  if (loading) return <div className="flex justify-center py-20"><RadarLoading size="sm" message="" /></div>;

  const masculino = colaboradores.filter(c => (c.sexo || '').toUpperCase() === 'M').length;
  const feminino = colaboradores.filter(c => (c.sexo || '').toUpperCase() === 'F').length;
  const totalGenero = masculino + feminino || 1;
  const percMasc = Math.round((masculino / totalGenero) * 100);
  const percFem = Math.round((feminino / totalGenero) * 100);

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '-';

  const admissoesRecentes = colaboradores
    .filter(c => c.status === 'ativo' && c.data_admissao)
    .sort((a, b) => new Date(b.data_admissao) - new Date(a.data_admissao))
    .slice(0, 8);

  const desligamentosRecentes = colaboradores
    .filter(c => c.status === 'desligado' && c.data_desligamento)
    .sort((a, b) => new Date(b.data_desligamento) - new Date(a.data_desligamento))
    .slice(0, 8);

  return (
    <>
      {/* KPIs principais */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <Kpi label="Total Colaboradores" valor={stats.total} cor="slate" />
        <Kpi label="Ativos" valor={stats.ativos} cor="emerald" />
        <Kpi label="Desligados" valor={stats.desligados} cor="rose" />
        <Kpi label="CLTs Ativos" valor={stats.clts} cor="blue" />
        <Kpi label="Aprendizes Ativos" valor={stats.aprendizes} cor="amber" />
      </div>

      {/* Distribuicao Genero + Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Distribuição por Gênero</h3>
          <Barra cor="bg-blue-500" label="Masculino" valor={masculino} pct={percMasc} />
          <Barra cor="bg-pink-500" label="Feminino" valor={feminino} pct={percFem} />
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Distribuição por Regime</h3>
          <Barra cor="bg-blue-500" label="CLT" valor={stats.clts} pct={Math.round((stats.clts / (stats.ativos || 1)) * 100)} />
          <Barra cor="bg-amber-500" label="Aprendiz" valor={stats.aprendizes} pct={Math.round((stats.aprendizes / (stats.ativos || 1)) * 100)} />
        </div>
      </div>

      {/* Ranking de desligamentos por setor / tipo / motivo */}
      <DesligamentosRanking colaboradores={colaboradores} />

      {/* Tabelas mensais (formato planilha): admissoes e desligamentos por cargo / mes */}
      <div className="space-y-4 mb-4">
        <TabelaMovimentacao
          titulo="▲ ADMISSÕES POR MÊS"
          colaboradores={colaboradores}
          ano={ano}
          campo="data_admissao"
          cor="emerald"
        />
        <TabelaMovimentacao
          titulo="▼ DESLIGAMENTOS POR MÊS"
          colaboradores={colaboradores}
          ano={ano}
          campo="data_desligamento"
          cor="rose"
        />
      </div>

      <div className="text-xs text-gray-400 mt-4 text-center mb-4">Ano-base: {ano}</div>

      {/* Graficos visuais (pizza + barras) */}
      <GraficosGeral colaboradores={colaboradores} />
    </>
  );
}

// ============================================================================
// Graficos visuais consolidados (Geral)
// ============================================================================
function GraficosGeral({ colaboradores }) {
  const ativos = colaboradores.filter(c => c.status === 'ativo');
  const hoje = new Date();

  // Generos
  const genero = { Masculino: 0, Feminino: 0, 'Não informado': 0 };
  ativos.forEach(c => {
    const s = (c.sexo || '').toUpperCase();
    if (s === 'M') genero.Masculino++;
    else if (s === 'F') genero.Feminino++;
    else genero['Não informado']++;
  });

  // Setores
  const setores = {}, setoresP = {};
  ativos.forEach(c => {
    const k = c.setor_departamento_nome || c.setor_nome || 'Sem setor';
    setores[k] = (setores[k] || 0) + 1;
    (setoresP[k] ||= []).push(c);
  });

  // Faixa etaria
  const faixas = { '16-20': 0, '21-25': 0, '26-30': 0, '31-35': 0, '36-40': 0, '41-50': 0, '51-60': 0, '61+': 0 };
  const faixasP = {};
  ativos.forEach(c => {
    if (!c.data_nascimento) return;
    const idade = Math.floor((hoje - new Date(c.data_nascimento)) / (365.25 * 24 * 60 * 60 * 1000));
    let f;
    if (idade <= 20) f = '16-20';
    else if (idade <= 25) f = '21-25';
    else if (idade <= 30) f = '26-30';
    else if (idade <= 35) f = '31-35';
    else if (idade <= 40) f = '36-40';
    else if (idade <= 50) f = '41-50';
    else if (idade <= 60) f = '51-60';
    else f = '61+';
    faixas[f]++; (faixasP[f] ||= []).push(c);
  });

  // Tempo de empresa
  const tempos = { '< 6 meses': 0, '6-12 meses': 0, '1-2 anos': 0, '2-3 anos': 0, '3-5 anos': 0, '5-10 anos': 0, '10+ anos': 0 };
  const temposP = {};
  ativos.forEach(c => {
    if (!c.data_admissao) return;
    const meses = (hoje - new Date(c.data_admissao)) / (30.44 * 24 * 60 * 60 * 1000);
    let t;
    if (meses < 6) t = '< 6 meses';
    else if (meses < 12) t = '6-12 meses';
    else if (meses < 24) t = '1-2 anos';
    else if (meses < 36) t = '2-3 anos';
    else if (meses < 60) t = '3-5 anos';
    else if (meses < 120) t = '5-10 anos';
    else t = '10+ anos';
    tempos[t]++; (temposP[t] ||= []).push(c);
  });

  // Tipo de cargo
  const PALAVRAS_ESTRATEGICO = /(GERENTE|DIRETOR|COORDENADOR|GESTOR|SUPERVISOR|LIDER|LÍDER|CHEFE|CEO|CFO|CTO|HEAD|ENCARREGADO)/i;
  const tipoCargo = { Operacional: 0, Estratégico: 0 };
  ativos.forEach(c => {
    if (PALAVRAS_ESTRATEGICO.test(c.cargo_nome || '')) tipoCargo['Estratégico']++;
    else tipoCargo['Operacional']++;
  });

  // Cargos (todos, ordenados do maior pro menor)
  const cargos = {}, cargosP = {};
  ativos.forEach(c => {
    const k = c.cargo_nome || 'Sem cargo';
    cargos[k] = (cargos[k] || 0) + 1;
    (cargosP[k] ||= []).push(c);
  });
  const topCargos = Object.entries(cargos).sort((a, b) => b[1] - a[1]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Pizza titulo="Distribuição por Gênero" dados={genero} cores={['#3b82f6', '#ec4899', '#9ca3af']} />
      <Pizza titulo="Operacional vs Estratégico" dados={tipoCargo} cores={['#f59e0b', '#a855f7']} />
      <BlocoBarras titulo="Tempo de Empresa" dados={tempos} pessoas={temposP} cor="bg-emerald-500"
        ordem={['10+ anos', '5-10 anos', '3-5 anos', '2-3 anos', '1-2 anos', '6-12 meses', '< 6 meses']} />
      <BlocoBarras titulo="Faixa Etária" dados={faixas} pessoas={faixasP} cor="bg-purple-500"
        ordem={['16-20', '21-25', '26-30', '31-35', '36-40', '41-50', '51-60', '61+']} />
      <BlocoBarras titulo="Distribuição por Setor" dados={setores} pessoas={setoresP} cor="bg-amber-500" />
      <CargosLista topCargos={topCargos} cargosP={cargosP} />
    </div>
  );
}

// Lista de cargos com (+) pra expandir e ver os nomes
function CargosLista({ topCargos, cargosP }) {
  const [aberto, setAberto] = useState(null);
  return (
    <div className="bg-white rounded-lg border shadow-sm p-5 flex flex-col">
      <h3 className="font-bold text-gray-800 text-base mb-3">🏆 Cargos ({topCargos.length})</h3>
      {topCargos.length === 0 ? (
        <div className="text-center text-gray-400 py-8 text-sm">Sem dados</div>
      ) : (
        <div className="space-y-1 overflow-y-auto pr-1 flex-1 min-h-0">
          {topCargos.map(([cargo, qtd], i) => {
            const ab = aberto === cargo;
            return (
              <div key={cargo}>
                <div className="flex items-center gap-2 text-sm">
                  <button onClick={() => setAberto(ab ? null : cargo)} title="Ver nomes" className="w-4 h-4 inline-flex items-center justify-center rounded bg-gray-200 text-gray-600 text-xs font-bold hover:bg-indigo-200 flex-shrink-0">{ab ? '−' : '+'}</button>
                  <span className="w-6 text-right font-bold text-gray-400">#{i + 1}</span>
                  <span className="flex-1 truncate font-semibold text-gray-700">{cargo}</span>
                  <span className="bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-sm font-bold">{qtd}</span>
                </div>
                {ab && <ExpandNomes pessoas={cargosP[cargo]} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Tabela mensal de movimentacao (admissoes ou desligamentos)
// Linhas = cargos, colunas = meses do ano-base, celulas = qtd que admitiu/desligou daquele cargo naquele mes
function TabelaMovimentacao({ titulo, colaboradores, ano, campo, cor }) {
  const corMap = {
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', cell: 'text-emerald-700' },
    rose: { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200', cell: 'text-rose-700' },
  };
  const cs = corMap[cor] || corMap.emerald;
  const [aberto, setAberto] = useState(null);
  const isDeslig = campo === 'data_desligamento';

  const hoje = new Date();
  const mesLimite = (hoje.getFullYear() === ano) ? hoje.getMonth() + 1 : 12;

  // Agrupa: pra cada cargo, conta movimentacao por mes do ano-base + guarda os colaboradores
  const porCargoMes = {}; // { cargo: [12 meses] }
  const porCargoPessoas = {}; // { cargo: [colaboradores] }
  let totalGeral = 0;
  const totaisMes = Array(12).fill(0);

  colaboradores.forEach(c => {
    const data = c[campo];
    if (!data) return;
    const d = new Date(data);
    if (d.getFullYear() !== ano) return;
    const mes = d.getMonth(); // 0..11
    const cargo = c.cargo_nome || 'Sem cargo';
    if (!porCargoMes[cargo]) porCargoMes[cargo] = Array(12).fill(0);
    porCargoMes[cargo][mes]++;
    (porCargoPessoas[cargo] ||= []).push(c);
    totaisMes[mes]++;
    totalGeral++;
  });

  const cargos = Object.entries(porCargoMes)
    .map(([nome, meses]) => ({ nome, meses, total: meses.reduce((s, x) => s + x, 0), pessoas: (porCargoPessoas[nome] || []).sort((a, b) => new Date(b[campo]) - new Date(a[campo])) }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
      <div className="overflow-x-auto slim-scroll">
        <table className="text-sm border-collapse table-fixed" style={{ width: '2180px' }}>
          <colgroup>
            <col style={{ width: '115px' }} />
            <col style={{ width: '115px' }} />
            {MESES.map(m => <col key={m} style={{ width: '150px' }} />)}
            <col style={{ width: '150px' }} />
          </colgroup>
          <thead>
            <tr className={`${cs.bg} border-b-2 ${cs.border}`}>
              <th className={`text-left px-3 py-2 font-bold uppercase text-sm tracking-wide ${cs.text}`} colSpan={2}>{titulo}</th>
              {MESES.map((m, i) => (
                <th key={m} className={`text-center px-2 py-2 text-xs font-bold border-l border-gray-200 ${i + 1 > mesLimite ? 'text-gray-300' : 'text-gray-600'}`}>{m}</th>
              ))}
              <th className={`text-center px-2 py-2 text-xs font-bold ${cs.text} ${cs.bg} border-l ${cs.border}`}>Total {ano}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cargos.length === 0 ? (
              <tr>
                <td colSpan={15} className="px-3 py-6 text-center text-gray-400 text-sm">
                  Nenhuma movimentação no ano de {ano}
                </td>
              </tr>
            ) : cargos.map(c => {
              const ab = aberto === c.nome;
              return (
                <Fragment key={c.nome}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 text-sm font-medium text-gray-700" colSpan={2}>
                      <button onClick={() => setAberto(ab ? null : c.nome)} title="Ver nomes" className="mr-2 w-4 h-4 inline-flex items-center justify-center rounded bg-gray-200 text-gray-600 text-xs font-bold hover:bg-indigo-200 align-middle">{ab ? '−' : '+'}</button>
                      {c.nome}
                    </td>
                    {c.meses.map((q, i) => (
                      <td key={i} className="px-2 py-1.5 text-center text-sm">
                        {i + 1 > mesLimite ? <span className="text-gray-300">—</span> :
                         q === 0 ? <span className="text-gray-300">—</span> :
                         <span className={`font-bold ${cs.cell}`}>{q}</span>}
                      </td>
                    ))}
                    <td className={`px-2 py-1.5 text-center text-sm font-bold ${cs.text} ${cs.bg}`}>{c.total}</td>
                  </tr>
                  {ab && (
                    <tr>
                      <td colSpan={15} className="px-3 py-0"><ExpandNomes pessoas={c.pessoas} campoData={campo} motivo={isDeslig} /></td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {cargos.length > 0 && (
              <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
                <td className="px-3 py-1.5 text-sm uppercase tracking-wide text-gray-700" colSpan={2}>TOTAL</td>
                {totaisMes.map((q, i) => (
                  <td key={i} className="px-2 py-1.5 text-center text-sm">
                    {i + 1 > mesLimite ? <span className="text-gray-300">—</span> :
                     q === 0 ? <span className="text-gray-300">—</span> :
                     <span className="text-gray-800">{q}</span>}
                  </td>
                ))}
                <td className={`px-2 py-1.5 text-center text-sm font-bold ${cs.text} ${cs.bg}`}>{totalGeral}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Pizza chart com SVG puro (sem dependencias)
function Pizza({ titulo, dados, cores }) {
  const entries = Object.entries(dados).filter(([, v]) => v > 0);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total === 0) {
    return (
      <div className="bg-white rounded-lg border shadow-sm p-5">
        <h3 className="font-bold text-gray-800 text-base mb-3">{titulo}</h3>
        <div className="text-center text-gray-400 py-8 text-sm">Sem dados</div>
      </div>
    );
  }

  const radius = 80;
  const cx = 100, cy = 100;
  let startAngle = -90;
  const slices = entries.map(([label, qtd], i) => {
    const pct = (qtd / total) * 100;
    const angle = (qtd / total) * 360;
    const endAngle = startAngle + angle;
    const sa = (startAngle * Math.PI) / 180;
    const ea = (endAngle * Math.PI) / 180;
    const x1 = cx + radius * Math.cos(sa);
    const y1 = cy + radius * Math.sin(sa);
    const x2 = cx + radius * Math.cos(ea);
    const y2 = cy + radius * Math.sin(ea);
    const largeArc = angle > 180 ? 1 : 0;
    const path = entries.length === 1
      ? `M ${cx - radius} ${cy} A ${radius} ${radius} 0 1 1 ${cx + radius} ${cy} A ${radius} ${radius} 0 1 1 ${cx - radius} ${cy} Z`
      : `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    // Posicao do label (no meio do arco)
    const midAngle = (startAngle + endAngle) / 2;
    const ma = (midAngle * Math.PI) / 180;
    const labelR = radius * 0.65;
    const lx = cx + labelR * Math.cos(ma);
    const ly = cy + labelR * Math.sin(ma);
    const slice = { path, cor: cores[i % cores.length], label, qtd, pct: Math.round(pct), lx, ly };
    startAngle = endAngle;
    return slice;
  });

  return (
    <div className="bg-white rounded-lg border shadow-sm p-5">
      <h3 className="font-bold text-gray-800 text-base mb-3">{titulo}</h3>
      <div className="flex items-center gap-4 flex-wrap">
        <svg width="200" height="200" viewBox="0 0 200 200" className="flex-shrink-0">
          {slices.map((s, i) => (
            <g key={i}>
              <path d={s.path} fill={s.cor} stroke="white" strokeWidth="2" />
              {s.pct >= 5 && (
                <text x={s.lx} y={s.ly} textAnchor="middle" dominantBaseline="middle"
                  fill="white" fontSize="14" fontWeight="bold">{s.pct}%</text>
              )}
            </g>
          ))}
        </svg>
        <div className="flex-1 space-y-1.5 min-w-[140px]">
          {slices.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: s.cor }}></span>
              <span className="flex-1 font-medium text-gray-700">{s.label}</span>
              <span className="text-gray-600 font-semibold">{s.qtd}</span>
              <span className="text-xs text-gray-400 w-10 text-right">{s.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, valor, cor }) {
  const cores = {
    slate: { border: 'border-slate-300', text: 'text-slate-700' },
    emerald: { border: 'border-emerald-300', text: 'text-emerald-700' },
    rose: { border: 'border-rose-300', text: 'text-rose-700' },
    blue: { border: 'border-blue-300', text: 'text-blue-700' },
    amber: { border: 'border-amber-300', text: 'text-amber-700' },
    purple: { border: 'border-purple-300', text: 'text-purple-700' },
    pink: { border: 'border-pink-300', text: 'text-pink-700' },
  };
  const c = cores[cor] || cores.slate;
  return (
    <div className={`bg-white rounded-lg border-l-4 ${c.border} shadow-sm p-5`}>
      <p className="text-sm uppercase font-bold text-gray-500">{label}</p>
      <p className={`text-4xl font-bold ${c.text} mt-2`}>{valor || 0}</p>
    </div>
  );
}

function Barra({ cor, label, valor, pct }) {
  return (
    <div className="flex items-center gap-3 mb-2">
      <span className="text-sm text-gray-600 w-24">{label}</span>
      <div className="flex-1 bg-gray-200 rounded-full h-6 overflow-hidden">
        <div className={`${cor} h-full rounded-full flex items-center justify-end pr-2`} style={{ width: `${pct || 0}%`, minWidth: pct > 0 ? '2rem' : '0' }}>
          {pct > 10 && <span className="text-xs text-white font-medium">{pct}%</span>}
        </div>
      </div>
      <span className="text-sm font-semibold text-gray-700 w-10 text-right">{valor || 0}</span>
    </div>
  );
}

// ============================================================================
// Aba Colaboradores — metricas mes a mes (formato planilha)
// Cada bloco e uma tabela com linhas=faixas e colunas=meses do ano
// ============================================================================
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Retorna os colaboradores que estavam ATIVOS no ULTIMO dia do mes/ano
function ativosNoMes(colaboradores, ano, mes) {
  // mes: 1-12 (Jan=1)
  const ultimoDia = new Date(ano, mes, 0); // dia 0 do mes seguinte = ultimo do mes atual
  return colaboradores.filter(c => {
    if (!c.data_admissao) return false;
    const adm = new Date(c.data_admissao);
    if (adm > ultimoDia) return false;
    if (c.data_desligamento) {
      const desl = new Date(c.data_desligamento);
      if (desl <= ultimoDia) return false;
    }
    return true;
  });
}

// Calcula faixa etaria com base na idade NAQUELE mes
function faixaEtaria(c, ano, mes) {
  if (!c.data_nascimento) return null;
  const ref = new Date(ano, mes, 0);
  const nasc = new Date(c.data_nascimento);
  const idade = Math.floor((ref - nasc) / (365.25 * 24 * 60 * 60 * 1000));
  if (idade <= 20) return '16-20';
  if (idade <= 25) return '21-25';
  if (idade <= 30) return '26-30';
  if (idade <= 35) return '31-35';
  if (idade <= 40) return '36-40';
  if (idade <= 50) return '41-50';
  if (idade <= 60) return '51-60';
  return '61+';
}

function faixaTempo(c, ano, mes) {
  if (!c.data_admissao) return null;
  const ref = new Date(ano, mes, 0);
  const adm = new Date(c.data_admissao);
  const meses = (ref - adm) / (30.44 * 24 * 60 * 60 * 1000);
  if (meses < 6) return '< 6 meses';
  if (meses < 12) return '6-12 meses';
  if (meses < 24) return '1-2 anos';
  if (meses < 36) return '2-3 anos';
  if (meses < 60) return '3-5 anos';
  if (meses < 120) return '5-10 anos';
  return '10+ anos';
}

const PALAVRAS_ESTRATEGICO = /(GERENTE|DIRETOR|COORDENADOR|GESTOR|SUPERVISOR|LIDER|LÍDER|CHEFE|CEO|CFO|CTO|HEAD|ENCARREGADO)/i;

// Recem contratados POR MES: admitidos NAQUELE mes (qtd nova)
function admitidosNoMes(colaboradores, ano, mes) {
  return colaboradores.filter(c => {
    if (!c.data_admissao) return false;
    const adm = new Date(c.data_admissao);
    return adm.getFullYear() === ano && (adm.getMonth() + 1) === mes;
  });
}

function AbaColaboradores({ loading, stats, colaboradores, ano }) {
  const [filtroTipo, setFiltroTipo] = useState('todos'); // 'todos' | 'clt_720' | 'clt_600' | 'aprendiz'
  const [subAba, setSubAba] = useState('geral'); // 'geral' | 'colaboradores' | 'documentos'

  if (loading) return <div className="flex justify-center py-20"><RadarLoading size="sm" message="" /></div>;

  // Aplica filtro por regime/jornada antes de tudo
  const matchTipo = (c) => {
    const regime = String(c.regime_trabalho_nome || '').toUpperCase();
    const jornada = String(c.jornada_nome || c.carga_horaria || '').toUpperCase();
    const isCLT = regime.includes('CLT');
    const has720 = jornada.includes('7:20') || jornada.includes('07:20') || jornada.includes('7H20') || jornada.includes('07H20');
    const has600 = jornada.includes('6:00') || jornada.includes('06:00') || jornada.includes('6H') || jornada.includes('06H');
    if (filtroTipo === 'todos') return true;
    if (filtroTipo === 'clt_720') return isCLT && has720;
    if (filtroTipo === 'clt_600') return isCLT && has600;
    if (filtroTipo === 'aprendiz') return regime.includes('APRENDIZ');
    return true;
  };
  const colaboradoresFiltrados = colaboradores.filter(matchTipo);

  const contagem = {
    todos: colaboradores.length,
    clt_720: colaboradores.filter(c => {
      const r = String(c.regime_trabalho_nome || '').toUpperCase();
      const j = String(c.jornada_nome || c.carga_horaria || '').toUpperCase();
      return r.includes('CLT') && (j.includes('7:20') || j.includes('07:20') || j.includes('7H20'));
    }).length,
    clt_600: colaboradores.filter(c => {
      const r = String(c.regime_trabalho_nome || '').toUpperCase();
      const j = String(c.jornada_nome || c.carga_horaria || '').toUpperCase();
      return r.includes('CLT') && (j.includes('6:00') || j.includes('06:00') || j.includes('6H'));
    }).length,
    aprendiz: colaboradores.filter(c => String(c.regime_trabalho_nome || '').toUpperCase().includes('APRENDIZ')).length,
  };

  const hoje = new Date();
  const mesAtual = (hoje.getFullYear() === ano) ? hoje.getMonth() + 1 : 12;

  // KPIs do mes atual (sobre o filtrado)
  const fimMesAnt = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
  const seisMesesAtras = new Date(hoje.getFullYear(), hoje.getMonth() - 6, hoje.getDate());
  const quadroInicial = colaboradoresFiltrados.filter(c => {
    if (!c.data_admissao) return false;
    const adm = new Date(c.data_admissao);
    if (adm > fimMesAnt) return false;
    if (c.data_desligamento && new Date(c.data_desligamento) <= fimMesAnt) return false;
    return true;
  }).length;
  const quadroFinal = colaboradoresFiltrados.filter(c => c.status === 'ativo').length;
  const variacao = quadroFinal - quadroInicial;
  const recemContratados = colaboradoresFiltrados.filter(c => {
    if (!c.data_admissao || c.status !== 'ativo') return false;
    return new Date(c.data_admissao) >= seisMesesAtras;
  }).length;

  const tiposBtns = [
    { id: 'todos', label: 'TODOS', cor: 'slate', count: contagem.todos },
    { id: 'clt_720', label: 'CLT 7:20', cor: 'blue', count: contagem.clt_720 },
    { id: 'clt_600', label: 'CLT 6:00', cor: 'indigo', count: contagem.clt_600 },
    { id: 'aprendiz', label: 'Aprendiz', cor: 'amber', count: contagem.aprendiz },
  ];

  // Calcula dados de uma tabela mensal (mesma logica do componente TabelaMensal)
  const calcDadosTabela = (classificar, ordemFaixas, dependeMes) => {
    const dadosPorMes = [];
    for (let m = 1; m <= 12; m++) {
      if (m > mesAtual) { dadosPorMes.push(null); continue; }
      const ativos = ativosNoMes(colaboradoresFiltrados, ano, m);
      const totais = {};
      for (const c of ativos) {
        const faixa = dependeMes ? classificar(c, ano, m) : classificar(c);
        if (!faixa) continue;
        totais[faixa] = (totais[faixa] || 0) + 1;
      }
      dadosPorMes.push({ totais, total: ativos.length });
    }
    let faixas = ordemFaixas;
    if (!faixas) {
      const todas = new Set();
      dadosPorMes.forEach(d => d && Object.keys(d.totais).forEach(k => todas.add(k)));
      faixas = Array.from(todas).sort((a, b) => {
        const totA = dadosPorMes.reduce((s, d) => s + (d?.totais[a] || 0), 0);
        const totB = dadosPorMes.reduce((s, d) => s + (d?.totais[b] || 0), 0);
        return totB - totA;
      });
    }
    return { dadosPorMes, faixas };
  };

  const exportarPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
      const tipoLabel = tiposBtns.find(t => t.id === filtroTipo)?.label || 'TODOS';
      const dataGer = new Date().toLocaleString('pt-BR');

      // Cabecalho
      doc.setFillColor(219, 39, 119); // pink-600
      doc.rect(0, 0, 297, 18, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Indicadores RH — Colaboradores', 10, 11);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Filtro: ${tipoLabel}  |  Ano: ${ano}  |  Gerado: ${dataGer}`, 10, 16);

      let y = 24;

      // KPIs
      doc.setTextColor(31, 41, 55);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Indicadores do mês atual', 10, y);
      y += 4;
      autoTable(doc, {
        startY: y,
        head: [['Quadro Inicial', 'Quadro Final', 'Variação Mensal', 'Recém Contratados (6m)']],
        body: [[String(quadroInicial), String(quadroFinal), (variacao >= 0 ? '+' : '') + variacao, String(recemContratados)]],
        theme: 'grid',
        styles: { fontSize: 10, halign: 'center', cellPadding: 3 },
        headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: 'bold' },
        bodyStyles: { fontStyle: 'bold', fontSize: 12 },
        margin: { left: 10, right: 10 },
      });
      y = doc.lastAutoTable.finalY + 6;

      // Funcao auxiliar pra gerar tabela mensal no PDF
      const gerarTabelaMensal = (titulo, classificar, ordemFaixas, dependeMes) => {
        const { dadosPorMes, faixas } = calcDadosTabela(classificar, ordemFaixas, dependeMes);
        // Cabecalhos: linha 1 = meses, linha 2 = QTD/% por mes
        const head = [
          [{ content: titulo, rowSpan: 2, styles: { halign: 'left', fillColor: [203, 213, 225] } },
           ...MESES.map(m => ({ content: m, colSpan: 2, styles: { halign: 'center', fillColor: [203, 213, 225] } }))],
          MESES.flatMap(() => [
            { content: 'QTD', styles: { halign: 'center', fillColor: [226, 232, 240], fontSize: 7 } },
            { content: '%', styles: { halign: 'center', fillColor: [226, 232, 240], fontSize: 7 } },
          ]),
        ];
        const body = faixas.map(f => {
          const row = [f];
          dadosPorMes.forEach(d => {
            if (!d) { row.push('—', '—'); return; }
            const qtd = d.totais[f] || 0;
            const pct = d.total ? Math.round((qtd / d.total) * 100) : 0;
            row.push(qtd > 0 ? String(qtd) : '—', qtd > 0 ? pct + '%' : '—');
          });
          return row;
        });
        // Total
        const totalRow = ['TOTAL'];
        dadosPorMes.forEach(d => totalRow.push(d ? String(d.total) : '—', d ? '100%' : '—'));
        body.push(totalRow);

        // Quebra pagina se nao couber
        if (y > 175) { doc.addPage(); y = 15; }
        autoTable(doc, {
          startY: y,
          head, body,
          theme: 'grid',
          styles: { fontSize: 7, cellPadding: 1.5, halign: 'center' },
          headStyles: { textColor: [31, 41, 55], fontStyle: 'bold' },
          columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 38 } },
          didParseCell: (data) => {
            if (data.row.index === body.length - 1) {
              data.cell.styles.fillColor = [243, 244, 246];
              data.cell.styles.fontStyle = 'bold';
            }
          },
          margin: { left: 10, right: 10 },
        });
        y = doc.lastAutoTable.finalY + 5;
      };

      gerarTabelaMensal('ESCOLARIDADE', c => c.escolaridade_nome || 'Sem informação', null, false);
      gerarTabelaMensal('GÊNERO', c => {
        const s = (c.sexo || '').toUpperCase();
        return s === 'M' ? 'Masculino' : s === 'F' ? 'Feminino' : 'Não informado';
      }, ['Masculino', 'Feminino', 'Não informado'], false);
      gerarTabelaMensal('FAIXA ETÁRIA', (c, ano, mes) => faixaEtaria(c, ano, mes),
        ['16-20', '21-25', '26-30', '31-35', '36-40', '41-50', '51-60', '61+'], true);
      gerarTabelaMensal('TEMPO DE EMPRESA', (c, ano, mes) => faixaTempo(c, ano, mes),
        ['< 6 meses', '6-12 meses', '1-2 anos', '2-3 anos', '3-5 anos', '5-10 anos', '10+ anos'], true);
      gerarTabelaMensal('POR SETOR', c => c.setor_departamento_nome || c.setor_nome || 'Sem setor', null, false);
      gerarTabelaMensal('TIPO DE CARGO',
        c => PALAVRAS_ESTRATEGICO.test(c.cargo_nome || '') ? 'Estratégico' : 'Operacional',
        ['Operacional', 'Estratégico'], false);

      doc.save(`indicadores-colaboradores-${tipoLabel.replace(/\s+/g, '_')}-${ano}.pdf`);
      toast.success('PDF gerado');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar PDF');
    }
  };

  return (
    <>
      {/* estilo da barra de rolagem — fininha e discreta */}
      <style>{`
        .slim-scroll::-webkit-scrollbar { height: 7px; }
        .slim-scroll::-webkit-scrollbar-track { background: transparent; }
        .slim-scroll::-webkit-scrollbar-thumb { background: rgba(148,163,184,.30); border-radius: 999px; }
        .slim-scroll::-webkit-scrollbar-thumb:hover { background: rgba(148,163,184,.50); }
        .slim-scroll { scrollbar-width: thin; scrollbar-color: rgba(148,163,184,.30) transparent; }
      `}</style>

      {/* Descricao da aba — comum as duas sub-abas */}
      <div className="bg-white rounded-lg border p-4 mb-4 flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-fuchsia-600 flex items-center justify-center text-white shrink-0 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-gray-800">Colaboradores</h2>
          <p className="text-sm text-gray-600">Perfil demográfico, distribuição, evolução do quadro</p>
          <p className="text-[11px] text-rose-600 mt-1">📍 Dados de: <strong>RH &gt; Colaboradores (Cadastro Geral)</strong></p>
        </div>
      </div>

      {/* Sub-abas internas: Geral | Colaboradores | Documentos */}
      <div className="flex items-center gap-2 mb-4 border-b border-gray-200">
        <button onClick={() => setSubAba('geral')}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition ${
            subAba === 'geral'
              ? 'border-pink-600 text-pink-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}>
          <span className="inline-flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M3 3v18h18"/><rect x="7" y="9" width="3" height="8" rx="1"/><rect x="12" y="5" width="3" height="12" rx="1"/><rect x="17" y="12" width="3" height="5" rx="1"/></svg>
            Geral
          </span>
        </button>
        <button onClick={() => setSubAba('colaboradores')}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition ${
            subAba === 'colaboradores'
              ? 'border-pink-600 text-pink-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}>
          <span className="inline-flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Colaboradores
          </span>
        </button>
        <button onClick={() => setSubAba('documentos')}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition ${
            subAba === 'documentos'
              ? 'border-pink-600 text-pink-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}>
          <span className="inline-flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            Documentos
          </span>
        </button>
      </div>

      {subAba === 'geral' && <AbaGeral loading={loading} stats={stats} colaboradores={colaboradores} ano={ano} />}
      {subAba === 'documentos' && <SubAbaDocumentos colaboradores={colaboradoresFiltrados} />}

      {subAba === 'colaboradores' && (<Fragment>
      {/* Botao de exportar PDF */}
      <div className="flex justify-end mb-3">
        <button onClick={exportarPDF}
          className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold shadow-sm transition">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Exportar PDF
        </button>
      </div>

      {/* Filtros por tipo de regime/jornada */}
      <div className="flex flex-wrap items-center gap-2 mb-4 bg-white border border-gray-200 rounded-lg p-3">
        <span className="text-xs font-bold uppercase tracking-wide text-gray-500 mr-2">Filtrar por:</span>
        {tiposBtns.map(t => {
          const ativo = filtroTipo === t.id;
          const corClasses = {
            slate: ativo ? 'bg-slate-600 text-white border-slate-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50',
            blue: ativo ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-50',
            indigo: ativo ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-700 border-indigo-300 hover:bg-indigo-50',
            amber: ativo ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50',
          }[t.cor];
          return (
            <button key={t.id} type="button" onClick={() => setFiltroTipo(t.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 text-sm font-semibold transition ${corClasses}`}>
              <span>{ativo ? '●' : '○'}</span>
              <span>{t.label}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${ativo ? 'bg-white/30' : 'bg-gray-100'}`}>{t.count}</span>
            </button>
          );
        })}
      </div>

      {/* KPIs do mes atual */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Kpi label="Quadro Inicial do Mês" valor={quadroInicial} cor="blue" />
        <Kpi label="Quadro Final do Mês" valor={quadroFinal} cor="emerald" />
        <Kpi label="Variação Mensal" valor={(variacao >= 0 ? '+' : '') + variacao} cor={variacao >= 0 ? 'emerald' : 'rose'} />
        <Kpi label="Recém Contratados (6m)" valor={recemContratados} cor="pink" />
      </div>

      {/* Tabelas mes a mes (cores alternadas: azul / rosa) */}
      <div className="space-y-4">
        <TabelaMensal
          titulo="ESCOLARIDADE"
          colaboradores={colaboradoresFiltrados}
          ano={ano} mesLimite={mesAtual}
          classificar={c => c.escolaridade_nome || 'Sem informação'}
          ordemFaixas={null}
          cor="azul"
        />
        <TabelaMensal
          titulo="GÊNERO"
          colaboradores={colaboradoresFiltrados}
          ano={ano} mesLimite={mesAtual}
          classificar={c => {
            const s = (c.sexo || '').toUpperCase();
            return s === 'M' ? 'Masculino' : s === 'F' ? 'Feminino' : 'Não informado';
          }}
          ordemFaixas={['Masculino', 'Feminino', 'Não informado']}
          cor="rosa"
        />
        <TabelaMensal
          titulo="FAIXA ETÁRIA"
          colaboradores={colaboradoresFiltrados}
          ano={ano} mesLimite={mesAtual}
          classificar={(c, ano, mes) => faixaEtaria(c, ano, mes)}
          ordemFaixas={['16-20', '21-25', '26-30', '31-35', '36-40', '41-50', '51-60', '61+']}
          dependeMes
          cor="azul"
        />
        <TabelaMensal
          titulo="TEMPO DE EMPRESA"
          colaboradores={colaboradoresFiltrados}
          ano={ano} mesLimite={mesAtual}
          classificar={(c, ano, mes) => faixaTempo(c, ano, mes)}
          ordemFaixas={['< 6 meses', '6-12 meses', '1-2 anos', '2-3 anos', '3-5 anos', '5-10 anos', '10+ anos']}
          dependeMes
          cor="rosa"
        />
        <TabelaMensal
          titulo="POR SETOR"
          colaboradores={colaboradoresFiltrados}
          ano={ano} mesLimite={mesAtual}
          classificar={c => c.setor_departamento_nome || c.setor_nome || 'Sem setor'}
          ordemFaixas={null}
          cor="azul"
        />
        <TabelaMensal
          titulo="TIPO DE CARGO"
          colaboradores={colaboradoresFiltrados}
          ano={ano} mesLimite={mesAtual}
          classificar={c => PALAVRAS_ESTRATEGICO.test(c.cargo_nome || '') ? 'Estratégico' : 'Operacional'}
          ordemFaixas={['Operacional', 'Estratégico']}
          cor="rosa"
        />
        <TabelaMensalContratados
          titulo="RECÉM CONTRATADOS (6 meses)"
          colaboradores={colaboradoresFiltrados}
          ano={ano} mesLimite={mesAtual}
        />
      </div>

      <div className="text-xs text-gray-400 mt-4 text-center">
        Ano-base: {ano} · Quantidade representa colaboradores ativos no último dia de cada mês · % calculado sobre o total daquele mês
      </div>
      </Fragment>)}
    </>
  );
}

// Sub-aba Documentos: lista colaboradores com contagem de docs, alertas de pendencia
function SubAbaDocumentos({ colaboradores }) {
  const [statsDoc, setStatsDoc] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos'); // 'todos' | 'pendentes' | 'ok'
  const [expandidoId, setExpandidoId] = useState(null);
  const [treeCache, setTreeCache] = useState({}); // { colaboradorId: { obrigatorias, opcionais } }
  const [loadingTree, setLoadingTree] = useState(false);
  const [docVisualizando, setDocVisualizando] = useState(null); // { url, nome }

  // Fecha modal com Esc
  useEffect(() => {
    if (!docVisualizando) return;
    const onKey = (e) => { if (e.key === 'Escape') setDocVisualizando(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [docVisualizando]);

  const toggleExpandir = async (colaboradorId) => {
    if (expandidoId === colaboradorId) { setExpandidoId(null); return; }
    setExpandidoId(colaboradorId);
    if (treeCache[colaboradorId]) return;
    try {
      setLoadingTree(true);
      const r = await api.get(`/rh/documentacao/tree-colaborador?colaborador_id=${colaboradorId}`);
      setTreeCache(prev => ({ ...prev, [colaboradorId]: r.data }));
    } catch {
      toast.error('Erro ao carregar árvore de documentos');
    } finally {
      setLoadingTree(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        setCarregando(true);
        const r = await api.get('/rh/documentacao/stats-por-colaborador');
        setStatsDoc(Array.isArray(r.data) ? r.data : []);
      } catch (err) {
        toast.error('Erro ao carregar documentação');
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  if (carregando) return <div className="flex justify-center py-20"><RadarLoading size="sm" message="" /></div>;

  // Filtra apenas colaboradores presentes no filtro do bloco pai
  const idsValidos = new Set(colaboradores.map(c => c.id));
  const lista = statsDoc.filter(s => idsValidos.has(s.colaborador_id));

  // KPIs
  const totalColab = lista.length;
  const totalDocs = lista.reduce((s, r) => s + (r.total_arquivos || 0), 0);
  const totalSubObrig = lista.reduce((s, r) => s + (r.obrigatorias || 0), 0);
  const totalSubOpc = lista.reduce((s, r) => s + (r.opcionais || 0), 0);
  const colabComPendencia = lista.filter(r => (r.obrigatorias_pendentes || 0) > 0).length;
  const colabOk = lista.filter(r => (r.obrigatorias || 0) > 0 && (r.obrigatorias_pendentes || 0) === 0).length;
  const colabSemEstrutura = lista.filter(r => (r.total_subpastas || 0) === 0).length;
  const totalPendencias = lista.reduce((s, r) => s + (r.obrigatorias_pendentes || 0), 0);
  const pctOk = totalColab ? Math.round((colabOk / totalColab) * 100) : 0;

  // Aplica busca + filtro de pendencia
  const listaFiltrada = lista.filter(r => {
    if (busca && !String(r.nome || '').toLowerCase().includes(busca.toLowerCase()) &&
        !String(r.matricula || '').includes(busca)) return false;
    if (filtro === 'pendentes' && (r.obrigatorias_pendentes || 0) === 0) return false;
    if (filtro === 'ok' && ((r.obrigatorias_pendentes || 0) > 0 || (r.obrigatorias || 0) === 0)) return false;
    return true;
  });

  return (
    <>
      {/* Cards de alerta no topo */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <CardDoc label="Colaboradores" valor={totalColab} cor="slate" icone="👥" />
        <CardDoc label="Total de Documentos" valor={totalDocs} cor="blue" icone="📄" />
        <CardDoc label="Sub-pastas Obrigatórias" valor={totalSubObrig} cor="indigo" icone="⚠️" />
        <CardDoc label="Sub-pastas Opcionais" valor={totalSubOpc} cor="emerald" icone="📁" />
        <CardDoc label="Pendências (obrig. sem arquivo)" valor={totalPendencias} cor="rose" icone="🚨"
                 destaque={totalPendencias > 0} />
        <CardDoc label="% Conformidade" valor={pctOk + '%'} cor={pctOk >= 80 ? 'emerald' : pctOk >= 50 ? 'amber' : 'rose'} icone="✅" />
      </div>

      {/* Alerta consolidado se houver pendencias */}
      {colabComPendencia > 0 && (
        <div className="bg-rose-50 border-l-4 border-rose-500 rounded-lg p-4 mb-4 flex items-start gap-3">
          <span className="text-2xl">🚨</span>
          <div className="flex-1">
            <div className="font-bold text-rose-900">
              {colabComPendencia} colaborador(es) com documentos obrigatórios pendentes
            </div>
            <div className="text-sm text-rose-700 mt-1">
              Total de {totalPendencias} sub-pasta(s) obrigatória(s) sem arquivo enviado.
              {colabSemEstrutura > 0 && ` ${colabSemEstrutura} colaborador(es) ainda não tem nenhuma pasta criada.`}
            </div>
          </div>
        </div>
      )}

      {/* Filtros + busca */}
      <div className="bg-white border rounded-lg p-3 mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          {[
            { id: 'todos', label: 'Todos', count: totalColab },
            { id: 'pendentes', label: 'Com Pendência', count: colabComPendencia },
            { id: 'ok', label: 'Conformes', count: colabOk },
          ].map(b => (
            <button key={b.id} onClick={() => setFiltro(b.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border-2 transition ${
                filtro === b.id
                  ? 'bg-pink-600 text-white border-pink-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}>
              {b.label} <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${filtro === b.id ? 'bg-white/30' : 'bg-gray-100'}`}>{b.count}</span>
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-[200px]">
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="🔎 Buscar colaborador por nome ou matrícula"
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-pink-500 focus:border-pink-500" />
        </div>
      </div>

      {/* Modal de visualizacao de documento com botao de fechar */}
      {docVisualizando && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
             onClick={() => setDocVisualizando(null)}>
          <button onClick={() => setDocVisualizando(null)}
            className="absolute top-4 right-4 z-50 w-12 h-12 rounded-full bg-white text-gray-900 hover:bg-gray-200 flex items-center justify-center shadow-2xl transition"
            title="Fechar (Esc)">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="absolute top-4 left-4 z-50 bg-white/90 px-4 py-2 rounded-lg shadow-lg max-w-[60%] truncate">
            <span className="font-semibold text-gray-900 text-sm">📄 {docVisualizando.nome}</span>
          </div>
          <div className="max-w-[90vw] max-h-[90vh] flex items-center justify-center"
               onClick={(e) => e.stopPropagation()}>
            {/\.(pdf)$/i.test(docVisualizando.nome) ? (
              <iframe src={docVisualizando.url} title={docVisualizando.nome}
                className="w-[90vw] h-[85vh] bg-white rounded-lg" />
            ) : /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(docVisualizando.nome) ? (
              <img src={docVisualizando.url} alt={docVisualizando.nome}
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
            ) : (
              <div className="bg-white p-8 rounded-lg text-center">
                <p className="text-gray-700 mb-4">Esse tipo de arquivo não pode ser pré-visualizado.</p>
                <a href={docVisualizando.url} target="_blank" rel="noreferrer"
                   className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Baixar arquivo
                </a>
              </div>
            )}
          </div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 px-4 py-2 rounded-full text-xs text-gray-600">
            Clique fora ou pressione <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-[10px] font-mono">Esc</kbd> para fechar
          </div>
        </div>
      )}

      {/* Lista de colaboradores */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <div className="overflow-x-auto slim-scroll">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-2 py-3 w-10"></th>
                <th className="px-4 py-3 text-left">Colaborador</th>
                <th className="px-4 py-3 text-center">Pastas</th>
                <th className="px-4 py-3 text-center">Total Docs</th>
                <th className="px-4 py-3 text-center">Opcionais</th>
                <th className="px-4 py-3 text-center">Obrigatórios</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {listaFiltrada.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">Nenhum colaborador encontrado</td></tr>
              )}
              {listaFiltrada.map(c => {
                const pendentes = c.obrigatorias_pendentes || 0;
                const obrigatorias = c.obrigatorias || 0;
                const opcionais = c.opcionais || 0;
                const total = c.total_arquivos || 0;
                const semEstrutura = (c.total_subpastas || 0) === 0;
                const expandido = expandidoId === c.colaborador_id;
                const tree = treeCache[c.colaborador_id];
                return (
                  <Fragment key={c.colaborador_id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-2 py-3 text-center">
                      <button onClick={() => toggleExpandir(c.colaborador_id)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-lg font-bold transition ${
                          expandido
                            ? 'bg-pink-600 text-white hover:bg-pink-700'
                            : 'bg-gray-100 text-gray-600 hover:bg-pink-100 hover:text-pink-700'
                        }`}
                        title={expandido ? 'Recolher' : 'Expandir documentos'}>
                        {expandido ? '−' : '+'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {c.foto_url
                          ? <img src={c.foto_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                          : <div className="w-9 h-9 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center font-bold text-sm">
                              {String(c.nome || '?').charAt(0).toUpperCase()}
                            </div>
                        }
                        <div>
                          <div className="font-semibold text-gray-900">{c.nome}</div>
                          <div className="text-xs text-gray-500">
                            {c.matricula ? `Mat. ${c.matricula}` : ''}{c.cargo_nome ? ` · ${c.cargo_nome}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold">{c.total_pastas || 0}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded font-bold">{total}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded">{opcionais}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded font-bold">{obrigatorias}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {semEstrutura ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                          ⚪ Sem estrutura
                        </span>
                      ) : pendentes > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-rose-100 text-rose-700 rounded text-xs font-bold">
                          🚨 {pendentes} pendente(s)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-bold">
                          ✅ Conforme
                        </span>
                      )}
                    </td>
                  </tr>
                  {expandido && (
                    <tr className="bg-gray-50">
                      <td colSpan={7} className="px-6 py-4">
                        {!tree && loadingTree && <div className="text-center text-gray-500 text-sm py-4">Carregando...</div>}
                        {tree && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* OPCIONAIS */}
                            <div className="bg-white rounded-lg border-2 border-emerald-200 overflow-hidden">
                              <div className="bg-emerald-50 px-4 py-3 border-b border-emerald-200">
                                <span className="font-bold text-emerald-800 text-base">📁 Sub-pastas Opcionais</span>
                                <span className="ml-2 text-sm text-emerald-600">
                                  ({tree.opcionais.reduce((s, p) => s + p.subpastas.length, 0)} sub-pasta(s))
                                </span>
                              </div>
                              <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
                                {tree.opcionais.length === 0 && <div className="text-sm text-gray-400 italic">Nenhuma sub-pasta opcional</div>}
                                {tree.opcionais.map(p => (
                                  <div key={p.id} className="border border-gray-100 rounded p-3">
                                    <div className="font-bold text-base text-gray-800 mb-2">📂 {p.nome}</div>
                                    <div className="ml-3 space-y-2">
                                      {p.subpastas.map(s => (
                                        <div key={s.id} className="text-sm">
                                          <div className="text-gray-700 font-semibold">↳ {s.nome} <span className="text-gray-400 font-normal">({s.documentos.length})</span></div>
                                          {s.documentos.length === 0 ? (
                                            <div className="ml-4 text-xs text-gray-400 italic">— sem documento —</div>
                                          ) : (
                                            <ul className="ml-4 space-y-1 mt-1">
                                              {s.documentos.map(d => (
                                                <li key={d.id}>
                                                  <button onClick={() => setDocVisualizando(d)}
                                                    className="text-blue-600 hover:text-blue-800 hover:underline text-sm text-left">
                                                    📄 {d.nome}
                                                  </button>
                                                </li>
                                              ))}
                                            </ul>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* OBRIGATORIAS */}
                            <div className="bg-white rounded-lg border-2 border-indigo-200 overflow-hidden">
                              <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-200">
                                <span className="font-bold text-indigo-800 text-base">⚠️ Sub-pastas Obrigatórias</span>
                                <span className="ml-2 text-sm text-indigo-600">
                                  ({tree.obrigatorias.reduce((s, p) => s + p.subpastas.length, 0)} sub-pasta(s))
                                </span>
                              </div>
                              <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
                                {tree.obrigatorias.length === 0 && <div className="text-sm text-gray-400 italic">Nenhuma sub-pasta obrigatória</div>}
                                {tree.obrigatorias.map(p => (
                                  <div key={p.id} className="border border-gray-100 rounded p-3">
                                    <div className="font-bold text-base text-gray-800 mb-2">📂 {p.nome}</div>
                                    <div className="ml-3 space-y-2">
                                      {p.subpastas.map(s => {
                                        const faltante = s.documentos.length === 0;
                                        return (
                                          <div key={s.id} className="text-sm">
                                            <div className={`font-semibold flex items-center gap-1 ${faltante ? 'text-rose-700' : 'text-gray-700'}`}>
                                              ↳ {s.nome}
                                              {faltante
                                                ? <span className="ml-1 px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-xs font-bold">FALTANTE</span>
                                                : <span className="ml-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-bold">OK ({s.documentos.length})</span>
                                              }
                                            </div>
                                            {s.documentos.length > 0 && (
                                              <ul className="ml-4 space-y-1 mt-1">
                                                {s.documentos.map(d => (
                                                  <li key={d.id}>
                                                    <a href={d.url} target="_blank" rel="noreferrer"
                                                      className="text-blue-600 hover:text-blue-800 hover:underline text-sm">
                                                      📄 {d.nome}
                                                    </a>
                                                  </li>
                                                ))}
                                              </ul>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function CardDoc({ label, valor, cor, icone, destaque }) {
  const cores = {
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return (
    <div className={`rounded-lg border-2 p-3 ${cores[cor] || cores.slate} ${destaque ? 'ring-2 ring-rose-300 animate-pulse' : ''}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase font-bold opacity-70">{label}</span>
        <span className="text-lg">{icone}</span>
      </div>
      <div className="text-2xl font-bold">{valor}</div>
    </div>
  );
}

// Tabela com formato planilha: linhas=faixas, colunas=meses + total
function TabelaMensal({ titulo, colaboradores, ano, mesLimite, classificar, ordemFaixas, dependeMes, cor = 'slate' }) {
  // Header unificado num tom discreto (slate suave) — todas as tabelas iguais
  const discreto = { headBg: 'bg-slate-100', subBg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', textSub: 'text-slate-500', textMuted: 'text-slate-300' };
  const palette = { azul: discreto, rosa: discreto, slate: discreto };
  const c = palette[cor] || discreto;
  // Pra cada mes, classifica os ativos e conta por faixa
  const dadosPorMes = []; // [{ totais: {faixa: qtd}, total: N }] indexado por mes 0..11
  for (let m = 1; m <= 12; m++) {
    if (m > mesLimite) {
      dadosPorMes.push(null); // mes futuro
      continue;
    }
    const ativos = ativosNoMes(colaboradores, ano, m);
    const totais = {};
    for (const c of ativos) {
      const faixa = dependeMes ? classificar(c, ano, m) : classificar(c);
      if (!faixa) continue;
      totais[faixa] = (totais[faixa] || 0) + 1;
    }
    dadosPorMes.push({ totais, total: ativos.length });
  }

  // Lista de faixas: usa ordemFaixas se fornecido, senao pega tudo que apareceu (sorted desc por total)
  let faixas = ordemFaixas;
  if (!faixas) {
    const todas = new Set();
    dadosPorMes.forEach(d => d && Object.keys(d.totais).forEach(k => todas.add(k)));
    faixas = Array.from(todas).sort((a, b) => {
      const totA = dadosPorMes.reduce((s, d) => s + (d?.totais[a] || 0), 0);
      const totB = dadosPorMes.reduce((s, d) => s + (d?.totais[b] || 0), 0);
      return totB - totA;
    });
  }

  return (
    <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
      <div className="overflow-x-auto slim-scroll">
        <table className="text-sm border-collapse table-fixed" style={{ width: '2030px' }}>
          <colgroup>
            <col style={{ width: '115px' }} />
            <col style={{ width: '115px' }} />
            {MESES.map(m => (
              <Fragment key={m}>
                <col style={{ width: '75px' }} />
                <col style={{ width: '75px' }} />
              </Fragment>
            ))}
          </colgroup>
          <thead>
            <tr className={`${c.headBg} border-b ${c.border}`}>
              <th className={`text-left px-3 py-2 font-bold ${c.text} uppercase text-sm tracking-wide`} colSpan={2} rowSpan={2}>{titulo}</th>
              {MESES.map((m, i) => (
                <th key={m} colSpan={2}
                  className={`text-center px-2 py-1.5 text-xs font-bold border-l ${c.border} ${i + 1 > mesLimite ? 'text-slate-300 bg-slate-50' : 'text-emerald-700 bg-emerald-50'}`}>{m}</th>
              ))}
            </tr>
            <tr className={`${c.subBg} border-b-2 ${c.border} text-[10px] uppercase`}>
              {MESES.map((m, i) => (
                <Fragment key={m}>
                  <th className={`text-center px-1 py-1 font-bold border-l ${c.border} ${i + 1 > mesLimite ? c.textMuted : c.textSub}`}>QTD</th>
                  <th className={`text-center px-1 py-1 font-bold ${i + 1 > mesLimite ? c.textMuted : c.textSub}`}>%</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {faixas.map(f => (
              <tr key={f} className="hover:bg-gray-50">
                <td className="px-3 py-1.5 text-sm font-medium text-gray-700" colSpan={2}>{f}</td>
                {dadosPorMes.map((d, i) => {
                  if (!d) return (
                    <Fragment key={i}>
                      <td className="px-1 py-1.5 text-center text-gray-300 text-xs border-l border-gray-100">—</td>
                      <td className="px-1 py-1.5 text-center text-gray-300 text-xs">—</td>
                    </Fragment>
                  );
                  const qtd = d.totais[f] || 0;
                  const pct = d.total ? Math.round((qtd / d.total) * 100) : 0;
                  return (
                    <Fragment key={i}>
                      <td className="px-1 py-1.5 text-center text-sm border-l border-gray-100">
                        {qtd > 0 ? <span className="font-bold text-gray-800">{qtd}</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-1 py-1.5 text-center text-xs">
                        {qtd > 0 ? <span className="text-gray-500 font-medium">{pct}%</span> : <span className="text-gray-300">—</span>}
                      </td>
                    </Fragment>
                  );
                })}
              </tr>
            ))}
            <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
              <td className="px-3 py-1.5 text-sm uppercase tracking-wide text-gray-700" colSpan={2}>TOTAL</td>
              {dadosPorMes.map((d, i) => (
                <Fragment key={i}>
                  <td className="px-1 py-1.5 text-center text-sm border-l border-gray-200">
                    {d ? <span className="text-gray-800">{d.total}</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-1 py-1.5 text-center text-xs">
                    {d ? <span className="text-gray-500">100%</span> : <span className="text-gray-300">—</span>}
                  </td>
                </Fragment>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Tabela de Recem Contratados (< 6 meses) + Admitidos no mes
// Igual a planilha do Tradicao: pra cada mes mostra qtd e % sobre ativos do mes
function TabelaMensalContratados({ titulo, colaboradores, ano, mesLimite }) {
  const linhaAtivos6m = []; // ativos com < 6 meses de empresa naquele mes
  const linhaAdmitidos = []; // admitidos NAQUELE mes especifico
  let totalAtivos6m = 0, totalAdmitidos = 0;

  for (let m = 1; m <= 12; m++) {
    if (m > mesLimite) {
      linhaAtivos6m.push(null);
      linhaAdmitidos.push(null);
      continue;
    }
    // Ativos no fim do mes
    const ativos = ativosNoMes(colaboradores, ano, m);
    const ref = new Date(ano, m, 0);
    // Quantos desses tem < 6 meses de empresa
    const seisMesesAtras = new Date(ref);
    seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);
    const qtdMenos6m = ativos.filter(c => {
      if (!c.data_admissao) return false;
      return new Date(c.data_admissao) >= seisMesesAtras;
    }).length;
    const pct6m = ativos.length ? Math.round((qtdMenos6m / ativos.length) * 100) : 0;
    linhaAtivos6m.push({ qtd: qtdMenos6m, pct: pct6m, total: ativos.length });
    totalAtivos6m += qtdMenos6m;

    // Admitidos NO mes
    const adm = admitidosNoMes(colaboradores, ano, m).length;
    linhaAdmitidos.push(adm);
    totalAdmitidos += adm;
  }

  return (
    <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
      <div className="overflow-x-auto slim-scroll">
        <table className="text-sm border-collapse table-fixed" style={{ width: '2180px' }}>
          <colgroup>
            <col style={{ width: '115px' }} />
            <col style={{ width: '115px' }} />
            {MESES.map(m => <col key={m} style={{ width: '150px' }} />)}
            <col style={{ width: '150px' }} />
          </colgroup>
          <thead>
            <tr className="bg-slate-300 border-b-2 border-slate-400">
              <th className="text-left px-3 py-2 font-bold text-slate-800 uppercase text-sm tracking-wide" colSpan={2}>{titulo}</th>
              {MESES.map((m, i) => (
                <th key={m} className={`text-center px-2 py-2 text-xs font-bold border-l border-slate-400 ${i + 1 > mesLimite ? 'text-slate-400' : 'text-slate-800'}`}>{m}</th>
              ))}
              <th className="text-center px-2 py-2 text-xs font-bold text-slate-800 bg-slate-400 border-l border-slate-500">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr className="hover:bg-gray-50">
              <td className="px-3 py-1.5 text-sm font-medium text-gray-700" colSpan={2}>... 6 meses (ativos)</td>
              {linhaAtivos6m.map((d, i) => (
                <td key={i} className="px-2 py-1.5 text-center text-sm">
                  {!d ? <span className="text-gray-300">—</span> :
                   d.qtd === 0 ? <span className="text-gray-300">—</span> :
                   <>
                     <span className="font-bold text-pink-700">{d.qtd}</span>
                     <span className="text-xs text-gray-400 ml-1">({d.pct}%)</span>
                   </>}
                </td>
              ))}
              <td className="px-2 py-1.5 text-center text-sm font-bold text-orange-800 bg-orange-50">{totalAtivos6m}</td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="px-3 py-1.5 text-sm font-medium text-gray-700" colSpan={2}>Admitidos no mês</td>
              {linhaAdmitidos.map((q, i) => (
                <td key={i} className="px-2 py-1.5 text-center text-sm">
                  {q == null ? <span className="text-gray-300">—</span> :
                   q === 0 ? <span className="text-gray-300">—</span> :
                   <span className="font-bold text-emerald-700">{q}</span>}
                </td>
              ))}
              <td className="px-2 py-1.5 text-center text-sm font-bold text-emerald-800 bg-orange-50">{totalAdmitidos}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function agrupar(arr, fn) {
  const map = {};
  arr.forEach(x => {
    const k = fn(x);
    map[k] = (map[k] || 0) + 1;
  });
  return map;
}

function BlocoBarras({ titulo, dados, cor, ordem, pessoas }) {
  const [aberto, setAberto] = useState(null);
  let entries = Object.entries(dados).filter(([, v]) => v > 0);
  if (Array.isArray(ordem)) {
    // Ordena conforme ordem fornecida (mantem so as faixas que tem valor)
    entries = ordem
      .filter(k => (dados[k] || 0) > 0)
      .map(k => [k, dados[k]]);
  } else {
    entries.sort((a, b) => b[1] - a[1]);
  }
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-lg border shadow-sm p-5">
        <h3 className="font-bold text-gray-800 text-base mb-3">{titulo}</h3>
        <div className="text-center text-gray-400 py-8 text-sm">Sem dados</div>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-lg border shadow-sm p-5">
      <h3 className="font-bold text-gray-800 text-base mb-3">{titulo}</h3>
      <div className="space-y-3">
        {entries.map(([label, qtd]) => {
          const pct = Math.round((qtd / total) * 100);
          const ab = aberto === label;
          return (
            <div key={label}>
              <div className="flex justify-between mb-1 items-center gap-2">
                <span className="font-semibold text-gray-700 text-sm flex items-center gap-2">
                  {pessoas && <button onClick={() => setAberto(ab ? null : label)} title="Ver nomes" className="w-4 h-4 inline-flex items-center justify-center rounded bg-gray-200 text-gray-600 text-xs font-bold hover:bg-indigo-200 flex-shrink-0">{ab ? '−' : '+'}</button>}
                  {label}
                </span>
                <span className="font-bold text-gray-800 text-base whitespace-nowrap">{qtd} <span className="text-gray-700 font-semibold">({pct}%)</span></span>
              </div>
              <div className="h-4 bg-gray-100 rounded overflow-hidden">
                <div className={`h-full ${cor}`} style={{ width: `${pct}%` }}></div>
              </div>
              {ab && pessoas && <ExpandNomes pessoas={pessoas[label]} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Tabela({ titulo, cor, linhas }) {
  const cores = { emerald: 'bg-emerald-50 text-emerald-800', rose: 'bg-rose-50 text-rose-800' };
  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className={`px-4 py-3 border-b ${cores[cor]}`}>
        <h3 className="text-sm font-bold">{titulo}</h3>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Nome</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Cargo</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Data</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {linhas.length === 0 ? (
            <tr><td colSpan={3} className="px-3 py-4 text-center text-sm text-gray-400">Nenhum registro</td></tr>
          ) : linhas.map((l, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-3 py-2 text-gray-800 font-medium">{l.a}</td>
              <td className="px-3 py-2 text-gray-600">{l.b}</td>
              <td className="px-3 py-2 text-gray-600">{l.c}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Esqueleto das abas que ainda nao tem dados conectados.
// ====== Aba Ponto e Ausências — dashboards reais (apuração RHiD agregada) ======
const PALETA = ['#6366f1', '#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#eab308', '#64748b'];
const MES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const KPI_PADRAO = ['absenteismo', 'gravidade', 'nao_planejada', 'planejadas', 'jornada', 'tea', 'frequencia', 'atestados', 'he'];
// Tipos de ausência pros gráficos empilhados mês a mês (2 gráficos separados)
const TIPOS_NAO_PLAN = [
  { key: 'falta_pct', label: 'Falta', cor: '#ef4444' },
  { key: 'atraso_pct', label: 'Atraso', cor: '#f59e0b' },
  { key: 'atestado_pct', label: 'Atestado', cor: '#8b5cf6' },
];
const TIPOS_PLAN = [
  { key: 'ferias_pct', label: 'Férias', cor: '#3b82f6' },
  { key: 'maternidade_pct', label: 'Lic. Maternidade', cor: '#ec4899' },
  { key: 'paternidade_pct', label: 'Lic. Paternidade', cor: '#14b8a6' },
  { key: 'casamento_pct', label: 'Lic. Casamento', cor: '#eab308' },
  { key: 'obito_pct', label: 'Óbito', cor: '#64748b' },
  { key: 'banco_pct', label: 'Banco Horas', cor: '#10b981' },
];
// Plugin: desenha o TOTAL (%) no topo de cada barra empilhada (por ano/stack)
const totalTopoPlugin = {
  id: 'totalTopo',
  afterDatasetsDraw(chart) {
    const { ctx, scales: { y } } = chart;
    const dss = chart.data.datasets, n = chart.data.labels.length, stacks = {};
    // só soma os datasets VISÍVEIS (respeita quando o usuário esconde uma série na legenda)
    dss.forEach((ds, di) => { if (chart.isDatasetVisible(di)) (stacks[ds.stack] ||= []).push(di); });
    ctx.save(); ctx.font = 'bold 13px Arial'; ctx.fillStyle = '#111827'; ctx.textAlign = 'center';
    for (let i = 0; i < n; i++) {
      for (const s in stacks) {
        let total = 0; stacks[s].forEach(di => { total += (dss[di].data[i] || 0); });
        if (total <= 0) continue;
        const bar = chart.getDatasetMeta(stacks[s][0]).data[i]; if (!bar) continue;
        ctx.fillText(total.toFixed(1) + '%', bar.x, y.getPixelForValue(total) - 4);
      }
    }
    ctx.restore();
  },
};
const hmMin = (min) => { if (!min || min <= 0) return '0h'; const h = Math.floor(min / 60), m = Math.round(min % 60); return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`; };
// versão mais espaçada pros cards grandes (melhor leitura): "37236h 14min"
const hmLong = (min) => { if (!min || min <= 0) return '0h'; const h = Math.floor(min / 60), m = Math.round(min % 60); return m ? `${h.toLocaleString('pt-BR')}h ${String(m).padStart(2, '0')}min` : `${h.toLocaleString('pt-BR')}h`; };

function KpiCard({ titulo, valor, sub, cor = 'gray', destaque, info, valor2, sub2, cor2 = 'violet', chips, gear, onGear, rodape }) {
  const bordas = { rose: 'border-rose-400', amber: 'border-amber-400', blue: 'border-blue-400', emerald: 'border-emerald-400', violet: 'border-violet-400', pink: 'border-pink-400', gray: 'border-gray-300' };
  const textos = { rose: 'text-rose-600', amber: 'text-amber-600', blue: 'text-blue-600', emerald: 'text-emerald-600', violet: 'text-violet-600', pink: 'text-pink-600', gray: 'text-gray-700' };
  return (
    <div className={`relative h-full bg-white rounded-lg border-l-4 ${bordas[cor]} shadow-sm p-4`}>
      <div className="absolute top-2 right-2 flex items-center gap-1.5 z-20">
        {gear && (
          <button onMouseDown={e => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onGear && onGear(); }} title="Configurar valor da hora (R$)"
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500 text-xs">⚙️</button>
        )}
        {info && (
          <div className="group relative">
            <span className="w-4 h-4 flex items-center justify-center rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold cursor-help select-none">i</span>
            <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute right-0 top-6 z-50 w-60 p-2.5 rounded-lg bg-gray-800 text-white text-[11px] leading-snug shadow-xl">
              {info}
              <span className="absolute -top-1 right-1.5 w-2 h-2 bg-gray-800 rotate-45"></span>
            </div>
          </div>
        )}
      </div>
      <p className="text-xs uppercase font-semibold text-gray-500 pr-5">{titulo}</p>
      {valor2 != null ? (
        <div className="flex items-end gap-4 mt-1">
          <div>
            <p className={`text-2xl font-bold ${textos[cor]} leading-none`}>{valor}</p>
            <p className="text-[10px] text-gray-400 mt-1">{sub}</p>
          </div>
          <div className="pb-0.5 border-l border-gray-100 pl-4">
            <p className={`text-2xl font-bold ${textos[cor2]} leading-none`}>{valor2}</p>
            <p className="text-[10px] text-gray-400 mt-1">{sub2}</p>
          </div>
        </div>
      ) : (
        <>
          <p className={`${destaque ? 'text-3xl' : 'text-2xl'} font-bold ${textos[cor]} mt-1`}>{valor}</p>
          {chips && chips.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
              {chips.map((ch, i) => (
                <div key={i}>
                  <div className="text-[10px] uppercase font-semibold text-gray-400 leading-none">{ch.label}</div>
                  <div className={`text-sm font-bold ${textos[ch.cor || 'gray']} leading-tight`}>{ch.valor}</div>
                </div>
              ))}
            </div>
          )}
          {sub && <p className="text-[11px] text-gray-400 mt-1">{sub}</p>}
        </>
      )}
      {rodape && <div className="mt-2 pt-2 border-t border-gray-100">{rodape}</div>}
    </div>
  );
}

function Avatar({ nome, foto }) {
  const [erro, setErro] = useState(false);
  const ini = (nome || '?').trim().charAt(0).toUpperCase();
  if (foto && !erro) return <img src={foto} alt="" onError={() => setErro(true)} className="w-7 h-7 rounded-full object-cover border border-gray-200 flex-shrink-0" />;
  return <span className="w-7 h-7 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{ini}</span>;
}

function Painel({ titulo, hint, children, className = '' }) {
  return (
    <div className={`bg-white rounded-lg border shadow-sm p-4 ${className}`}>
      <h3 className="font-bold text-gray-700">{titulo}</h3>
      {hint && <p className="text-[11px] text-gray-400 mb-2">{hint}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

// Detalhe expandido: por mês, as DATAS de cada ocorrência (falta/atestado/atraso).
function DetalheColab({ c }) {
  const oc = c.ocorrencias || [];
  const fmtDia = (ymd) => `dia ${ymd.slice(6, 8)}`;
  const porMes = {};
  for (const o of oc) {
    const m = +o.ymd.slice(4, 6);
    const g = (porMes[m] ||= { falta: [], atestado: [], atraso: [], ferias: [], maternidade: [] });
    if (g[o.tipo]) g[o.tipo].push(o);
  }
  const meses = Object.keys(porMes).map(Number).sort((a, b) => a - b);
  return (
    <div className="bg-indigo-50/50 border-y border-indigo-200 p-3">
      <div className="text-[11px] font-bold text-gray-600 mb-2">📅 Datas das ocorrências por mês — {c.nome}</div>
      {meses.length === 0 ? <div className="text-gray-400 text-[11px]">Sem faltas, atestados ou atrasos no período. 👏</div> : (
        <div className="flex flex-wrap gap-2">
          {meses.map(m => {
            const g = porMes[m];
            return (
              <div key={m} className="bg-white rounded-lg border border-indigo-100 p-2 min-w-[160px] text-[11px] shadow-sm">
                <div className="font-bold text-gray-700 text-center border-b border-gray-100 pb-1 mb-1">{MES_ABREV[m - 1]}</div>
                {g.falta.length > 0 && <div className="mb-0.5"><span className="font-semibold text-rose-600">Faltas ({g.falta.length}):</span> <span className="text-gray-600">{g.falta.map(o => fmtDia(o.ymd)).join(', ')}</span></div>}
                {g.atraso.length > 0 && <div className="mb-0.5"><span className="font-semibold text-amber-600">Atrasos ({g.atraso.length}):</span> <span className="text-gray-600">{g.atraso.map(o => `${fmtDia(o.ymd)} (${hmMin(o.min)})`).join(', ')}</span></div>}
                {g.atestado.length > 0 && <div className="mb-0.5"><span className="font-semibold text-violet-600">Atestados ({g.atestado.length}):</span> <span className="text-gray-600">{g.atestado.map(o => fmtDia(o.ymd)).join(', ')}</span></div>}
                {g.ferias.length > 0 && <div className="mb-0.5"><span className="font-semibold text-blue-600">Férias ({g.ferias.length}):</span> <span className="text-gray-600">{g.ferias.map(o => fmtDia(o.ymd)).join(', ')}</span></div>}
                {g.maternidade.length > 0 && <div className="mb-0.5"><span className="font-semibold text-pink-600">Maternidade ({g.maternidade.length}):</span> <span className="text-gray-600">{g.maternidade.map(o => fmtDia(o.ymd)).join(', ')}</span></div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AbaPontoAusencias({ ano, empresaId }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [dataPrev, setDataPrev] = useState(null);   // ano anterior (comparativo)
  const [erro, setErro] = useState(null);
  const [verFora, setVerFora] = useState(false);
  // Ordenação do ranking — padrão por Criticidade (Bradford). Reseta ao sair/voltar da aba.
  const [rankSort, setRankSort] = useState({ campo: 'bradford', dir: 'desc' });
  const [rankStatus, setRankStatus] = useState('todos'); // todos | ativos | inativos
  const [expandido, setExpandido] = useState(null);   // id do colaborador com linha expandida
  // Ordem dos cards de KPI (arrastáveis) — salva no navegador
  const [kpiOrder, setKpiOrder] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('indPontoKpiOrder') || 'null');
      if (Array.isArray(s)) { const arr = s.filter(x => KPI_PADRAO.includes(x)); KPI_PADRAO.forEach(x => { if (!arr.includes(x)) arr.push(x); }); return arr; }
    } catch { /* ignore */ }
    return KPI_PADRAO;
  });
  const [kpiDrag, setKpiDrag] = useState(null);
  const [kpiOver, setKpiOver] = useState(null);
  // Valor médio da hora (R$) pra estimativa de perda financeira
  const [valorHora, setValorHora] = useState(null);
  const [salarioMedio, setSalarioMedio] = useState(0);
  const [valorHoraSugerido, setValorHoraSugerido] = useState(null);
  const [showConfigHora, setShowConfigHora] = useState(false);
  const [inputHora, setInputHora] = useState('');
  const [salvandoHora, setSalvandoHora] = useState(false);

  useEffect(() => {
    api.get('/rh/ponto/valor-hora').then(r => {
      setValorHora(r.data?.valor_hora ?? null);
      setSalarioMedio(r.data?.salario_medio || 0);
      setValorHoraSugerido(r.data?.valor_hora_sugerido ?? null);
    }).catch(() => { /* ignore */ });
  }, []);

  const salvarValorHora = async () => {
    const v = Number(String(inputHora).replace(',', '.'));
    if (!isFinite(v) || v < 0) { toast.error('Informe um valor válido'); return; }
    setSalvandoHora(true);
    try {
      await api.post('/rh/ponto/valor-hora', { valor: v });
      setValorHora(v); setShowConfigHora(false); toast.success('Valor da hora salvo');
    } catch { toast.error('Erro ao salvar'); } finally { setSalvandoHora(false); }
  };

  const carregar = async (refresh = false) => {
    setLoading(true); setErro(null);
    try {
      const p = new URLSearchParams({ ano: String(ano) });
      if (empresaId) p.set('company_id', empresaId);
      if (refresh) p.set('refresh', '1');
      const pp = new URLSearchParams({ ano: String(ano - 1) });
      if (empresaId) pp.set('company_id', empresaId);
      if (refresh) pp.set('refresh', '1');
      const [r, rp] = await Promise.all([
        api.get(`/rh/ponto/indicadores?${p.toString()}`),
        api.get(`/rh/ponto/indicadores?${pp.toString()}`).catch(() => null),   // ano anterior (não bloqueia)
      ]);
      setData(r.data);
      setDataPrev(rp?.data || null);
    } catch (e) {
      setErro(e?.response?.data?.error || 'Erro ao carregar indicadores de ponto');
    } finally { setLoading(false); }
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [ano, empresaId]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 text-gray-500">
      <RadarLoading size="sm" message="" />
      <p className="mt-3 font-semibold">Agregando a apuração RHiD de todos os colaboradores…</p>
      <p className="text-xs text-gray-400">Pode levar alguns segundos na primeira carga (depois fica em cache).</p>
    </div>
  );
  if (erro) return <div className="text-center py-16 text-rose-600 bg-rose-50 rounded-lg border border-rose-200"><div className="text-3xl mb-2">⚠️</div><p className="font-bold">{erro}</p></div>;
  if (!data || !data.funcionarios) return <div className="text-center py-16 text-amber-600 bg-amber-50 rounded-lg border border-amber-200"><div className="text-3xl mb-2">🔎</div><p className="font-bold">Nenhum colaborador com PIS vinculado à RHiD nesse filtro.</p><p className="text-sm mt-1">Vincule o PIS em RH &gt; Espelho de Ponto (Sincronizar PIS).</p></div>;

  const k = data.kpis;
  const ateMes = data.periodo.ate_mes;
  const MESES = data.por_mes.map(m => m.label);
  const mesesFechados = data.por_mes.filter(m => m.mes <= ateMes);   // só meses encerrados (com sub-colunas)
  const colSpanTotal = 3 + mesesFechados.length * 5 + 6;             // colaborador+setor+ativo + meses*5 + resumo

  // Gráficos mês a mês — empilhado por tipo, agrupado por ano (anterior vs atual)
  const anoAtual = data.periodo.ano;
  const prevMes = dataPrev?.por_mes || [];
  const buildStacked = (tipos) => {
    const dsAtual = tipos.map(t => ({ label: t.label, data: data.por_mes.map(m => m.mes > ateMes ? null : (m[t.key] || 0)), backgroundColor: t.cor, stack: 'atual', maxBarThickness: 36 }));
    const dsPrev = tipos.map(t => ({ label: `${t.label} ${anoAtual - 1}`, data: prevMes.map(m => (m[t.key] || 0)), backgroundColor: t.cor + '66', stack: 'anterior', maxBarThickness: 36 }));
    return { labels: MESES, datasets: dataPrev ? [...dsPrev, ...dsAtual] : dsAtual };
  };
  const chartNaoPlan = buildStacked(TIPOS_NAO_PLAN);
  const chartPlan = buildStacked(TIPOS_PLAN);

  // Gráfico 2: Absenteísmo por setor (barras horizontais)
  const setores = data.por_setor;
  const chartSetor = {
    labels: setores.map(s => s.setor),
    datasets: [{ label: 'Absenteísmo %', data: setores.map(s => s.absenteismo_pct), backgroundColor: setores.map((_, i) => PALETA[i % PALETA.length]), borderRadius: 4 }],
  };

  // Gráfico 3: por tipo (rosca)
  // Pizzas divididas: Não Planejadas x Planejadas
  const LABELS_NAO_PLAN = ['Falta', 'Atraso', 'Atestado', 'Abono'];
  const mkPizza = (arr) => ({ labels: arr.map(t => t.tipo), datasets: [{ data: arr.map(t => Math.round(t.min / 60)), backgroundColor: arr.map(t => t.cor), borderWidth: 0 }] });
  const tiposNaoPlan = (data.por_tipo || []).filter(t => LABELS_NAO_PLAN.includes(t.tipo) && t.min > 0).sort((a, b) => b.min - a.min);
  const tiposPlan = (data.por_tipo || []).filter(t => !LABELS_NAO_PLAN.includes(t.tipo) && t.min > 0).sort((a, b) => b.min - a.min);
  const chartTipoNaoPlan = mkPizza(tiposNaoPlan);
  const chartTipoPlan = mkPizza(tiposPlan);

  // Gráfico 4: por setor mês a mês (linha, top 6 setores)
  const top6 = setores.slice(0, 6);
  const chartSetorMes = {
    labels: MESES,
    datasets: top6.map((s, i) => ({
      label: s.setor, data: s.por_mes.map(pm => pm.mes > ateMes ? null : pm.absenteismo_pct),
      borderColor: PALETA[i % PALETA.length], backgroundColor: PALETA[i % PALETA.length], tension: 0.3, spanGaps: true, pointRadius: 2,
    })),
  };

  const optBar = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: v => v + '%', font: { size: 10 } } }, x: { ticks: { font: { size: 10 } } } } };
  // Opções do gráfico mês a mês (empilhado por tipo + agrupado por ano)
  const optMes = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { boxWidth: 10, font: { size: 10 }, filter: (item) => !/\d{4}$/.test(item.text) },
        // clicar num tipo esconde/mostra os DOIS anos (atual + anterior) daquele tipo
        onClick: (e, item, legend) => {
          const chart = legend.chart;
          const base = item.text;
          const vaiEsconder = chart.isDatasetVisible(item.datasetIndex);
          chart.data.datasets.forEach((ds, i) => {
            if (ds.label.replace(/\s+\d{4}$/, '') === base) chart.setDatasetVisibility(i, !vaiEsconder);
          });
          chart.update();
        },
      },
      datalabels: { color: '#fff', font: { size: 11, weight: 'bold' }, display: (c) => (c.dataset.data[c.dataIndex] || 0) >= 3, formatter: (v) => Math.round(v) + '%' },
      tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.parsed.y}%` } },
    },
    scales: { x: { stacked: true, ticks: { font: { size: 10 } } }, y: { stacked: true, beginAtZero: true, grace: '35%', ticks: { callback: v => v + '%', font: { size: 10 } } } },
  };
  // Plugin (por gráfico): diferença ano-a-ano acima de cada mês (%, horas, R$) — verde cai / vermelho sobe
  const mkDiffPlugin = (tipos) => ({
    id: 'diffAno',
    afterDatasetsDraw(chart) {
      if (!dataPrev) return;
      const { ctx, chartArea, scales: { x } } = chart;
      const minKeys = tipos.map(t => t.key.replace('_pct', '_min'));
      const yL1 = chartArea.top + 12, yL2 = chartArea.top + 27;   // reta fixa no topo (todos alinhados)
      ctx.save(); ctx.textAlign = 'center';
      for (let i = 0; i < (data.por_mes || []).length; i++) {
        const cur = data.por_mes[i]; if (!cur || cur.mes > ateMes) continue;
        const prv = prevMes[i];
        const sumMin = (o) => o ? minKeys.reduce((a, kk) => a + (o[kk] || 0), 0) : 0;
        const sumPct = (o) => o ? tipos.reduce((a, t) => a + (o[t.key] || 0), 0) : 0;
        const curMin = sumMin(cur), prvMin = sumMin(prv), curPct = sumPct(cur), prvPct = sumPct(prv);
        if (curMin === 0 && prvMin === 0) continue;
        const dPct = +(curPct - prvPct).toFixed(1), dMin = curMin - prvMin;
        const dRe = valorHora != null ? (dMin / 60 * valorHora) : null;
        // cor/seta pela variação do % (comparação justa, normaliza tamanho do quadro)
        const subiu = dPct > 0;
        const cor = dPct === 0 ? '#6b7280' : subiu ? '#dc2626' : '#16a34a';
        const seta = dPct === 0 ? '=' : subiu ? '▲' : '▼';
        const sinal = (v) => (v > 0 ? '+' : '');
        const xPix = x.getPixelForValue(i);
        ctx.fillStyle = cor;
        ctx.font = 'bold 14px Arial';
        ctx.fillText(`${seta} ${sinal(dPct)}${dPct}pp`, xPix, yL1);
        ctx.font = 'bold 11px Arial';
        ctx.fillText(`${sinal(dMin)}${Math.round(dMin / 60)}h${dRe != null ? ` · ${sinal(dRe)}${dRe.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}` : ''}`, xPix, yL2);
      }
      ctx.restore();
    },
  });
  const optBarH = { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { callback: v => v + '%', font: { size: 10 } } }, y: { ticks: { font: { size: 10 } } } } };
  const optLine = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } }, scales: { y: { beginAtZero: true, ticks: { callback: v => v + '%', font: { size: 10 } } }, x: { ticks: { font: { size: 10 } } } } };
  const optTipo = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          boxWidth: 12, font: { size: 11 },
          generateLabels: (chart) => {
            const ds = chart.data.datasets[0]; const tot = (ds.data || []).reduce((a, b) => a + b, 0) || 1;
            return chart.data.labels.map((lbl, i) => ({ text: `${lbl} — ${(ds.data[i] / tot * 100).toFixed(1)}%`, fillStyle: ds.backgroundColor[i], strokeStyle: ds.backgroundColor[i], index: i }));
          },
        },
      },
      tooltip: { callbacks: { label: c => { const tot = c.dataset.data.reduce((a, b) => a + b, 0) || 1; return `${c.label}: ${c.parsed}h (${(c.parsed / tot * 100).toFixed(1)}%)`; } } },
    },
  };

  // Ordenação do ranking (colunas clicáveis). Texto = A→Z; números = maior→menor por padrão.
  const RANK_TEXT = new Set(['nome', 'setor']);
  const toggleRank = (campo) => setRankSort(s => s.campo === campo ? { campo, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { campo, dir: RANK_TEXT.has(campo) ? 'asc' : 'desc' });
  const setaRank = (campo) => rankSort.campo === campo ? (rankSort.dir === 'asc' ? ' ▲' : ' ▼') : '';
  const rankingFull = data.ranking_colaboradores || [];
  const rankCount = { todos: rankingFull.length, ativos: rankingFull.filter(c => c.ativo).length, inativos: rankingFull.filter(c => !c.ativo).length };
  const ranking = [...rankingFull]
    .filter(c => rankStatus === 'todos' ? true : rankStatus === 'ativos' ? c.ativo : !c.ativo)
    .sort((a, b) => {
      const { campo, dir } = rankSort;
      if (RANK_TEXT.has(campo)) return String(a[campo] || '').localeCompare(String(b[campo] || ''), 'pt-BR') * (dir === 'asc' ? 1 : -1);
      return ((a[campo] || 0) - (b[campo] || 0)) * (dir === 'asc' ? 1 : -1);
    });
  // Pílula (badge arredondado) pros valores do ranking
  const pill = (txt, cls) => <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{txt}</span>;
  const dashCell = <span className="text-gray-300">—</span>;

  return (
    <>
      {/* Modal: configurar valor médio da hora (R$) */}
      {showConfigHora && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4" onClick={() => setShowConfigHora(false)}>
          <div className="bg-white rounded-xl p-5 w-96 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-1">💰 Valor médio da hora</h3>
            <p className="text-xs text-gray-500 mb-3">Usado pra estimar a perda financeira das ausências não planejadas.</p>
            <label className="block text-xs font-bold uppercase text-gray-600 mb-1">R$ por hora</label>
            <input type="text" inputMode="decimal" value={inputHora} onChange={e => setInputHora(e.target.value)} placeholder="Ex: 12,50"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-purple-500" />
            <div className="mt-2 bg-purple-50 border border-purple-100 rounded-lg p-2 text-xs text-purple-800 flex items-center justify-between gap-2">
              <span>Salário médio {salarioMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} ÷ 220h</span>
              {valorHoraSugerido != null && <button onClick={() => setInputHora(String(valorHoraSugerido))} className="px-2 py-1 rounded bg-purple-600 text-white font-semibold hover:bg-purple-700 whitespace-nowrap">💡 Sugerir {valorHoraSugerido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</button>}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={salvarValorHora} disabled={salvandoHora} className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-60">{salvandoHora ? 'Salvando…' : 'Salvar'}</button>
              <button onClick={() => setShowConfigHora(false)} className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300">Cancelar</button>
            </div>
          </div>
        </div>
      )}
      {/* Barra de contexto + diagnóstico + recalcular */}
      {(() => {
        const dg = data.diagnostico || {};
        const fora = dg.nao_incluidos || [];
        return (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>📊 <b className="text-gray-700">{dg.incluidos ?? data.funcionarios} de {dg.total_ativos ?? '—'}</b> colaboradores ativos · ano {data.periodo.ano} {ateMes >= 1 ? `(jan–${MESES[ateMes - 1]})` : '(nenhum mês fechado ainda)'} · <span title="O mês vigente não entra — o RH só ajusta as marcações depois que o mês fecha.">mês vigente não considerado ⓘ</span> · fonte RHiD {data.cache && '· cache'}</span>
              <button onClick={() => carregar(true)} className="px-2 py-1 rounded bg-purple-100 text-purple-700 font-semibold hover:bg-purple-200 whitespace-nowrap">🔄 Recalcular</button>
            </div>
            {fora.length > 0 && (
              <div className="mt-1 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 flex items-center justify-between">
                <span>⚠️ <b>{fora.length}</b> fora do dashboard — {dg.nao_encontrado} não encontrados no relógio · {dg.sem_documento} sem CPF/PIS · {dg.nao_bate_ponto} não batem ponto</span>
                <button onClick={() => setVerFora(v => !v)} className="underline font-semibold whitespace-nowrap ml-2">{verFora ? 'ocultar' : 'ver quem'}</button>
              </div>
            )}
            {dg.apuracao_falhas > 0 && (
              <div className="mt-1 text-[11px] text-rose-800 bg-rose-50 border border-rose-300 rounded px-2 py-1">
                <div className="flex items-start gap-1">
                  <span>🚨</span>
                  <span>
                    <b>{dg.apuracao_falhas}</b> apuraç{dg.apuracao_falhas === 1 ? 'ão falhou' : 'ões falharam'} no RHiD
                    {dg.apuracao_ok != null && <span className="text-rose-500"> (de {dg.apuracao_ok + dg.apuracao_falhas} tentativas · {dg.apuracao_ok} ok)</span>}
                    {dg.apuracao_erros?.length > 0 && <> — erro: <b>{dg.apuracao_erros.join(' · ')}</b></>}
                    {dg.apuracao_pessoas_falha?.length > 0 && <div className="text-rose-600 mt-0.5">Afetados: {dg.apuracao_pessoas_falha.join(', ')}</div>}
                    <div className="text-rose-500 mt-0.5">💡 Costuma ser dado inválido no relógio (ex.: data de admissão/início de escala). Corrija no RHiD e clique em Recalcular.</div>
                  </span>
                </div>
              </div>
            )}
            {verFora && fora.length > 0 && (
              <div className="mt-1 max-h-44 overflow-auto bg-white border rounded p-2 text-[11px]">
                {fora.map((c, i) => (
                  <div key={i} className="flex justify-between gap-2 py-0.5 border-b border-gray-50">
                    <span className="font-medium text-gray-700 whitespace-nowrap">{c.nome} <span className="text-gray-400 font-normal">· {c.setor}</span></span>
                    <span className={c.motivo.includes('sem CPF') ? 'text-amber-600' : c.motivo.includes('não bate') ? 'text-gray-500' : 'text-rose-600'}>{c.motivo}</span>
                  </div>
                ))}
                <p className="text-gray-400 mt-1">💡 Sem PIS? Vá em <b>RH → Espelho de Ponto → 🔗 Sincronizar PIS</b> pra preencher automaticamente pela RHiD.</p>
              </div>
            )}
          </div>
        );
      })()}

      {/* KPIs — cards arrastáveis (ordem salva no navegador) */}
      {(() => {
        const chipsPlan = [
          { label: 'Férias', valor: hmLong(k.ferias_min), cor: 'blue' },
          { label: 'Lic. Maternidade', valor: hmLong(k.maternidade_min), cor: 'pink' },
        ];
        if (k.paternidade_min > 0) chipsPlan.push({ label: 'Lic. Paternidade', valor: hmLong(k.paternidade_min), cor: 'emerald' });
        if (k.casamento_min > 0) chipsPlan.push({ label: 'Lic. Casamento', valor: hmLong(k.casamento_min), cor: 'amber' });
        if (k.obito_min > 0) chipsPlan.push({ label: 'Óbito', valor: hmLong(k.obito_min), cor: 'gray' });
        if (k.banco_min > 0) chipsPlan.push({ label: 'Banco Horas', valor: hmLong(k.banco_min), cor: 'emerald' });
        const totalPlan = (k.ferias_min || 0) + (k.maternidade_min || 0) + (k.paternidade_min || 0) + (k.casamento_min || 0) + (k.obito_min || 0) + (k.banco_min || 0);
        const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const abrirConfigHora = () => { setInputHora(valorHora != null ? String(valorHora) : (valorHoraSugerido != null ? String(valorHoraSugerido) : '')); setShowConfigHora(true); };
        const gearRodape = (min, label, colorClass) => valorHora != null ? (
          <div>
            <div className="text-[10px] uppercase font-semibold text-gray-400">💰 {label}</div>
            <div className={`text-lg font-bold ${colorClass} leading-tight`}>{brl(min / 60 * valorHora)}</div>
            <div className="text-[10px] text-gray-400">{hmMin(min)} × {brl(valorHora)}/h</div>
          </div>
        ) : (
          <button onClick={abrirConfigHora} className="text-[11px] text-purple-600 font-semibold hover:underline">⚙️ Configure o valor da hora pra estimar R$</button>
        );
        const kpiDefs = {
          absenteismo: { titulo: 'Taxa de Absenteísmo', cor: 'rose', cor2: 'violet', valor: `${k.absenteismo_pct}%`, sub: 'sem atestado (falta+atraso)', valor2: `${k.absenteismo_com_atestado_pct}%`, sub2: 'com atestado', info: "Dois olhares: SEM atestado = só falta + atraso (o gerenciável). COM atestado = soma também a ausência justificada. Ambos ÷ jornada prevista." },
          gravidade: { titulo: 'Gravidade (h/func)', valor: hmLong(k.gravidade_min), sub: 'horas de ausência por funcionário', cor: 'amber', info: "Quão pesada é a ausência POR PESSOA: total de horas de ausência não planejada ÷ nº de funcionários." },
          nao_planejada: {
            titulo: 'Ausência Não Planejada', valor: hmLong(k.nao_planejada_min + k.atestado_min), cor: 'rose',
            chips: [{ label: 'Falta', valor: hmLong(k.falta_min), cor: 'rose' }, { label: 'Atraso', valor: hmLong(k.atraso_min), cor: 'amber' }, { label: 'Atestado', valor: hmLong(k.atestado_min), cor: 'violet' }],
            gear: true, onGear: abrirConfigHora, rodape: gearRodape(k.nao_planejada_min + k.atestado_min, 'Estimativa de perda', 'text-rose-700'),
            info: "Ausências não programadas: Falta + Atraso + Atestado médico. Clique na ⚙️ pra definir o valor da hora e ver a estimativa de perda em R$.",
          },
          planejadas: { titulo: 'Ausências Planejadas / Justificadas', valor: hmLong(totalPlan), cor: 'blue', chips: chipsPlan, info: "Ausências justificadas/programadas: Férias, Lic. Maternidade/Paternidade/Casamento, Óbito e Banco de Horas (compensado). NÃO entram no absenteísmo não planejado." },
          jornada: { titulo: 'Jornada de Trabalho', valor: hmLong(k.jornada_min), sub: `trabalhado ${hmLong(k.trabalhado_min)}`, cor: 'blue', info: "Total de horas que DEVERIAM ser trabalhadas (carga contratual). 'Trabalhado' = o que foi cumprido." },
          tea: { titulo: 'Emp. c/ Ausência (TEA)', valor: `${k.tea_pct}%`, sub: `${k.funcionarios_ausentes} de ${data.funcionarios}`, cor: 'violet', info: "Taxa de Empregados Ausentes: % dos funcionários que tiveram pelo menos uma ausência." },
          frequencia: { titulo: 'Frequência', valor: k.frequencia, sub: `${k.eventos} eventos ÷ ${data.funcionarios} func`, cor: 'gray', info: "Nº de eventos de ausência ÷ funcionários. Média de ocorrências por pessoa." },
          atestados: { titulo: 'Atestados', valor: hmLong(k.atestado_min), sub: 'ausência justificada (médica)', cor: 'violet', gear: true, onGear: abrirConfigHora, rodape: gearRodape(k.atestado_min, 'Custo estimado', 'text-violet-700'), info: "Horas de ausência justificada (atestado médico). Clique na ⚙️ pra ver o custo estimado em R$." },
          he: { titulo: 'Horas Extras', valor: hmLong(k.he_min), sub: 'no período', cor: 'emerald', info: "Total de horas extras trabalhadas no período, conforme a apuração RHiD." },
        };
        const soltarKpi = (dest) => {
          if (!kpiDrag || kpiDrag === dest) { setKpiDrag(null); setKpiOver(null); return; }
          const arr = [...kpiOrder];
          arr.splice(arr.indexOf(dest), 0, arr.splice(arr.indexOf(kpiDrag), 1)[0]);
          setKpiOrder(arr);
          try { localStorage.setItem('indPontoKpiOrder', JSON.stringify(arr)); } catch { /* ignore */ }
          setKpiDrag(null); setKpiOver(null);
        };
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {kpiOrder.filter(key => kpiDefs[key]).map(key => (
              <div key={key} draggable
                onDragStart={() => setKpiDrag(key)}
                onDragEnd={() => { setKpiDrag(null); setKpiOver(null); }}
                onDragOver={e => { e.preventDefault(); setKpiOver(key); }}
                onDrop={() => soltarKpi(key)}
                title="Arraste para reposicionar"
                className={`cursor-move transition h-full ${kpiDrag === key ? 'opacity-40' : ''} ${kpiOver === key && kpiDrag && kpiOver !== kpiDrag ? 'ring-2 ring-purple-400 rounded-lg' : ''}`}>
                <KpiCard {...kpiDefs[key]} />
              </div>
            ))}
          </div>
        );
      })()}

      {/* Ranking colaboradores — no topo, com foto + colunas mês a mês */}
      <Painel titulo="🏆 Ranking de Ausências por Colaborador" hint="clique nas colunas pra ordenar (A→Z / maior→menor) · padrão = Criticidade · colunas mês a mês = horas de ausência não planejada (falta+atraso); 🟥 mais forte = pior" className="mb-4">
        <div className="flex items-center gap-1 mb-2">
          {[
            { id: 'todos', label: 'Todos', cor: 'bg-gray-700' },
            { id: 'ativos', label: 'Ativos', cor: 'bg-emerald-600' },
            { id: 'inativos', label: 'Inativos', cor: 'bg-rose-600' },
          ].map(o => (
            <button key={o.id} onClick={() => setRankStatus(o.id)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition ${rankStatus === o.id ? `${o.cor} text-white shadow` : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {o.label} <span className={`ml-1 ${rankStatus === o.id ? 'opacity-90' : 'opacity-60'}`}>{rankCount[o.id]}</span>
            </button>
          ))}
        </div>
        <div className="overflow-auto max-h-[460px]">
          <table className="min-w-full text-sm border-separate" style={{ borderSpacing: 0 }}>
            <thead className="bg-gray-600 text-white sticky top-0 z-20">
              <tr>
                <th rowSpan={2} onClick={() => toggleRank('nome')} className="px-2 py-1 text-left align-bottom sticky left-0 bg-gray-600 z-30 whitespace-nowrap cursor-pointer select-none hover:bg-gray-700">#&nbsp;Colaborador{setaRank('nome')}</th>
                <th rowSpan={2} onClick={() => toggleRank('setor')} className="px-2 py-1 text-left align-bottom cursor-pointer select-none hover:bg-gray-700 whitespace-nowrap">Setor{setaRank('setor')}</th>
                <th rowSpan={2} onClick={() => toggleRank('ativo')} className="px-2 py-1 text-center align-bottom cursor-pointer select-none hover:bg-gray-700 whitespace-nowrap" title="Colaborador ativo (ON) ou inativo/desligado (OFF)">Ativo{setaRank('ativo')}</th>
                {mesesFechados.map(m => <th key={m.mes} colSpan={5} className="px-1 py-1 text-center text-[11px] font-bold border-l-2 border-gray-400">{m.label}</th>)}
                <th colSpan={6} className="px-2 py-1 text-center text-[11px] font-bold border-l-2 border-gray-400">TOTAL NO ANO</th>
              </tr>
              <tr className="text-[11px]">
                {mesesFechados.map(m => (
                  <Fragment key={m.mes}>
                    <th className="px-1.5 py-1 text-center font-semibold border-l-2 border-gray-400" title="Faltas (dias)">Falt</th>
                    <th className="px-1.5 py-1 text-center font-semibold" title="Atestados (dias)">Atst</th>
                    <th className="px-1.5 py-1 text-center font-semibold" title="Atrasos (horas)">Atr</th>
                    <th className="px-1.5 py-1 text-center font-semibold" title="Absenteísmo sem atestado">s/At</th>
                    <th className="px-1.5 py-1 text-center font-semibold" title="Absenteísmo com atestado">c/At</th>
                  </Fragment>
                ))}
                <th onClick={() => toggleRank('dias_falta')} className="px-1.5 py-1 text-center font-semibold cursor-pointer hover:bg-gray-700 border-l-2 border-gray-400 whitespace-nowrap" title="Faltas (dias) no ano">Falt{setaRank('dias_falta')}</th>
                <th onClick={() => toggleRank('dias_atestado')} className="px-1.5 py-1 text-center font-semibold cursor-pointer hover:bg-gray-700 whitespace-nowrap" title="Atestados (dias) no ano">Atst{setaRank('dias_atestado')}</th>
                <th onClick={() => toggleRank('atraso_min')} className="px-1.5 py-1 text-center font-semibold cursor-pointer hover:bg-gray-700 whitespace-nowrap" title="Atrasos (horas) no ano">Atr{setaRank('atraso_min')}</th>
                <th onClick={() => toggleRank('absenteismo_pct')} className="px-1.5 py-1 text-center font-semibold cursor-pointer hover:bg-gray-700 whitespace-nowrap" title="Absenteísmo sem atestado">s/At{setaRank('absenteismo_pct')}</th>
                <th onClick={() => toggleRank('absenteismo_com_atestado_pct')} className="px-1.5 py-1 text-center font-semibold cursor-pointer hover:bg-gray-700 whitespace-nowrap" title="Absenteísmo com atestado">c/At{setaRank('absenteismo_com_atestado_pct')}</th>
                <th onClick={() => toggleRank('bradford')} className="px-1.5 py-1 text-center font-semibold cursor-pointer hover:bg-gray-700 whitespace-nowrap" title="Criticidade (Fator Bradford)">Crit{setaRank('bradford')}</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((c, i) => {
                const rowBg = i < 3 ? 'bg-rose-50' : i % 2 ? 'bg-gray-50' : 'bg-white';
                const aberto = expandido === c.id;
                return (
                  <Fragment key={c.id}>
                  <tr className={`${rowBg} border-b border-gray-100`}>
                    <td className={`px-2 py-1 sticky left-0 z-10 ${rowBg}`}>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setExpandido(aberto ? null : c.id)} title="Ver detalhes e datas das ocorrências"
                          className="w-4 h-4 flex items-center justify-center rounded bg-gray-200 text-gray-600 text-xs font-bold hover:bg-indigo-200 leading-none flex-shrink-0">{aberto ? '−' : '+'}</button>
                        <span className="text-gray-400 font-bold text-xs w-4 text-right">{i + 1}</span>
                        <Avatar nome={c.nome} foto={c.foto_url} />
                        <span className="font-semibold text-gray-800 whitespace-nowrap">{c.nome}</span>
                      </div>
                    </td>
                    <td className="px-2 py-1 text-xs text-gray-500 whitespace-nowrap">{c.setor}</td>
                    <td className="px-2 py-1 text-center whitespace-nowrap">
                      {c.ativo
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">🟢 ON</span>
                        : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">🔴 OFF</span>}
                    </td>
                    {c.por_mes.filter(pm => pm.mes <= ateMes).map(pm => {
                      const tint = pm.abs_pct > 0 ? `rgba(239,68,68,${Math.min(0.08 + pm.abs_pct / 50, 0.5)})` : undefined;
                      const tintC = pm.abs_com_pct > 0 ? `rgba(139,92,246,${Math.min(0.08 + pm.abs_com_pct / 60, 0.45)})` : undefined;
                      return (
                        <Fragment key={pm.mes}>
                          <td className="px-1.5 py-1 text-center text-[12px] font-medium text-rose-600 border-l-2 border-gray-200">{pm.falta_dias || ''}</td>
                          <td className="px-1.5 py-1 text-center text-[12px] font-medium text-violet-600">{pm.atestado_dias || ''}</td>
                          <td className="px-1.5 py-1 text-center text-[12px] font-medium text-amber-600 whitespace-nowrap">{pm.atraso_min ? hmMin(pm.atraso_min) : ''}</td>
                          <td style={{ backgroundColor: tint }} className="px-1.5 py-1 text-center text-[12px] font-medium text-gray-700 whitespace-nowrap">{pm.abs_pct ? `${pm.abs_pct}%` : ''}</td>
                          <td style={{ backgroundColor: tintC }} className="px-1.5 py-1 text-center text-[12px] font-medium text-gray-700 whitespace-nowrap">{pm.abs_com_pct ? `${pm.abs_com_pct}%` : ''}</td>
                        </Fragment>
                      );
                    })}
                    <td className="px-2 py-1 text-right whitespace-nowrap border-l-2 border-gray-300">{c.dias_falta ? pill(`${c.dias_falta}d`, 'bg-rose-100 text-rose-700') : dashCell}</td>
                    <td className="px-2 py-1 text-right whitespace-nowrap">{c.dias_atestado ? pill(`${c.dias_atestado}d`, 'bg-violet-100 text-violet-700') : dashCell}</td>
                    <td className="px-2 py-1 text-right whitespace-nowrap">{c.atraso_min ? pill(hmMin(c.atraso_min), 'bg-amber-100 text-amber-700') : dashCell}</td>
                    <td className="px-2 py-1 text-right whitespace-nowrap">{pill(`${c.absenteismo_pct}%`, c.absenteismo_pct > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700')}</td>
                    <td className="px-2 py-1 text-right whitespace-nowrap">{pill(`${c.absenteismo_com_atestado_pct}%`, c.absenteismo_com_atestado_pct > 0 ? 'bg-violet-100 text-violet-700' : 'bg-emerald-100 text-emerald-700')}</td>
                    <td className="px-2 py-1 text-right whitespace-nowrap">{pill(c.bradford.toLocaleString('pt-BR'), 'bg-gray-100 text-gray-700')}</td>
                  </tr>
                  {aberto && (
                    <tr><td colSpan={colSpanTotal} className="p-0"><DetalheColab c={c} /></td></tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Painel>

      {/* Gráficos mês a mês — Não Planejadas (sempre) + Planejadas */}
      <div className="mb-4">
        <Painel titulo="📈 Ausências NÃO Planejadas — mês a mês + comparativo de ano" hint={`Falta · Atraso · Atestado · total no topo · acima: diferença vs ano anterior (🟢 caiu · 🔴 subiu) em pp/horas/R$ · ${dataPrev ? `esquerda = ${anoAtual - 1} (clara) · direita = ${anoAtual} (forte)` : 'sem dados do ano anterior'}`}>
          <div style={{ height: 320 }}><Bar data={chartNaoPlan} options={optMes} plugins={[ChartDataLabels, totalTopoPlugin, mkDiffPlugin(TIPOS_NAO_PLAN)]} /></div>
        </Painel>
      </div>
      <div className="mb-4">
        <Painel titulo="🗓️ Ausências Planejadas — mês a mês + comparativo de ano" hint={`Férias · Lic. Maternidade · total no topo · acima: diferença vs ano anterior (🟢 caiu · 🔴 subiu) em pp/horas/R$ · ${dataPrev ? `esquerda = ${anoAtual - 1} (clara) · direita = ${anoAtual} (forte)` : 'sem dados do ano anterior'}`}>
          <div style={{ height: 320 }}><Bar data={chartPlan} options={optMes} plugins={[ChartDataLabels, totalTopoPlugin, mkDiffPlugin(TIPOS_PLAN)]} /></div>
        </Painel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Painel titulo="🥧 Ausências NÃO Planejadas — por tipo" hint="Falta · Atraso · Atestado (horas no ano)">
          <div style={{ height: 200 }}>{tiposNaoPlan.length ? <Doughnut data={chartTipoNaoPlan} options={optTipo} /> : <p className="text-gray-400 text-sm text-center pt-16">Sem ausências não planejadas</p>}</div>
        </Painel>
        <Painel titulo="🥧 Ausências Planejadas — por tipo" hint="Férias · Maternidade · Paternidade · Casamento · Óbito · Banco (horas no ano)">
          <div style={{ height: 200 }}>{tiposPlan.length ? <Doughnut data={chartTipoPlan} options={optTipo} /> : <p className="text-gray-400 text-sm text-center pt-16">Sem ausências planejadas</p>}</div>
        </Painel>
      </div>

      <div className="mb-4">
        <Painel titulo="🏭 Absenteísmo por Setor" hint="quais setores mais faltam (ano)">
          <div style={{ height: Math.min(300, Math.max(140, setores.length * 20)) }}><Bar data={chartSetor} options={optBarH} /></div>
        </Painel>
      </div>

      <div className="mb-4">
        <Painel titulo="🏭 Evolução por Setor (mês a mês) — top 6" hint="comparativo mensal do absenteísmo por setor">
          <div style={{ height: 190 }}><Line data={chartSetorMes} options={optLine} /></div>
        </Painel>
      </div>

      <div className="text-[11px] text-gray-400 mt-3">
        ✅ Dados oficiais da RHiD. <strong>Absenteísmo s/ atestado</strong> = falta + atraso ÷ jornada (o gerenciável). <strong>Absenteísmo c/ atestado</strong> = soma também a ausência justificada (médica) — igual ao relatório "Absenteísmo" da RHiD. <strong>Gravidade</strong> = horas de ausência por funcionário. <strong>Criticidade</strong> (Fator Bradford) = episódios² × dias — penaliza quem falta de forma curta e frequente.
      </div>
    </>
  );
}

// ============================================================================
// Aba RECRUTAMENTO — dashboard real plugado em rh_vagas + curriculos
// Fonte: RH > Vagas. Funil, desfechos do processo, motivos, tempo pra finalizar.
// ============================================================================
function KpiRec({ label, valor, unidade, cor, sub }) {
  const cores = {
    amber: 'border-amber-400 text-amber-600', emerald: 'border-emerald-400 text-emerald-600',
    blue: 'border-blue-400 text-blue-600', rose: 'border-rose-400 text-rose-600',
  };
  return (
    <div className={`bg-white rounded-lg border-l-4 shadow-sm p-4 ${cores[cor] || cores.blue}`}>
      <p className="text-xs uppercase font-bold text-gray-500">{label}</p>
      <p className="mt-1"><span className="text-3xl font-bold">{valor}</span>{unidade && <span className="text-lg font-semibold ml-1">{unidade}</span>}</p>
      {sub && <p className="text-[13px] text-gray-500 mt-1 leading-snug">{sub}</p>}
    </div>
  );
}

// Paleta padrão (mesma dos rankings de Desligamentos): barra -400 + pill -100/-700
const REC_COR = {
  emerald: { bar: 'bg-emerald-400', pill: 'bg-emerald-100 text-emerald-700' },
  amber: { bar: 'bg-amber-400', pill: 'bg-amber-100 text-amber-700' },
  slate: { bar: 'bg-slate-400', pill: 'bg-slate-100 text-slate-600' },
  rose: { bar: 'bg-rose-400', pill: 'bg-rose-100 text-rose-700' },
  orange: { bar: 'bg-orange-400', pill: 'bg-orange-100 text-orange-700' },
  indigo: { bar: 'bg-indigo-400', pill: 'bg-indigo-100 text-indigo-700' },
  blue: { bar: 'bg-blue-400', pill: 'bg-blue-100 text-blue-700' },
};

// Lista ranqueada no MESMO padrão do RankBloco (Desligamentos): #N + pill + barra
function RankRec({ itens, vazio = 'Sem dados' }) {
  if (!itens || itens.length === 0) return <p className="text-gray-400 text-xs py-4 text-center">{vazio}</p>;
  const max = Math.max(1, ...itens.map(i => i.qtd));
  return (
    <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
      {itens.map((it, i) => {
        const c = REC_COR[it.corKey] || REC_COR.indigo;
        return (
          <div key={i}>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-5 text-right font-bold text-gray-400">#{i + 1}</span>
              <span className="flex-1 truncate font-medium text-gray-700" title={it.label}>{it.label}{it.badge && <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${it.badgeCls || 'bg-gray-100 text-gray-600'}`}>{it.badge}</span>}</span>
              <span className={`px-2 py-0.5 rounded-full font-bold ${c.pill}`}>{it.qtd}</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded overflow-hidden mt-0.5"><div className={`h-full ${c.bar}`} style={{ width: `${Math.round(it.qtd / max * 100)}%` }}></div></div>
          </div>
        );
      })}
    </div>
  );
}

function AbaRecrutamento({ ano }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    let vivo = true;
    setLoading(true); setErro(null);
    api.get(`/rh/vagas/indicadores?ano=${ano}`)
      .then(r => { if (vivo) { setData(r.data); setLoading(false); } })
      .catch(e => { if (vivo) { setErro(e?.response?.data?.error || 'Erro ao carregar recrutamento'); setLoading(false); } });
    return () => { vivo = false; };
  }, [ano]);

  if (loading) return <div className="py-16 text-center text-gray-400">Carregando recrutamento…</div>;
  if (erro) return <div className="py-16 text-center text-rose-500">⚠️ {erro}</div>;
  if (!data) return null;

  const k = data.kpis || {};
  const funil = data.funil || {};
  const fmtData = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

  // Funil
  const stages = [
    { label: 'Interessados', v: funil.interessados || 0, cor: 'bg-blue-500' },
    { label: 'Selecionados', v: funil.selecionados || 0, cor: 'bg-indigo-500' },
    { label: 'Entrevistados', v: funil.entrevistados || 0, cor: 'bg-purple-500' },
    { label: 'Contratados', v: funil.contratados || 0, cor: 'bg-emerald-500' },
  ];
  const maxF = Math.max(1, ...stages.map(s => s.v));

  // Processos por mês (Bar)
  const chartMes = {
    labels: MES_ABREV,
    datasets: [
      { label: 'Iniciados', data: (data.por_mes || []).map(m => m.iniciados), backgroundColor: '#10b981', borderRadius: 4, maxBarThickness: 22 },
      { label: 'Encerrados', data: (data.por_mes || []).map(m => m.encerrados), backgroundColor: '#94a3b8', borderRadius: 4, maxBarThickness: 22 },
    ],
  };
  const optsMes = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }, datalabels: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
  };

  // Desfechos do processo (cor por semântica, na paleta padrão)
  const DESF_KEY = { passou: 'emerald', aguarda_decisao: 'amber', nao_compareceu: 'slate', reprovado: 'rose', desistiu: 'orange' };
  const desfItens = (data.desfechos || []).map(d => ({ label: d.label, qtd: d.qtd, corKey: DESF_KEY[d.resultado] || 'indigo' }));

  // Motivos (desistência / reprovação / não compareceu)
  const TIPO_BADGE = { reprovado: 'bg-rose-100 text-rose-700', desistiu: 'bg-orange-100 text-orange-700', nao_compareceu: 'bg-slate-100 text-slate-600' };
  const motItens = (data.motivos || []).map(m => ({ label: m.motivo, qtd: m.qtd, badge: m.tipo_label, badgeCls: TIPO_BADGE[m.tipo], corKey: DESF_KEY[m.tipo] || 'rose' }));
  const motNP = (data.motivos_nao_preenchimento || []).map(m => ({ label: m.motivo, qtd: m.qtd, corKey: 'rose' }));

  return (
    <>
      <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
        <span>💼 <b className="text-gray-700">{k.total_vagas || 0}</b> vagas no total · <b className="text-amber-600">{k.vagas_em_aberto || 0}</b> em aberto · ano {ano} · fonte: RH &gt; Vagas</span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiRec label="Vagas em Aberto" valor={k.vagas_em_aberto || 0} cor="amber" sub={`${k.media_dias_abertas != null ? k.media_dias_abertas + ' dias em média abertas' : 'nenhuma aberta'}`} />
        <KpiRec label="Vagas Preenchidas (ano)" valor={k.vagas_preenchidas_ano || 0} cor="emerald" sub="contratadas no ano-base" />
        <KpiRec label="Tempo Médio de Contratação" valor={k.tempo_medio_dias != null ? k.tempo_medio_dias : '—'} unidade={k.tempo_medio_dias != null ? 'dias' : ''} cor="blue" sub="da abertura até preencher" />
        <KpiRec label="Taxa de Recusa" valor={k.taxa_recusa_pct || 0} unidade="%" cor="rose" sub="reprovados + desistências + faltas ÷ avaliados" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Processos Iniciados vs Encerrados */}
        <Painel titulo="📊 Processos Iniciados vs Encerrados" hint="vagas abertas (por data de abertura) × encerradas (por data de fechamento), mês a mês">
          <div style={{ height: 260 }}><Bar data={chartMes} options={optsMes} /></div>
        </Painel>

        {/* Funil */}
        <Painel titulo="🫧 Funil: Candidatos → Entrevistas → Contratados" hint="soma de todas as vagas do período">
          <div className="space-y-3 mt-1">
            {stages.map((s, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm mb-0.5"><span className="font-medium text-gray-700">{s.label}</span><span className="font-bold text-gray-800">{s.v}</span></div>
                <div className="h-6 bg-gray-100 rounded-lg overflow-hidden"><div className={`h-full ${s.cor} rounded-lg flex items-center justify-end pr-2 text-white text-xs font-bold transition-all`} style={{ width: `${Math.max(4, Math.round(s.v / maxF * 100))}%` }}>{s.v > 0 && s.v}</div></div>
                {i < stages.length - 1 && stages[i].v > 0 && <div className="text-[10px] text-gray-400 text-center">↓ {Math.round((stages[i + 1].v / stages[i].v) * 100)}% avançam</div>}
              </div>
            ))}
          </div>
        </Painel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Desfechos do processo */}
        <Painel titulo="🎯 Desfechos do Processo Seletivo" hint="resultado da entrevista dos candidatos selecionados">
          <RankRec itens={desfItens} vazio="Nenhum resultado de entrevista lançado ainda" />
        </Painel>

        {/* Motivos de desistência/reprovação */}
        <Painel titulo="💬 Motivos (Desistência / Reprovação / Não Compareceu)" hint="ranking dos motivos informados nos desfechos negativos">
          <RankRec itens={motItens} vazio="Nenhum motivo registrado ainda" />
        </Painel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Motivos de não preenchimento */}
        <Painel titulo="🚫 Motivos de Não Preenchimento" hint="vagas fechadas sem contratação (motivo do fechamento)">
          <RankRec itens={motNP} vazio="Nenhuma vaga fechada sem preencher" />
        </Painel>

        {/* Resumo tempo */}
        <Painel titulo="⏱️ Tempo pra Finalizar (dias)" hint="quanto cada vaga levou/está levando da abertura até fechar">
          <div className="flex gap-4 mb-2">
            <div className="flex-1 bg-amber-50 rounded-lg p-3 text-center"><p className="text-[11px] uppercase font-bold text-amber-600">Abertas (em média)</p><p className="text-2xl font-bold text-amber-700">{k.media_dias_abertas != null ? k.media_dias_abertas : '—'}<span className="text-sm ml-1">dias</span></p></div>
            <div className="flex-1 bg-emerald-50 rounded-lg p-3 text-center"><p className="text-[11px] uppercase font-bold text-emerald-600">Preenchidas (em média)</p><p className="text-2xl font-bold text-emerald-700">{k.tempo_medio_dias != null ? k.tempo_medio_dias : '—'}<span className="text-sm ml-1">dias</span></p></div>
          </div>
          <RankRec itens={(data.tempo_vagas || []).slice(0, 8).map(t => ({ label: `${t.titulo}${t.aberta ? '' : ' ✓'}`, qtd: t.dias || 0, corKey: t.aberta ? 'amber' : 'emerald' }))} vazio="Sem vagas" />
        </Painel>
      </div>

      {/* Vagas em aberto detalhadas */}
      <Painel titulo="📋 Vagas em Aberto Detalhadas" hint="cada vaga aberta, há quantos dias, e o andamento dos candidatos">
        <div className="overflow-x-auto slim-scroll">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase text-gray-500 border-b">
                <th className="px-2 py-1.5">Vaga / Cargo</th>
                <th className="px-2 py-1.5">Loja</th>
                <th className="px-2 py-1.5">Status</th>
                <th className="px-2 py-1.5">Aberta em</th>
                <th className="px-2 py-1.5 text-center">Dias em aberto</th>
                <th className="px-2 py-1.5 text-center">Interessados</th>
                <th className="px-2 py-1.5 text-center">Selecionados</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(data.vagas_abertas || []).length === 0 ? (
                <tr><td colSpan={7} className="text-center text-gray-400 py-6">Nenhuma vaga em aberto</td></tr>
              ) : (data.vagas_abertas || []).map((v) => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-2 py-1.5"><span className="font-medium text-gray-700">{v.titulo}</span>{v.cargo && v.cargo !== v.titulo && <span className="text-gray-400 text-xs block">{v.cargo}</span>}</td>
                  <td className="px-2 py-1.5 text-gray-600">{v.loja}</td>
                  <td className="px-2 py-1.5"><span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{v.status}</span></td>
                  <td className="px-2 py-1.5 text-gray-600">{fmtData(v.data_abertura)}</td>
                  <td className="px-2 py-1.5 text-center"><span className={`font-bold ${v.dias > 30 ? 'text-rose-600' : v.dias > 15 ? 'text-amber-600' : 'text-gray-700'}`}>{v.dias != null ? v.dias : '—'}</span></td>
                  <td className="px-2 py-1.5 text-center text-gray-700">{v.interessados}</td>
                  <td className="px-2 py-1.5 text-center text-gray-700">{v.selecionados}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Painel>

      <div className="text-xs text-gray-400 mt-4 text-center">Ano-base: {ano} · Dados reais de RH &gt; Vagas</div>
    </>
  );
}

// ============================================================================
// Aba PESQUISA DE CLIMA — dashboard real (pesquisa_modelos/rodadas/respostas + NR-1)
// ============================================================================
function AbaPesquisaClima({ ano }) {
  const [data, setData] = useState(null);
  const [modeloId, setModeloId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    let vivo = true;
    setLoading(true); setErro(null);
    const q = modeloId ? `?modelo_id=${modeloId}` : '';
    api.get(`/pesquisa-clima/indicadores${q}`)
      .then(r => { if (vivo) { setData(r.data); setLoading(false); } })
      .catch(e => { if (vivo) { setErro(e?.response?.data?.error || 'Erro ao carregar pesquisa de clima'); setLoading(false); } });
    return () => { vivo = false; };
  }, [modeloId]);

  if (loading && !data) return <div className="py-16 text-center text-gray-400">Carregando pesquisa de clima…</div>;
  if (erro) return <div className="py-16 text-center text-rose-500">⚠️ {erro}</div>;
  if (!data) return null;

  const k = data.kpis || {};
  const temNps = data.tem_nps;
  const modelosComResp = (data.modelos || []).filter(m => m.total_respostas > 0 && m.tipo !== 'nr1');
  const semDados = !data.modelo || (data.rodada_atual == null);
  const trunc = (s, n = 42) => (s && s.length > n ? s.slice(0, n) + '…' : s);
  const selValue = modeloId ?? data.modelo_id ?? '';

  // Distribuição (doughnut)
  const dist = data.distribuicao;
  const chartDist = dist && {
    labels: ['Promotores (9-10)', 'Passivos (7-8)', 'Detratores (0-6)'],
    datasets: [{ data: [dist.promotores, dist.passivos, dist.detratores], backgroundColor: ['#10b981', '#94a3b8', '#ef4444'], borderWidth: 0 }],
  };
  const optsDist = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }, datalabels: { color: '#fff', font: { weight: 'bold', size: 13 }, formatter: (v) => v || '' } } };

  // Evolução (line)
  const evo = data.evolucao || [];
  const chartEvo = {
    labels: evo.map(e => e.rodada),
    datasets: [{ label: temNps ? 'eNPS' : 'Satisfação média', data: evo.map(e => temNps ? e.enps : e.satisf), borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,.15)', fill: true, tension: 0.3, pointRadius: 4, pointBackgroundColor: '#8b5cf6' }],
  };
  const optsEvo = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { align: 'top', color: '#6d28d9', font: { weight: 'bold', size: 11 }, formatter: (v) => v == null ? '' : v } }, scales: { y: temNps ? { min: -100, max: 100 } : { min: 0, max: 5 } } };

  // Médias por pergunta (bar horizontal)
  const med = data.medias_perguntas || [];
  const maxEscala = med[0]?.max || 5;
  const chartMed = {
    labels: med.map(m => trunc(m.enunciado, 50)),
    datasets: [{ data: med.map(m => m.media), backgroundColor: med.map(m => m.media >= maxEscala * 0.8 ? '#10b981' : m.media >= maxEscala * 0.6 ? '#f59e0b' : '#ef4444'), borderRadius: 4, maxBarThickness: 20 }],
  };
  const optsMed = { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { anchor: 'end', align: 'end', color: '#374151', font: { weight: 'bold', size: 11 }, formatter: (v) => v == null ? '' : v.toFixed(1) } }, scales: { x: { min: 0, max: maxEscala } } };

  return (
    <>
      {/* Cabeçalho + seletor de pesquisa */}
      <div className="bg-white rounded-lg border p-4 mb-4 flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xl shrink-0">😊</div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">Pesquisa de Clima</h2>
            <p className="text-sm text-gray-500">{data.modelo ? data.modelo.nome : 'Nenhuma pesquisa com respostas'}{data.rodada_atual ? ` · ${data.rodada_atual.nome} · ${data.rodada_atual.total_respostas} respostas` : ''}</p>
          </div>
        </div>
        {modelosComResp.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold uppercase text-gray-500">Pesquisa:</label>
            <select value={selValue} onChange={e => setModeloId(Number(e.target.value))}
              className="border rounded-lg px-3 py-2 text-sm font-semibold bg-white">
              {modelosComResp.map(m => <option key={m.id} value={m.id}>{m.nome} ({m.total_respostas})</option>)}
            </select>
          </div>
        )}
      </div>

      {semDados ? (
        <div className="bg-white rounded-lg border p-10 text-center text-gray-400">Nenhuma pesquisa respondida ainda nesta seleção.</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {temNps
              ? <KpiRec label="eNPS Atual" valor={k.enps != null ? (k.enps > 0 ? '+' + k.enps : k.enps) : '—'} cor="emerald" sub="promotores − detratores (−100 a +100)" />
              : <KpiRec label="Satisfação Média" valor={k.satisfacao_media != null ? k.satisfacao_media : '—'} unidade="/5" cor="emerald" sub="média das notas de satisfação" />}
            <KpiRec label="Total de Respostas" valor={k.total_respostas || 0} cor="blue" sub="na rodada atual" />
            <KpiRec label="Taxa de Participação" valor={k.participacao_pct != null ? k.participacao_pct : '—'} unidade={k.participacao_pct != null ? '%' : ''} cor="amber" sub={`${k.total_respostas || 0} de ${k.total_colaboradores || 0} colaboradores ativos`} />
            <KpiRec label="Variação vs Rodada Anterior" valor={k.variacao != null ? (k.variacao > 0 ? '+' + k.variacao : k.variacao) : '—'} unidade={k.variacao != null ? 'pts' : ''} cor={k.variacao != null && k.variacao < 0 ? 'rose' : 'emerald'} sub={data.rodada_anterior ? `vs ${data.rodada_anterior.nome}` : 'sem rodada anterior'} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {chartDist && (
              <Painel titulo="🥧 Distribuição Promotores / Passivos / Detratores" hint="com base na pergunta de recomendação (0-10)">
                <div style={{ height: 260 }}><Doughnut data={chartDist} options={optsDist} /></div>
              </Painel>
            )}
            <Painel titulo={`📈 Evolução ${temNps ? 'do eNPS' : 'da Satisfação'} (rodadas)`} hint="rodada a rodada da pesquisa selecionada">
              {evo.length > 1 ? <div style={{ height: 260 }}><Line data={chartEvo} options={optsEvo} /></div>
                : <p className="text-sm text-gray-400 py-16 text-center">Só há uma rodada — a evolução aparece a partir da 2ª.</p>}
            </Painel>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <Painel titulo="📊 Médias por Pergunta" hint="ordenado do pior pro melhor (verde ≥80% · âmbar ≥60% · vermelho abaixo)">
              {med.length ? <div style={{ height: Math.max(200, med.length * 34) }}><Bar data={chartMed} options={optsMed} /></div>
                : <p className="text-sm text-gray-400 py-10 text-center">Sem perguntas de nota nesta pesquisa.</p>}
            </Painel>

            <Painel titulo="💬 Comentários Abertos" hint="respostas de texto livre">
              {(data.comentarios || []).length ? (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {data.comentarios.map((c, i) => (
                    <div key={i} className="border-l-2 border-amber-300 bg-amber-50/50 rounded-r p-2">
                      <p className="text-sm text-gray-700">“{c.texto}”</p>
                      {c.enunciado && <p className="text-[10px] text-gray-400 mt-0.5">{c.secao ? c.secao + ' · ' : ''}{c.enunciado}</p>}
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-gray-400 py-10 text-center">Nenhum comentário aberto nesta rodada.</p>}
            </Painel>
          </div>
        </>
      )}

      {/* NR-1 — Riscos Psicossociais */}
      {data.nr1 && (
        <Painel titulo="🧠 NR-1 — Riscos Psicossociais" hint="obrigação legal (GRO): avaliação de fatores de risco psicossocial" className="mb-4">
          {data.nr1.sem_respostas ? (
            <div className="bg-indigo-50/60 border border-indigo-100 rounded-lg p-4 flex items-start gap-3">
              <span className="text-2xl">📋</span>
              <div className="text-sm text-gray-600">
                <p className="font-semibold text-gray-700">Ainda não há respostas na Avaliação de Riscos Psicossociais.</p>
                <p className="mt-1">Assim que a pesquisa <b>{data.nr1.nome}</b> for respondida ({data.nr1.qtd_rodadas} rodada(s) já criada(s)), o <b>farol de risco por dimensão</b> (verde / amarelo / vermelho) e as <b>ocorrências</b> aparecem aqui automaticamente.</p>
                <p className="mt-1 text-gray-500">Planos de ação NR-1 cadastrados: <b>{data.nr1.planos_acao}</b></p>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-600">
              <p><b>{data.nr1.total_respostas}</b> respostas · <b>{data.nr1.planos_acao}</b> planos de ação. Abra a tela <b>Análise NR-1</b> pro farol completo por dimensão.</p>
            </div>
          )}
        </Painel>
      )}

      <div className="text-xs text-gray-400 mt-2 text-center">Fonte: RH &gt; Pesquisa de Clima {data.rodada_atual ? `· ${data.rodada_atual.total_respostas} respostas na rodada atual` : ''}</div>
    </>
  );
}

// Mostra a estrutura planejada (KPIs e graficos) com placeholders.
function Esqueleto({ aba, ano }) {
  const blocos = {
    colaboradores: {
      kpis: [
        { titulo: 'Quadro Inicial do Mês', cor: 'blue' },
        { titulo: 'Quadro Final do Mês', cor: 'emerald' },
        { titulo: 'Variação Mensal', cor: 'amber' },
        { titulo: 'Recém Contratados (6m)', cor: 'pink' },
      ],
      visuais: [
        { titulo: 'Distribuição por Escolaridade (mensal)', tipo: 'grafico' },
        { titulo: 'Distribuição por Faixa Etária', tipo: 'grafico' },
        { titulo: 'Tempo de Empresa', tipo: 'grafico' },
        { titulo: 'Por Setor', tipo: 'pizza' },
        { titulo: 'Por Tipo de Cargo (Operacional/Estratégico)', tipo: 'pizza' },
        { titulo: 'Top Cargos', tipo: 'lista' },
      ],
    },
    'ponto-ausencias': {
      kpis: [
        { titulo: 'Taxa de Absenteísmo', cor: 'rose' },
        { titulo: 'Gravidade (h/funcionário)', cor: 'amber' },
        { titulo: 'Total Horas Ausência Não Planejada', cor: 'rose' },
        { titulo: 'Total Horas Jornada de Trabalho', cor: 'blue' },
      ],
      visuais: [
        { titulo: 'Ausência Planejada vs Não Planejada (mensal)', tipo: 'grafico' },
        { titulo: 'Por Tipo (Atestado, Falta, Atraso, Maternidade, INSS)', tipo: 'pizza' },
        { titulo: 'Top 100 Colaboradores com Mais Ausências', tipo: 'tabela' },
        { titulo: 'Evolução do Absenteísmo', tipo: 'linha' },
        { titulo: 'Evolução da Gravidade', tipo: 'linha' },
      ],
    },
    recrutamento: {
      kpis: [
        { titulo: 'Vagas em Aberto', cor: 'amber' },
        { titulo: 'Vagas Preenchidas (ano)', cor: 'emerald' },
        { titulo: 'Tempo Médio de Contratação', cor: 'blue' },
        { titulo: 'Taxa de Recusa', cor: 'rose' },
      ],
      visuais: [
        { titulo: 'Processos Iniciados vs Encerrados', tipo: 'grafico' },
        { titulo: 'Dentro do Prazo vs Fora do Prazo', tipo: 'pizza' },
        { titulo: 'Motivos de Não Preenchimento', tipo: 'lista' },
        { titulo: 'Funil: Candidatos → Entrevistas → Contratados', tipo: 'grafico' },
        { titulo: 'Vagas em Aberto Detalhadas', tipo: 'tabela' },
      ],
    },
    'pesquisa-clima': {
      kpis: [
        { titulo: 'eNPS Atual', cor: 'emerald' },
        { titulo: 'Total de Respostas', cor: 'blue' },
        { titulo: 'Taxa de Participação', cor: 'amber' },
        { titulo: 'Variação vs Rodada Anterior', cor: 'pink' },
      ],
      visuais: [
        { titulo: 'Distribuição Promotores / Passivos / Detratores', tipo: 'pizza' },
        { titulo: 'Evolução do eNPS (rodadas)', tipo: 'linha' },
        { titulo: 'Médias por Pergunta', tipo: 'grafico' },
        { titulo: 'Comentários Abertos', tipo: 'lista' },
      ],
    },
    treinamentos: {
      kpis: [
        { titulo: 'Horas Totais no Ano', cor: 'purple' },
        { titulo: 'Custo Total no Ano', cor: 'emerald' },
        { titulo: 'Treinamentos Realizados', cor: 'blue' },
        { titulo: 'Certificações Vencendo (30d)', cor: 'rose' },
      ],
      visuais: [
        { titulo: 'NRs Obrigatórias - Conformidade', tipo: 'pizza' },
        { titulo: 'Top Treinamentos por Frequência', tipo: 'grafico' },
        { titulo: 'Evolução Mensal de Horas', tipo: 'linha' },
        { titulo: 'Por Setor', tipo: 'pizza' },
        { titulo: 'Certificações Vencidas / Vencendo', tipo: 'tabela' },
      ],
    },
    financeiro: {
      kpis: [
        { titulo: 'Folha do Mês', cor: 'emerald' },
        { titulo: 'Folha Acumulada (Ano)', cor: 'blue' },
        { titulo: 'Custo Médio por Colaborador', cor: 'pink' },
        { titulo: 'Total de Encargos (Ano)', cor: 'amber' },
      ],
      visuais: [
        { titulo: 'Evolução Mensal da Folha', tipo: 'linha' },
        { titulo: 'Custo por Setor', tipo: 'pizza' },
        { titulo: 'Composição: Salário vs Encargos vs Benefícios', tipo: 'pizza' },
        { titulo: 'Encargos Detalhados (FGTS, INSS, Férias, 13º)', tipo: 'grafico' },
        { titulo: 'Provisões Mensais (PLR, Férias, etc)', tipo: 'grafico' },
      ],
    },
    escala: {
      kpis: [
        { titulo: 'Cobertura da Escala (%)', cor: 'emerald' },
        { titulo: 'Horas Extras no Mês', cor: 'amber' },
        { titulo: 'Banco de Horas (saldo médio)', cor: 'blue' },
        { titulo: 'Folgas Pendentes', cor: 'rose' },
      ],
      visuais: [
        { titulo: 'Distribuição de Turnos', tipo: 'pizza' },
        { titulo: 'Horas Extras por Setor', tipo: 'grafico' },
        { titulo: 'Férias Programadas (próximos 90 dias)', tipo: 'tabela' },
        { titulo: 'Licenças em Curso', tipo: 'tabela' },
        { titulo: 'Evolução Mensal de Horas Extras', tipo: 'linha' },
      ],
    },
    dp: {
      kpis: [
        { titulo: 'Documentos Vencidos', cor: 'rose' },
        { titulo: 'Vencendo em 30 dias', cor: 'amber' },
        { titulo: 'Total de Documentos', cor: 'blue' },
        { titulo: 'Taxa de Conformidade', cor: 'emerald' },
      ],
      visuais: [
        { titulo: 'ASOs - Emissão e Vencimento Mensal', tipo: 'grafico' },
        { titulo: 'Pastas com mais Documentos', tipo: 'lista' },
        { titulo: 'Conformidade por Empresa/Loja', tipo: 'pizza' },
        { titulo: 'Documentos Vencidos Detalhados', tipo: 'tabela' },
      ],
    },
  };

  const data = blocos[aba] || { kpis: [], visuais: [] };

  return (
    <>
      {data.kpis.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {data.kpis.map((c, i) => (
            <div key={i} className="bg-white rounded-lg border-l-4 border-gray-300 shadow-sm p-4 opacity-70">
              <p className="text-xs uppercase font-semibold text-gray-500">{c.titulo}</p>
              <p className="text-2xl font-bold text-gray-300 mt-1">—</p>
              <p className="text-[10px] text-gray-400 mt-1">a conectar</p>
            </div>
          ))}
        </div>
      )}
      {data.visuais.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data.visuais.map((c, i) => (
            <div key={i} className="bg-white rounded-lg border shadow-sm p-5 min-h-[180px]">
              <h3 className="font-bold text-gray-700 mb-1">{c.titulo}</h3>
              <p className="text-xs text-gray-400 mb-3">
                {c.tipo === 'grafico' && '📊 Gráfico de barras'}
                {c.tipo === 'linha' && '📈 Gráfico de linha'}
                {c.tipo === 'pizza' && '🥧 Gráfico de pizza'}
                {c.tipo === 'lista' && '📋 Lista ranqueada'}
                {c.tipo === 'tabela' && '📑 Tabela detalhada'}
              </p>
              <div className="bg-gray-50 rounded p-6 text-center text-gray-400 text-sm border-2 border-dashed border-gray-200">
                🚧 A conectar com a tela origem
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="text-xs text-gray-400 mt-4 text-center">Ano-base: {ano} · Estrutura placeholder, dados reais serão plugados quando as telas origem estiverem completas</div>
    </>
  );
}
