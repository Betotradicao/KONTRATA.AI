import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

export default function PesquisaPublica() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [respostas, setRespostas] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [iniciadoEm] = useState(Date.now());
  const [perguntaErroId, setPerguntaErroId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get(`/pesquisa-clima/publico/${token}`);
        setData(r.data);
        // Bloqueio adicional via localStorage
        if (r.data.ja_respondeu || localStorage.getItem(`pesquisa_${token}_done`) === '1') {
          setErro('Você já respondeu esta pesquisa anteriormente. Obrigado pela contribuição!');
        }
      } catch (e) {
        setErro(e.response?.data?.error || 'Erro ao carregar pesquisa');
      } finally { setLoading(false); }
    })();
  }, [token]);

  const setResp = (perguntaId, valor) => {
    setRespostas(prev => ({ ...prev, [perguntaId]: { ...(prev[perguntaId] || {}), valor } }));
  };

  const enviar = async () => {
    if (!data) return;
    // Valida obrigatorias (considera "Outro: " sem texto como em branco)
    const isVazio = (p) => {
      const v = respostas[p.id]?.valor;
      if (v === undefined || v === '' || v === null) return true;
      if (Array.isArray(v) && v.length === 0) return true;
      // "Outro: " sem texto depois dos dois pontos = vazio
      if (typeof v === 'string' && /^outro:\s*$/i.test(v)) return true;
      if (Array.isArray(v) && v.some(x => typeof x === 'string' && /^outro:\s*$/i.test(x))) return true;
      return false;
    };
    const faltando = data.perguntas.filter(p => p.obrigatoria && isVazio(p));
    if (faltando.length > 0) {
      const primeira = faltando[0];
      setPerguntaErroId(primeira.id);
      // Scroll suave ate a pergunta
      setTimeout(() => {
        const el = document.getElementById(`pergunta-${primeira.id}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
      toast.error(`Falta responder: "${primeira.enunciado.slice(0, 60)}"`);
      // Tira o destaque depois de 3s pra nao ficar fixo
      setTimeout(() => setPerguntaErroId(null), 4000);
      return;
    }

    setEnviando(true);
    try {
      const tempo_segundos = Math.round((Date.now() - iniciadoEm) / 1000);
      const arr = Object.entries(respostas).map(([pid, r]) => ({
        pergunta_id: parseInt(pid),
        valor: r.valor,
        colaborador_id: r.colaborador_id,
        setor_id: r.setor_id,
      }));
      await api.post(`/pesquisa-clima/publico/${token}/submeter`, { respostas: arr, tempo_segundos });
      localStorage.setItem(`pesquisa_${token}_done`, '1');
      setEnviado(true);
    } catch (e) {
      console.error('[PesquisaPublica] erro ao enviar:', e, e.response?.data);
      toast.error(e.response?.data?.error || e.message || 'Erro ao enviar — tente de novo');
    } finally { setEnviando(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 to-orange-50">
        <div className="text-center">
          <div className="text-4xl mb-2">⏳</div>
          <div>Carregando pesquisa...</div>
        </div>
      </div>
    );
  }
  if (erro) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 to-orange-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div className="text-6xl mb-3">🤝</div>
          <h1 className="text-xl font-bold text-rose-700 mb-2">Obrigado!</h1>
          <p className="text-gray-700">{erro}</p>
        </div>
      </div>
    );
  }
  if (enviado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md text-center">
          <div className="text-6xl mb-3">🎉</div>
          <h1 className="text-2xl font-bold text-emerald-700 mb-2">Resposta enviada!</h1>
          <p className="text-gray-700">Obrigado pela sua contribuição. Sua resposta é anônima.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50 pb-20">
      <div className="bg-gradient-to-r from-rose-600 to-orange-500 text-white px-4 py-6 shadow">
        <div className="max-w-3xl mx-auto">
          {/* Logo da empresa (do branding) — destacado em moldura branca */}
          {data.brand?.logo_url && (
            <div className="flex justify-center mb-4">
              <div className="bg-white p-2 rounded-lg shadow-md inline-block">
                <img src={data.brand.logo_url} alt={data.brand.name || 'Logo'} className="h-20 w-auto max-w-[180px] object-contain" />
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <span className="text-5xl">{data.rodada.icone || '📋'}</span>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{data.rodada.modelo_nome}</h1>
              <p className="text-rose-100 text-sm">{data.rodada.nome}</p>
            </div>
          </div>
          {data.rodada.modelo_descricao && (
            <p className="text-sm text-rose-50 mt-3 leading-relaxed">{data.rodada.modelo_descricao}</p>
          )}
          {data.rodada.anonima && (
            <div className="mt-3 inline-flex items-center gap-1 bg-white/20 backdrop-blur px-3 py-1 rounded-full text-xs">
              🔒 Pesquisa 100% anônima
            </div>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-3">
        {agrupaPorSecao(data.perguntas).map(([secao, perguntas]) => (
          <div key={secao}>
            {secao && <h2 className="text-lg font-bold text-rose-700 mt-4 mb-2 px-2">{secao}</h2>}
            {perguntas.map((p, idx) => {
              const temErro = perguntaErroId === p.id;
              return (
                <div key={p.id} id={`pergunta-${p.id}`}
                  className={`bg-white rounded-lg shadow p-4 mb-3 border-l-4 transition-all scroll-mt-20 ${
                    temErro
                      ? 'border-red-500 ring-4 ring-red-300 animate-pulse'
                      : 'border-rose-400'
                  }`}>
                  <div className={`font-semibold mb-3 ${temErro ? 'text-red-700' : 'text-gray-800'}`}>
                    {p.enunciado} {p.obrigatoria && <span className="text-red-500">*</span>}
                    {temErro && <span className="ml-2 text-sm font-bold text-red-600">← obrigatória</span>}
                  </div>
                  <PerguntaInput pergunta={p} valor={respostas[p.id]?.valor}
                    onChange={(v) => { setResp(p.id, v); if (perguntaErroId === p.id) setPerguntaErroId(null); }} />
                </div>
              );
            })}
          </div>
        ))}

        <button onClick={enviar} disabled={enviando}
          className="w-full bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white font-bold py-4 rounded-xl text-lg shadow-lg disabled:opacity-50 mt-4">
          {enviando ? 'Enviando...' : '✅ Enviar Respostas'}
        </button>
      </div>
    </div>
  );
}

function agrupaPorSecao(perguntas) {
  const grupos = {};
  perguntas.forEach(p => {
    const k = p.secao || '';
    if (!grupos[k]) grupos[k] = [];
    grupos[k].push(p);
  });
  return Object.entries(grupos);
}

function PerguntaInput({ pergunta, valor, onChange }) {
  const cfg = pergunta.configuracao || {};

  if (pergunta.tipo === 'rating_5_matriz') {
    const matriz = valor || {};
    const labels = (cfg.escala_labels && cfg.escala_labels.length === 5)
      ? cfg.escala_labels
      : ['1', '2', '3', '4', '5'];
    return (
      <div className="space-y-2">
        {/* Header com labels da escala */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[150px]" />
          <div className="flex gap-1">
            {labels.map((lbl, i) => (
              <div key={i} className="w-20 text-center text-[10px] font-bold uppercase text-gray-500 leading-tight">{lbl}</div>
            ))}
          </div>
        </div>
        {(cfg.criterios || []).map(c => (
          <div key={c} className="flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-[150px] text-sm">{c}</div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n}
                  onClick={() => onChange({ ...matriz, [c]: n })}
                  title={labels[n - 1]}
                  className={`w-20 h-9 rounded-lg border-2 font-semibold text-xs transition ${
                    matriz[c] === n ? 'bg-rose-500 text-white border-rose-500' : 'bg-gray-50 hover:bg-rose-50 border-gray-200 text-gray-700'
                  }`}>{labels[n - 1]}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (pergunta.tipo === 'nps_0_10') {
    return (
      <div>
        <div className="flex flex-wrap gap-1">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
            <button key={n}
              onClick={() => onChange(n)}
              className={`w-10 h-10 rounded-lg border-2 font-bold transition ${
                valor === n
                  ? (n >= 9 ? 'bg-emerald-500 border-emerald-500 text-white' : n >= 7 ? 'bg-amber-500 border-amber-500 text-white' : 'bg-red-500 border-red-500 text-white')
                  : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
              }`}>{n}</button>
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1 px-1">
          <span>Não recomendaria</span>
          <span>Recomendaria muito</span>
        </div>
      </div>
    );
  }

  if (pergunta.tipo === 'multipla_escolha' || pergunta.tipo === 'sim_nao') {
    const opcoes = pergunta.tipo === 'sim_nao' ? ['Sim', 'Não'] : (cfg.opcoes || []);
    const isOutroOpt = (o) => /^outro/i.test((o || '').trim());
    const valorSelecionadoEhOutro = (valor || '').toString().toLowerCase().startsWith('outro');
    return (
      <div className="space-y-2">
        {opcoes.map(o => {
          const ehOutro = isOutroOpt(o);
          const selecionado = ehOutro ? valorSelecionadoEhOutro : valor === o;
          return (
            <div key={o}>
              <label className="flex items-center gap-2 p-2 rounded hover:bg-rose-50 cursor-pointer">
                <input type="radio" name={`p-${pergunta.id}`} checked={selecionado}
                  onChange={() => onChange(ehOutro ? 'Outro: ' : o)}
                  className="w-4 h-4 accent-rose-500" />
                <span>{o}</span>
              </label>
              {ehOutro && selecionado && (
                <input type="text"
                  placeholder="Especifique..."
                  autoFocus
                  value={(valor || '').replace(/^outro:\s*/i, '')}
                  onChange={e => onChange(`Outro: ${e.target.value}`)}
                  className="ml-8 mt-1 w-[calc(100%-2rem)] border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-rose-400 focus:border-rose-400" />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (pergunta.tipo === 'checkbox') {
    const sel = Array.isArray(valor) ? valor : [];
    const isOutroOpt = (o) => /^outro/i.test((o || '').trim());
    const outroSelecionado = sel.find(s => typeof s === 'string' && /^outro/i.test(s));
    return (
      <div className="space-y-2">
        {(cfg.opcoes || []).map(o => {
          const ehOutro = isOutroOpt(o);
          const selecionado = ehOutro ? !!outroSelecionado : sel.includes(o);
          return (
            <div key={o}>
              <label className="flex items-center gap-2 p-2 rounded hover:bg-rose-50 cursor-pointer">
                <input type="checkbox" checked={selecionado}
                  onChange={() => {
                    if (ehOutro) {
                      if (outroSelecionado) onChange(sel.filter(s => !/^outro/i.test(s)));
                      else onChange([...sel, 'Outro: ']);
                    } else {
                      onChange(sel.includes(o) ? sel.filter(x => x !== o) : [...sel, o]);
                    }
                  }}
                  className="w-4 h-4 accent-rose-500" />
                <span>{o}</span>
              </label>
              {ehOutro && selecionado && (
                <input type="text"
                  placeholder="Especifique..."
                  autoFocus
                  value={(outroSelecionado || '').replace(/^outro:\s*/i, '')}
                  onChange={e => onChange([...sel.filter(s => !/^outro/i.test(s)), `Outro: ${e.target.value}`])}
                  className="ml-8 mt-1 w-[calc(100%-2rem)] border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-rose-400 focus:border-rose-400" />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (pergunta.tipo === 'texto_curto') {
    return <input type="text" value={valor || ''} onChange={e => onChange(e.target.value)}
      className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 focus:border-rose-400 focus:outline-none" />;
  }

  if (pergunta.tipo === 'texto_longo') {
    return <textarea value={valor || ''} onChange={e => onChange(e.target.value)}
      rows={3}
      className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 focus:border-rose-400 focus:outline-none" />;
  }

  return <div className="text-xs text-red-500">Tipo de pergunta não suportado: {pergunta.tipo}</div>;
}
