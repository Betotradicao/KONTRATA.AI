import { useState, useEffect } from 'react';
import api from '../../utils/api';

const DIAS = [
  { v: '1', label: 'Segunda-feira' },
  { v: '2', label: 'Terça-feira' },
  { v: '3', label: 'Quarta-feira' },
  { v: '4', label: 'Quinta-feira' },
  { v: '5', label: 'Sexta-feira' },
  { v: '6', label: 'Sábado' },
  { v: '0', label: 'Domingo' },
];

export default function VagasAbertasWhatsTab() {
  const [groupId, setGroupId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [diaSemana, setDiaSemana] = useState('1');
  const [horario, setHorario] = useState('08:00');
  const [grupos, setGrupos] = useState([]);
  const [loadingGrupos, setLoadingGrupos] = useState(false);
  const [preview, setPreview] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState(null);

  const flash = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 4000); };

  useEffect(() => { carregar(); }, []);

  const carregar = async () => {
    try {
      const { data } = await api.get('/config/configurations');
      const cfg = data?.data || data || {}; // resposta vem como { success, data: {...} }
      setGroupId(cfg.whatsapp_group_vagas_abertas || '');
      setGroupName(cfg.whatsapp_group_vagas_abertas_name || '');
      setDiaSemana(cfg.whatsapp_vagas_abertas_dia_semana || '1');
      setHorario(cfg.whatsapp_vagas_abertas_schedule_time || '08:00');
    } catch { /* ignore */ }
    carregarPreview();
  };

  const carregarPreview = async () => {
    try {
      const { data } = await api.get('/whatsapp/vagas-abertas/preview');
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
        whatsapp_group_vagas_abertas: groupId,
        whatsapp_group_vagas_abertas_name: groupName,
        whatsapp_vagas_abertas_dia_semana: diaSemana,
        whatsapp_vagas_abertas_schedule_time: horario,
      });
      flash('Configuração salva! O envio automático acontece toda semana no dia e horário escolhidos.');
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
      const { data } = await api.post('/whatsapp/vagas-abertas/enviar');
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
        <span className="text-xl">💼</span>
        <h2 className="text-lg font-semibold text-gray-800">Vagas em Aberto</h2>
      </div>
      <p className="text-sm text-gray-500">
        Envia automaticamente um resumo das vagas em aberto (com PDF detalhado por loja) para um grupo de WhatsApp,
        no dia da semana e horário que você escolher.
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
            <div className="border border-gray-200 rounded-lg max-h-48 overflow-auto divide-y">
              {grupos.map(g => (
                <button key={g.id} onClick={() => { setGroupId(g.id); setGroupName(g.nome); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-orange-50 ${groupId === g.id ? 'bg-orange-100 font-semibold' : ''}`}>
                  🛒 {g.nome}
                  <div className="text-[10px] text-gray-400">{g.id}</div>
                </button>
              ))}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Nome do Grupo (opcional)</label>
            <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Identificação interna"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">📅 Dia da semana</label>
              <select value={diaSemana} onChange={e => setDiaSemana(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500">
                {DIAS.map(d => <option key={d.v} value={d.v}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">⏰ Horário</label>
              <input type="time" value={horario} onChange={e => setHorario(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500" />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
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
          <div className="bg-[#e5ddd5] rounded-xl p-3 min-h-[200px]">
            <div className="bg-white rounded-lg p-3 shadow-sm text-sm text-gray-800 whitespace-pre-wrap font-mono">
              {preview || 'Sem vagas em aberto no momento.'}
            </div>
          </div>
          <p className="text-[11px] text-gray-500 mt-2">
            ⚠️ O <strong>"Testar Envio"</strong> manda agora mesmo pro grupo (mensagem + PDF), pra você ver como fica.
          </p>
        </div>
      </div>
    </div>
  );
}
