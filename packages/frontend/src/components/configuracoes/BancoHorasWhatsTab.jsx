import { useState, useEffect } from 'react';
import api from '../../utils/api';

const MENSAGEM_PADRAO =
`🏦 *SALDO DE BANCO DE HORAS*

Segue o relatório por loja, atualizado em {data}.

Cada arquivo abaixo é de uma loja, com os colaboradores separados por setor.`;

// getDay: 0=Dom ... 6=Sab
const DIAS_SEMANA = [
  { v: '1', label: 'Seg' }, { v: '2', label: 'Ter' }, { v: '3', label: 'Qua' },
  { v: '4', label: 'Qui' }, { v: '5', label: 'Sex' }, { v: '6', label: 'Sáb' }, { v: '0', label: 'Dom' },
];

export default function BancoHorasWhatsTab() {
  const [grupos, setGrupos] = useState([]);            // [{ id, nome }]
  const [intervalo, setIntervalo] = useState('5');     // segundos entre grupos
  const [mensagem, setMensagem] = useState(MENSAGEM_PADRAO);

  const [modo, setModo] = useState('');
  const [diasSemana, setDiasSemana] = useState([]);    // ['1','2'...] getDay 0=Dom..6=Sab
  const [diaMes, setDiaMes] = useState('1');
  const [horario, setHorario] = useState('08:00');

  const [gruposDisponiveis, setGruposDisponiveis] = useState([]);
  const [loadingGrupos, setLoadingGrupos] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previa, setPrevia] = useState(null);
  const [msg, setMsg] = useState(null);

  const flash = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 6000); };

  useEffect(() => { carregar(); }, []);

  const carregar = async () => {
    try {
      const { data } = await api.get('/config/configurations');
      const cfg = data?.configurations || data || {};
      try {
        const g = JSON.parse(cfg.whatsapp_banco_horas_grupos || '[]');
        if (Array.isArray(g)) setGrupos(g.filter(x => x && x.id));
      } catch { /* config nova ainda nao existe */ }
      setIntervalo(cfg.whatsapp_banco_horas_intervalo || '5');
      setMensagem((cfg.whatsapp_banco_horas_mensagem || '').trim() || MENSAGEM_PADRAO);
      setModo((cfg.whatsapp_banco_horas_modo || '').trim());
      setDiasSemana(String(cfg.whatsapp_banco_horas_dia_semana || '').split(',').map(s => s.trim()).filter(Boolean));
      setDiaMes((cfg.whatsapp_banco_horas_dia_mes || '1').trim());
      setHorario((cfg.whatsapp_banco_horas_horario || '08:00').trim());
    } catch { /* ignore */ }
  };

  const carregarGrupos = async () => {
    setLoadingGrupos(true);
    try {
      const { data } = await api.get('/whatsapp/fetch-groups');
      // ⚠️ Esse endpoint responde HTTP 200 com success:false e o motivo dentro.
      // Ignorar isso faz qualquer falha da Evolution virar "nenhum grupo encontrado".
      if (data && data.success === false) {
        flash('Erro ao carregar grupos: ' + (data.error || data.message || 'a Evolution não respondeu'), false);
        return;
      }
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
  const toggleDia = (v) => setDiasSemana(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);

  const salvar = async () => {
    setSalvando(true);
    try {
      // ⚠️ /config/configurations espera objeto PLANO e PULA string vazia — por isso
      // o `|| ' '`: sem ele, apagar um campo nunca persiste.
      await api.post('/config/configurations', {
        whatsapp_banco_horas_grupos: JSON.stringify(grupos.filter(g => g.id?.trim())),
        whatsapp_banco_horas_intervalo: String(intervalo || '5'),
        whatsapp_banco_horas_mensagem: mensagem || ' ',
        whatsapp_banco_horas_modo: modo || ' ',
        whatsapp_banco_horas_dia_semana: diasSemana.join(',') || ' ',
        whatsapp_banco_horas_dia_mes: String(diaMes || '1'),
        whatsapp_banco_horas_horario: horario || '08:00',
      });
      flash('Configuração salva!');
    } catch (e) {
      flash('Erro ao salvar: ' + (e.response?.data?.error || e.message), false);
    } finally {
      setSalvando(false);
    }
  };

  const previsualizar = async () => {
    setPreviewing(true); setPrevia(null);
    try {
      const { data } = await api.get('/whatsapp/banco-horas/preview');
      if (data.success) setPrevia(data);
      else flash('❌ ' + (data.error || 'Erro na prévia'), false);
    } catch (e) {
      flash('❌ Erro: ' + (e.response?.data?.error || e.message), false);
    } finally {
      setPreviewing(false);
    }
  };

  const disparar = async (teste) => {
    const validos = grupos.filter(g => g.id?.trim());
    if (!validos.length) { flash('Adicione e salve pelo menos 1 grupo antes.', false); return; }
    if (!teste && !window.confirm(`Disparar o Banco de Horas pra ${validos.length} grupo(s), com ${intervalo}s entre cada? (Salve antes se mudou algo.)`)) return;
    setEnviando(true);
    try {
      const { data } = await api.post(`/whatsapp/banco-horas/enviar${teste ? '?teste=true' : ''}`);
      if (data.success) flash('✅ ' + (data.message || 'Disparado!'));
      else flash('❌ ' + (data.error || 'Erro ao disparar'), false);
    } catch (e) {
      flash('❌ Erro: ' + (e.response?.data?.error || e.message), false);
    } finally {
      setEnviando(false);
    }
  };

  const preview = (mensagem || '').replace(/\{data\}/gi, new Date().toLocaleDateString('pt-BR'));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xl">🏦</span>
        <h2 className="text-lg font-semibold text-gray-800">Banco de Horas</h2>
      </div>
      <p className="text-sm text-gray-500">
        Manda o saldo de banco de horas em PDF pros grupos. Gera <strong>um arquivo por loja</strong>, e dentro dele os
        colaboradores vêm <strong>separados por setor</strong>, com subtotal de cada setor e total da loja.
      </p>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
        💡 Os números são os mesmos da tela <strong>RH → Ponto e Ausências → Saldo de Banco</strong> (apuração oficial da RHiD).
        O PDF é montado no servidor, então o agendamento funciona mesmo com o sistema fechado.
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
        ⚠️ <strong>Contém dado de pessoa.</strong> Mande só pra grupos de gestão/RH — nunca pra grupo com o time todo.
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
            {gruposDisponiveis.length > 0 && (
              <div className="mt-2 border border-gray-200 rounded-lg max-h-32 overflow-y-auto divide-y">
                {gruposDisponiveis.map(g => (
                  <button key={g.id} onClick={() => addGrupo(g)}
                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-orange-50">
                    <span className="font-medium text-gray-700">{g.nome}</span>
                    <span className="text-gray-400 ml-1">{g.id}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Intervalo */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">⏱️ Intervalo entre grupos (segundos)</label>
            <input type="number" min="1" value={intervalo} onChange={e => setIntervalo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500" />
          </div>

          {/* Mensagem */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">💬 Mensagem (use {'{data}'})</label>
            <textarea value={mensagem} onChange={e => setMensagem(e.target.value)} rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-orange-500" />
            <p className="text-[10px] text-gray-400 mt-1">O texto vai numa mensagem, e cada PDF logo depois como documento.</p>
          </div>

          {/* Agendamento */}
          <div className="border-t border-gray-200 pt-3 space-y-3">
            <label className="block text-xs font-semibold text-gray-700">📅 Agendamento automático</label>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="modo-banco-horas" checked={modo === 'semana'} onChange={() => setModo('semana')} className="accent-orange-500" /> Toda semana
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="modo-banco-horas" checked={modo === 'mes'} onChange={() => setModo('mes')} className="accent-orange-500" /> 1 vez ao mês
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-gray-500">
                <input type="radio" name="modo-banco-horas" checked={!modo} onChange={() => setModo('')} className="accent-gray-400" /> Desligado (só manual)
              </label>
            </div>

            {modo === 'semana' && (
              <div>
                <div className="text-[11px] text-gray-500 mb-1">Dias da semana (pode marcar vários):</div>
                <div className="flex flex-wrap gap-1">
                  {DIAS_SEMANA.map(d => (
                    <button key={d.v} type="button" onClick={() => toggleDia(d.v)}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold border transition ${diasSemana.includes(d.v) ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}`}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {modo === 'mes' && (
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Dia do mês (1–28)</label>
                <input type="number" min="1" max="28" value={diaMes} onChange={e => setDiaMes(e.target.value)} className="w-24 px-2 py-1 border border-gray-300 rounded text-sm" />
              </div>
            )}

            {modo && (
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">⏰ Horário do disparo</label>
                <input type="time" value={horario} onChange={e => setHorario(e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-sm" />
                <p className="text-[10px] text-gray-400 mt-1">
                  {modo === 'semana'
                    ? `Vai disparar ${diasSemana.length ? 'nos dias marcados' : '(marque os dias)'} às ${horario}.`
                    : `Vai disparar todo dia ${diaMes} do mês às ${horario}.`} (Lembre de Salvar.)
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={salvar} disabled={salvando}
              className="flex-1 min-w-[110px] py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold border border-gray-300 disabled:opacity-60">
              {salvando ? 'Salvando…' : '💾 Salvar'}
            </button>
            <button onClick={() => disparar(true)} disabled={enviando}
              className="flex-1 min-w-[110px] py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold disabled:opacity-60">
              {enviando ? 'Enviando…' : '🧪 Testar (1º grupo)'}
            </button>
            <button onClick={() => disparar(false)} disabled={enviando}
              className="flex-1 min-w-[110px] py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60">
              {enviando ? 'Enviando…' : '🚀 Disparar pra todos'}
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-600">📱 Preview da Mensagem</label>
            <button onClick={previsualizar} disabled={previewing}
              className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-medium disabled:opacity-60">
              {previewing ? 'Montando…' : '👁️ Ver o que será enviado'}
            </button>
          </div>

          <div className="bg-[#e5ddd5] rounded-lg p-3">
            <div className="bg-white rounded-lg p-3 shadow-sm max-w-sm">
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{preview}</p>
            </div>
          </div>

          {previa && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-800 text-white px-3 py-2 text-xs font-bold">
                📎 {previa.lojas?.length || 0} PDF(s) serão enviados
              </div>
              <div className="max-h-72 overflow-y-auto divide-y">
                {(previa.lojas || []).map((l, i) => (
                  <div key={i} className="px-3 py-2">
                    <div className="text-sm font-bold text-gray-800">
                      📄 {l.loja} <span className="text-xs font-normal text-gray-400">({l.colaboradores} colaboradores)</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(l.setores || []).map((s, k) => (
                        <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                          {s.setor} ({s.colaboradores})
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                {!previa.lojas?.length && <p className="text-xs text-gray-400 text-center py-4">Nenhuma loja com colaborador ativo.</p>}
              </div>
            </div>
          )}

          <p className="text-[11px] text-gray-400">
            "Disparar pra todos" envia pros {grupos.filter(g => g.id?.trim()).length} grupo(s) com {intervalo}s entre cada.
            "Testar" manda só pro 1º.
          </p>
        </div>
      </div>
    </div>
  );
}
