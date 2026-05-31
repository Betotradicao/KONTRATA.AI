import { useEffect, useState } from 'react';
import api from '../../utils/api';
import RhEscalaMemoria from '../../pages/RhEscalaMemoria';
import AgenteEscalaDados from './AgenteEscalaDados';

// Configuracao da persona/regras do Assistente de Escala.
// Espelha o padrao da Helen (Entrevistador Digital).

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
  { id: 'descontraido', nome: 'Descontraido e proximo' },
  { id: 'formal',       nome: 'Formal e tecnico' },
  { id: 'empolgado',    nome: 'Empolgado e motivador' },
];

const PERSONA_DEFAULT = `Especialista em gestao de equipes de supermercado e legislacao trabalhista brasileira (CLT, NR-1). Mais de 15 anos de experiencia em varejo alimentar, com vivencia pratica em escala 6x1, 5x2, alternancia de domingos e feriados. Conhece a fundo as particularidades de cada setor (acougue, padaria, hortifruti, frente de caixa, reposicao, mercearia).`;

const INSTRUCOES_DEFAULT = `## REGRAS POR DEFAULT (siga sempre, EXCETO se o RH pedir explicitamente o contrario)

### CLT
- Interjornada minima de 11h entre turnos
- Descanso Semanal Remunerado (DSR) garantido
- Limite de 44h semanais (ou 220h mensais)
- Hora extra so com autorizacao do RH

### NR-1
- Considerar riscos psicossociais (sobrecarga, escala apertada demais)
- Avisar se a proposta gera sobrecarga repetida no mesmo colaborador

### Etica (sempre validas, nem sob pedido)
- NUNCA escalar alguem em ferias, atestado ou licenca
- NUNCA inventar dados que nao estao no contexto
- Quando faltar informacao, PEDIR ao RH em vez de chutar

### Quando o RH pede pra quebrar uma regra
- Pode sugerir cenarios fora do padrao (ex: "e se eu cortasse o DSR de fulano essa semana?")
- MAS sempre AVISAR no inicio: "⚠️ Essa proposta quebra a regra X (motivo)."
- Mostrar o RISCO concreto (multa, processo, sobrecarga)
- Mostrar uma ALTERNATIVA que respeita a regra
- Decisao final e do RH

### Estilo
- Respostas em pt-BR, diretas e praticas
- Use bullet points quando a resposta tem 3+ pontos
- Se sugerir mudanca, mostre o ANTES e o DEPOIS`;

const EMOJIS = ['👩‍💼', '👨‍💼', '🤖', '🧠', '👩‍🏫', '👨‍🏫', '🦸‍♀️', '🦸', '🧑‍💻', '🧙‍♀️'];

export default function AgenteEscalaConfig() {
  const [form, setForm] = useState({
    nome_agente: 'Assistente de Escala',
    avatar_emoji: '👩‍💼',
    cor_tema: 'purple',
    saudacao_inicial: 'Oi! 👋 Eu sou a **{nome}**. Posso analisar a cobertura, simular trocas, sugerir ajustes baseado nas suas regras CLT e do setor. Pergunta aí 👇',
    persona_descricao: PERSONA_DEFAULT,
    tom_comunicacao: 'profissional',
    modelo_ia: 'gpt-4o-mini',
    max_tokens_resposta: 1200,
    temperatura: 0.7,
    timeout_segundos: 60,
    instrucoes_extras: INSTRUCOES_DEFAULT,
    usar_vault: true,
    sugerir_memoria: true,
  });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [testando, setTestando] = useState(false);
  const [respostaTeste, setRespostaTeste] = useState(null);

  useEffect(() => {
    api.get('/rh/escala/agente-ia/config')
      .then(r => {
        if (r.data && Object.keys(r.data).length) {
          setForm(f => ({
            ...f,
            ...r.data,
            temperatura: Number(r.data.temperatura ?? f.temperatura),
            max_tokens_resposta: Number(r.data.max_tokens_resposta ?? f.max_tokens_resposta),
            timeout_segundos: Number(r.data.timeout_segundos ?? f.timeout_segundos),
          }));
        }
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, []);

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const salvar = async () => {
    setSalvando(true);
    setSalvo(false);
    try {
      await api.put('/rh/escala/agente-ia/config', form);
      setSalvo(true);
      setTimeout(() => setSalvo(false), 3000);
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    } finally {
      setSalvando(false);
    }
  };

  const testar = async () => {
    setTestando(true);
    setRespostaTeste(null);
    try {
      const { data } = await api.post('/rh/escala/agente-ia/chat', {
        messages: [{ role: 'user', content: 'Se apresente em uma frase pra eu ver como voce esta configurado.' }],
        contexto: { _teste: true },
      });
      setRespostaTeste(data.reply || '(sem resposta)');
    } catch (e) {
      setRespostaTeste('❌ ' + (e.response?.data?.error || e.message));
    } finally {
      setTestando(false);
    }
  };

  const [subAba, setSubAba] = useState('persona'); // 'persona' | 'vault' | 'dados'

  if (carregando) return <div className="text-sm text-gray-500 p-6">Carregando configuracao do agente...</div>;

  return (
    <div className="space-y-5">
      {/* Sub-tabs: Persona | Vault */}
      <div className="flex gap-1 border-b border-gray-200 -mt-2">
        <button
          onClick={() => setSubAba('persona')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
            subAba === 'persona'
              ? 'border-purple-500 text-purple-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          🎭 Treinar Persona
        </button>
        <button
          onClick={() => setSubAba('vault')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
            subAba === 'vault'
              ? 'border-purple-500 text-purple-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          🧠 Vault de Memória
        </button>
        <button
          onClick={() => setSubAba('dados')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
            subAba === 'dados'
              ? 'border-purple-500 text-purple-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          🔍 Dados Acessíveis
        </button>
      </div>

      {subAba === 'vault' && (
        <div className="-mx-6 -mb-6" style={{ height: 'calc(100vh - 280px)' }}>
          <RhEscalaMemoria />
        </div>
      )}

      {subAba === 'dados' && <AgenteEscalaDados />}

      {subAba === 'persona' && (<>
      {/* Card explicativo */}
      <div className="bg-gradient-to-r from-purple-50 to-fuchsia-50 border border-purple-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="text-3xl">{form.avatar_emoji}</div>
          <div className="flex-1">
            <h3 className="font-semibold text-purple-900">{form.nome_agente}</h3>
            <p className="text-sm text-purple-700 mt-0.5">
              Aqui voce "treina" a personalidade do Assistente de Escala. Tudo que escrever aqui e injetado no system prompt e define como ele vai responder no chat de cada tela de Escala.
            </p>
          </div>
        </div>
      </div>

      {/* Nome + Avatar + Tom */}
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
          <label className="block text-xs font-semibold text-gray-600 mb-1">Avatar (emoji)</label>
          <div className="flex flex-wrap gap-1">
            {EMOJIS.map(e => (
              <button
                key={e}
                type="button"
                onClick={() => upd('avatar_emoji', e)}
                className={`text-2xl w-10 h-10 rounded-lg border-2 transition ${form.avatar_emoji === e ? 'border-purple-500 bg-purple-50' : 'border-transparent hover:border-gray-300'}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Tom de comunicação</label>
          <select
            value={form.tom_comunicacao}
            onChange={(e) => upd('tom_comunicacao', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            {TONS.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </div>
      </div>

      {/* Saudacao Inicial (recepcao no chat) */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">
          💬 Saudação inicial (recepção exibida no chat)
        </label>
        <textarea
          value={form.saudacao_inicial}
          onChange={(e) => upd('saudacao_inicial', e.target.value)}
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          placeholder="Oi! Eu sou a {nome}. Como posso ajudar?"
        />
        <p className="text-[11px] text-gray-400 mt-1">
          A mensagem que aparece quando o usuário abre o chat. Aceita markdown (**negrito**, listas) e o placeholder <code className="bg-gray-100 px-1">{'{nome}'}</code> vira o nome do agente.
        </p>
      </div>

      {/* Persona */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">
          🎭 Persona / Descrição do Agente (system prompt — afeta como ele PENSA)
        </label>
        <textarea
          value={form.persona_descricao}
          onChange={(e) => upd('persona_descricao', e.target.value)}
          rows={4}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          placeholder="Quem ele é, experiência, abordagem..."
        />
        <p className="text-[11px] text-gray-400 mt-1">Identidade técnica injetada no system prompt — afeta vocabulário, profundidade e foco das respostas. <strong>Não aparece no chat pro usuário.</strong></p>
      </div>

      {/* Modelo + limites */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Modelo de IA</label>
          <select
            value={form.modelo_ia}
            onChange={(e) => upd('modelo_ia', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            {MODELOS.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Max tokens</label>
          <input
            type="number"
            value={form.max_tokens_resposta}
            onChange={(e) => upd('max_tokens_resposta', parseInt(e.target.value) || 0)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Temperatura</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="2"
            value={form.temperatura}
            onChange={(e) => upd('temperatura', parseFloat(e.target.value) || 0)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <p className="text-[10px] text-gray-400 mt-0.5">0 = preciso · 1 = balanceado · 2 = criativo</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Timeout (segundos)</label>
          <input
            type="number"
            value={form.timeout_segundos}
            onChange={(e) => upd('timeout_segundos', parseInt(e.target.value) || 0)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.usar_vault}
              onChange={(e) => upd('usar_vault', e.target.checked)}
              className="w-4 h-4"
            />
            <span>Consultar o Vault de Memória</span>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.sugerir_memoria}
              onChange={(e) => upd('sugerir_memoria', e.target.checked)}
              className="w-4 h-4"
            />
            <span>Sugerir salvar memórias</span>
          </label>
        </div>
      </div>

      {/* Instrucoes Extras */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">
          Instruções extras (regras absolutas para a IA)
        </label>
        <textarea
          value={form.instrucoes_extras}
          onChange={(e) => upd('instrucoes_extras', e.target.value)}
          rows={14}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono leading-relaxed"
          placeholder="## REGRAS ABSOLUTAS&#10;..."
        />
        <p className="text-[11px] text-gray-400 mt-1">Vão direto pro system prompt — funcionam em TODAS as conversas. Aceita markdown.</p>
      </div>

      {/* Botoes */}
      <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
        <button
          onClick={salvar}
          disabled={salvando}
          className="flex items-center gap-2 px-5 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 transition text-sm"
        >
          {salvando ? 'Salvando...' : salvo ? '✓ Salvo!' : '💾 Salvar Configuração'}
        </button>
        <button
          onClick={testar}
          disabled={testando}
          className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition text-sm"
        >
          {testando ? 'Testando...' : '🧪 Testar Agente'}
        </button>
      </div>

      {/* Resultado teste */}
      {respostaTeste && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-blue-700 mb-2">Resposta do agente:</p>
          <p className="text-sm text-blue-900 whitespace-pre-wrap">{respostaTeste}</p>
        </div>
      )}
      </>)}
    </div>
  );
}
