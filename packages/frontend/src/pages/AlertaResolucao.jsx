import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';

export default function AlertaResolucao() {
  const { token } = useParams();
  const [alerta, setAlerta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [lightbox, setLightbox] = useState(null);

  const [tipo, setTipo] = useState('previamente');
  const [mensagem, setMensagem] = useState('');
  const [autor, setAutor] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState('');

  useEffect(() => {
    carregar();
    // eslint-disable-next-line
  }, [token]);

  const carregar = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/checklist/alerta/${token}`);
      setAlerta(res.data?.alerta || null);
      setErro('');
    } catch (e) {
      setErro(e?.response?.data?.error || 'Alerta nao encontrado ou link invalido.');
    } finally {
      setLoading(false);
    }
  };

  const enviar = async (e) => {
    e.preventDefault();
    setSucesso('');
    setErro('');
    if (!autor.trim()) { setErro('Informe seu nome.'); return; }
    if (!mensagem.trim()) { setErro('Descreva o que foi feito.'); return; }
    try {
      setEnviando(true);
      const res = await api.post(`/checklist/alerta/${token}/resolver`, {
        tipo, mensagem, autor,
      });
      setAlerta(res.data?.alerta || alerta);
      setMensagem('');
      setSucesso(tipo === 'definitivamente'
        ? '🎉 Alerta resolvido definitivamente. Obrigado!'
        : '✅ Resolução prévia registrada. O alerta continua em aberto até a solução definitiva.');
    } catch (err) {
      setErro(err?.response?.data?.error || 'Erro ao enviar resolução.');
    } finally {
      setEnviando(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-100 via-amber-100 to-teal-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-10 text-center">
          <div className="text-5xl mb-3">⏳</div>
          <div className="text-gray-700 font-semibold">Carregando alerta…</div>
        </div>
      </div>
    );
  }

  if (erro && !alerta) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-100 via-amber-100 to-teal-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-10 text-center max-w-md">
          <div className="text-6xl mb-3">⚠️</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Alerta não encontrado</h1>
          <p className="text-sm text-gray-600">{erro}</p>
        </div>
      </div>
    );
  }

  const concluido = alerta?.status === 'concluida';

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-amber-50 to-teal-50 py-6 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className={`rounded-2xl shadow-lg p-5 mb-4 text-white ${concluido ? 'bg-gradient-to-r from-emerald-500 to-green-600' : 'bg-gradient-to-r from-rose-500 to-red-600'}`}>
          <div className="flex items-center gap-3">
            <div className="text-4xl">{concluido ? '✅' : '🚨'}</div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold">
                {concluido ? 'Alerta resolvido' : 'Alerta de Auditoria'}
              </h1>
              <p className="text-xs opacity-90 mt-0.5">
                {concluido
                  ? 'Esta pendência foi marcada como solucionada definitivamente.'
                  : 'Resolva esta pendência informando o que foi feito.'}
              </p>
            </div>
          </div>
        </div>

        {/* Detalhes do alerta */}
        <div className="bg-white rounded-2xl shadow-md p-5 mb-4 space-y-3">
          {alerta.roteiro && (
            <Linha label="🗂️ Roteiro" valor={alerta.roteiro} />
          )}
          {alerta.secao && (
            <Linha label="📂 Seção" valor={alerta.secao} />
          )}
          {alerta.pergunta && (
            <div>
              <div className="text-[11px] uppercase font-semibold text-gray-500 tracking-wide">❓ Pergunta</div>
              <div className="text-base font-bold text-gray-800 mt-0.5">{alerta.pergunta}</div>
            </div>
          )}
          {alerta.resposta && (
            <div>
              <div className="text-[11px] uppercase font-semibold text-gray-500 tracking-wide">🔴 Resposta do auditor</div>
              <div className="mt-0.5 inline-block bg-rose-100 border border-rose-200 rounded-lg px-3 py-1.5 text-sm font-semibold text-rose-800">
                {alerta.resposta}
              </div>
            </div>
          )}
          {alerta.observacao && (
            <div>
              <div className="text-[11px] uppercase font-semibold text-gray-500 tracking-wide">📝 Observação</div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded-lg p-3 mt-1">
                {alerta.observacao}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 pt-2 border-t border-gray-100">
            {alerta.auditor && <Linha label="👤 Auditor" valor={alerta.auditor} small />}
            {alerta.auditado && <Linha label="🎯 Auditado" valor={alerta.auditado} small />}
            {alerta.cod_loja != null && <Linha label="🏪 Loja" valor={`#${alerta.cod_loja}`} small />}
            {alerta.created_at && <Linha label="📅 Aberto em" valor={new Date(alerta.created_at).toLocaleString('pt-BR')} small />}
          </div>

          {/* Fotos */}
          {Array.isArray(alerta.fotos) && alerta.fotos.length > 0 && (
            <div>
              <div className="text-[11px] uppercase font-semibold text-gray-500 tracking-wide mb-2">📸 Evidências</div>
              <div className="grid grid-cols-3 gap-2">
                {alerta.fotos.map((url, i) => (
                  <button key={i} type="button" onClick={() => setLightbox(url)}
                    className="aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200 hover:ring-2 hover:ring-rose-400">
                    <img src={url} alt={`Evidência ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Historico de resolucoes anteriores */}
        {Array.isArray(alerta.resolucao_historico) && alerta.resolucao_historico.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md p-5 mb-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <span>🕑</span> Histórico de resolução
            </h3>
            <div className="space-y-2">
              {alerta.resolucao_historico.map((h, i) => (
                <div key={i} className={`border-l-4 rounded-r-lg p-3 ${h.tipo === 'definitivamente' ? 'border-emerald-500 bg-emerald-50' : 'border-amber-500 bg-amber-50'}`}>
                  <div className="flex items-center justify-between mb-1 text-xs">
                    <span className={`font-bold ${h.tipo === 'definitivamente' ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {h.tipo === 'definitivamente' ? '✅ Solucionado definitivamente' : '⏳ Solucionado previamente'}
                    </span>
                    <span className="text-gray-500">{new Date(h.timestamp).toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="text-sm text-gray-800">{h.mensagem}</div>
                  <div className="text-[11px] text-gray-500 mt-1">por <strong>{h.autor}</strong></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Formulario de resolucao */}
        {!concluido && (
          <form onSubmit={enviar} className="bg-white rounded-2xl shadow-md p-5 space-y-4">
            <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <span>🛠️</span> Registrar resolução
            </h3>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Seu nome *</label>
              <input type="text" value={autor} onChange={e => setAutor(e.target.value)}
                placeholder="Quem está resolvendo?"
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de resolução *</label>
              <div className="space-y-2">
                <label className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition ${tipo === 'previamente' ? 'border-amber-400 bg-amber-50' : 'border-gray-200 hover:border-amber-200'}`}>
                  <input type="radio" name="tipo" value="previamente"
                    checked={tipo === 'previamente'} onChange={() => setTipo('previamente')}
                    className="mt-0.5 w-4 h-4 accent-amber-500" />
                  <div className="flex-1">
                    <div className="font-bold text-amber-800 text-sm">⏳ Solucionado Previamente</div>
                    <div className="text-xs text-gray-600">
                      Providência inicial registrada. O alerta continua em aberto até a resolução definitiva.
                    </div>
                  </div>
                </label>
                <label className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition ${tipo === 'definitivamente' ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 hover:border-emerald-200'}`}>
                  <input type="radio" name="tipo" value="definitivamente"
                    checked={tipo === 'definitivamente'} onChange={() => setTipo('definitivamente')}
                    className="mt-0.5 w-4 h-4 accent-emerald-500" />
                  <div className="flex-1">
                    <div className="font-bold text-emerald-800 text-sm">✅ Solucionado Definitivamente</div>
                    <div className="text-xs text-gray-600">
                      Problema foi resolvido por completo. Fecha o alerta.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">O que foi feito? *</label>
              <textarea value={mensagem} onChange={e => setMensagem(e.target.value)}
                rows={4} placeholder={tipo === 'definitivamente'
                  ? 'Ex: Trocamos o cartucho e a impressora voltou a funcionar.'
                  : 'Ex: Liguei para a TI, eles vão vir trocar o cartucho hoje à tarde.'}
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100" />
            </div>

            {erro && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{erro}</div>
            )}
            {sucesso && (
              <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-3 text-sm">{sucesso}</div>
            )}

            <button type="submit" disabled={enviando}
              className={`w-full py-3.5 rounded-xl font-bold text-white shadow-md transition ${enviando
                ? 'bg-gray-400 cursor-not-allowed'
                : tipo === 'definitivamente'
                  ? 'bg-gradient-to-r from-emerald-500 to-green-600 hover:shadow-lg hover:scale-[1.02]'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:shadow-lg hover:scale-[1.02]'}`}>
              {enviando ? 'Enviando…' : (tipo === 'definitivamente' ? '✅ Confirmar resolução definitiva' : '⏳ Registrar solução prévia')}
            </button>
          </form>
        )}

        <div className="text-center mt-6 text-[11px] text-gray-500">
          Kontrata.ai · Check List
        </div>
      </div>

      {lightbox && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Evidência ampliada" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </div>
  );
}

function Linha({ label, valor, small }) {
  return (
    <div>
      <div className={`${small ? 'text-[10px]' : 'text-[11px]'} uppercase font-semibold text-gray-500 tracking-wide`}>{label}</div>
      <div className={`${small ? 'text-xs' : 'text-sm'} text-gray-800 font-medium mt-0.5`}>{valor}</div>
    </div>
  );
}
