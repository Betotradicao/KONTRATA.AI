import { useEffect, useState } from 'react';
import api from '../../utils/api';
import RhEscalaMemoria from '../../pages/RhEscalaMemoria';

// Agente Compliance — responde dúvidas de norma interna / regulamento / feedback
// DENTRO de um grupo de WhatsApp, quando acionado por uma palavra-gatilho.
// Ex.: "Helen, segundo nossa norma interna isso é permitido?"
//
// Sub-abas: Atendimento (grupo+gatilho) | Persona | Base de Conhecimento (PDFs).

const MODELOS = [
  { id: 'gpt-5.2',      nome: 'GPT-5.2 (mais avancado)' },
  { id: 'gpt-5-mini',   nome: 'GPT-5 Mini (recomendado)' },
  { id: 'gpt-4.1',      nome: 'GPT-4.1 (balanceado)' },
  { id: 'gpt-4.1-mini', nome: 'GPT-4.1 Mini (economico)' },
  { id: 'gpt-4o',       nome: 'GPT-4o' },
  { id: 'gpt-4o-mini',  nome: 'GPT-4o Mini (mais barato)' },
];

const TONS = [
  { id: 'profissional', nome: 'Profissional e direto' },
  { id: 'formal',       nome: 'Formal e tecnico' },
  { id: 'acolhedor',    nome: 'Profissional e acolhedor' },
  { id: 'objetivo',     nome: 'Curto e objetivo' },
];

// Pastas da Base de Conhecimento do Compliance (todas aceitam upload de PDF).
const COMPLIANCE_TIPOS = [
  { key: 'sindicato',            label: 'Sindicato',            icon: '⚖️',  cor: 'red' },
  { key: 'acordo_coletivo',      label: 'Acordo Coletivo',      icon: '🤝',  cor: 'rose' },
  { key: 'regimento_interno',    label: 'Regimento Interno',    icon: '📜',  cor: 'orange' },
  { key: 'aprendizado_feedback', label: 'Aprendizados / Feedbacks', icon: '🎓', cor: 'indigo' },
  { key: 'outro',                label: 'Outros',               icon: '📝',  cor: 'gray' },
];
const COMPLIANCE_TIPOS_UPLOAD = ['sindicato', 'acordo_coletivo', 'regimento_interno', 'aprendizado_feedback', 'outro'];

const PERSONA_DEFAULT = `Especialista em compliance trabalhista e politicas internas de supermercados. Conhece CLT, NR-1, regimento interno e boas praticas de gestao de pessoas. PRIORIDADE: responde primeiro com base no regimento interno / documentos cadastrados na Base de Conhecimento. So quando NAO encontra a resposta nos documentos internos e que complementa com conhecimento geral — e nesse caso AVISA claramente que nao achou no regimento interno. Nunca inventa regra do regimento.`;

const INSTRUCOES_DEFAULT = `## ORDEM DE BUSCA (sempre nesta ordem)
1. PRIMEIRO procure a resposta no REGIMENTO INTERNO / documentos cadastrados na Base de Conhecimento.
2. Se encontrou: responda citando a fonte (ex: "Regimento Interno, item X").
3. Se NAO encontrou no regimento interno: voce PODE dar uma orientacao geral (conhecimento geral / boas praticas / CLT), MAS comece a resposta avisando:
   "⚠️ Nao encontrei isso no regimento interno cadastrado. A orientacao abaixo e geral — confirme com o RH."

## REGRAS ABSOLUTAS
- NUNCA invente artigo, numero ou regra do regimento interno que nao esteja nos documentos.
- Sempre deixe claro o que veio do regimento interno x o que e orientacao geral.
- Em caso de feedback a colaborador, sugira a abordagem com respeito e mantendo a dignidade da pessoa.
- Respostas em pt-BR, curtas e diretas (e um grupo de WhatsApp).`;

export default function AgenteComplianceConfig() {
  const [subAba, setSubAba] = useState('atendimento'); // 'atendimento' | 'persona' | 'base'
  const [form, setForm] = useState({
    nome_agente: 'COMPLIANCE',
    grupo_id: '',
    grupo_nome: '',
    gatilho: 'Helen',
    ativo: false,
    persona: PERSONA_DEFAULT,
    tom: 'profissional',
    modelo: 'gpt-4o-mini',
    instrucoes: INSTRUCOES_DEFAULT,
  });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [gruposDisponiveis, setGruposDisponiveis] = useState([]);
  const [loadingGrupos, setLoadingGrupos] = useState(false);
  const [msg, setMsg] = useState(null);
  // Chat de teste
  const [chat, setChat] = useState([]); // [{role, content, fonte?}]
  const [chatInput, setChatInput] = useState('');
  const [testando, setTestando] = useState(false);

  const flash = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 5000); };
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    api.get('/config/configurations')
      .then(({ data }) => {
        const cfg = data?.data || data || {};
        setForm(f => ({
          ...f,
          nome_agente: cfg.compliance_nome_agente || f.nome_agente,
          grupo_id: cfg.compliance_grupo_id || '',
          grupo_nome: cfg.compliance_grupo_nome || '',
          gatilho: cfg.compliance_gatilho || f.gatilho,
          ativo: cfg.compliance_ativo === 'true',
          persona: cfg.compliance_persona?.trim() ? cfg.compliance_persona : f.persona,
          tom: cfg.compliance_tom || f.tom,
          modelo: cfg.compliance_modelo || f.modelo,
          instrucoes: cfg.compliance_instrucoes?.trim() ? cfg.compliance_instrucoes : f.instrucoes,
        }));
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, []);

  const carregarGrupos = async () => {
    setLoadingGrupos(true);
    try {
      const { data } = await api.get('/whatsapp/fetch-groups');
      if (data && data.success === false) {
        flash('Evolution: ' + (data.error || 'falha ao buscar grupos'), false);
        return;
      }
      let lista = [];
      if (Array.isArray(data.data)) lista = data.data;
      else if (data.data && Array.isArray(data.data.groups)) lista = data.data.groups;
      else if (Array.isArray(data)) lista = data;
      const mapeados = lista
        .map(g => ({ id: g.id, nome: g.subject || g.name || g.id }))
        .filter(g => g.id)
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
      setGruposDisponiveis(mapeados);
      if (mapeados.length === 0) flash('Nenhum grupo encontrado nesta instância.', false);
      else flash(`✓ ${mapeados.length} grupos carregados`);
    } catch (e) {
      flash('Erro ao carregar grupos: ' + (e.response?.data?.error || e.message), false);
    } finally {
      setLoadingGrupos(false);
    }
  };

  // Carrega os grupos automaticamente ao abrir (a chamada à Evolution leva alguns segundos).
  useEffect(() => { carregarGrupos(); }, []);

  const salvar = async () => {
    if (!form.gatilho.trim()) { flash('Defina a palavra de ativação.', false); return; }
    setSalvando(true);
    setSalvo(false);
    try {
      await api.post('/config/configurations', {
        compliance_nome_agente: form.nome_agente || 'COMPLIANCE',
        compliance_grupo_id: form.grupo_id || ' ',
        compliance_grupo_nome: form.grupo_nome || ' ',
        compliance_gatilho: form.gatilho || 'Helen',
        compliance_ativo: form.ativo ? 'true' : 'false',
        compliance_persona: form.persona || ' ',
        compliance_tom: form.tom || 'profissional',
        compliance_modelo: form.modelo || 'gpt-4o-mini',
        compliance_instrucoes: form.instrucoes || ' ',
      });
      setSalvo(true);
      setTimeout(() => setSalvo(false), 3000);
    } catch (e) {
      flash(e.response?.data?.error || e.message, false);
    } finally {
      setSalvando(false);
    }
  };

  const enviarTeste = async () => {
    const pergunta = chatInput.trim();
    if (!pergunta) return;
    const novoChat = [...chat, { role: 'user', content: pergunta }];
    setChat(novoChat);
    setChatInput('');
    setTestando(true);
    try {
      const { data } = await api.post('/rh/compliance/chat', {
        messages: novoChat.map(m => ({ role: m.role, content: m.content })),
      });
      setChat(c => [...c, { role: 'assistant', content: data.reply || '(sem resposta)', fonte: data.fonte }]);
    } catch (e) {
      setChat(c => [...c, { role: 'assistant', content: '❌ ' + (e.response?.data?.error || e.message), fonte: 'erro' }]);
    } finally {
      setTestando(false);
    }
  };

  if (carregando) return <div className="text-sm text-gray-500 p-6">Carregando configuração do agente...</div>;

  const SubTab = ({ id, children }) => (
    <button
      onClick={() => setSubAba(id)}
      className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
        subAba === id ? 'border-teal-500 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="space-y-5">
      {/* Cabeçalho explicativo */}
      <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="text-3xl">🛡️</div>
          <div className="flex-1">
            <h3 className="font-semibold text-teal-900">Agente Compliance — {form.nome_agente}</h3>
            <p className="text-sm text-teal-700 mt-0.5">
              Responde dúvidas de <strong>norma interna / regimento / feedback</strong> dentro de um grupo de WhatsApp,
              quando alguém chama pela palavra de ativação. Ex.: <em>"{form.gatilho}, segundo nossa norma interna isso é permitido?"</em>
            </p>
          </div>
        </div>
      </div>

      {/* Sub-abas */}
      <div className="flex gap-1 border-b border-gray-200">
        <SubTab id="atendimento">💬 Atendimento</SubTab>
        <SubTab id="persona">🎭 Persona</SubTab>
        <SubTab id="base">🧠 Base de Conhecimento</SubTab>
        <SubTab id="testar">🧪 Testar</SubTab>
      </div>

      {msg && (
        <div className={`text-sm rounded-lg px-3 py-2 ${msg.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.text}
        </div>
      )}

      {/* ===== Base de Conhecimento (vault próprio) ===== */}
      {subAba === 'base' && (
        <div className="-mx-6 -mb-6" style={{ height: 'calc(100vh - 320px)' }}>
          <RhEscalaMemoria
            apiBase="/rh/compliance/memoria"
            tipos={COMPLIANCE_TIPOS}
            tiposUpload={COMPLIANCE_TIPOS_UPLOAD}
            titulo="Base de Conhecimento do Compliance"
          />
        </div>
      )}

      {/* ===== Testar (chat) ===== */}
      {subAba === 'testar' && (
        <div className="border border-gray-200 rounded-xl p-4 space-y-3">
          <h4 className="font-bold text-gray-800 flex items-center gap-2">🧪 Testar o agente</h4>
          <p className="text-xs text-gray-500">
            Pergunte como se fosse no WhatsApp. Ele busca primeiro na Base de Conhecimento; se não achar, avisa e pesquisa na web.
            <strong> Salve a configuração antes de testar.</strong>
          </p>
          <div className="border border-gray-200 rounded-lg bg-gray-50 p-3 h-80 overflow-y-auto space-y-2">
            {chat.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-10">
                Faça uma pergunta. Ex.: <em>"Segundo o regimento interno, posso faltar no aniversário?"</em>
              </p>
            )}
            {chat.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.role === 'user' ? 'bg-teal-600 text-white' : 'bg-white border border-gray-200 text-gray-800'
                }`}>
                  {m.role === 'assistant' && m.fonte && (
                    <div className="text-[10px] font-bold uppercase mb-1 opacity-70">
                      {m.fonte === 'interno' ? '📚 Regimento interno' : m.fonte === 'web' ? '🌐 Busca web' : m.fonte === 'geral' ? '💡 Orientação geral' : '⚠️ Erro'}
                    </div>
                  )}
                  {m.content}
                </div>
              </div>
            ))}
            {testando && <div className="text-xs text-gray-400 italic">Pensando...</div>}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !testando) enviarTeste(); }}
              placeholder="Digite sua pergunta..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <button
              onClick={enviarTeste}
              disabled={testando || !chatInput.trim()}
              className="px-4 py-2 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm"
            >
              {testando ? '...' : 'Enviar'}
            </button>
            {chat.length > 0 && (
              <button onClick={() => setChat([])} className="px-3 py-2 text-gray-500 hover:bg-gray-100 rounded-lg text-sm">Limpar</button>
            )}
          </div>
        </div>
      )}

      {/* ===== Atendimento: grupo + gatilho ===== */}
      {subAba === 'atendimento' && (
        <div className="border border-gray-200 rounded-xl p-4 space-y-4">
          <h4 className="font-bold text-gray-800 flex items-center gap-2">💬 Onde e como ele atende</h4>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-600">Grupo do WhatsApp onde o agente funciona</label>
              <button
                onClick={carregarGrupos}
                disabled={loadingGrupos}
                className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded font-semibold disabled:opacity-50"
              >
                {loadingGrupos ? '...' : '🔄 Carregar Grupos'}
              </button>
            </div>
            <select
              value={form.grupo_id}
              onChange={(e) => {
                const g = gruposDisponiveis.find(x => x.id === e.target.value);
                setForm(f => ({ ...f, grupo_id: e.target.value, grupo_nome: g?.nome || f.grupo_nome }));
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">
                {form.grupo_id ? `(atual) ${form.grupo_nome || form.grupo_id}` : '— selecione um grupo —'}
              </option>
              {gruposDisponiveis.map(g => (
                <option key={g.id} value={g.id}>{g.nome}</option>
              ))}
            </select>
            {form.grupo_id && (
              <p className="text-[11px] text-gray-500 mt-1">Selecionado: <strong>{form.grupo_nome || form.grupo_id}</strong></p>
            )}
            <p className="text-[11px] text-gray-400 mt-1">
              Clique em "Carregar Grupos" (puxa da Evolution API, igual à aba Grupos de Whats) e escolha um.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Palavra de ativação (gatilho)</label>
              <input
                type="text"
                value={form.gatilho}
                onChange={(e) => upd('gatilho', e.target.value)}
                placeholder="Ex: Helen"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                O agente só responde quando a mensagem começa com essa palavra. Ex.: <em>"{form.gatilho || 'Helen'}, isso é permitido?"</em>
              </p>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm cursor-pointer pb-2">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(e) => upd('ativo', e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="font-semibold">Agente ativo (escutando o grupo)</span>
              </label>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            🚧 <strong>Falta ligar a escuta real no WhatsApp</strong> (webhook que recebe a mensagem do grupo, detecta o gatilho e responde). Esta tela já guarda grupo e gatilho.
          </div>

          <BotaoSalvar salvar={salvar} salvando={salvando} salvo={salvo} />
        </div>
      )}

      {/* ===== Persona ===== */}
      {subAba === 'persona' && (
        <div className="border border-gray-200 rounded-xl p-4 space-y-4">
          <h4 className="font-bold text-gray-800 flex items-center gap-2">🎭 Como ele pensa e responde</h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nome do Agente</label>
              <input
                type="text"
                value={form.nome_agente}
                onChange={(e) => upd('nome_agente', e.target.value.toUpperCase())}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Tom de comunicação</label>
              <select
                value={form.tom}
                onChange={(e) => upd('tom', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {TONS.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Modelo de IA</label>
              <select
                value={form.modelo}
                onChange={(e) => upd('modelo', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {MODELOS.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">🎭 Persona (system prompt — como ele pensa)</label>
            <textarea
              value={form.persona}
              onChange={(e) => upd('persona', e.target.value)}
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Instruções / regras absolutas</label>
            <textarea
              value={form.instrucoes}
              onChange={(e) => upd('instrucoes', e.target.value)}
              rows={10}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono leading-relaxed"
            />
            <p className="text-[11px] text-gray-400 mt-1">Vão direto pro system prompt. Aceita markdown.</p>
          </div>

          <BotaoSalvar salvar={salvar} salvando={salvando} salvo={salvo} />
        </div>
      )}
    </div>
  );
}

function BotaoSalvar({ salvar, salvando, salvo }) {
  return (
    <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
      <button
        onClick={salvar}
        disabled={salvando}
        className="px-5 py-2 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50 transition text-sm"
      >
        {salvando ? 'Salvando...' : salvo ? '✓ Salvo!' : '💾 Salvar Configuração'}
      </button>
    </div>
  );
}
