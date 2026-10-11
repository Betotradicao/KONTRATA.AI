import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import toast from 'react-hot-toast';

/**
 * Conexão de WhatsApp do ATENDENTE VIRTUAL.
 *
 * ⚠️ É uma instância SEPARADA da usada nos disparos (aniversário, ASO, vagas).
 * Motivo: o atendente precisa RECEBER mensagem via webhook. Se ligássemos o
 * webhook no número dos disparos, o bot responderia qualquer pessoa que
 * respondesse um aviso automático — inclusive colaborador respondendo "ok"
 * num aviso de exame.
 */
/**
 * A URL que aparece no navegador da Evolution termina em /manager — mas esse
 * é o painel visual, não a API. Apontar pra lá faz o teste responder
 * "unknown" mesmo com a instância conectada. Tiramos automaticamente porque
 * é o endereço que a pessoa tem na mão pra copiar.
 */
const limparUrl = (v) =>
  String(v || '').trim().replace(/\/+$/, '').replace(/\/manager$/i, '');

export default function AtendenteVirtualTab() {
  const [cfg, setCfg] = useState({ url: '', token: '', instancia: '' });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [status, setStatus] = useState(null); // { ok, texto }

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/config/configurations');
        const c = data?.data || data || {};
        setCfg({
          url: c.atendente_evolution_url || '',
          token: c.atendente_evolution_token || '',
          instancia: c.atendente_evolution_instance || '',
        });
      } catch {
        toast.error('Erro ao carregar a configuração');
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  const salvar = async () => {
    setSalvando(true);
    try {
      await api.post('/config/configurations', {
        atendente_evolution_url: limparUrl(cfg.url),
        atendente_evolution_token: cfg.token.trim(),
        atendente_evolution_instance: cfg.instancia.trim(),
      });

      // Registra o webhook na Evolution na sequência: sem ele o bot fica
      // mudo e nada na tela indicaria o motivo.
      const { data: wh } = await api.post('/atendente-virtual/configurar-webhook', {});
      if (wh?.ok) {
        setStatus({ ok: true, texto: 'Configuração salva e webhook registrado na Evolution.' });
        toast.success('Salvo e conectado!');
      } else {
        setStatus({
          ok: false,
          texto: 'Configuração salva, mas não consegui registrar o webhook na Evolution: ' +
                 (wh?.erro || 'erro desconhecido') + '. O bot não vai receber mensagens até isso ser resolvido.',
        });
        toast.error('Salvo, mas o webhook falhou');
      }
    } catch (e) {
      toast.error('Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  const testar = async () => {
    setTestando(true);
    setStatus(null);
    try {
      const { data } = await api.post('/whatsapp/testar-conexao', {
        apiUrl: limparUrl(cfg.url),
        apiToken: cfg.token.trim(),
        instance: cfg.instancia.trim(),
      });
      setStatus(
        data.connected
          ? { ok: true, texto: `Conectado! Estado da instância: ${data.state}` }
          : {
              ok: false,
              texto:
                data.error ||
                `Instância não conectada (estado: ${data.state || 'desconhecido'}). ` +
                'Confira o nome da instância e se a URL é a da API (sem /manager no fim).',
            }
      );
    } catch (e) {
      setStatus({ ok: false, texto: e?.response?.data?.error || 'Erro ao testar' });
    } finally {
      setTestando(false);
    }
  };

  const campo = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent';
  const rotulo = 'block text-sm font-medium text-gray-700 mb-1';

  if (carregando) return <div className="p-8 text-center text-gray-400">Carregando…</div>;

  return (
    <div className="space-y-6">
      <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3">
        <p className="text-sm font-semibold text-purple-900">
          🤖 Atendente Virtual — número do WhatsApp
        </p>
        <p className="text-xs text-purple-800 mt-1">
          Use um número <strong>separado</strong> do que envia os avisos automáticos.
          Este aqui precisa <strong>receber</strong> mensagens, e no número dos disparos o
          bot acabaria respondendo quem só respondeu um aviso de aniversário ou de exame.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className={rotulo}>URL da API Evolution</label>
          <input value={cfg.url} onChange={(e) => setCfg({ ...cfg, url: e.target.value })}
            placeholder="https://evolution.kontrataai.com.br" className={campo} />
        </div>
        <div>
          <label className={rotulo}>Token da API</label>
          <input type="password" value={cfg.token}
            onChange={(e) => setCfg({ ...cfg, token: e.target.value })} className={campo} />
        </div>
        <div>
          <label className={rotulo}>Instância</label>
          <input value={cfg.instancia} onChange={(e) => setCfg({ ...cfg, instancia: e.target.value })}
            placeholder="ATENDENTE" className={campo} />
          <p className="text-[11px] text-gray-500 mt-1">
            Nome da instância na Evolution — não pode ser a mesma dos disparos.
          </p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={salvar} disabled={salvando}
          className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white rounded-lg font-medium text-sm">
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        <button onClick={testar} disabled={testando || !cfg.url || !cfg.token || !cfg.instancia}
          className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-lg font-medium text-sm">
          {testando ? 'Testando…' : '✓ Testar Conexão'}
        </button>
      </div>

      {status && (
        <div className={`rounded-lg px-4 py-3 text-sm border ${
          status.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {status.ok ? '✅ ' : '⚠️ '}{status.texto}
        </div>
      )}

    </div>
  );
}
