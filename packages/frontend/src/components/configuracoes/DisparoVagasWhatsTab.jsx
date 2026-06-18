import { useState, useEffect } from 'react';
import api from '../../utils/api';

const MENSAGEM_PADRAO =
`🚀 *VEM PRO NOSSO TIME!* 🚀

Estamos com vagas abertas e queremos você com a gente! 💼

📝 Cadastre seu currículo aqui:
{link}

É rápido e fácil. Esperamos por você! 🧡`;

export default function DisparoVagasWhatsTab() {
  const [grupos, setGrupos] = useState([]);            // [{ id, nome }]
  const [intervalo, setIntervalo] = useState('5');     // segundos entre grupos
  const [mensagem, setMensagem] = useState(MENSAGEM_PADRAO);
  const [link, setLink] = useState('');
  const [arteUrl, setArteUrl] = useState('');
  const [arteNome, setArteNome] = useState('');
  const [arteMime, setArteMime] = useState('');
  const [gruposDisponiveis, setGruposDisponiveis] = useState([]);
  const [loadingGrupos, setLoadingGrupos] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [subindoArte, setSubindoArte] = useState(false);
  const [msg, setMsg] = useState(null);

  const flash = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 5000); };

  useEffect(() => { carregar(); }, []);

  const carregar = async () => {
    try {
      const { data } = await api.get('/config/configurations');
      const cfg = data?.data || data || {};
      try { const g = JSON.parse(cfg.whatsapp_disparo_vagas_grupos || '[]'); if (Array.isArray(g)) setGrupos(g); } catch { /* ignore */ }
      setIntervalo(cfg.whatsapp_disparo_vagas_intervalo || '5');
      if (cfg.whatsapp_disparo_vagas_mensagem?.trim()) setMensagem(cfg.whatsapp_disparo_vagas_mensagem);
      setLink(cfg.whatsapp_disparo_vagas_link || `${window.location.origin}/curriculo`);
      setArteUrl(cfg.whatsapp_disparo_vagas_arte_url || '');
      setArteNome(cfg.whatsapp_disparo_vagas_arte_nome || '');
      setArteMime(cfg.whatsapp_disparo_vagas_arte_mime || '');
    } catch { /* ignore */ }
  };

  const carregarGrupos = async () => {
    setLoadingGrupos(true);
    try {
      const { data } = await api.get('/whatsapp/fetch-groups');
      let lista = [];
      if (Array.isArray(data.data)) lista = data.data;
      else if (data.data && Array.isArray(data.data.groups)) lista = data.data.groups;
      setGruposDisponiveis(lista.map(g => ({ id: g.id, nome: g.subject || g.name || g.id })));
      if (lista.length === 0) flash('Nenhum grupo encontrado.', false);
    } catch (e) {
      flash('Erro ao carregar grupos: ' + (e.response?.data?.error || e.message), false);
    } finally {
      setLoadingGrupos(false);
    }
  };

  const addGrupo = (g = { id: '', nome: '' }) => {
    if (g.id && grupos.some(x => x.id === g.id)) { flash('Esse grupo já está na lista.', false); return; }
    setGrupos(prev => [...prev, { id: g.id || '', nome: g.nome || '' }]);
  };
  const updGrupo = (i, patch) => setGrupos(prev => prev.map((g, idx) => idx === i ? { ...g, ...patch } : g));
  const rmGrupo = (i) => setGrupos(prev => prev.filter((_, idx) => idx !== i));

  const subirArte = async (file) => {
    if (!file) return;
    setSubindoArte(true);
    try {
      const fd = new FormData();
      fd.append('arte', file);
      const { data } = await api.post('/whatsapp/disparo-vagas/arte', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (data.success) { setArteUrl(data.url); setArteNome(data.nome || file.name); setArteMime(data.mime || file.type || ''); flash('Arte anexada!'); }
      else flash('Erro ao subir arte: ' + (data.error || ''), false);
    } catch (e) {
      flash('Erro ao subir arte: ' + (e.response?.data?.error || e.message), false);
    } finally {
      setSubindoArte(false);
    }
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      await api.post('/config/configurations', {
        whatsapp_disparo_vagas_grupos: JSON.stringify(grupos.filter(g => g.id?.trim())),
        whatsapp_disparo_vagas_intervalo: String(intervalo || '5'),
        whatsapp_disparo_vagas_mensagem: mensagem || ' ',
        whatsapp_disparo_vagas_link: link || ' ',
        whatsapp_disparo_vagas_arte_url: arteUrl || ' ',
        whatsapp_disparo_vagas_arte_nome: arteNome || ' ',
        whatsapp_disparo_vagas_arte_mime: arteMime || ' ',
      });
      flash('Configuração salva!');
    } catch (e) {
      flash('Erro ao salvar: ' + (e.response?.data?.error || e.message), false);
    } finally {
      setSalvando(false);
    }
  };

  const disparar = async (teste) => {
    const validos = grupos.filter(g => g.id?.trim());
    if (!validos.length) { flash('Adicione e salve pelo menos 1 grupo antes.', false); return; }
    if (!teste && !window.confirm(`Disparar pra ${validos.length} grupo(s), com ${intervalo}s entre cada? (Salve antes se mudou algo.)`)) return;
    setEnviando(true);
    try {
      const { data } = await api.post(`/whatsapp/disparo-vagas/enviar${teste ? '?teste=true' : ''}`);
      if (data.success) flash('✅ ' + (data.message || 'Disparado!'));
      else flash('❌ ' + (data.error || 'Erro ao disparar'), false);
    } catch (e) {
      flash('❌ Erro: ' + (e.response?.data?.error || e.message), false);
    } finally {
      setEnviando(false);
    }
  };

  const inputCls = 'px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500';
  const preview = (mensagem || '').replace(/\{link\}/gi, link || '(link)');
  const isImagem = (arteMime || '').startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(arteNome);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xl">📣</span>
        <h2 className="text-lg font-semibold text-gray-800">Disparo de Vagas</h2>
      </div>
      <p className="text-sm text-gray-500">
        Manda a mensagem de recrutamento (com o link do currículo e uma arte em PDF) pra <strong>vários grupos</strong> de uma vez,
        com um <strong>intervalo entre cada grupo</strong> pra não dar bloqueio. Sem limite de grupos.
      </p>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
        ⚠️ <strong>Cuidado com banimento:</strong> não exagere na frequência e mantenha um intervalo entre grupos. Ideal usar um número dedicado pra disparos.
      </div>

      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msg.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Configuração */}
        <div className="space-y-4">
          {/* Grupos */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-600">Grupos ({grupos.length})</label>
              <div className="flex gap-2">
                <button onClick={carregarGrupos} disabled={loadingGrupos}
                  className="px-2.5 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs font-medium disabled:opacity-60">
                  {loadingGrupos ? '...' : '🔄 Carregar Grupos'}
                </button>
                <button onClick={() => addGrupo()} className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold">+ Adicionar grupo</button>
              </div>
            </div>
            {/* lista com rolagem (sem limite de grupos) */}
            <div className="border border-gray-200 rounded-lg p-2 max-h-64 overflow-y-auto space-y-2 bg-gray-50">
              {grupos.length === 0 && <p className="text-xs text-gray-400 text-center py-3">Nenhum grupo. Use "Carregar Grupos" ou "+ Adicionar grupo".</p>}
              {grupos.map((g, i) => (
                <div key={i} className="flex gap-2 items-center bg-white rounded p-1.5 border border-gray-200">
                  <span className="text-[10px] text-gray-400 w-5 text-center">{i + 1}</span>
                  <div className="flex-1 grid grid-cols-2 gap-1">
                    <input value={g.id} onChange={e => updGrupo(i, { id: e.target.value })} placeholder="ID 1234@g.us" className="px-2 py-1 border border-gray-300 rounded text-xs" />
                    <input value={g.nome} onChange={e => updGrupo(i, { nome: e.target.value })} placeholder="nome (opcional)" className="px-2 py-1 border border-gray-300 rounded text-xs" />
                  </div>
                  <button onClick={() => rmGrupo(i)} className="text-red-500 hover:text-red-700 font-bold px-1" title="Remover">×</button>
                </div>
              ))}
            </div>
            {/* picker dos grupos carregados */}
            {gruposDisponiveis.length > 0 && (
              <div className="mt-2 border border-gray-200 rounded-lg max-h-32 overflow-y-auto divide-y">
                {gruposDisponiveis.map(g => (
                  <button key={g.id} onClick={() => addGrupo(g)}
                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-orange-50">
                    ➕ 🛒 {g.nome} <span className="text-[10px] text-gray-400">{g.id}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">⏱️ Intervalo entre grupos (segundos)</label>
              <input type="number" min="1" max="600" value={intervalo} onChange={e => setIntervalo(e.target.value)} className={`w-full ${inputCls}`} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">📎 Arte (imagem ou PDF)</label>
              <input type="file" accept="image/*,application/pdf" onChange={e => subirArte(e.target.files?.[0])} disabled={subindoArte}
                className="w-full text-xs file:mr-2 file:px-2 file:py-1 file:rounded file:border-0 file:bg-orange-100 file:text-orange-700" />
              {subindoArte && <span className="text-[11px] text-gray-500">subindo…</span>}
              {arteUrl && !subindoArte && <span className="text-[11px] text-emerald-700">✓ {arteNome} <button onClick={() => { setArteUrl(''); setArteNome(''); setArteMime(''); }} className="text-red-500 ml-1">remover</button></span>}
              <p className="text-[10px] text-gray-400 mt-0.5">Imagem (PNG/JPG) vai aberta com o texto de legenda. PDF vai como anexo.</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">🔗 Link do currículo (vai no lugar de {'{link}'})</label>
            <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://cliente.kontrataai.com.br/curriculo" className={`w-full ${inputCls}`} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">💬 Mensagem (use {'{link}'})</label>
            <textarea value={mensagem} onChange={e => setMensagem(e.target.value)} rows={7} className={`w-full ${inputCls} font-mono`} />
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={salvar} disabled={salvando}
              className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold border border-gray-300 disabled:opacity-60">
              {salvando ? 'Salvando…' : '💾 Salvar'}
            </button>
            <button onClick={() => disparar(true)} disabled={enviando}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60">
              {enviando ? '...' : '🧪 Testar (1º grupo)'}
            </button>
            <button onClick={() => disparar(false)} disabled={enviando}
              className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60">
              {enviando ? 'Disparando…' : '📣 Disparar pra todos'}
            </button>
          </div>
        </div>

        {/* Preview */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">📱 Preview da Mensagem</label>
          <div className="bg-[#e5ddd5] rounded-xl p-3 min-h-[220px]">
            <div className="bg-white rounded-lg p-2 shadow-sm text-sm text-gray-800">
              {arteUrl && isImagem && (
                <img src={arteUrl} alt={arteNome} className="w-full rounded-md mb-1.5 max-h-64 object-contain bg-gray-50" />
              )}
              <div className="whitespace-pre-wrap px-1">{preview}</div>
              {arteUrl && !isImagem && <div className="mt-2 text-xs text-gray-500 border-t pt-2 px-1">📎 {arteNome} (PDF anexo)</div>}
            </div>
          </div>
          <p className="text-[11px] text-gray-500 mt-2">
            "Disparar pra todos" envia pros {grupos.length} grupos com {intervalo}s entre cada. "Testar" manda só pro 1º.
          </p>
        </div>
      </div>
    </div>
  );
}
