import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast, { Toaster } from 'react-hot-toast';

/**
 * ATENDENTE VIRTUAL — cadastro do menu de atendimento do WhatsApp.
 *
 * Escopo enxuto de propósito: menu numerado e respostas. Sem construtor visual
 * de fluxos e sem IA.
 *
 * Uma opção NÃO é uma resposta só: é uma sequência de passos. O bot pode mandar
 * três mensagens, esperar o cliente digitar uma palavra, e só então seguir.
 */

const TIPOS_PASSO = [
  { v: 'texto',     label: '💬 Responder com um texto' },
  { v: 'pergunta',  label: '⏳ Responder e esperar o cliente digitar algo' },
  { v: 'atendente', label: '👤 Passar para um atendente humano' },
  { v: 'encerrar',  label: '👋 Encerrar a conversa' },
];

const AJUDA_TIPO = {
  texto: 'Envia a mensagem e segue para o próximo passo.',
  pergunta: 'Envia a mensagem e fica aguardando. Só continua quando o cliente escrever a palavra abaixo.',
  atendente: 'O bot para de responder este contato. Você libera de volta quando quiser.',
  encerrar: 'Manda a despedida e fecha a conversa.',
};

const passoVazio = () => ({ tipo: 'texto', texto: '', palavra_chave: '' });

export default function AtendenteVirtual() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [cfg, setCfg] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/atendente-virtual/config');
        setCfg({
          ativo: !!data.ativo,
          mensagem_primeira_vez: data.mensagem_primeira_vez || '',
          mensagem_recorrente: data.mensagem_recorrente || '',
          texto_menu: data.texto_menu || '',
          mensagem_nao_entendi: null,
          intervalo_menu_horas: data.intervalo_menu_horas ?? 4,
          simular_digitando: data.simular_digitando !== false,
          segundos_espera: data.segundos_espera ?? 2,
          opcoes: Array.isArray(data.opcoes) ? data.opcoes : [],
        });
      } catch {
        toast.error('Erro ao carregar');
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  const mudar = (campo, valor) => setCfg((c) => ({ ...c, [campo]: valor }));

  const mudarOpcao = (i, campo, valor) =>
    setCfg((c) => {
      const opcoes = [...c.opcoes];
      opcoes[i] = { ...opcoes[i], [campo]: valor };
      return { ...c, opcoes };
    });

  const mudarPasso = (i, j, campo, valor) =>
    setCfg((c) => {
      const opcoes = [...c.opcoes];
      const passos = [...(opcoes[i].passos || [])];
      passos[j] = { ...passos[j], [campo]: valor };
      opcoes[i] = { ...opcoes[i], passos };
      return { ...c, opcoes };
    });

  const addOpcao = () =>
    setCfg((c) => ({
      ...c,
      opcoes: [
        ...c.opcoes,
        { numero: String(c.opcoes.length + 1), label: '', passos: [passoVazio()] },
      ],
    }));

  const removerOpcao = (i) =>
    setCfg((c) => ({ ...c, opcoes: c.opcoes.filter((_, x) => x !== i) }));

  const addPasso = (i) =>
    setCfg((c) => {
      const opcoes = [...c.opcoes];
      opcoes[i] = { ...opcoes[i], passos: [...(opcoes[i].passos || []), passoVazio()] };
      return { ...c, opcoes };
    });

  const removerPasso = (i, j) =>
    setCfg((c) => {
      const opcoes = [...c.opcoes];
      opcoes[i] = { ...opcoes[i], passos: opcoes[i].passos.filter((_, x) => x !== j) };
      return { ...c, opcoes };
    });

  const salvar = async () => {
    // Número repetido faria a segunda opção nunca ser alcançada.
    const nums = cfg.opcoes.map((o) => String(o.numero).trim());
    const rep = nums.find((n, i) => n && nums.indexOf(n) !== i);
    if (rep) return toast.error(`A opção "${rep}" está repetida.`);

    setSalvando(true);
    try {
      await api.put('/atendente-virtual/config', cfg);
      toast.success('Menu salvo!');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  const molde = (conteudo) => (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout}
        isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 overflow-y-auto">{conteudo}</div>
    </div>
  );

  if (carregando) {
    return molde(<div className="p-10 text-center text-gray-400">Carregando…</div>);
  }

  const campo = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent';
  const rotulo = 'block text-xs font-bold text-gray-600 mb-1';

  // Prévia: o menu como o cliente vai ver, com as opções montadas no fim.
  const visiveis = cfg.opcoes.filter((o) => o.numero && o.label);
  const menuMontado =
    (cfg.texto_menu || '(texto do menu)') +
    (visiveis.length ? '\n\n' + visiveis.map((o) => `${o.numero} - ${o.label}`).join('\n') : '');
  const exemplo = visiveis[0];

  return molde(
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <Toaster position="top-right" />

      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">🤖 Atendente Virtual</h1>
          <p className="text-sm text-gray-500">
            Menu automático de atendimento no WhatsApp.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => mudar('ativo', !cfg.ativo)}
            title="Liga e desliga o atendimento automático"
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm border-2 transition-colors ${
              cfg.ativo
                ? 'bg-emerald-50 border-emerald-500 text-emerald-700 hover:bg-emerald-100'
                : 'bg-gray-100 border-gray-400 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <span className={`w-9 h-5 rounded-full relative transition-colors ${
              cfg.ativo ? 'bg-emerald-500' : 'bg-gray-400'
            }`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                cfg.ativo ? 'left-4' : 'left-0.5'
              }`} />
            </span>
            {cfg.ativo ? 'LIGADO' : 'DESLIGADO'}
          </button>
          <button onClick={salvar} disabled={salvando}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white font-bold rounded-lg text-sm">
            {salvando ? 'Salvando…' : '💾 Salvar menu'}
          </button>
        </div>
      </div>

      {cfg.ativo && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-5 text-sm text-emerald-900">
          Ligado. <strong>Clique em "Salvar menu"</strong> para valer — o interruptor sozinho
          não grava nada.
        </div>
      )}

      {!cfg.ativo && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-5 text-sm text-amber-900">
          O atendente está <strong>desligado</strong> — nada é respondido no WhatsApp.
          Ligue na chave acima quando o menu estiver pronto.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          {/* Abertura */}
          <div className="bg-white rounded-xl border p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3">👋 Abertura da conversa</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={rotulo}>Primeira vez que o cliente fala</label>
                <textarea rows={6} value={cfg.mensagem_primeira_vez}
                  onChange={(e) => mudar('mensagem_primeira_vez', e.target.value)} className={campo} />
              </div>
              <div>
                <label className={rotulo}>Quando ele já conhece o bot</label>
                <textarea rows={6} value={cfg.mensagem_recorrente}
                  onChange={(e) => mudar('mensagem_recorrente', e.target.value)} className={campo} />
              </div>
            </div>
          </div>

          {/* Intervalo */}
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
            <label className="text-sm font-bold text-gray-700">⏱️ Só reenviar o menu depois de</label>
            <div className="flex items-center gap-2 mt-2">
              <input type="number" min="0" value={cfg.intervalo_menu_horas}
                onChange={(e) => mudar('intervalo_menu_horas', Number(e.target.value))}
                className="w-24 px-3 py-2 border rounded-lg text-center font-bold text-lg" />
              <span className="text-sm font-bold text-gray-700">horas</span>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              {Number(cfg.intervalo_menu_horas) > 0 ? (
                <>Se o cliente escrever de novo antes de {cfg.intervalo_menu_horas}h sem digitar uma
                  opção válida, o bot manda só um lembrete curto em vez de repetir o menu inteiro.
                  Digitar o número de uma opção funciona sempre.</>
              ) : (
                <><strong>0 = sem limite.</strong> O menu é repetido toda vez que a mensagem não
                  casar com uma opção — quem manda "oi", "bom dia" e "tem pão?" leva três menus
                  seguidos.</>
              )}
            </p>
          </div>

          {/* Fazer parecer gente */}
          <div className="bg-white rounded-xl border p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-1">⌨️ Antes de responder</h3>
            <p className="text-xs text-gray-500 mb-3">
              Resposta instantânea entrega que é robô. Um instante de espera muda a percepção.
            </p>

            <label className="flex items-center gap-2 text-sm cursor-pointer mb-3">
              <input type="checkbox" checked={cfg.simular_digitando}
                onChange={(e) => mudar('simular_digitando', e.target.checked)}
                className="w-4 h-4 accent-purple-600" />
              Mostrar <strong>&quot;digitando…&quot;</strong> no WhatsApp do cliente
            </label>

            <label className={rotulo}>Esperar antes de enviar cada mensagem</label>
            <div className="flex items-center gap-2">
              <input type="number" min="0" max="30" value={cfg.segundos_espera}
                onChange={(e) => mudar('segundos_espera', Number(e.target.value))}
                className="w-24 px-3 py-2 border rounded-lg text-center font-bold text-lg" />
              <span className="text-sm font-bold text-gray-700">segundos</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {Number(cfg.segundos_espera) > 0
                ? `Cada mensagem sai ${cfg.segundos_espera}s depois da anterior. Numa opção com 3 passos, a conversa toda leva ${cfg.segundos_espera * 3}s.`
                : '0 = responde na hora, do jeito que entrega que é automação.'}
            </p>
          </div>

          {/* Texto do menu */}
          <div className="bg-white rounded-xl border p-4">
            <label className="text-sm font-bold text-gray-700">Texto do menu</label>
            <p className="text-xs text-gray-500 mb-2">
              As opções entram sozinhas no fim — não digite "1 - ..." aqui, senão sai duplicado.
            </p>
            <textarea rows={3} value={cfg.texto_menu}
              onChange={(e) => mudar('texto_menu', e.target.value)}
              placeholder={'*MENU DE ATENDIMENTO*\n\nDigite o número da opção desejada:'}
              className={campo} />
          </div>

          {/* Opções */}
          {cfg.opcoes.map((o, i) => (
            <div key={i} className="bg-white rounded-xl border-2 border-purple-100 p-4">
              <div className="flex gap-3 items-start pb-3 border-b">
                <div className="w-20">
                  <label className={rotulo}>Cliente digita</label>
                  <input value={o.numero} onChange={(e) => mudarOpcao(i, 'numero', e.target.value)}
                    className="w-full px-2 py-2 border rounded-lg text-center font-bold text-lg" placeholder="1" />
                </div>
                <div className="flex-1">
                  <label className={rotulo}>Aparece no menu</label>
                  <input value={o.label} onChange={(e) => mudarOpcao(i, 'label', e.target.value)}
                    className={campo} placeholder="Ofertas e Promoções" />
                </div>
                <button onClick={() => removerOpcao(i)} title="Remover opção inteira"
                  className="mt-6 px-2 py-2 text-red-500 hover:bg-red-50 rounded">🗑️</button>
              </div>

              <div className="mt-3 space-y-3">
                {(o.passos || []).map((p, j) => (
                  <div key={j} className="border-l-4 border-purple-300 bg-gray-50 rounded-r-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[11px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                        Passo {j + 1}
                      </span>
                      <select value={p.tipo} onChange={(e) => mudarPasso(i, j, 'tipo', e.target.value)}
                        className="flex-1 px-2 py-1.5 border rounded bg-white text-sm">
                        {TIPOS_PASSO.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                      </select>
                      {(o.passos || []).length > 1 && (
                        <button onClick={() => removerPasso(i, j)} title="Remover passo"
                          className="px-2 py-1 text-red-400 hover:bg-red-50 rounded text-sm">✕</button>
                      )}
                    </div>

                    <label className={rotulo}>
                      {p.tipo === 'atendente' ? 'Mensagem antes de passar pro atendente'
                        : p.tipo === 'encerrar' ? 'Mensagem de despedida'
                        : 'O que o bot envia'}
                    </label>
                    <textarea rows={4} value={p.texto}
                      onChange={(e) => mudarPasso(i, j, 'texto', e.target.value)} className={campo} />

                    {p.tipo === 'pergunta' && (
                      <div className="mt-2">
                        <label className="text-[11px] font-bold text-purple-800 block mb-1">
                          ⏳ ...e espera o cliente digitar
                        </label>
                        <input value={p.palavra_chave || ''}
                          onChange={(e) => mudarPasso(i, j, 'palavra_chave', e.target.value)}
                          className="w-56 px-3 py-2 border-2 border-purple-300 rounded-lg font-bold"
                          placeholder="salvei" />
                        <span className="text-[10px] text-gray-400 ml-2">
                          Não diferencia maiúscula nem acento.
                        </span>
                      </div>
                    )}

                    <p className="text-[11px] text-gray-400 mt-2">{AJUDA_TIPO[p.tipo]}</p>
                  </div>
                ))}
              </div>

              <button onClick={() => addPasso(i)}
                className="mt-3 w-full py-2 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-50 hover:border-purple-400 hover:text-purple-700">
                + Adicionar passo nesta opção
              </button>
            </div>
          ))}

          <button onClick={addOpcao}
            className="w-full py-3 border-2 border-dashed border-purple-400 text-purple-700 rounded-xl font-bold hover:bg-purple-50">
            + Adicionar opção no menu
          </button>

          <div className="bg-gray-50 rounded-xl border border-dashed p-4 text-xs text-gray-500">
            Quando o cliente escreve algo fora do menu dentro do intervalo acima, o bot
            <strong> fica em silêncio</strong> — em vez de responder &quot;não entendi&quot;, que
            vira eco chato em quem só mandou &quot;oi&quot; ou &quot;bom dia&quot;.
          </div>
        </div>

        {/* Prévia */}
        <div>
          <div className="bg-white rounded-xl border p-4 sticky top-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3">📱 Prévia no WhatsApp</h3>
            <div className="bg-[#e5ddd5] rounded-lg p-3 space-y-2 max-h-[70vh] overflow-y-auto">
              {cfg.mensagem_primeira_vez && (
                <div className="bg-white rounded-lg p-2 text-xs whitespace-pre-wrap shadow-sm">
                  {cfg.mensagem_primeira_vez}
                </div>
              )}
              <div className="bg-white rounded-lg p-2 text-xs whitespace-pre-wrap shadow-sm">
                {menuMontado}
              </div>
              {exemplo && (
                <>
                  <div className="bg-[#dcf8c6] rounded-lg p-2 text-xs ml-8 shadow-sm">{exemplo.numero}</div>
                  {(exemplo.passos || []).map((p, j) => (
                    <div key={j}>
                      {p.texto && (
                        <div className="bg-white rounded-lg p-2 text-xs whitespace-pre-wrap shadow-sm mb-2">
                          {p.texto}
                        </div>
                      )}
                      {p.tipo === 'pergunta' && p.palavra_chave && (
                        <div className="bg-[#dcf8c6] rounded-lg p-2 text-xs ml-8 shadow-sm">
                          {p.palavra_chave}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-3">
              Conversa da opção {exemplo?.numero || '1'}, passo a passo. Verde = o cliente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
