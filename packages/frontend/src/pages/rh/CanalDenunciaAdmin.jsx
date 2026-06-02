import { useEffect, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { api } from '../../utils/api';
import CartazDenuncia from './CartazDenuncia';

const STATUS_LABEL = {
  nova: { txt: 'Nova', cor: 'bg-blue-100 text-blue-700 border-blue-300' },
  em_apuracao: { txt: 'Em apuração', cor: 'bg-amber-100 text-amber-700 border-amber-300' },
  concluida: { txt: 'Concluída', cor: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  improcedente: { txt: 'Improcedente', cor: 'bg-gray-200 text-gray-700 border-gray-300' },
};

const TIPO_LABEL = {
  assedio_moral: 'Assédio moral',
  assedio_sexual: 'Assédio sexual',
  discriminacao: 'Discriminação',
  violencia_fisica: 'Violência física',
  violencia_verbal: 'Violência verbal',
  conflito_grave: 'Conflito grave',
  falta_epi: 'Falta de EPI',
  sobrecarga: 'Sobrecarga',
  jornada_irregular: 'Jornada irregular',
  acidente_nao_registrado: 'Acidente não registrado',
  furto_interno: 'Furto interno',
  fraude: 'Fraude',
  corrupcao: 'Corrupção',
  conflito_interesse: 'Conflito de interesse',
  sugestao: 'Sugestão',
  outro: 'Outro',
};

const PRIORIDADES = ['baixa', 'media', 'alta'];

export default function CanalDenunciaAdmin({ empresaCtx }) {
  const [stats, setStats] = useState(null);
  const [lista, setLista] = useState([]);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [selecionada, setSelecionada] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [showCartaz, setShowCartaz] = useState(false);

  const empresaId = empresaCtx?.empresaSel || '';
  const empresaNome = (empresaCtx?.empresas || []).find(e => String(e.id) === empresaId)?.nomeFantasia
    || (empresaCtx?.empresas || []).find(e => String(e.id) === empresaId)?.razaoSocial
    || '';
  const publicUrl = empresaId
    ? `${window.location.origin}/denuncia/${empresaId}`
    : '';

  const carregar = async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const [statsR, listaR] = await Promise.all([
        api.get(`/denuncias/stats?empresa_id=${empresaId}`),
        api.get(`/denuncias?empresa_id=${empresaId}${filtroStatus ? `&status=${filtroStatus}` : ''}`),
      ]);
      setStats(statsR.data);
      setLista(listaR.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, [empresaId, filtroStatus]);

  const copiarLink = () => {
    navigator.clipboard.writeText(publicUrl);
    alert('✓ Link copiado!');
  };

  const baixarQR = () => {
    const canvas = document.getElementById('qrcode-canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    link.download = `qrcode-denuncia-${empresaId}.png`;
    link.click();
  };

  const abrirDetalhe = (denuncia) => {
    if (!denuncia?.id) { console.error('abrirDetalhe sem id', denuncia); return; }
    setSelecionada(denuncia);
  };

  const atualizar = async (campo, valor) => {
    if (!selecionada?.id) {
      console.error('atualizar sem id em selecionada:', selecionada);
      alert('Erro interno: denuncia sem ID. Feche e abra de novo.');
      return;
    }
    setSalvando(true);
    try {
      const r = await api.patch(`/denuncias/${selecionada.id}`, { [campo]: valor });
      setSelecionada(r.data);
      carregar();
    } catch (e) {
      alert('Erro: ' + (e.response?.data?.error || e.message));
    } finally {
      setSalvando(false);
    }
  };

  if (!empresaId) {
    return <div className="p-6 text-center text-gray-500">Selecione uma empresa pra ver o canal de denúncia.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Link público + QR */}
      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-purple-900 mb-3 flex items-center gap-2">
          🔗 Link público do canal
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-3">
            <div className="bg-white border-2 border-purple-300 rounded-lg p-3 flex items-center gap-2">
              <input value={publicUrl} readOnly className="flex-1 bg-transparent text-sm font-mono text-gray-700 outline-none" />
              <button onClick={copiarLink} className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-3 py-1.5 rounded">
                Copiar
              </button>
            </div>
            <div className="text-sm text-gray-700 bg-white/60 rounded-lg p-3">
              <p className="font-semibold mb-1">📌 Como divulgar:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Imprima o QR Code e cole no refeitório, vestiário e mural</li>
                <li>Divulgue no WhatsApp do grupo de funcionários</li>
                <li>Adicione no rodapé do contracheque ou holerite</li>
                <li>Faça campanha mensal de relembrança</li>
              </ul>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 text-center shadow-md space-y-2">
            <QRCodeCanvas id="qrcode-canvas" value={publicUrl} size={180} level="H" includeMargin />
            <button onClick={baixarQR} className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-3 py-2 rounded w-full">
              ⬇ Baixar QR Code só
            </button>
            <button onClick={() => setShowCartaz(true)} className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white text-xs font-bold px-3 py-2 rounded w-full shadow">
              🎨 Gerar Cartaz Completo
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <CardStat label="Total" valor={stats.total} cor="gray" />
          <CardStat label="Novas" valor={stats.novas} cor="blue" />
          <CardStat label="Em apuração" valor={stats.em_apuracao} cor="amber" />
          <CardStat label="Concluídas" valor={stats.concluidas} cor="emerald" />
          <CardStat label="Improcedentes" valor={stats.improcedentes} cor="gray" />
          <CardStat label="🔥 Alta prioridade" valor={stats.alta_prioridade} cor="red" />
        </div>
      )}

      {/* Filtros + lista */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-700">Filtrar:</span>
        {['', 'nova', 'em_apuracao', 'concluida', 'improcedente'].map(s => (
          <button key={s} onClick={() => setFiltroStatus(s)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition ${filtroStatus === s ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {s ? STATUS_LABEL[s]?.txt : 'Todas'}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando...</div>
        ) : lista.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-3">📭</div>
            <p className="text-gray-500 text-sm">Nenhuma denúncia recebida ainda.</p>
            <p className="text-gray-400 text-xs mt-1">Divulgue o link e o QR Code pra incentivar denúncias seguras.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Protocolo</th>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-left">Resumo</th>
                <th className="px-3 py-2 text-center">Autor</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2 text-center">Recebida</th>
              </tr>
            </thead>
            <tbody>
              {lista.map(d => (
                <tr key={d.id} onClick={() => abrirDetalhe(d)} className="border-t hover:bg-purple-50 cursor-pointer">
                  <td className="px-3 py-2 font-mono text-xs text-purple-700">{d.protocolo}</td>
                  <td className="px-3 py-2">{TIPO_LABEL[d.tipo] || d.tipo}</td>
                  <td className="px-3 py-2 text-gray-700 max-w-md truncate">{d.resumo}</td>
                  <td className="px-3 py-2 text-center">
                    {d.anonima ? <span className="text-xs text-gray-400">🔒 Anônima</span> : <span className="text-xs text-gray-700">{d.autor_nome}</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_LABEL[d.status]?.cor}`}>
                      {STATUS_LABEL[d.status]?.txt || d.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-xs text-gray-500">
                    {new Date(d.criada_em).toLocaleString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCartaz && (
        <CartazDenuncia
          publicUrl={publicUrl}
          empresaNome={empresaNome}
          onClose={() => setShowCartaz(false)}
        />
      )}

      {/* Modal de detalhe */}
      {selecionada && (
        <div key={selecionada.id || 'no-id'} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelecionada(null)}>
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-5 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase opacity-80">Protocolo · ID #{selecionada.id ?? '???'}</p>
                <p className="font-mono font-bold text-lg">{selecionada.protocolo || '(sem protocolo)'}</p>
              </div>
              <button onClick={() => setSelecionada(null)} className="text-3xl leading-none opacity-80 hover:opacity-100">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Info label="Tipo" val={TIPO_LABEL[selecionada.tipo] || selecionada.tipo} />
                <Info label="Categoria" val={selecionada.categoria} />
                <Info label="Local" val={selecionada.local || '—'} />
                <Info label="Data e hora do ocorrido" val={selecionada.data_ocorrido ? new Date(selecionada.data_ocorrido).toLocaleString('pt-BR') : '—'} />
                <Info label="Autor" val={selecionada.anonima ? '🔒 Anônima' : selecionada.autor_nome} />
                <Info label="Contato" val={selecionada.anonima ? '—' : selecionada.autor_contato || '—'} />
              </div>

              <div>
                <p className="text-xs font-bold uppercase text-gray-500 mb-1">Descrição</p>
                <div className="bg-gray-50 border rounded-lg p-3 text-sm text-gray-800 whitespace-pre-wrap">{selecionada.descricao}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Status</label>
                  <select value={selecionada.status} onChange={(e) => atualizar('status', e.target.value)} disabled={salvando}
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm">
                    {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v.txt}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Prioridade</label>
                  <select value={selecionada.prioridade} onChange={(e) => atualizar('prioridade', e.target.value)} disabled={salvando}
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm">
                    {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Anotações internas</label>
                <textarea
                  value={selecionada.anotacoes_internas || ''}
                  onChange={(e) => setSelecionada({ ...selecionada, anotacoes_internas: e.target.value })}
                  onBlur={(e) => atualizar('anotacoes_internas', e.target.value)}
                  rows={3} placeholder="Observações da apuração (apenas admins veem)"
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Resolução / providências tomadas</label>
                <textarea
                  value={selecionada.resolucao || ''}
                  onChange={(e) => setSelecionada({ ...selecionada, resolucao: e.target.value })}
                  onBlur={(e) => atualizar('resolucao', e.target.value)}
                  rows={3} placeholder="O que foi feito ao concluir o caso"
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div className="text-xs text-gray-400 border-t pt-3">
                Recebida em {new Date(selecionada.criada_em).toLocaleString('pt-BR')}
                {selecionada.resolvida_em && ` · Resolvida em ${new Date(selecionada.resolvida_em).toLocaleString('pt-BR')}`}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CardStat({ label, valor, cor }) {
  const cores = {
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    red: 'bg-red-50 border-red-200 text-red-700',
  };
  return (
    <div className={`${cores[cor]} border-2 rounded-xl p-3 text-center`}>
      <p className="text-2xl font-bold">{valor ?? 0}</p>
      <p className="text-xs font-semibold">{label}</p>
    </div>
  );
}

function Info({ label, val }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase text-gray-500">{label}</p>
      <p className="text-sm text-gray-800">{val || '—'}</p>
    </div>
  );
}
