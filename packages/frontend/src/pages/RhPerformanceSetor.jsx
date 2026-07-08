import { Fragment, useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import api from '../utils/api';
import toast from 'react-hot-toast';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const fmtMoeda = (v) => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// pt-BR: ponto = milhar, vírgula = decimal. "300.000,00" e "300000" viram 300000.
const parseMoeda = (s) => {
  const t = String(s ?? '').trim().replace(/\s|R\$/gi, '');
  if (!t) return 0;
  const n = t.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  return parseFloat(n) || 0;
};

export default function RhPerformanceSetor({ user }) {
  const anoAtual = new Date().getFullYear();
  const [lojas, setLojas] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
  const [filtroLoja, setFiltroLoja] = useState('');
  const [ano, setAno] = useState(anoAtual);
  const [setores, setSetores] = useState([]);
  const [meta, setMeta] = useState({ total_colaboradores: 0, total_clt: 0, total_aprendiz: 0 });
  const [loading, setLoading] = useState(false);
  const [somarMedias, setSomarMedias] = useState(true); // agrupa por Setor do Colaborador

  // Modal novo setor
  const [modal, setModal] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoDep, setNovoDep] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Carrega lojas + setores (departamentos) uma vez
  useEffect(() => {
    (async () => {
      try {
        const [l, d] = await Promise.all([
          api.get('/rh/empresas/stores/list').catch(() => ({ data: [] })),
          api.get('/rh/configuracoes/departamentos').catch(() => ({ data: [] })),
        ]);
        const listaLojas = l.data?.data || l.data || [];
        setLojas(listaLojas);
        setDepartamentos(d.data?.data || d.data || []);
        if (listaLojas.length && !filtroLoja) setFiltroLoja(String(listaLojas[0].cod_loja));
      } catch { toast.error('Erro ao carregar lojas/setores'); }
    })();
    // eslint-disable-next-line
  }, []);

  const carregar = async () => {
    if (filtroLoja === '' || filtroLoja == null) { setSetores([]); return; }
    setLoading(true);
    try {
      const r = await api.get(`/rh/performance-setor?cod_loja=${filtroLoja}&ano=${ano}`);
      setSetores(r.data?.setores || []);
      setMeta({ total_colaboradores: r.data?.total_colaboradores || 0, total_clt: r.data?.total_clt || 0, total_aprendiz: r.data?.total_aprendiz || 0 });
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Erro ao carregar performance');
    } finally { setLoading(false); }
  };
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [filtroLoja, ano]);

  const criarSetor = async () => {
    if (!novoNome.trim()) { toast.error('Informe o Setor da Loja'); return; }
    setSalvando(true);
    try {
      await api.post('/rh/performance-setor', {
        cod_loja: Number(filtroLoja), nome_setor_loja: novoNome.trim(),
        departamento_id: novoDep ? Number(novoDep) : null,
      });
      toast.success('Setor criado');
      setModal(false); setNovoNome(''); setNovoDep('');
      await carregar();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Erro ao criar setor');
    } finally { setSalvando(false); }
  };

  const excluirSetor = async (s) => {
    if (!window.confirm(`Excluir o setor "${s.nome_setor_loja}"? As vendas lançadas nele serão apagadas.`)) return;
    try {
      await api.delete(`/rh/performance-setor/${s.id}`);
      toast.success('Setor excluído');
      await carregar();
    } catch { toast.error('Erro ao excluir'); }
  };

  // Salva a venda de uma célula (mês) e recalcula a performance localmente
  const salvarVenda = async (setor, mes, valorRaw) => {
    const venda = parseMoeda(valorRaw);
    const atual = setor.meses.find(m => m.mes === mes)?.venda || 0;
    if (venda === atual) return; // nada mudou
    try {
      await api.post('/rh/performance-setor/venda', { setor_id: setor.id, ano, mes, venda });
      setSetores(prev => prev.map(s => {
        if (s.id !== setor.id) return s;
        const meses = s.meses.map(m => m.mes === mes
          ? { ...m, venda, performance: s.qtd_colaboradores > 0 ? +(venda / s.qtd_colaboradores).toFixed(2) : 0 }
          : m);
        return { ...s, meses };
      }));
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Erro ao salvar venda');
    }
  };

  const lojaSel = lojas.find(l => String(l.cod_loja) === String(filtroLoja));
  const vendaDoMes = (s, mes) => s.meses.find(m => m.mes === mes)?.venda || 0;

  // Soma das vendas de todos os setores que compartilham o mesmo Setor do Colaborador
  const grupoVenda = (depId, mes) => depId == null ? 0
    : setores.filter(x => x.departamento_id === depId).reduce((a, x) => a + vendaDoMes(x, mes), 0);

  // Performance da linha: com toggle ON, usa a soma do grupo ÷ qtd (mesma média nas linhas do grupo)
  const perfRow = (s, mes) => {
    const qtd = s.qtd_colaboradores || 0;
    if (qtd <= 0) return 0;
    const base = (somarMedias && s.departamento_id != null) ? grupoVenda(s.departamento_id, mes) : vendaDoMes(s, mes);
    return base / qtd;
  };
  const temPerf = (s, mes) => (s.qtd_colaboradores > 0) &&
    ((somarMedias && s.departamento_id != null ? grupoVenda(s.departamento_id, mes) : vendaDoMes(s, mes)) > 0);

  // Totais: venda total do mês + headcount REAL da loja (cadastro), não a soma dos setores
  const totalVendaMes = (mes) => setores.reduce((a, s) => a + vendaDoMes(s, mes), 0);
  const totalColab = meta.total_colaboradores || 0;

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <style>{`
          .perf-scroll::-webkit-scrollbar { height: 11px; }
          .perf-scroll::-webkit-scrollbar-track { background: #f3f4f6; }
          .perf-scroll::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 999px; border: 3px solid #f3f4f6; }
          .perf-scroll::-webkit-scrollbar-thumb:hover { background: #b8bec7; }
          .perf-scroll { scrollbar-color: #d1d5db #f3f4f6; }
        `}</style>
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-4 shadow">
          <h1 className="text-2xl font-bold">📊 Performance por Setor</h1>
          <p className="text-sm opacity-90">Venda por setor e performance por colaborador — mês a mês</p>
        </div>

        {/* Filtros */}
        <div className="px-6 py-4 bg-white border-b flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold uppercase text-gray-500">Loja</label>
            <select value={filtroLoja} onChange={e => setFiltroLoja(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm font-semibold bg-white">
              {lojas.length === 0 && <option value="">— sem lojas —</option>}
              {lojas.map(l => <option key={l.cod_loja} value={l.cod_loja}>{l.label || `Loja ${l.cod_loja}`}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold uppercase text-gray-500">Ano</label>
            <select value={ano} onChange={e => setAno(Number(e.target.value))}
              className="border rounded-lg px-3 py-2 text-sm font-semibold bg-white">
              {[anoAtual + 1, anoAtual, anoAtual - 1, anoAtual - 2].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer select-none ml-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
            <input type="checkbox" checked={somarMedias} onChange={e => setSomarMedias(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
            Somar médias dos Setores
            <span className="text-emerald-600" title="Setores com o mesmo 'Setor do Colaborador' compartilham as mesmas pessoas: soma as vendas deles e divide pela qtd do setor — a mesma média aparece em todas as linhas do grupo.">ⓘ</span>
          </label>
          <button onClick={() => setModal(true)} disabled={!filtroLoja}
            className="ml-auto px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 disabled:opacity-50">
            ➕ Novo Setor
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="text-center text-gray-400 p-12">Carregando…</div>
          ) : setores.length === 0 ? (
            <div className="text-center text-gray-400 p-12 bg-white rounded-lg border-2 border-dashed border-gray-200">
              Nenhum setor cadastrado {lojaSel ? `na ${lojaSel.label || 'loja'}` : ''}. Clique em <b>➕ Novo Setor</b> pra começar.
            </div>
          ) : (
            <div className="bg-white rounded-lg border shadow-sm overflow-x-auto perf-scroll">
              <table key={`${filtroLoja}-${ano}`} className="text-sm border-collapse" style={{ minWidth: '1750px' }}>
                <thead>
                  <tr className="bg-slate-100 border-b-2 border-slate-200">
                    <th className="text-left px-3 py-2 font-bold uppercase text-xs text-slate-600 sticky left-0 bg-slate-100 z-10" style={{ minWidth: '160px' }}>Setor da Loja</th>
                    <th className="text-left px-3 py-2 font-bold uppercase text-xs text-slate-600" style={{ minWidth: '160px' }}>Setor do Colaborador</th>
                    <th className="text-center px-2 py-2 font-bold uppercase text-xs text-blue-600" style={{ minWidth: '55px' }}>CLT</th>
                    <th className="text-center px-2 py-2 font-bold uppercase text-xs text-amber-600" style={{ minWidth: '70px' }}>Aprendiz</th>
                    <th className="text-center px-2 py-2 font-bold uppercase text-xs text-slate-600" style={{ minWidth: '70px' }}>Qtd</th>
                    {MESES.map(m => (
                      <th key={m} colSpan={2} className="text-center px-2 py-2 text-xs font-bold text-white bg-emerald-600 border-l border-emerald-500">{m}</th>
                    ))}
                    <th className="px-2 bg-slate-100"></th>
                  </tr>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase text-slate-500">
                    <th className="sticky left-0 bg-slate-50 z-10"></th>
                    <th></th>
                    <th></th>
                    <th></th>
                    <th></th>
                    {MESES.map(m => (
                      <Fragment key={m}>
                        <th className="text-center px-1 py-1 font-bold text-emerald-700 bg-emerald-50 border-l border-emerald-100">Venda</th>
                        <th className="text-center px-1 py-1 font-bold text-emerald-700 bg-emerald-50">Perform.</th>
                      </Fragment>
                    ))}
                    <th></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {setores.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5 font-semibold text-gray-800 sticky left-0 bg-white z-10 whitespace-nowrap">{s.nome_setor_loja}</td>
                      <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">
                        {s.departamento_nome || <span className="text-amber-600 text-xs">⚠ sem setor vinculado</span>}
                      </td>
                      <td className="px-2 py-1.5 text-center font-semibold text-blue-600">{s.qtd_clt || 0}</td>
                      <td className="px-2 py-1.5 text-center font-semibold text-amber-600">{s.qtd_aprendiz || 0}</td>
                      <td className="px-2 py-1.5 text-center font-bold text-indigo-700">{s.qtd_colaboradores}</td>
                      {s.meses.map(m => (
                        <Fragment key={m.mes}>
                          <td className="px-1 py-1 border-l border-slate-100">
                            <input type="text" defaultValue={m.venda ? m.venda.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                              onBlur={e => salvarVenda(s, m.mes, e.target.value)}
                              placeholder="—"
                              className="w-24 text-right px-1 py-0.5 text-xs border border-transparent hover:border-gray-300 focus:border-indigo-400 focus:bg-indigo-50/40 rounded outline-none" />
                          </td>
                          <td className="px-1 py-1 text-right text-xs font-semibold text-emerald-700 whitespace-nowrap">
                            {temPerf(s, m.mes) ? fmtMoeda(perfRow(s, m.mes)) : <span className="text-gray-300">—</span>}
                          </td>
                        </Fragment>
                      ))}
                      <td className="px-2 py-1.5 text-center">
                        <button onClick={() => excluirSetor(s)} title="Excluir setor" className="text-rose-500 hover:text-rose-700 text-xs font-bold">✕</button>
                      </td>
                    </tr>
                  ))}
                  {/* Linha TOTAL: soma das vendas + performance geral (venda total ÷ colaboradores distintos) */}
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                    <td className="px-3 py-2 uppercase text-xs text-slate-700 sticky left-0 bg-slate-100 z-10">Total</td>
                    <td className="bg-slate-100"></td>
                    <td className="px-2 py-2 text-center text-blue-600">{meta.total_clt || 0}</td>
                    <td className="px-2 py-2 text-center text-amber-600">{meta.total_aprendiz || 0}</td>
                    <td className="px-2 py-2 text-center text-indigo-700" title="Colaboradores ativos cadastrados na loja (headcount real, não a soma dos setores)">{totalColab}</td>
                    {MESES.map((_, i) => {
                      const mes = i + 1;
                      const tv = totalVendaMes(mes);
                      return (
                        <Fragment key={mes}>
                          <td className="px-1 py-2 text-right text-xs text-gray-800 border-l border-slate-200 whitespace-nowrap">{tv > 0 ? tv.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</td>
                          <td className="px-1 py-2 text-right text-xs text-emerald-700 whitespace-nowrap">{tv > 0 && totalColab > 0 ? fmtMoeda(tv / totalColab) : '—'}</td>
                        </Fragment>
                      );
                    })}
                    <td className="bg-slate-100"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-3">💡 Digite a <b>Venda</b> do setor no mês (ex.: 300.000,00) e sai do campo — a <b>Performance</b> (venda ÷ nº de colaboradores) é calculada na hora. Tudo por loja e por ano.</p>
        </div>
      </div>

      {/* Modal Novo Setor */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setModal(false)}>
          <div className="bg-white rounded-xl p-5 w-96 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-3">➕ Novo Setor {lojaSel ? `· ${lojaSel.label}` : ''}</h3>
            <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Setor da Loja</label>
            <input type="text" value={novoNome} onChange={e => setNovoNome(e.target.value.toUpperCase())}
              placeholder="Ex.: AÇOUGUE" className="w-full border rounded-lg px-3 py-2 text-sm mb-3" autoFocus />
            <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Setor do Colaborador</label>
            <select value={novoDep} onChange={e => setNovoDep(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-1 bg-white">
              <option value="">— selecione —</option>
              {departamentos.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
            <p className="text-[11px] text-gray-400 mb-4">Vem de Configurações › Setores. É por ele que a qtd de colaboradores é contada.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setModal(false)} className="px-4 py-2 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-100">Cancelar</button>
              <button onClick={criarSetor} disabled={salvando} className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60">{salvando ? 'Salvando…' : 'Criar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
