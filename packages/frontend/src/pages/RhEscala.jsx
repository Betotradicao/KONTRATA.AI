import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import RadarLoading from '../components/RadarLoading';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function mesAtualStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function RhEscala() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [empresas, setEmpresas] = useState([]);
  const [setores, setSetores] = useState([]);
  const [companyId, setCompanyId] = useState('');
  const [departamentoId, setDepartamentoId] = useState('');
  const [mes, setMes] = useState(mesAtualStr());

  const [turnos, setTurnos] = useState([]);
  const [grid, setGrid] = useState(null);
  const [loading, setLoading] = useState(false);

  const [celulaEdit, setCelulaEdit] = useState(null); // { colaboradorId, data, codigoAtual }
  const [semanaFiltro, setSemanaFiltro] = useState('');  // '' = mes inteiro, '1','2','3'... = semana

  // Calcula semanas do mes (Seg-Dom). Semana 1 comeca no dia 1 (mesmo se nao for segunda);
  // rompe no proximo domingo e semana 2 comeca na segunda seguinte.
  const semanasDoMes = useMemo(() => {
    if (!grid?.dias?.length) return [];
    const semanas = [];
    let cur = { num: 1, ini: null, fim: null, dias: [] };
    grid.dias.forEach(d => {
      if (cur.ini === null) cur.ini = d.data;
      cur.fim = d.data;
      cur.dias.push(d.data);
      if (d.diaSemana === 0) {
        // domingo: fecha semana
        semanas.push(cur);
        cur = { num: cur.num + 1, ini: null, fim: null, dias: [] };
      }
    });
    if (cur.dias.length > 0) semanas.push(cur);
    return semanas;
  }, [grid]);

  // Aplica filtro de semana sobre os dias/celulas do grid
  const gridFiltrado = useMemo(() => {
    if (!grid) return null;
    if (!semanaFiltro) return grid;
    const sem = semanasDoMes.find(s => String(s.num) === String(semanaFiltro));
    if (!sem) return grid;
    const diasSet = new Set(sem.dias);
    return {
      ...grid,
      dias: grid.dias.filter(d => diasSet.has(d.data)),
      colaboradores: grid.colaboradores.map(c => ({
        ...c,
        celulas: c.celulas.filter(cel => diasSet.has(cel.data)),
        horasMes: c.celulas.filter(cel => diasSet.has(cel.data)).reduce((s, x) => s + (x.totalHoras || 0), 0),
      })),
    };
  }, [grid, semanaFiltro, semanasDoMes]);

  // Carrega empresas + setores + turnos uma vez
  useEffect(() => {
    (async () => {
      try {
        const [r1, r2, r3] = await Promise.all([
          api.get('/rh/empresas/stores/list'),
          api.get('/rh/configuracoes/departamentos'),
          api.get('/rh/escala/turnos'),
        ]);
        const emps = Array.isArray(r1.data) ? r1.data : [];
        setEmpresas(emps);
        if (emps.length > 0 && !companyId) setCompanyId(emps[0].id);
        setSetores(Array.isArray(r2.data) ? r2.data : (r2.data?.departamentos || []));
        setTurnos(Array.isArray(r3.data) ? r3.data : []);
      } catch (e) {
        console.error(e);
      }
    })();
    // eslint-disable-next-line
  }, []);

  const carregarGrid = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('company_id', companyId);
      if (departamentoId) params.set('departamento_id', departamentoId);
      params.set('mes', mes);
      const r = await api.get(`/rh/escala/grid?${params}`);
      setGrid(r.data);
    } catch (e) {
      toast.error('Erro ao carregar escala');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (companyId) carregarGrid();
    // eslint-disable-next-line
  }, [companyId, departamentoId, mes]);

  const setorNome = useMemo(() => {
    if (!departamentoId) return 'Todos os setores';
    const s = setores.find(s => String(s.id) === String(departamentoId));
    return s?.nome || 'Setor';
  }, [departamentoId, setores]);

  const mesNome = useMemo(() => {
    const [y, m] = mes.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }, [mes]);

  const salvarCelula = async (turnoId) => {
    if (!celulaEdit) return;
    try {
      if (turnoId === null) {
        await api.delete('/rh/escala/celula', { data: { colaboradorId: celulaEdit.colaboradorId, data: celulaEdit.data } });
      } else {
        await api.post('/rh/escala/celula', { colaboradorId: celulaEdit.colaboradorId, data: celulaEdit.data, turnoId });
      }
      setCelulaEdit(null);
      await carregarGrid();
    } catch {
      toast.error('Erro ao salvar');
    }
  };

  // Arrasto tipo Excel pra preencher varias celulas na mesma linha
  const [dragFill, setDragFill] = useState(null);
  // { colabId, sourceData, sourceTurnoId, sourceIdx, targetIdx }

  useEffect(() => {
    if (!dragFill) return;
    const onUp = async () => {
      const df = dragFill;
      setDragFill(null);
      if (!df || df.targetIdx === df.sourceIdx) return;
      const colab = grid.colaboradores.find(x => x.id === df.colabId);
      if (!colab) return;
      const ini = Math.min(df.sourceIdx, df.targetIdx);
      const fim = Math.max(df.sourceIdx, df.targetIdx);
      const cells = colab.celulas.slice(ini, fim + 1);
      try {
        await Promise.all(cells.map(cel =>
          df.sourceTurnoId
            ? api.post('/rh/escala/celula', { colaboradorId: df.colabId, data: cel.data, turnoId: df.sourceTurnoId })
            : api.delete('/rh/escala/celula', { data: { colaboradorId: df.colabId, data: cel.data } })
        ));
        toast.success(`${cells.length} dias preenchidos`);
        await carregarGrid();
      } catch {
        toast.error('Erro ao preencher');
      }
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
    // eslint-disable-next-line
  }, [dragFill]);

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Escala de Trabalho</h1>
              <p className="text-orange-100 text-sm">Planejamento mensal — {setorNome} · {mesNome}</p>
            </div>
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-purple-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white border-b px-6 py-3 flex items-center gap-3 flex-wrap">
          <div>
            <label className="block text-[10px] uppercase text-gray-500 font-semibold">Loja</label>
            <select value={companyId} onChange={e => setCompanyId(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm">
              {empresas.map(e => (
                <option key={e.id} value={e.id}>{e.apelido ? `Loja ${e.cod_loja} — ${e.apelido}` : e.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase text-gray-500 font-semibold">Setor</label>
            <select value={departamentoId} onChange={e => setDepartamentoId(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm font-medium text-orange-600">
              <option value="">— Todos os setores —</option>
              {setores.map(s => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase text-gray-500 font-semibold">Mês</label>
            <input type="month" value={mes} onChange={e => setMes(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <div className="flex-1" />
          <button onClick={carregarGrid}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold">
            ↻ Recarregar
          </button>
        </div>

        {/* Grid */}
        <div className="px-6 py-4">
          {loading ? (
            <div className="flex justify-center py-20"><RadarLoading size="sm" message="Carregando escala..." /></div>
          ) : !grid || grid.colaboradores.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-10 text-center text-gray-400">
              <div className="text-5xl mb-3">📅</div>
              <p className="font-semibold">Nenhum colaborador encontrado pra este filtro</p>
              <p className="text-xs mt-1">Ajuste o setor ou cadastre colaboradores ativos.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow border overflow-auto" style={{ maxHeight: '75vh' }}>
              <table className="text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="sticky left-0 z-20 bg-gray-50 px-3 py-2 text-left font-semibold text-gray-700 border-b"
                        style={{ minWidth: 200 }}>Colaborador</th>
                    {grid.dias.map(d => {
                      const [ , mm, dd ] = d.data.split('-');
                      const dsInfo = DIAS_SEMANA[d.diaSemana];
                      let bgClass = '';
                      let bgStyle = {};
                      if (d.ehFeriado) bgClass = 'bg-purple-100 text-purple-900 font-bold';
                      else if (d.diaSemana === 0) bgClass = 'bg-emerald-100 text-emerald-800';
                      else bgStyle = { backgroundColor: '#FFE4DC' }; // salmão claro para dias de semana
                      return (
                        <th key={d.data} className={`px-1 py-2 text-center font-bold border-b ${bgClass}`}
                            style={{ minWidth: 58, ...bgStyle }}
                            title={d.ehFeriado ? d.nomeFeriado : ''}>
                          <div className="text-sm">{Number(dd)}</div>
                          <div className="text-[11px] font-semibold">{d.ehFeriado ? 'FR' : dsInfo}</div>
                        </th>
                      );
                    })}
                    <th className="px-2 py-2 text-right font-semibold text-gray-700 border-b bg-amber-50" style={{ minWidth: 70 }}>Σ Mês</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700 border-b bg-sky-50" style={{ minWidth: 70 }} title="Dias trabalhados (exclui folgas, férias, feriados e licenças)">Dias Trab.</th>
                  </tr>
                </thead>
                <tbody>
                  {grid.colaboradores.map(c => (
                    <tr key={c.id} className="hover:bg-orange-50/30">
                      <td className="sticky left-0 z-10 bg-white border-b px-3 py-2">
                        <div className="flex items-center gap-2">
                          {c.fotoUrl ? (
                            <img src={c.fotoUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-xs">
                              {c.nome?.charAt(0) || '?'}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-800 text-sm leading-tight">{c.nome}</div>
                            <div className="text-xs text-gray-600 leading-tight mt-0.5">{c.cargoNome || '—'}</div>
                            <div className="flex gap-1.5 mt-1 flex-wrap items-center">
                              {c.jornadaNome && (
                                <span className="text-xs text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-semibold" title="Jornada contratada">
                                  {c.jornadaCarga || c.jornadaNome}
                                </span>
                              )}
                              {(c.tipoRotacao || c.escalaCadastro) && (
                                <span className="text-xs text-slate-700 bg-white border border-slate-300 px-2 py-0.5 rounded font-semibold" title={c.tipoRotacao ? 'Rotação do template da escala' : 'Escala cadastrada no colaborador'}>
                                  {c.tipoRotacao || c.escalaCadastro}
                                </span>
                              )}
                              {c.escalaDomingo && (
                                <span className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded font-semibold" title="Escala Especial de Domingo">
                                  Dom {c.escalaDomingo}
                                </span>
                              )}
                              {!c.temTemplate && (
                                <span className="text-xs text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded font-semibold inline-flex items-center gap-1" title="Clique no lápis pra definir o padrão semanal de turnos deste colaborador">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
                                  definir escala
                                </span>
                              )}
                            </div>
                          </div>
                          <button onClick={e => { e.stopPropagation(); navigate(`/rh/escala/template/${c.id}`); }}
                            title="Editar template semanal"
                            className="shrink-0 p-1.5 rounded hover:bg-orange-100 text-orange-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                      {c.celulas.map((cel, idx) => {
                        let bg = {};
                        if (cel.cor) bg = { backgroundColor: cel.cor };
                        else if (cel.ehFeriado) bg = { backgroundColor: '#F3E8FF' };
                        else if (cel.diaSemana === 0) bg = { backgroundColor: '#D1FAE5' };
                        const txt = cel.codigo || '';
                        const isDragSource = dragFill && dragFill.colabId === c.id && dragFill.sourceIdx === idx;
                        const isInDragRange = dragFill && dragFill.colabId === c.id
                          && idx >= Math.min(dragFill.sourceIdx, dragFill.targetIdx)
                          && idx <= Math.max(dragFill.sourceIdx, dragFill.targetIdx);
                        return (
                          <td key={cel.data}
                              onClick={() => {
                                if (dragFill) return;
                                setCelulaEdit({ colaboradorId: c.id, data: cel.data, codigoAtual: cel.codigo });
                              }}
                              onMouseEnter={() => {
                                if (dragFill && dragFill.colabId === c.id) {
                                  setDragFill(prev => prev ? { ...prev, targetIdx: idx } : prev);
                                }
                              }}
                              className={`relative border-b text-center text-xs font-bold cursor-pointer group ${isInDragRange && !isDragSource ? 'ring-2 ring-orange-500' : 'hover:ring-2 hover:ring-orange-400'}`}
                              style={{ ...bg, padding: '6px 3px' }}
                              title={cel.origem + (cel.observacao ? ` · ${cel.observacao}` : '') + (cel.ehFeriado ? ` · ${cel.nomeFeriado}` : '')}>
                            {txt}
                            {/* Alça de arrasto tipo Excel - aparece no hover */}
                            <span
                              onMouseDown={e => {
                                e.stopPropagation();
                                e.preventDefault();
                                setDragFill({
                                  colabId: c.id,
                                  sourceData: cel.data,
                                  sourceTurnoId: cel.turnoId || null,
                                  sourceIdx: idx,
                                  targetIdx: idx,
                                });
                              }}
                              onClick={e => e.stopPropagation()}
                              className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-orange-500 border border-white cursor-crosshair opacity-0 group-hover:opacity-100 hover:scale-150 transition pointer-events-none group-hover:pointer-events-auto"
                              title="Arraste pra preencher os próximos dias"
                            ></span>
                          </td>
                        );
                      })}
                      <td className="border-b px-2 py-2 text-right font-semibold text-emerald-700 bg-amber-50">{c.horasMes}h</td>
                      <td className="border-b px-2 py-2 text-center font-bold text-sky-700 bg-sky-50">
                        {c.celulas.filter(cel => cel.codigo && !['FG', 'FE', 'FR', 'LI', 'ATS'].includes(cel.codigo)).length}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Cola: Turnos + Feriados do mês */}
          {grid && grid.turnos.length > 0 && (
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tabela de abreviações */}
              <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                <div className="bg-gray-100 px-3 py-2 border-b">
                  <h4 className="font-bold text-sm text-gray-700">📖 Legenda de Turnos</h4>
                  <p className="text-xs text-gray-500">Abreviações usadas na escala</p>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="text-left px-3 py-1.5 w-24">Código</th>
                      <th className="text-left px-3 py-1.5">Significado</th>
                      <th className="text-left px-3 py-1.5 w-24">Horário</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {grid.turnos.map(t => (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5">
                          <span className="px-2 py-0.5 rounded font-bold text-xs" style={{ backgroundColor: t.cor || '#E5E7EB' }}>
                            {t.codigo}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-gray-700">{t.nome}</td>
                        <td className="px-3 py-1.5 text-xs text-gray-600 font-mono">
                          {t.horaInicio && t.horaFim ? `${t.horaInicio.slice(0,5)}–${t.horaFim.slice(0,5)}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Feriados do mês */}
              <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                <div className="bg-gray-100 px-3 py-2 border-b">
                  <h4 className="font-bold text-sm text-gray-700">🎉 Feriados em {mesNome}</h4>
                  <p className="text-xs text-gray-500">Destacados em roxo na escala</p>
                </div>
                {(() => {
                  const feriadosDoMes = grid.dias.filter(d => d.ehFeriado);
                  if (feriadosDoMes.length === 0) {
                    return (
                      <div className="px-3 py-6 text-center text-sm text-gray-400">
                        Nenhum feriado este mês
                      </div>
                    );
                  }
                  return (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                        <tr>
                          <th className="text-left px-3 py-1.5 w-24">Data</th>
                          <th className="text-left px-3 py-1.5">Feriado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {feriadosDoMes.map(d => {
                          const [, mm, dd] = d.data.split('-');
                          const dow = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d.diaSemana];
                          return (
                            <tr key={d.data} className="hover:bg-purple-50">
                              <td className="px-3 py-1.5">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-purple-100 text-purple-900 text-xs font-bold">
                                  {dd}/{mm}
                                </span>
                                <span className="ml-2 text-xs text-gray-500">{dow}</span>
                              </td>
                              <td className="px-3 py-1.5 text-gray-700 font-medium">{d.nomeFeriado}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal editar celula */}
      {celulaEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setCelulaEdit(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b">
              <h3 className="font-bold text-gray-800">Editar turno</h3>
              <p className="text-xs text-gray-500">{celulaEdit.data} — atual: {celulaEdit.codigoAtual || '(vazio)'}</p>
            </div>
            <div className="p-4 space-y-1 max-h-96 overflow-y-auto">
              <button onClick={() => salvarCelula(null)}
                className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm text-red-600 font-semibold">
                🗑️ Limpar (voltar pro template)
              </button>
              {turnos.map(t => (
                <button key={t.id} onClick={() => salvarCelula(t.id)}
                  className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm flex items-center gap-2">
                  <span className="inline-block w-4 h-4 rounded" style={{ backgroundColor: t.cor || '#E5E7EB' }}></span>
                  <span className="font-semibold">{t.codigo}</span>
                  <span className="text-gray-500 text-xs">{t.nome}</span>
                  {t.horaInicio && <span className="ml-auto text-gray-400 text-xs">{t.horaInicio.slice(0,5)}</span>}
                </button>
              ))}
            </div>
            <div className="p-4 border-t flex justify-end">
              <button onClick={() => setCelulaEdit(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
