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
  atestado: { label: '🩺 Atestado', cls: 'bg-orange-100 text-orange-700' },
};
// célula de minutos: '—' quando 0/null, com cor opcional
const minCell = (m, cls = 'text-gray-700') => (m == null || m === 0) ? <span className="text-gray-300">—</span> : <span className={cls}>{fmtMin(m)}</span>;

// Colunas da tabela (arrastáveis). cell(d) devolve o CONTEÚDO da célula.
const COLS_DEF = {
  data: { label: 'Data', th: 'text-left', td: 'px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap', cell: d => d.dia },
  diasemana: { label: 'Dia da Semana', th: 'text-center', td: 'px-3 py-2 text-center whitespace-nowrap', cell: d => <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-700">{diaSemana(d.ymd)}</span> },
  jornada: { label: 'Previsto', th: 'text-left', td: 'px-3 py-2 text-xs whitespace-nowrap', cell: d => {
    if (d.status === 'feriado') return <span className="text-purple-700 font-bold">FERIADO{d.feriado_nome ? `: ${d.feriado_nome}` : ''}</span>;
    if (d.status === 'folga') return <span className="text-blue-600 font-bold">Folga</span>;
    return <span className="text-gray-500">{d.jornada || '—'}</span>;
  } },
  marcacoes: { label: 'Marcações', th: 'text-left', td: 'px-3 py-2', cell: d => {
    if (d.status === 'atestado') return <span className="text-orange-700 font-semibold text-xs">{d.justificativa_dia || 'Justificado'}</span>;
    // esconde placeholder (saída esperada ainda não batida: tipo D, sem justificativa e sem idAfd)
    const vis = (d.batidas || []).filter(b => b.tipo === 'E' || b.tipo === 'S' || (b.tipo === 'D' && (b.justificativa || b.real)));
    if (vis.length === 0) return <span className="text-xs text-gray-400">—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {vis.map((b, j) => {
          // justificativa real (Médico/Abono) → badge laranja
          if (b.tipo === 'D' && b.justificativa) return (
            <span key={j} title={b.detalhe || b.justificativa || 'Justificativa'}
              className="px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-800">{b.justificativa}</span>);
          // batida "D" real = volta registrada aguardando fechamento do dia → mostra o horário (âmbar)
          if (b.tipo === 'D') return (
            <span key={j} title="Batida registrada — aguardando fechamento do dia"
              className="px-2 py-0.5 rounded text-xs font-mono bg-amber-100 text-amber-800 ring-1 ring-amber-300">{b.hora}</span>);
          // entrada/saída pareadas
          return (
            <span key={j} title={b.tipo === 'E' ? 'Entrada' : 'Saída'}
              className={`px-2 py-0.5 rounded text-xs font-mono ${b.tipo === 'E' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{b.hora}</span>);
        })}
      </div>);
  } },
  normais: { label: 'Normais', th: 'text-right', td: 'px-3 py-2 text-right text-gray-700', cell: d => minCell(d.normais_min, 'text-gray-700 font-medium') },
  trabalhado: { label: 'Trabalhado', th: 'text-right', td: 'px-3 py-2 text-right font-semibold text-blue-700', cell: d => d.trabalhado_min == null ? <span className="text-gray-300">—</span> : fmtMin(d.trabalhado_min) },
  faltaatraso: { label: 'Falta/Atraso', th: 'text-right', td: 'px-3 py-2 text-right', cell: d => minCell(d.falta_atraso_min, 'text-rose-600 font-medium') },
  abono: { label: 'Abono', th: 'text-right', td: 'px-3 py-2 text-right', cell: d => minCell(d.abono_min, 'text-indigo-600 font-medium') },
  extradiurna: { label: 'Extra D.', th: 'text-right', td: 'px-3 py-2 text-right', cell: d => minCell(d.extra_diurna_min, 'text-amber-700 font-medium') },
  extranoturna: { label: 'Extra N.', th: 'text-right', td: 'px-3 py-2 text-right', cell: d => minCell(d.extra_noturna_min, 'text-amber-800 font-medium') },
  interjornada: { label: 'Interj.', th: 'text-right', td: 'px-3 py-2 text-right', cell: d => minCell(d.interjornada_min, 'text-gray-600') },
  bancodia: { label: 'Banco (dia)', th: 'text-right', td: 'px-3 py-2 text-right', cell: d => (!d.banco_dia_min) ? <span className="text-gray-300">—</span> : (
    <span className={d.banco_dia_min >= 0 ? 'text-emerald-700 font-medium' : 'text-rose-700 font-medium'}>{(d.banco_dia_min >= 0 ? '+' : '') + fmtMin(d.banco_dia_min)}</span>) },
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
const COLS_ORDEM_PADRAO = ['data', 'diasemana', 'jornada', 'marcacoes', 'normais', 'trabalhado', 'faltaatraso', 'abono', 'extradiurna', 'extranoturna', 'interjornada', 'bancodia', 'saldo', 'alerta', 'situacao'];
const LS_ORDEM = 'espelhoPonto_colOrder';
const fmtMin = (m) => (m == null) ? '—' : `${m < 0 ? '-' : ''}${Math.floor(Math.abs(m) / 60)}h${String(Math.abs(m) % 60).padStart(2, '0')}`;
// Formata o último sync do relógio com a nuvem (hora + "há Nmin")
const fmtSync = (ms) => {
  if (!ms) return null;
  const hora = new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const min = Math.max(0, Math.round((Date.now() - ms) / 60000));
  return { hora, rel: min <= 0 ? 'agora' : `há ${min} min` };
};
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
  const [relogio, setRelogio] = useState(null); // status conexão + último sync do relógio
  const [sincronizando, setSincronizando] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

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

  const carregarStatus = () =>
    api.get('/rh/ponto/relogio/status').then(r => setRelogio(r.data)).catch(e => setRelogio({ ok: false, error: e?.response?.data?.error || 'offline' }));

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/rh/empresas/stores/list');
        setEmpresas(Array.isArray(r.data) ? r.data : (r.data?.companies || []));
      } catch { /* ignore */ }
    })();
    carregarStatus(); // testa conexão + pega último sync do relógio (não bloqueia)
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

  const sincronizarPis = async () => {
    setSincronizando(true);
    try {
      const r = await api.post('/rh/ponto/sincronizar-pis');
      const d = r.data || {};
      toast.success(`${d.vinculados || 0} colaborador(es) vinculado(s) à RHiD` + (d.nao_encontrados?.length ? ` · ${d.nao_encontrados.length} sem correspondência` : ''), { duration: 6000 });
      // recarrega colaboradores (pega os PIS novos) e reexecuta se houver um selecionado
      const params = new URLSearchParams({ status: 'ativo', limit: '1000' });
      if (companyId) params.append('company_id', companyId);
      const rc = await api.get(`/rh/colaboradores?${params.toString()}`);
      setColaboradores(Array.isArray(rc.data?.data) ? rc.data.data : []);
      if (colaboradorId) carregar();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Erro ao sincronizar PIS com a RHiD');
    } finally { setSincronizando(false); }
  };

  // Auto-atualizar: a cada 60s re-consulta o relógio e recarrega o espelho do colaborador aberto
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      carregarStatus();
      if (colaboradorId && dataInicio && dataFim) carregar();
    }, 60000);
    return () => clearInterval(id);
  }, [autoRefresh, colaboradorId, dataInicio, dataFim]);

  const col = resultado?.colaborador;
  const tot = resultado?.totais;
  const sync = relogio?.ok ? fmtSync(relogio.ultimo_sync_ms) : null;

  const brDate = (s) => (s ? String(s).split('-').reverse().join('/') : '');
  // HH:MM (horas podem passar de 24 nos totais). Vazio quando 0/null.
  const hm = (m, { zero = '' } = {}) => (m == null || m === 0) ? zero : `${Math.floor(Math.abs(m) / 60)}:${String(Math.abs(m) % 60).padStart(2, '0')}`;
  const hmSigned = (m) => (m == null || m === 0) ? '' : `${m < 0 ? '-' : ''}${hm(Math.abs(m))}`;

  /** PDF fiel ao "Cartão de Ponto" do Control iD (dados oficiais RHiD). */
  const gerarCartao = () => {
    if (!resultado || !col || !resultado.dias?.length) return;
    const emp = resultado.empresa || {};
    const esc = (s) => String(s ?? '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

    // Grade semanal (HORÁRIO DE TRABALHO)
    const parseRanges = (previsto) => {
      const out = ['', '', '', ''];   // ENT.1, SAÍ.1, ENT.2, SAÍ.2
      const ranges = String(previsto || '').split('/').map(s => s.trim()).filter(Boolean);
      ranges.slice(0, 2).forEach((r, i) => { const [a, b] = r.split('-').map(s => s.trim()); out[i * 2] = a || ''; out[i * 2 + 1] = b || ''; });
      return out;
    };
    const gradeRows = (resultado.horario_semanal || []).map(h => {
      const [e1, s1, e2, s2] = parseRanges(h.previsto);
      return `<tr><td style="font-weight:bold;background:#f3f4f6">${h.label}</td><td>${e1}</td><td>${s1}</td><td>${e2}</td><td>${s2}</td></tr>`;
    }).join('');

    // Linhas da tabela principal
    const linhas = resultado.dias.map(d => {
      const dow = diaSemana(d.ymd).slice(0, 3).toUpperCase();
      // ENT.1..SAÍ.3 = batidas registradas no relógio (E/S + "D" real pendente), em ordem
      const reais = (d.batidas || []).filter(b => b.tipo === 'E' || b.tipo === 'S' || (b.tipo === 'D' && b.real && !b.justificativa)).map(b => b.hora);
      const slots = [0, 1, 2, 3, 4, 5].map(i => reais[i] || '');
      let previstoCel = esc(d.jornada || '');
      let ent2Extra = '';
      if (d.status === 'feriado') { previstoCel = 'FERIADO'; ent2Extra = `<span style="color:#7c3aed">Feriado: ${esc(d.feriado_nome || '')}</span>`; }
      else if (d.status === 'folga') { previstoCel = 'Folga'; }
      else if (d.status === 'atestado') { slots[0] = ''; ent2Extra = `<span style="color:#c2410c;font-weight:bold">${esc(d.justificativa_dia || 'Atestado')}</span>`; }
      const cell2 = ent2Extra || slots[2];
      const bg = d.status === 'falta' ? '#fef2f2' : d.status === 'folga' ? '#eff6ff' : d.status === 'feriado' ? '#faf5ff' : d.status === 'atestado' ? '#fff7ed' : '#fff';
      const c = (v, opts = {}) => `<td style="text-align:${opts.a || 'center'};white-space:nowrap;${opts.s || ''}">${v ?? ''}</td>`;
      return `<tr style="background:${bg}">
        ${c(`${d.dia.slice(0, 5)} ${dow}`, { a: 'left', s: 'font-weight:bold' })}
        ${c(previstoCel, { a: 'left', s: 'font-size:9px;color:#374151' })}
        ${c(slots[0])}${c(slots[1])}${c(cell2)}${c(slots[3])}${c(slots[4])}${c(slots[5])}
        ${c(d.normais_min == null ? '' : hm(d.normais_min), { a: 'right' })}
        ${c(d.trabalhado_min == null ? '' : hm(d.trabalhado_min), { a: 'right', s: 'font-weight:bold' })}
        ${c(d.falta_dia ? '1' : '')}
        ${c(hm(d.falta_atraso_min), { a: 'right', s: 'color:#be123c' })}
        ${c(hm(d.abono_min), { a: 'right', s: 'color:#4338ca' })}
        ${c(hm(d.extra_diurna_min), { a: 'right', s: 'color:#b45309' })}
        ${c(hm(d.extra_noturna_min), { a: 'right', s: 'color:#92400e' })}
        ${c(hm(d.interjornada_min), { a: 'right' })}
        ${c(d.banco_dia_min >= 0 ? hm(d.banco_dia_min) : '', { a: 'right', s: 'color:#047857' })}
        ${c(d.banco_dia_min < 0 ? hm(d.banco_dia_min) : '', { a: 'right', s: 'color:#be123c' })}
      </tr>`;
    }).join('');

    const totCredito = (resultado.dias || []).reduce((a, d) => a + Math.max(0, d.banco_dia_min || 0), 0);
    const totDebito = (resultado.dias || []).reduce((a, d) => a + Math.min(0, d.banco_dia_min || 0), 0);
    const totaisRow = `<tr style="background:#e5e7eb;font-weight:bold">
      <td colspan="8" style="text-align:right;padding-right:8px">TOTAIS</td>
      <td style="text-align:right">${hm(tot.normais_min)}</td>
      <td style="text-align:right">${hm(tot.trabalhado_min)}</td>
      <td style="text-align:center">${tot.dias_falta || ''}</td>
      <td style="text-align:right">${hm(tot.falta_atraso_min)}</td>
      <td style="text-align:right">${hm(tot.abono_min)}</td>
      <td style="text-align:right">${hm(tot.extra_diurna_min)}</td>
      <td style="text-align:right">${hm(tot.extra_noturna_min)}</td>
      <td style="text-align:right">${hm(tot.interjornada_min)}</td>
      <td style="text-align:right">${hm(totCredito)}</td>
      <td style="text-align:right">${hm(Math.abs(totDebito))}</td>
    </tr>`;

    const alteracoes = (resultado.alteracoes || []).map(a => `<li>${esc(a)}</li>`).join('');
    const th = (t, extra = '') => `<th style="border:1px solid #999;padding:3px 4px;background:#f3f4f6;font-size:8.5px;${extra}">${t}</th>`;

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Cartão de Ponto - ${esc(col.nome)}</title>
<style>
  @page { size: A4 landscape; margin: 8mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; color: #111; margin: 0; font-size: 10px; }
  table.main { border-collapse: collapse; width: 100%; }
  table.main td { border: 1px solid #ccc; padding: 2px 4px; font-size: 9px; }
  table.grade { border-collapse: collapse; font-size: 8.5px; }
  table.grade td { border: 1px solid #bbb; padding: 1px 5px; text-align: center; }
  .hdr td { padding: 1px 4px; font-size: 9.5px; border: none; }
  .hdr b { color: #000; }
</style></head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div><div style="font-size:22px;font-weight:bold">Cartão</div><div style="font-size:15px;color:#444;margin-top:-4px">de Ponto</div></div>
    <div style="text-align:right;font-size:10px">
      <div style="font-weight:bold;color:#c0392b">Control iD</div>
      <div>Emitido em ${new Date().toLocaleDateString('pt-BR')}</div>
      <div style="color:#c0392b;font-weight:bold;margin-top:6px">DE ${brDate(resultado.periodo.data_inicio)} ATÉ ${brDate(resultado.periodo.data_fim)}</div>
    </div>
  </div>

  <div style="display:flex;justify-content:space-between;gap:12px;margin:8px 0;border:1px solid #ddd;padding:6px">
    <table class="hdr"><tbody>
      <tr><td>NOME DA EMPRESA:</td><td><b>${esc(emp.nome || '—')}</b></td></tr>
      <tr><td>CNPJ DA EMPRESA:</td><td><b>${esc(emp.cnpj || '—')}</b></td><td style="padding-left:14px">INSCRIÇÃO ESTADUAL:</td><td><b>${esc(emp.inscricao_estadual || '—')}</b></td></tr>
      <tr><td>NOME DO FUNCIONÁRIO:</td><td><b>${esc(col.nome)}</b></td><td style="padding-left:14px">CPF:</td><td><b>${esc(col.cpf || '—')}</b></td></tr>
      <tr><td>PIS DO FUNCIONÁRIO:</td><td><b>${esc(col.pis_pasep)}</b></td><td style="padding-left:14px">DATA DE ADMISSÃO:</td><td><b>${col.data_admissao ? brDate(String(col.data_admissao).slice(0, 10)) : '—'}</b></td></tr>
      <tr><td>NOME DO CARGO:</td><td><b>${esc(col.cargo_nome || '—')}</b></td><td style="padding-left:14px">Nº MATRÍCULA:</td><td><b>${esc(col.matricula || '—')}</b></td></tr>
      <tr><td>NOME DO DEPARTAMENTO:</td><td><b>${esc(col.departamento_nome || '—')}</b></td></tr>
    </tbody></table>
    <div>
      <div style="font-size:8.5px;font-weight:bold;text-align:center;margin-bottom:2px">HORÁRIO DE TRABALHO</div>
      <table class="grade"><thead><tr><td></td><td>ENT.1</td><td>SAÍ.1</td><td>ENT.2</td><td>SAÍ.2</td></tr></thead><tbody>${gradeRows}</tbody></table>
    </div>
  </div>

  <table class="main">
    <thead><tr>
      ${th('DIA', 'text-align:left')}${th('PREVISTO', 'text-align:left')}
      ${th('ENT.1')}${th('SAÍ.1')}${th('ENT.2')}${th('SAÍ.2')}${th('ENT.3')}${th('SAÍ.3')}
      ${th('TOTAL<br>NORMAIS')}${th('TOTAL<br>TRABALHADO')}${th('DIA<br>FALTA')}${th('FALTA E<br>ATRASO')}${th('ABONO')}
      ${th('EXTRA<br>DIURNA')}${th('EXTRA<br>NOTURNA')}${th('INTER<br>JORNADA')}${th('BANCO<br>CRÉDITO')}${th('BANCO<br>DÉBITO')}
    </tr></thead>
    <tbody>${linhas}${totaisRow}</tbody>
  </table>

  ${alteracoes ? `<div style="margin-top:8px"><b style="font-size:10px">Alterações</b><ul style="margin:4px 0;font-size:9px;columns:2">${alteracoes}</ul></div>` : ''}
  <p style="font-size:8px;color:#9ca3af;margin-top:8px">Dados oficiais da RHiD (Control iD) — saldo do banco reflete queima/pagamento de horas. Reproduzido pelo Kontrata.ai.</p>
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
              {sync && (
                <span title="Hora em que o relógio enviou as batidas pra nuvem RHiD. As batidas feitas depois desse horário só aparecem no próximo envio do relógio."
                  className="text-xs px-2 py-1 rounded-full font-semibold bg-white/15 text-white">
                  🕐 Relógio sinc. {sync.hora} <span className="opacity-75">({sync.rel})</span>
                </span>
              )}
              <button onClick={() => setAutoRefresh(v => !v)}
                title="Recarrega o espelho automaticamente a cada 60s"
                className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${autoRefresh ? 'bg-emerald-400/30 text-emerald-50 ring-1 ring-emerald-300' : 'bg-white/20 hover:bg-white/30 text-white'}`}>
                {autoRefresh ? '🔄 Auto ON' : '🔄 Auto'}
              </button>
              <button onClick={sincronizarPis} disabled={sincronizando}
                title="Casa os colaboradores com a RHiD por CPF/nome e preenche o PIS"
                className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-white/20 hover:bg-white/30 text-white disabled:opacity-60">
                {sincronizando ? 'Sincronizando…' : '🔗 Sincronizar PIS'}
              </button>
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
              <p className="text-sm mt-1 text-amber-700">Clique abaixo pra casar automaticamente com a RHiD (por CPF/nome) e preencher o PIS.</p>
              <button onClick={sincronizarPis} disabled={sincronizando}
                className="mt-3 px-4 py-2 rounded-lg text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-60">
                {sincronizando ? 'Sincronizando…' : '🔗 Sincronizar PIS com a RHiD agora'}
              </button>
            </div>
          ) : resultado.nao_encontrado_rhid ? (
            <div className="text-center py-16 text-amber-600 bg-amber-50 rounded-lg border border-amber-200">
              <div className="text-4xl mb-2">🔎</div>
              <p className="font-bold">{col?.nome} não foi encontrado na RHiD</p>
              <p className="text-sm mt-1 text-amber-700">Buscamos por CPF ({col?.cpf || '—'}) e por PIS ({col?.pis_pasep || '—'}) e nenhum bateu com o cadastro na RHiD. Confira o CPF/PIS do colaborador no relógio.</p>
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
                  <button onClick={gerarCartao}
                    className="px-3 py-1.5 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700">
                    📄 Cartão de Ponto (PDF)
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
                        <tr key={d.ymd} className={
                          d.status === 'falta' ? 'bg-rose-50' :
                          d.status === 'folga' ? 'bg-blue-50/40' :
                          d.status === 'feriado' ? 'bg-purple-50/50' :
                          d.status === 'atestado' ? 'bg-orange-50/50' :
                          (i % 2 ? 'bg-gray-50' : 'bg-white')}>
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
