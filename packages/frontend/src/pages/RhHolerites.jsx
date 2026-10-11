import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

// RH → Holerites: importa o PDF da contabilidade, o sistema fatia e sugere de quem é cada
// página (CPF impresso), o RH confere/classifica e publica no Portal do Colaborador
// (pasta HOLERITES + WhatsApp com link e PDF). Aba Publicações acompanha a ciência.

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const fmtComp = (c) => { const [y, m] = String(c || '').split('-'); return m ? `${MESES[parseInt(m) - 1]}/${y}` : (c || '—'); };
const fmtData = (d) => d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtCpf = (v) => { const d = String(v || '').replace(/\D/g, ''); return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : (v || '—'); };
const compAtual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

const CONFIANCA = {
  alta:       { label: 'CPF bateu',      cls: 'bg-green-100 text-green-800' },
  media:      { label: 'Nome bateu',     cls: 'bg-blue-100 text-blue-800' },
  baixa:      { label: 'Nome parecido',  cls: 'bg-amber-100 text-amber-800' },
  confirmada: { label: 'Confirmado',     cls: 'bg-purple-100 text-purple-800' },
  nenhuma:    { label: 'Não identificado', cls: 'bg-red-100 text-red-800' },
};
const STATUS_PUB = {
  pendente:    { label: 'Pendente',    cls: 'bg-amber-100 text-amber-800' },
  visualizado: { label: 'Visualizado', cls: 'bg-blue-100 text-blue-800' },
  aceito:      { label: 'Ciente ✓',    cls: 'bg-green-100 text-green-800' },
  substituido: { label: 'Substituído', cls: 'bg-gray-100 text-gray-600' },
};
const Badge = ({ map, k }) => { const m = map[k] || { label: k, cls: 'bg-gray-100 text-gray-700' }; return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${m.cls}`}>{m.label}</span>; };

export default function RhHolerites() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [aba, setAba] = useState('importar');
  const [colaboradores, setColaboradores] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [empresas, setEmpresas] = useState([]);

  useEffect(() => {
    (async () => {
      try { const e = await api.get('/rh/empresas/stores/list'); setEmpresas(Array.isArray(e.data) ? e.data : []); }
      catch (e) { console.error('empresas:', e); }
      try {
        const r = await api.get('/rh/colaboradores?status=ativo&limit=1000');
        const list = Array.isArray(r.data?.data) ? r.data.data : Array.isArray(r.data) ? r.data : (r.data?.colaboradores || []);
        setColaboradores(list.sort((a, b) => String(a.nome).localeCompare(String(b.nome))));
      } catch (e) { console.error('colaboradores:', e); }
      try { const t = await api.get('/rh/configuracoes/tipos-holerite'); setTipos(t.data || []); }
      catch (e) { console.error('tipos:', e); }
    })();
  }, []);

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 overflow-y-auto">
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white px-6 py-4 flex items-center gap-2">
          <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-purple-700 shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold">Holerites</h1>
            <p className="text-purple-100 text-sm">Importar PDF da contabilidade → classificar → publicar no Portal do Colaborador</p>
          </div>
        </div>

        <div className="bg-white border-b px-4 flex gap-1 overflow-x-auto">
          {[['importar', '📥 Importar & Classificar'], ['publicacoes', '📤 Publicações'], ['acessos', '🔑 Acessos ao Portal']].map(([k, l]) => (
            <button key={k} onClick={() => setAba(k)}
              className={`px-4 py-3 text-sm font-semibold border-b-2 whitespace-nowrap ${aba === k ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{l}</button>
          ))}
        </div>

        <div className="p-4">
          {aba === 'importar' && <AbaImportar colaboradores={colaboradores} tipos={tipos} empresas={empresas} />}
          {aba === 'publicacoes' && <AbaPublicacoes />}
          {aba === 'acessos' && <AbaAcessos />}
        </div>
      </div>
    </div>
  );
}

/* ============================ IMPORTAR & CLASSIFICAR ============================ */
const labelEmpresa = (e) => e.apelido ? `Loja ${e.cod_loja} — ${e.apelido}` : (e.label || e.nome_fantasia || e.razao_social || e.id);
const cpfDigits = (v) => String(v || '').replace(/\D/g, '');
// CPF impresso no PDF tem que ser o do colaborador escolhido — senão é holerite de outra pessoa
const cpfConfere = (it) => !it.cpf_detectado || !it.colaborador_cpf || cpfDigits(it.cpf_detectado) === cpfDigits(it.colaborador_cpf);
const itemPronto = (it) => it.colaborador_id && it.tipo_id && it.competencia && cpfConfere(it);

function AbaImportar({ colaboradores, tipos, empresas }) {
  const [empresaImport, setEmpresaImport] = useState('');
  const [lotes, setLotes] = useState([]);
  const [lote, setLote] = useState(null);
  const [importando, setImportando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [selecionados, setSelecionados] = useState(new Set());
  const [enviarWhats, setEnviarWhats] = useState(true);
  const [resultado, setResultado] = useState(null);
  const fileRef = useRef(null);

  const carregarLotes = async () => {
    try { const r = await api.get('/rh/holerites/lotes'); setLotes(r.data || []); } catch { /* noop */ }
  };
  useEffect(() => { carregarLotes(); }, []);

  const abrirLote = async (id) => {
    try {
      const r = await api.get(`/rh/holerites/lotes/${id}`);
      setLote(r.data);
      setSelecionados(new Set(r.data.itens.filter(i => i.status === 'pendente' && itemPronto(i)).map(i => i.id)));
      setResultado(null);
    } catch (e) { toast.error(e.response?.data?.error || 'Erro ao abrir lote'); }
  };

  const importar = async (file) => {
    if (!file) return;
    setImportando(true);
    const fd = new FormData();
    fd.append('arquivo', file);
    if (empresaImport) fd.append('company_id', empresaImport);
    try {
      const r = await api.post('/rh/holerites/lotes', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 300000 });
      toast.success(`${r.data.total_itens} holerite(s) identificados em ${r.data.total_paginas} página(s)`);
      await carregarLotes();
      await abrirLote(r.data.id);
    } catch (e) { toast.error(e.response?.data?.error || 'Erro ao importar'); }
    finally { setImportando(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const salvarItem = async (item, dados) => {
    // otimista na tela; a resposta do PUT traz a linha completa (nome, CPF e tipo do colaborador escolhido)
    setLote(prev => ({ ...prev, itens: prev.itens.map(i => i.id === item.id ? { ...i, ...dados } : i) }));
    try {
      const r = await api.put(`/rh/holerites/lotes/${lote.id}/itens/${item.id}`, dados);
      const full = r.data;
      setLote(prev => ({ ...prev, itens: prev.itens.map(i => i.id === item.id ? { ...i, ...full } : i) }));
      if (full && !cpfConfere(full)) setSelecionados(prev => { const n = new Set(prev); n.delete(item.id); return n; });
    } catch (e) { toast.error(e.response?.data?.error || 'Erro ao salvar'); abrirLote(lote.id); }
  };

  const trocarEmpresaLote = async (companyId) => {
    try { const r = await api.put(`/rh/holerites/lotes/${lote.id}`, { company_id: companyId || null }); setLote(r.data); carregarLotes(); }
    catch (e) { toast.error(e.response?.data?.error || 'Erro ao salvar empresa'); }
  };

  const aplicarCompetenciaTodos = async (comp) => {
    if (!comp || !lote) return;
    for (const it of lote.itens.filter(i => i.status === 'pendente')) await salvarItem(it, { competencia: comp });
    toast.success('Competência aplicada a todos os pendentes');
  };
  const aplicarTipoTodos = async (tipoId) => {
    if (!tipoId || !lote) return;
    for (const it of lote.itens.filter(i => i.status === 'pendente')) await salvarItem(it, { tipo_id: Number(tipoId) });
    toast.success('Tipo aplicado a todos os pendentes');
  };

  const preview = async (item) => {
    try {
      const r = await api.get(`/rh/holerites/itens/${item.id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { toast.error('Erro ao abrir o PDF'); }
  };

  const publicar = async (somenteIds = null) => {
    const ids = somenteIds || [...selecionados];
    if (!ids.length) { toast.error('Selecione pelo menos um holerite'); return; }
    const incompletos = lote.itens.filter(i => ids.includes(i.id) && (!i.colaborador_id || !i.tipo_id || !i.competencia));
    if (incompletos.length) { toast.error(`${incompletos.length} selecionado(s) sem colaborador, tipo ou competência`); return; }
    const cpfErrado = lote.itens.filter(i => ids.includes(i.id) && !cpfConfere(i));
    if (cpfErrado.length) { toast.error(`${cpfErrado.length} com CPF do PDF diferente do colaborador — corrija antes`); return; }
    const alvo = ids.length === 1 ? (lote.itens.find(i => i.id === ids[0])?.colaborador_nome || '1 holerite') : `${ids.length} holerites`;
    if (!window.confirm(`Publicar ${alvo}${enviarWhats ? ' e enviar WhatsApp' : ''}?\n\nVai pra pasta HOLERITES do colaborador e fica disponível no Portal.`)) return;
    setPublicando(true);
    try {
      const r = await api.post(`/rh/holerites/lotes/${lote.id}/publicar`, { item_ids: ids, enviar_whats: enviarWhats }, { timeout: 600000 });
      setResultado(r.data.resultados);
      setLote(r.data.lote);
      setSelecionados(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n; });
      const ok = r.data.resultados.filter(x => x.publicado).length;
      toast.success(`${ok}/${ids.length} publicado(s)`);
      carregarLotes();
    } catch (e) { toast.error(e.response?.data?.error || 'Erro ao publicar'); }
    finally { setPublicando(false); }
  };

  const excluirLote = async (l) => {
    if (!window.confirm(`Excluir o lote "${l.nome_arquivo}"? Os holerites já publicados continuam na pasta dos colaboradores.`)) return;
    try { await api.delete(`/rh/holerites/lotes/${l.id}`); if (lote?.id === l.id) setLote(null); carregarLotes(); toast.success('Lote excluído'); }
    catch (e) { toast.error(e.response?.data?.error || 'Erro'); }
  };

  const pendentes = useMemo(() => (lote?.itens || []).filter(i => i.status === 'pendente'), [lote]);
  const toggleTodos = () => {
    const prontos = pendentes.filter(itemPronto).map(i => i.id);
    setSelecionados(prev => prev.size === prontos.length && prontos.length ? new Set() : new Set(prontos));
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4">
      {/* Coluna esquerda: upload + lotes */}
      <div className="space-y-3">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-bold text-gray-800 mb-1">📥 Importar PDF</h3>
          <p className="text-xs text-gray-500 mb-3">O PDF da contabilidade com todos os holerites. O sistema separa por pessoa usando o CPF impresso.</p>
          <label className="block text-[10px] uppercase text-gray-600 font-semibold mb-1">Empresa / Loja</label>
          <select value={empresaImport} onChange={e => setEmpresaImport(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm mb-3">
            <option value="">— Todas (não filtrar) —</option>
            {empresas.map(e => <option key={e.id} value={e.id}>{labelEmpresa(e)}</option>)}
          </select>
          <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={e => importar(e.target.files?.[0])} />
          <button onClick={() => fileRef.current?.click()} disabled={importando}
            className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm disabled:opacity-60">
            {importando ? '⏳ Lendo e fatiando…' : '📄 Escolher PDF'}
          </button>
        </div>
        <div className="bg-white rounded-lg shadow">
          <div className="px-4 py-2 border-b font-semibold text-sm text-gray-700">Lotes importados</div>
          {lotes.length === 0 && <p className="text-xs text-gray-400 p-4">Nenhum lote ainda.</p>}
          <ul className="max-h-[60vh] overflow-y-auto divide-y">
            {lotes.map(l => (
              <li key={l.id} className={`px-3 py-2 text-xs cursor-pointer hover:bg-purple-50 ${lote?.id === l.id ? 'bg-purple-50' : ''}`} onClick={() => abrirLote(l.id)}>
                <div className="flex justify-between gap-2">
                  <span className="font-semibold text-gray-800 truncate">{l.nome_arquivo}</span>
                  <button onClick={e => { e.stopPropagation(); excluirLote(l); }} className="text-red-500 hover:text-red-700 shrink-0" title="Excluir lote">✕</button>
                </div>
                <div className="text-gray-500 mt-0.5">
                  {fmtData(l.created_at)} · {l.total_itens} holerites · <span className="text-green-700">{l.publicados} publ.</span> · <span className="text-amber-700">{l.pendentes} pend.</span>
                  {l.competencia_sugerida && <> · {fmtComp(l.competencia_sugerida)}</>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Coluna direita: classificação */}
      <div className="bg-white rounded-lg shadow min-h-[40vh]">
        {!lote ? (
          <div className="text-center text-gray-400 py-20">
            <div className="text-5xl mb-2">🗂️</div>
            <p className="text-sm">Importe um PDF ou abra um lote pra classificar.</p>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-gray-800 truncate">{lote.nome_arquivo}</h3>
                <p className="text-xs text-gray-500">{lote.total_paginas} páginas · {lote.itens.length} holerites · {pendentes.length} pendente(s)</p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <label className="text-gray-600">Empresa:</label>
                <select value={lote.company_id || ''} onChange={e => trocarEmpresaLote(e.target.value)} className="border rounded px-2 py-1 max-w-[220px]">
                  <option value="">— Todas —</option>
                  {empresas.map(e => <option key={e.id} value={e.id}>{labelEmpresa(e)}</option>)}
                </select>
              </div>
              {pendentes.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <label className="text-gray-600">Competência p/ todos:</label>
                  <input type="month" defaultValue={lote.competencia_sugerida || compAtual()} className="border rounded px-2 py-1"
                    onBlur={e => e.target.value && e.target.value !== lote.competencia_sugerida && aplicarCompetenciaTodos(e.target.value)} />
                  <label className="text-gray-600 ml-2">Tipo p/ todos:</label>
                  <select className="border rounded px-2 py-1" defaultValue="" onChange={e => { aplicarTipoTodos(e.target.value); e.target.value = ''; }}>
                    <option value="">— escolher —</option>
                    {tipos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-600 uppercase text-[10px]">
                  <tr>
                    <th className="px-2 py-2"><input type="checkbox" onChange={toggleTodos} checked={pendentes.length > 0 && selecionados.size === pendentes.filter(itemPronto).length && selecionados.size > 0} /></th>
                    <th className="px-2 py-2 text-left">Pág.</th>
                    <th className="px-2 py-2 text-left">Lido no PDF</th>
                    <th className="px-2 py-2 text-left">Colaborador</th>
                    <th className="px-2 py-2 text-left">Tipo</th>
                    <th className="px-2 py-2 text-left">Competência</th>
                    <th className="px-2 py-2 text-left">Status</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lote.itens.map(it => {
                    const pub = it.status === 'publicado';
                    const ign = it.status === 'ignorado';
                    const cpfOk = cpfConfere(it);
                    const pronto = itemPronto(it);
                    const opcoes = colaboradores.filter(c => !lote.company_id || !c.company_id || c.company_id === lote.company_id || String(c.id) === String(it.colaborador_id));
                    return (
                      <tr key={it.id} className={pub ? 'bg-green-50/50' : ign ? 'opacity-50' : (!it.colaborador_id || !cpfOk) ? 'bg-red-50/40' : ''}>
                        <td className="px-2 py-2 text-center">
                          {!pub && !ign && <input type="checkbox" disabled={!pronto} checked={selecionados.has(it.id)}
                            onChange={e => setSelecionados(prev => { const n = new Set(prev); e.target.checked ? n.add(it.id) : n.delete(it.id); return n; })} />}
                        </td>
                        <td className="px-2 py-2 text-gray-600 whitespace-nowrap">{(it.paginas || []).join(', ')}</td>
                        <td className="px-2 py-2">
                          <div className="font-semibold text-gray-800">{it.nome_detectado || <span className="text-gray-400 italic">sem nome</span>}</div>
                          <div className="text-gray-500">{fmtCpf(it.cpf_detectado)}{it.matricula_detectada ? ` · nº ${it.matricula_detectada}` : ''}{it.periodo_detectado ? ` · ${it.periodo_detectado}` : ''}</div>
                          <div className="text-gray-400 truncate max-w-[220px]" title={it.titulo_detectado || ''}>{it.titulo_detectado}</div>
                        </td>
                        <td className="px-2 py-2 min-w-[220px]">
                          {pub ? <span className="font-semibold">{it.colaborador_nome}</span> : (
                            <select value={it.colaborador_id || ''} onChange={e => salvarItem(it, { colaborador_id: e.target.value ? Number(e.target.value) : null })}
                              className={`w-full border rounded px-2 py-1 ${(!it.colaborador_id || !cpfOk) ? 'border-red-400' : ''}`}>
                              <option value="">— escolher —</option>
                              {opcoes.map(c => <option key={c.id} value={c.id}>{c.nome}{c.matricula ? ` (${c.matricula})` : ''}</option>)}
                            </select>
                          )}
                          {!cpfOk && !pub && (
                            <div className="mt-1 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                              ⛔ CPF do PDF ({fmtCpf(it.cpf_detectado)}) não é deste colaborador ({fmtCpf(it.colaborador_cpf)}). Escolha a pessoa certa, cadastre-a, ou — se for a mesma pessoa — corrija o CPF dela no Cadastro Geral.
                            </div>
                          )}
                          <div className="mt-1 flex items-center gap-1">
                            <Badge map={CONFIANCA} k={it.confianca} />
                            {it.colaborador_id && !it.colaborador_celular && <span className="text-[10px] text-amber-700" title="Sem celular: publica, mas não envia WhatsApp">📵 sem celular</span>}
                          </div>
                        </td>
                        <td className="px-2 py-2 min-w-[130px]">
                          {pub ? it.tipo_nome : (
                            <select value={it.tipo_id || ''} onChange={e => salvarItem(it, { tipo_id: e.target.value ? Number(e.target.value) : null })} className={`w-full border rounded px-2 py-1 ${!it.tipo_id ? 'border-red-300' : ''}`}>
                              <option value="">— tipo —</option>
                              {tipos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                            </select>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          {pub ? fmtComp(it.competencia) : (
                            <input type="month" value={it.competencia || ''} onChange={e => salvarItem(it, { competencia: e.target.value || null })} className={`border rounded px-2 py-1 ${!it.competencia ? 'border-red-300' : ''}`} />
                          )}
                        </td>
                        <td className="px-2 py-2">
                          {pub ? <span className="text-green-700 font-semibold whitespace-nowrap">✓ Publicado<br /><span className="font-normal text-gray-500">{fmtData(it.publicado_em)}</span></span>
                            : ign ? <span className="text-gray-500">Ignorado</span>
                            : <span className="text-amber-700">Pendente</span>}
                          {it.erro && <div className="text-red-600 max-w-[180px] truncate" title={it.erro}>⚠ {it.erro}</div>}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          {!pub && !ign && (
                            <button onClick={() => publicar([it.id])} disabled={publicando || !pronto}
                              className="mr-2 px-2 py-1 rounded bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-40"
                              title={pronto ? 'Publicar só este' : 'Complete colaborador/tipo/competência (e CPF conferindo)'}>📤 Publicar</button>
                          )}
                          <button onClick={() => preview(it)} className="text-purple-700 hover:underline mr-2" title="Ver PDF">👁</button>
                          {!pub && (ign
                            ? <button onClick={() => salvarItem(it, { status: 'pendente' })} className="text-gray-600 hover:underline">restaurar</button>
                            : <button onClick={() => salvarItem(it, { status: 'ignorado' })} className="text-gray-400 hover:text-red-600" title="Ignorar (não publicar)">ignorar</button>)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {pendentes.length > 0 && (
              <div className="px-4 py-3 border-t flex flex-wrap items-center justify-between gap-3 bg-gray-50">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={enviarWhats} onChange={e => setEnviarWhats(e.target.checked)} />
                  Enviar WhatsApp (link do portal + PDF) ao publicar
                </label>
                <button onClick={() => publicar()} disabled={publicando || selecionados.size === 0}
                  className="px-5 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold text-sm disabled:opacity-50">
                  {publicando ? '⏳ Publicando…' : `📤 Publicar selecionados (${selecionados.size})`}
                </button>
              </div>
            )}

            {resultado && (
              <div className="px-4 py-3 border-t">
                <h4 className="font-semibold text-sm text-gray-800 mb-2">Resultado</h4>
                <ul className="text-xs space-y-1 max-h-60 overflow-y-auto">
                  {resultado.map(r => (
                    <li key={r.item_id} className="flex flex-wrap gap-2 items-center">
                      <span className={r.publicado ? 'text-green-700' : 'text-red-700'}>{r.publicado ? '✓' : '✗'}</span>
                      <span className="font-semibold">{r.nome || `item ${r.item_id}`}</span>
                      <span className="text-gray-500">
                        {r.whats === 'enviado' && '📲 WhatsApp enviado'}
                        {r.whats === 'sem_celular' && '📵 sem celular (publicado, não enviado)'}
                        {r.whats === 'falhou' && '⚠ WhatsApp falhou'}
                        {r.whats === 'nao_enviado' && r.publicado && '— sem envio'}
                      </span>
                      {r.erro && <span className="text-red-600">{r.erro}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ============================ PUBLICAÇÕES ============================ */
function AbaPublicacoes() {
  const [competencia, setCompetencia] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [eventos, setEventos] = useState({});
  const [reenviando, setReenviando] = useState(null);

  const carregar = async () => {
    setLoading(true);
    try { const r = await api.get(`/rh/holerites/publicacoes${competencia ? `?competencia=${competencia}` : ''}`); setRows(r.data || []); }
    catch (e) { toast.error(e.response?.data?.error || 'Erro'); }
    finally { setLoading(false); }
  };
  useEffect(() => { carregar(); }, [competencia]);

  const reenviar = async (r) => {
    setReenviando(r.id);
    try {
      const x = await api.post(`/rh/holerites/publicacoes/${r.id}/reenviar`);
      const w = x.data.whats;
      if (w === 'enviado') toast.success('WhatsApp reenviado');
      else if (w === 'sem_celular') toast.error('Colaborador sem celular cadastrado');
      else toast.error(x.data.erro || 'Falhou');
      carregar();
    } catch (e) { toast.error(e.response?.data?.error || 'Erro'); }
    finally { setReenviando(null); }
  };

  const verEventos = async (r) => {
    if (eventos[r.id]) { setEventos(prev => { const n = { ...prev }; delete n[r.id]; return n; }); return; }
    try { const x = await api.get(`/rh/holerites/publicacoes/${r.id}/eventos`); setEventos(prev => ({ ...prev, [r.id]: x.data })); }
    catch { toast.error('Erro ao carregar trilha'); }
  };

  const copiarLink = async (r) => {
    try {
      const x = await api.post(`/rh/holerites/acessos/${r.colaborador_id}/link`, {});
      await navigator.clipboard.writeText(x.data.link);
      toast.success(x.data.primeiroAcesso ? 'Link de 1º acesso copiado (vale 72h)' : 'Link do portal copiado');
    } catch { toast.error('Erro ao gerar link'); }
  };

  const tot = useMemo(() => ({ total: rows.length, aceito: rows.filter(r => r.status === 'aceito').length, visto: rows.filter(r => r.status === 'visualizado').length, pend: rows.filter(r => r.status === 'pendente').length }), [rows]);

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-4 py-3 border-b flex flex-wrap items-center gap-3">
        <label className="text-xs text-gray-600">Competência</label>
        <input type="month" value={competencia} onChange={e => setCompetencia(e.target.value)} className="border rounded px-2 py-1 text-sm" />
        {competencia && <button onClick={() => setCompetencia('')} className="text-xs text-gray-500 hover:underline">todas</button>}
        <div className="ml-auto flex gap-3 text-xs">
          <span className="text-gray-600">Total <b>{tot.total}</b></span>
          <span className="text-green-700">Ciente <b>{tot.aceito}</b></span>
          <span className="text-blue-700">Visto <b>{tot.visto}</b></span>
          <span className="text-amber-700">Pendente <b>{tot.pend}</b></span>
        </div>
      </div>
      {loading && <p className="text-center text-gray-400 py-10 text-sm">Carregando…</p>}
      {!loading && rows.length === 0 && <p className="text-center text-gray-400 py-10 text-sm">Nenhuma publicação.</p>}
      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-600 uppercase text-[10px]">
              <tr>
                <th className="px-3 py-2 text-left">Colaborador</th>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-left">Comp.</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Enviado</th>
                <th className="px-3 py-2 text-left">Visto</th>
                <th className="px-3 py-2 text-left">Ciência</th>
                <th className="px-3 py-2 text-left">Acesso</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(r => (
                <FragmentRow key={r.id} r={r} eventos={eventos[r.id]} onEventos={() => verEventos(r)} onReenviar={() => reenviar(r)} onLink={() => copiarLink(r)} reenviando={reenviando === r.id} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FragmentRow({ r, eventos, onEventos, onReenviar, onLink, reenviando }) {
  const abrirComprovante = async (row) => {
    try {
      const x = await api.get(`/rh/holerites/publicacoes/${row.id}/comprovante`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([x.data], { type: 'application/pdf' }));
      window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { toast.error('Erro ao gerar comprovante'); }
  };
  return (
    <>
      <tr>
        <td className="px-3 py-2"><div className="font-semibold text-gray-800">{r.nome}</div><div className="text-gray-500">{r.matricula ? `nº ${r.matricula} · ` : ''}{r.celular || <span className="text-amber-700">📵 sem celular</span>}</div></td>
        <td className="px-3 py-2">{r.tipo_nome || 'PAGAMENTO'}</td>
        <td className="px-3 py-2 whitespace-nowrap">{fmtComp(r.competencia)}</td>
        <td className="px-3 py-2"><Badge map={STATUS_PUB} k={r.status} /></td>
        <td className="px-3 py-2 whitespace-nowrap">{r.enviado_em ? `${fmtData(r.enviado_em)}` : <span className="text-gray-400">não enviado</span>}</td>
        <td className="px-3 py-2 whitespace-nowrap">{fmtData(r.visualizado_em)}</td>
        <td className="px-3 py-2 whitespace-nowrap">{r.aceito_em ? <>{fmtData(r.aceito_em)}<div className="text-gray-400">{r.aceite_ip}{r.aceite_metodo === 'cpf_senha_otp_whatsapp' ? ' · 🔐 código WhatsApp' : r.aceite_metodo ? ' · só senha' : ''}</div></> : '—'}</td>
        <td className="px-3 py-2 whitespace-nowrap">{r.tem_senha ? <span className="text-green-700">senha criada</span> : r.setup_pendente ? <span className="text-amber-700">1º acesso pendente</span> : <span className="text-gray-400">sem acesso</span>}</td>
        <td className="px-3 py-2 whitespace-nowrap">
          <button onClick={onReenviar} disabled={reenviando} className="text-purple-700 hover:underline mr-2 disabled:opacity-50">{reenviando ? '…' : '📲 reenviar'}</button>
          <button onClick={onLink} className="text-gray-600 hover:underline mr-2" title="Copiar link de acesso">🔗 link</button>
          {r.status === 'aceito' && <button onClick={() => abrirComprovante(r)} className="text-green-700 hover:underline mr-2" title="Holerite + página do comprovante de ciência">📄 comprovante</button>}
          <button onClick={onEventos} className="text-gray-500 hover:underline" title="Trilha de auditoria">{eventos ? '▲' : '▼'} trilha</button>
        </td>
      </tr>
      {eventos && (
        <tr className="bg-gray-50">
          <td colSpan={9} className="px-4 py-2">
            <div className="text-[10px] text-gray-500 mb-1">SHA-256: <code>{r.hash_sha256}</code>{r.publicado_por ? ` · publicado por ${r.publicado_por}` : ''}</div>
            <ul className="text-xs space-y-0.5">
              {eventos.map((e, i) => <li key={i}><span className="text-gray-500">{fmtData(e.created_at)}</span> · <b>{e.evento}</b>{e.ip ? ` · ${e.ip}` : ''}{e.detalhe ? ` · ${e.detalhe}` : ''}{e.user_agent ? <span className="text-gray-400"> · {e.user_agent.slice(0, 60)}</span> : null}</li>)}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}

/* ============================ ACESSOS ============================ */
function AbaAcessos() {
  const [rows, setRows] = useState([]);
  const [busca, setBusca] = useState('');
  const carregar = async () => { try { const r = await api.get('/rh/holerites/acessos'); setRows(r.data || []); } catch { /* noop */ } };
  useEffect(() => { carregar(); }, []);

  // Desligado continua acessando por N dias após o desligamento (padrão 150 = 5 meses)
  const [diasDesligado, setDiasDesligado] = useState('150');
  useEffect(() => {
    api.get('/configurations/portal_dias_acesso_desligado').then(r => { if (r?.data?.value) setDiasDesligado(String(r.data.value)); }).catch(() => {});
  }, []);
  const salvarDias = async () => {
    const n = Math.max(0, parseInt(diasDesligado, 10) || 0);
    try { await api.put('/configurations/portal_dias_acesso_desligado', { value: String(n) }); setDiasDesligado(String(n)); toast.success(n ? `Desligados acessam por ${n} dias` : 'Desligados perdem o acesso na hora'); carregar(); }
    catch { toast.error('Erro ao salvar'); }
  };
  const bloquear = async (r, bloquear) => {
    if (bloquear && !window.confirm(`Bloquear o acesso de ${r.nome} ao portal? Ele perde o acesso na hora.`)) return;
    try { await api.post(`/rh/holerites/acessos/${r.colaborador_id}/bloquear`, { bloquear }); toast.success(bloquear ? 'Acesso bloqueado' : 'Acesso liberado'); carregar(); }
    catch { toast.error('Erro'); }
  };

  const [linkModal, setLinkModal] = useState(null); // { r, link, primeiroAcesso }
  const [enviando, setEnviando] = useState(false);

  const gerar = async (r, resetar) => {
    if (resetar && !window.confirm(`Gerar um NOVO link de primeiro acesso pra ${r.nome}? A senha atual continua valendo até ele criar outra.`)) return;
    try {
      const x = await api.post(`/rh/holerites/acessos/${r.colaborador_id}/link`, { resetar });
      setLinkModal({ r, link: x.data.link, primeiroAcesso: x.data.primeiroAcesso });
      carregar();
    } catch { toast.error('Erro ao gerar link'); }
  };

  const copiar = async (texto) => {
    try { await navigator.clipboard.writeText(texto); toast.success('Link copiado'); }
    catch { toast.error('Não consegui copiar — selecione o link e copie manualmente'); }
  };

  const enviarWhats = async () => {
    if (!linkModal) return;
    setEnviando(true);
    try {
      const x = await api.post(`/rh/holerites/acessos/${linkModal.r.colaborador_id}/enviar-link`, {});
      if (x.data.whats === 'enviado') toast.success(`WhatsApp enviado pra ${linkModal.r.celular}`);
      else if (x.data.whats === 'sem_celular') toast.error('Colaborador sem celular cadastrado');
      else toast.error(x.data.erro || 'Falhou ao enviar');
    } catch (e) { toast.error(e.response?.data?.error || 'Erro ao enviar'); }
    finally { setEnviando(false); }
  };

  const lista = rows.filter(r => !busca || r.nome.toLowerCase().includes(busca.toLowerCase()));
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-4 py-3 border-b flex flex-wrap items-center gap-3">
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar colaborador…" className="border rounded px-3 py-1.5 text-sm w-64" />
        <p className="text-xs text-gray-500 flex-1">Link de 1º acesso: o colaborador confirma o CPF e cria a senha. O link também vai automaticamente no WhatsApp da 1ª publicação.</p>
        <div className="flex items-center gap-2 text-xs bg-gray-50 border rounded-lg px-3 py-1.5">
          <span className="text-gray-600">Desligados acessam por</span>
          <input type="number" min="0" value={diasDesligado} onChange={e => setDiasDesligado(e.target.value)} onBlur={salvarDias}
            onKeyDown={e => e.key === 'Enter' && e.target.blur()} className="w-16 border rounded px-2 py-1 text-right" />
          <span className="text-gray-600">dias após o desligamento</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-gray-600 uppercase text-[10px]"><tr>
            <th className="px-3 py-2 text-left">Colaborador</th><th className="px-3 py-2 text-left">Celular</th><th className="px-3 py-2 text-left">Acesso</th><th className="px-3 py-2 text-left">Último login</th><th className="px-3 py-2"></th>
          </tr></thead>
          <tbody className="divide-y">
            {lista.map(r => (
              <tr key={r.colaborador_id}>
                <td className="px-3 py-2 font-semibold text-gray-800">{r.nome}{r.matricula ? <span className="font-normal text-gray-500"> · nº {r.matricula}</span> : null}
                  {r.status !== 'ativo' && <div className="font-normal text-[11px] text-amber-700">desligado em {r.data_desligamento ? new Date(r.data_desligamento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'} · acessa até {r.acesso_ate ? new Date(r.acesso_ate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'}</div>}
                </td>
                <td className="px-3 py-2">{r.celular || <span className="text-amber-700">📵 sem celular</span>}</td>
                <td className="px-3 py-2">{r.tem_senha ? <span className="text-green-700">✓ senha criada</span> : r.setup_pendente ? <span className="text-amber-700">1º acesso pendente</span> : <span className="text-gray-400">sem acesso</span>}{r.bloqueado_ate && new Date(r.bloqueado_ate) > new Date() && <span className="text-red-600 ml-1">(senha errada 5x)</span>}{r.ativo === false && <span className="ml-1 font-bold text-red-700">⛔ bloqueado pelo RH</span>}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fmtData(r.ultimo_login)}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {r.tem_senha
                    ? <button onClick={() => gerar(r, true)} className="text-purple-700 hover:underline">🔁 novo link (reset)</button>
                    : <button onClick={() => gerar(r, false)} className="text-purple-700 hover:underline">🔗 gerar link 1º acesso</button>}
                  {r.ativo === false
                    ? <button onClick={() => bloquear(r, false)} className="ml-3 text-green-700 hover:underline">✅ liberar</button>
                    : <button onClick={() => bloquear(r, true)} className="ml-3 text-red-600 hover:underline">⛔ bloquear</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {linkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setLinkModal(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b">
              <h3 className="font-bold text-gray-800">🔗 {linkModal.primeiroAcesso ? 'Link de 1º acesso' : 'Link do portal'}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{linkModal.r.nome}{linkModal.r.celular ? ` · ${linkModal.r.celular}` : ' · 📵 sem celular'}</p>
            </div>
            <div className="p-4 space-y-3">
              <input readOnly value={linkModal.link} onFocus={e => e.target.select()}
                className="w-full border rounded px-3 py-2 text-xs font-mono bg-gray-50" />
              <p className="text-xs text-gray-600">
                {linkModal.primeiroAcesso
                  ? 'Vale 72 h. O colaborador abre, confirma o CPF e cria a senha. Depois entra sempre em /portal com CPF e senha.'
                  : 'Esse colaborador já tem senha — este é o link fixo do portal.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => copiar(linkModal.link)} className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200 text-sm font-semibold">📋 Copiar</button>
                <a href={linkModal.link} target="_blank" rel="noreferrer" className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200 text-sm font-semibold">↗ Abrir</a>
                <button onClick={enviarWhats} disabled={enviando || !linkModal.r.celular}
                  className="px-3 py-2 rounded bg-green-600 hover:bg-green-700 text-white text-sm font-bold disabled:opacity-40"
                  title={linkModal.r.celular ? 'Manda só o link no WhatsApp do colaborador' : 'Cadastre o celular primeiro'}>
                  {enviando ? '…' : '📲 Enviar no WhatsApp'}
                </button>
                <button onClick={() => setLinkModal(null)} className="ml-auto px-3 py-2 text-sm text-gray-500 hover:underline">Fechar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
