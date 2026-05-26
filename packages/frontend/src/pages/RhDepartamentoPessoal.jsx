import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function RhDepartamentoPessoal() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [empresas, setEmpresas] = useState([]);
  const [companyId, setCompanyId] = useState('');
  const [pastas, setPastas] = useState([]);
  const [pastaAberta, setPastaAberta] = useState(null);
  const [subpastas, setSubpastas] = useState([]);
  const [documentos, setDocumentos] = useState([]);

  const [showNovaPasta, setShowNovaPasta] = useState(false);
  const [novaPastaNome, setNovaPastaNome] = useState('');
  const [novaPastaSenhaProtegida, setNovaPastaSenhaProtegida] = useState(false);

  // Pastas desbloqueadas nesta sessão (não persiste após refresh/logout)
  const [pastasDesbloqueadas, setPastasDesbloqueadas] = useState(new Set());
  const [pedirSenhaPasta, setPedirSenhaPasta] = useState(null); // { pasta }
  const [senhaInput, setSenhaInput] = useState('');
  const [verificandoSenha, setVerificandoSenha] = useState(false);

  const [novaSubpastaNome, setNovaSubpastaNome] = useState('');
  const [novaSubpastaObrig, setNovaSubpastaObrig] = useState(false);

  const [uploadModal, setUploadModal] = useState(null); // { subpastaId, label }
  const [arquivoUpload, setArquivoUpload] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadComVencimento, setUploadComVencimento] = useState(false);
  const [uploadDataVencimento, setUploadDataVencimento] = useState('');
  const [uploadDataAlerta, setUploadDataAlerta] = useState('');

  const [visualizarDoc, setVisualizarDoc] = useState(null);

  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/rh/empresas/stores/list');
        const data = Array.isArray(r.data) ? r.data : (r.data?.companies || []);
        setEmpresas(data);
      } catch { /* ignore */ }
    })();
  }, []);

  useEffect(() => { carregarPastas(); setPastaAberta(null); setDocumentos([]); setSubpastas([]); /* eslint-disable-next-line */ }, [companyId]);

  const carregarPastas = async () => {
    if (!companyId) { setPastas([]); return; }
    try {
      const r = await api.get(`/rh/dp/pastas?company_id=${companyId}`);
      setPastas(Array.isArray(r.data) ? r.data : []);
    } catch { setPastas([]); }
  };

  const seedPadrao = async () => {
    if (!companyId) return;
    try {
      await api.post(`/rh/dp/seed/${companyId}`);
      toast.success('Pastas padrão criadas');
      await carregarPastas();
    } catch { toast.error('Erro ao criar pastas padrão'); }
  };

  const abrirPasta = async (pasta) => {
    if (pasta.senha_protegida && !pastasDesbloqueadas.has(pasta.id)) {
      setPedirSenhaPasta(pasta);
      setSenhaInput('');
      return;
    }
    setPastaAberta(pasta);
    try {
      const [docsR, subsR] = await Promise.all([
        api.get(`/rh/dp/documentos?pasta_id=${pasta.id}`),
        api.get(`/rh/dp/subpastas?pasta_id=${pasta.id}`),
      ]);
      setDocumentos(Array.isArray(docsR.data) ? docsR.data : []);
      setSubpastas(Array.isArray(subsR.data) ? subsR.data : []);
    } catch { setDocumentos([]); setSubpastas([]); }
  };

  const validarSenhaPasta = async () => {
    if (!pedirSenhaPasta || !senhaInput) return;
    setVerificandoSenha(true);
    try {
      await api.post(`/rh/dp/pastas/${pedirSenhaPasta.id}/validar-senha`, { senha: senhaInput });
      const novoSet = new Set(pastasDesbloqueadas);
      novoSet.add(pedirSenhaPasta.id);
      setPastasDesbloqueadas(novoSet);
      const pasta = pedirSenhaPasta;
      setPedirSenhaPasta(null);
      setSenhaInput('');
      setPastaAberta(pasta);
      try {
        const [docsR, subsR] = await Promise.all([
          api.get(`/rh/dp/documentos?pasta_id=${pasta.id}`),
          api.get(`/rh/dp/subpastas?pasta_id=${pasta.id}`),
        ]);
        setDocumentos(Array.isArray(docsR.data) ? docsR.data : []);
        setSubpastas(Array.isArray(subsR.data) ? subsR.data : []);
      } catch { setDocumentos([]); setSubpastas([]); }
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Senha incorreta');
    } finally {
      setVerificandoSenha(false);
    }
  };

  const criarPasta = async (nome) => {
    if (!nome?.trim()) return;
    if (!companyId) { toast.error('Selecione uma empresa primeiro'); return; }
    try {
      await api.post('/rh/dp/pastas', {
        nome: nome.trim(),
        company_id: companyId,
        senha_protegida: novaPastaSenhaProtegida,
      });
      toast.success(novaPastaSenhaProtegida ? 'Pasta criada (protegida 🔒)' : 'Pasta criada');
      setShowNovaPasta(false);
      setNovaPastaNome('');
      setNovaPastaSenhaProtegida(false);
      await carregarPastas();
    } catch (err) { toast.error(err?.response?.data?.error || 'Erro ao criar'); }
  };

  const renomearPasta = async (p) => {
    const novo = window.prompt('Novo nome:', p.nome);
    if (!novo?.trim() || novo.trim().toUpperCase() === p.nome) return;
    try {
      await api.put(`/rh/dp/pastas/${p.id}`, { nome: novo.trim().toUpperCase() });
      toast.success('Renomeado');
      await carregarPastas();
      if (pastaAberta?.id === p.id) setPastaAberta({ ...pastaAberta, nome: novo.trim().toUpperCase() });
    } catch (err) { toast.error(err?.response?.data?.error || 'Erro'); }
  };

  const excluirPasta = async (p) => {
    if (!window.confirm(`Excluir "${p.nome}" e todos os arquivos dentro?`)) return;
    try {
      await api.delete(`/rh/dp/pastas/${p.id}`);
      if (pastaAberta?.id === p.id) { setPastaAberta(null); setDocumentos([]); setSubpastas([]); }
      await carregarPastas();
    } catch { toast.error('Erro ao excluir'); }
  };

  const criarSubpasta = async () => {
    if (!novaSubpastaNome.trim() || !pastaAberta) return;
    try {
      await api.post('/rh/dp/subpastas', { pasta_id: pastaAberta.id, nome: novaSubpastaNome.trim(), obrigatorio: novaSubpastaObrig });
      setNovaSubpastaNome(''); setNovaSubpastaObrig(false);
      toast.success('Sub-pasta criada');
      await abrirPasta(pastaAberta);
    } catch (err) { toast.error(err?.response?.data?.error || 'Erro'); }
  };

  const toggleObrigatorio = async (sub) => {
    try {
      await api.put(`/rh/dp/subpastas/${sub.id}`, { obrigatorio: !sub.obrigatorio });
      setSubpastas(subs => subs.map(s => s.id === sub.id ? { ...s, obrigatorio: !sub.obrigatorio } : s));
    } catch { toast.error('Erro'); }
  };

  const excluirSubpasta = async (sub) => {
    if (!window.confirm(`Excluir "${sub.nome}"?`)) return;
    try {
      await api.delete(`/rh/dp/subpastas/${sub.id}`);
      await abrirPasta(pastaAberta);
    } catch { toast.error('Erro'); }
  };

  const abrirUploadSolto = () => {
    setUploadModal({ subpastaId: null, label: 'Arquivo solto' });
    setArquivoUpload(null);
    setUploadComVencimento(false);
    setUploadDataVencimento(''); setUploadDataAlerta('');
  };
  const abrirUploadSub = (sub) => {
    setUploadModal({ subpastaId: sub.id, label: sub.nome });
    setArquivoUpload(null);
    setUploadComVencimento(false);
    setUploadDataVencimento(''); setUploadDataAlerta('');
  };

  const confirmarUpload = async () => {
    if (!arquivoUpload || !pastaAberta) return;
    if (uploadComVencimento && (!uploadDataVencimento || !uploadDataAlerta)) {
      toast.error('Informe a data de vencimento e a data de alerta');
      return;
    }
    setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append('arquivo', arquivoUpload);
      fd.append('pasta_id', pastaAberta.id);
      if (uploadModal?.subpastaId) fd.append('subpasta_id', String(uploadModal.subpastaId));
      if (uploadComVencimento) {
        fd.append('data_vencimento', uploadDataVencimento);
        fd.append('data_alerta', uploadDataAlerta);
      }
      await api.post('/rh/dp/documentos', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Arquivo enviado');
      setUploadModal(null); setArquivoUpload(null);
      setUploadComVencimento(false);
      setUploadDataVencimento(''); setUploadDataAlerta('');
      await abrirPasta(pastaAberta);
    } catch { toast.error('Erro no upload'); }
    finally { setUploadingFile(false); }
  };

  // Backend pode retornar 'YYYY-MM-DD' (string DATE) ou ISO completo. Normaliza pra Date local.
  const parseDataDoc = (v) => {
    if (!v) return null;
    const s = typeof v === 'string' ? v : String(v);
    // Pega só a parte YYYY-MM-DD (ignora hora/timezone) pra evitar shift de fuso
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return isNaN(d.getTime()) ? null : d;
  };

  const fmtDataDoc = (v) => {
    const d = parseDataDoc(v);
    return d ? d.toLocaleDateString('pt-BR') : '';
  };

  const statusVencimento = (doc) => {
    const venc = parseDataDoc(doc.data_vencimento);
    if (!venc) return null;
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const alerta = parseDataDoc(doc.data_alerta);
    if (venc < hoje) return { cor: 'red', label: 'VENCIDO', icone: '⛔' };
    if (alerta && alerta <= hoje) return { cor: 'amber', label: 'VENCE EM BREVE', icone: '⚠️' };
    return { cor: 'emerald', label: 'EM DIA', icone: '✅' };
  };

  const excluirDocumento = async (doc) => {
    if (!window.confirm(`Excluir "${doc.nome}"?`)) return;
    try {
      await api.delete(`/rh/dp/documentos/${doc.id}`);
      await abrirPasta(pastaAberta);
    } catch { toast.error('Erro'); }
  };

  const fmtTamanho = (b) => !b ? '' : b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

  // Drag and drop
  const handleDragStart = (e, id) => { setDraggingId(id); e.dataTransfer.effectAllowed = 'move'; };
  const handleDragOver = (e, id) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (id !== dragOverId) setDragOverId(id); };
  const handleDragEnd = () => { setDraggingId(null); setDragOverId(null); };
  const handleDrop = async (e, targetId) => {
    e.preventDefault();
    if (!draggingId || draggingId === targetId) { handleDragEnd(); return; }
    const lista = [...pastas];
    const fromIdx = lista.findIndex(p => p.id === draggingId);
    const toIdx = lista.findIndex(p => p.id === targetId);
    if (fromIdx === -1 || toIdx === -1) { handleDragEnd(); return; }
    const [moved] = lista.splice(fromIdx, 1);
    lista.splice(toIdx, 0, moved);
    setPastas(lista); handleDragEnd();
    try { await api.post('/rh/dp/pastas/reordenar', { pasta_ids: lista.map(p => p.id) }); }
    catch { toast.error('Erro ao salvar ordem'); await carregarPastas(); }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Departamento Pessoal</h1>
              <p className="text-orange-100 text-sm">Documentos e modelos da empresa (uso interno)</p>
            </div>
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-purple-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex gap-2 md:gap-4 p-2 md:p-4">
          {/* PASTAS */}
          <div className={`w-full md:w-96 md:shrink-0 bg-white rounded-lg border border-gray-200 flex-col overflow-hidden ${pastaAberta ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-3 border-b border-gray-200 space-y-2">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 mb-1">🏪 Empresa</label>
                <select value={companyId} onChange={e => setCompanyId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                  <option value="">Selecione a empresa...</option>
                  {empresas.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.apelido ? `Loja ${e.cod_loja} - ${e.apelido}` : (e.label || e.nome_fantasia || `Loja ${e.cod_loja}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-800">📁 Pastas</h2>
                <div className="flex gap-1">
                  {companyId && pastas.length === 0 && (
                    <button onClick={seedPadrao}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1.5 rounded-lg text-xs font-semibold"
                      title="Criar as 3 pastas padrão">
                      ✨ Seed
                    </button>
                  )}
                  <button onClick={() => setShowNovaPasta(true)} disabled={!companyId}
                    className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white px-3 py-1.5 rounded-lg text-xs font-semibold">
                    + Criar
                  </button>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {!companyId ? (
                <div className="p-6 text-center text-sm text-gray-400">Selecione uma empresa acima pra ver suas pastas.</div>
              ) : pastas.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-400">
                  Nenhuma pasta cadastrada pra essa empresa.<br />
                  Clique em <strong>✨ Seed</strong> pra criar as 3 pastas padrão ou <strong>+ Criar</strong> pra uma nova.
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
                    <svg className="w-4 h-4 text-gray-300 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M7 4a1 1 0 11-2 0 1 1 0 012 0zM7 10a1 1 0 11-2 0 1 1 0 012 0zM7 16a1 1 0 11-2 0 1 1 0 012 0zM15 4a1 1 0 11-2 0 1 1 0 012 0zM15 10a1 1 0 11-2 0 1 1 0 012 0zM15 16a1 1 0 11-2 0 1 1 0 012 0z" />
                    </svg>
                    <svg className="w-5 h-5 text-orange-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-800 truncate flex items-center gap-1">
                        {p.senha_protegida && (
                          <span title={pastasDesbloqueadas.has(p.id) ? 'Pasta desbloqueada nesta sessão' : 'Pasta protegida por senha'}>
                            {pastasDesbloqueadas.has(p.id) ? '🔓' : '🔒'}
                          </span>
                        )}
                        <span className="truncate">{p.nome}</span>
                      </div>
                      <div className="text-xs text-gray-500">{p.qtd_arquivos || 0} arquivo(s)</div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); renomearPasta(p); }}
                      className="text-blue-400 hover:text-blue-600 p-1" title="Renomear">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); excluirPasta(p); }}
                      className="text-red-400 hover:text-red-600 p-1" title="Excluir">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* CONTEÚDO DA PASTA */}
          <div className={`flex-1 bg-white rounded-lg border border-gray-200 flex-col overflow-hidden ${pastaAberta ? 'flex' : 'hidden md:flex'}`}>
            {!pastaAberta ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
                <div className="text-6xl mb-3">📂</div>
                <p className="font-semibold">Selecione uma pasta</p>
                <p className="text-sm mt-1">Escolha uma pasta à esquerda para ver os arquivos.</p>
              </div>
            ) : (
              <>
                <div className="p-3 md:p-4 border-b border-gray-200 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <button onClick={() => { setPastaAberta(null); setDocumentos([]); setSubpastas([]); }}
                      className="md:hidden text-gray-500 hover:text-gray-700 p-1 shrink-0" title="Voltar">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <div className="min-w-0">
                      <h3 className="text-base md:text-lg font-bold text-gray-800 truncate">📁 {pastaAberta.nome}</h3>
                      <p className="text-xs text-gray-500">{documentos.length} arquivo(s) · {subpastas.length} sub-pasta(s)</p>
                    </div>
                  </div>
                  <button onClick={abrirUploadSolto} disabled={uploadingFile}
                    className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold text-white ${uploadingFile ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'}`}>
                    📤 Enviar Arquivo
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 md:p-4">
                  {/* Criar sub-pasta */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                    <div className="text-xs font-bold text-amber-800 uppercase mb-2">📎 Sub-pastas (itens de documento)</div>
                    <div className="flex items-end gap-2 flex-wrap">
                      <input type="text" value={novaSubpastaNome}
                        onChange={e => setNovaSubpastaNome(e.target.value.toUpperCase())}
                        onKeyDown={e => e.key === 'Enter' && criarSubpasta()}
                        placeholder="Ex: CNPJ, ALVARA, CONTRATO SOCIAL..."
                        style={{ textTransform: 'uppercase' }}
                        className="flex-1 min-w-[200px] border border-gray-300 rounded-lg px-3 py-2 text-sm" />
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

                  {/* Sub-pastas */}
                  {subpastas.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {subpastas.map(sub => {
                        const docsDessa = documentos.filter(d => d.subpasta_id === sub.id);
                        const temArquivo = docsDessa.length > 0;
                        return (
                          <div key={sub.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                            <div className="p-3 flex items-center gap-2 hover:bg-gray-50 transition">
                              <svg className="w-5 h-5 text-orange-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                              </svg>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-gray-800 truncate">{sub.nome}</div>
                                <div className="text-xs text-gray-500">
                                  {temArquivo
                                    ? `${docsDessa.length} arquivo(s) enviado(s)`
                                    : sub.obrigatorio ? 'Aguardando upload do arquivo obrigatório...' : 'Nenhum arquivo enviado.'}
                                </div>
                              </div>
                              <button onClick={() => toggleObrigatorio(sub)}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${sub.obrigatorio ? 'text-red-700 bg-red-100 border-red-300' : 'text-gray-600 bg-gray-100 border-gray-300'}`}>
                                {sub.obrigatorio ? 'OBRIGATÓRIO' : 'OPCIONAL'}
                              </button>
                              <button onClick={() => abrirUploadSub(sub)}
                                className="text-xs font-semibold px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600">
                                📤 Upload
                              </button>
                              <button onClick={() => excluirSubpasta(sub)}
                                className="text-red-400 hover:text-red-600 p-1" title="Excluir">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                            {docsDessa.length > 0 && (
                              <div className="space-y-2 px-3 pb-3 pl-10">
                                {docsDessa.map(doc => {
                                  const st = statusVencimento(doc);
                                  const corBg = st ? (st.cor === 'red' ? 'bg-red-50 border-red-200' : st.cor === 'amber' ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200') : 'bg-gray-50 border-gray-200';
                                  return (
                                    <div key={doc.id} className={`flex items-center gap-3 text-sm border rounded-lg px-3 py-2 flex-wrap ${corBg}`}>
                                      <span className="text-xl shrink-0">{doc.mime_type?.startsWith('image/') ? '🖼️' : '📄'}</span>
                                      <span className="flex-1 truncate font-semibold text-gray-800 min-w-0">{doc.nome}</span>
                                      {st && (
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${st.cor === 'red' ? 'bg-red-200 text-red-800' : st.cor === 'amber' ? 'bg-amber-200 text-amber-800' : 'bg-emerald-200 text-emerald-800'}`}>
                                          {st.icone} {st.label}
                                        </span>
                                      )}
                                      {doc.data_vencimento && (
                                        <span className="text-xs text-gray-700 whitespace-nowrap">
                                          📅 Vence: <strong>{fmtDataDoc(doc.data_vencimento)}</strong>
                                        </span>
                                      )}
                                      <span className="text-sm text-gray-500 whitespace-nowrap">{fmtTamanho(doc.tamanho_bytes)}</span>
                                      <button onClick={() => setVisualizarDoc(doc)} className="text-purple-600 hover:text-purple-800 font-bold text-sm" title="Visualizar sem baixar">
                                        👁️ Visualizar
                                      </button>
                                      <a href={doc.arquivo_url} target="_blank" rel="noreferrer" className="text-blue-600 font-bold text-sm">⬇️ Baixar</a>
                                      <button onClick={() => excluirDocumento(doc)} className="text-red-500 hover:text-red-700">🗑️</button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Arquivos soltos */}
                  {documentos.filter(d => !d.subpasta_id).length > 0 && (
                    <>
                      <div className="text-xs font-bold text-gray-600 uppercase mb-2">Arquivos soltos</div>
                      <div className="space-y-2">
                        {documentos.filter(d => !d.subpasta_id).map(doc => (
                          <div key={doc.id} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                            <div className="text-3xl">{doc.mime_type?.startsWith('image/') ? '🖼️' : '📄'}</div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-gray-800 truncate">{doc.nome}</div>
                              <div className="text-xs text-gray-500">{fmtTamanho(doc.tamanho_bytes)} · {new Date(doc.uploaded_at).toLocaleDateString('pt-BR')}</div>
                            </div>
                            <button onClick={() => setVisualizarDoc(doc)} className="text-purple-600 hover:text-purple-800 font-semibold text-sm" title="Visualizar sem baixar">👁️ Visualizar</button>
                            <a href={doc.arquivo_url} target="_blank" rel="noreferrer" className="text-blue-600 font-semibold text-sm">⬇️ Baixar</a>
                            <button onClick={() => excluirDocumento(doc)} className="text-red-500 hover:text-red-700">🗑️</button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {subpastas.length === 0 && documentos.length === 0 && (
                    <div className="text-center text-sm text-gray-400 mt-8 border-2 border-dashed border-gray-200 rounded-lg p-8">
                      Pasta vazia. Crie uma <strong>sub-pasta</strong> acima ou envie um <strong>arquivo solto</strong>.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal Upload */}
      {uploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">📤 Enviar Arquivo</h3>
              <p className="text-xs text-gray-500">Para: <strong>{pastaAberta?.nome}</strong> {uploadModal.subpastaId && `→ ${uploadModal.label}`}</p>
            </div>
            <div className="p-4 space-y-3">
              <div
                onPaste={(e) => {
                  const items = e.clipboardData?.items || [];
                  for (const item of items) {
                    if (item.type.indexOf('image') !== -1) {
                      const blob = item.getAsFile();
                      if (blob) {
                        const ts = new Date().toISOString().replace(/[:.]/g, '-');
                        const ext = blob.type.split('/')[1] || 'png';
                        setArquivoUpload(new File([blob], `dp-print-${ts}.${ext}`, { type: blob.type }));
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
                    : 'border-gray-300 bg-gray-50 hover:border-orange-400'
                }`}
              >
                {arquivoUpload && arquivoUpload.type?.startsWith('image/') ? (
                  <div className="flex flex-col items-center gap-2">
                    <img src={URL.createObjectURL(arquivoUpload)} alt="Preview" className="max-h-56 rounded border border-gray-200" />
                    <div className="text-xs text-emerald-700 font-semibold">✔ Imagem pronta</div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">
                    <div className="text-3xl mb-1">📋</div>
                    <div className="font-semibold">Clique e pressione <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">Ctrl + V</kbd></div>
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-500 text-center">— OU —</div>
              <div className="grid grid-cols-2 gap-2">
                <input type="file" accept="image/*" capture="environment" id="dp-camera-input" className="hidden"
                  onChange={e => setArquivoUpload(e.target.files?.[0] || null)} />
                <label htmlFor="dp-camera-input"
                  className="cursor-pointer flex items-center justify-center gap-2 px-3 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-bold">
                  📷 Tirar Foto
                </label>
                <input type="file" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" id="dp-file-input" className="hidden"
                  onChange={e => setArquivoUpload(e.target.files?.[0] || null)} />
                <label htmlFor="dp-file-input"
                  className="cursor-pointer flex items-center justify-center gap-2 px-3 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-bold">
                  📁 Escolher Arquivo
                </label>
              </div>
              {arquivoUpload && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="flex-1 text-emerald-700 font-semibold truncate">✔ {arquivoUpload.name} ({(arquivoUpload.size / 1024).toFixed(1)} KB)</span>
                  <button type="button" onClick={() => setArquivoUpload(null)} className="text-red-600 hover:text-red-800 font-bold">✖ Limpar</button>
                </div>
              )}
              <label className="flex items-start gap-2 cursor-pointer p-2 rounded hover:bg-gray-50 border border-gray-200">
                <input type="checkbox" checked={uploadComVencimento}
                  onChange={e => setUploadComVencimento(e.target.checked)}
                  className="mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-gray-800">📅 Este documento tem validade?</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Marque pra registrar data de vencimento e receber alerta antes.
                  </div>
                </div>
              </label>
              {uploadComVencimento && (
                <div className="border-2 border-amber-200 bg-amber-50 rounded-lg p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-600">Data de vencimento</label>
                      <input type="date" value={uploadDataVencimento}
                        onChange={e => setUploadDataVencimento(e.target.value)}
                        className="w-full mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-600">Data de alerta</label>
                      <input type="date" value={uploadDataAlerta}
                        onChange={e => setUploadDataAlerta(e.target.value)}
                        className="w-full mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                    </div>
                  </div>
                  <p className="text-[10px] text-amber-700">A partir da data de alerta o sistema sinaliza o vencimento próximo.</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => { setUploadModal(null); setArquivoUpload(null); setUploadComVencimento(false); setUploadDataVencimento(''); setUploadDataAlerta(''); }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold">
                Cancelar
              </button>
              <button onClick={confirmarUpload} disabled={!arquivoUpload || uploadingFile}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:bg-gray-300">
                {uploadingFile ? 'Enviando...' : '📤 Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Visualizar Documento */}
      {visualizarDoc && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setVisualizarDoc(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-3 border-b border-gray-200 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-gray-800 truncate">👁️ {visualizarDoc.nome}</h3>
                <p className="text-xs text-gray-500">{fmtTamanho(visualizarDoc.tamanho_bytes)}</p>
              </div>
              <a href={visualizarDoc.arquivo_url} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded">
                ⬇️ Baixar
              </a>
              <button onClick={() => setVisualizarDoc(null)} className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-semibold rounded">
                ✖ Fechar
              </button>
            </div>
            <div className="flex-1 bg-gray-100 overflow-hidden">
              {visualizarDoc.mime_type?.startsWith('image/') ? (
                <div className="w-full h-full flex items-center justify-center p-4">
                  <img src={visualizarDoc.arquivo_url} alt={visualizarDoc.nome} className="max-w-full max-h-full object-contain" />
                </div>
              ) : visualizarDoc.mime_type?.includes('pdf') ? (
                <iframe src={visualizarDoc.arquivo_url} className="w-full h-full border-0" title={visualizarDoc.nome} />
              ) : (
                <iframe
                  src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(visualizarDoc.arquivo_url)}`}
                  className="w-full h-full border-0"
                  title={visualizarDoc.nome}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Nova Pasta */}
      {showNovaPasta && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">Nova Pasta</h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase text-gray-600">Nome da pasta</label>
                <input type="text" value={novaPastaNome}
                  onChange={e => setNovaPastaNome(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && criarPasta(novaPastaNome)}
                  style={{ textTransform: 'uppercase' }}
                  placeholder="Ex: DOCS RESCISÕES"
                  className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <label className="flex items-start gap-2 cursor-pointer p-2 rounded hover:bg-gray-50">
                <input type="checkbox" checked={novaPastaSenhaProtegida}
                  onChange={e => setNovaPastaSenhaProtegida(e.target.checked)}
                  className="mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-gray-800">🔒 Proteger com senha</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Só você (com sua senha de login) ou usuários master poderão abrir esta pasta.
                  </div>
                </div>
              </label>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => { setShowNovaPasta(false); setNovaPastaNome(''); setNovaPastaSenhaProtegida(false); }}
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

      {/* Modal Pedir Senha (pasta protegida) */}
      {pedirSenhaPasta && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">🔒 Pasta protegida</h3>
              <p className="text-xs text-gray-500 mt-1">"{pedirSenhaPasta.nome}" — digite sua senha de login pra abrir</p>
            </div>
            <div className="p-4">
              <label className="text-xs font-semibold uppercase text-gray-600">Senha</label>
              <input type="password" value={senhaInput} autoFocus
                onChange={e => setSenhaInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !verificandoSenha && validarSenhaPasta()}
                className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <p className="text-xs text-gray-400 mt-2">
                💡 Use a senha do criador da pasta ou de qualquer usuário master.
              </p>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => { setPedirSenhaPasta(null); setSenhaInput(''); }}
                disabled={verificandoSenha}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={validarSenhaPasta} disabled={!senhaInput || verificandoSenha}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold disabled:bg-gray-300">
                {verificandoSenha ? 'Verificando...' : 'Abrir pasta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
