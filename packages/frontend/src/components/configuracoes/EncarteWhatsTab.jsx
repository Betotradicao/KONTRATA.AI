import { useState, useEffect } from 'react';
import api from '../../services/api';

/**
 * GRUPOS PRO ENCARTE DE VAGA
 * --------------------------
 * Escolhe pra quais grupos de WhatsApp vão as artes geradas em
 * Configurações RH → Padrão de Encarte.
 *
 * Config PRÓPRIA (`whatsapp_encarte_*`), separada do Disparo de Vagas: aquele é
 * agendado e periódico, este é manual e pontual — e o RH costuma querer grupos
 * diferentes pra cada um.
 */
export default function EncarteWhatsTab() {
  const [grupos, setGrupos] = useState([]);
  const [disponiveis, setDisponiveis] = useState([]);
  const [intervalo, setIntervalo] = useState('5');
  const [legenda, setLegenda] = useState('');
  const [carregandoGrupos, setCarregandoGrupos] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState(null);

  const flash = (m, ok = true) => { setMsg({ m, ok }); setTimeout(() => setMsg(null), 4000); };

  useEffect(() => {
    api.get('/config/configurations').then(r => {
      const c = r.data?.data || r.data || {};
      try {
        const p = JSON.parse(c.whatsapp_encarte_grupos || '[]');
        setGrupos(Array.isArray(p) ? p : []);
      } catch { setGrupos([]); }
      setIntervalo(c.whatsapp_encarte_intervalo || '5');
      setLegenda(c.whatsapp_encarte_legenda || '');
    }).catch(() => {});
  }, []);

  const carregarGrupos = async () => {
    setCarregandoGrupos(true);
    try {
      const { data } = await api.get('/whatsapp/fetch-groups');
      // ⚠️ Este endpoint responde HTTP 200 mesmo quando falha, com success:false
      // e o motivo real dentro. Sem tratar isso, um timeout da Evolution vira
      // "Nenhum grupo encontrado" e ninguem descobre o que aconteceu.
      if (data?.success === false) {
        flash(`Evolution API: ${data.error || 'falha ao buscar grupos'}`, false);
        return;
      }
      let lista = [];
      if (Array.isArray(data.data)) lista = data.data;
      else if (data.data && Array.isArray(data.data.groups)) lista = data.data.groups;
      setDisponiveis(lista.map(g => ({ id: g.id, nome: g.subject || g.name || g.id })));
      if (!lista.length) flash('Conectou, mas a instância não tem nenhum grupo.', false);
    } catch (e) {
      flash('Erro ao carregar grupos: ' + (e.response?.data?.error || e.message), false);
    } finally { setCarregandoGrupos(false); }
  };

  const addGrupo = (g = { id: '', nome: '' }) => {
    if (g.id && grupos.some(x => x.id === g.id)) { flash('Esse grupo já está na lista.', false); return; }
    setGrupos(gs => [...gs, { id: g.id || '', nome: g.nome || '' }]);
  };

  const alterar = (i, campo, v) => setGrupos(gs => gs.map((g, k) => (k === i ? { ...g, [campo]: v } : g)));
  const remover = (i) => setGrupos(gs => gs.filter((_, k) => k !== i));

  const salvar = async () => {
    setSalvando(true);
    try {
      // ⚠️ O endpoint espera um objeto PLANO { chave: valor-string }. Mandar
      // aninhado em `configurations` ou como { value } grava lixo em silêncio:
      // a tela diz "salvo" e nada chega no banco.
      // ⚠️ E ele PULA string vazia — por isso o `|| ' '` (mesmo truque da aba de
      // Disparo de Vagas), senão apagar a legenda nunca persiste.
      const limpos = grupos.filter(g => g.id?.trim());
      await api.post('/config/configurations', {
        whatsapp_encarte_grupos: JSON.stringify(limpos),
        whatsapp_encarte_intervalo: String(intervalo || '5'),
        whatsapp_encarte_legenda: legenda || ' ',
      });
      flash(`Configuração salva — ${limpos.length} grupo(s).`);
    } catch (e) {
      flash('Erro ao salvar: ' + (e.response?.data?.error || e.message), false);
    } finally { setSalvando(false); }
  };

  return (
    <div className="bg-white rounded-lg shadow p-5 space-y-5">
      <div>
        <h3 className="text-lg font-bold text-gray-800">🖼️ Encartes de Vaga</h3>
        <p className="text-sm text-gray-500 mt-1">
          Grupos que recebem as artes geradas em <strong>Configurações RH → Padrão de Encarte</strong>.
          Lá você clica em “Enviar para o WhatsApp” e a arte cai nestes grupos.
        </p>
      </div>

      {msg && (
        <div className={`px-4 py-2 rounded-lg text-sm ${
          msg.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                 : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg.m}</div>
      )}

      <div className="px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
        Cuidado com banimento: mantenha um intervalo entre os grupos e não exagere na frequência.
        O ideal é usar um número dedicado para disparos.
      </div>

      {/* Grupos */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold text-gray-700">Grupos ({grupos.length})</label>
          <div className="flex gap-2">
            <button onClick={carregarGrupos} disabled={carregandoGrupos}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50">
              {carregandoGrupos ? 'Carregando…' : '🔄 Carregar Grupos'}
            </button>
            <button onClick={() => addGrupo()}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
              + Adicionar grupo
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {grupos.length === 0 && (
            <p className="text-sm text-gray-400 italic py-3">
              Nenhum grupo ainda. Clique em “Carregar Grupos” para puxar do WhatsApp.
            </p>
          )}
          {grupos.map((g, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-6 text-center text-xs text-gray-400">{i + 1}</span>
              <input value={g.id} onChange={(e) => alterar(i, 'id', e.target.value)}
                     placeholder="1203630…@g.us"
                     className="flex-1 border rounded-lg px-3 py-1.5 text-sm font-mono" />
              <input value={g.nome} onChange={(e) => alterar(i, 'nome', e.target.value)}
                     placeholder="Nome do grupo"
                     className="flex-1 border rounded-lg px-3 py-1.5 text-sm" />
              <button onClick={() => remover(i)} className="text-red-500 hover:text-red-700 px-2">✕</button>
            </div>
          ))}
        </div>

        {disponiveis.length > 0 && (
          <div className="mt-3 border rounded-lg p-3 bg-gray-50">
            <p className="text-xs font-semibold text-gray-600 mb-2">Grupos encontrados — clique para adicionar</p>
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
              {disponiveis.map(g => {
                const jaTem = grupos.some(x => x.id === g.id);
                return (
                  <button key={g.id} onClick={() => addGrupo(g)} disabled={jaTem}
                          className={`px-2.5 py-1 rounded-full text-[11px] border ${
                            jaTem ? 'bg-gray-200 text-gray-400 border-gray-200 cursor-not-allowed'
                                  : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400 hover:text-purple-700'}`}>
                    {jaTem ? '✓ ' : '+ '}{g.nome}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Intervalo + legenda */}
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            ⏱️ Intervalo entre grupos <span className="font-normal text-gray-400">(segundos)</span>
          </label>
          <input type="number" min="1" value={intervalo} onChange={(e) => setIntervalo(e.target.value)}
                 className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Legenda padrão <span className="font-normal text-gray-400">(vai junto com a primeira arte)</span>
          </label>
          <textarea rows={3} value={legenda} onChange={(e) => setLegenda(e.target.value)}
                    placeholder={'🚀 *TEMOS VAGA!*\nCadastre seu currículo pelo link da bio.'}
                    className="w-full border rounded-lg px-3 py-2 text-sm resize-y" />
          <p className="text-[11px] text-gray-500 mt-1">
            Você pode trocar esse texto na hora do envio, direto na tela do encarte.
          </p>
        </div>
      </div>

      <div className="flex justify-end pt-2 border-t">
        <button onClick={salvar} disabled={salvando}
                className="px-5 py-2 text-sm font-bold rounded-lg bg-purple-700 text-white hover:bg-purple-800 disabled:opacity-50">
          {salvando ? 'Salvando…' : '💾 Salvar'}
        </button>
      </div>
    </div>
  );
}
