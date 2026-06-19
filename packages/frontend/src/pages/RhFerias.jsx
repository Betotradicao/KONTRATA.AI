import { Fragment, useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import api from '../utils/api';
import toast from 'react-hot-toast';

const STATUS_BADGE = {
  em_dia:      { label: '🟢 Em dia',          cls: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  pode_tirar:  { label: '🟡 Pode tirar',      cls: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  vence_30d:   { label: '🟠 Vence ≤30d',     cls: 'bg-orange-100 text-orange-800 border-orange-300' },
  em_dobro:    { label: '🔴 Em dobro',        cls: 'bg-red-100 text-red-800 border-red-300' },
  programada:  { label: '📅 Programada',     cls: 'bg-blue-100 text-blue-800 border-blue-300' },
};

const fmtData = (d) => {
  if (!d) return '—';
  const [y, m, day] = String(d).slice(0, 10).split('-');
  return `${day}/${m}/${y}`;
};

const setorCor = (() => {
  // Paleta deterministica por setor_id (mesmo setor sempre mesma cor).
  const palette = [
    'bg-blue-100 text-blue-800 border-blue-300',
    'bg-purple-100 text-purple-800 border-purple-300',
    'bg-emerald-100 text-emerald-800 border-emerald-300',
    'bg-amber-100 text-amber-800 border-amber-300',
    'bg-pink-100 text-pink-800 border-pink-300',
    'bg-teal-100 text-teal-800 border-teal-300',
    'bg-indigo-100 text-indigo-800 border-indigo-300',
    'bg-orange-100 text-orange-800 border-orange-300',
  ];
  return (id) => palette[(Number(id) || 0) % palette.length];
})();

export default function RhFerias({ user }) {
  const [aba, setAba] = useState('lista');
  const [loading, setLoading] = useState(true);
  const [colabs, setColabs] = useState([]);
  const [filtroLoja, setFiltroLoja] = useState('');
  const [filtroSetor, setFiltroSetor] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('TODOS'); // TODOS | CLT | APRENDIZ
  const [busca, setBusca] = useState('');
  // Ordenacao por coluna. Click no header alterna asc/desc. Default: nome ASC.
  const [sortBy, setSortBy] = useState('nome');
  const [sortDir, setSortDir] = useState('asc');
  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };
  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <span className="text-gray-300 ml-1">⇅</span>;
    return <span className="text-purple-600 ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>;
  };

  // Linhas expandidas (mostram historico de gozadas)
  const [expandidos, setExpandidos] = useState(new Set());
  const toggleExpandido = (id) => setExpandidos(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // Modal de programar / marcar gozada
  const [modal, setModal] = useState(null); // { colab, modo: 'programar' | 'gozar' }
  const [form, setForm] = useState({ data_programada: '', data_inicio_gozo: '', data_fim_gozo: '', dias_gozados: 30, abono_pecuniario_dias: 0, observacoes: '' });
  const [salvando, setSalvando] = useState(false);

  // Calendario
  const [mesAtual, setMesAtual] = useState(() => new Date().toISOString().slice(0, 7));
  const [eventosCal, setEventosCal] = useState([]);
  const [loadingCal, setLoadingCal] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try {
      const r = await api.get('/rh/ferias');
      setColabs(Array.isArray(r.data) ? r.data : []);
    } catch {
      toast.error('Erro ao carregar férias');
    } finally { setLoading(false); }
  };
  useEffect(() => { carregar(); }, []);

  const carregarCalendario = async () => {
    setLoadingCal(true);
    try {
      const r = await api.get(`/rh/ferias/calendario?mes=${mesAtual}`);
      setEventosCal(Array.isArray(r.data?.eventos) ? r.data.eventos : []);
    } catch {
      toast.error('Erro ao carregar calendário');
    } finally { setLoadingCal(false); }
  };
  useEffect(() => { if (aba === 'calendario') carregarCalendario(); /* eslint-disable-next-line */ }, [aba, mesAtual]);

  const lojas = useMemo(() => {
    const map = new Map();
    colabs.forEach(c => { if (c.empresa_id) map.set(c.empresa_id, c.empresa_apelido || c.empresa_nome); });
    return Array.from(map, ([id, nome]) => ({ id, nome }));
  }, [colabs]);

  const setores = useMemo(() => {
    const map = new Map();
    colabs.forEach(c => { if (c.setor_id) map.set(c.setor_id, c.setor_nome); });
    return Array.from(map, ([id, nome]) => ({ id, nome }));
  }, [colabs]);

  // Calcula dias restantes (negativo se atrasado) — usado pra ordenar a coluna.
  const calcDiasRestantes = (limite) => {
    if (!limite) return null;
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const lim = new Date(String(limite).slice(0, 10) + 'T00:00:00');
    return Math.ceil((lim.getTime() - hoje.getTime()) / 86400000);
  };
  const filtrados = useMemo(() => {
    const lista = colabs.filter(c => {
      if (filtroLoja && String(c.empresa_id) !== String(filtroLoja)) return false;
      if (filtroSetor && String(c.setor_id) !== String(filtroSetor)) return false;
      if (filtroStatus && c.status !== filtroStatus) return false;
      if (filtroTipo !== 'TODOS') {
        const ehAprendiz = /aprendiz/i.test(c.cargo_nome || '');
        if (filtroTipo === 'APRENDIZ' && !ehAprendiz) return false;
        if (filtroTipo === 'CLT' && ehAprendiz) return false;
      }
      if (busca) {
        const q = busca.toLowerCase();
        const hay = `${c.nome} ${c.matricula} ${c.cargo_nome || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // Aplica ordenacao
    const getVal = (c) => {
      switch (sortBy) {
        case 'nome': return c.nome || '';
        case 'cargo_nome': return c.cargo_nome || '';
        case 'data_admissao': return c.data_admissao || '';
        case 'ultimo_periodo_gozado': return c.ultimo_periodo_gozado || '';
        case 'proximo_vencimento': return c.periodo_concessivo_fim || '';
        case 'limite_sem_dobro': return c.limite_sem_dobro || '';
        case 'dias_restantes': { const v = calcDiasRestantes(c.limite_sem_dobro); return v == null ? 99999 : v; }
        case 'programada': return c.data_programada || 'ZZZ';
        case 'status': return c.status || '';
        default: return '';
      }
    };
    lista.sort((a, b) => {
      const va = getVal(a), vb = getVal(b);
      if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va;
      const cmp = String(va).localeCompare(String(vb), 'pt-BR');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return lista;
  }, [colabs, filtroLoja, filtroSetor, filtroStatus, filtroTipo, busca, sortBy, sortDir]);

  const kpis = useMemo(() => ({
    total: colabs.length,
    em_dobro: colabs.filter(c => c.status === 'em_dobro').length,
    vence_30d: colabs.filter(c => c.status === 'vence_30d').length,
    programadas: colabs.filter(c => c.status === 'programada').length,
  }), [colabs]);

  const abrirModal = (colab, modo) => {
    setForm({
      data_programada: modo === 'programar' ? (colab.data_programada || '') : '',
      data_inicio_gozo: modo === 'gozar' ? (colab.data_programada || '') : '',
      data_fim_gozo: '',
      dias_gozados: 30,
      abono_pecuniario_dias: 0,
      observacoes: '',
    });
    setModal({ colab, modo });
  };

  const salvar = async () => {
    if (!modal) return;
    setSalvando(true);
    try {
      const body = { colaborador_id: modal.colab.id, ...form };
      if (modal.modo === 'programar') {
        body.status = 'programada';
        delete body.data_inicio_gozo;
        delete body.data_fim_gozo;
        if (!body.data_programada) { toast.error('Informe a data programada'); setSalvando(false); return; }
      } else {
        body.status = 'gozada';
        if (!body.data_inicio_gozo || !body.data_fim_gozo) { toast.error('Informe início e fim do gozo'); setSalvando(false); return; }
      }
      // Se ja existe registro programada pra esse colab, atualiza ao virar 'gozada'
      if (modal.modo === 'gozar' && modal.colab.ferias_id_programada) {
        await api.put(`/rh/ferias/${modal.colab.ferias_id_programada}`, body);
      } else {
        await api.post('/rh/ferias', body);
      }
      toast.success(modal.modo === 'programar' ? 'Férias programadas' : 'Férias registradas');
      setModal(null);
      await carregar();
      if (aba === 'calendario') await carregarCalendario();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Erro ao salvar');
    } finally { setSalvando(false); }
  };

  const cancelarProgramacao = async (feriasId) => {
    if (!window.confirm('Cancelar férias programadas?')) return;
    try {
      await api.delete(`/rh/ferias/${feriasId}`);
      toast.success('Programação cancelada');
      await carregar();
    } catch { toast.error('Erro ao cancelar'); }
  };

  // Calculo do calendario (matriz dias x semana)
  const calendarioGrid = useMemo(() => {
    const [y, m] = mesAtual.split('-').map(Number);
    const primDia = new Date(y, m - 1, 1);
    const ultDia = new Date(y, m, 0);
    const inicio = new Date(primDia); inicio.setDate(1 - primDia.getDay());
    const cels = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(inicio); d.setDate(inicio.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const noMes = d.getMonth() === m - 1;
      // Eventos do dia: o colaborador esta de ferias se iso entre data_inicio e data_fim.
      // Pra programadas (sem gozo ainda), pinta do data_programada ate data_programada + dias_gozados - 1.
      const evs = eventosCal.filter(e => {
        if (e.data_inicio_gozo && e.data_fim_gozo) {
          return iso >= String(e.data_inicio_gozo).slice(0, 10) && iso <= String(e.data_fim_gozo).slice(0, 10);
        }
        if (e.data_programada) {
          const ini = String(e.data_programada).slice(0, 10);
          const diasG = Number(e.dias_gozados) || 30;
          const dFim = new Date(ini + 'T00:00:00'); dFim.setDate(dFim.getDate() + diasG - 1);
          const fim = dFim.toISOString().slice(0, 10);
          return iso >= ini && iso <= fim;
        }
        return false;
      });
      cels.push({ iso, dia: d.getDate(), noMes, eventos: evs });
    }
    return cels;
  }, [mesAtual, eventosCal]);

  const mudarMes = (delta) => {
    const [y, m] = mesAtual.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMesAtual(d.toISOString().slice(0, 7));
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-4 shadow">
          <h1 className="text-2xl font-bold">🏖️ Controle de Férias</h1>
          <p className="text-sm opacity-90">Acompanhamento de períodos aquisitivos, concessivos e programações</p>
        </div>

        {/* KPIs */}
        <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI emoji="👥" label="Colaboradores ativos" valor={kpis.total} cor="from-purple-500 to-indigo-600" />
          <KPI emoji="🔴" label="Em dobro (atrasadas)" valor={kpis.em_dobro} cor="from-red-500 to-rose-600" />
          <KPI emoji="🟠" label="Vencem em 30 dias" valor={kpis.vence_30d} cor="from-orange-500 to-amber-600" />
          <KPI emoji="📅" label="Programadas" valor={kpis.programadas} cor="from-blue-500 to-cyan-600" />
        </div>

        {/* Abas */}
        <div className="px-6 border-b border-gray-200 flex gap-2">
          <button onClick={() => setAba('lista')}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition ${aba === 'lista' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            📋 Lista
          </button>
          <button onClick={() => setAba('calendario')}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition ${aba === 'calendario' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            📅 Calendário
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {aba === 'lista' && (
            <>
              {/* Filtros */}
              <div className="bg-white rounded-lg shadow p-3 mb-3 flex flex-wrap gap-2 items-center">
                <input type="text" placeholder="🔍 Buscar nome, matrícula ou cargo..." value={busca} onChange={e => setBusca(e.target.value.toUpperCase())}
                  className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded text-sm" />
                <select value={filtroLoja} onChange={e => setFiltroLoja(e.target.value)} className="px-3 py-2 border border-gray-300 rounded text-sm">
                  <option value="">🏢 Todas as lojas</option>
                  {lojas.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
                </select>
                <select value={filtroSetor} onChange={e => setFiltroSetor(e.target.value)} className="px-3 py-2 border border-gray-300 rounded text-sm">
                  <option value="">🏷️ Todos os setores</option>
                  {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
                <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} className="px-3 py-2 border border-gray-300 rounded text-sm">
                  <option value="">📊 Todos os status</option>
                  <option value="em_dia">🟢 Em dia</option>
                  <option value="pode_tirar">🟡 Pode tirar</option>
                  <option value="vence_30d">🟠 Vence ≤30d</option>
                  <option value="em_dobro">🔴 Em dobro</option>
                  <option value="programada">📅 Programada</option>
                </select>
              </div>

              {loading ? (
                <div className="text-center text-gray-400 p-12">Carregando...</div>
              ) : filtrados.length === 0 ? (
                <div className="text-center text-gray-400 p-12 bg-white rounded-lg border-2 border-dashed border-gray-200">Nenhum colaborador encontrado</div>
              ) : (
                <div className="bg-white rounded-lg shadow overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                      <tr>
                        <th className="px-1 py-2 w-6"></th>
                        <th className="px-3 py-2 text-left whitespace-nowrap">Colaborador</th>
                        <th className="px-3 py-2 text-left">Função / Setor</th>
                        <th className="px-3 py-2 text-left">Admissão</th>
                        <th className="px-3 py-2 text-left">Último Período Gozado</th>
                        <th className="px-3 py-2 text-left">Próximo Vencimento</th>
                        <th className="px-3 py-2 text-left">Limite sem Dobro</th>
                        <th className="px-3 py-2 text-left">Dias Restantes</th>
                        <th className="px-3 py-2 text-left">Programada</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtrados.map(c => {
                        const badge = STATUS_BADGE[c.status] || STATUS_BADGE.em_dia;
                        const aberto = expandidos.has(c.id);
                        const gozadas = (c.historico || []).filter(h => h.status === 'gozada')
                          .sort((a, b) => String(b.data_fim_gozo || '').localeCompare(String(a.data_fim_gozo || '')));
                        return (
                          <Fragment key={c.id}>
                          <tr className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="px-2 py-2 text-center">
                              {gozadas.length > 0 ? (
                                <button onClick={() => toggleExpandido(c.id)}
                                  title={aberto ? 'Ocultar histórico' : `Ver ${gozadas.length} férias gozadas`}
                                  className="w-6 h-6 rounded-full border-2 border-purple-400 text-purple-600 hover:bg-purple-100 font-bold text-sm">
                                  {aberto ? '−' : '+'}
                                </button>
                              ) : <span className="text-gray-300">·</span>}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                {c.foto_url ? <img src={c.foto_url} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-200" /> :
                                  <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold border border-purple-200">{(c.nome || '?').charAt(0)}</div>}
                                <div>
                                  <div className="font-semibold text-gray-800">{c.nome}</div>
                                  <div className="text-xs text-gray-500">Mat. {c.matricula || '—'}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="text-gray-700">{c.cargo_nome || '—'}</div>
                              {c.setor_nome && <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full border ${setorCor(c.setor_id)} mt-1`}>{c.setor_nome}</span>}
                            </td>
                            <td className="px-3 py-2 text-gray-700">{fmtData(c.data_admissao)}</td>
                            <td className="px-3 py-2">
                              <button onClick={() => abrirModal(c, 'gozar')}
                                title="Clique pra registrar férias gozadas"
                                className="text-left hover:underline">
                                {c.ultimo_periodo_gozado
                                  ? <span className="text-gray-700">{fmtData(c.ultimo_periodo_gozado)}</span>
                                  : <span className="text-purple-600 italic">+ registrar</span>}
                              </button>
                            </td>
                            <td className="px-3 py-2 text-gray-700">{fmtData(c.periodo_concessivo_fim)}</td>
                            <td className="px-3 py-2 text-gray-700"><span className={c.status === 'em_dobro' ? 'text-red-600 font-bold' : ''}>{fmtData(c.limite_sem_dobro)}</span></td>
                            <td className="px-3 py-2">
                              {(() => {
                                if (!c.limite_sem_dobro) return <span className="text-gray-400">—</span>;
                                const hoje = new Date(); hoje.setHours(0,0,0,0);
                                const lim = new Date(String(c.limite_sem_dobro).slice(0,10) + 'T00:00:00');
                                const dias = Math.ceil((lim.getTime() - hoje.getTime()) / 86400000);
                                if (dias < 0) return <span className="text-red-700 font-bold text-xs px-2 py-1 rounded bg-red-100 border border-red-300">{Math.abs(dias)}d atrasado</span>;
                                if (dias === 0) return <span className="text-red-700 font-bold text-xs px-2 py-1 rounded bg-red-100 border border-red-300">hoje!</span>;
                                if (dias <= 30) return <span className="text-orange-700 font-bold text-xs px-2 py-1 rounded bg-orange-100 border border-orange-300">{dias}d</span>;
                                if (dias <= 90) return <span className="text-yellow-700 font-bold text-xs px-2 py-1 rounded bg-yellow-100 border border-yellow-300">{dias}d</span>;
                                return <span className="text-emerald-700 font-semibold text-xs">{dias}d</span>;
                              })()}
                            </td>
                            <td className="px-3 py-2 text-gray-700">{c.data_programada ? <span className="text-blue-700 font-semibold">{fmtData(c.data_programada)}</span> : <span className="text-gray-400">—</span>}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-block text-xs font-bold px-2 py-1 rounded-full border ${badge.cls}`}>{badge.label}</span>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex gap-1 justify-center flex-wrap">
                                {!c.data_programada ? (
                                  <button onClick={() => abrirModal(c, 'programar')} className="text-xs px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded font-semibold">📅 Programar</button>
                                ) : (
                                  <>
                                    <button onClick={() => abrirModal(c, 'programar')} className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded font-semibold">✏️ Editar</button>
                                    <button onClick={() => cancelarProgramacao(c.ferias_id_programada)} className="text-xs px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded font-semibold">✖</button>
                                  </>
                                )}
                                <button onClick={() => abrirModal(c, 'gozar')} className="text-xs px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded font-semibold">✅ Gozada</button>
                              </div>
                            </td>
                          </tr>
                          {aberto && gozadas.length > 0 && (
                          <tr className="bg-purple-50/40">
                            <td colSpan={11} className="px-3 py-3">
                              <div className="text-xs font-bold text-purple-700 uppercase mb-2">📋 Histórico de Férias Gozadas — {c.nome}</div>
                              <table className="w-full text-xs bg-white border border-gray-200 rounded">
                                <thead className="bg-gray-100 text-gray-600 uppercase text-[10px]">
                                  <tr>
                                    <th className="px-2 py-1 text-left">#</th>
                                    <th className="px-2 py-1 text-left">Data Início</th>
                                    <th className="px-2 py-1 text-left">Data Fim</th>
                                    <th className="px-2 py-1 text-left">Dias Gozados</th>
                                    <th className="px-2 py-1 text-left">Abono (1/3)</th>
                                    <th className="px-2 py-1 text-left">Período Aquisitivo</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {gozadas.map((g, i) => (
                                    <tr key={g.id} className="border-t border-gray-100">
                                      <td className="px-2 py-1 text-gray-500">{gozadas.length - i}º</td>
                                      <td className="px-2 py-1 font-semibold text-gray-800">{fmtData(g.data_inicio_gozo)}</td>
                                      <td className="px-2 py-1 font-semibold text-gray-800">{fmtData(g.data_fim_gozo)}</td>
                                      <td className="px-2 py-1">{g.dias_gozados || 0} dias</td>
                                      <td className="px-2 py-1">{g.abono_pecuniario_dias > 0 ? `${g.abono_pecuniario_dias} dias` : '—'}</td>
                                      <td className="px-2 py-1 text-gray-600">{fmtData(g.periodo_aquisitivo_inicio)} a {fmtData(g.periodo_aquisitivo_fim)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                          )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {aba === 'calendario' && (
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-3">
                <button onClick={() => mudarMes(-1)} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded font-bold">‹ Anterior</button>
                <h3 className="font-bold text-lg text-gray-800">
                  {new Date(mesAtual + '-01T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}
                </h3>
                <button onClick={() => mudarMes(1)} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded font-bold">Próximo ›</button>
              </div>

              {/* Filtro de setor pro calendario */}
              <div className="flex gap-2 mb-3">
                <select value={filtroSetor} onChange={e => setFiltroSetor(e.target.value)} className="px-3 py-1 border border-gray-300 rounded text-sm">
                  <option value="">🏷️ Todos os setores</option>
                  {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>

              {loadingCal ? (
                <div className="text-center text-gray-400 p-12">Carregando calendário...</div>
              ) : (
                <>
                  <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-gray-500 mb-1">
                    {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(d => <div key={d}>{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {calendarioGrid.map((c, i) => {
                      const evs = filtroSetor ? c.eventos.filter(e => String(e.setor_id) === String(filtroSetor)) : c.eventos;
                      return (
                        <div key={i} className={`min-h-[90px] border rounded p-1 ${c.noMes ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                          <div className={`text-xs font-bold mb-1 ${c.noMes ? 'text-gray-700' : 'text-gray-400'}`}>{c.dia}</div>
                          <div className="space-y-0.5">
                            {evs.slice(0, 3).map(e => (
                              <div key={e.id} className={`text-[10px] px-1 py-0.5 rounded truncate border ${setorCor(e.setor_id)}`} title={`${e.colab_nome} — ${e.setor_nome || ''}`}>
                                {e.colab_nome}
                              </div>
                            ))}
                            {evs.length > 3 && <div className="text-[10px] text-gray-500 italic">+{evs.length - 3} mais</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Modal Programar / Marcar Gozada */}
        {modal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setModal(null)}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b">
                <h3 className="text-lg font-bold text-gray-800">
                  {modal.modo === 'programar' ? '📅 Programar Férias' : '✅ Registrar Férias Gozadas'}
                </h3>
                <p className="text-sm text-gray-500">{modal.colab.nome} · {modal.colab.cargo_nome || '—'}</p>
              </div>
              <div className="p-4 space-y-3">
                {modal.modo === 'programar' ? (
                  <div>
                    <label className="text-xs font-bold text-gray-600 uppercase">Data programada</label>
                    <input type="date" value={form.data_programada} onChange={e => setForm({ ...form, data_programada: e.target.value })}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-600 uppercase">Início do gozo</label>
                      <input type="date" value={form.data_inicio_gozo}
                        onChange={e => {
                          const ini = e.target.value;
                          // Auto-calcula fim = inicio + (dias_gozados - 1)
                          let fim = form.data_fim_gozo;
                          if (ini && form.dias_gozados) {
                            const d = new Date(ini + 'T00:00:00');
                            d.setDate(d.getDate() + (form.dias_gozados - 1));
                            fim = d.toISOString().slice(0, 10);
                          }
                          setForm({ ...form, data_inicio_gozo: ini, data_fim_gozo: fim });
                        }}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-600 uppercase">Fim do gozo <span className="text-gray-400 normal-case">(auto)</span></label>
                      <input type="date" value={form.data_fim_gozo} onChange={e => setForm({ ...form, data_fim_gozo: e.target.value })}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-600 uppercase">Dias gozados</label>
                    <input type="number" min={0} max={30} value={form.dias_gozados}
                      onChange={e => {
                        const dias = parseInt(e.target.value) || 0;
                        // No modo "gozar", recalcular o fim quando muda os dias
                        let fim = form.data_fim_gozo;
                        if (modal?.modo === 'gozar' && form.data_inicio_gozo && dias) {
                          const d = new Date(form.data_inicio_gozo + 'T00:00:00');
                          d.setDate(d.getDate() + (dias - 1));
                          fim = d.toISOString().slice(0, 10);
                        }
                        setForm({ ...form, dias_gozados: dias, data_fim_gozo: fim });
                      }}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 uppercase">Abono pecuniário (dias vendidos)</label>
                    <input type="number" min={0} max={10} value={form.abono_pecuniario_dias} onChange={e => setForm({ ...form, abono_pecuniario_dias: parseInt(e.target.value) || 0 })}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 uppercase">Observações</label>
                  <textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value.toUpperCase() })}
                    rows={2} className="w-full border border-gray-300 rounded px-3 py-2 text-sm uppercase" />
                </div>
              </div>
              <div className="p-4 border-t flex justify-end gap-2">
                <button onClick={() => setModal(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded font-semibold">Cancelar</button>
                <button onClick={salvar} disabled={salvando} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-bold disabled:opacity-50">
                  {salvando ? 'Salvando...' : (modal.modo === 'programar' ? '📅 Programar' : '✅ Registrar')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KPI({ emoji, label, valor, cor }) {
  return (
    <div className={`rounded-lg shadow p-3 text-white bg-gradient-to-br ${cor}`}>
      <div className="text-2xl">{emoji}</div>
      <div className="text-2xl font-bold">{valor}</div>
      <div className="text-xs opacity-90 uppercase font-semibold">{label}</div>
    </div>
  );
}
