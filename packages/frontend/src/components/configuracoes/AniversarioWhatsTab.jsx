import { useState, useEffect } from 'react';
import api from '../../utils/api';

const MENSAGEM_PADRAO =
`🥳🎊 *HOJE TEM ANIVERSARIANTE!* 🎊🥳

{nomes}

Que venha um ano INCRÍVEL, cheio de realizações, risadas e muito bolo! 🎂🎈✨

Toda a *Equipe {loja}* te deseja o melhor do mundo! 💛🙌

#TamoJunto 🛒`;

export default function AniversarioWhatsTab() {
  const [groupId, setGroupId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [horario, setHorario] = useState('08:00');
  const [mensagem, setMensagem] = useState(MENSAGEM_PADRAO);
  const [grupos, setGrupos] = useState([]);
  const [loadingGrupos, setLoadingGrupos] = useState(false);
  const [preview, setPreview] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState(null);

  const flash = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 4500); };

  useEffect(() => { carregar(); carregarPreview(); }, []);

  const carregar = async () => {
    try {
      const { data } = await api.get('/config/configurations');
      const cfg = data?.data || data || {};
      setGroupId(cfg.whatsapp_group_aniversario || '');
      setGroupName(cfg.whatsapp_group_aniversario_name || '');
      setHorario(cfg.whatsapp_aniversario_schedule_time || '08:00');
      if (cfg.whatsapp_aniversario_mensagem && cfg.whatsapp_aniversario_mensagem.trim()) setMensagem(cfg.whatsapp_aniversario_mensagem);
    } catch { /* ignore */ }
  };

  const carregarPreview = async () => {
    try {
      const { data } = await api.get('/whatsapp/aniversario/preview');
      if (data.success) setPreview(data.mensagem);
    } catch { /* ignore */ }
  };

  const carregarGrupos = async () => {
    setLoadingGrupos(true);
    try {
      const { data } = await api.get('/whatsapp/fetch-groups');
      let lista = [];
      if (Array.isArray(data.data)) lista = data.data;
      else if (data.data && Array.isArray(data.data.groups)) lista = data.data.groups;
      setGrupos(lista.map(g => ({ id: g.id, nome: g.subject || g.name || g.id })));
      if (lista.length === 0) flash('Nenhum grupo encontrado.', false);
    } catch (e) {
      flash('Erro ao carregar grupos: ' + (e.response?.data?.error || e.message), false);
    } finally {
      setLoadingGrupos(false);
    }
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      await api.post('/config/configurations', {
        whatsapp_group_aniversario: groupId,
        whatsapp_group_aniversario_name: groupName,
        whatsapp_aniversario_schedule_time: horario,
        whatsapp_aniversario_mensagem: mensagem || ' ',
      });
      flash('Configuração salva! Todo dia nesse horário o sistema parabeniza quem faz aniversário.');
      carregarPreview();
    } catch (e) {
      flash('Erro ao salvar: ' + (e.response?.data?.error || e.message), false);
    } finally {
      setSalvando(false);
    }
  };

  const testar = async () => {
    if (!groupId) { flash('Selecione e salve um grupo antes de testar.', false); return; }
    setEnviando(true);
    try {
      const { data } = await api.post('/whatsapp/aniversario/enviar');
      if (data.success) flash('✅ ' + (data.message || 'Enviado!'));
      else flash('❌ ' + (data.error || 'Erro ao enviar'), false);
    } catch (e) {
      flash('❌ Erro: ' + (e.response?.data?.error || e.message), false);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xl">🎉</span>
        <h2 className="text-lg font-semibold text-gray-800">Aniversariantes (parabéns no grupo)</h2>
      </div>
      <p className="text-sm text-gray-500">
        Todo dia, no horário escolhido, o sistema vê quem faz aniversário <strong>hoje</strong> e manda os parabéns no grupo
        — <strong>uma mensagem por loja</strong>, em nome da equipe. Se ninguém faz aniversário, não envia nada.
      </p>

      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msg.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Configuração */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">ID do Grupo WhatsApp</label>
            <div className="flex gap-2">
              <input value={groupId} onChange={e => setGroupId(e.target.value)} placeholder="1234567890@g.us"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500" />
              <button onClick={carregarGrupos} disabled={loadingGrupos}
                className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium whitespace-nowrap disabled:opacity-60">
                {loadingGrupos ? 'Carregando...' : '🔄 Carregar Grupos'}
              </button>
            </div>
          </div>

          {grupos.length > 0 && (
            <div className="border border-gray-200 rounded-lg max-h-40 overflow-auto divide-y">
              {grupos.map(g => (
                <button key={g.id} onClick={() => { setGroupId(g.id); setGroupName(g.nome); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-orange-50 ${groupId === g.id ? 'bg-orange-100 font-semibold' : ''}`}>
                  🛒 {g.nome}
                  <div className="text-[10px] text-gray-400">{g.id}</div>
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nome do Grupo (opcional)</label>
              <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Ex: Equipe Tradição"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">⏰ Horário do envio</label>
              <input type="time" value={horario} onChange={e => setHorario(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Mensagem (editável)</label>
            <textarea value={mensagem} onChange={e => setMensagem(e.target.value)} rows={9}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 font-mono" />
            <p className="text-[11px] text-gray-500 mt-1">
              Use <code className="bg-gray-100 px-1 rounded">{'{nomes}'}</code> (lista dos aniversariantes) e
              <code className="bg-gray-100 px-1 rounded ml-1">{'{loja}'}</code> (nome da loja) — são trocados automaticamente.
            </p>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={salvar} disabled={salvando}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60">
              {salvando ? 'Salvando...' : '💾 Salvar Configuração'}
            </button>
            <button onClick={testar} disabled={enviando}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60">
              {enviando ? 'Enviando...' : '🧪 Testar Envio'}
            </button>
          </div>
        </div>

        {/* Preview */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-semibold text-gray-700">📱 Preview da Mensagem</label>
            <button onClick={carregarPreview} className="text-xs text-orange-600 hover:underline">atualizar</button>
          </div>
          <div className="bg-[#e5ddd5] rounded-xl p-3 min-h-[220px]">
            <div className="bg-white rounded-lg p-3 shadow-sm text-sm text-gray-800 whitespace-pre-wrap">
              {preview || 'Configure e salve pra ver o preview.'}
            </div>
          </div>
          <p className="text-[11px] text-gray-500 mt-2">
            ⚠️ O <strong>"Testar Envio"</strong> manda agora mesmo pro grupo. Sem aniversariante hoje, envia um exemplo.
          </p>
        </div>
      </div>
    </div>
  );
}
