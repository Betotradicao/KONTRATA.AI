import { useState, useEffect } from 'react';
import { Check, ShieldCheck } from 'lucide-react';
import { api } from '../api';

// Rótulos amigáveis pras chaves cruas do banco.
const DESCRICAO = {
  asaas_api_key: {
    titulo: 'Asaas — Chave de API',
    ajuda: 'Painel do Asaas → Integrações → Gerar chave. É com ela que dá pra puxar as cobranças e a baixa automática pro Financeiro.',
  },
  asaas_ambiente: {
    titulo: 'Asaas — Ambiente',
    ajuda: 'producao ou sandbox. Use sandbox para testar sem gerar boleto de verdade.',
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

export default function Integracoes() {
  const [lista, setLista] = useState([]);
  const [rascunho, setRascunho] = useState({});
  const [salvando, setSalvando] = useState(null);
  const [salvo, setSalvo] = useState(null);

  const carregar = async () => {
    try { setLista(await api.get('/integracoes')); } catch { setLista([]); }
  };

  useEffect(() => { carregar(); }, []);

  const salvar = async (item) => {
    setSalvando(item.chave);
    try {
      await api.put(`/integracoes/${item.chave}`, {
        valor: rascunho[item.chave] ?? '',
        secreto: item.secreto,
      });
      setRascunho((r) => ({ ...r, [item.chave]: '' }));
      setSalvo(item.chave);
      setTimeout(() => setSalvo(null), 2500);
      carregar();
    } finally {
      setSalvando(null);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-border-light">
      <div className="p-4 border-b border-border-light">
        <h2 className="font-display font-bold text-text-dark text-lg">Integrações</h2>
        <p className="text-xs text-text-gray">Chaves de acesso aos serviços externos.</p>
      </div>

      <div className="bg-purple-50 border-b border-purple-200 px-4 py-2.5 text-xs text-purple-900 flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          Chaves marcadas como secretas <strong>nunca voltam para a tela</strong> depois de
          salvas — o painel só mostra se estão preenchidas. Para trocar, digite a nova por cima.
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
                <input
                  type={item.secreto ? 'password' : 'text'}
                  value={rascunho[item.chave] ?? (item.secreto ? '' : item.valor || '')}
                  onChange={(e) => setRascunho({ ...rascunho, [item.chave]: e.target.value })}
                  placeholder={item.secreto && item.preenchido ? '•••••••• (deixe em branco para manter)' : ''}
                  className="flex-1 min-w-[220px] border-2 border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-600"
                />
                <button
                  onClick={() => salvar(item)}
                  disabled={salvando === item.chave}
                  className="px-5 py-2 rounded-lg bg-purple-800 text-white text-sm font-semibold hover:bg-purple-600 transition-colors disabled:opacity-60"
                >
                  {salvando === item.chave ? 'Salvando…' : salvo === item.chave ? 'Salvo!' : 'Salvar'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
