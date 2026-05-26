import { useState, useEffect, Fragment } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import RadarLoading from '../components/RadarLoading';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

          {/* Outras abas — esqueleto que vai ser conectado conforme cada tela origem fica pronta */}
          {aba !== 'colaboradores' && <Esqueleto aba={aba} ano={ano} />}
        </div>
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

      {/* Tabelas mensais (formato planilha): admissoes e desligamentos por cargo / mes */}
      <div className="space-y-4 mb-4">
        <TabelaMovimentacao
          titulo="✅ ADMISSÕES POR MÊS"
          colaboradores={colaboradores}
          ano={ano}
          campo="data_admissao"
          cor="emerald"
        />
        <TabelaMovimentacao
          titulo="❌ DESLIGAMENTOS POR MÊS"
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
  const setores = {};
  ativos.forEach(c => {
    const k = c.setor_departamento_nome || c.setor_nome || 'Sem setor';
    setores[k] = (setores[k] || 0) + 1;
  });

  // Faixa etaria
  const faixas = { '16-20': 0, '21-25': 0, '26-30': 0, '31-35': 0, '36-40': 0, '41-50': 0, '51-60': 0, '61+': 0 };
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
    faixas[f]++;
  });

  // Tempo de empresa
  const tempos = { '< 6 meses': 0, '6-12 meses': 0, '1-2 anos': 0, '2-3 anos': 0, '3-5 anos': 0, '5-10 anos': 0, '10+ anos': 0 };
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
    tempos[t]++;
  });

  // Tipo de cargo
  const PALAVRAS_ESTRATEGICO = /(GERENTE|DIRETOR|COORDENADOR|GESTOR|SUPERVISOR|LIDER|LÍDER|CHEFE|CEO|CFO|CTO|HEAD|ENCARREGADO)/i;
  const tipoCargo = { Operacional: 0, Estratégico: 0 };
  ativos.forEach(c => {
    if (PALAVRAS_ESTRATEGICO.test(c.cargo_nome || '')) tipoCargo['Estratégico']++;
    else tipoCargo['Operacional']++;
  });

  // Cargos (todos, ordenados do maior pro menor)
  const cargos = {};
  ativos.forEach(c => {
    const k = c.cargo_nome || 'Sem cargo';
    cargos[k] = (cargos[k] || 0) + 1;
  });
  const topCargos = Object.entries(cargos).sort((a, b) => b[1] - a[1]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Pizza titulo="Distribuição por Gênero" dados={genero} cores={['#3b82f6', '#ec4899', '#9ca3af']} />
      <Pizza titulo="Operacional vs Estratégico" dados={tipoCargo} cores={['#f59e0b', '#a855f7']} />
      <BlocoBarras titulo="Tempo de Empresa" dados={tempos} cor="bg-emerald-500"
        ordem={['10+ anos', '5-10 anos', '3-5 anos', '2-3 anos', '1-2 anos', '6-12 meses', '< 6 meses']} />
      <BlocoBarras titulo="Faixa Etária" dados={faixas} cor="bg-purple-500"
        ordem={['16-20', '21-25', '26-30', '31-35', '36-40', '41-50', '51-60', '61+']} />
      <BlocoBarras titulo="Distribuição por Setor" dados={setores} cor="bg-amber-500" />
      <div className="bg-white rounded-lg border shadow-sm p-5 flex flex-col">
        <h3 className="font-bold text-gray-800 text-base mb-3">🏆 Cargos ({topCargos.length})</h3>
        {topCargos.length === 0 ? (
          <div className="text-center text-gray-400 py-8 text-sm">Sem dados</div>
        ) : (
          <div className="space-y-2 overflow-y-auto pr-1 flex-1 min-h-0">
            {topCargos.map(([cargo, qtd], i) => (
              <div key={cargo} className="flex items-center gap-3 text-sm">
                <span className="w-8 text-right font-bold text-gray-400 text-base">#{i + 1}</span>
                <span className="flex-1 truncate font-semibold text-gray-700">{cargo}</span>
                <span className="bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-sm font-bold">{qtd}</span>
              </div>
            ))}
          </div>
        )}
      </div>
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

  const hoje = new Date();
  const mesLimite = (hoje.getFullYear() === ano) ? hoje.getMonth() + 1 : 12;

  // Agrupa: pra cada cargo, conta movimentacao por mes do ano-base
  const porCargoMes = {}; // { cargo: [12 meses] }
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
    totaisMes[mes]++;
    totalGeral++;
  });

  const cargos = Object.entries(porCargoMes)
    .map(([nome, meses]) => ({ nome, meses, total: meses.reduce((s, x) => s + x, 0) }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
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
            ) : cargos.map(c => (
              <tr key={c.nome} className="hover:bg-gray-50">
                <td className="px-3 py-1.5 text-sm font-medium text-gray-700" colSpan={2}>{c.nome}</td>
                {c.meses.map((q, i) => (
                  <td key={i} className="px-2 py-1.5 text-center text-sm">
                    {i + 1 > mesLimite ? <span className="text-gray-300">—</span> :
                     q === 0 ? <span className="text-gray-300">—</span> :
                     <span className={`font-bold ${cs.cell}`}>{q}</span>}
                  </td>
                ))}
                <td className={`px-2 py-1.5 text-center text-sm font-bold ${cs.text} ${cs.bg}`}>{c.total}</td>
              </tr>
            ))}
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
      {/* Descricao da aba — comum as duas sub-abas */}
      <div className="bg-white rounded-lg border p-4 mb-4 flex items-start gap-3">
        <span className="text-3xl">👥</span>
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
          📊 Geral
        </button>
        <button onClick={() => setSubAba('colaboradores')}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition ${
            subAba === 'colaboradores'
              ? 'border-pink-600 text-pink-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}>
          👥 Colaboradores
        </button>
        <button onClick={() => setSubAba('documentos')}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition ${
            subAba === 'documentos'
              ? 'border-pink-600 text-pink-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}>
          📂 Documentos
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
        <div className="overflow-x-auto">
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
  // Paleta de cores do header (azul/rosa intercalado, fallback slate)
  const palette = {
    azul:  { headBg: 'bg-blue-200',  subBg: 'bg-blue-100',  border: 'border-blue-300',  text: 'text-blue-800',  textSub: 'text-blue-700',  textMuted: 'text-blue-300' },
    rosa:  { headBg: 'bg-pink-200',  subBg: 'bg-pink-100',  border: 'border-pink-300',  text: 'text-pink-800',  textSub: 'text-pink-700',  textMuted: 'text-pink-300' },
    slate: { headBg: 'bg-slate-300', subBg: 'bg-slate-200', border: 'border-slate-400', text: 'text-slate-800', textSub: 'text-slate-700', textMuted: 'text-slate-400' },
  };
  const c = palette[cor] || palette.slate;
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
      <div className="overflow-x-auto">
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
                  className={`text-center px-2 py-1.5 text-xs font-bold border-l ${c.border} ${i + 1 > mesLimite ? c.textMuted : c.text}`}>{m}</th>
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
      <div className="overflow-x-auto">
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

function BlocoBarras({ titulo, dados, cor, ordem }) {
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
          return (
            <div key={label}>
              <div className="flex justify-between mb-1">
                <span className="font-semibold text-gray-700 text-sm">{label}</span>
                <span className="font-bold text-gray-800 text-base">{qtd} <span className="text-gray-700 font-semibold">({pct}%)</span></span>
              </div>
              <div className="h-4 bg-gray-100 rounded overflow-hidden">
                <div className={`h-full ${cor}`} style={{ width: `${pct}%` }}></div>
              </div>
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
