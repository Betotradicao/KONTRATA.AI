import { useState, useEffect, useMemo, useRef } from 'react';
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
  const [orientacao, setOrientacao] = useState('horizontal'); // 'horizontal' | 'vertical'

  const [turnos, setTurnos] = useState([]);
  const [regraSetor, setRegraSetor] = useState(null);
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

      // Carrega regra do setor (pra alimentar a visão vertical com mínimos/picos)
      if (departamentoId) {
        try {
          const rsParams = new URLSearchParams();
          rsParams.set('empresa_id', companyId);
          rsParams.set('departamento_id', departamentoId);
          const rs = await api.get(`/rh/escala/regras-setor?${rsParams}`);
          const lista = Array.isArray(rs.data) ? rs.data : [];
          setRegraSetor(lista[0] || null);
        } catch { setRegraSetor(null); }
      } else {
        setRegraSetor(null);
      }
    } catch (e) {
      toast.error('Erro ao carregar escala');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (companyId) carregarGrid();
    // eslint-disable-next-line
  }, [companyId, departamentoId, mes]);

  // Valida se a escala REAL do mes bate com a regra declarada do colaborador.
  // Retorna { ok: boolean, detail: string } pra renderizar badge ✓ ou ⚠️.
  //
  // Regras testadas:
  //   6x1 → ~1 folga (FG) a cada 7 dias util (ex-domingo). Tolerancia ±1.
  //   5x2 → ~2 folgas a cada 7 (geralmente sab+dom).
  //   5x1 → ~1 folga a cada 6.
  //   6x2 → ~2 folgas a cada 8.
  //
  //   Domingo 2x1 → 1 folga a cada 3 domingos.
  //   Domingo 1x1 → 1 folga a cada 2 domingos (alternado).
  //   Domingo sempre/3x1/1x1: varia.
  const validarEscalaSemanal = (colab) => {
    const rot = (colab.tipoRotacao || colab.escalaCadastro || '').trim();
    if (!rot) return null;
    // Conta folgas (codigo 'FG') NAO-DOMINGO no mes
    const celulas = colab.celulas || [];
    const naoDomingos = celulas.filter(x => x.diaSemana !== 0);
    const folgasNaoDom = naoDomingos.filter(x => x.codigo === 'FG').length;
    const totalNaoDom = naoDomingos.length;
    // Razao folga/total e o que esperamos por rotacao
    const r = folgasNaoDom / Math.max(totalNaoDom, 1);
    // Esperado:
    //   6x1: 1/6 = 0.166  (mas excluindo dom, fica diferente — usamos sem dom)
    //   5x2: 1/5 = 0.2 (so sabado folga em dia util, em 5x2 puro)
    //   5x1: 1/5 = 0.2
    //   6x2: 1/4 = 0.25 (1 fora-dom)
    const esperados = {
      '6x1': 1/6,
      '5x2': 1/6, // sab folga, dom folga separado
      '5x1': 1/5,
      '6x2': 1/4,
    };
    const e = esperados[rot.toLowerCase()] || esperados[rot];
    if (e == null) return { ok: true, detail: `Padrão ${rot} não validado automaticamente` };
    const tol = 0.05; // 5% de tolerancia
    const ok = Math.abs(r - e) <= tol;
    return {
      ok,
      detail: ok
        ? `${folgasNaoDom} folgas em ${totalNaoDom} dias úteis (compatível com ${rot})`
        : `${folgasNaoDom}/${totalNaoDom} folgas — esperado ~${Math.round(e * totalNaoDom)} pra ${rot}`,
    };
  };

  const validarEscalaDomingo = (colab) => {
    const rot = (colab.escalaDomingo || '').trim();
    if (!rot) return null;
    const celulas = colab.celulas || [];
    const domingos = celulas.filter(x => x.diaSemana === 0);
    const folgasDom = domingos.filter(x => x.codigo === 'FG').length;
    const totalDom = domingos.length;
    let esperadoMin = null, esperadoMax = null, label = rot;
    if (/^2x1$/i.test(rot)) { esperadoMin = Math.floor(totalDom / 3); esperadoMax = Math.ceil(totalDom / 3); }
    else if (/^1x1$/i.test(rot)) { esperadoMin = Math.floor(totalDom / 2); esperadoMax = Math.ceil(totalDom / 2); }
    else if (/^3x1$/i.test(rot)) { esperadoMin = Math.floor(totalDom / 4); esperadoMax = Math.ceil(totalDom / 4); }
    else if (/sempre/i.test(rot) || /^5x2$/i.test(rot)) { esperadoMin = totalDom; esperadoMax = totalDom; }
    else if (/nunca|trabalha/i.test(rot)) { esperadoMin = 0; esperadoMax = 0; }
    if (esperadoMin == null) return { ok: true, detail: `${rot} não validado automaticamente` };
    const ok = folgasDom >= esperadoMin - 1 && folgasDom <= esperadoMax + 1;
    return {
      ok,
      detail: ok
        ? `${folgasDom}/${totalDom} domingos folgados (compatível com ${label})`
        : `${folgasDom}/${totalDom} folgas — esperado ${esperadoMin}-${esperadoMax} pra ${label}`,
    };
  };

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

  // Imprime escala horizontal em PDF (A4 paisagem). Header de datas se repete em todas as paginas.
  const imprimirPDF = () => {
    if (!grid || grid.colaboradores.length === 0) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const DIAS_SEM = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];

    // Header com Colaborador + Horário + Escala + Esc.Dom. + Dias do mês
    const thsDias = grid.dias.map(d => {
      const num = Number(d.data.split('-')[2]);
      const ds = d.ehFeriado ? 'FR' : DIAS_SEM[d.diaSemana];
      const cor = d.ehFeriado ? '#f3e8ff' : d.diaSemana === 0 ? '#d1fae5' : '#ffe4dc';
      return `<th style="background:${cor};border:1px solid #999;font-size:6.5pt;padding:1px;text-align:center;font-weight:bold;color:#333">
        <div>${num}</div><div style="font-size:5.5pt">${ds}</div>
      </th>`;
    }).join('');

    const tbodyRows = grid.colaboradores.map(c => {
      const nome = (c.nome || '').toUpperCase();
      const cargo = c.cargoNome || '';
      const jornada = c.jornadaCarga || c.jornadaNome || '';
      const escala = c.tipoRotacao || c.escalaCadastro || '';
      const escDom = c.escalaDomingo || '';
      const celulasTds = c.celulas.map(cel => {
        const txt = cel.codigo || '';
        const corFundo = cel.cor || (cel.ehFeriado ? '#f3e8ff' : cel.diaSemana === 0 ? '#d1fae5' : '#fff');
        return `<td style="background:${corFundo};border:1px solid #ccc;font-size:5.5pt;padding:1px 0;text-align:center;font-family:monospace;color:#333">${txt}</td>`;
      }).join('');
      return `<tr>
        <td style="border:1px solid #999;padding:2px 4px;font-size:7.5pt;font-weight:bold;background:#fff;width:130px;max-width:130px;overflow:hidden">
          <div style="font-weight:bold;font-size:7pt;line-height:1.1;word-wrap:break-word">${nome}</div>
          <div style="font-size:5.5pt;color:#666;font-weight:normal;line-height:1.1">${cargo}</div>
        </td>
        <td style="border:1px solid #999;padding:1px;font-size:5.5pt;text-align:center;width:28px">${jornada}</td>
        <td style="border:1px solid #999;padding:1px;font-size:5.5pt;text-align:center;width:28px">${escala}</td>
        <td style="border:1px solid #999;padding:1px;font-size:5.5pt;text-align:center;width:32px">${escDom}</td>
        ${celulasTds}
      </tr>`;
    }).join('');

    const titulo = `Escala de Trabalho — ${setorNome} — ${mesNome}`;
    const empresaNome = empresas.find(e => String(e.id) === String(companyId))?.apelido || '';

    w.document.write(`<!DOCTYPE html><html><head><title>${titulo}</title>
      <style>
        @page { size: A4 landscape; margin: 8mm }
        * {
          box-sizing: border-box;
          /* FORÇA impressão colorida — browser sem isso retira backgrounds pra economizar tinta */
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        body { font-family: Arial, sans-serif; margin: 0; color: #222 }
        h1 { font-size: 11pt; margin: 0 0 2px; text-align: center }
        .sub { text-align: center; font-size: 8pt; color: #666; margin-bottom: 5px }
        table { width: 100%; border-collapse: collapse; table-layout: fixed }
        /* IMPORTANTE: thead repete em toda pagina */
        thead { display: table-header-group }
        tfoot { display: table-footer-group }
        tr { page-break-inside: avoid }
        th, td { vertical-align: middle }
        /* Compactar colunas fixas (nome maior, meta colunas menores) */
        td:first-child { width: 130px }
      </style></head><body>
      <h1>${titulo}</h1>
      <div class="sub">${empresaNome} · ${grid.colaboradores.length} colaboradores · ${grid.dias.length} dias</div>
      <table>
        <thead>
          <tr>
            <th style="background:#f3f4f6;border:1px solid #999;padding:2px;font-size:6.5pt;text-align:left;width:130px">Colaborador</th>
            <th style="background:#f3f4f6;border:1px solid #999;padding:1px;font-size:5.5pt;text-align:center;width:28px">Hor.</th>
            <th style="background:#f3f4f6;border:1px solid #999;padding:1px;font-size:5.5pt;text-align:center;width:28px">Esc.</th>
            <th style="background:#f3f4f6;border:1px solid #999;padding:1px;font-size:5.5pt;text-align:center;width:32px">Dom.</th>
            ${thsDias}
          </tr>
        </thead>
        <tbody>
          ${tbodyRows}
        </tbody>
      </table>
      ${(() => {
        // === LEGENDA DE TURNOS USADOS ===
        // Coleta TODOS os codigos que aparecem no mes
        const codigosUsados = new Set();
        grid.colaboradores.forEach(c => c.celulas.forEach(cel => {
          if (cel.codigo) codigosUsados.add(cel.codigo);
        }));
        // Filtra turnos de trabalho (nao FG/FE/FRDO/ATS) e ordena por hora_inicio
        const ESPECIAIS = new Set(['FG', 'FE', 'FRDO', 'ATS']);
        const turnosUsados = (turnos || [])
          .filter(t => codigosUsados.has(t.codigo) && !ESPECIAIS.has(t.codigo))
          .sort((a, b) => (a.horaInicio || '').localeCompare(b.horaInicio || ''));

        const legendaItens = turnosUsados.map(t => {
          const ini = t.horaInicio ? t.horaInicio.slice(0,5) : '--:--';
          const fim = t.horaFim ? t.horaFim.slice(0,5) : '--:--';
          const pausa = t.pausaInicio && t.pausaFim
            ? `${t.pausaInicio.slice(0,5)}-${t.pausaFim.slice(0,5)}`
            : '';
          return `<div style="display:flex;align-items:center;gap:5px;border:1px solid #999;border-radius:3px;padding:2px 6px;background:${t.cor || '#fff'};font-size:6.5pt;margin-bottom:2px;width:fit-content">
            <strong style="min-width:50px">${t.codigo}</strong>
            <span style="color:#444">${ini}–${fim}</span>
            ${pausa ? `<span style="color:#888">·almoço ${pausa}</span>` : ''}
          </div>`;
        }).join('');

        // Especiais (so as que aparecem no mes)
        const especiaisInfo = [
          { cod: 'FG',   label: 'Folga',           cor: '#86efac' },
          { cod: 'FE',   label: 'Férias',           cor: '#c4b5fd' },
          { cod: 'ATS',  label: 'Atestado/Licença', cor: '#fcd34d' },
          { cod: 'FRDO', label: 'Feriado',          cor: '#f3e8ff' },
        ].filter(e => codigosUsados.has(e.cod));
        const legendaEspeciais = especiaisInfo.map(e => `
          <div style="display:flex;align-items:center;gap:5px;border:1px solid #999;border-radius:3px;padding:2px 6px;background:${e.cor};font-size:6.5pt;margin-bottom:2px;width:fit-content">
            <strong style="min-width:50px">${e.cod}</strong> <span>${e.label}</span>
          </div>`).join('');

        // Feriados do mes
        const feriados = (grid.dias || []).filter(d => d.ehFeriado);
        const legendaFeriados = feriados.length === 0 ? '' : `
          <div style="margin-bottom:4px;font-size:6.5pt;color:#444">
            <strong>🎉 Feriados do mês:</strong>
            ${feriados.map(f => {
              const num = Number(f.data.split('-')[2]);
              return `<div style="margin-top:2px"><span style="background:#f3e8ff;border:1px solid #c084fc;border-radius:3px;padding:0 4px;font-weight:bold">${num}</span> ${f.nomeFeriado || ''}</div>`;
            }).join('')}
          </div>`;

        return `
          <div style="margin-top:6px;padding:4px 6px;border-top:1px solid #ccc">
            <div style="font-size:6.5pt;font-weight:bold;color:#555;margin-bottom:3px">📋 LEGENDA</div>
            ${legendaFeriados}
            ${legendaItens}
            ${legendaEspeciais}
          </div>`;
      })()}
      <script>window.onload=()=>{setTimeout(()=>window.print(),200)}</script>
    </body></html>`);
    w.document.close();
  };

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
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button onClick={() => setOrientacao('horizontal')}
              className={`px-3 py-1.5 rounded text-xs font-bold transition flex items-center gap-1 ${orientacao === 'horizontal' ? 'bg-orange-500 text-white shadow' : 'text-gray-600 hover:bg-gray-200'}`}
              title="Cada colaborador em uma linha, dias do mês nas colunas">
              ⇆ Horizontal
            </button>
            <button onClick={() => setOrientacao('vertical')}
              className={`px-3 py-1.5 rounded text-xs font-bold transition flex items-center gap-1 ${orientacao === 'vertical' ? 'bg-orange-500 text-white shadow' : 'text-gray-600 hover:bg-gray-200'}`}
              title="Cada colaborador em uma coluna, dias do mês nas linhas">
              ⇅ Vertical
            </button>
          </div>
          <button onClick={imprimirPDF}
            disabled={!grid || grid.colaboradores.length === 0}
            title="Imprimir escala horizontal em 1 folha A4 paisagem"
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
            🖨️ Imprimir PDF
          </button>
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
          ) : orientacao === 'vertical' ? (
            <VistaVertical grid={grid} turnos={turnos} regraSetor={regraSetor} />
          ) : (
            <div className="bg-white rounded-lg shadow border overflow-auto" style={{ maxHeight: '75vh' }}>
              <table className="text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="sticky left-0 z-20 bg-gray-50 px-3 py-2 text-left font-semibold text-gray-700 border-b"
                        style={{ minWidth: 180 }}>Colaborador</th>
                    <th className="sticky z-20 bg-gray-50 px-2 py-2 text-left font-semibold text-gray-700 border-b" style={{ left: 180, minWidth: 140 }}>Função</th>
                    <th className="sticky z-20 bg-gray-50 px-2 py-2 text-center font-semibold text-gray-700 border-b" style={{ left: 320, minWidth: 64 }}>Horário</th>
                    <th className="sticky z-20 bg-gray-50 px-2 py-2 text-center font-semibold text-gray-700 border-b" style={{ left: 384, minWidth: 56 }}>Escala</th>
                    <th className="sticky z-20 bg-gray-50 px-2 py-2 text-center font-semibold text-gray-700 border-b" style={{ left: 440, minWidth: 64 }}>Esc. Dom.</th>
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
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-800 text-sm leading-tight">{c.nome}</div>
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
                      <td className="sticky z-10 bg-white border-b px-2 py-2 text-left" style={{ left: 180 }}>
                        <span className="text-xs text-gray-700">{c.cargoNome || <span className="text-gray-300">—</span>}</span>
                      </td>
                      <td className="sticky z-10 bg-white border-b px-2 py-2 text-center" style={{ left: 320 }}>
                        {c.jornadaNome
                          ? <span className="inline-block text-xs text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-semibold" title="Jornada contratada">{c.jornadaCarga || c.jornadaNome}</span>
                          : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      {(() => {
                        const vSem = validarEscalaSemanal(c);
                        const vDom = validarEscalaDomingo(c);
                        const escalaTxt = c.tipoRotacao || c.escalaCadastro;
                        const okBg  = '#d1fae5'; // emerald-100
                        const okTxt = '#047857'; // emerald-700
                        const errBg = '#fee2e2'; // red-100
                        const errTxt= '#b91c1c'; // red-700
                        return (
                          <>
                            <td className="sticky z-10 border border-gray-300 p-0 text-center" style={{ left: 384, backgroundColor: '#fff' }}>
                              <div style={{ borderBottom: '1px solid #cbd5e1', padding: '5px 6px', fontWeight: 700, color: '#334155', fontSize: '12px', background: '#f1f5f9' }}>
                                {escalaTxt || <span style={{ color: '#cbd5e1' }}>—</span>}
                              </div>
                              <div title={vSem?.detail || ''} style={{ padding: '5px 6px', fontWeight: 700, fontSize: '11px', background: !vSem ? '#fff' : vSem.ok ? okBg : errBg, color: !vSem ? '#cbd5e1' : vSem.ok ? okTxt : errTxt }}>
                                {!vSem ? '—' : vSem.ok ? '✓ OK' : '⚠ FORA'}
                              </div>
                            </td>
                            <td className="sticky z-10 border border-gray-300 p-0 text-center" style={{ left: 440, backgroundColor: '#fff' }}>
                              <div style={{ borderBottom: '1px solid #cbd5e1', padding: '5px 6px', fontWeight: 700, color: '#3730a3', fontSize: '12px', background: '#eef2ff' }}>
                                {c.escalaDomingo ? `Dom ${c.escalaDomingo}` : <span style={{ color: '#cbd5e1' }}>—</span>}
                              </div>
                              <div title={vDom?.detail || ''} style={{ padding: '5px 6px', fontWeight: 700, fontSize: '11px', background: !vDom ? '#fff' : vDom.ok ? okBg : errBg, color: !vDom ? '#cbd5e1' : vDom.ok ? okTxt : errTxt }}>
                                {!vDom ? '—' : vDom.ok ? '✓ OK' : '⚠ FORA'}
                              </div>
                            </td>
                          </>
                        );
                      })()}
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
                  {/* Linhas de RESUMO POR DIA (trabalhando / folgando / total / férias / atestado) */}
                  {(() => {
                    const N = grid.dias.length;
                    // Cria arrays de contagem por dia
                    const trab = new Array(N).fill(0);
                    const folga = new Array(N).fill(0);
                    const ferias = new Array(N).fill(0);
                    const ats = new Array(N).fill(0);
                    grid.colaboradores.forEach(c => {
                      c.celulas.forEach((cel, idx) => {
                        const cod = cel.codigo;
                        if (!cod) return;
                        if (cod === 'FG') folga[idx]++;
                        else if (cod === 'FE') ferias[idx]++;
                        else if (cod === 'ATS') ats[idx]++;
                        else if (cod === 'FRDO') folga[idx]++; // feriado conta como nao-trabalhando
                        else trab[idx]++;
                      });
                    });
                    const total = trab.map((v, i) => v + folga[i] + ferias[i] + ats[i]);

                    const renderLinha = (label, arr, bg, cor) => {
                      const bgColor = bg.includes('emerald-200') ? '#a7f3d0'
                                    : bg.includes('emerald') ? '#d1fae5'
                                    : bg.includes('rose') ? '#ffe4e6'
                                    : bg.includes('amber') ? '#fef3c7'
                                    : bg.includes('purple') ? '#ede9fe'
                                    : bg.includes('gray-300') ? '#d1d5db'
                                    : '#f3f4f6';
                      return (
                        <tr className={bg}>
                          <td className="sticky left-0 z-10 px-3 py-1.5 text-[10px] font-bold uppercase border border-gray-300" style={{ backgroundColor: bgColor }}>{label}</td>
                          <td className="sticky z-10 border border-gray-300" style={{ left: 180, backgroundColor: bgColor }}></td>
                          <td className="sticky z-10 border border-gray-300" style={{ left: 320, backgroundColor: bgColor }}></td>
                          <td className="sticky z-10 border border-gray-300" style={{ left: 384, backgroundColor: bgColor }}></td>
                          <td className="sticky z-10 border border-gray-300" style={{ left: 440, backgroundColor: bgColor }}></td>
                          {arr.map((v, i) => (
                            <td key={i} className={`text-center text-xs font-bold py-1 border border-gray-300 ${cor}`}>
                              {v || ''}
                            </td>
                          ))}
                          <td className="px-2 py-1.5 text-right text-[10px] font-bold border border-gray-300">{arr.reduce((s, x) => s + x, 0)}</td>
                          <td className="px-2 py-1.5 text-right text-[10px] font-bold border border-gray-300">—</td>
                        </tr>
                      );
                    };

                    return (
                      <>
                        {renderLinha('TRABALHANDO', trab, 'bg-emerald-50', 'text-emerald-800')}
                        {renderLinha('FOLGANDO',    folga, 'bg-rose-50', 'text-rose-800')}
                        {renderLinha('FÉRIAS',      ferias, 'bg-purple-50', 'text-purple-800')}
                        {renderLinha('ATESTADO',    ats, 'bg-amber-50', 'text-amber-800')}
                        {renderLinha('TOTAL TRABALHANDO', trab, 'bg-emerald-200', 'text-emerald-900 font-extrabold')}
                        {renderLinha('TOTAL GERAL', total, 'bg-gray-300', 'text-gray-900 font-extrabold')}
                      </>
                    );
                  })()}
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
                  <thead className="bg-gray-50 text-[10px] uppercase text-gray-500">
                    <tr>
                      <th className="text-left px-2 py-1.5 w-20">Código</th>
                      <th className="text-left px-2 py-1.5">Significado</th>
                      <th className="text-center px-1 py-1.5 w-14">Entrada</th>
                      <th className="text-center px-1 py-1.5 w-14">P. Ini.</th>
                      <th className="text-center px-1 py-1.5 w-14">P. Fim</th>
                      <th className="text-center px-1 py-1.5 w-14">Saída</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {grid.turnos.map(t => (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-2 py-1.5">
                          <span className="px-2 py-0.5 rounded font-bold text-xs" style={{ backgroundColor: t.cor || '#E5E7EB' }}>
                            {t.codigo}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-gray-700">{t.nome}</td>
                        <td className="px-1 py-1.5 text-center text-xs text-gray-700 font-mono">
                          {t.horaInicio ? t.horaInicio.slice(0,5) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-1 py-1.5 text-center text-xs text-gray-700 font-mono">
                          {t.pausaInicio ? t.pausaInicio.slice(0,5) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-1 py-1.5 text-center text-xs text-gray-700 font-mono">
                          {t.pausaFim ? t.pausaFim.slice(0,5) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-1 py-1.5 text-center text-xs text-gray-700 font-mono">
                          {t.horaFim ? t.horaFim.slice(0,5) : <span className="text-gray-300">—</span>}
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
      {/* Agente IA flutuante */}
      <AgenteIAChat grid={grid} regraSetor={regraSetor} setorNome={setorNome} mesNome={mesNome} onAcaoExecutada={carregarGrid} />

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

// ============================================================
// VISTA VERTICAL — hora-a-hora pra um dia específico do mês
// Eixo X: colaboradores  ·  Eixo Y: slots de 15min (07:00 → 23:45)
// Marca ✓ na célula quando o colab está dentro do turno (entre entrada e saída,
// com gap durante a pausa de almoço).
// ============================================================
function VistaVertical({ grid, turnos, regraSetor }) {
  const turnoById = useMemo(() => {
    const m = {};
    (turnos || []).forEach(t => { m[t.id] = t; });
    return m;
  }, [turnos]);

  // Dia selecionado: data ou 'TODOS' pra ver o mes inteiro lado a lado
  const [diaSel, setDiaSel] = useState(() => grid?.dias?.[0]?.data || '');
  // Filtro de semana (so faz sentido no modo TODOS): '' = todas, '1'..'6' = semana especifica
  const [semanaSel, setSemanaSel] = useState('');

  // Agrupa dias em semanas (semana começa na Segunda, termina no Domingo)
  const semanas = useMemo(() => {
    if (!grid?.dias) return [];
    const out = [];
    let atual = [];
    grid.dias.forEach(d => {
      // Quando bate segunda-feira, fecha semana anterior (se tem) e abre nova
      if (d.diaSemana === 1 && atual.length > 0) {
        out.push(atual);
        atual = [];
      }
      atual.push(d);
    });
    if (atual.length > 0) out.push(atual);
    return out;
  }, [grid]);

  // Dias filtrados pela semana escolhida (ou todos se semanaSel='')
  const diasParaTodos = useMemo(() => {
    if (!grid?.dias) return [];
    if (!semanaSel) return grid.dias;
    const idx = parseInt(semanaSel) - 1;
    return semanas[idx] || [];
  }, [grid, semanaSel, semanas]);

  // Helpers de regra do setor
  const DOW_KEYS = ['dom','seg','ter','qua','qui','sex','sab'];

  // Slots de 15 em 15 min, do funcionamento típico do supermercado
  const slots = useMemo(() => {
    const out = [];
    for (let h = 6; h < 24; h++) {
      for (let m = 0; m < 60; m += 15) {
        out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    return out;
  }, []);

  const slotMin = (s) => {
    const [h, m] = s.split(':').map(Number);
    return h * 60 + m;
  };

  // Gera PDF da visao vertical (1 dia ou semana/todos)
  const imprimirVertical = (modo, semanaIdx) => {
    if (!grid) return;
    // Define os dias que vao no PDF
    let dias;
    if (modo === 'TODOS') {
      if (semanaIdx) {
        const idx = parseInt(semanaIdx) - 1;
        dias = semanas[idx] || grid.dias;
      } else {
        dias = grid.dias;
      }
    } else {
      dias = grid.dias.filter(d => d.data === modo);
    }
    if (!dias.length) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const NOMES = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];

    const renderBloco = (dataStr) => {
      const diaInfo = grid.dias.find(d => d.data === dataStr);
      const colabs = calcColabsDoDia(dataStr);
      const num = Number(dataStr.split('-')[2]);
      const ds = NOMES[diaInfo.diaSemana];
      const trab = colabs.filter(c => !c.ehFolga);
      const headerBg = diaInfo.ehFeriado ? '#f3e8ff' : diaInfo.diaSemana === 0 ? '#d1fae5' : '#fef3c7';

      const thsColabs = colabs.map(c => {
        const folgaBg = c.ehFolga ? '#f3f4f6' : '#fff';
        return `<th style="border:1px solid #999;background:${folgaBg};padding:1px;font-size:5.5pt;text-align:center;min-width:30px;max-width:30px">
          <div style="font-weight:bold;${c.ehFolga ? 'color:#9ca3af' : ''}">${(c.nome || '').split(' ')[0].slice(0,8)}</div>
          <div style="font-family:monospace;font-size:5pt;color:#888">${c.turno?.codigo || '—'}</div>
        </th>`;
      }).join('');

      const tbodyRows = slots.map(s => {
        const cob = colabs.filter(c => trabalhandoNoSlot(c.turno, s)).length;
        const isHora = s.endsWith(':00');
        const ehPico = slotEhPicoDia(s, dataStr);
        const min = minimoSlotDia(s, dataStr);
        const minOk = min == null ? null : cob >= min;
        const horaCellBg = isHora ? '#f3f4f6' : '#fff';
        const horaCellWeight = isHora ? 'bold' : 'normal';
        const sigmaBg = min == null ? '#fff' : minOk ? '#d1fae5' : '#fee2e2';
        const sigmaColor = min == null ? (cob === 0 ? '#d1d5db' : '#7c3aed') : minOk ? '#047857' : '#b91c1c';

        const tdsColabs = colabs.map(c => {
          if (c.ehFolga) {
            const label = c.codigoFolga === 'FG' ? 'FOLGA' : c.codigoFolga === 'FE' ? 'FÉRIAS' : c.codigoFolga === 'ATS' ? 'ATEST.' : c.codigoFolga === 'FRDO' ? 'FER.' : c.codigoFolga;
            return `<td style="border:1px solid #ddd;background:#f3f4f6;text-align:center;font-size:4.5pt;color:#9ca3af;font-weight:bold;height:11px;padding:0">${isHora && s === '12:00' ? label : ''}</td>`;
          }
          const ativo = trabalhandoNoSlot(c.turno, s);
          const bg = ativo ? (c.turno?.cor || '#86efac') : '#fff';
          return `<td style="border:1px solid #ddd;background:${bg};text-align:center;font-size:6pt;color:#064e3b;font-weight:bold;height:11px;padding:0">${ativo ? '✓' : ''}</td>`;
        }).join('');

        return `<tr>
          <td style="border:1px solid #ccc;background:${horaCellBg};padding:0 3px;font-family:monospace;font-size:6pt;font-weight:${horaCellWeight};text-align:right">${s}</td>
          <td style="border:1px solid #ccc;background:${ehPico ? '#ffedd5' : '#fff'};text-align:center;font-size:6pt;color:${ehPico ? '#9a3412' : '#e5e7eb'};font-weight:bold">${ehPico ? '🔥' : ''}</td>
          <td style="border:1px solid #ccc;background:#eef2ff;text-align:center;font-size:6pt;color:#3730a3;font-weight:bold">${min ?? ''}</td>
          <td style="border:1px solid #ccc;background:${sigmaBg};text-align:center;font-size:6pt;color:${sigmaColor};font-weight:bold">${cob || ''}</td>
          ${tdsColabs}
        </tr>`;
      }).join('');

      return `<table style="border-collapse:collapse;font-family:Arial;font-size:6pt">
        <thead>
          <tr><th colspan="${4 + colabs.length}" style="background:${headerBg};border:1px solid #999;padding:3px;font-size:8pt;font-weight:bold;text-align:center">Dia ${num} — ${ds}${diaInfo.ehFeriado ? ' 🎉' : ''} (${trab.length}/${colabs.length})</th></tr>
          <tr>
            <th style="border:1px solid #999;background:#f3f4f6;padding:1px;font-size:5.5pt;min-width:32px">Hora</th>
            <th style="border:1px solid #999;background:#ffedd5;padding:1px;font-size:5.5pt;min-width:18px">🔥</th>
            <th style="border:1px solid #999;background:#eef2ff;padding:1px;font-size:5.5pt;min-width:22px">Min</th>
            <th style="border:1px solid #999;background:#ede9fe;padding:1px;font-size:5.5pt;min-width:22px">Σ</th>
            ${thsColabs}
          </tr>
        </thead>
        <tbody>${tbodyRows}</tbody>
      </table>`;
    };

    const tituloModo = modo === 'TODOS'
      ? (semanaIdx ? `${semanaIdx}ª Semana` : 'Mês inteiro')
      : (() => {
          const di = grid.dias.find(d => d.data === modo);
          return `Dia ${Number(modo.split('-')[2])} — ${NOMES[di?.diaSemana || 0]}`;
        })();

    w.document.write(`<!DOCTYPE html><html><head><title>Cobertura Vertical — ${tituloModo}</title>
      <style>
        @page { size: A4 landscape; margin: 6mm }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { font-family: Arial, sans-serif; margin: 0; color: #222 }
        h1 { font-size: 11pt; margin: 0 0 2px; text-align: center }
        .sub { text-align: center; font-size: 8pt; color: #666; margin-bottom: 4px }
        .blocos { display: flex; gap: 4px; align-items: flex-start; flex-wrap: nowrap }
      </style></head><body>
      <h1>Cobertura Vertical — ${tituloModo}</h1>
      <div class="sub">${dias.length} dia${dias.length !== 1 ? 's' : ''} · slots de 15min</div>
      <div class="blocos">
        ${dias.map(d => renderBloco(d.data)).join('')}
      </div>
      <script>window.onload=()=>{setTimeout(()=>window.print(),200)}</script>
    </body></html>`);
    w.document.close();
  };

  // Calcula colabs do dia (com info de turno/folga) — usado por cada bloco
  const calcColabsDoDia = (dataStr) => {
    return (grid?.colaboradores || []).map(c => {
      const cel = c.celulas.find(x => x.data === dataStr);
      const turno = cel?.turnoId ? turnoById[cel.turnoId] : null;
      const ehFolga = !turno || turno.tipo !== 'turno';
      const codigoFolga = turno?.codigo || '—';
      return { ...c, celula: cel, turno, ehFolga, codigoFolga };
    });
  };

  // Detecta se um slot está num horário de pico do dia (regra do setor)
  const slotEhPicoDia = (slot, dataStr) => {
    if (!regraSetor || !grid) return false;
    const diaInfo = grid.dias.find(d => d.data === dataStr);
    if (!diaInfo) return false;
    const dowKey = DOW_KEYS[diaInfo.diaSemana];
    const faixas = regraSetor.picos_por_dia?.[dowKey] || [];
    const sm = slotMin(slot);
    return faixas.some(f => {
      if (!f.ini || !f.fim) return false;
      return sm >= slotMin(f.ini) && sm < slotMin(f.fim);
    });
  };

  // Mínimo de gente exigido pela regra do setor pra esse slot
  const minimoSlotDia = (slot, dataStr) => {
    if (!regraSetor || !grid) return null;
    const diaInfo = grid.dias.find(d => d.data === dataStr);
    if (!diaInfo) return null;
    const dowKey = DOW_KEYS[diaInfo.diaSemana];
    const cob = regraSetor.cobertura_minima?.[dowKey];
    if (!cob) return null;
    if (slotEhPicoDia(slot, dataStr)) return cob.pico || cob.tarde || cob.manha || null;
    return slotMin(slot) < 13 * 60 ? (cob.manha || null) : (cob.tarde || null);
  };

  // Compatibilidade com o codigo abaixo
  const colabsDoDia = useMemo(() => diaSel === 'TODOS' ? [] : calcColabsDoDia(diaSel), [grid, diaSel, turnoById]);
  const slotEhPico = (slot) => slotEhPicoDia(slot, diaSel);
  const minimoSlot = (slot) => minimoSlotDia(slot, diaSel);

  const trabalhandoNoSlot = (turno, slot) => {
    if (!turno || !turno.horaInicio || !turno.horaFim) return false;
    const ini = turno.horaInicio.slice(0, 5);
    const fim = turno.horaFim.slice(0, 5);
    const slotM = slotMin(slot);
    const iniM = slotMin(ini);
    let fimM = slotMin(fim);
    if (fimM <= iniM) fimM += 24 * 60; // turno atravessa meia-noite
    if (slotM < iniM || slotM >= fimM) return false;
    // Verifica pausa
    if (turno.pausaInicio && turno.pausaFim) {
      const pIni = slotMin(turno.pausaInicio.slice(0, 5));
      const pFim = slotMin(turno.pausaFim.slice(0, 5));
      if (slotM >= pIni && slotM < pFim) return false;
    }
    return true;
  };

  // Conta cobertura por slot (quantos colabs trabalhando)
  const coberturaPorSlot = useMemo(() => {
    const m = {};
    slots.forEach(s => {
      m[s] = colabsDoDia.filter(c => trabalhandoNoSlot(c.turno, s)).length;
    });
    return m;
  }, [slots, colabsDoDia]);

  const diaInfo = grid?.dias?.find(d => d.data === diaSel);
  const NOMES_DIA = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'];
  const labelDia = diaInfo
    ? `Dia ${Number(diaSel.split('-')[2])} — ${NOMES_DIA[diaInfo.diaSemana]}${diaInfo.ehFeriado ? ' (FERIADO)' : ''}`
    : '';

  // Mostra TODOS os colaboradores como coluna — folguistas com fundo cinza e label do tipo
  const todosColabs = colabsDoDia;

  return (
    <div className="bg-white rounded-lg shadow border overflow-hidden">
      {/* Seletor de dia */}
      <div className="bg-purple-50 border-b border-purple-200 px-4 py-3 flex items-center gap-3 flex-wrap">
        <span className="font-bold text-purple-900">📅 Selecione o dia:</span>
        <select value={diaSel} onChange={e => setDiaSel(e.target.value)}
          className="border border-purple-300 rounded px-3 py-1.5 text-sm font-semibold bg-white">
          <option value="TODOS">🗓️ TODOS os dias (lado a lado)</option>
          {(grid?.dias || []).map(d => {
            const num = Number(d.data.split('-')[2]);
            const ds = NOMES_DIA[d.diaSemana].slice(0, 3);
            return <option key={d.data} value={d.data}>{`Dia ${num} — ${ds}${d.ehFeriado ? ' 🎉' : ''}`}</option>;
          })}
        </select>
        {diaSel !== 'TODOS' && (
          <>
            <span className="ml-auto text-sm font-bold text-purple-700">{labelDia}</span>
            <span className="bg-purple-600 text-white px-2 py-0.5 rounded text-xs font-bold">
              {todosColabs.filter(c => !c.ehFolga).length} trabalhando · {todosColabs.filter(c => c.ehFolga).length} folga
            </span>
          </>
        )}
        {diaSel === 'TODOS' && (
          <>
            <span className="text-xs font-semibold text-purple-900">Filtrar por semana:</span>
            <select value={semanaSel} onChange={e => setSemanaSel(e.target.value)}
              className="border border-purple-300 rounded px-3 py-1.5 text-sm bg-white">
              <option value="">Todas as semanas</option>
              {semanas.map((sem, i) => {
                const ini = sem[0]; const fim = sem[sem.length - 1];
                const iniNum = Number(ini.data.split('-')[2]);
                const fimNum = Number(fim.data.split('-')[2]);
                return (
                  <option key={i} value={String(i + 1)}>
                    {`${i + 1}ª semana (${iniNum}–${fimNum})`}
                  </option>
                );
              })}
            </select>
            <span className="ml-auto bg-purple-600 text-white px-2 py-0.5 rounded text-xs font-bold">
              {diasParaTodos.length} dia{diasParaTodos.length !== 1 ? 's' : ''} · arraste horizontal
            </span>
          </>
        )}
        <button onClick={() => imprimirVertical(diaSel, semanaSel)}
          title="Imprimir esta visão em PDF"
          className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded text-xs font-bold shadow">
          🖨️ PDF
        </button>
      </div>

      {(() => {
        // Função que renderiza UMA tabela por dia. Usada tanto pra TODOS quanto pra dia único.
        const renderTabelaDia = (dataStr, showHeader = true) => {
          const diaInfo = grid.dias.find(d => d.data === dataStr);
          if (!diaInfo) return null;
          const colabs = calcColabsDoDia(dataStr);
          const num = Number(dataStr.split('-')[2]);
          const ds = NOMES_DIA[diaInfo.diaSemana].slice(0, 3);
          const trab = colabs.filter(c => !c.ehFolga);
          return (
            <div key={dataStr} className="inline-block align-top" style={{ minWidth: 'fit-content' }}>
              {showHeader && (
                <div className={`px-2 py-1.5 text-center font-bold text-xs border-b-2 ${diaInfo.ehFeriado ? 'bg-purple-100 text-purple-800 border-purple-400' : diaInfo.diaSemana === 0 ? 'bg-emerald-100 text-emerald-800 border-emerald-400' : 'bg-amber-50 text-amber-800 border-amber-400'}`}>
                  Dia {num} — {ds}{diaInfo.ehFeriado ? ' 🎉' : ''}
                  <span className="ml-2 text-[10px] font-normal">({trab.length}/{colabs.length})</span>
                </div>
              )}
              <table className="text-xs">
                <thead className="bg-white">
                  <tr className="bg-gray-100">
                    <th className="px-1 py-1 text-center font-bold text-orange-700 border-b border-gray-300 bg-orange-50" style={{ minWidth: 28 }}>🔥</th>
                    <th className="px-1 py-1 text-center font-bold text-indigo-700 border-b border-gray-300 bg-indigo-50" style={{ minWidth: 32 }}>Min</th>
                    <th className="px-1 py-1 text-center font-bold text-purple-700 border-b border-gray-300 bg-purple-50" style={{ minWidth: 32 }}>Σ</th>
                    {colabs.map(c => (
                      <th key={c.id} className={`px-1 py-1 text-center text-[9px] font-semibold border-b border-gray-200 ${c.ehFolga ? 'text-gray-400 bg-gray-50' : 'text-gray-700'}`} style={{ minWidth: 56, maxWidth: 56 }}>
                        <div className="truncate" title={c.nome}>{(c.nome || '').split(' ')[0]}</div>
                        <div className="text-gray-400 font-mono text-[8px]">{c.turno?.codigo || '—'}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {slots.map(s => {
                    const cob = colabs.filter(c => trabalhandoNoSlot(c.turno, s)).length;
                    const isHora = s.endsWith(':00');
                    const ehPico = slotEhPicoDia(s, dataStr);
                    const min = minimoSlotDia(s, dataStr);
                    const minOk = min == null ? null : cob >= min;
                    return (
                      <tr key={s} className={isHora ? 'border-t border-gray-200' : ''}>
                        <td className={`text-center px-1 ${ehPico ? 'bg-orange-100 text-orange-700 font-bold' : 'text-gray-200'}`}>{ehPico ? '🔥' : ''}</td>
                        <td className={`text-center font-bold px-1 ${min == null ? 'text-gray-300' : 'text-indigo-700'}`}>{min ?? ''}</td>
                        <td className={`text-center font-bold px-1 ${min == null ? (cob === 0 ? 'text-gray-300' : 'text-purple-700') : (minOk ? 'text-emerald-700 bg-emerald-100' : 'text-red-700 bg-red-100')}`}>{cob || ''}</td>
                        {colabs.map(c => {
                          if (c.ehFolga) {
                            const label = c.codigoFolga === 'FG' ? 'FOLGA' : c.codigoFolga === 'FE' ? 'FÉRIAS' : c.codigoFolga === 'ATS' ? 'ATESTADO' : c.codigoFolga === 'FRDO' ? 'FERIADO' : c.codigoFolga;
                            return (
                              <td key={c.id} className="text-center border-l border-gray-100 bg-gray-100 text-gray-400" style={{ height: 16 }}>
                                {isHora && s === '12:00' ? <span className="font-bold text-[9px] text-gray-600">{label}</span> : ''}
                              </td>
                            );
                          }
                          const ativo = trabalhandoNoSlot(c.turno, s);
                          const bg = ativo ? (c.turno?.cor || '#86efac') : 'transparent';
                          return (
                            <td key={c.id} className="text-center border-l border-gray-100" style={{ backgroundColor: bg, height: 16 }}>
                              {ativo && <span className="text-emerald-900 font-bold">✓</span>}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        };

        if (diaSel === 'TODOS') {
          // Renderiza todos os dias lado a lado com coluna Hora sticky compartilhada
          return (
            <div className="flex overflow-auto" style={{ maxHeight: '75vh' }}>
              {/* Coluna Hora sticky compartilhada */}
              <div className="sticky left-0 z-20 bg-white border-r border-gray-300 shrink-0">
                <div className="px-2 py-1.5 text-center font-bold text-xs bg-gray-100 border-b-2 border-gray-400">Hora</div>
                <div className="bg-gray-100 px-1 py-1 text-[10px] font-bold text-center border-b border-gray-300" style={{ height: 26 }}></div>
                {slots.map(s => {
                  const isHora = s.endsWith(':00');
                  return (
                    <div key={s} className={`px-2 py-1 text-right font-mono text-xs ${isHora ? 'font-bold text-gray-800 bg-gray-50 border-t border-gray-200' : 'text-gray-400 bg-white'}`} style={{ height: 16, minHeight: 16 }}>
                      {s}
                    </div>
                  );
                })}
              </div>
              {/* Blocos por dia, lado a lado com 6px gap */}
              <div className="flex" style={{ gap: 6 }}>
                {diasParaTodos.map(d => renderTabelaDia(d.data, true))}
              </div>
            </div>
          );
        }

        // Modo dia único — render direto com Hora integrada
        return (
          <div className="overflow-auto" style={{ maxHeight: '75vh' }}>
            <table className="text-xs">
              <thead className="sticky top-0 z-20 bg-white">
                <tr className="bg-gray-100">
                  <th className="sticky left-0 bg-gray-100 px-3 py-2 text-left font-bold text-gray-700 border-b border-r border-gray-300" style={{ minWidth: 70, zIndex: 30 }}>Hora</th>
                  <th className="px-1 py-2 text-center font-bold text-orange-700 border-b border-gray-300 bg-orange-50" style={{ minWidth: 36 }}>🔥</th>
                  <th className="px-1 py-2 text-center font-bold text-indigo-700 border-b border-gray-300 bg-indigo-50" style={{ minWidth: 40 }}>Min</th>
                  <th className="px-1 py-2 text-center font-bold text-purple-700 border-b border-gray-300 bg-purple-50" style={{ minWidth: 40 }}>Σ</th>
                  {todosColabs.map(c => (
                    <th key={c.id} className={`px-1 py-2 text-center text-[10px] font-semibold border-b border-gray-200 ${c.ehFolga ? 'text-gray-400 bg-gray-50' : 'text-gray-700'}`} style={{ minWidth: 70, maxWidth: 70 }}>
                      <div className="truncate" title={c.nome}>{(c.nome || '').split(' ')[0]}</div>
                      <div className="text-gray-400 font-mono text-[9px]">{c.turno?.codigo || '—'}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slots.map(s => {
                  const cob = coberturaPorSlot[s] || 0;
                  const isHora = s.endsWith(':00');
                  const ehPico = slotEhPico(s);
                  const min = minimoSlot(s);
                  const minOk = min == null ? null : cob >= min;
                  return (
                    <tr key={s} className={isHora ? 'border-t border-gray-200' : ''}>
                      <td className={`sticky left-0 px-3 py-1 text-right font-mono ${isHora ? 'font-bold text-gray-800 bg-gray-50' : 'text-gray-400 bg-white'} border-r border-gray-200`} style={{ zIndex: 10 }}>{s}</td>
                      <td className={`text-center px-1 ${ehPico ? 'bg-orange-100 text-orange-700 font-bold' : 'text-gray-200'}`}>{ehPico ? '🔥' : ''}</td>
                      <td className={`text-center font-bold px-1 ${min == null ? 'text-gray-300' : 'text-indigo-700'}`}>{min ?? ''}</td>
                      <td className={`text-center font-bold px-1 ${min == null ? (cob === 0 ? 'text-gray-300' : 'text-purple-700') : (minOk ? 'text-emerald-700 bg-emerald-100' : 'text-red-700 bg-red-100')}`}>{cob || ''}</td>
                      {todosColabs.map(c => {
                        if (c.ehFolga) {
                          const label = c.codigoFolga === 'FG' ? 'FOLGA' : c.codigoFolga === 'FE' ? 'FÉRIAS' : c.codigoFolga === 'ATS' ? 'ATESTADO' : c.codigoFolga === 'FRDO' ? 'FERIADO' : c.codigoFolga;
                          return (
                            <td key={c.id} className="text-center border-l border-gray-100 bg-gray-100 text-gray-400" style={{ height: 18 }}>
                              {isHora && s === '12:00' ? <span className="font-bold text-[10px] text-gray-600">{label}</span> : ''}
                            </td>
                          );
                        }
                        const ativo = trabalhandoNoSlot(c.turno, s);
                        const bg = ativo ? (c.turno?.cor || '#86efac') : 'transparent';
                        return (
                          <td key={c.id} className="text-center border-l border-gray-100" style={{ backgroundColor: bg, height: 18 }}>
                            {ativo && <span className="text-emerald-900 font-bold">✓</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}

      <div className="bg-gray-50 px-4 py-2 border-t border-gray-200 text-xs text-gray-600 flex items-center gap-3 flex-wrap">
        <span className="font-semibold">Cobertura (Σ):</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 bg-red-50 border border-red-300 inline-block"></span>0-1 (crítico)</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 bg-amber-50 border border-amber-300 inline-block"></span>2 (atenção)</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 bg-emerald-50 border border-emerald-300 inline-block"></span>3+ (ok)</span>
        <span className="ml-auto text-gray-500">Slots de 15min · células coloridas pelo turno do colaborador</span>
      </div>
    </div>
  );
}

// ============================================================
// 👩‍💼 AGENTE IA DE ESCALA — chat flutuante no canto inferior direito
// Conecta com OpenAI usando openai_api_key das configurações.
// Manda contexto da escala atual (setor, mês, regras, resumo de colabs).
// ============================================================
function AgenteIAChat({ grid, regraSetor, setorNome, mesNome, onAcaoExecutada }) {
  const [aberto, setAberto] = useState(false);
  const [agenteCfg, setAgenteCfg] = useState({ nome_agente: 'Assistente de Escala', avatar_emoji: '👩‍💼' });
  const [mensagens, setMensagens] = useState([]);
  const [input, setInput] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [subindoArquivo, setSubindoArquivo] = useState(false);
  const fileInputRef = useRef(null);

  // Autorizacao por senha (cache de 5min)
  const [autorizadoAte, setAutorizadoAte] = useState(null);
  const [pedindoSenha, setPedindoSenha] = useState(false);
  const [senhaInput, setSenhaInput] = useState('');
  const [validandoSenha, setValidandoSenha] = useState(false);
  const [erroSenha, setErroSenha] = useState('');
  // Acao pendente: { fn, descricao, executar }
  const [acaoPendente, setAcaoPendente] = useState(null);

  const estaAutorizado = () => autorizadoAte && new Date(autorizadoAte) > new Date();

  // Pede senha ao usuario antes de executar uma acao destrutiva.
  // Se ja esta autorizado (cache 5min), pula direto.
  const requererSenha = async (descricaoAcao, executar) => {
    if (estaAutorizado()) {
      return executar();
    }
    setAcaoPendente({ descricao: descricaoAcao, executar });
    setPedindoSenha(true);
    setSenhaInput('');
    setErroSenha('');
  };

  const validarSenhaEExecutar = async () => {
    if (!senhaInput.trim()) return;
    setValidandoSenha(true);
    setErroSenha('');
    try {
      const r = await api.post('/rh/escala/agente-ia/validar-senha', { senha: senhaInput });
      if (r.data?.valido) {
        setAutorizadoAte(r.data.validoAte);
        setPedindoSenha(false);
        setSenhaInput('');
        const exec = acaoPendente?.executar;
        setAcaoPendente(null);
        if (exec) await exec();
      } else {
        setErroSenha('Senha incorreta');
      }
    } catch (e) {
      setErroSenha(e.response?.data?.error || 'Senha incorreta');
    } finally {
      setValidandoSenha(false);
    }
  };

  const cancelarSenha = () => {
    setPedindoSenha(false);
    setSenhaInput('');
    setErroSenha('');
    setAcaoPendente(null);
    setMensagens(m => [...m, { role: 'assistant', content: '❌ Ação cancelada.' }]);
  };

  // Carrega config do agente (nome, avatar, saudacao) uma vez
  useEffect(() => {
    api.get('/rh/escala/agente-ia/config')
      .then(r => {
        const c = r.data || {};
        const nome = c.nome_agente || 'Assistente de Escala';
        const emoji = c.avatar_emoji || '👩‍💼';
        const saudacaoTpl = c.saudacao_inicial || `Oi! 👋 Eu sou a **{nome}**. Pergunta aí 👇`;
        setAgenteCfg({ nome_agente: nome, avatar_emoji: emoji });
        // Substitui {nome} pelo nome real
        const saudacao = saudacaoTpl.replace(/\{nome\}/g, nome);
        setMensagens([{ role: 'assistant', content: saudacao }]);
      })
      .catch(() => {
        setMensagens([{
          role: 'assistant',
          content: 'Oi! Sou o assistente de escala. Pergunta aí 👇',
        }]);
      });
  }, []);

  // Resumo enxuto pra mandar de contexto (não envia tabela inteira pra economizar tokens)
  const contexto = useMemo(() => {
    if (!grid) return null;
    return {
      mes: mesNome,
      setor: setorNome,
      qtd_colaboradores: grid.colaboradores?.length || 0,
      qtd_dias: grid.dias?.length || 0,
      colaboradores: (grid.colaboradores || []).slice(0, 20).map(c => ({
        nome: c.nome,
        cargo: c.cargoNome,
        jornada: c.jornadaCarga || c.jornadaNome,
        rotacao: c.tipoRotacao || c.escalaCadastro,
        rotacao_domingo: c.escalaDomingo,
        horas_mes: c.horasMes,
      })),
      regras_setor: regraSetor ? {
        rotacao_padrao: regraSetor.rotacao_padrao,
        dias_pico: regraSetor.dias_pico,
        funcionamento: `${regraSetor.funcionamento_inicio}-${regraSetor.funcionamento_fim}`,
        picos_por_dia: regraSetor.picos_por_dia,
        cobertura_minima: regraSetor.cobertura_minima,
        custo_hora_extra: regraSetor.custo_hora_extra,
      } : null,
    };
  }, [grid, regraSetor, setorNome, mesNome]);

  // Perguntas pre-programadas (chips). Aparecem so na primeira tela.
  const sugestoes = [
    { emoji: '📊', label: 'Como está a cobertura?', prompt: 'Analise a cobertura deste mês comparando com as regras do setor. Onde temos gaps?' },
    { emoji: '🔄', label: 'Reorganizar escala', prompt: 'Sugira uma reorganização da escala atual pra melhorar a cobertura nos picos sem aumentar hora extra.' },
    { emoji: '🆕', label: 'Criar escala do próximo mês', prompt: 'Monte uma proposta de escala pro próximo mês respeitando rotação dos colaboradores e cobertura mínima.' },
    { emoji: '🏖️', label: 'Programar férias', prompt: 'Sugira o melhor período pra programar férias dos colaboradores nos próximos 6 meses, sem afetar a cobertura.' },
    { emoji: '⚠️', label: 'Validar CLT', prompt: 'Verifique se a escala atual respeita CLT: interjornada 11h, DSR, limite 44h/semana. Aponte problemas.' },
    { emoji: '💰', label: 'Reduzir hora extra', prompt: 'Onde estamos pagando mais hora extra que o necessário? Sugira mudanças pra reduzir o custo.' },
    { emoji: '🔥', label: 'Cobertura nos picos', prompt: 'A equipe está coberta nos horários de pico? Compare com as regras do setor e aponte gaps.' },
    { emoji: '📅', label: 'Quem trabalha domingo?', prompt: 'Lista os colaboradores escalados pros próximos 4 domingos. Tem alguém sobrecarregado?' },
    { emoji: '📈', label: 'Identificar sobrecarga', prompt: 'Quais colaboradores estão sobrecarregados este mês (mais de 220h ou pouca folga)? Sugira ajustes.' },
    { emoji: '👤', label: 'Análise individual', prompt: 'Faça uma análise individual de cada colaborador deste setor: jornada, rotação, restrições. Quem está OK e quem precisa atenção?' },
    { emoji: '🤝', label: 'Sugerir trocas', prompt: 'Olhe a escala e sugira 3 trocas de turno que melhorariam a cobertura ou aliviariam alguém sobrecarregado.' },
    { emoji: '🎯', label: 'Pontos de atenção', prompt: 'Me dá um resumo rápido: o que está bom, o que precisa mudar e o que é urgente nesta escala?' },
  ];

  const enviarSugestao = (prompt) => {
    setInput(prompt);
    setTimeout(() => {
      // dispara o envio com o prompt da sugestao
      const novas = [...mensagens, { role: 'user', content: prompt }];
      setMensagens(novas);
      setInput('');
      setCarregando(true);
      api.post('/rh/escala/agente-ia/chat', {
        messages: novas.filter(m => m.role !== 'system'),
        contexto,
      }).then(r => {
        const reply = r.data.reply || '(sem resposta)';
        const salvas = r.data.memorias_salvas || [];
        const atualizadas = r.data.memorias_atualizadas || [];
        let aviso = '';
        if (salvas.length) aviso += `\n\n💾 Salvei no Vault: ${salvas.map(s => `**${s.titulo}**`).join(', ')}`;
        if (atualizadas.length) aviso += `\n\n🔄 Atualizei no Vault: ${atualizadas.map(s => `**${s.titulo}**`).join(', ')}`;
        setMensagens([...novas, { role: 'assistant', content: reply + aviso }]);
      }).catch(e => {
        setMensagens([...novas, { role: 'assistant', content: `❌ Erro: ${e.response?.data?.error || e.message}` }]);
      }).finally(() => setCarregando(false));
    }, 50);
  };

  // Executa uma acao proposta pelo agente. Se nao tiver autorizacao, pede senha.
  const executarAcao = async (acaoPendente, perguntaOriginal) => {
    const exec = async () => {
      setCarregando(true);
      try {
        const r = await api.post('/rh/escala/agente-ia/executar-acao', {
          acao: acaoPendente.acao,
          params: acaoPendente.params,
          descricao_humana: acaoPendente.descricao_humana,
          autorizado_ate: autorizadoAte,
          empresa_id: contexto?.empresa_id || contexto?.empresaId,
          departamento_id: contexto?.departamento_id || contexto?.departamentoId,
          pergunta_original: perguntaOriginal,
        });
        if (r.data?.sucesso) {
          setMensagens(m => [...m, { role: 'assistant', content: `✅ **Pronto!** ${r.data.descricao_humana || acaoPendente.descricao_humana}\n\nA escala foi atualizada. Recarregando a tela...` }]);
          // Dispara reload do grid no parent
          if (onAcaoExecutada) await onAcaoExecutada();
        } else {
          setMensagens(m => [...m, { role: 'assistant', content: `❌ **Erro ao executar:** ${r.data?.erro || 'falha'}` }]);
        }
      } catch (e) {
        setMensagens(m => [...m, { role: 'assistant', content: `❌ **Erro:** ${e.response?.data?.error || e.message}` }]);
      } finally {
        setCarregando(false);
      }
    };
    requererSenha(acaoPendente.descricao_humana, exec);
  };

  const enviar = async () => {
    const texto = input.trim();
    if (!texto || carregando) return;
    const novas = [...mensagens, { role: 'user', content: texto }];
    setMensagens(novas);
    setInput('');
    setCarregando(true);
    try {
      const r = await api.post('/rh/escala/agente-ia/chat', {
        messages: novas.filter(m => m.role !== 'system'),
        contexto,
      });
      const reply = r.data.reply || '(sem resposta)';
      const salvas = r.data.memorias_salvas || [];
      const atualizadas = r.data.memorias_atualizadas || [];
      const acao = r.data.acao_pendente;
      let aviso = '';
      if (salvas.length) aviso += `\n\n💾 Salvei no Vault: ${salvas.map(s => `**${s.titulo}**`).join(', ')}`;
      if (atualizadas.length) aviso += `\n\n🔄 Atualizei no Vault: ${atualizadas.map(s => `**${s.titulo}**`).join(', ')}`;
      const textoFinal = acao
        ? `${reply}\n\n🎯 **Ação proposta:** ${acao.descricao_humana}\n\n_Vou pedir sua senha pra autorizar..._`
        : reply + aviso;
      setMensagens([...novas, { role: 'assistant', content: textoFinal }]);
      // Se tem acao_pendente, dispara fluxo de senha
      if (acao) {
        executarAcao(acao, texto);
      }
    } catch (e) {
      console.error(e);
      setMensagens([...novas, { role: 'assistant', content: `❌ Erro: ${e.response?.data?.error || e.message}` }]);
    } finally {
      setCarregando(false);
    }
  };

  // Upload de escala antiga (Excel, PDF, imagem) → backend analisa e devolve resumo
  const importarArquivo = async (file) => {
    if (!file || subindoArquivo) return;
    setSubindoArquivo(true);
    const mensagemUser = { role: 'user', content: `📎 Anexei o arquivo "${file.name}" pra você analisar` };
    setMensagens(m => [...m, mensagemUser]);
    try {
      const fd = new FormData();
      fd.append('arquivo', file);
      const r = await api.post('/rh/escala/agente-ia/analisar-arquivo', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 180000,
      });
      const analise = r.data?.analise || '(sem analise)';
      setMensagens(m => [...m, { role: 'assistant', content: `📋 Analisei o arquivo (${r.data?.tipo_detectado}):\n\n${analise}` }]);
    } catch (e) {
      setMensagens(m => [...m, { role: 'assistant', content: `❌ Erro ao analisar arquivo: ${e.response?.data?.error || e.message}` }]);
    } finally {
      setSubindoArquivo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)}
        title={`${agenteCfg.nome_agente} (IA)`}
        className="fixed bottom-6 right-6 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg flex items-center justify-center transition z-50"
        style={{ width: 56, height: 56, fontSize: 24 }}>
        {agenteCfg.avatar_emoji}
      </button>
    );
  }

  // Mini-renderer markdown: cabeçalhos, listas, bold, italic, code
  const renderMd = (texto) => {
    if (!texto) return null;
    const linhas = texto.split('\n');
    const out = [];
    let lista = null;
    const flushLista = () => {
      if (lista) { out.push(<ul key={`l${out.length}`} className="list-disc pl-5 space-y-1 my-2">{lista}</ul>); lista = null; }
    };
    const renderInline = (s, base) => {
      const partes = [];
      let t = s;
      t = t.replace(/\*\*([^*]+)\*\*/g, (m, x) => { partes.push({ k: 'b', t: x }); return `__P${partes.length - 1}__`; });
      t = t.replace(/`([^`]+)`/g, (m, x) => { partes.push({ k: 'c', t: x }); return `__P${partes.length - 1}__`; });
      t = t.replace(/\*([^*]+)\*/g, (m, x) => { partes.push({ k: 'i', t: x }); return `__P${partes.length - 1}__`; });
      return t.split(/(__P\d+__)/g).map((tk, i) => {
        const m = tk.match(/^__P(\d+)__$/);
        if (m) {
          const p = partes[parseInt(m[1])];
          if (p.k === 'b') return <strong key={`${base}-${i}`}>{p.t}</strong>;
          if (p.k === 'i') return <em key={`${base}-${i}`}>{p.t}</em>;
          if (p.k === 'c') return <code key={`${base}-${i}`} className="bg-gray-100 px-1 rounded text-pink-700 text-[0.88em]">{p.t}</code>;
        }
        return <span key={`${base}-${i}`}>{tk}</span>;
      });
    };
    linhas.forEach((ln, idx) => {
      const k = `ln${idx}`;
      if (/^###\s+/.test(ln)) { flushLista(); out.push(<h3 key={k} className="text-[15px] font-bold text-purple-800 mt-3 mb-1">{renderInline(ln.replace(/^###\s+/, ''), k)}</h3>); return; }
      if (/^##\s+/.test(ln)) { flushLista(); out.push(<h2 key={k} className="text-base font-bold text-purple-900 mt-4 mb-2 border-b border-purple-100 pb-1">{renderInline(ln.replace(/^##\s+/, ''), k)}</h2>); return; }
      if (/^#\s+/.test(ln)) { flushLista(); out.push(<h1 key={k} className="text-lg font-bold text-purple-900 mt-4 mb-2">{renderInline(ln.replace(/^#\s+/, ''), k)}</h1>); return; }
      if (/^\s*[-*]\s+/.test(ln)) {
        if (!lista) lista = [];
        lista.push(<li key={k}>{renderInline(ln.replace(/^\s*[-*]\s+/, ''), k)}</li>);
        return;
      }
      flushLista();
      if (ln.trim() === '') { out.push(<div key={k} className="h-2" />); return; }
      out.push(<p key={k} className="my-1.5 leading-relaxed">{renderInline(ln, k)}</p>);
    });
    flushLista();
    return out;
  };

  return (
    <div className="fixed bg-white rounded-2xl shadow-2xl flex flex-col z-50 border-2 border-purple-300"
      style={{ width: 'min(680px, 95vw)', height: 'min(800px, 88vh)', bottom: 24, right: 24 }}>
      <div className="bg-purple-600 text-white px-5 py-3 rounded-t-2xl flex items-center justify-between">
        <div>
          <div className="font-bold text-base flex items-center gap-2">{agenteCfg.avatar_emoji} {agenteCfg.nome_agente}</div>
          <div className="text-xs text-purple-200">{setorNome} · {mesNome}</div>
        </div>
        <button onClick={() => setAberto(false)} className="text-white hover:bg-purple-700 rounded w-8 h-8 flex items-center justify-center text-lg">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {mensagens.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] rounded-xl px-4 py-3 text-[14px] ${m.role === 'user' ? 'bg-purple-600 text-white whitespace-pre-wrap' : 'bg-white border border-gray-200 text-gray-800 shadow-sm'}`}>
              {m.role === 'user' ? m.content : renderMd(m.content)}
            </div>
          </div>
        ))}

        {/* Sugestoes rapidas — aparecem so antes do usuario mandar a 1a mensagem */}
        {mensagens.length === 1 && !carregando && (
          <div className="space-y-2 pt-1">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-1">⚡ Atalhos rápidos</p>
            <div className="flex flex-wrap gap-1.5">
              {sugestoes.map(s => (
                <button
                  key={s.label}
                  onClick={() => enviarSugestao(s.prompt)}
                  className="bg-white hover:bg-purple-50 border border-purple-200 hover:border-purple-400 text-purple-800 text-xs px-2.5 py-1.5 rounded-full transition shadow-sm"
                >
                  {s.emoji} {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {carregando && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-500 shadow-sm">
              <span className="inline-flex gap-1">
                <span className="animate-bounce" style={{ animationDelay: '0ms' }}>●</span>
                <span className="animate-bounce" style={{ animationDelay: '150ms' }}>●</span>
                <span className="animate-bounce" style={{ animationDelay: '300ms' }}>●</span>
              </span>
            </div>
          </div>
        )}
      </div>
      {/* Banner senha ativa (cache 5min) */}
      {estaAutorizado() && !pedindoSenha && (
        <div className="bg-emerald-50 border-t border-emerald-200 px-4 py-1.5 text-[11px] text-emerald-800 flex items-center gap-2">
          <span>🔓</span>
          <span>Autorização ativa — ações destrutivas liberadas até {new Date(autorizadoAte).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      )}

      {/* Pedido de senha (overlay dentro do chat) */}
      {pedindoSenha && (
        <div className="bg-amber-50 border-t-2 border-amber-300 p-4">
          <div className="flex items-start gap-2 mb-2">
            <span className="text-2xl">🔐</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">Confirme com sua senha</p>
              {acaoPendente?.descricao && (
                <p className="text-xs text-amber-800 mt-0.5">{acaoPendente.descricao}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <input
              type="password"
              value={senhaInput}
              onChange={(e) => { setSenhaInput(e.target.value); setErroSenha(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') validarSenhaEExecutar(); if (e.key === 'Escape') cancelarSenha(); }}
              placeholder="Sua senha"
              autoFocus
              disabled={validandoSenha}
              className={`flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 ${erroSenha ? 'border-red-400 focus:ring-red-300' : 'border-amber-300 focus:ring-amber-300'}`}
            />
            <button
              onClick={validarSenhaEExecutar}
              disabled={validandoSenha || !senhaInput.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
            >
              {validandoSenha ? '...' : 'Autorizar'}
            </button>
            <button
              onClick={cancelarSenha}
              disabled={validandoSenha}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm"
            >
              ✕
            </button>
          </div>
          {erroSenha && <p className="text-xs text-red-700 mt-1.5">⚠️ {erroSenha}</p>}
          <p className="text-[10px] text-amber-700 mt-2">A autorização fica ativa por 5 minutos. Depois disso será pedida novamente.</p>
        </div>
      )}

      <div className="p-3 border-t border-gray-200 flex items-end gap-2 bg-white rounded-b-2xl">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.xlsx,.xls,.csv,image/*,text/*"
          onChange={(e) => importarArquivo(e.target.files?.[0])}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={subindoArquivo || carregando}
          title="Importar escala antiga (PDF, Excel, foto)"
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 w-10 h-10 rounded-lg flex items-center justify-center disabled:opacity-50 text-base"
        >
          {subindoArquivo ? (
            <span className="inline-flex gap-0.5 text-xs">
              <span className="animate-bounce" style={{ animationDelay: '0ms' }}>●</span>
              <span className="animate-bounce" style={{ animationDelay: '150ms' }}>●</span>
            </span>
          ) : '📎'}
        </button>
        <textarea value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
          placeholder={subindoArquivo ? 'Analisando arquivo...' : 'Pergunte algo sobre a escala...'}
          disabled={subindoArquivo}
          rows={2}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 disabled:bg-gray-50" />
        <button onClick={enviar} disabled={carregando || subindoArquivo || !input.trim()}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 h-10">
          ➤
        </button>
      </div>
    </div>
  );
}
