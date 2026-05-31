import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../utils/api';

// "Vault" do Agente de Escala - notas markdown estilo Obsidian.
// O agente IA do modulo de Escala consulta automaticamente essas notas
// antes de responder, entao tudo que voce salvar aqui ele "lembra".

const TIPOS = [
  { key: 'colaborador', label: 'Colaboradores', icon: '👤', cor: 'indigo' },
  { key: 'setor',       label: 'Setores',       icon: '🏪', cor: 'amber' },
  { key: 'regra',       label: 'Regras',        icon: '📋', cor: 'emerald' },
  { key: 'padrao',      label: 'Padrões',       icon: '🎯', cor: 'purple' },
  { key: 'outro',       label: 'Outros',        icon: '📝', cor: 'gray' },
];

function slugify(s) {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
}

// Renderizador markdown bem simples (cabecalhos, negrito, italico,
// listas, codigo inline, [[backlinks]], [text](url))
function renderMd(md, onLink) {
  if (!md) return null;
  const linhas = md.split('\n');
  const out = [];
  let listaAtual = null;
  const flush = () => {
    if (listaAtual) {
      out.push(<ul key={`l${out.length}`} className="list-disc ml-6 my-2 space-y-1">{listaAtual}</ul>);
      listaAtual = null;
    }
  };
  const inlines = (texto, keyBase) => {
    const partes = [];
    let s = texto;
    // [[slug|alias]] ou [[slug]]
    s = s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (m, ref, alias) => {
      partes.push({ tipo: 'wikilink', ref: ref.trim(), alias: (alias || ref).trim() });
      return `__P${partes.length - 1}__`;
    });
    // [text](url)
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, txt, url) => {
      partes.push({ tipo: 'link', txt, url });
      return `__P${partes.length - 1}__`;
    });
    // codigo inline
    s = s.replace(/`([^`]+)`/g, (m, c) => {
      partes.push({ tipo: 'code', txt: c });
      return `__P${partes.length - 1}__`;
    });
    // bold ** **
    s = s.replace(/\*\*([^*]+)\*\*/g, (m, t) => {
      partes.push({ tipo: 'bold', txt: t });
      return `__P${partes.length - 1}__`;
    });
    // italico * *
    s = s.replace(/\*([^*]+)\*/g, (m, t) => {
      partes.push({ tipo: 'italic', txt: t });
      return `__P${partes.length - 1}__`;
    });
    const tokens = s.split(/(__P\d+__)/g);
    return tokens.map((tk, i) => {
      const m = tk.match(/^__P(\d+)__$/);
      if (m) {
        const p = partes[parseInt(m[1])];
        if (p.tipo === 'wikilink') return (
          <button key={`${keyBase}-${i}`} onClick={() => onLink?.(p.ref)} className="text-purple-700 underline decoration-dotted hover:bg-purple-50 px-0.5 rounded">{p.alias}</button>
        );
        if (p.tipo === 'link') return (
          <a key={`${keyBase}-${i}`} href={p.url} target="_blank" rel="noreferrer" className="text-blue-600 underline">{p.txt}</a>
        );
        if (p.tipo === 'code') return <code key={`${keyBase}-${i}`} className="bg-gray-100 px-1 rounded text-pink-700 text-[0.85em]">{p.txt}</code>;
        if (p.tipo === 'bold') return <strong key={`${keyBase}-${i}`}>{p.txt}</strong>;
        if (p.tipo === 'italic') return <em key={`${keyBase}-${i}`}>{p.txt}</em>;
      }
      return <span key={`${keyBase}-${i}`}>{tk}</span>;
    });
  };

  linhas.forEach((ln, idx) => {
    const key = `ln${idx}`;
    if (/^###\s+/.test(ln)) { flush(); out.push(<h3 key={key} className="text-base font-bold mt-4 mb-1 text-gray-800">{inlines(ln.replace(/^###\s+/, ''), key)}</h3>); return; }
    if (/^##\s+/.test(ln))  { flush(); out.push(<h2 key={key} className="text-lg font-bold mt-5 mb-2 text-gray-800 border-b pb-1">{inlines(ln.replace(/^##\s+/, ''), key)}</h2>); return; }
    if (/^#\s+/.test(ln))   { flush(); out.push(<h1 key={key} className="text-xl font-bold mt-6 mb-2 text-gray-900">{inlines(ln.replace(/^#\s+/, ''), key)}</h1>); return; }
    if (/^\s*[-*]\s+/.test(ln)) {
      const item = ln.replace(/^\s*[-*]\s+/, '');
      const li = <li key={key}>{inlines(item, key)}</li>;
      if (!listaAtual) listaAtual = [];
      listaAtual.push(li);
      return;
    }
    flush();
    if (ln.trim() === '') { out.push(<div key={key} className="h-2" />); return; }
    out.push(<p key={key} className="text-sm text-gray-700 leading-relaxed my-1">{inlines(ln, key)}</p>);
  });
  flush();
  return out;
}

export default function RhEscalaMemoria() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [empresas, setEmpresas] = useState([]);
  const [empresaId, setEmpresaId] = useState(localStorage.getItem('escalaEmpresaId') || '');
  const [notas, setNotas] = useState([]);
  const [busca, setBusca] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [selecionada, setSelecionada] = useState(null);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({ titulo: '', tipo: 'outro', tags: '', conteudo: '' });
  const [novoModal, setNovoModal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/rh/empresas').then(r => {
      const arr = Array.isArray(r.data) ? r.data : (r.data?.data || []);
      setEmpresas(arr);
      if (!empresaId && arr.length) setEmpresaId(String(arr[0].id));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (empresaId) localStorage.setItem('escalaEmpresaId', empresaId);
  }, [empresaId]);

  const carregarLista = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (empresaId) params.set('empresaId', empresaId);
      if (tipoFiltro) params.set('tipo', tipoFiltro);
      if (busca) params.set('q', busca);
      const { data } = await api.get(`/rh/escala/memoria?${params}`);
      setNotas(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (empresaId) carregarLista(); }, [empresaId, tipoFiltro]);

  // Debounce busca
  useEffect(() => {
    const t = setTimeout(() => { if (empresaId) carregarLista(); }, 300);
    return () => clearTimeout(t);
  }, [busca]);

  // Carrega slug da URL se houver
  useEffect(() => {
    const slug = searchParams.get('slug');
    if (slug && empresaId) abrirPorSlug(slug);
  }, [searchParams, empresaId]);

  const abrirPorSlug = async (slug) => {
    try {
      const { data } = await api.get(`/rh/escala/memoria/${slug}?empresaId=${empresaId}`);
      setSelecionada(data);
      setEditando(false);
      setSearchParams({ slug });
    } catch (e) {
      console.error(e);
    }
  };

  const abrirNota = (n) => abrirPorSlug(n.slug);

  const novaNota = (tipo = 'outro') => {
    setForm({ titulo: '', tipo, tags: '', conteudo: '' });
    setNovoModal(true);
  };

  const salvarNova = async () => {
    if (!form.titulo.trim()) { alert('Titulo obrigatorio'); return; }
    try {
      const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
      const { data } = await api.post('/rh/escala/memoria', {
        empresaId: empresaId || null,
        titulo: form.titulo,
        tipo: form.tipo,
        tags,
        conteudo: form.conteudo,
      });
      setNovoModal(false);
      await carregarLista();
      abrirPorSlug(data.slug);
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    }
  };

  const iniciarEdicao = () => {
    if (!selecionada) return;
    setForm({
      titulo: selecionada.titulo,
      tipo: selecionada.tipo,
      tags: (selecionada.tags || []).join(', '),
      conteudo: selecionada.conteudo || '',
    });
    setEditando(true);
  };

  const salvarEdicao = async () => {
    if (!selecionada) return;
    try {
      const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
      await api.put(`/rh/escala/memoria/${selecionada.id}`, {
        titulo: form.titulo,
        tipo: form.tipo,
        tags,
        conteudo: form.conteudo,
      });
      setEditando(false);
      await carregarLista();
      abrirPorSlug(selecionada.slug);
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    }
  };

  const excluir = async () => {
    if (!selecionada) return;
    if (!window.confirm(`Excluir a nota "${selecionada.titulo}"?`)) return;
    try {
      await api.delete(`/rh/escala/memoria/${selecionada.id}`);
      setSelecionada(null);
      setSearchParams({});
      await carregarLista();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    }
  };

  const agrupadas = useMemo(() => {
    const map = {};
    TIPOS.forEach(t => { map[t.key] = []; });
    notas.forEach(n => {
      if (!map[n.tipo]) map[n.tipo] = [];
      map[n.tipo].push(n);
    });
    return map;
  }, [notas]);

  return (
    <div className="h-[calc(100vh-64px)] flex bg-gray-50">
      {/* ===== Lateral Esquerda - Arvore ===== */}
      <div className="w-72 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-3 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
              <span>🧠</span> Vault do Agente
            </h2>
            <button
              onClick={() => novaNota('outro')}
              className="text-xs px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              + Nova
            </button>
          </div>
          <select
            value={empresaId}
            onChange={(e) => setEmpresaId(e.target.value)}
            className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 mb-2"
          >
            <option value="">(Notas globais)</option>
            {empresas.map(e => (
              <option key={e.id} value={e.id}>{e.razaoSocial || e.razao_social || e.nome}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="🔍 Buscar nota..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full text-xs border border-gray-300 rounded px-2 py-1.5"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {TIPOS.map(t => {
            const lista = agrupadas[t.key] || [];
            if (lista.length === 0 && tipoFiltro && tipoFiltro !== t.key) return null;
            return (
              <div key={t.key}>
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    {t.icon} {t.label} <span className="text-gray-400">({lista.length})</span>
                  </span>
                  <button
                    onClick={() => novaNota(t.key)}
                    className="text-gray-400 hover:text-purple-600 text-xs"
                    title={`Nova nota em ${t.label}`}
                  >
                    +
                  </button>
                </div>
                {lista.length === 0 && (
                  <div className="text-[11px] text-gray-400 italic px-3 py-1">Vazio</div>
                )}
                {lista.map(n => (
                  <button
                    key={n.id}
                    onClick={() => abrirNota(n)}
                    className={`w-full text-left px-3 py-1.5 text-xs rounded transition ${
                      selecionada?.slug === n.slug ? 'bg-purple-100 text-purple-900 font-semibold' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {n.titulo}
                  </button>
                ))}
              </div>
            );
          })}
          {loading && <div className="text-center text-xs text-gray-400 py-4">Carregando...</div>}
        </div>
      </div>

      {/* ===== Centro - Nota Aberta ===== */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selecionada && !editando && (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <div className="text-6xl mb-3">🧠</div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Vault do Agente de Escala</h3>
              <p className="text-sm text-gray-500 max-w-md">
                Aqui ficam as "memórias" do agente IA. Tudo que você salvar (sobre colaboradores, setores, regras ou padrões) ele consulta antes de responder no chat.
              </p>
              <p className="text-xs text-gray-400 mt-3">
                Selecione uma nota à esquerda ou clique em <span className="font-semibold">+ Nova</span> para começar.
              </p>
            </div>
          </div>
        )}

        {selecionada && (
          <>
            <div className="border-b border-gray-200 bg-white px-6 py-3 flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-gray-400">
                  {TIPOS.find(t => t.key === selecionada.tipo)?.icon} {TIPOS.find(t => t.key === selecionada.tipo)?.label || selecionada.tipo}
                </div>
                <h1 className="text-xl font-bold text-gray-800">{selecionada.titulo}</h1>
                <div className="flex items-center gap-2 mt-1">
                  {(selecionada.tags || []).map(tg => (
                    <span key={tg} className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded">#{tg}</span>
                  ))}
                  <span className="text-[11px] text-gray-400">
                    atualizado {new Date(selecionada.atualizado_em).toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!editando ? (
                  <>
                    <button onClick={iniciarEdicao} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">✏️ Editar</button>
                    <button onClick={excluir} className="px-3 py-1.5 text-xs bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100">🗑️ Excluir</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setEditando(false)} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                    <button onClick={salvarEdicao} className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700">💾 Salvar</button>
                  </>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {!editando ? (
                <div className="max-w-3xl">
                  {renderMd(selecionada.conteudo, (ref) => abrirPorSlug(ref))}
                  {!selecionada.conteudo && (
                    <p className="text-sm text-gray-400 italic">Esta nota ainda está vazia. Clique em Editar.</p>
                  )}

                  {selecionada.backlinks?.length > 0 && (
                    <div className="mt-10 pt-4 border-t border-gray-200">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">🔗 Referenciada em</h3>
                      <div className="space-y-1">
                        {selecionada.backlinks.map(b => (
                          <button
                            key={b.slug}
                            onClick={() => abrirPorSlug(b.slug)}
                            className="block text-sm text-purple-700 hover:underline"
                          >
                            {TIPOS.find(t => t.key === b.tipo)?.icon || '📄'} {b.titulo}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="max-w-3xl space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Título</label>
                      <input
                        type="text"
                        value={form.titulo}
                        onChange={(e) => setForm(f => ({ ...f, titulo: e.target.value }))}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo</label>
                      <select
                        value={form.tipo}
                        onChange={(e) => setForm(f => ({ ...f, tipo: e.target.value }))}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                      >
                        {TIPOS.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Tags (separadas por vírgula)</label>
                    <input
                      type="text"
                      value={form.tags}
                      onChange={(e) => setForm(f => ({ ...f, tags: e.target.value }))}
                      placeholder="ex: religioso, restricao, fixo"
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Conteúdo (markdown)</label>
                    <p className="text-[11px] text-gray-400 mb-1">
                      Use <code className="bg-gray-100 px-1">[[outra-nota]]</code> pra linkar, <code className="bg-gray-100 px-1">**negrito**</code>, <code className="bg-gray-100 px-1"># título</code>, <code className="bg-gray-100 px-1">- item</code>
                    </p>
                    <textarea
                      value={form.conteudo}
                      onChange={(e) => setForm(f => ({ ...f, conteudo: e.target.value }))}
                      rows={20}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono leading-relaxed"
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ===== Modal Nova Nota ===== */}
      {novoModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg">
            <h3 className="text-lg font-bold text-gray-800 mb-4">✨ Nova nota no Vault</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Título</label>
                <input
                  type="text"
                  value={form.titulo}
                  onChange={(e) => setForm(f => ({ ...f, titulo: e.target.value }))}
                  autoFocus
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                />
                {form.titulo && <p className="text-[10px] text-gray-400 mt-1">Slug: <code>{slugify(form.titulo)}</code></p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo</label>
                <select
                  value={form.tipo}
                  onChange={(e) => setForm(f => ({ ...f, tipo: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                >
                  {TIPOS.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Tags (opcional)</label>
                <input
                  type="text"
                  value={form.tags}
                  onChange={(e) => setForm(f => ({ ...f, tags: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Conteúdo inicial (opcional)</label>
                <textarea
                  value={form.conteudo}
                  onChange={(e) => setForm(f => ({ ...f, conteudo: e.target.value }))}
                  rows={6}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setNovoModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
              <button onClick={salvarNova} className="px-4 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700">Criar nota</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
