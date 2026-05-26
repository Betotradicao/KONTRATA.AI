import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import RadarLoading from '../components/RadarLoading';

const MESES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const LANCAMENTOS = [
  // Proventos
  { key: 'hora_extra_60', label: 'HE 60%', tipo: 'provento' },
  { key: 'hora_extra_60_inter', label: 'HE 60% Interjornada', tipo: 'provento' },
  { key: 'hora_extra_100', label: 'HE 100%', tipo: 'provento' },
  { key: 'adicional_noturno', label: 'Adic. Noturno', tipo: 'provento' },
  { key: 'quebra_caixa', label: 'Quebra Caixa', tipo: 'provento' },
  { key: 'ajuda_custo_domingo', label: 'Aj. Custo Domingo', tipo: 'provento' },
  { key: 'ajuda_custo_feriado', label: 'Aj. Custo Feriado', tipo: 'provento' },
  { key: 'insalubridade', label: 'Insalubridade', tipo: 'provento' },
  { key: 'premio', label: 'Prêmio', tipo: 'provento' },
  // Descontos
  { key: 'falta_dias', label: 'Falta (dias)', tipo: 'desconto' },
  { key: 'atraso_horas', label: 'Atraso (horas)', tipo: 'desconto' },
  { key: 'desconto_dsr', label: 'Desc. DSR', tipo: 'desconto' },
  { key: 'vale_transporte', label: 'Vale Transporte', tipo: 'desconto' },
  { key: 'desconto_quebra_caixa', label: 'Desc. Quebra Caixa', tipo: 'desconto' },
  { key: 'contribuicao_sindical', label: 'Contrib. Sindical', tipo: 'desconto' },
  { key: 'adiantamento', label: 'Adiantamento', tipo: 'desconto' },
  { key: 'compras', label: 'Compras', tipo: 'desconto' },
];

const fmtMoney = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function RhFolhaPagamento() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const [base, setBase] = useState('competencia'); // 'competencia' | 'caixa'
  const [tipo, setTipo] = useState('todos'); // 'todos' | 'proventos' | 'descontos'
  const [lancamento, setLancamento] = useState(''); // '' = todos
  const [empresaId, setEmpresaId] = useState('');
  const [colaboradorId, setColaboradorId] = useState('');

  const [empresas, setEmpresas] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r1 = await api.get('/rh/empresas/stores/list');
        setEmpresas(Array.isArray(r1.data) ? r1.data : []);
      } catch (e) { console.error('empresas:', e); }
      try {
        const r2 = await api.get('/rh/colaboradores?status=ativo&limit=500');
        const list = Array.isArray(r2.data?.data) ? r2.data.data
          : Array.isArray(r2.data) ? r2.data
          : (r2.data?.colaboradores || []);
        setColaboradores(Array.isArray(list) ? list : []);
      } catch (e) { console.error('colaboradores:', e); }
    })();
  }, []);

  const carregar = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('ano', String(ano));
      params.set('base', base === 'caixa' ? 'caixa' : 'competencia');
      params.set('tipo', tipo);
      if (lancamento) params.set('lancamento', lancamento);
      if (empresaId) params.set('empresa_id', empresaId);
      if (colaboradorId) params.set('colaborador_id', colaboradorId);
      const r = await api.get(`/rh/folha/resumo-anual?${params}`);
      setResumo(r.data);
    } catch { toast.error('Erro ao carregar folha'); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [ano, base, tipo, lancamento, empresaId, colaboradorId]);

  // Lista de meses do ano com algum lancamento (pra escolher qual gerar holerite)
  const mesesComDado = (resumo?.totaisProv || []).map((p, i) => ({
    idx: i + 1,
    label: MESES_LABEL[i],
    temDado: p > 0 || (resumo?.totaisDesc?.[i] || 0) > 0,
  }));

  const [showHolerite, setShowHolerite] = useState(false);
  const [mesHolerite, setMesHolerite] = useState('');

  const baixarHolerite = async () => {
    if (!colaboradorId) { toast.error('Selecione um colaborador primeiro'); return; }
    if (!mesHolerite) { toast.error('Selecione o mês'); return; }
    try {
      const competencia = `${ano}-${String(mesHolerite).padStart(2, '0')}`;
      const r = await api.get(`/rh/folha/holerite?colaborador_id=${colaboradorId}&competencia=${competencia}`, { responseType: 'blob' });
      const blob = new Blob([r.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const colNome = colaboradores.find(c => String(c.id) === String(colaboradorId))?.nome || 'colab';
      a.download = `holerite_${colNome.replace(/\s/g, '_')}_${competencia}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      setShowHolerite(false);
    } catch { toast.error('Erro ao gerar holerite'); }
  };

  const proventos = resumo?.linhas.filter(l => l.tipo === 'provento') || [];
  const descontos = resumo?.linhas.filter(l => l.tipo === 'desconto') || [];

  const totaisProvMes = resumo?.totaisProv || Array(12).fill(0);
  const totaisDescMes = resumo?.totaisDesc || Array(12).fill(0);
  const liquidoMes = totaisProvMes.map((p, i) => p - totaisDescMes[i]);

  // Anos disponiveis (atual -3 ate atual +1)
  const anos = [];
  for (let y = anoAtual - 3; y <= anoAtual + 1; y++) anos.push(y);

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />

      <div className="flex-1 overflow-y-auto">
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white px-6 py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-purple-700 shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold">Folha de Pagamento</h1>
              <p className="text-orange-100 text-sm">Visão anual — proventos e descontos por mês</p>
            </div>
          </div>
          <button
            onClick={() => {
              if (!colaboradorId) { toast.error('Selecione um colaborador no filtro pra gerar holerite'); return; }
              setShowHolerite(true);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-bold shrink-0 ${colaboradorId ? 'bg-white text-orange-700 hover:bg-orange-50' : 'bg-white/30 text-white cursor-not-allowed'}`}
            title={colaboradorId ? 'Gerar holerite (PDF com 2 vias)' : 'Selecione um colaborador primeiro'}>
            🧾 Gerar Holerite
          </button>
        </div>

        {/* Filtros */}
        <div className="bg-white border-b px-4 py-3">
          <div className="grid grid-cols-2 md:grid-cols-7 gap-3 items-end">
            <div>
              <label className="block text-[10px] uppercase text-gray-600 font-semibold">Empresa</label>
              <select value={empresaId} onChange={e => setEmpresaId(e.target.value)}
                className="w-full border rounded-lg px-3 py-1.5 text-sm">
                <option value="">— Todas —</option>
                {empresas.map(e => (
                  <option key={e.id} value={e.id}>{e.apelido ? `Loja ${e.cod_loja} — ${e.apelido}` : e.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase text-gray-600 font-semibold">Ano</label>
              <select value={ano} onChange={e => setAno(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-1.5 text-sm font-bold">
                {anos.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase text-gray-600 font-semibold">Base do mês</label>
              <select value={base} onChange={e => setBase(e.target.value)}
                className="w-full border rounded-lg px-3 py-1.5 text-sm">
                <option value="competencia">📅 Competência</option>
                <option value="caixa">💰 Caixa</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase text-gray-600 font-semibold">Colaborador</label>
              <select value={colaboradorId} onChange={e => setColaboradorId(e.target.value)}
                className="w-full border rounded-lg px-3 py-1.5 text-sm">
                <option value="">— Todos —</option>
                {colaboradores.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase text-gray-600 font-semibold">Tipo</label>
              <select value={tipo} onChange={e => { setTipo(e.target.value); setLancamento(''); }}
                className="w-full border rounded-lg px-3 py-1.5 text-sm">
                <option value="todos">Todos</option>
                <option value="proventos">✓ Só pagamentos</option>
                <option value="descontos">✗ Só descontos</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] uppercase text-gray-600 font-semibold">Lançamento específico</label>
              <select value={lancamento} onChange={e => setLancamento(e.target.value)}
                className="w-full border rounded-lg px-3 py-1.5 text-sm">
                <option value="">— Todos os lançamentos —</option>
                {LANCAMENTOS
                  .filter(l => tipo === 'todos' || (tipo === 'proventos' ? l.tipo === 'provento' : l.tipo === 'desconto'))
                  .map(l => (
                    <option key={l.key} value={l.key}>{l.label} ({l.tipo === 'provento' ? '✓' : '✗'})</option>
                  ))}
              </select>
            </div>
          </div>
        </div>

        {/* Pivot Anual */}
        <div className="p-4">
          {loading ? (
            <div className="flex justify-center py-20"><RadarLoading size="sm" message="" /></div>
          ) : !resumo ? null : (
            <div className="bg-white rounded-lg border shadow-sm overflow-auto max-h-[calc(100vh-280px)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-30">
                  <tr className="bg-gray-700 text-white">
                    <th className="text-left px-3 py-2 sticky left-0 bg-gray-700 z-40 min-w-[200px]">Lançamento</th>
                    {MESES_LABEL.map(m => (
                      <th key={m} className="text-right px-2 py-2 min-w-[90px] bg-gray-700">{m}</th>
                    ))}
                    <th className="text-right px-3 py-2 bg-blue-700 min-w-[110px]">Total {ano}</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Pagamentos / Proventos */}
                  {proventos.length > 0 && (
                    <>
                      <tr className="bg-emerald-700 text-white">
                        <td colSpan={14} className="px-3 py-1.5 font-bold uppercase text-sm">✓ PAGAMENTOS (PROVENTOS)</td>
                      </tr>
                      {proventos.map(l => (
                        <tr key={l.key} className="hover:bg-emerald-50 border-b">
                          <td className="sticky left-0 bg-white px-3 py-1.5 font-medium text-gray-800">{l.label}</td>
                          {l.meses.map((v, i) => (
                            <td key={i} className={`px-2 py-1.5 text-right ${v > 0 ? 'text-emerald-700 font-semibold' : 'text-gray-300'}`}>
                              {v > 0 ? fmtMoney(v) : '—'}
                            </td>
                          ))}
                          <td className="px-3 py-1.5 text-right font-bold text-emerald-800 bg-emerald-50">{fmtMoney(l.total)}</td>
                        </tr>
                      ))}
                      <tr className="bg-emerald-100 font-bold border-b-2 border-emerald-300">
                        <td className="sticky left-0 bg-emerald-100 px-3 py-2 text-emerald-900">SUBTOTAL Pagamentos</td>
                        {totaisProvMes.map((v, i) => (
                          <td key={i} className="px-2 py-2 text-right text-emerald-900">{v > 0 ? fmtMoney(v) : '—'}</td>
                        ))}
                        <td className="px-3 py-2 text-right text-emerald-900 bg-emerald-200">{fmtMoney(resumo.totalProvAno)}</td>
                      </tr>
                    </>
                  )}

                  {/* Descontos */}
                  {descontos.length > 0 && (
                    <>
                      <tr className="bg-rose-700 text-white">
                        <td colSpan={14} className="px-3 py-1.5 font-bold uppercase text-sm">✗ DESCONTOS</td>
                      </tr>
                      {descontos.map(l => (
                        <tr key={l.key} className="hover:bg-rose-50 border-b">
                          <td className="sticky left-0 bg-white px-3 py-1.5 font-medium text-gray-800">{l.label}</td>
                          {l.meses.map((v, i) => (
                            <td key={i} className={`px-2 py-1.5 text-right ${v > 0 ? 'text-rose-700 font-semibold' : 'text-gray-300'}`}>
                              {v > 0 ? fmtMoney(v) : '—'}
                            </td>
                          ))}
                          <td className="px-3 py-1.5 text-right font-bold text-rose-800 bg-rose-50">{fmtMoney(l.total)}</td>
                        </tr>
                      ))}
                      <tr className="bg-rose-100 font-bold border-b-2 border-rose-300">
                        <td className="sticky left-0 bg-rose-100 px-3 py-2 text-rose-900">SUBTOTAL Descontos</td>
                        {totaisDescMes.map((v, i) => (
                          <td key={i} className="px-2 py-2 text-right text-rose-900">{v > 0 ? fmtMoney(v) : '—'}</td>
                        ))}
                        <td className="px-3 py-2 text-right text-rose-900 bg-rose-200">{fmtMoney(resumo.totalDescAno)}</td>
                      </tr>
                    </>
                  )}

                  {/* Liquido (proventos - descontos) */}
                  {tipo === 'todos' && (
                    <tr className="bg-blue-600 text-white font-bold">
                      <td className="sticky left-0 bg-blue-600 px-3 py-2.5 uppercase text-sm">Líquido (Pagto − Desc)</td>
                      {liquidoMes.map((v, i) => (
                        <td key={i} className="px-2 py-2.5 text-right">{v !== 0 ? fmtMoney(v) : '—'}</td>
                      ))}
                      <td className="px-3 py-2.5 text-right bg-blue-800">{fmtMoney(resumo.liquidoAno)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {!loading && resumo && resumo.linhas.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <div className="text-5xl mb-2">📋</div>
              <p>Nenhum lançamento encontrado pra esses filtros</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Holerite */}
      {showHolerite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowHolerite(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b">
              <h3 className="font-bold text-gray-800 text-lg">🧾 Gerar Holerite</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Colaborador: <strong>{colaboradores.find(c => String(c.id) === String(colaboradorId))?.nome}</strong>
              </p>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs uppercase text-gray-500 font-semibold">Mês de competência ({ano})</label>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {mesesComDado.map(m => (
                    <button key={m.idx}
                      onClick={() => setMesHolerite(m.idx)}
                      className={`px-2 py-2 rounded text-sm font-semibold border transition ${
                        mesHolerite === m.idx
                          ? 'bg-orange-500 text-white border-orange-600'
                          : m.temDado
                            ? 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'
                            : 'bg-gray-100 text-gray-400 border-gray-200'
                      }`}>
                      {m.label}
                      {m.temDado && <span className="block text-[9px] opacity-70">tem dados</span>}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-800">
                💡 O PDF vai ter <strong>2 vias idênticas</strong> (1ª empresa, 2ª empregado), prontas pra imprimir e destacar pela linha pontilhada.
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={() => setShowHolerite(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-semibold">Cancelar</button>
              <button onClick={baixarHolerite} disabled={!mesHolerite}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded text-sm font-bold">
                📄 Baixar PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
