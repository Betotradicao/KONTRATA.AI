import { useState, useEffect } from 'react';
import { Check, ShieldCheck, Eye, EyeOff, Send, Copy } from 'lucide-react';
import { api } from '../api';

// Rótulos amigáveis pras chaves cruas do banco.
const DESCRICAO = {
  google_analytics_id: {
    titulo: 'Google Analytics — ID de medição',
    ajuda: 'O código G-XXXXXXXXXX da propriedade do site. Cole aqui e a medição começa na hora, sem republicar o site. Vazio = nada é medido.',
  },
  asaas_api_key: {
    titulo: 'Asaas — Chave de API',
    ajuda: 'Painel do Asaas → Integrações → Gerar chave. É com ela que dá pra puxar as cobranças e a baixa automática pro Financeiro.',
  },
  asaas_ambiente: {
    titulo: 'Asaas — Ambiente',
    ajuda: 'producao ou sandbox. Use sandbox para testar sem gerar boleto de verdade.',
  },
  whatsapp_evolution_instance: {
    titulo: 'WhatsApp — Instância',
    ajuda: 'Nome da instância na Evolution (ex: KONTRATAAI). Sem ele, a URL e a chave sozinhas não sabem por qual número mandar.',
  },
  whatsapp_evolution_url: {
    titulo: 'WhatsApp — URL da Evolution API',
    ajuda: 'Endereço da instância que dispara as mensagens.',
  },
  whatsapp_evolution_key: {
    titulo: 'WhatsApp — Chave da Evolution API',
    ajuda: 'Token de autenticação da instância.',
  },
};

export default function Integracoes({ master = false }) {
  const [lista, setLista] = useState([]);
  const [rascunho, setRascunho] = useState({});
  const [salvando, setSalvando] = useState(null);
  const [salvo, setSalvo] = useState(null);
  // Segredos que o master pediu pra ver: chave -> valor em texto.
  const [revelado, setRevelado] = useState({});
  const [erroRevelar, setErroRevelar] = useState(null);
  const [copiado, setCopiado] = useState(null);

  const carregar = async () => {
    try { setLista(await api.get('/integracoes')); } catch { setLista([]); }
  };

  useEffect(() => { carregar(); }, []);

  const copiarChave = async (chave) => {
    try {
      await navigator.clipboard.writeText(revelado[chave] || '');
      setCopiado(chave);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      /* navegador bloqueou: o texto está na tela pra copiar na mão */
    }
  };

  const revelar = async (item) => {
    if (revelado[item.chave] !== undefined) {
      setRevelado((r) => {
        const novo = { ...r };
        delete novo[item.chave];
        return novo;
      });
      return;
    }
    try {
      const { valor } = await api.get(`/integracoes/${item.chave}/revelar`);
      setRevelado((r) => ({ ...r, [item.chave]: valor }));
    } catch (e) {
      setErroRevelar({ chave: item.chave, texto: e.message });
      setTimeout(() => setErroRevelar(null), 4000);
    }
  };

  const salvar = async (item) => {
    setSalvando(item.chave);
    try {
      await api.put(`/integracoes/${item.chave}`, {
        valor: rascunho[item.chave] ?? '',
        secreto: item.secreto,
      });
      // REMOVE a chave do rascunho em vez de zerar com "".
      // Com `rascunho[chave] ?? item.valor`, uma string vazia NÃO cai pro
      // valor guardado (?? só cai em null/undefined) — e o campo aparecia
      // em branco mesmo com o dado salvo.
      setRascunho((r) => {
        const novo = { ...r };
        delete novo[item.chave];
        return novo;
      });
      setSalvo(item.chave);
      setTimeout(() => setSalvo(null), 2500);
      carregar();
    } finally {
      setSalvando(null);
    }
  };

  return (
    <div className="space-y-5">
    <div className="bg-white rounded-xl shadow-sm border border-border-light">
      <div className="p-4 border-b border-border-light">
        <h2 className="font-display font-bold text-text-dark text-lg">Integrações</h2>
        <p className="text-xs text-text-gray">Chaves de acesso aos serviços externos.</p>
      </div>

      <div className="bg-purple-50 border-b border-purple-200 px-4 py-2.5 text-xs text-purple-900 flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          Chaves secretas ficam escondidas. Deixar o campo <strong>em branco mantém</strong> o
          que já está salvo — para trocar, digite a nova por cima.
          {master && ' No olhinho você confere o que foi guardado.'}
        </span>
      </div>

      <div className="p-4 space-y-5">
        {!lista.length && (
          <p className="text-center text-text-gray text-sm py-6">Nenhuma integração cadastrada.</p>
        )}

        {lista.map((item) => {
          const d = DESCRICAO[item.chave] || { titulo: item.chave, ajuda: '' };
          return (
            <div key={item.chave} className="border border-border-light rounded-lg p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
                <h3 className="font-semibold text-text-dark text-sm">{d.titulo}</h3>
                {item.preenchido ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
                    <Check className="w-3 h-3" /> Configurado
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-semibold">
                    Não configurado
                  </span>
                )}
              </div>
              {d.ajuda && <p className="text-xs text-text-gray mb-3">{d.ajuda}</p>}

              <div className="flex gap-2 flex-wrap">
                <div className="flex-1 min-w-[220px] relative">
                  <input
                    type={item.secreto ? 'password' : 'text'}
                    value={rascunho[item.chave] ?? (item.secreto ? '' : item.valor || '')}
                    onChange={(e) => setRascunho({ ...rascunho, [item.chave]: e.target.value })}
                    placeholder={
                      item.secreto && item.preenchido ? '•••••••• (deixe em branco para manter)' : ''
                    }
                    // O Chrome ve um type=password e oferece os logins salvos
                    // numa lista que cobre o campo. Aqui nao e login de
                    // ninguem: e uma chave de API.
                    name={`integracao_${item.chave}`}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    data-1p-ignore
                    data-lpignore="true"
                    className={`w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-600 ${
                      item.secreto && master ? 'pr-10' : ''
                    }`}
                  />
                  {item.secreto && master && item.preenchido && (
                    <button
                      type="button"
                      onClick={() => revelar(item)}
                      title={revelado[item.chave] === undefined ? 'Ver o que está salvo' : 'Esconder'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-gray hover:text-purple-800"
                    >
                      {revelado[item.chave] === undefined ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => salvar(item)}
                  disabled={salvando === item.chave}
                  className="px-5 py-2 rounded-lg bg-purple-800 text-white text-sm font-semibold hover:bg-purple-600 transition-colors disabled:opacity-60"
                >
                  {salvando === item.chave ? 'Salvando…' : salvo === item.chave ? 'Salvo!' : 'Salvar'}
                </button>
              </div>

              {/* A chave revelada aparece FORA do campo de digitar.
                  Dentro dele ela disputava espaço com o que a pessoa digita, e
                  bastava um clique-e-apaga pra sumir sem explicação. Aqui ela é
                  só leitura — dá pra selecionar, copiar e conferir. */}
              {revelado[item.chave] !== undefined && (
                <div className="mt-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                  <p className="text-[11px] text-purple-900 font-semibold mb-1">
                    Chave salva hoje:
                  </p>
                  {revelado[item.chave] ? (
                    <div className="flex items-start gap-2">
                      <code className="flex-1 text-xs text-text-dark break-all select-all">
                        {revelado[item.chave]}
                      </code>
                      <button
                        type="button"
                        onClick={() => copiarChave(item.chave)}
                        className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded border border-purple-300 bg-white text-purple-800 text-[11px] font-semibold hover:bg-purple-100"
                      >
                        {copiado === item.chave ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        {copiado === item.chave ? 'Copiado' : 'Copiar'}
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-text-gray">Está vazia.</p>
                  )}
                </div>
              )}

              {erroRevelar?.chave === item.chave && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">
                  Não consegui mostrar: {erroRevelar.texto}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>

    <TesteWhatsApp />
    </div>
  );
}

/**
 * Disparo de teste do WhatsApp.
 *
 * "Salvei os três campos" e "o disparo funciona" são coisas diferentes:
 * instância errada, chave vencida ou URL apontando pro painel visual da
 * Evolution salvam igualzinho e só aparecem na hora de mandar. Melhor
 * descobrir aqui do que num aviso de cobrança que não chegou.
 */
function TesteWhatsApp() {
  const [numero, setNumero] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);

  // Ja vem com o WhatsApp cadastrado em Configurar Site: quase sempre e pra
  // ele que se manda o teste, e digitar onze digitos a cada tentativa cansa.
  useEffect(() => {
    (async () => {
      try {
        const cfg = await api.get('/site-config');
        if (cfg?.contato?.whatsapp) setNumero(cfg.contato.whatsapp);
      } catch {
        /* sem numero cadastrado: a pessoa digita */
      }
    })();
  }, []);

  const enviar = async () => {
    setEnviando(true);
    setResultado(null);
    try {
      const r = await api.post('/integracoes/testar-whatsapp', { numero });
      setResultado({ ok: true, texto: `Mensagem enviada para ${r.para}. Confira o aparelho.` });
    } catch (e) {
      setResultado({ ok: false, texto: e.message });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-border-light p-4">
      <h3 className="font-display font-bold text-text-dark text-sm mb-1">
        Testar o disparo do WhatsApp
      </h3>
      <p className="text-xs text-text-gray mb-3">
        Manda uma mensagem de teste com as chaves salvas acima. Serve pra saber se a
        instância está mesmo conectada.
      </p>

      <div className="flex gap-2 flex-wrap">
        <input
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && numero && enviar()}
          placeholder="Número com DDD (ex: 12988887777)"
          name="whatsapp_teste"
          autoComplete="off"
          className="flex-1 min-w-[220px] border-2 border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-600"
        />
        <button
          onClick={enviar}
          disabled={enviando || numero.replace(/[^0-9]/g, '').length < 10}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-purple-800 text-white text-sm font-semibold hover:bg-purple-600 transition-colors disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
          {enviando ? 'Enviando…' : 'Enviar teste'}
        </button>
      </div>

      {resultado && (
        <p
          className={`text-xs mt-3 px-3 py-2 rounded-lg ${
            resultado.ok
              ? 'bg-emerald-50 text-emerald-800'
              : 'bg-red-50 text-red-700'
          }`}
        >
          {resultado.texto}
        </p>
      )}
    </div>
  );
}
