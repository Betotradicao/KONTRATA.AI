import { useEffect, useRef, useState } from 'react';
import { api } from '../utils/api';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const PASTAS_SUGERIDAS = [
  'CONTRATO DE TRABALHO',
  'TERMOS DE RESPONSABILIDADE',
  'DECLARACOES',
  'DOCUMENTOS DE CADASTRO',
  'COMPROVANTES',
  'EXAMES / ASO',
  'FERIAS',
  'ADVERTENCIAS',
  'TREINAMENTOS',
];

export default function RhDocumentacao() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Filtros da lista de colaboradores
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('ativo');
  const [filtroEmpresa, setFiltroEmpresa] = useState('');

  // Dados
  const [empresas, setEmpresas] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [loading, setLoading] = useState(false);

  // Seleção
  const [selecionado, setSelecionado] = useState(null);
  const [pastas, setPastas] = useState([]);
  const [pastaAberta, setPastaAberta] = useState(null);
  const [documentos, setDocumentos] = useState([]);

  // Modais
  const [showNovaPasta, setShowNovaPasta] = useState(false);
  const [novaPastaNome, setNovaPastaNome] = useState('');

  const fileInputRef = useRef(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadContextSubpastaId, setUploadContextSubpastaId] = useState(null);

  // Modal de upload com paste (Ctrl+V)
  const [uploadModal, setUploadModal] = useState(null); // null | { subpastaId: number | null, label }
  const [arquivoUpload, setArquivoUpload] = useState(null);

  // Subpastas (itens de documento por pasta)
  const [subpastas, setSubpastas] = useState([]);
  const [novaSubpastaNome, setNovaSubpastaNome] = useState('');
  const [novaSubpastaObrig, setNovaSubpastaObrig] = useState(false);

  // Filtro por data nos arquivos da pasta aberta
  const [filtroDataDe, setFiltroDataDe] = useState('');
  const [filtroDataAte, setFiltroDataAte] = useState('');

  // Aplica filtro de data nos documentos
  const filtrarPorData = (docs) => {
    if (!filtroDataDe && !filtroDataAte) return docs;
    return docs.filter(d => {
      const dt = d.uploaded_at ? new Date(d.uploaded_at) : null;
      if (!dt) return false;
      if (filtroDataDe) {
        const de = new Date(filtroDataDe);
        de.setHours(0, 0, 0, 0);
        if (dt < de) return false;
      }
      if (filtroDataAte) {
        const ate = new Date(filtroDataAte);
        ate.setHours(23, 59, 59, 999);
        if (dt > ate) return false;
      }
      return true;
    });
  };

  // Drag and drop
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  // Stats globais + filtro "so com pendencias"
  const [stats, setStats] = useState({ total_pastas: 0, total_subpastas_obrigatorias: 0, total_subpastas_nao_obrigatorias: 0, total_obrigatorias_nao_populadas: 0, colaboradores_com_pendencia: [] });
  const [filtrarSoPendentes, setFiltrarSoPendentes] = useState(false);

  const carregarStats = async () => {
    try {
      const r = await api.get('/rh/documentacao/stats');
      setStats(r.data || {});
    } catch { /* ignore */ }
  };
  useEffect(() => { carregarStats(); }, []);

  // Carrega empresas + colaboradores
  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/rh/empresas/stores/list');
        const empData = Array.isArray(r.data) ? r.data : (r.data?.companies || []);
        setEmpresas(empData);
      } catch { /* ignore */ }
    })();
  }, []);

  useEffect(() => { carregarColaboradores(); /* eslint-disable-next-line */ }, [statusFiltro]);

  const carregarColaboradores = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', '99999');
      if (statusFiltro !== 'todos') params.append('status', statusFiltro);
      const r = await api.get(`/rh/colaboradores?${params.toString()}`);
      const lista = r.data?.data || r.data?.colaboradores || r.data || [];
      setColaboradores(Array.isArray(lista) ? lista : []);
    } catch (err) {
      toast.error('Erro ao carregar colaboradores');
    } finally {
      setLoading(false);
    }
  };

  // Aplica filtros no client
  const colaboradoresFiltrados = colaboradores.filter(c => {
    if (filtroEmpresa && String(c.company_id) !== String(filtroEmpresa)) return false;
    if (filtrarSoPendentes && !(stats.colaboradores_com_pendencia || []).includes(c.id)) return false;
    if (busca) {
      const q = busca.toLowerCase();
      const hit = (c.nome || '').toLowerCase().includes(q)
        || String(c.matricula || '').includes(q)
        || (c.cpf || '').includes(q);
      if (!hit) return false;
    }
    return true;
  });

  // Seleciona colaborador → carrega pastas
  const selecionarColaborador = async (c) => {
    setSelecionado(c);
    setPastaAberta(null);
    setDocumentos([]);
    await carregarPastas(c.id);
  };

  const carregarPastas = async (colaboradorId) => {
    try {
      const r = await api.get(`/rh/documentacao/pastas?colaborador_id=${colaboradorId}`);
      setPastas(Array.isArray(r.data) ? r.data : []);
    } catch {
      setPastas([]);
    }
  };

  const criarPasta = async (nome) => {
    if (!nome?.trim()) return;
    if (!selecionado) return;
    try {
      await api.post('/rh/documentacao/pastas', { colaborador_id: selecionado.id, nome: nome.trim() });
      toast.success('Pasta criada');
      setShowNovaPasta(false);
      setNovaPastaNome('');
      await carregarPastas(selecionado.id);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Erro ao criar pasta');
    }
  };

  const renomearPasta = async (pasta) => {
    const novo = window.prompt('Novo nome da pasta:', pasta.nome);
    if (!novo?.trim() || novo.trim().toUpperCase() === pasta.nome) return;
    try {
      await api.put(`/rh/documentacao/pastas/${pasta.id}`, { nome: novo.trim().toUpperCase() });
      toast.success('Pasta renomeada');
      await carregarPastas(selecionado.id);
      if (pastaAberta?.id === pasta.id) {
        setPastaAberta({ ...pastaAberta, nome: novo.trim().toUpperCase() });
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Erro ao renomear');
    }
  };

  const excluirPasta = async (pasta) => {
    if (!window.confirm(`Excluir a pasta "${pasta.nome}" e todos os arquivos dentro?`)) return;
    try {
      await api.delete(`/rh/documentacao/pastas/${pasta.id}`);
      toast.success('Pasta excluida');
      if (pastaAberta?.id === pasta.id) { setPastaAberta(null); setDocumentos([]); }
      await carregarPastas(selecionado.id);
    } catch (err) {
      toast.error('Erro ao excluir pasta');
    }
  };

  // Handlers de drag and drop para reordenar pastas
  const handleDragStart = (e, id) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e, id) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== dragOverId) setDragOverId(id);
  };
  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };
  const handleDrop = async (e, targetId) => {
    e.preventDefault();
    if (!draggingId || draggingId === targetId) { handleDragEnd(); return; }
    const lista = [...pastas];
    const fromIdx = lista.findIndex(p => p.id === draggingId);
    const toIdx = lista.findIndex(p => p.id === targetId);
    if (fromIdx === -1 || toIdx === -1) { handleDragEnd(); return; }
    const [moved] = lista.splice(fromIdx, 1);
    lista.splice(toIdx, 0, moved);
    setPastas(lista); // otimista
    handleDragEnd();
    try {
      await api.post('/rh/documentacao/pastas/reordenar', { pasta_ids: lista.map(p => p.id) });
    } catch {
      toast.error('Erro ao salvar ordem');
      if (selecionado) await carregarPastas(selecionado.id);
    }
  };

  const abrirPasta = async (pasta) => {
    setPastaAberta(pasta);
    try {
      const [docsR, subsR] = await Promise.all([
        api.get(`/rh/documentacao/documentos?pasta_id=${pasta.id}`),
        api.get(`/rh/documentacao/subpastas?pasta_id=${pasta.id}`),
      ]);
      setDocumentos(Array.isArray(docsR.data) ? docsR.data : []);
      setSubpastas(Array.isArray(subsR.data) ? subsR.data : []);
    } catch {
      setDocumentos([]);
      setSubpastas([]);
    }
  };

  const criarSubpasta = async () => {
    if (!novaSubpastaNome.trim() || !pastaAberta) return;
    try {
      await api.post('/rh/documentacao/subpastas', {
        pasta_id: pastaAberta.id,
        nome: novaSubpastaNome.trim(),
        obrigatorio: novaSubpastaObrig,
      });
      setNovaSubpastaNome('');
      setNovaSubpastaObrig(false);
      toast.success('Sub-pasta criada');
      await abrirPasta(pastaAberta);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Erro ao criar sub-pasta');
    }
  };

  const toggleObrigatorio = async (sub) => {
    try {
      await api.put(`/rh/documentacao/subpastas/${sub.id}`, { obrigatorio: !sub.obrigatorio });
      setSubpastas(subs => subs.map(s => s.id === sub.id ? { ...s, obrigatorio: !sub.obrigatorio } : s));
    } catch {
      toast.error('Erro ao atualizar');
    }
  };

  const excluirSubpasta = async (sub) => {
    if (!window.confirm(`Excluir "${sub.nome}" e seus arquivos?`)) return;
    try {
      await api.delete(`/rh/documentacao/subpastas/${sub.id}`);
      toast.success('Sub-pasta excluida');
      await abrirPasta(pastaAberta);
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  const replicarPastaParaTodos = async () => {
    if (!pastaAberta) return;
    const msg = `Replicar a pasta "${pastaAberta.nome}" com todas as ${subpastas.length} sub-pasta(s) para TODOS os colaboradores ativos?\n\n` +
      `Isso cria a pasta e as sub-pastas (com o mesmo nome e flag de obrigatório) em cada colaborador que ainda não tenha.`;
    if (!window.confirm(msg)) return;
    try {
      const r = await api.post(`/rh/documentacao/pastas/${pastaAberta.id}/replicar-todos`);
      const { colaboradores_ativos, pastas_criadas, subpastas_criadas } = r.data;
      toast.success(`✅ ${pastas_criadas} pasta(s) criada(s) e ${subpastas_criadas} sub-pasta(s) em ${colaboradores_ativos} colaborador(es) ativos`);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Erro ao replicar');
    }
  };

  const dispararUploadSubpasta = (subpastaId) => {
    const sub = subpastas.find(s => s.id === subpastaId);
    setUploadModal({ subpastaId, label: sub?.nome || 'Sub-pasta' });
    setArquivoUpload(null);
  };

  const abrirUploadSolto = () => {
    setUploadModal({ subpastaId: null, label: 'Arquivo solto' });
    setArquivoUpload(null);
  };

  const confirmarUpload = async () => {
    if (!arquivoUpload || !pastaAberta) return;
    setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append('arquivo', arquivoUpload);
      fd.append('pasta_id', pastaAberta.id);
      if (uploadModal?.subpastaId) fd.append('subpasta_id', String(uploadModal.subpastaId));
      await api.post('/rh/documentacao/documentos', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Arquivo enviado');
      setUploadModal(null);
      setArquivoUpload(null);
      await abrirPasta(pastaAberta);
      await carregarPastas(selecionado.id);
      await carregarStats();
    } catch (err) {
      toast.error('Erro ao enviar arquivo');
    } finally {
      setUploadingFile(false);
    }
  };

  const uploadArquivo = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !pastaAberta) return;
    setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append('arquivo', file);
      fd.append('pasta_id', pastaAberta.id);
      if (uploadContextSubpastaId) fd.append('subpasta_id', String(uploadContextSubpastaId));
      await api.post('/rh/documentacao/documentos', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Arquivo enviado');
      await abrirPasta(pastaAberta);
      await carregarPastas(selecionado.id);
    } catch (err) {
      toast.error('Erro ao enviar arquivo');
    } finally {
      setUploadingFile(false);
      setUploadContextSubpastaId(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const excluirDocumento = async (doc) => {
    if (!window.confirm(`Excluir o arquivo "${doc.nome}"?`)) return;
    try {
      await api.delete(`/rh/documentacao/documentos/${doc.id}`);
      toast.success('Arquivo excluido');
      await abrirPasta(pastaAberta);
      await carregarPastas(selecionado.id);
    } catch {
      toast.error('Erro ao excluir arquivo');
    }
  };

  const fmtTamanho = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Documentação</h1>
              <p className="text-orange-100 text-sm">Gestão de documentos dos colaboradores por pastas</p>
            </div>
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-purple-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Stats Cards - 2x2 no mobile, 4 colunas no desktop */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 px-2 md:px-4 pt-2 md:pt-4">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden flex items-stretch">
            <div className="flex-1 p-3 flex items-center gap-3">
              <div className="text-2xl">📁</div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Pastas</p>
                <p className="text-xl font-bold text-gray-800">{stats.total_pastas || 0}</p>
              </div>
            </div>
            <div className="w-1.5 bg-slate-400" />
          </div>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden flex items-stretch">
            <div className="flex-1 p-3 flex items-center gap-3">
              <div className="text-2xl">⚠️</div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Sub-pastas Obrigatórias</p>
                <p className="text-xl font-bold text-rose-600">{stats.total_subpastas_obrigatorias || 0}</p>
              </div>
            </div>
            <div className="w-1.5 bg-rose-400" />
          </div>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden flex items-stretch">
            <div className="flex-1 p-3 flex items-center gap-3">
              <div className="text-2xl">📎</div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Sub-pastas Opcionais</p>
                <p className="text-xl font-bold text-gray-700">{stats.total_subpastas_nao_obrigatorias || 0}</p>
              </div>
            </div>
            <div className="w-1.5 bg-gray-400" />
          </div>
          <button onClick={() => setFiltrarSoPendentes(v => !v)}
            title="Clique para filtrar somente colaboradores com obrigatórios pendentes"
            className={`text-left rounded-lg border overflow-hidden flex items-stretch transition ${filtrarSoPendentes ? 'bg-red-50 border-red-400 ring-2 ring-red-200' : 'bg-white border-gray-200 hover:border-red-300'}`}>
            <div className="flex-1 p-3 flex items-center gap-3">
              <div className="text-2xl">🚨</div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold flex items-center gap-1">
                  Obrigatórios Não Populados
                  {filtrarSoPendentes && <span className="text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold">FILTRO ATIVO</span>}
                </p>
                <p className="text-xl font-bold text-red-600">{stats.total_obrigatorias_nao_populadas || 0}</p>
                <p className="text-[10px] text-gray-500">{(stats.colaboradores_com_pendencia || []).length} colaborador(es) com pendência</p>
              </div>
            </div>
            <div className="w-1.5 bg-red-500" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex gap-2 md:gap-4 p-2 md:p-4">
          {/* COLUNA ESQUERDA: lista de colaboradores com filtros */}
          <div className={`w-full md:w-96 md:shrink-0 bg-white rounded-lg border border-gray-200 flex-col overflow-hidden ${selecionado ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-3 border-b border-gray-200 space-y-2">
              <input
                type="text"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar por nome, matricula ou CPF..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <div className="grid grid-cols-2 gap-2">
                <select value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                  <option value="ativo">Ativos</option>
                  <option value="desligado">Desligados</option>
                  <option value="todos">Todos</option>
                </select>
                <select value={filtroEmpresa} onChange={e => setFiltroEmpresa(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                  <option value="">Todas empresas</option>
                  {empresas.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.apelido ? `Loja ${e.cod_loja} - ${e.apelido}` : (e.label || e.nome_fantasia || `Loja ${e.cod_loja || ''}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-xs text-gray-500">
                {loading ? 'Carregando...' : `${colaboradoresFiltrados.length} colaborador(es)`}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {colaboradoresFiltrados.map(c => (
                <button key={c.id} onClick={() => selecionarColaborador(c)}
                  className={`w-full text-left p-3 flex items-center gap-3 hover:bg-gray-50 transition ${selecionado?.id === c.id ? 'bg-orange-50 border-l-4 border-orange-500' : ''}`}>
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
                  </div>
                  {c.status === 'desligado' && (
                    <span className="text-[10px] px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full font-semibold">Desligado</span>
                  )}
                </button>
              ))}
              {!loading && colaboradoresFiltrados.length === 0 && (
                <div className="p-6 text-center text-sm text-gray-400">Nenhum colaborador encontrado</div>
              )}
            </div>
          </div>

          {/* COLUNA DIREITA: pastas e arquivos do colaborador */}
          <div className={`flex-1 bg-white rounded-lg border border-gray-200 flex-col overflow-hidden ${selecionado ? 'flex' : 'hidden md:flex'}`}>
            {!selecionado ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400">
                <svg className="w-16 h-16 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <p className="font-semibold">Selecione um colaborador</p>
                <p className="text-sm mt-1">Escolha na lista ao lado para ver e gerenciar seus documentos.</p>
              </div>
            ) : (
              <>
                {/* Cabeçalho do colaborador selecionado */}
                <div className="p-3 md:p-4 border-b border-gray-200 flex items-center gap-2 md:gap-3">
                  {/* Botao voltar - so no mobile */}
                  <button onClick={() => { setSelecionado(null); setPastaAberta(null); setDocumentos([]); setSubpastas([]); }}
                    className="md:hidden text-gray-500 hover:text-gray-700 p-1 shrink-0" title="Voltar">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  {selecionado.foto_url ? (
                    <img src={selecionado.foto_url} alt="" className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover border border-orange-200 shrink-0" />
                  ) : (
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-base md:text-lg border border-orange-200 shrink-0">
                      {(selecionado.nome || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-base md:text-lg font-bold text-gray-800 truncate">{selecionado.nome}</div>
                    <div className="text-xs md:text-sm text-gray-500 truncate">
                      Mat. {selecionado.matricula || '-'} · {selecionado.cargo_nome || '-'}
                    </div>
                  </div>
                  <button onClick={() => setShowNovaPasta(true)}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold flex items-center gap-1 md:gap-2 shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="hidden md:inline">Criar Pasta</span>
                    <span className="md:hidden">Pasta</span>
                  </button>
                </div>

                {/* Conteúdo: lista de pastas + visualizador de arquivos */}
                <div className="flex-1 overflow-hidden flex">
                  {/* Pastas - fica full width no mobile qdo nao tem pasta aberta, esconde qdo tem */}
                  <div className={`w-full md:w-96 md:shrink-0 border-r border-gray-200 overflow-y-auto ${pastaAberta ? 'hidden md:block' : 'block'}`}>
                    {pastas.length === 0 ? (
                      <div className="p-6 text-center text-sm text-gray-400">
                        Nenhuma pasta criada ainda.
                      </div>
                    ) : (
                      pastas.map(p => (
                        <div key={p.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, p.id)}
                          onDragOver={(e) => handleDragOver(e, p.id)}
                          onDragEnd={handleDragEnd}
                          onDrop={(e) => handleDrop(e, p.id)}
                          onClick={() => abrirPasta(p)}
                          className={`p-3 flex items-center gap-2 cursor-move border-b border-gray-100 hover:bg-gray-50 transition
                            ${pastaAberta?.id === p.id ? 'bg-orange-50' : ''}
                            ${draggingId === p.id ? 'opacity-40' : ''}
                            ${dragOverId === p.id && draggingId !== p.id ? 'border-t-2 border-t-orange-500' : ''}`}>
                          <svg className="w-4 h-4 text-gray-300 shrink-0" fill="currentColor" viewBox="0 0 20 20" title="Arraste para reordenar">
                            <path d="M7 4a1 1 0 11-2 0 1 1 0 012 0zM7 10a1 1 0 11-2 0 1 1 0 012 0zM7 16a1 1 0 11-2 0 1 1 0 012 0zM15 4a1 1 0 11-2 0 1 1 0 012 0zM15 10a1 1 0 11-2 0 1 1 0 012 0zM15 16a1 1 0 11-2 0 1 1 0 012 0z" />
                          </svg>
                          <svg className="w-5 h-5 text-orange-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                          </svg>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-gray-800 truncate">{p.nome}</div>
                            <div className="text-xs text-gray-500">{p.qtd_arquivos || 0} arquivo(s)</div>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); renomearPasta(p); }}
                            className="text-blue-400 hover:text-blue-600 p-1" title="Renomear pasta">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); excluirPasta(p); }}
                            className="text-red-400 hover:text-red-600 p-1" title="Excluir pasta">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Arquivos - full width no mobile qdo pasta aberta */}
                  <div className={`flex-1 overflow-y-auto p-3 md:p-4 ${pastaAberta ? 'block' : 'hidden md:block'}`}>
                    {!pastaAberta ? (
                      <div className="text-center text-sm text-gray-400 mt-16">
                        Selecione uma pasta à esquerda para ver os arquivos.
                      </div>
                    ) : (
                      <>
                        <input type="file" ref={fileInputRef} onChange={uploadArquivo} className="hidden" />

                        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                          <div className="flex items-center gap-2 min-w-0">
                            {/* Voltar pra lista de pastas - so no mobile */}
                            <button onClick={() => { setPastaAberta(null); setDocumentos([]); setSubpastas([]); }}
                              className="md:hidden text-gray-500 hover:text-gray-700 p-1 shrink-0" title="Voltar às pastas">
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                              </svg>
                            </button>
                            <div className="min-w-0">
                              <h3 className="text-base md:text-lg font-bold text-gray-800 truncate">📁 {pastaAberta.nome}</h3>
                              <p className="text-xs text-gray-500">{documentos.length} arquivo(s) · {subpastas.length} sub-pasta(s)</p>
                            </div>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            <button onClick={abrirUploadSolto} disabled={uploadingFile}
                              className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold text-white ${uploadingFile ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'}`}>
                              {uploadingFile ? 'Enviando...' : '📤 Enviar Arquivo'}
                            </button>
                            <a
                              href={`${api.defaults.baseURL || ''}/rh/documentacao/pastas/${pastaAberta.id}/pdf?token=${localStorage.getItem('token')}`}
                              onClick={async (e) => {
                                e.preventDefault();
                                try {
                                  const r = await api.get(`/rh/documentacao/pastas/${pastaAberta.id}/pdf`, { responseType: 'blob' });
                                  const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `${pastaAberta.nome}_${selecionado.nome}.pdf`.replace(/[^a-zA-Z0-9._-]/g, '_');
                                  document.body.appendChild(a);
                                  a.click();
                                  a.remove();
                                  URL.revokeObjectURL(url);
                                } catch (err) {
                                  toast.error('Erro ao gerar PDF');
                                }
                              }}
                              className="px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold text-white bg-red-600 hover:bg-red-700 inline-flex items-center gap-1 cursor-pointer"
                              title="Gerar PDF consolidado com todos os arquivos da pasta">
                              📄 Gerar PDF
                            </a>
                          </div>
                        </div>

                        {/* Filtro por data dos arquivos */}
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 flex items-end gap-2 flex-wrap">
                          <div className="text-xs font-bold text-gray-700 uppercase shrink-0">📅 Filtrar arquivos por data:</div>
                          <div>
                            <label className="block text-[10px] font-semibold text-gray-500 uppercase">De</label>
                            <input type="date" value={filtroDataDe} onChange={e => setFiltroDataDe(e.target.value)}
                              className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-gray-500 uppercase">Até</label>
                            <input type="date" value={filtroDataAte} onChange={e => setFiltroDataAte(e.target.value)}
                              className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                          </div>
                          {(filtroDataDe || filtroDataAte) && (
                            <button onClick={() => { setFiltroDataDe(''); setFiltroDataAte(''); }}
                              className="text-xs font-bold text-red-600 hover:text-red-800 px-2 py-1">
                              ✖ Limpar
                            </button>
                          )}
                        </div>

                        {/* Form criar sub-pasta */}
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                          <div className="text-xs font-bold text-amber-800 uppercase mb-2">📎 Sub-pastas (itens de documento)</div>
                          <div className="flex items-end gap-2">
                            <div className="flex-1">
                              <input
                                type="text"
                                value={novaSubpastaNome}
                                onChange={e => setNovaSubpastaNome(e.target.value.toUpperCase())}
                                onKeyDown={e => e.key === 'Enter' && criarSubpasta()}
                                placeholder="Ex: DEVOLUÇÃO DE CTPS, COMPROVANTE DE ENDEREÇO..."
                                style={{ textTransform: 'uppercase' }}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                              />
                            </div>
                            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer whitespace-nowrap">
                              <input type="checkbox" checked={novaSubpastaObrig}
                                onChange={e => setNovaSubpastaObrig(e.target.checked)}
                                className="w-4 h-4 accent-red-500" />
                              Obrigatório
                            </label>
                            <button onClick={criarSubpasta} disabled={!novaSubpastaNome.trim()}
                              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300">
                              + Adicionar
                            </button>
                          </div>
                        </div>

                        {/* Lista de subpastas */}
                        {subpastas.length > 0 && (
                          <div className="space-y-2 mb-4">
                            {subpastas.map(sub => {
                              const docsDessa = filtrarPorData(documentos.filter(d => d.subpasta_id === sub.id));
                              const temArquivo = docsDessa.length > 0;
                              return (
                                <div key={sub.id} className={`rounded-lg border-2 p-3 ${sub.obrigatorio && !temArquivo ? 'border-red-300 bg-red-50' : temArquivo ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200 bg-white'}`}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-lg">{temArquivo ? '✅' : (sub.obrigatorio ? '⚠️' : '📎')}</span>
                                    <span className="font-bold text-gray-800 flex-1">{sub.nome}</span>
                                    {sub.obrigatorio ? (
                                      <button onClick={() => toggleObrigatorio(sub)}
                                        className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full border border-red-300 hover:bg-red-200"
                                        title="Clique para tornar opcional">
                                        OBRIGATÓRIO
                                      </button>
                                    ) : (
                                      <button onClick={() => toggleObrigatorio(sub)}
                                        className="text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-300 hover:bg-gray-200"
                                        title="Clique para tornar obrigatório">
                                        OPCIONAL
                                      </button>
                                    )}
                                    <button onClick={() => dispararUploadSubpasta(sub.id)} disabled={uploadingFile}
                                      className="text-xs font-semibold px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-300">
                                      📤 Upload
                                    </button>
                                    <button onClick={() => excluirSubpasta(sub)}
                                      className="text-red-400 hover:text-red-600 p-1" title="Excluir sub-pasta">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </div>
                                  {docsDessa.length === 0 ? (
                                    <div className="text-sm text-gray-500 italic ml-7 mt-2">
                                      {sub.obrigatorio ? 'Aguardando upload do arquivo obrigatório...' : 'Nenhum arquivo enviado.'}
                                    </div>
                                  ) : (
                                    <div className="space-y-2 ml-7 mt-2">
                                      {docsDessa.map(doc => (
                                        <div key={doc.id} className="flex items-center gap-3 text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 hover:shadow-sm transition">
                                          <span className="text-xl shrink-0">{doc.mime_type?.startsWith('image/') ? '🖼️' : doc.mime_type?.includes('pdf') ? '📄' : '📎'}</span>
                                          <span className="flex-1 truncate font-semibold text-gray-800">{doc.nome}</span>
                                          <span className="text-sm text-gray-600 whitespace-nowrap font-medium">📅 {new Date(doc.uploaded_at).toLocaleDateString('pt-BR')}</span>
                                          <span className="text-sm text-gray-500 whitespace-nowrap">{fmtTamanho(doc.tamanho_bytes)}</span>
                                          <a href={doc.arquivo_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 font-bold text-sm px-2">Abrir</a>
                                          <button onClick={() => excluirDocumento(doc)} className="text-red-500 hover:text-red-700 p-1" title="Excluir">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Arquivos soltos (sem subpasta) */}
                        {filtrarPorData(documentos.filter(d => !d.subpasta_id)).length > 0 && (
                          <>
                            <div className="text-xs font-bold text-gray-600 uppercase mb-2">Arquivos soltos</div>
                            <div className="space-y-2">
                              {filtrarPorData(documentos.filter(d => !d.subpasta_id)).map(doc => (
                                <div key={doc.id} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:shadow-sm transition">
                                  <div className="text-3xl">
                                    {doc.mime_type?.startsWith('image/') ? '🖼️' : doc.mime_type?.includes('pdf') ? '📄' : '📎'}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-gray-800 truncate">{doc.nome}</div>
                                    <div className="text-xs text-gray-500">
                                      {fmtTamanho(doc.tamanho_bytes)} · {new Date(doc.uploaded_at).toLocaleDateString('pt-BR')}
                                    </div>
                                  </div>
                                  <a href={doc.arquivo_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 text-sm font-semibold px-2">Abrir</a>
                                  <button onClick={() => excluirDocumento(doc)} className="text-red-500 hover:text-red-700 p-1" title="Excluir">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                          </>
                        )}

                        {subpastas.length === 0 && documentos.length === 0 && (
                          <div className="text-center text-sm text-gray-400 mt-8 border-2 border-dashed border-gray-200 rounded-lg p-8">
                            Pasta vazia. Crie <strong>sub-pastas</strong> acima ou envie um <strong>arquivo solto</strong> direto.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal Upload com Paste (Ctrl+V) */}
      {uploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">📤 Enviar Arquivo</h3>
              <p className="text-xs text-gray-500">Para: <strong>{pastaAberta?.nome}</strong> {uploadModal.subpastaId && `→ ${uploadModal.label}`}</p>
            </div>
            <div className="p-4 space-y-3">
              {/* Area paste */}
              <div
                onPaste={(e) => {
                  const items = e.clipboardData?.items || [];
                  for (const item of items) {
                    if (item.type.indexOf('image') !== -1) {
                      const blob = item.getAsFile();
                      if (blob) {
                        const ts = new Date().toISOString().replace(/[:.]/g, '-');
                        const ext = blob.type.split('/')[1] || 'png';
                        const file = new File([blob], `doc-print-${ts}.${ext}`, { type: blob.type });
                        setArquivoUpload(file);
                        e.preventDefault();
                        return;
                      }
                    }
                  }
                }}
                tabIndex={0}
                className={`rounded-lg border-2 border-dashed p-5 text-center cursor-text outline-none transition ${
                  arquivoUpload && arquivoUpload.type?.startsWith('image/')
                    ? 'border-emerald-400 bg-emerald-50'
                    : 'border-gray-300 bg-gray-50 hover:border-orange-400 hover:bg-orange-50 focus:border-orange-500 focus:bg-orange-50'
                }`}
              >
                {arquivoUpload && arquivoUpload.type?.startsWith('image/') ? (
                  <div className="flex flex-col items-center gap-2">
                    <img src={URL.createObjectURL(arquivoUpload)} alt="Preview"
                      className="max-h-56 rounded border border-gray-200" />
                    <div className="text-xs text-emerald-700 font-semibold">✔ Imagem pronta — clique em Enviar</div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">
                    <div className="text-3xl mb-1">📋</div>
                    <div className="font-semibold">Clique aqui e pressione <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">Ctrl + V</kbd></div>
                    <div className="text-xs mt-1">Cole um print direto da área de transferência</div>
                  </div>
                )}
              </div>

              <div className="text-xs text-gray-500 text-center">— OU —</div>

              <div className="grid grid-cols-2 gap-2">
                <input type="file" accept="image/*" capture="environment" id="doc-camera-input" className="hidden"
                  onChange={e => setArquivoUpload(e.target.files?.[0] || null)} />
                <label htmlFor="doc-camera-input"
                  className="cursor-pointer flex items-center justify-center gap-2 px-3 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-bold">
                  📷 Tirar Foto
                </label>
                <input type="file" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" id="doc-file-input" className="hidden"
                  onChange={e => setArquivoUpload(e.target.files?.[0] || null)} />
                <label htmlFor="doc-file-input"
                  className="cursor-pointer flex items-center justify-center gap-2 px-3 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-bold">
                  📁 Escolher Arquivo
                </label>
              </div>

              {arquivoUpload && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="flex-1 text-emerald-700 font-semibold truncate">
                    ✔ {arquivoUpload.name} ({(arquivoUpload.size / 1024).toFixed(1)} KB)
                  </span>
                  <button type="button" onClick={() => setArquivoUpload(null)}
                    className="text-red-600 hover:text-red-800 font-bold">✖ Limpar</button>
                </div>
              )}

            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => { setUploadModal(null); setArquivoUpload(null); }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold">
                Cancelar
              </button>
              <button onClick={confirmarUpload} disabled={!arquivoUpload || uploadingFile}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed">
                {uploadingFile ? 'Enviando...' : '📤 Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nova Pasta */}
      {showNovaPasta && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">Criar Pasta</h3>
              <p className="text-xs text-gray-500">Para {selecionado?.nome}</p>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase text-gray-600">Sugestões:</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {PASTAS_SUGERIDAS.map(p => (
                    <button key={p} onClick={() => criarPasta(p)}
                      className="text-xs text-left px-3 py-2 border border-gray-200 rounded-lg hover:border-orange-400 hover:bg-orange-50 font-semibold text-gray-700">
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-gray-600">Ou digite o nome:</label>
                <input
                  type="text"
                  value={novaPastaNome}
                  onChange={e => setNovaPastaNome(e.target.value.toUpperCase())}
                  placeholder="Ex: PASTA PERSONALIZADA"
                  style={{ textTransform: 'uppercase' }}
                  className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => { setShowNovaPasta(false); setNovaPastaNome(''); }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold">
                Cancelar
              </button>
              <button onClick={() => criarPasta(novaPastaNome)} disabled={!novaPastaNome.trim()}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold disabled:bg-gray-300">
                Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
