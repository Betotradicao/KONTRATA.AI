import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../utils/api';

const TIPOS = [
  { grupo: 'Conduta e Relacionamento', cor: 'red', itens: [
    { id: 'assedio_moral',     label: '🚫 Assédio moral (humilhação, isolamento, perseguição)' },
    { id: 'assedio_sexual',    label: '🚫 Assédio sexual (cantadas, toques, propostas)' },
    { id: 'discriminacao',     label: '🚫 Discriminação (raça, gênero, idade, religião, orientação)' },
    { id: 'violencia_fisica',  label: '🚫 Violência física' },
    { id: 'violencia_verbal',  label: '🚫 Violência verbal / xingamentos' },
    { id: 'conflito_grave',    label: '🚫 Conflito grave com colega ou líder' },
  ]},
  { grupo: 'Saúde e Segurança', cor: 'amber', itens: [
    { id: 'falta_epi',                label: '⚠️ Falta de EPI ou condições inseguras' },
    { id: 'sobrecarga',               label: '⚠️ Sobrecarga / pressão excessiva' },
    { id: 'jornada_irregular',        label: '⚠️ Jornada irregular / hora extra não paga' },
    { id: 'acidente_nao_registrado',  label: '⚠️ Acidente não registrado' },
  ]},
  { grupo: 'Integridade / Compliance', cor: 'purple', itens: [
    { id: 'furto_interno',       label: '💰 Furto interno / desvio' },
    { id: 'fraude',              label: '💰 Fraude (estoque, caixa, ponto)' },
    { id: 'corrupcao',           label: '💰 Corrupção / propina' },
    { id: 'conflito_interesse',  label: '💰 Conflito de interesse' },
  ]},
  { grupo: 'Outros', cor: 'gray', itens: [
    { id: 'sugestao',  label: '📝 Sugestão de melhoria' },
    { id: 'outro',     label: '📝 Outro (descrever)' },
  ]},
];

const STATUS_LABEL = {
  nova:          { txt: '🟦 Nova — em análise inicial', cor: 'bg-blue-50 border-blue-300 text-blue-800' },
  em_apuracao:   { txt: '🟡 Em apuração — investigando',  cor: 'bg-amber-50 border-amber-300 text-amber-800' },
  concluida:     { txt: '🟢 Concluída — apurada e tratada', cor: 'bg-emerald-50 border-emerald-300 text-emerald-800' },
  improcedente:  { txt: '⚪ Improcedente — sem fundamento', cor: 'bg-gray-100 border-gray-300 text-gray-700' },
};

export default function DenunciaPublica() {
  const { empresaId } = useParams();
  const [empresa, setEmpresa] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modo, setModo] = useState('denunciar'); // 'denunciar' | 'consultar'
  const [tipo, setTipo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [local, setLocal] = useState('');
  const [dataOcorrido, setDataOcorrido] = useState('');
  const [horaOcorrido, setHoraOcorrido] = useState('');
  const [anonima, setAnonima] = useState(true);
  const [autorNome, setAutorNome] = useState('');
  const [autorContato, setAutorContato] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');
  // Consulta
  const [protocoloConsulta, setProtocoloConsulta] = useState('');
  const [consultando, setConsultando] = useState(false);
  const [consulta, setConsulta] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get(`/denuncias/publica/empresa/${empresaId}`);
        setEmpresa(r.data);
      } catch (e) {
        setErro('Link inválido — empresa não encontrada.');
      } finally {
        setLoading(false);
      }
    })();
  }, [empresaId]);

  const consultarProtocolo = async () => {
    const p = protocoloConsulta.trim().toUpperCase();
    if (!p) { setErro('Digite o protocolo'); return; }
    setErro(''); setConsultando(true); setConsulta(null);
    try {
      const r = await api.get(`/denuncias/publica/consulta/${encodeURIComponent(p)}`);
      setConsulta(r.data);
    } catch (e) {
      setErro(e.response?.status === 404 ? 'Protocolo não encontrado' : (e.response?.data?.error || 'Erro'));
    } finally {
      setConsultando(false);
    }
  };

  const enviar = async () => {
    if (!tipo) { setErro('Selecione o tipo da denúncia'); return; }
    if (descricao.trim().length < 10) { setErro('Descreva o ocorrido com pelo menos 10 caracteres'); return; }
    // Validar hora se preenchida (formato HH:MM)
    const horaTrim = horaOcorrido.trim();
    if (horaTrim && !/^([01]\d|2[0-3]):[0-5]\d$/.test(horaTrim)) {
      setErro('Hora inválida. Use o formato HH:MM (ex: 14:30)');
      return;
    }
    // Combinar data + hora em ISO se ambos fornecidos
    let dataHoraISO;
    if (dataOcorrido) {
      dataHoraISO = horaTrim ? `${dataOcorrido}T${horaTrim}:00` : `${dataOcorrido}T00:00:00`;
    }

    setErro(''); setEnviando(true);
    try {
      const r = await api.post('/denuncias/publica', {
        empresa_id: empresaId,
        tipo,
        descricao: descricao.trim(),
        local: local.trim() || undefined,
        data_ocorrido: dataHoraISO,
        anonima,
        autor_nome: !anonima ? autorNome.trim() : undefined,
        autor_contato: !anonima ? autorContato.trim() : undefined,
      });
      setResultado(r.data);
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao enviar. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Carregando...</div>;

  if (resultado) {
    const copiarProtocolo = () => {
      navigator.clipboard.writeText(resultado.protocolo);
      alert('✓ Protocolo copiado!');
    };
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 py-10 px-4">
        <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Denúncia registrada</h1>
          <p className="text-gray-600 mb-6">Sua denúncia foi recebida e será apurada com sigilo.</p>

          <div className="bg-gradient-to-br from-purple-100 to-indigo-100 border-4 border-purple-500 rounded-2xl p-6 mb-4">
            <p className="text-xs uppercase text-purple-700 font-bold mb-2">📋 SEU PROTOCOLO</p>
            <p className="text-3xl md:text-4xl font-mono font-bold text-purple-900 select-all tracking-wider mb-3">{resultado.protocolo}</p>
            <button
              onClick={copiarProtocolo}
              className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold px-4 py-2 rounded-lg"
            >
              📋 Copiar protocolo
            </button>
          </div>

          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 mb-6 text-left">
            <p className="font-bold text-amber-900 text-sm mb-2">⚠️ ANOTE ESTE CÓDIGO ANTES DE FECHAR</p>
            <p className="text-xs text-amber-800 mb-2">
              Com ele você pode <strong>consultar a qualquer momento</strong> o que o responsável fez sobre sua denúncia.
            </p>
            <p className="text-xs text-amber-800">
              Sem o protocolo, não há como dar retorno (porque sua denúncia é anônima 🔒).
            </p>
            <p className="text-xs text-amber-900 mt-3 font-bold">
              💡 Tire um print, anote num papel ou copie o código acima.
            </p>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => { setResultado(null); setModo('consultar'); setProtocoloConsulta(resultado.protocolo); setConsulta(null); }}
              className="w-full bg-white border-2 border-purple-400 hover:bg-purple-50 text-purple-700 font-bold py-3 rounded-xl"
            >
              🔍 Consultar status agora
            </button>
            <button
              onClick={() => {
                if (!confirm('Você já anotou ou copiou o protocolo?\n\nDepois de fechar, sem o protocolo não há como acompanhar.')) return;
                window.location.reload();
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl text-lg shadow-lg"
            >
              ✅ Já anotei o protocolo — concluir
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-6 text-white">
            <div className="flex items-center gap-3">
              <div className="text-4xl">🛡️</div>
              <div>
                <h1 className="text-2xl font-bold">Canal de Denúncia</h1>
                <p className="text-purple-100 text-sm">{empresa?.nome || 'Empresa'} — Sigilo garantido</p>
              </div>
            </div>
          </div>

          {/* Abas Denunciar / Consultar */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => { setModo('denunciar'); setErro(''); }}
              className={`flex-1 py-3 text-sm font-bold transition ${modo === 'denunciar' ? 'text-purple-700 border-b-2 border-purple-600 bg-purple-50' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              📝 Fazer denúncia
            </button>
            <button
              onClick={() => { setModo('consultar'); setErro(''); setConsulta(null); }}
              className={`flex-1 py-3 text-sm font-bold transition ${modo === 'consultar' ? 'text-purple-700 border-b-2 border-purple-600 bg-purple-50' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              🔍 Consultar minha denúncia
            </button>
          </div>

          {modo === 'consultar' ? (
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                ℹ️ Digite o <strong>protocolo</strong> que você recebeu ao fazer a denúncia. Ele tem o formato <code className="bg-white px-1 rounded">DEN-AAAAMMDD-XXXXX</code>.
              </div>

              {erro && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">⚠️ {erro}</div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Protocolo</label>
                <input
                  value={protocoloConsulta}
                  onChange={(e) => setProtocoloConsulta(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && consultarProtocolo()}
                  placeholder="DEN-20260601-AB12C"
                  className="w-full border-2 border-gray-200 focus:border-purple-500 rounded-lg px-3 py-2 text-lg font-mono outline-none uppercase"
                />
              </div>

              <button onClick={consultarProtocolo} disabled={consultando}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl">
                {consultando ? 'Consultando...' : '🔍 Consultar status'}
              </button>

              {consulta && (
                <div className="border-2 border-purple-200 rounded-xl p-4 space-y-3 bg-white">
                  <div>
                    <p className="text-xs uppercase text-gray-500 font-bold">Protocolo</p>
                    <p className="font-mono font-bold text-purple-900">{consulta.protocolo}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-500 font-bold mb-1">Status atual</p>
                    <div className={`border-2 rounded-lg p-3 font-semibold text-sm ${STATUS_LABEL[consulta.status]?.cor || 'bg-gray-50'}`}>
                      {STATUS_LABEL[consulta.status]?.txt || consulta.status}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="uppercase text-gray-500 font-bold">Recebida em</p>
                      <p className="text-gray-700">{new Date(consulta.criada_em).toLocaleString('pt-BR')}</p>
                    </div>
                    <div>
                      <p className="uppercase text-gray-500 font-bold">Última atualização</p>
                      <p className="text-gray-700">{new Date(consulta.atualizada_em).toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                  {consulta.resolucao ? (
                    <div className="bg-emerald-50 border-2 border-emerald-200 rounded-lg p-3">
                      <p className="text-xs uppercase text-emerald-700 font-bold mb-2">✅ Providências tomadas pelo responsável:</p>
                      <p className="text-sm text-emerald-900 whitespace-pre-wrap">{consulta.resolucao}</p>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center text-xs text-gray-500">
                      Ainda não há providências registradas. Volte mais tarde pra acompanhar.
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
          <div className="p-6 space-y-5">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              ℹ️ Este é um canal <strong>seguro e confidencial</strong>. Você pode denunciar de forma <strong>anônima</strong> — sua identidade só é registrada se você escolher se identificar. Conforme Lei 14.457/22 e NR-1.
            </div>

            <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-3 text-sm">
              <p className="text-purple-800">
                💡 <strong>Importante:</strong> ao enviar, você receberá um <strong>protocolo único</strong> (ex: <code className="bg-white px-1 rounded text-xs">DEN-20260601-AB12C</code>) — guarde-o pra <strong>consultar depois</strong> o que foi feito sobre sua denúncia.
              </p>
            </div>

            {erro && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
                ⚠️ {erro}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo da denúncia *</label>
              <div className="space-y-3">
                {TIPOS.map(grupo => (
                  <div key={grupo.grupo}>
                    <p className="text-xs font-bold text-gray-500 uppercase mb-1">{grupo.grupo}</p>
                    <div className="space-y-1">
                      {grupo.itens.map(t => (
                        <label key={t.id} className={`flex items-center gap-2 p-2 rounded cursor-pointer transition ${tipo === t.id ? 'bg-purple-100 border border-purple-400' : 'hover:bg-gray-50 border border-transparent'}`}>
                          <input type="radio" name="tipo" value={t.id} checked={tipo === t.id} onChange={(e) => setTipo(e.target.value)} className="w-4 h-4" />
                          <span className="text-sm text-gray-700">{t.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Descreva o ocorrido * <span className="text-xs font-normal text-gray-500">(seja o mais detalhado possível)</span></label>
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={6}
                maxLength={5000}
                placeholder="Conte o que aconteceu, quem estava envolvido, como você se sentiu..."
                className="w-full border-2 border-gray-200 focus:border-purple-500 rounded-lg px-3 py-2 text-sm outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">{descricao.length}/5000</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Local <span className="text-xs font-normal text-gray-500">(opcional)</span></label>
              <input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex: setor de açougue, caixa 3..." className="w-full border-2 border-gray-200 focus:border-purple-500 rounded-lg px-3 py-2 text-sm outline-none" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Data do ocorrido <span className="text-xs font-normal text-gray-500">(opcional)</span></label>
                <input type="date" value={dataOcorrido} onChange={(e) => setDataOcorrido(e.target.value)} className="w-full border-2 border-gray-200 focus:border-purple-500 rounded-lg px-3 py-2 text-sm outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Hora <span className="text-xs font-normal text-gray-500">(opcional)</span></label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={horaOcorrido}
                  onChange={(e) => {
                    // Aceita digitos e :, formata automatico HH:MM
                    let v = e.target.value.replace(/[^0-9:]/g, '');
                    if (v.length === 2 && !v.includes(':') && horaOcorrido.length === 1) v += ':';
                    if (v.length > 5) v = v.slice(0, 5);
                    setHoraOcorrido(v);
                  }}
                  placeholder="14:30"
                  maxLength={5}
                  className="w-full border-2 border-gray-200 focus:border-purple-500 rounded-lg px-3 py-2 text-sm outline-none font-mono"
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={anonima} onChange={(e) => setAnonima(e.target.checked)} className="w-5 h-5" />
                <span className="text-sm font-semibold text-gray-700">Manter denúncia ANÔNIMA</span>
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-7">Recomendado — sua identidade não será registrada.</p>

              {!anonima && (
                <div className="mt-3 space-y-2 ml-7 pl-3 border-l-2 border-purple-200">
                  <input value={autorNome} onChange={(e) => setAutorNome(e.target.value)} placeholder="Seu nome" className="w-full border-2 border-gray-200 focus:border-purple-500 rounded-lg px-3 py-2 text-sm outline-none" />
                  <input value={autorContato} onChange={(e) => setAutorContato(e.target.value)} placeholder="Email ou telefone (pra retorno)" className="w-full border-2 border-gray-200 focus:border-purple-500 rounded-lg px-3 py-2 text-sm outline-none" />
                </div>
              )}
            </div>

            <button onClick={enviar} disabled={enviando} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition shadow-lg">
              {enviando ? 'Enviando...' : '🔒 Enviar denúncia com sigilo'}
            </button>

            <p className="text-xs text-center text-gray-400">
              Suas informações são tratadas conforme a LGPD. Nada é compartilhado sem necessidade legal.
            </p>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
