import { useEffect, useRef, useState } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

const TIPOS = [
  { key: 'admissional', label: 'Admissional', emoji: '🆕' },
  { key: 'periodico', label: 'Periódico', emoji: '🔄' },
  { key: 'demissional', label: 'Demissional', emoji: '🚪' },
  { key: 'retorno', label: 'Retorno ao trabalho', emoji: '↩️' },
  { key: 'mudanca_funcao', label: 'Mudança de função', emoji: '🔀' },
];

const RESULTADOS = [
  { key: 'apto', label: 'Apto', color: 'emerald' },
  { key: 'apto_restricao', label: 'Apto com restrição', color: 'amber' },
  { key: 'inapto', label: 'Inapto', color: 'red' },
  { key: 'pendente', label: 'Pendente', color: 'gray' },
];

// Classifica o status de um ASO pela data_vencimento
function classificarStatus(aso) {
  if (!aso || !aso.data_vencimento) return { label: 'Sem ASO', color: 'gray', dias: null };
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const venc = new Date(aso.data_vencimento); venc.setHours(0,0,0,0);
  const diff = Math.floor((venc - hoje) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { label: `Vencido há ${Math.abs(diff)}d`, color: 'red', dias: diff };
  if (diff <= 30) return { label: `Vence em ${diff}d`, color: 'amber', dias: diff };
  return { label: `Válido (${diff}d)`, color: 'emerald', dias: diff };
}

// Status com regra de CICLO: ASO antigo nao fica "vencido" indefinidamente.
// - Periodico antigo (com outro Periodico mais recente) -> "Substituido" (cinza)
// - Admissional com Periodico depois dele -> "Concluido" (cinza)
// - Retorno / Mudanca de funcao / Demissional -> sempre "Realizado" (cinza, evento pontual)
// - Caso contrario, classificacao normal por data_vencimento
function classificarStatusCiclo(aso, todosAsos) {
  if (!aso) return { label: 'Sem ASO', color: 'gray', dias: null };
  if (aso.tipo === 'retorno' || aso.tipo === 'mudanca_funcao' || aso.tipo === 'demissional') {
    return { label: 'Realizado', color: 'gray', dias: null };
  }
  if (aso.tipo === 'periodico') {
    const maisRecentePeriodico = todosAsos
      .filter(a => a.tipo === 'periodico')
      .sort((a, b) => new Date(b.data_exame) - new Date(a.data_exame))[0];
    if (maisRecentePeriodico && maisRecentePeriodico.id !== aso.id) {
      return { label: 'Substituído', color: 'gray', dias: null };
    }
    return classificarStatus(aso);
  }
  if (aso.tipo === 'admissional') {
    const houvePeriodicoDepois = todosAsos.some(a =>
      a.tipo === 'periodico' && new Date(a.data_exame) >= new Date(aso.data_exame)
    );
    if (houvePeriodicoDepois) {
      return { label: 'Concluído', color: 'gray', dias: null };
    }
    return classificarStatus(aso);
  }
  return classificarStatus(aso);
}

function fmtData(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR');
}

export default function RhControleASO() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos'); // todos / vencidos / a_vencer / validos / sem_aso
  const [filtroEmpresa, setFiltroEmpresa] = useState('');
  const [empresas, setEmpresas] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [stats, setStats] = useState({ total_asos: 0, colaboradores_ativos: 0, sem_aso: 0, validos: 0, a_vencer_30d: 0, vencidos: 0 });

  const [selecionado, setSelecionado] = useState(null);
  const [asos, setAsos] = useState([]);

  const [modalAso, setModalAso] = useState(null); // null | { ...aso vazio } | { ...aso editando }
  const [saving, setSaving] = useState(false);
  const [arquivoModal, setArquivoModal] = useState(null); // File selecionado no modal
  const fileRef = useRef(null);

  const carregarTudo = async () => {
    try {
      const url = filtroEmpresa ? `/rh/asos/colaboradores?company_id=${filtroEmpresa}` : '/rh/asos/colaboradores';
      const [cRes, sRes] = await Promise.all([
        api.get(url),
        api.get('/rh/asos/stats'),
      ]);
      setColaboradores(Array.isArray(cRes.data) ? cRes.data : []);
      setStats(sRes.data || {});
    } catch {
      toast.error('Erro ao carregar');
    }
  };
  useEffect(() => { carregarTudo(); /* eslint-disable-next-line */ }, [filtroEmpresa]);

  // Mantem `selecionado` sincronizado com a lista `colaboradores` —
  // sempre que a lista recarrega (ex: apos toggleDispensado), o detalhe
  // pega a versao fresca pra nao mostrar estado antigo do colaborador.
  useEffect(() => {
    if (!selecionado) return;
    const fresh = colaboradores.find(c => c.id === selecionado.id);
    if (fresh && fresh.aso_dispensado !== selecionado.aso_dispensado) {
      setSelecionado(fresh);
    }
  }, [colaboradores]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/rh/empresas/stores/list');
        const data = Array.isArray(r.data) ? r.data : (r.data?.companies || []);
        setEmpresas(data);
      } catch { /* ignore */ }
    })();
  }, []);

  const carregarAsosDoColaborador = async (colabId) => {
    try {
      const r = await api.get(`/rh/asos?colaborador_id=${colabId}`);
      setAsos(Array.isArray(r.data) ? r.data : []);
    } catch { setAsos([]); }
  };

  const selecionar = async (c) => {
    setSelecionado(c);
    await carregarAsosDoColaborador(c.id);
  };

  const colaboradoresFiltrados = colaboradores.filter(c => {
    // Filtro por status
    if (filtroStatus !== 'todos') {
      const st = classificarStatus({ data_vencimento: c.data_vencimento });
      if (filtroStatus === 'sem_aso' && c.aso_id) return false;
      if (filtroStatus === 'vencidos' && st.color !== 'red') return false;
      if (filtroStatus === 'a_vencer' && st.color !== 'amber') return false;
      if (filtroStatus === 'validos' && st.color !== 'emerald') return false;
    }
    if (busca) {
      const q = busca.toLowerCase();
      const hit = (c.nome || '').toLowerCase().includes(q)
        || String(c.matricula || '').includes(q)
        || (c.cargo_nome || '').toLowerCase().includes(q);
      if (!hit) return false;
    }
    return true;
  });

  // Lista unica ordenada por data do exame desc — tipo aparece como badge no card.
  // O tipo de cada novo ASO eh escolhido dentro do modal "+ Novo ASO".
  const asosOrdenados = [...asos].sort((a, b) => new Date(b.data_exame) - new Date(a.data_exame));
  const proximoPeriodico = (() => {
    const per = asos.filter(a => a.tipo === 'periodico').sort((a, b) => new Date(b.data_exame) - new Date(a.data_exame))[0];
    if (!per) return null;
    return { ...per, status: classificarStatus(per) };
  })();

  const abrirNovoAso = (tipoSugerido = 'periodico') => {
    setArquivoModal(null);
    setModalAso({
      id: null,
      colaborador_id: selecionado?.id,
      tipo: tipoSugerido,
      data_exame: new Date().toISOString().split('T')[0],
      validade_meses: 12,
      resultado: 'apto',
      clinica: '',
      medico_nome: '',
      medico_crm: '',
      observacoes: '',
      arquivo_url: '',
      arquivo_nome: '',
    });
  };

  const abrirEditarAso = (aso) => {
    setArquivoModal(null);
    setModalAso({ ...aso });
  };

  const salvarAso = async () => {
    if (!modalAso) return;
    // Validacao: novo ASO exige arquivo; na edicao o arquivo ja existe
    if (!modalAso.id && !arquivoModal) {
      toast.error('Envie o arquivo do ASO (PDF ou imagem) antes de salvar');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...modalAso };
      let salvo;
      if (modalAso.id) {
        const r = await api.put(`/rh/asos/${modalAso.id}`, payload);
        salvo = r.data;
      } else {
        const r = await api.post('/rh/asos', payload);
        salvo = r.data;
      }
      // Se o usuario selecionou um arquivo, faz upload
      if (arquivoModal && salvo?.id) {
        const fd = new FormData();
        fd.append('arquivo', arquivoModal);
        await api.post(`/rh/asos/${salvo.id}/arquivo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      toast.success('ASO salvo');
      setModalAso(null);
      setArquivoModal(null);
      await carregarAsosDoColaborador(selecionado.id);
      await carregarTudo();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Erro ao salvar');
    } finally { setSaving(false); }
  };

  const toggleDispensado = async (colab) => {
    const proximoEstado = !colab.aso_dispensado;
    const msg = proximoEstado
      ? `Marcar "${colab.nome}" como dispensado de ASO obrigatório (aprendiz/estágio)?\n\nEle vai sair de "Sem ASO" e dos alertas de vencimento.`
      : `Voltar a exigir ASO obrigatório de "${colab.nome}"?`;
    if (!window.confirm(msg)) return;
    try {
      const r = await api.put(`/rh/asos/colaboradores/${colab.id}/dispensar`, { aso_dispensado: proximoEstado });
      setSelecionado(s => s ? { ...s, aso_dispensado: !!r.data?.aso_dispensado } : s);
      toast.success(proximoEstado ? 'Marcado como não obrigatório' : 'Voltou a exigir ASO');
      await carregarTudo();
    } catch { toast.error('Erro ao atualizar'); }
  };

  const deletarAso = async (aso) => {
    if (!window.confirm(`Excluir este ASO (${aso.tipo}, ${fmtData(aso.data_exame)})?`)) return;
    try {
      await api.delete(`/rh/asos/${aso.id}`);
      toast.success('Excluido');
      await carregarAsosDoColaborador(selecionado.id);
      await carregarTudo();
    } catch { toast.error('Erro ao excluir'); }
  };

  const uploadArquivo = async (e, asoId) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append('arquivo', file);
      await api.post(`/rh/asos/${asoId}/arquivo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Arquivo enviado');
      await carregarAsosDoColaborador(selecionado.id);
    } catch { toast.error('Erro no upload'); }
    finally { e.target.value = ''; }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Controle de ASO</h1>
              <p className="text-orange-100 text-sm">Atestados de Saúde Ocupacional com alertas de vencimento</p>
            </div>
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-purple-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Dashboard Stats - 2 cols mobile, 5 cols desktop */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3 px-2 md:px-4 pt-2 md:pt-4">
          <StatCard emoji="👥" label="Colabs Ativos" value={stats.colaboradores_ativos} color="slate" active={filtroStatus === 'todos'} onClick={() => setFiltroStatus('todos')} />
          <StatCard emoji="✅" label="ASOs Válidos" value={stats.validos} color="emerald" active={filtroStatus === 'validos'} onClick={() => setFiltroStatus(filtroStatus === 'validos' ? 'todos' : 'validos')} />
          <StatCard emoji="⏰" label="A Vencer (30d)" value={stats.a_vencer_30d} color="amber" active={filtroStatus === 'a_vencer'} onClick={() => setFiltroStatus(filtroStatus === 'a_vencer' ? 'todos' : 'a_vencer')} />
          <StatCard emoji="🚨" label="Vencidos" value={stats.vencidos} color="red" active={filtroStatus === 'vencidos'} onClick={() => setFiltroStatus(filtroStatus === 'vencidos' ? 'todos' : 'vencidos')} />
          <StatCard emoji="❓" label="Sem ASO" value={stats.sem_aso} color="gray" active={filtroStatus === 'sem_aso'} onClick={() => setFiltroStatus(filtroStatus === 'sem_aso' ? 'todos' : 'sem_aso')} />
        </div>

        <div className="flex-1 overflow-hidden flex gap-2 md:gap-4 p-2 md:p-4">
          {/* LISTA DE COLABORADORES */}
          <div className={`w-full md:w-96 md:shrink-0 bg-white rounded-lg border border-gray-200 flex-col overflow-hidden ${selecionado ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-3 border-b border-gray-200 space-y-2">
              <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
                placeholder="Buscar por nome, matricula ou cargo..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              <select value={filtroEmpresa} onChange={e => setFiltroEmpresa(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                <option value="">Todas as empresas</option>
                {empresas.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.apelido ? `Loja ${e.cod_loja} - ${e.apelido}` : (e.label || e.nome_fantasia || `Loja ${e.cod_loja || ''}`)}
                  </option>
                ))}
              </select>
              <div className="text-xs text-gray-500">{colaboradoresFiltrados.length} colaborador(es)</div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {colaboradoresFiltrados.map(c => {
                // Dispensado de ASO (aprendiz/estagio) -> pill VERDE "Nao necessita ASO"
                // em vez do "Sem ASO" cinza. Nao entra em alertas.
                const st = c.aso_dispensado
                  ? { label: 'Não necessita ASO', color: 'emerald', dias: null }
                  : classificarStatus({ data_vencimento: c.data_vencimento });
                return (
                  <button key={c.id} onClick={() => selecionar(c)}
                    className={`w-full text-left p-3 flex items-center gap-3 hover:bg-gray-50 ${selecionado?.id === c.id ? 'bg-orange-50 border-l-4 border-orange-500' : ''}`}>
                    {c.foto_url ? (
                      <img src={c.foto_url} alt="" className="w-10 h-10 rounded-full object-cover border border-gray-200 shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold border border-orange-200 shrink-0">
                        {(c.nome || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-800 truncate">{c.nome}</div>
                      <div className="text-xs text-gray-500 truncate">{c.matricula || '-'} · {c.cargo_nome || 'Sem cargo'}</div>
                      {!c.aso_dispensado && <FasesTrilha colab={c} />}
                    </div>
                    <StatusPill status={st} />
                  </button>
                );
              })}
              {colaboradoresFiltrados.length === 0 && (
                <div className="p-6 text-center text-sm text-gray-400">Nenhum colaborador.</div>
              )}
            </div>
          </div>

          {/* DETALHE DO COLABORADOR */}
          <div className={`flex-1 bg-white rounded-lg border border-gray-200 flex-col overflow-hidden ${selecionado ? 'flex' : 'hidden md:flex'}`}>
            {!selecionado ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
                <div className="text-6xl mb-3">🩺</div>
                <p className="font-semibold">Selecione um colaborador</p>
                <p className="text-sm mt-1">Visualize e gerencie os ASOs dele.</p>
              </div>
            ) : (
              <>
                {/* Cabeçalho */}
                <div className="p-3 md:p-4 border-b border-gray-200 flex items-center gap-2 md:gap-3">
                  {/* Voltar - so mobile */}
                  <button onClick={() => { setSelecionado(null); setAsos([]); }}
                    className="md:hidden text-gray-500 hover:text-gray-700 p-1 shrink-0" title="Voltar">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  {selecionado.foto_url ? (
                    <img src={selecionado.foto_url} alt="" className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover border border-orange-200 shrink-0" />
                  ) : (
                    <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-lg md:text-xl border border-orange-200 shrink-0">
                      {(selecionado.nome || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-base md:text-xl font-bold text-gray-800 truncate">{selecionado.nome}</div>
                      {selecionado.aso_dispensado && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-300 whitespace-nowrap">
                          🚫 ASO não obrigatório
                        </span>
                      )}
                    </div>
                    <div className="text-xs md:text-sm text-gray-500 truncate">Mat. {selecionado.matricula || '-'} · {selecionado.cargo_nome || '-'}</div>
                  </div>
                  <button onClick={() => toggleDispensado(selecionado)}
                    title={selecionado.aso_dispensado ? 'Voltar a exigir ASO deste colaborador' : 'Marcar como NÃO obrigatório (aprendiz/estágio)'}
                    className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold shrink-0 ${
                      selecionado.aso_dispensado
                        ? 'bg-purple-100 hover:bg-purple-200 text-purple-700 border border-purple-300'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
                    }`}>
                    <span className="hidden md:inline">{selecionado.aso_dispensado ? '✓ Não obrigatório' : '🚫 Não obrigatório'}</span>
                    <span className="md:hidden">{selecionado.aso_dispensado ? '✓' : '🚫'}</span>
                  </button>
                  <button onClick={() => abrirNovoAso()}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold flex items-center gap-1 md:gap-2 shrink-0">
                    <span>+</span> <span className="hidden md:inline">Novo ASO</span><span className="md:hidden">ASO</span>
                  </button>
                </div>

                {/* Card Próximo Periódico */}
                {proximoPeriodico && (
                  <div className={`mx-4 mt-4 rounded-lg border-2 p-4 ${
                    proximoPeriodico.status.color === 'red' ? 'border-red-300 bg-red-50' :
                    proximoPeriodico.status.color === 'amber' ? 'border-amber-300 bg-amber-50' :
                    'border-emerald-300 bg-emerald-50'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">
                        {proximoPeriodico.status.color === 'red' ? '🚨' : proximoPeriodico.status.color === 'amber' ? '⏰' : '✅'}
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-bold uppercase text-gray-600">Último Periódico</div>
                        <div className="text-lg font-bold text-gray-800">
                          {fmtData(proximoPeriodico.data_exame)} · Vence em {fmtData(proximoPeriodico.data_vencimento)}
                        </div>
                        <div className="text-sm font-semibold" style={{
                          color: proximoPeriodico.status.color === 'red' ? '#dc2626' : proximoPeriodico.status.color === 'amber' ? '#b45309' : '#059669'
                        }}>
                          {proximoPeriodico.status.label}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Lista UNICA de ASOs (todos os tipos juntos, ordenados por data desc).
                    Tipo do exame aparece como badge no card. */}
                <div className="flex-1 overflow-y-auto p-4">
                  {selecionado.aso_dispensado ? (
                    <div className="text-center mt-8 border-2 border-dashed border-emerald-300 bg-emerald-50/50 rounded-lg p-8">
                      <div className="text-5xl mb-3">✅</div>
                      <div className="text-lg font-bold text-emerald-700">Não necessita de ASO</div>
                      <div className="text-sm text-emerald-600 mt-1">Colaborador dispensado (aprendiz / estágio). Não entra nos alertas de vencimento.</div>
                    </div>
                  ) : asosOrdenados.length === 0 ? (
                    <div className="text-center text-sm text-gray-400 mt-8 border-2 border-dashed border-gray-200 rounded-lg p-8">
                      Nenhum ASO cadastrado pra este colaborador. Clique em <strong>+ Novo ASO</strong>.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {asosOrdenados.map(aso => {
                        const st = classificarStatusCiclo(aso, asos);
                        const res = RESULTADOS.find(r => r.key === aso.resultado);
                        const tipoInfo = TIPOS.find(t => t.key === aso.tipo);
                        return (
                          <div key={aso.id} className={`rounded-lg border-2 p-4 ${
                            st.color === 'red' ? 'border-red-200 bg-red-50/30' :
                            st.color === 'amber' ? 'border-amber-200 bg-amber-50/30' :
                            st.color === 'emerald' ? 'border-emerald-200 bg-emerald-50/30' :
                            'border-gray-200 bg-gray-50/40 opacity-80'
                          }`}>
                            <div className="flex items-start gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {tipoInfo && (
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-300 whitespace-nowrap">
                                      {tipoInfo.emoji} {tipoInfo.label}
                                    </span>
                                  )}
                                  <span className="text-lg font-bold text-gray-800">{fmtData(aso.data_exame)}</span>
                                  <StatusPill status={st} />
                                  {res && (
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-${res.color}-100 text-${res.color}-700 border border-${res.color}-300`}>
                                      {res.label}
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-gray-600 mt-1 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0.5">
                                  <div>🏥 {aso.clinica || '—'}</div>
                                  <div>👨‍⚕️ {aso.medico_nome || '—'} {aso.medico_crm && `(CRM ${aso.medico_crm})`}</div>
                                  <div>📅 Vence em: <strong>{fmtData(aso.data_vencimento)}</strong></div>
                                  <div>⏱️ Validade: {aso.validade_meses} meses</div>
                                </div>
                                {aso.observacoes && (
                                  <div className="text-xs text-gray-500 mt-2 italic">"{aso.observacoes}"</div>
                                )}
                              </div>
                              <div className="flex flex-col gap-1 shrink-0">
                                {aso.arquivo_url ? (
                                  <a href={aso.arquivo_url} target="_blank" rel="noreferrer"
                                    className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded font-semibold text-center">
                                    📄 Abrir
                                  </a>
                                ) : (
                                  <>
                                    <input type="file" id={`upload-${aso.id}`} className="hidden" onChange={e => uploadArquivo(e, aso.id)} />
                                    <label htmlFor={`upload-${aso.id}`}
                                      className="cursor-pointer text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded font-semibold text-center">
                                      📤 Upload
                                    </label>
                                  </>
                                )}
                                <button onClick={() => abrirEditarAso(aso)}
                                  className="text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 px-3 py-1 rounded font-semibold">
                                  ✏️ Editar
                                </button>
                                <button onClick={() => deletarAso(aso)}
                                  className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded font-semibold">
                                  🗑️ Excluir
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal Novo/Editar ASO */}
      {modalAso && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-xl">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">{modalAso.id ? 'Editar ASO' : 'Novo ASO'}</h3>
              <p className="text-xs text-gray-500">Para {selecionado?.nome}</p>
            </div>
            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">Tipo *</label>
                  <select value={modalAso.tipo} onChange={e => setModalAso({ ...modalAso, tipo: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                    {TIPOS.map(t => <option key={t.key} value={t.key}>{t.emoji} {t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">Resultado</label>
                  <select value={modalAso.resultado} onChange={e => setModalAso({ ...modalAso, resultado: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                    {RESULTADOS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">Data do Exame *</label>
                  <input type="date" value={modalAso.data_exame} onChange={e => setModalAso({ ...modalAso, data_exame: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">Validade (meses)</label>
                  <input type="number" min="1" value={modalAso.validade_meses} onChange={e => setModalAso({ ...modalAso, validade_meses: parseInt(e.target.value) || 12 })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                </div>
                <div className="col-span-2">
                  {(() => {
                    if (!modalAso.data_exame || !modalAso.validade_meses) return null;
                    const d = new Date(modalAso.data_exame);
                    if (isNaN(d.getTime())) return null;
                    d.setMonth(d.getMonth() + Number(modalAso.validade_meses));
                    const venc = d.toLocaleDateString('pt-BR');
                    const hoje = new Date(); hoje.setHours(0,0,0,0);
                    const dVenc = new Date(d); dVenc.setHours(0,0,0,0);
                    const dias = Math.floor((dVenc - hoje) / (1000 * 60 * 60 * 24));
                    let cor = 'emerald';
                    let label = `Válido por ${dias} dias`;
                    if (dias < 0) { cor = 'red'; label = `Vencido há ${Math.abs(dias)} dias`; }
                    else if (dias <= 30) { cor = 'amber'; label = `Vence em ${dias} dias`; }
                    return (
                      <div className={`rounded-lg border-2 p-3 flex items-center gap-3 ${
                        cor === 'red' ? 'border-red-300 bg-red-50' :
                        cor === 'amber' ? 'border-amber-300 bg-amber-50' :
                        'border-emerald-300 bg-emerald-50'
                      }`}>
                        <div className="text-2xl">📅</div>
                        <div className="flex-1">
                          <div className="text-xs font-bold uppercase text-gray-600">Vencimento calculado</div>
                          <div className="text-base font-bold text-gray-800">{venc}</div>
                          <div className={`text-xs font-semibold ${
                            cor === 'red' ? 'text-red-700' : cor === 'amber' ? 'text-amber-700' : 'text-emerald-700'
                          }`}>{label}</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold uppercase text-gray-500">Clínica</label>
                  <input type="text" value={modalAso.clinica || ''} onChange={e => setModalAso({ ...modalAso, clinica: e.target.value.toUpperCase() })}
                    style={{ textTransform: 'uppercase' }}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" placeholder="Nome da clínica" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">Médico</label>
                  <input type="text" value={modalAso.medico_nome || ''} onChange={e => setModalAso({ ...modalAso, medico_nome: e.target.value.toUpperCase() })}
                    style={{ textTransform: 'uppercase' }}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" placeholder="Dr(a). Nome" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">CRM</label>
                  <input type="text" value={modalAso.medico_crm || ''} onChange={e => setModalAso({ ...modalAso, medico_crm: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" placeholder="000000" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold uppercase text-gray-500">Observações</label>
                  <textarea value={modalAso.observacoes || ''} onChange={e => setModalAso({ ...modalAso, observacoes: e.target.value })}
                    rows={2} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                </div>
                {/* Upload do arquivo do ASO - obrigatorio em novos */}
                <div className="col-span-2">
                  <label className="text-xs font-semibold uppercase text-gray-500">
                    Arquivo do ASO {!modalAso.id && <span className="text-red-500">*</span>} <span className="text-gray-400 font-normal">(PDF ou imagem)</span>
                  </label>
                  {modalAso.arquivo_url && !arquivoModal && (
                    <div className="mt-1 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
                      <span className="text-2xl">📄</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-800 truncate">{modalAso.arquivo_nome || 'Arquivo anexado'}</div>
                        <a href={modalAso.arquivo_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 font-semibold">Abrir arquivo atual</a>
                      </div>
                    </div>
                  )}

                  {/* Area de paste (Ctrl+V) - captura print direto da area de transferencia */}
                  <div
                    onPaste={(e) => {
                      const items = e.clipboardData?.items || [];
                      for (const item of items) {
                        if (item.type.indexOf('image') !== -1) {
                          const blob = item.getAsFile();
                          if (blob) {
                            const ts = new Date().toISOString().replace(/[:.]/g, '-');
                            const ext = blob.type.split('/')[1] || 'png';
                            const file = new File([blob], `aso-print-${ts}.${ext}`, { type: blob.type });
                            setArquivoModal(file);
                            e.preventDefault();
                            return;
                          }
                        }
                      }
                    }}
                    tabIndex={0}
                    className={`mt-2 rounded-lg border-2 border-dashed p-4 text-center cursor-text outline-none transition ${
                      arquivoModal && arquivoModal.type?.startsWith('image/')
                        ? 'border-emerald-400 bg-emerald-50'
                        : 'border-gray-300 bg-gray-50 hover:border-orange-400 hover:bg-orange-50 focus:border-orange-500 focus:bg-orange-50'
                    }`}
                  >
                    {arquivoModal && arquivoModal.type?.startsWith('image/') ? (
                      <div className="flex flex-col items-center gap-2">
                        <img src={URL.createObjectURL(arquivoModal)} alt="Preview"
                          className="max-h-48 rounded border border-gray-200" />
                        <div className="text-xs text-emerald-700 font-semibold">✔ Imagem colada/selecionada — pronta pra salvar</div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">
                        <div className="text-2xl mb-1">📋</div>
                        <div className="font-semibold">Clique aqui e pressione <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">Ctrl + V</kbd></div>
                        <div className="text-xs mt-1">Cole um print do ASO direto da área de transferência</div>
                      </div>
                    )}
                  </div>

                  <div className="mt-2 text-xs text-gray-500 text-center">— OU —</div>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input type="file" accept="image/*" capture="environment" id="aso-camera-input" className="hidden"
                      onChange={e => setArquivoModal(e.target.files?.[0] || null)} />
                    <label htmlFor="aso-camera-input"
                      className="cursor-pointer flex items-center justify-center gap-2 px-3 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-bold">
                      📷 Tirar Foto
                    </label>
                    <input type="file" accept=".pdf,image/*" id="aso-file-input" className="hidden"
                      onChange={e => setArquivoModal(e.target.files?.[0] || null)} />
                    <label htmlFor="aso-file-input"
                      className="cursor-pointer flex items-center justify-center gap-2 px-3 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-bold">
                      📁 Escolher Arquivo
                    </label>
                  </div>

                  {arquivoModal && (
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span className="flex-1 text-emerald-700 font-semibold truncate">
                        ✔ {arquivoModal.name} ({(arquivoModal.size / 1024).toFixed(1)} KB) {modalAso.arquivo_url && '(vai substituir o atual)'}
                      </span>
                      <button type="button" onClick={() => setArquivoModal(null)}
                        className="text-red-600 hover:text-red-800 font-bold">✖ Limpar</button>
                    </div>
                  )}
                  {!modalAso.id && !arquivoModal && (
                    <div className="mt-1 text-xs text-red-600 font-semibold">
                      ⚠ Obrigatório anexar ou colar o arquivo pra salvar
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => { setModalAso(null); setArquivoModal(null); }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold">
                Cancelar
              </button>
              <button onClick={salvarAso} disabled={saving || !modalAso.data_exame || (!modalAso.id && !arquivoModal)}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ emoji, label, value, color, active, onClick }) {
  const colors = {
    slate: 'bg-slate-400',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    gray: 'bg-gray-400',
  };
  return (
    <button onClick={onClick}
      className={`text-left bg-white rounded-lg border overflow-hidden flex items-stretch transition ${active ? 'border-orange-400 ring-2 ring-orange-200' : 'border-gray-200 hover:border-orange-200'}`}>
      <div className="flex-1 p-3 flex items-center gap-3">
        <div className="text-2xl">{emoji}</div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">{label}</p>
          <p className="text-xl font-bold text-gray-800">{value || 0}</p>
        </div>
      </div>
      <div className={`w-1.5 ${colors[color] || 'bg-gray-400'}`} />
    </button>
  );
}

// Trilha visual das fases do ciclo de ASO do colaborador.
// Mostra um icone por tipo, com contador se for >1 (Periodico).
// Cinza claro quando count=0, colorido quando >=1. Tooltip indica a fase.
function FasesTrilha({ colab }) {
  const fases = [
    { key: 'admissional',    emoji: '🆕', count: colab.cnt_admissional    || 0, title: 'Admissional' },
    { key: 'periodico',      emoji: '🔄', count: colab.cnt_periodico      || 0, title: 'Periódico' },
    { key: 'mudanca_funcao', emoji: '🔀', count: colab.cnt_mudanca_funcao || 0, title: 'Mudança de função' },
    { key: 'retorno',        emoji: '↩️', count: colab.cnt_retorno        || 0, title: 'Retorno ao trabalho' },
    { key: 'demissional',    emoji: '🚪', count: colab.cnt_demissional    || 0, title: 'Demissional' },
  ];
  const algumaFase = fases.some(f => f.count > 0);
  if (!algumaFase) return null;
  return (
    <div className="flex items-center gap-1 mt-1">
      {fases.filter(f => f.count > 0).map(f => (
        <span key={f.key} title={`${f.title} (${f.count})`}
          className="inline-flex items-center text-[10px] bg-orange-50 border border-orange-200 text-orange-700 rounded-full px-1.5 py-0.5 font-semibold">
          <span className="text-xs leading-none">{f.emoji}</span>
          {f.count > 1 && <span className="ml-0.5">×{f.count}</span>}
        </span>
      ))}
    </div>
  );
}

function StatusPill({ status }) {
  const colors = {
    red: 'bg-red-100 text-red-700 border-red-300',
    amber: 'bg-amber-100 text-amber-700 border-amber-300',
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    gray: 'bg-gray-100 text-gray-600 border-gray-300',
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border whitespace-nowrap ${colors[status.color] || colors.gray}`}>
      {status.label}
    </span>
  );
}
