import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const STATUS = {
  trabalhou: { label: '✓ Trabalhou', cls: 'bg-emerald-100 text-emerald-700' },
  folga: { label: '🌙 Folga', cls: 'bg-blue-100 text-blue-700' },
  falta: { label: '🔴 Falta', cls: 'bg-rose-200 text-rose-800' },
  feriado: { label: '🎉 Feriado', cls: 'bg-purple-100 text-purple-700' },
};

// Colunas da tabela (arrastáveis). cell(d) devolve o CONTEÚDO da célula.
const COLS_DEF = {
  data: { label: 'Data', th: 'text-left', td: 'px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap', cell: d => d.dia },
  diasemana: { label: 'Dia da Semana', th: 'text-center', td: 'px-3 py-2 text-center whitespace-nowrap', cell: d => <span className="text-xs font-bold px-2 py-0.5 rounded bg-yellow-200 text-amber-900">{diaSemana(d.ymd)}</span> },
  jornada: { label: 'Jornada', th: 'text-left', td: 'px-3 py-2 text-xs text-gray-500 whitespace-nowrap', cell: d => d.jornada || '—' },
  marcacoes: { label: 'Marcações', th: 'text-left', td: 'px-3 py-2', cell: d => (
    <div className="flex flex-wrap gap-1">
      {d.batidas.length === 0 ? <span className="text-xs text-gray-400">—</span> : d.batidas.map((b, j) => (
        <span key={j} title={b.justificativa || (b.tipo === 'E' ? 'Entrada' : b.tipo === 'S' ? 'Saída' : b.tipo)}
          className={`px-2 py-0.5 rounded text-xs font-mono ${b.tipo === 'E' ? 'bg-emerald-100 text-emerald-800' : b.tipo === 'S' ? 'bg-rose-100 text-rose-800' : 'bg-gray-200 text-gray-600'}`}>{b.hora}</span>
      ))}
    </div>) },
  trabalhado: { label: 'Trabalhado', th: 'text-right', td: 'px-3 py-2 text-right font-semibold text-blue-700', cell: d => fmtMin(d.trabalhado_min) },
  he: { label: 'HE', th: 'text-right', td: 'px-3 py-2 text-right text-amber-700 font-semibold', cell: d => d.he_min > 0 ? fmtMin(d.he_min) : '—' },
  saldo: { label: 'Saldo Banco', th: 'text-right', td: 'px-3 py-2 text-right font-bold', cell: d => (
    <span className={d.saldo_banco_min == null ? 'text-gray-400' : d.saldo_banco_min >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
      {d.saldo_banco_min == null ? '—' : (d.saldo_banco_min >= 0 ? '+' : '') + fmtMin(d.saldo_banco_min)}
    </span>) },
  alerta: { label: 'Pontos de Atenção', th: 'text-left', td: 'px-3 py-2 text-xs align-middle', cell: d => (
    d.alerta
      ? <span className={`inline-flex items-start gap-1 ${d.alerta_cor === 'danger' ? 'text-rose-600' : 'text-amber-600'}`} title={d.alerta}>⚠️ <span>{d.alerta}</span></span>
      : <span className="text-gray-300">—</span>
  ) },
  situacao: { label: 'Situação', th: 'text-center', td: 'px-3 py-2 text-center whitespace-nowrap', cell: d => {
    const st = STATUS[d.status] || STATUS.trabalhou;
    return <span className={`text-xs font-semibold px-2 py-0.5 rounded ${st.cls}`}>{st.label}</span>;
  } },
};
const COLS_ORDEM_PADRAO = ['data', 'diasemana', 'jornada', 'marcacoes', 'trabalhado', 'he', 'saldo', 'alerta', 'situacao'];
const LS_ORDEM = 'espelhoPonto_colOrder';
const fmtMin = (m) => (m == null) ? '—' : `${m < 0 ? '-' : ''}${Math.floor(Math.abs(m) / 60)}h${String(Math.abs(m) % 60).padStart(2, '0')}`;
const hoje = () => new Date().toISOString().split('T')[0];
const primeiroDiaMes = () => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; };
const diaSemana = (ymd) => {
  const dt = new Date(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8));
  return DIAS_SEMANA[dt.getDay()] || '';
};

export default function RhEspelhoPonto() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [empresas, setEmpresas] = useState([]);
  const [companyId, setCompanyId] = useState('');
  const [colaboradores, setColaboradores] = useState([]);
  const [colaboradorId, setColaboradorId] = useState('');
  const [dataInicio, setDataInicio] = useState(primeiroDiaMes());
  const [dataFim, setDataFim] = useState(hoje());

  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [relogio, setRelogio] = useState(null); // status conexão

  // Ordem das colunas (arrastáveis), salva no navegador
  const [colOrder, setColOrder] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem(LS_ORDEM) || 'null');
      if (Array.isArray(s)) {
        const arr = s.filter(k => COLS_ORDEM_PADRAO.includes(k));
        // insere colunas novas na posição relativa do padrão (logo após a anterior existente)
        COLS_ORDEM_PADRAO.forEach((k, idx) => {
          if (arr.includes(k)) return;
          let at = arr.length;
          for (let j = idx - 1; j >= 0; j--) { const p = arr.indexOf(COLS_ORDEM_PADRAO[j]); if (p >= 0) { at = p + 1; break; } }
          arr.splice(at, 0, k);
        });
        return arr;
      }
    } catch { /* ignore */ }
    return COLS_ORDEM_PADRAO;
  });
  const [dragKey, setDragKey] = useState(null);
  const [dragOverKey, setDragOverKey] = useState(null);
  const soltarColuna = (destKey) => {
    if (!dragKey || dragKey === destKey) { setDragKey(null); setDragOverKey(null); return; }
    const arr = [...colOrder];
    arr.splice(arr.indexOf(destKey), 0, arr.splice(arr.indexOf(dragKey), 1)[0]);
    setColOrder(arr);
    try { localStorage.setItem(LS_ORDEM, JSON.stringify(arr)); } catch { /* ignore */ }
    setDragKey(null); setDragOverKey(null);
  };

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/rh/empresas/stores/list');
        setEmpresas(Array.isArray(r.data) ? r.data : (r.data?.companies || []));
      } catch { /* ignore */ }
    })();
    // testa conexão com o relógio (não bloqueia)
    api.get('/rh/ponto/relogio/status').then(r => setRelogio(r.data)).catch(e => setRelogio({ ok: false, error: e?.response?.data?.error || 'offline' }));
  }, []);

  // Carrega colaboradores ao trocar de loja
  useEffect(() => {
    (async () => {
      setColaboradores([]); setColaboradorId('');
      try {
        const params = new URLSearchParams({ status: 'ativo', limit: '1000' });
        if (companyId) params.append('company_id', companyId);
        const r = await api.get(`/rh/colaboradores?${params.toString()}`);
        setColaboradores(Array.isArray(r.data?.data) ? r.data.data : []);
      } catch { /* ignore */ }
    })();
  }, [companyId]);

  const carregar = async () => {
    if (!colaboradorId) { toast.error('Escolha um colaborador'); return; }
    if (!dataInicio || !dataFim) { toast.error('Informe o período'); return; }
    setLoading(true); setResultado(null);
    try {
      const params = new URLSearchParams({ colaborador_id: colaboradorId, data_inicio: dataInicio, data_fim: dataFim });
      const r = await api.get(`/rh/ponto/espelho?${params.toString()}`);
      setResultado(r.data);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Erro ao buscar as marcações');
    } finally { setLoading(false); }
  };

  const col = resultado?.colaborador;
  const tot = resultado?.totais;

  const brDate = (s) => (s ? String(s).split('-').reverse().join('/') : '');
  const gerarPdf = () => {
    if (!resultado || !col || !resultado.dias?.length) return;
    const alignOf = (k) => COLS_DEF[k].th.includes('right') ? 'right' : COLS_DEF[k].th.includes('center') ? 'center' : 'left';
    const ths = colOrder.map(k => `<th style="padding:6px 8px;background:#4b5563;color:#fff;text-align:${alignOf(k)};font-size:12px">${COLS_DEF[k].label}</th>`).join('');
    const linhas = resultado.dias.map(d => {
      const tds = colOrder.map(k => {
        let inner = '—';
        if (k === 'data') inner = d.dia;
        else if (k === 'diasemana') inner = `<span style="background:#fde68a;color:#78350f;padding:1px 6px;border-radius:4px;font-size:11px;font-weight:bold">${diaSemana(d.ymd)}</span>`;
        else if (k === 'jornada') inner = `<span style="color:#6b7280;font-size:11px">${d.jornada || '—'}</span>`;
        else if (k === 'marcacoes') inner = d.batidas.length ? d.batidas.map(b => `<span style="font-family:monospace;font-size:11px;padding:1px 5px;border-radius:4px;margin:0 2px 0 0;background:${b.tipo === 'E' ? '#d1fae5' : b.tipo === 'S' ? '#ffe4e6' : '#e5e7eb'};color:${b.tipo === 'E' ? '#065f46' : b.tipo === 'S' ? '#9f1239' : '#374151'}">${b.hora}</span>`).join('') : '—';
        else if (k === 'trabalhado') inner = `<b style="color:#1d4ed8">${fmtMin(d.trabalhado_min)}</b>`;
        else if (k === 'he') inner = d.he_min > 0 ? `<b style="color:#b45309">${fmtMin(d.he_min)}</b>` : '—';
        else if (k === 'saldo') { const v = d.saldo_banco_min; inner = v == null ? '—' : `<b style="color:${v >= 0 ? '#047857' : '#be123c'}">${(v >= 0 ? '+' : '') + fmtMin(v)}</b>`; }
        else if (k === 'alerta') inner = d.alerta ? `<span style="color:${d.alerta_cor === 'danger' ? '#be123c' : '#b45309'}">⚠️ ${d.alerta}</span>` : '—';
        else if (k === 'situacao') inner = (STATUS[d.status] || STATUS.trabalhou).label;
        return `<td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:${alignOf(k)};white-space:nowrap">${inner}</td>`;
      }).join('');
      const bg = d.status === 'falta' ? 'background:#fff1f2' : d.status === 'folga' ? 'background:#eff6ff' : '';
      return `<tr style="${bg}">${tds}</tr>`;
    }).join('');
    const sa = tot.saldo_banco_atual_min;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Espelho de Ponto - ${col.nome}</title></head>
<body style="font-family:Arial,sans-serif;color:#111;margin:22px">
  <h2 style="margin:0 0 2px">🕐 Espelho de Ponto</h2>
  <div style="font-size:13px;color:#374151"><b>${col.nome}</b> · ${col.cargo_nome || '—'} · Mat. ${col.matricula || '—'} · PIS ${col.pis_pasep}<br>
  Jornada ${col.jornada || '—'} · Período ${brDate(resultado.periodo.data_inicio)} a ${brDate(resultado.periodo.data_fim)}</div>
  <div style="margin:10px 0;display:flex;gap:8px;font-size:13px;flex-wrap:wrap">
    <div style="border:1px solid #ddd;border-radius:6px;padding:6px 10px">Trabalhado: <b>${fmtMin(tot.trabalhado_min)}</b></div>
    <div style="border:1px solid #ddd;border-radius:6px;padding:6px 10px">HE: <b>${tot.he_min > 0 ? fmtMin(tot.he_min) : '—'}</b></div>
    <div style="border:1px solid #ddd;border-radius:6px;padding:6px 10px">Trab/Folga/Falta: <b>${tot.dias_trabalhados}/${tot.dias_folga}/${tot.dias_falta}</b></div>
    <div style="border:2px solid ${(sa ?? 0) >= 0 ? '#10b981' : '#f43f5e'};border-radius:6px;padding:6px 10px">⭐ Saldo Banco atual${tot.saldo_banco_atual_data ? ` (${tot.saldo_banco_atual_data})` : ''}: <b style="color:${(sa ?? 0) >= 0 ? '#047857' : '#be123c'}">${sa == null ? '—' : (sa >= 0 ? '+' : '') + fmtMin(sa)}</b></div>
  </div>
  <table style="border-collapse:collapse;width:100%;font-size:12px"><thead><tr>${ths}</tr></thead><tbody>${linhas}</tbody></table>
  <p style="font-size:11px;color:#9ca3af;margin-top:10px">Dados oficiais da RHiD — saldo do banco reflete queima/pagamento de horas. Gerado pelo Kontrata.ai.</p>
</body></html>`;
    const w = window.open('', '_blank');
    if (!w) { toast.error('Permita pop-ups pra gerar o PDF'); return; }
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 400);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">🕐 Espelho de Ponto</h1>
              <p className="text-purple-100 text-sm">Marcações do relógio por colaborador e período</p>
            </div>
            <div className="flex items-center gap-3">
              {relogio && (
                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${relogio.ok ? 'bg-emerald-500/20 text-emerald-50' : 'bg-red-500/30 text-red-50'}`}>
                  {relogio.ok ? `🟢 RHiD conectada (${relogio.ms}ms)` : '🔴 RHiD offline'}
                </span>
              )}
              <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-purple-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white border-b border-gray-200 p-3 md:p-4">
          <div className="grid grid-cols-2 md:grid-cols-12 gap-3 items-end">
            <div className="col-span-2 md:col-span-3">
              <label className="block text-xs font-bold uppercase text-gray-600 mb-1">🏪 Loja</label>
              <select value={companyId} onChange={e => setCompanyId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option value="">Todas</option>
                {empresas.map(e => (
                  <option key={e.id} value={e.id}>{e.apelido ? `Loja ${e.cod_loja} - ${e.apelido}` : (e.label || e.nome_fantasia)}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 md:col-span-4">
              <label className="block text-xs font-bold uppercase text-gray-600 mb-1">👤 Colaborador</label>
              <select value={colaboradorId} onChange={e => setColaboradorId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option value="">{colaboradores.length ? 'Selecione…' : 'Carregando…'}</option>
                {colaboradores.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}{c.matricula ? ` (Mat. ${c.matricula})` : ''}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase text-gray-600 mb-1">De</label>
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Até</label>
              <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="md:col-span-1">
              <button onClick={carregar} disabled={loading}
                className={`w-full px-3 py-2 rounded-lg text-sm font-bold text-white ${loading ? 'bg-gray-400' : 'bg-purple-600 hover:bg-purple-700'}`}>
                {loading ? '...' : '🔍'}
              </button>
            </div>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-auto p-3 md:p-4">
          {!resultado ? (
            <div className="text-center py-20 text-gray-400">
              <div className="text-5xl mb-2">🕐</div>
              <p className="font-semibold">Escolha o colaborador e o período, e clique em buscar</p>
            </div>
          ) : resultado.sem_pis ? (
            <div className="text-center py-16 text-amber-600 bg-amber-50 rounded-lg border border-amber-200">
              <div className="text-4xl mb-2">⚠️</div>
              <p className="font-bold">{col?.nome} está sem PIS vinculado no cadastro</p>
              <p className="text-sm mt-1 text-amber-700">Preencha o PIS/PASEP na ficha do colaborador pra casar com a apuração da RHiD.</p>
            </div>
          ) : resultado.nao_encontrado_rhid ? (
            <div className="text-center py-16 text-amber-600 bg-amber-50 rounded-lg border border-amber-200">
              <div className="text-4xl mb-2">🔎</div>
              <p className="font-bold">{col?.nome} (PIS {col?.pis_pasep}) não foi encontrado na RHiD</p>
              <p className="text-sm mt-1 text-amber-700">Confira se o PIS bate com o cadastro na RHiD.</p>
            </div>
          ) : (
            <>
              {/* Cabeçalho do colaborador + totais */}
              <div className="bg-white rounded-lg border border-gray-200 p-4 mb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-bold text-gray-800">{col.nome}</div>
                    <div className="text-xs text-gray-500">
                      {col.cargo_nome || '—'} · Mat. {col.matricula || '—'} · PIS {col.pis_pasep} · Jornada {col.jornada || '—'}
                      <span className="ml-2 px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-semibold">apuração RHiD</span>
                    </div>
                  </div>
                  <div className="flex gap-2 text-center">
                    <div className="px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-100">
                      <div className="text-[10px] uppercase text-blue-500 font-bold">Trabalhado</div>
                      <div className="font-bold text-blue-700">{fmtMin(tot.trabalhado_min)}</div>
                    </div>
                    <div className="px-3 py-1.5 bg-amber-50 rounded-lg border border-amber-100">
                      <div className="text-[10px] uppercase text-amber-500 font-bold">Hora Extra</div>
                      <div className="font-bold text-amber-700">{tot.he_min > 0 ? fmtMin(tot.he_min) : '—'}</div>
                    </div>
                    <div className="px-3 py-1.5 bg-gray-50 rounded-lg border">
                      <div className="text-[10px] uppercase text-gray-500 font-bold">Trab/Folga/Falta</div>
                      <div className="font-bold text-gray-800">{tot.dias_trabalhados}/{tot.dias_folga}/<span className={tot.dias_falta ? 'text-rose-600' : ''}>{tot.dias_falta}</span></div>
                    </div>
                    <div className={`px-4 py-1.5 rounded-lg border-2 ${(tot.saldo_banco_atual_min ?? 0) >= 0 ? 'bg-emerald-50 border-emerald-300' : 'bg-rose-50 border-rose-300'}`}>
                      <div className={`text-[10px] uppercase font-bold ${(tot.saldo_banco_atual_min ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>⭐ Saldo Banco ATUAL{tot.saldo_banco_atual_data ? ` · ${tot.saldo_banco_atual_data}` : ''}</div>
                      <div className={`text-xl font-extrabold leading-tight ${(tot.saldo_banco_atual_min ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {tot.saldo_banco_atual_min == null ? '—' : ((tot.saldo_banco_atual_min >= 0 ? '+' : '') + fmtMin(tot.saldo_banco_atual_min))}
                      </div>
                      <div className="text-[10px] text-gray-400">no período: {tot.saldo_banco_periodo_min == null ? '—' : ((tot.saldo_banco_periodo_min >= 0 ? '+' : '') + fmtMin(tot.saldo_banco_periodo_min))}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Toolbar */}
              {resultado.dias.length > 0 && (
                <div className="flex justify-end mb-2">
                  <button onClick={gerarPdf}
                    className="px-3 py-1.5 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700">
                    📄 PDF
                  </button>
                </div>
              )}

              {/* Tabela do espelho */}
              {resultado.dias.length === 0 ? (
                <div className="text-center py-12 text-gray-400 bg-white rounded-lg border">
                  Nenhum dia apurado nesse período.
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-600 text-white sticky top-0">
                      <tr>
                        {colOrder.map(k => {
                          const c = COLS_DEF[k];
                          const over = dragOverKey === k && dragKey && dragKey !== k;
                          return (
                            <th key={k} draggable
                              onDragStart={() => setDragKey(k)}
                              onDragEnd={() => { setDragKey(null); setDragOverKey(null); }}
                              onDragOver={e => { e.preventDefault(); setDragOverKey(k); }}
                              onDrop={() => soltarColuna(k)}
                              title="Arraste para reordenar"
                              className={`px-3 py-2 cursor-move select-none ${c.th} ${dragKey === k ? 'opacity-40' : ''} ${over ? 'ring-2 ring-inset ring-white' : ''}`}>
                              <span className="inline-flex items-center gap-1"><span className="opacity-50 text-[10px] leading-none">⠿</span>{c.label}</span>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {resultado.dias.map((d, i) => (
                        <tr key={d.ymd} className={d.status === 'falta' ? 'bg-rose-50' : d.status === 'folga' ? 'bg-blue-50/40' : (i % 2 ? 'bg-gray-50' : 'bg-white')}>
                          {colOrder.map(k => <td key={k} className={COLS_DEF[k].td}>{COLS_DEF[k].cell(d)}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-[11px] text-gray-400 mt-2">
                ✅ Dados oficiais da <strong>RHiD</strong> — saldo do banco já reflete queima/pagamento de horas. Coluna "Saldo Banco" = saldo acumulado até o dia.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
