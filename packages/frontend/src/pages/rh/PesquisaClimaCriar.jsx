import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Sidebar from '../../components/Sidebar';
import { api } from '../../utils/api';
import toast from 'react-hot-toast';

const CORES = [
  { id: 'orange', label: 'Laranja', bg: 'bg-orange-500' },
  { id: 'rose', label: 'Rosa', bg: 'bg-rose-500' },
  { id: 'pink', label: 'Pink', bg: 'bg-pink-500' },
  { id: 'red', label: 'Vermelho', bg: 'bg-red-500' },
  { id: 'amber', label: 'Âmbar', bg: 'bg-amber-500' },
  { id: 'yellow', label: 'Amarelo', bg: 'bg-yellow-400' },
  { id: 'emerald', label: 'Verde', bg: 'bg-emerald-500' },
  { id: 'teal', label: 'Teal', bg: 'bg-teal-500' },
  { id: 'cyan', label: 'Ciano', bg: 'bg-cyan-500' },
  { id: 'blue', label: 'Azul', bg: 'bg-blue-500' },
  { id: 'indigo', label: 'Índigo', bg: 'bg-indigo-500' },
  { id: 'purple', label: 'Roxo', bg: 'bg-purple-500' },
  { id: 'fuchsia', label: 'Fúcsia', bg: 'bg-fuchsia-500' },
  { id: 'gray', label: 'Cinza', bg: 'bg-gray-500' },
];

const TIPOS = [
  { id: 'rating_5_matriz', label: '⭐ Matriz 1-5 (vários critérios)', desc: 'Tabela com X critérios avaliados de 1 a 5 estrelas' },
  { id: 'nps_0_10', label: '🎯 NPS 0-10', desc: 'Barra de 0 a 10 (recomendaria? satisfação?)' },
  { id: 'multipla_escolha', label: '🔘 Múltipla escolha', desc: 'Uma opção dentre várias' },
  { id: 'checkbox', label: '☑️ Checkbox', desc: 'Várias opções marcáveis' },
  { id: 'sim_nao', label: '🟢 Sim / Não', desc: 'Sim ou Não' },
  { id: 'texto_curto', label: '💬 Texto curto', desc: '1 linha' },
  { id: 'texto_longo', label: '📝 Texto longo', desc: 'Várias linhas' },
];

export default function PesquisaClimaCriar() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [modelos, setModelos] = useState([]);
  const [edit, setEdit] = useState(null); // null | { id, nome, perguntas }
  const [criandoNovo, setCriandoNovo] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoIcone, setNovoIcone] = useState('📋');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { carregar(); }, []);

  const carregar = async () => {
    try {
      const r = await api.get('/pesquisa-clima/modelos');
      setModelos(Array.isArray(r.data) ? r.data : []);
    } catch { toast.error('Erro ao carregar pesquisas'); }
  };

  const abrirEdicao = async (id) => {
    try {
      const r = await api.get(`/pesquisa-clima/modelos/${id}`);
      setEdit(r.data);
    } catch { toast.error('Erro ao abrir pesquisa'); }
  };

  const criarModelo = async () => {
    if (!novoNome.trim()) { toast.error('Informe o nome da pesquisa'); return; }
    try {
      const r = await api.post('/pesquisa-clima/modelos', {
        nome: novoNome.trim(),
        icone: novoIcone || '📋'
      });
      setNovoNome(''); setNovoIcone('📋'); setCriandoNovo(false);
      await carregar();
      abrirEdicao(r.data.id);
      toast.success('Pesquisa criada!');
    } catch (e) {
      console.error('Erro ao criar pesquisa:', e);
      toast.error(e.response?.data?.error || e.message || 'Erro ao criar pesquisa');
    }
  };

  const excluirModelo = async (m) => {
    if (!window.confirm(`Excluir "${m.nome}" e todas as ${m.qtd_rodadas} rodadas + ${m.total_respostas} respostas?`)) return;
    try {
      await api.delete(`/pesquisa-clima/modelos/${m.id}`);
      toast.success('Excluído');
      await carregar();
    } catch (e) { toast.error(e.response?.data?.error || 'Erro'); }
  };

  const salvarEdicao = async () => {
    if (!edit) return;
    setSalvando(true);
    try {
      await api.put(`/pesquisa-clima/modelos/${edit.id}`, {
        nome: edit.nome, descricao: edit.descricao,
        cor: edit.cor, icone: edit.icone,
        anonima: edit.anonima
      });
      await api.put(`/pesquisa-clima/modelos/${edit.id}/perguntas`, { perguntas: edit.perguntas });
      toast.success('Pesquisa salva');
      await carregar();
    } catch (e) { toast.error(e.response?.data?.error || 'Erro ao salvar'); }
    finally { setSalvando(false); }
  };

  const addPergunta = (tipo) => {
    setEdit(e => ({
      ...e,
      perguntas: [...(e.perguntas || []), {
        secao: '', ordem: (e.perguntas?.length || 0) + 1,
        tipo, enunciado: '', obrigatoria: false,
        configuracao: tipo === 'rating_5_matriz' ? { criterios: ['Critério 1'] }
          : (tipo === 'multipla_escolha' || tipo === 'checkbox') ? { opcoes: ['Opção 1'] }
          : {}
      }]
    }));
  };

  const updatePerg = (idx, patch) => {
    setEdit(e => {
      const p = [...e.perguntas];
      p[idx] = { ...p[idx], ...patch };
      return { ...e, perguntas: p };
    });
  };

  const updateConfig = (idx, patch) => {
    updatePerg(idx, { configuracao: { ...edit.perguntas[idx].configuracao, ...patch } });
  };

  const moverPerg = (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= edit.perguntas.length) return;
    const p = [...edit.perguntas];
    [p[idx], p[target]] = [p[target], p[idx]];
    setEdit({ ...edit, perguntas: p });
  };

  const removerPerg = (idx) => {
    setEdit(e => ({ ...e, perguntas: e.perguntas.filter((_, i) => i !== idx) }));
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 overflow-y-auto">
        <div className="bg-gradient-to-r from-pink-600 to-rose-500 text-white px-6 py-4">
          <h1 className="text-2xl font-bold">😊 Criar Pesquisas de Clima</h1>
          <p className="text-pink-100 text-sm">Templates reutilizáveis. Cada pesquisa pode ter várias rodadas (comparativo no tempo).</p>
        </div>

        <div className="p-4 md:p-6">
          {!edit ? (
            <>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold">Pesquisas ({modelos.length})</h2>
                <button onClick={() => setCriandoNovo(true)}
                  className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-lg font-bold">
                  ➕ Nova Pesquisa
                </button>
              </div>

              {criandoNovo && (
                <div className="bg-white rounded-lg shadow p-4 mb-4 border-2 border-rose-300">
                  <label className="block text-sm font-bold mb-1">Nome da nova pesquisa</label>
                  <input type="text" value={novoNome} onChange={e => setNovoNome(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && criarModelo()}
                    placeholder="Ex: Avaliação de Clima Trimestral 2026"
                    className="w-full border rounded px-3 py-2 mb-3" autoFocus />

                  <label className="block text-sm font-bold mb-1">🎭 Ícone</label>
                  <div className="flex gap-2 items-center mb-3 flex-wrap">
                    <input type="text" value={novoIcone} maxLength={4}
                      onChange={e => setNovoIcone(e.target.value)}
                      placeholder="📋"
                      className="w-16 text-center text-2xl border rounded px-2 py-1.5" />
                    <div className="flex flex-wrap gap-1">
                      {['📋','🛒','🌡️','🎯','👔','🚀','👋','📚','🔄','😊','💼','🏪','📊','🤝','💡','⭐','🎓','🏆','📝','💬','🎨','🔥'].map(e => (
                        <button key={e} type="button" onClick={() => setNovoIcone(e)}
                          className={`w-9 h-9 rounded text-xl hover:bg-gray-100 transition ${novoIcone === e ? 'bg-rose-100 ring-2 ring-rose-400' : ''}`}>{e}</button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={criarModelo} className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded font-bold">Criar</button>
                    <button onClick={() => { setCriandoNovo(false); setNovoNome(''); setNovoIcone('📋'); }} className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded">Cancelar</button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {modelos.map(m => (
                  <div key={m.id} className="bg-white rounded-lg shadow border-2 border-transparent hover:border-rose-300 transition p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-3xl">{m.icone || '📋'}</span>
                      <h3 className="font-bold flex-1">{m.nome}</h3>
                    </div>
                    {m.descricao && <p className="text-xs text-gray-600 mb-3 line-clamp-2">{m.descricao}</p>}
                    <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
                      <div className="bg-blue-50 rounded p-2">
                        <div className="font-bold text-blue-700">{m.qtd_perguntas}</div>
                        <div className="text-gray-600">perguntas</div>
                      </div>
                      <div className="bg-emerald-50 rounded p-2">
                        <div className="font-bold text-emerald-700">{m.qtd_rodadas}</div>
                        <div className="text-gray-600">rodadas</div>
                      </div>
                      <div className="bg-amber-50 rounded p-2">
                        <div className="font-bold text-amber-700">{m.total_respostas}</div>
                        <div className="text-gray-600">respostas</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => abrirEdicao(m.id)}
                        className="flex-1 bg-rose-500 hover:bg-rose-600 text-white px-3 py-1.5 rounded text-sm font-bold">
                        ✏️ Editar
                      </button>
                      <button onClick={() => excluirModelo(m)}
                        className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded text-sm">
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EditorPesquisa edit={edit} setEdit={setEdit} salvando={salvando}
              salvarEdicao={salvarEdicao}
              voltar={() => setEdit(null)}
              addPergunta={addPergunta} updatePerg={updatePerg} updateConfig={updateConfig}
              moverPerg={moverPerg} removerPerg={removerPerg} />
          )}
        </div>
      </div>
    </div>
  );
}

function EditorPesquisa({ edit, setEdit, salvando, salvarEdicao, voltar, addPergunta, updatePerg, updateConfig, moverPerg, removerPerg }) {
  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={voltar} className="px-3 py-1.5 rounded bg-gray-200 hover:bg-gray-300 text-sm">← Voltar</button>
        <h2 className="text-lg font-bold flex-1">Editando pesquisa</h2>
        <button onClick={salvarEdicao} disabled={salvando}
          className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2 rounded-lg font-bold disabled:opacity-50">
          {salvando ? 'Salvando...' : '💾 Salvar Pesquisa'}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-4 space-y-3">
        <div>
          <label className="block text-sm font-bold mb-1">Nome</label>
          <input type="text" value={edit.nome || ''} onChange={e => setEdit({ ...edit, nome: e.target.value })}
            className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1">Descrição (aparece no topo da pesquisa pública)</label>
          <textarea value={edit.descricao || ''} onChange={e => setEdit({ ...edit, descricao: e.target.value })}
            rows={2} className="w-full border rounded px-3 py-2 text-sm" />
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={edit.anonima !== false}
            onChange={e => setEdit({ ...edit, anonima: e.target.checked })} />
          <span>🔒 Pesquisa anônima (não identifica respondente)</span>
        </label>
      </div>

      <div className="bg-gradient-to-br from-orange-200 to-amber-200 rounded-lg shadow p-4 mb-4 border-2 border-orange-400">
        <h3 className="font-bold mb-3 text-orange-800">Adicionar pergunta:</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 items-stretch">
          {TIPOS.map(t => (
            <button key={t.id} onClick={() => addPergunta(t.id)}
              className="flex flex-col text-left p-3 min-h-[78px] bg-white border-2 border-orange-200 hover:border-orange-500 hover:bg-orange-50 rounded-lg transition shadow-sm hover:shadow-md active:scale-[0.98]">
              <div className="font-bold text-sm text-gray-800 leading-tight">{t.label}</div>
              <div className="text-xs text-gray-600 leading-snug mt-1">{t.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {(edit.perguntas || []).map((p, idx) => (
          <div key={idx} className="bg-slate-200 rounded-lg shadow p-4 border-l-4 border-rose-400 border border-slate-300">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded font-bold text-xs">#{idx + 1}</span>
              <span className="text-xs uppercase font-bold text-gray-500">{TIPOS.find(t => t.id === p.tipo)?.label || p.tipo}</span>
              <div className="flex-1"></div>
              <button onClick={() => moverPerg(idx, -1)} disabled={idx === 0} className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-30">↑</button>
              <button onClick={() => moverPerg(idx, 1)} disabled={idx === edit.perguntas.length - 1} className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-30">↓</button>
              <button onClick={() => removerPerg(idx)} className="px-2 py-1 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded">🗑️</button>
            </div>
            <input type="text" value={p.secao || ''} onChange={e => updatePerg(idx, { secao: e.target.value })}
              placeholder="Seção (opcional, ex: Padaria)"
              className="text-xs border rounded px-2 py-1 mb-2 w-48" />
            <textarea value={p.enunciado} onChange={e => updatePerg(idx, { enunciado: e.target.value })}
              placeholder="Enunciado da pergunta"
              rows={2} className="w-full border rounded px-3 py-2 text-sm font-medium" />
            <label className="inline-flex items-center gap-1 text-xs mt-2">
              <input type="checkbox" checked={!!p.obrigatoria} onChange={e => updatePerg(idx, { obrigatoria: e.target.checked })} />
              <span>Obrigatória</span>
            </label>

            {/* Editor de configuracao por tipo */}
            {p.tipo === 'rating_5_matriz' && (
              <div className="mt-2 bg-gray-50 rounded p-2">
                <div className="text-xs font-bold mb-1">Critérios avaliados (escala 1 a 5):</div>
                {(p.configuracao?.criterios || []).map((c, ci) => (
                  <div key={ci} className="flex flex-wrap items-center gap-2 mb-1.5 bg-white rounded px-2 py-1.5">
                    <input type="text" value={c}
                      onChange={e => {
                        const arr = [...p.configuracao.criterios];
                        arr[ci] = e.target.value;
                        updateConfig(idx, { criterios: arr });
                      }}
                      className="flex-1 min-w-[140px] border rounded px-2 py-1 text-sm" />
                    {/* PREVIEW dos botoes que o respondente vai ver */}
                    <div className="flex gap-0.5 opacity-60 pointer-events-none">
                      {[1,2,3,4,5].map(n => (
                        <span key={n} className="w-7 h-7 rounded border-2 border-gray-200 text-xs font-bold flex items-center justify-center bg-gray-50">{n}</span>
                      ))}
                    </div>
                    <button onClick={() => updateConfig(idx, { criterios: p.configuracao.criterios.filter((_, i) => i !== ci) })}
                      className="px-2 bg-red-100 text-red-700 rounded text-sm">×</button>
                  </div>
                ))}
                <button onClick={() => updateConfig(idx, { criterios: [...(p.configuracao.criterios || []), 'Novo critério'] })}
                  className="text-xs bg-rose-100 text-rose-700 px-2 py-1 rounded">+ Critério</button>
                <div className="text-[11px] text-gray-500 mt-2 italic">
                  💡 1 = péssimo · 5 = ótimo. Cada critério vira uma linha com botões 1-5 pro respondente clicar.
                </div>
              </div>
            )}
            {(p.tipo === 'multipla_escolha' || p.tipo === 'checkbox') && (
              <div className="mt-2 bg-gray-50 rounded p-2">
                <div className="text-xs font-bold mb-1">
                  Opções de resposta {p.tipo === 'checkbox' ? '(respondente pode marcar várias)' : '(respondente escolhe UMA)'}:
                </div>
                {(p.configuracao?.opcoes || []).map((o, oi) => (
                  <div key={oi} className="flex items-center gap-2 mb-1 bg-white rounded px-2 py-1">
                    <span className="text-gray-400">{p.tipo === 'checkbox' ? '☐' : '○'}</span>
                    <input type="text" value={o}
                      onChange={e => {
                        const arr = [...p.configuracao.opcoes];
                        arr[oi] = e.target.value;
                        updateConfig(idx, { opcoes: arr });
                      }}
                      className="flex-1 border rounded px-2 py-1 text-sm" />
                    <button onClick={() => updateConfig(idx, { opcoes: p.configuracao.opcoes.filter((_, i) => i !== oi) })}
                      className="px-2 bg-red-100 text-red-700 rounded text-sm">×</button>
                  </div>
                ))}
                <button onClick={() => updateConfig(idx, { opcoes: [...(p.configuracao.opcoes || []), 'Nova opção'] })}
                  className="text-xs bg-rose-100 text-rose-700 px-2 py-1 rounded">+ Opção</button>
              </div>
            )}
            {p.tipo === 'sim_nao' && (
              <div className="mt-2 bg-gray-50 rounded p-2 flex items-center gap-2 text-xs text-gray-600">
                <span className="font-bold">Respostas fixas:</span>
                <span className="bg-white border rounded px-2 py-0.5">○ Sim</span>
                <span className="bg-white border rounded px-2 py-0.5">○ Não</span>
              </div>
            )}
            {p.tipo === 'nps_0_10' && (
              <div className="mt-2 bg-gray-50 rounded p-2">
                <div className="text-xs font-bold mb-1">Escala fixa 0 a 10 (NPS):</div>
                <div className="flex flex-wrap gap-0.5 opacity-70 pointer-events-none">
                  {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
                    <span key={n} className={`w-8 h-8 rounded border-2 text-xs font-bold flex items-center justify-center
                      ${n>=9?'bg-emerald-50 border-emerald-200 text-emerald-700':n>=7?'bg-amber-50 border-amber-200 text-amber-700':'bg-red-50 border-red-200 text-red-700'}`}>{n}</span>
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                  <span>Não recomendaria</span><span>Recomendaria muito</span>
                </div>
              </div>
            )}
            {p.tipo === 'texto_curto' && (
              <div className="mt-2 bg-gray-50 rounded p-2">
                <div className="text-xs font-bold mb-1">Resposta livre (1 linha):</div>
                <input disabled placeholder="(o respondente vai digitar aqui...)" className="w-full border-2 border-dashed border-gray-300 rounded px-2 py-1.5 text-sm bg-white" />
              </div>
            )}
            {p.tipo === 'texto_longo' && (
              <div className="mt-2 bg-gray-50 rounded p-2">
                <div className="text-xs font-bold mb-1">Resposta livre (várias linhas):</div>
                <textarea disabled placeholder="(o respondente vai digitar aqui...)" rows={2} className="w-full border-2 border-dashed border-gray-300 rounded px-2 py-1.5 text-sm bg-white" />
              </div>
            )}
          </div>
        ))}
        {(!edit.perguntas || edit.perguntas.length === 0) && (
          <div className="text-center text-gray-400 py-10">
            Nenhuma pergunta ainda. Use os botões acima pra adicionar.
          </div>
        )}
      </div>
    </>
  );
}
