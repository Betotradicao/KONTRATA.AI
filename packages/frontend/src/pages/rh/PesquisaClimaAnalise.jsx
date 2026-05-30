import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Sidebar from '../../components/Sidebar';
import { api } from '../../utils/api';
import toast from 'react-hot-toast';

export default function PesquisaClimaAnalise() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [modelos, setModelos] = useState([]);
  const [modeloAberto, setModeloAberto] = useState(null);
  const [perguntasModelo, setPerguntasModelo] = useState([]);
  const [mostrarPerguntas, setMostrarPerguntas] = useState(false);
  const [rodadas, setRodadas] = useState([]);
  const [criandoRodada, setCriandoRodada] = useState(false);
  const [novaRodadaNome, setNovaRodadaNome] = useState('');
  const [novaRodadaDepto, setNovaRodadaDepto] = useState('');
  const [dashRodada, setDashRodada] = useState(null);

  // Filtro global por empresa (loja). Cada pesquisa fica segmentada por loja.
  const [empresas, setEmpresas] = useState([]);
  const [empresaSel, setEmpresaSel] = useState('');
  const [departamentos, setDepartamentos] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);

  useEffect(() => { (async () => {
    try {
      const asArr = (resp, key) => {
        const d = resp?.data;
        if (Array.isArray(d)) return d;
        if (key && Array.isArray(d?.[key])) return d[key];
        if (Array.isArray(d?.data)) return d.data;
        return [];
      };
      const [mR, eR, dR, cR] = await Promise.all([
        api.get('/pesquisa-clima/modelos'),
        api.get('/rh/empresas'),
        api.get('/rh/configuracoes/departamentos'),
        api.get('/rh/colaboradores?status=ativo&limit=500'),
      ]);
      setModelos(asArr(mR));
      const empList = asArr(eR, 'empresas');
      setEmpresas(empList);
      setDepartamentos(asArr(dR));
      setColaboradores(asArr(cR, 'colaboradores'));
      if (empList.length > 0) {
        const principal = empList.find(x => x.isPrincipal) || empList[0];
        setEmpresaSel(String(principal.id));
      }
    } catch { toast.error('Erro ao carregar'); }
  })(); }, []);

  // Mostra TODOS os setores cadastrados (rh_departamentos e global).
  void colaboradores;
  const setoresDaEmpresa = departamentos;

  const abrirModelo = async (m) => {
    setModeloAberto(m);
    setPerguntasModelo([]);
    try {
      const params = { modelo_id: m.id };
      if (empresaSel) params.empresa_id = empresaSel;
      const [rR, rM] = await Promise.all([
        api.get('/pesquisa-clima/rodadas', { params }),
        api.get(`/pesquisa-clima/modelos/${m.id}`).catch(() => ({ data: {} })),
      ]);
      const todasRodadas = Array.isArray(rR.data) ? rR.data : [];
      // Filtra no frontend tambem (backend pode nao filtrar ainda)
      const filtradas = empresaSel
        ? todasRodadas.filter(r => !r.departamento_id || setoresDaEmpresa.some(s => s.id === r.departamento_id))
        : todasRodadas;
      setRodadas(filtradas);
      setPerguntasModelo(Array.isArray(rM.data?.perguntas) ? rM.data.perguntas : []);
    } catch { toast.error('Erro ao carregar'); }
  };

  const criarRodada = async () => {
    if (!novaRodadaNome.trim() || !modeloAberto) return;
    try {
      await api.post('/pesquisa-clima/rodadas', {
        modelo_id: modeloAberto.id,
        nome: novaRodadaNome.trim(),
        departamento_id: novaRodadaDepto || null,
      });
      toast.success('Rodada criada');
      setNovaRodadaNome(''); setNovaRodadaDepto(''); setCriandoRodada(false);
      abrirModelo(modeloAberto);
    } catch (e) { toast.error(e.response?.data?.error || 'Erro'); }
  };

  const togglerAberta = async (r) => {
    try {
      await api.put(`/pesquisa-clima/rodadas/${r.id}`, { aberta: !r.aberta });
      abrirModelo(modeloAberto);
    } catch (e) { toast.error(e.response?.data?.error || 'Erro'); }
  };

  const excluirRodada = async (r) => {
    if (!window.confirm(`Excluir rodada "${r.nome}" e todas suas ${r.total_respostas} respostas?`)) return;
    try {
      await api.delete(`/pesquisa-clima/rodadas/${r.id}`);
      toast.success('Excluída');
      abrirModelo(modeloAberto);
    } catch (e) { toast.error(e.response?.data?.error || 'Erro'); }
  };

  const buildLinkPesquisa = (token) => `${window.location.origin}/pesquisa-publica/${token}`;

  const copiarLink = async (token) => {
    const url = buildLinkPesquisa(token);
    try {
      // navigator.clipboard so funciona em HTTPS ou localhost
      if (window.isSecureContext && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback pra HTTP: textarea temporario + execCommand
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      toast.success('Link copiado!');
    } catch (e) {
      toast.error('Nao conseguiu copiar — selecione e copie manualmente do campo abaixo');
    }
  };

  const verDashboard = async (r) => {
    try {
      const resp = await api.get(`/pesquisa-clima/rodadas/${r.id}/dashboard`);
      setDashRodada(resp.data);
    } catch (e) { toast.error('Erro ao abrir dashboard'); }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 overflow-y-auto">
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white px-6 py-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">📊 Aplicação Pesquisas</h1>
              <p className="text-purple-100 text-sm">Acompanhe rodadas, evolução temporal e dashboards comparativos.</p>
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2 border border-white/30">
              <span className="text-xs font-semibold uppercase tracking-wide">🏪 Loja:</span>
              <select value={empresaSel} onChange={e => { setEmpresaSel(e.target.value); if (modeloAberto) setModeloAberto(null); }}
                className="bg-white text-gray-800 px-3 py-1.5 rounded text-sm font-medium min-w-[200px]">
                {empresas.length === 0 && <option value="">(carregando...)</option>}
                {empresas.map(e => (
                  <option key={e.id} value={e.id}>{e.apelido || e.nomeFantasia || e.razaoSocial || '(sem nome)'}</option>
                ))}
              </select>
            </div>
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-purple-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-4 md:p-6">
          {dashRodada ? (
            <DashboardRodada data={dashRodada} voltar={() => setDashRodada(null)} />
          ) : !modeloAberto ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {modelos.map(m => (
                <button key={m.id} onClick={() => abrirModelo(m)}
                  className="bg-white rounded-lg shadow border-2 border-transparent hover:border-rose-300 transition p-4 text-left">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-3xl">{m.icone || '📋'}</span>
                    <h3 className="font-bold flex-1">{m.nome}</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
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
                </button>
              ))}
              {modelos.length === 0 && (
                <div className="col-span-full text-center text-gray-400 py-16">
                  Nenhuma pesquisa criada. Vá em <strong>Criar Pesquisas</strong>.
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => { setModeloAberto(null); setRodadas([]); setPerguntasModelo([]); }}
                  className="px-3 py-1.5 rounded bg-gray-200 hover:bg-gray-300 text-sm">← Voltar</button>
                <h2 className="text-lg font-bold flex-1">{modeloAberto.icone} {modeloAberto.nome}</h2>
                <button onClick={() => setCriandoRodada(true)}
                  className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-lg font-bold text-sm">
                  ➕ Nova Rodada
                </button>
              </div>

              {/* Perguntas do modelo */}
              {perguntasModelo.length > 0 && (
                <div className="bg-white rounded-lg shadow border-2 border-blue-100 mb-4">
                  <button onClick={() => setMostrarPerguntas(s => !s)}
                    className="w-full flex items-center gap-2 px-4 py-3 hover:bg-blue-50 transition">
                    <span className="text-xl">📋</span>
                    <span className="font-bold flex-1 text-left">Perguntas desta pesquisa ({perguntasModelo.length})</span>
                    <span className="text-gray-500">{mostrarPerguntas ? '▲' : '▼'}</span>
                  </button>
                  {mostrarPerguntas && (
                    <div className="border-t divide-y divide-gray-100">
                      {perguntasModelo.map((p, i) => (
                        <div key={p.id} className="px-4 py-2.5 flex items-start gap-3">
                          <span className="text-xs font-bold text-gray-500 mt-0.5 min-w-[24px]">{String(i + 1).padStart(2, '0')}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-800">{p.enunciado || p.texto}</div>
                            {p.tipo && (
                              <div className="text-[10px] text-gray-500 uppercase mt-0.5 font-semibold">
                                {p.tipo === 'nps' ? '🎯 NPS (0-10)' : p.tipo === 'escala' ? '📊 Escala 1-5' : p.tipo === 'multipla' ? '☑️ Múltipla escolha' : p.tipo === 'texto' ? '💬 Texto livre' : `📌 ${p.tipo}`}
                                {p.categoria && <span className="ml-2 text-blue-600">· {p.categoria}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <h3 className="text-sm font-bold text-gray-700 uppercase mb-2 mt-4">📅 Rodadas</h3>

              {criandoRodada && (
                <div className="bg-white rounded-lg shadow p-4 mb-4 border-2 border-rose-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-sm font-bold mb-1">Nome da rodada</label>
                      <input type="text" value={novaRodadaNome}
                        onChange={e => setNovaRodadaNome(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && criarRodada()}
                        placeholder="Ex: 1º Trimestre 2026 / Avaliação Maio/2026"
                        className="w-full border rounded px-3 py-2" autoFocus />
                    </div>
                    <div>
                      <label className="block text-sm font-bold mb-1">Setor (grupo) <span className="text-gray-400 font-normal">opcional</span></label>
                      <select value={novaRodadaDepto}
                        onChange={e => setNovaRodadaDepto(e.target.value)}
                        className="w-full border rounded px-3 py-2 bg-white">
                        <option value="">Todos os setores da loja</option>
                        {setoresDaEmpresa.map(d => (
                          <option key={d.id} value={d.id}>{d.nome}</option>
                        ))}
                      </select>
                      <p className="text-[10px] text-gray-500 mt-1">Pra NR-1, escolha o setor pra que o resultado fique segmentado por GES.</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={criarRodada} className="bg-rose-500 text-white px-4 py-2 rounded font-bold">Criar Rodada</button>
                    <button onClick={() => { setCriandoRodada(false); setNovaRodadaNome(''); setNovaRodadaDepto(''); }} className="bg-gray-200 px-4 py-2 rounded">Cancelar</button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {rodadas.map(r => (
                  <div key={r.id} className="bg-white rounded-lg shadow p-4 flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[200px]">
                      <div className="font-bold">{r.nome}</div>
                      <div className="text-xs text-gray-500">
                        Criada em {new Date(r.created_at).toLocaleDateString('pt-BR')} ·
                        {r.aberta ? <span className="text-emerald-600 font-bold"> 🟢 Aberta</span> : <span className="text-gray-500"> ⛔ Fechada</span>}
                      </div>
                    </div>
                    <div className="bg-amber-50 rounded px-3 py-1 text-center">
                      <div className="font-bold text-amber-700">{r.total_respostas}</div>
                      <div className="text-xs text-gray-600">respostas</div>
                    </div>
                    {r.nps_medio != null && (
                      <div className="bg-blue-50 rounded px-3 py-1 text-center">
                        <div className="font-bold text-blue-700">{Number(r.nps_medio).toFixed(1)}</div>
                        <div className="text-xs text-gray-600">NPS médio</div>
                      </div>
                    )}
                    {/* Campo com o link visivel + botao copiar (funciona em HTTP/HTTPS) */}
                    <div className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded px-2 py-1">
                      <input
                        type="text"
                        readOnly
                        value={buildLinkPesquisa(r.token_publico)}
                        onClick={(e) => e.target.select()}
                        className="bg-transparent text-xs text-blue-700 w-56 truncate outline-none cursor-text"
                        title={buildLinkPesquisa(r.token_publico)}
                      />
                      <button onClick={() => copiarLink(r.token_publico)}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs font-bold whitespace-nowrap"
                        title="Copiar link">
                        🔗 Copiar
                      </button>
                    </div>
                    <button onClick={() => togglerAberta(r)}
                      className={`px-3 py-1.5 rounded text-sm font-bold ${r.aberta ? 'bg-amber-100 hover:bg-amber-200 text-amber-800' : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'}`}>
                      {r.aberta ? '⛔ Fechar' : '🟢 Abrir'}
                    </button>
                    <button onClick={() => verDashboard(r)} disabled={r.total_respostas === 0}
                      className="bg-rose-500 hover:bg-rose-600 text-white px-3 py-1.5 rounded text-sm font-bold disabled:opacity-50">
                      📊 Dashboard
                    </button>
                    <button onClick={() => excluirRodada(r)}
                      className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded text-sm">🗑️</button>
                  </div>
                ))}
                {rodadas.length === 0 && (
                  <div className="text-center text-gray-400 py-10">Nenhuma rodada criada ainda.</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DashboardRodada({ data, voltar }) {
  const { rodada, analise } = data;
  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={voltar} className="px-3 py-1.5 rounded bg-gray-200 hover:bg-gray-300 text-sm">← Voltar</button>
        <h2 className="text-lg font-bold flex-1">📊 {rodada.modelo_nome} — {rodada.nome}</h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card label="Respostas" value={rodada.total_respostas} cor="amber" />
        <Card label="NPS Médio" value={rodada.nps_medio != null ? Number(rodada.nps_medio).toFixed(1) : '—'} cor="blue" />
        <Card label="Aberta?" value={rodada.aberta ? 'SIM' : 'NÃO'} cor={rodada.aberta ? 'emerald' : 'gray'} />
        <Card label="Perguntas" value={analise.length} cor="rose" />
      </div>

      <div className="space-y-3">
        {analise.map(p => (
          <div key={p.id} className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                {p.secao && <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded mr-2">{p.secao}</span>}
                <span className="font-bold text-sm">{p.enunciado}</span>
              </div>
              <span className="text-xs text-gray-500 whitespace-nowrap">{p.total_respostas} respostas</span>
            </div>

            {p.tipo === 'nps_0_10' && (
              <div className="grid grid-cols-3 gap-2 text-center mt-2">
                <div className="bg-emerald-50 rounded p-2">
                  <div className="text-2xl font-bold text-emerald-700">{p.distribuicao?.promotores || 0}</div>
                  <div className="text-xs">😍 Promotores (9-10)</div>
                </div>
                <div className="bg-amber-50 rounded p-2">
                  <div className="text-2xl font-bold text-amber-700">{p.distribuicao?.passivos || 0}</div>
                  <div className="text-xs">😐 Passivos (7-8)</div>
                </div>
                <div className="bg-red-50 rounded p-2">
                  <div className="text-2xl font-bold text-red-700">{p.distribuicao?.detratores || 0}</div>
                  <div className="text-xs">😠 Detratores (0-6)</div>
                </div>
                <div className="col-span-3 mt-2 text-center bg-blue-50 rounded p-2">
                  <span className="text-3xl font-bold text-blue-700">{p.nps}</span>
                  <span className="text-sm text-gray-600 ml-2">NPS · média {Number(p.media).toFixed(1)}/10</span>
                </div>
              </div>
            )}

            {p.tipo === 'rating_5_matriz' && (p.distribuicao_criterios || p.medias_criterios) && (
              <BarrasAgrupadasMatriz
                distribuicao={p.distribuicao_criterios}
                medias={p.medias_criterios}
                labels={p.escala_labels || ['1','2','3','4','5']}
              />
            )}

            {(p.tipo === 'multipla_escolha' || p.tipo === 'sim_nao' || p.tipo === 'checkbox') && p.distribuicao && (
              <PizzaMaisBarras distribuicao={p.distribuicao} />
            )}

            {(p.tipo === 'texto_curto' || p.tipo === 'texto_longo') && (
              <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
                {(p.respostas || []).map((r, i) => (
                  <div key={i} className="bg-gray-50 rounded p-2 text-sm border-l-2 border-rose-300">{r}</div>
                ))}
                {(!p.respostas || p.respostas.length === 0) && <div className="text-gray-400 text-sm italic">Nenhuma resposta de texto.</div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

// Paleta de cores pra grafico de pizza/barras (10 cores distintas)
const PALETA = [
  '#ef4444', // red-500
  '#f97316', // orange-500
  '#eab308', // yellow-500
  '#22c55e', // green-500
  '#06b6d4', // cyan-500
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
  '#a855f7', // purple-500
];

// Cor por nota 1-5 (verde = alta, vermelho = baixa)
function corMedia(media) {
  const n = Number(media);
  if (n >= 4.5) return '#10b981'; // emerald-500
  if (n >= 3.5) return '#84cc16'; // lime-500
  if (n >= 2.5) return '#eab308'; // yellow-500
  if (n >= 1.5) return '#f97316'; // orange-500
  return '#ef4444';                 // red-500
}

// Cores fixas pra cada nivel da escala (5 niveis) — BEM contrastantes
// Indice 0 = nota 1 (pessimo), indice 4 = nota 5 (excelente)
const CORES_ESCALA = [
  '#7c3aed', // PESSIMO  - roxo forte
  '#dc2626', // RUIM     - vermelho
  '#f59e0b', // REGULAR  - laranja-ambar
  '#0ea5e9', // BOM      - azul-ceu
  '#10b981', // EXCELENTE - verde-esmeralda
];

// Tooltip flutuante reutilizavel (custom hover)
function useTooltip() {
  const [tip, setTip] = useState(null); // { x, y, text }
  return {
    tip,
    show: (e, text) => setTip({ x: e.clientX, y: e.clientY, text }),
    move: (e) => setTip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null),
    hide: () => setTip(null),
    render: () => tip && (
      <div className="fixed z-50 pointer-events-none bg-gray-900 text-white text-xs font-semibold px-2 py-1 rounded shadow-lg"
        style={{ left: tip.x + 12, top: tip.y + 12 }}>
        {tip.text}
      </div>
    ),
  };
}

// Matriz 1-5 com BARRAS AGRUPADAS por criterio (estilo Google Charts)
// Cada criterio mostra 5 barrinhas coladas (EXCELENTE/BOM/REGULAR/RUIM/PESSIMO)
function BarrasAgrupadasMatriz({ distribuicao, medias, labels }) {
  const tooltip = useTooltip();
  // labels do banco vem na ordem [EXCELENTE,BOM,REGULAR,RUIM,PESSIMO] (nota 5..1)
  // mas no banco a chave eh 1..5 — entao label[nota-1] eh: label[0]=EXCELENTE pra nota=5, etc
  // Padronizo: a nota mais alta (5) usa label[0] e cor verde
  const niveis = [
    { nota: 5, label: labels[0] || 'Excelente', cor: CORES_ESCALA[4] }, // verde
    { nota: 4, label: labels[1] || 'Bom',       cor: CORES_ESCALA[3] }, // lima
    { nota: 3, label: labels[2] || 'Regular',   cor: CORES_ESCALA[2] }, // amarelo
    { nota: 2, label: labels[3] || 'Ruim',      cor: CORES_ESCALA[1] }, // laranja
    { nota: 1, label: labels[4] || 'Péssimo',   cor: CORES_ESCALA[0] }, // vermelho
  ];

  const criterios = Object.keys(distribuicao || medias || {});
  if (criterios.length === 0) return null;

  // Acha o maior valor pra escalar eixo Y
  let maxV = 1;
  for (const c of criterios) {
    for (const n of niveis) {
      const v = distribuicao?.[c]?.[String(n.nota)] || 0;
      if (v > maxV) maxV = v;
    }
  }

  return (
    <div className="mt-3 bg-white rounded-lg p-4 border border-gray-200">
      {/* Legenda */}
      <div className="flex flex-wrap items-center justify-center gap-3 mb-3 text-xs">
        {niveis.map(n => (
          <div key={n.nota} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: n.cor }} />
            <span className="font-semibold text-gray-700">{n.label}</span>
          </div>
        ))}
      </div>

      {/* Area do grafico */}
      <div className="flex items-end gap-3 h-56 border-b-2 border-gray-300 pl-8 relative">
        {/* Eixo Y com numeros */}
        <div className="absolute left-0 top-0 bottom-0 w-7 flex flex-col-reverse justify-between text-[10px] text-gray-500 pb-1">
          {[0, Math.ceil(maxV/4), Math.ceil(maxV/2), Math.ceil(maxV*3/4), maxV].map((n, i) => (
            <div key={i} className="text-right pr-1">{n}</div>
          ))}
        </div>

        {/* Grupos de barras por criterio */}
        {criterios.map(crit => (
          <div key={crit} className="flex-1 flex items-end justify-center gap-1 h-full">
            {niveis.map(n => {
              const v = distribuicao?.[crit]?.[String(n.nota)] || 0;
              const alturaPct = (v / maxV) * 100;
              return (
                <div key={n.nota}
                  className="flex-1 max-w-[28px] rounded-t cursor-pointer transition-opacity hover:opacity-70"
                  style={{ height: `${alturaPct}%`, backgroundColor: n.cor, minHeight: v > 0 ? '4px' : '0' }}
                  onMouseEnter={(e) => tooltip.show(e, `${crit} → ${n.label}: ${v} voto${v !== 1 ? 's' : ''}`)}
                  onMouseMove={tooltip.move}
                  onMouseLeave={tooltip.hide}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Labels dos criterios + media */}
      <div className="flex gap-3 pl-8 mt-2">
        {criterios.map(crit => (
          <div key={crit} className="flex-1 text-center">
            <div className="text-sm font-semibold text-gray-700 leading-tight">{crit}</div>
            {medias?.[crit] != null && (
              <div className="text-xs font-bold mt-1" style={{ color: corMedia(medias[crit]) }}>
                Média {Number(medias[crit]).toFixed(2)}
              </div>
            )}
          </div>
        ))}
      </div>

      {tooltip.render()}
    </div>
  );
}

// PIZZA + BARRAS lado a lado pra multipla escolha/checkbox
function PizzaMaisBarras({ distribuicao }) {
  const tooltip = useTooltip();
  const entries = Object.entries(distribuicao).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((a, [, v]) => a + v, 0);
  if (total === 0) return <div className="text-gray-400 text-sm italic mt-2">Sem respostas ainda</div>;

  const max = Math.max(...entries.map(([, v]) => v), 1);

  // Gera path SVG pra cada fatia da pizza (donut)
  const cx = 80, cy = 80, rOut = 70, rIn = 30;
  const fatias = [];
  let anguloAcc = -Math.PI / 2; // comeca no topo
  for (let i = 0; i < entries.length; i++) {
    const [k, v] = entries[i];
    const fracao = v / total;
    const inicio = anguloAcc;
    const fim = anguloAcc + fracao * 2 * Math.PI;
    const meio = (inicio + fim) / 2;
    anguloAcc = fim;
    const x1 = cx + rOut * Math.cos(inicio), y1 = cy + rOut * Math.sin(inicio);
    const x2 = cx + rOut * Math.cos(fim),    y2 = cy + rOut * Math.sin(fim);
    const x3 = cx + rIn  * Math.cos(fim),    y3 = cy + rIn  * Math.sin(fim);
    const x4 = cx + rIn  * Math.cos(inicio), y4 = cy + rIn  * Math.sin(inicio);
    const largeArc = fracao > 0.5 ? 1 : 0;
    // Se for unica fatia (100%), desenha como anel completo
    const d = entries.length === 1
      ? `M ${cx - rOut},${cy} A ${rOut},${rOut} 0 1,1 ${cx + rOut},${cy} A ${rOut},${rOut} 0 1,1 ${cx - rOut},${cy} Z M ${cx - rIn},${cy} A ${rIn},${rIn} 0 1,0 ${cx + rIn},${cy} A ${rIn},${rIn} 0 1,0 ${cx - rIn},${cy} Z`
      : `M ${x1},${y1} A ${rOut},${rOut} 0 ${largeArc},1 ${x2},${y2} L ${x3},${y3} A ${rIn},${rIn} 0 ${largeArc},0 ${x4},${y4} Z`;
    fatias.push({ k, v, d, cor: PALETA[i % PALETA.length], pct: fracao * 100, meio });
  }

  return (
    <div className="mt-3 bg-gray-50 rounded-lg p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">

        {/* PIZZA SVG (com tooltip por fatia) */}
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="relative shrink-0">
            <svg width="160" height="160" viewBox="0 0 160 160" className="drop-shadow-md">
              {fatias.map(f => (
                <path key={f.k} d={f.d} fill={f.cor}
                  className="cursor-pointer transition-opacity hover:opacity-75"
                  onMouseEnter={(e) => tooltip.show(e, `${f.k}: ${f.v} voto${f.v !== 1 ? 's' : ''} (${f.pct.toFixed(0)}%)`)}
                  onMouseMove={tooltip.move}
                  onMouseLeave={tooltip.hide} />
              ))}
              <text x="80" y="76" textAnchor="middle" className="fill-gray-800 font-bold" style={{ fontSize: '16px' }}>{total}</text>
              <text x="80" y="92" textAnchor="middle" className="fill-gray-500 uppercase" style={{ fontSize: '8px' }}>total</text>
            </svg>
          </div>
          {/* Legenda */}
          <div className="flex-1 w-full space-y-1">
            {entries.map(([k, v], i) => {
              const pct = (v / total) * 100;
              return (
                <div key={k} className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: PALETA[i % PALETA.length] }} />
                  <div className="flex-1 truncate" title={k}>{k}</div>
                  <div className="text-[11px] text-gray-600 whitespace-nowrap font-semibold">{v} ({pct.toFixed(0)}%)</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* BARRAS VERTICAIS COLADAS */}
        <div>
          <div className="flex items-end gap-px h-40 border-b-2 border-gray-300">
            {entries.map(([k, v], i) => {
              const alturaPct = (v / max) * 100;
              const pct = (v / total) * 100;
              return (
                <div key={k}
                  className="flex-1 flex flex-col items-center justify-end h-full cursor-pointer"
                  onMouseEnter={(e) => tooltip.show(e, `${k}: ${v} voto${v !== 1 ? 's' : ''} (${pct.toFixed(0)}%)`)}
                  onMouseMove={tooltip.move}
                  onMouseLeave={tooltip.hide}>
                  <div className="text-[10px] font-bold mb-0.5 text-gray-700">{v}</div>
                  <div className="w-full rounded-t transition-opacity hover:opacity-70"
                    style={{ height: `${alturaPct}%`, backgroundColor: PALETA[i % PALETA.length], minHeight: v > 0 ? '3px' : '0' }} />
                </div>
              );
            })}
          </div>
          <div className="flex gap-1 mt-2">
            {entries.map(([k]) => (
              <div key={k} className="flex-1 text-center text-xs font-semibold leading-tight text-gray-800 px-1" title={k}>
                {k.length > 18 ? k.slice(0, 18) + '…' : k}
              </div>
            ))}
          </div>
        </div>

      </div>
      {tooltip.render()}
    </div>
  );
}

function Card({ label, value, cor }) {
  const cores = {
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    gray: 'bg-gray-50 text-gray-700 border-gray-200',
  };
  return (
    <div className={`rounded-lg border p-3 text-center ${cores[cor]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs uppercase font-semibold">{label}</div>
    </div>
  );
}
