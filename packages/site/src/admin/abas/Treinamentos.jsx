import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { api } from '../api';

/**
 * Gerencia os vídeos que aparecem em kontrataai.com.br/treinamento.
 * Antes eles eram fixos no código: publicar um vídeo novo exigia deploy.
 */
export default function Treinamentos() {
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(null);

  const carregar = async () => {
    setCarregando(true);
    try { setLista(await api.get('/treinamentos')); }
    catch { setLista([]); } finally { setCarregando(false); }
  };

  useEffect(() => { carregar(); }, []);

  const alternar = async (v) => {
    await api.put(`/treinamentos/${v.id}`, { ...v, ativo: !v.ativo });
    carregar();
  };

  const excluir = async (v) => {
    if (!window.confirm(`Excluir "${v.titulo}"?`)) return;
    await api.del(`/treinamentos/${v.id}`);
    carregar();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-border-light">
      <div className="p-4 border-b border-border-light flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display font-bold text-text-dark text-lg">Treinamentos</h2>
          <p className="text-xs text-text-gray">
            Vídeos da página{' '}
            <a href="/treinamento" target="_blank" rel="noopener noreferrer"
              className="text-purple-800 hover:underline inline-flex items-center gap-1">
              /treinamento <ExternalLink className="w-3 h-3" />
            </a>
            . O que você salvar aqui aparece lá na hora.
          </p>
        </div>
        <button onClick={() => setEditando({ ativo: true, ordem: lista.length + 1 })}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-800 text-white text-sm font-semibold hover:bg-purple-600 transition-colors">
          <Plus className="w-4 h-4" /> Novo vídeo
        </button>
      </div>

      {carregando ? (
        <p className="p-8 text-center text-text-gray text-sm">Carregando…</p>
      ) : !lista.length ? (
        <p className="p-8 text-center text-text-gray text-sm">Nenhum vídeo cadastrado.</p>
      ) : (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lista.map((v) => (
            <div key={v.id}
              className={`rounded-xl border overflow-hidden ${v.ativo ? 'border-border-light' : 'border-gray-200 opacity-60'}`}>
              <div className="relative aspect-video bg-purple-100">
                <img src={`https://img.youtube.com/vi/${v.youtube_id}/hqdefault.jpg`}
                  alt={v.titulo} className="absolute inset-0 w-full h-full object-cover" />
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/70 text-white text-[10px] font-bold">
                  {v.ordem}
                </span>
                {!v.ativo && (
                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-gray-800 text-white text-[10px] font-bold">
                    OCULTO
                  </span>
                )}
              </div>
              <div className="p-3">
                <h3 className="font-display font-semibold text-text-dark text-sm">{v.titulo}</h3>
                <p className="text-text-gray text-xs mt-0.5 leading-relaxed">{v.descricao}</p>
                <div className="flex gap-1 mt-3">
                  <button onClick={() => alternar(v)}
                    className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
                    title={v.ativo ? 'Ocultar do site' : 'Mostrar no site'}>
                    {v.ativo ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button onClick={() => setEditando(v)}
                    className="p-1.5 rounded hover:bg-purple-100 text-purple-800" title="Editar">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => excluir(v)}
                    className="p-1.5 rounded hover:bg-red-100 text-red-600" title="Excluir">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editando && (
        <FormVideo registro={editando} aoFechar={() => setEditando(null)}
          aoSalvar={() => { setEditando(null); carregar(); }} />
      )}
    </div>
  );
}

/** Aceita link inteiro do YouTube e extrai o ID — ninguém decora esse código. */
function extrairId(texto) {
  const t = String(texto || '').trim();
  const padroes = [
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /embed\/([A-Za-z0-9_-]{11})/,
  ];
  for (const p of padroes) {
    const m = t.match(p);
    if (m) return m[1];
  }
  return t; // já é o ID
}

function FormVideo({ registro, aoFechar, aoSalvar }) {
  const [f, setF] = useState(registro);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const salvar = async () => {
    const id = extrairId(f.youtube_id);
    if (!f.titulo?.trim()) return setErro('Informe o título.');
    if (!id) return setErro('Informe o link ou o ID do vídeo.');
    setSalvando(true);
    setErro('');
    try {
      const dados = { ...f, youtube_id: id, ordem: Number(f.ordem) || 0 };
      if (f.id) await api.put(`/treinamentos/${f.id}`, dados);
      else await api.post('/treinamentos', dados);
      aoSalvar();
    } catch (err) { setErro(err.message); setSalvando(false); }
  };

  const campo = 'w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-600';
  const rotulo = 'block text-xs font-semibold text-gray-600 mb-1';
  const previa = extrairId(f.youtube_id);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={aoFechar}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="bg-purple-800 text-white px-5 py-3 rounded-t-xl">
          <h3 className="font-display font-bold text-lg">{f.id ? 'Editar' : 'Novo'} vídeo</h3>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className={rotulo}>Título *</label>
            <input value={f.titulo || ''} onChange={(e) => setF({ ...f, titulo: e.target.value })}
              placeholder="Módulo 05 – Vídeo 01" className={campo} />
          </div>
          <div>
            <label className={rotulo}>Descrição</label>
            <input value={f.descricao || ''} onChange={(e) => setF({ ...f, descricao: e.target.value })}
              className={campo} />
          </div>
          <div>
            <label className={rotulo}>Link ou ID do YouTube *</label>
            <input value={f.youtube_id || ''} onChange={(e) => setF({ ...f, youtube_id: e.target.value })}
              placeholder="Cole o link do vídeo" className={campo} />
            {previa && previa.length === 11 && (
              <img src={`https://img.youtube.com/vi/${previa}/mqdefault.jpg`} alt=""
                className="mt-2 rounded-lg w-40" />
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={rotulo}>Ordem</label>
              <input type="number" value={f.ordem ?? 0}
                onChange={(e) => setF({ ...f, ordem: e.target.value })} className={campo} />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={!!f.ativo}
                  onChange={(e) => setF({ ...f, ativo: e.target.checked })}
                  className="w-4 h-4 accent-purple-600" />
                Visível no site
              </label>
            </div>
          </div>

          {erro && (
            <p className="text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs">{erro}</p>
          )}
        </div>

        <div className="border-t px-5 py-3 flex justify-end gap-2">
          <button onClick={aoFechar} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-semibold">
            Cancelar
          </button>
          <button onClick={salvar} disabled={salvando}
            className="px-6 py-2 bg-purple-800 hover:bg-purple-600 text-white rounded-lg text-sm font-bold disabled:opacity-60">
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
