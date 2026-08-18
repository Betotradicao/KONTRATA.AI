import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

/** Minutos -> "+2h30" / "-0h20". Devolve '' pra null (a coluna mostra "—"). */
const fmtMin = (min) => {
  if (min == null) return '';
  const neg = min < 0;
  const abs = Math.abs(Math.round(min));
  return `${neg ? '-' : '+'}${Math.floor(abs / 60)}h${String(abs % 60).padStart(2, '0')}`;
};

// Cores do PDF, iguais as da tela (emerald-600 / red-600)
const VERDE = [5, 150, 105];
const VERMELHO = [220, 38, 38];

export default function RhSaldoBanco() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [empresas, setEmpresas] = useState([]);
  const [setores, setSetores] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);

  const [companyId, setCompanyId] = useState('');
  const [departamentoId, setDepartamentoId] = useState('');
  const [colaboradorId, setColaboradorId] = useState('');

  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);

  // Lojas e setores carregam uma vez so
  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/rh/empresas/stores/list');
        setEmpresas(Array.isArray(r.data) ? r.data : (r.data?.companies || []));
      } catch { /* ignore */ }
      try {
        const r = await api.get('/rh/configuracoes/departamentos');
        setSetores(Array.isArray(r.data) ? r.data : (r.data?.data || []));
      } catch { /* ignore */ }
    })();
  }, []);

  // Colaboradores acompanham a loja escolhida (mesmo padrao do Espelho de Ponto)
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

  // O endpoint /rh/colaboradores nao filtra por setor, mas devolve departamento_id.
  // Filtrar aqui evita mexer num endpoint compartilhado por varias telas.
  const colaboradoresFiltrados = departamentoId
    ? colaboradores.filter(c => String(c.departamento_id) === String(departamentoId))
    : colaboradores;

  // Trocou o setor e o colaborador escolhido nao pertence a ele -> limpa a selecao,
  // senao a pesquisa sairia com um filtro que nem aparece mais na lista.
  useEffect(() => {
    if (!colaboradorId) return;
    if (!colaboradoresFiltrados.some(c => String(c.id) === String(colaboradorId))) setColaboradorId('');
  }, [departamentoId, colaboradores]);

  const pesquisar = async (refresh = false) => {
    setLoading(true); setResultado(null);
    try {
      const params = new URLSearchParams();
      if (companyId) params.append('company_id', companyId);
      if (departamentoId) params.append('departamento_id', departamentoId);
      if (colaboradorId) params.append('colaborador_id', colaboradorId);
      if (refresh) params.append('refresh', '1');
      const r = await api.get(`/rh/ponto/saldo-banco?${params.toString()}`);
      setResultado(r.data);
      if (!r.data?.linhas?.length) toast('Nenhum colaborador encontrado nesse filtro', { icon: 'i' });
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Erro ao buscar os saldos');
    } finally { setLoading(false); }
  };

  const legendaFiltro = () => {
    const l = empresas.find(e => String(e.id) === String(companyId));
    const s = setores.find(x => String(x.id) === String(departamentoId));
    const c = colaboradoresFiltrados.find(x => String(x.id) === String(colaboradorId));
    return [
      `Loja: ${l ? (l.apelido || l.nome_fantasia || l.label || l.nome) : 'Todas'}`,
      `Setor: ${s ? s.nome : 'Todos'}`,
      `Colaborador: ${c ? c.nome : 'Todos'}`,
    ].join('   -   ');
  };

  const exportarPdf = () => {
    if (!resultado?.linhas?.length) { toast.error('Pesquise antes de gerar o PDF'); return; }
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const t = resultado.totais || {};

    doc.setFontSize(15); doc.setFont(undefined, 'bold');
    doc.text('SALDO DE BANCO DE HORAS', 14, 16);
    doc.setFontSize(8); doc.setFont(undefined, 'normal'); doc.setTextColor(90);
    doc.text(legendaFiltro(), 14, 22);
    doc.text(`Fonte: ${resultado.fonte || 'RHiD'}  -  Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 26);
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 31,
      head: [['Colaborador', 'Setor', 'Loja', 'Saldo Positivo', 'Saldo Negativo']],
      body: resultado.linhas.map(l => [
        l.nome + (l.matricula ? ` (${l.matricula})` : ''),
        l.setor || '-',
        l.empresa || '-',
        fmtMin(l.positivo_min) || '-',
        fmtMin(l.negativo_min) || '-',
      ]),
      foot: [[
        `TOTAL (${t.colaboradores || 0} colaboradores)`, '', '',
        fmtMin(t.total_positivo_min) || '-',
        fmtMin(t.total_negativo_min) || '-',
      ]],
      styles: { fontSize: 8, cellPadding: 1.6 },
      headStyles: { fillColor: [124, 58, 237], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [243, 244, 246], textColor: 0, fontStyle: 'bold' },
      columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' } },
      alternateRowStyles: { fillColor: [250, 250, 252] },
      // Mesmas cores da tela: positivo verde, negativo vermelho. So pinta celula
      // que tem valor de verdade — o traco de "sem saldo" fica cinza neutro.
      didParseCell: (d) => {
        // Alinhamento a direita forcado em TODAS as secoes (head/body/foot). Deixar
        // so no columnStyles nao alinhava o rodape, e o TOTAL ficava fora de prumo
        // com os numeros da coluna.
        if (d.column.index === 3 || d.column.index === 4) d.cell.styles.halign = 'right';
        if (d.section === 'head') return;
        if (d.cell.raw === '-') { d.cell.styles.textColor = [170, 170, 170]; return; }
        if (d.column.index === 3) { d.cell.styles.textColor = VERDE; d.cell.styles.fontStyle = 'bold'; }
        if (d.column.index === 4) { d.cell.styles.textColor = VERMELHO; d.cell.styles.fontStyle = 'bold'; }
      },
    });

    const y = (doc.lastAutoTable?.finalY || 40) + 7;
    doc.setFontSize(9); doc.setFont(undefined, 'bold');
    doc.setTextColor(...((t.liquido_min || 0) < 0 ? VERMELHO : VERDE));
    doc.text(`Saldo liquido: ${fmtMin(t.liquido_min) || '0h00'}`, 14, y);
    doc.setTextColor(0);

    doc.save(`saldo-banco-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const exportarExcel = () => {
    if (!resultado?.linhas?.length) { toast.error('Pesquise antes de exportar'); return; }
    const t = resultado.totais || {};
    const rows = resultado.linhas.map(l => ({
      Colaborador: l.nome,
      Matricula: l.matricula || '',
      Setor: l.setor || '',
      Loja: l.empresa || '',
      'Saldo Positivo': fmtMin(l.positivo_min) || '',
      'Saldo Negativo': fmtMin(l.negativo_min) || '',
      'Saldo (min)': l.saldo_min ?? '',
      'Ate': l.saldo_data || '',
    }));
    rows.push({});
    rows.push({
      Colaborador: 'TOTAL',
      'Saldo Positivo': fmtMin(t.total_positivo_min) || '',
      'Saldo Negativo': fmtMin(t.total_negativo_min) || '',
      'Saldo (min)': t.liquido_min ?? '',
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Saldo de Banco');
    XLSX.writeFile(wb, `saldo-banco-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const t = resultado?.totais || {};

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">🏦 Saldo de Banco</h1>
              <p className="text-purple-100 text-sm">Saldo de banco de horas por colaborador (fonte oficial RHiD)</p>
            </div>
            <div className="flex items-center gap-2">
              {resultado?.cache && (
                <button onClick={() => pesquisar(true)}
                  title="Os dados vieram do cache (ate 15 min). Clique pra buscar de novo na RHiD."
                  className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-white/20 hover:bg-white/30 text-white">
                  ♻️ Do cache - atualizar
                </button>
              )}
              <button onClick={exportarPdf} disabled={!resultado?.linhas?.length}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-white/20 hover:bg-white/30 text-white disabled:opacity-50">
                📄 PDF
              </button>
              <button onClick={exportarExcel} disabled={!resultado?.linhas?.length}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-white/20 hover:bg-white/30 text-white disabled:opacity-50">
                📊 Excel
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
            <div className="col-span-2 md:col-span-3">
              <label className="block text-xs font-bold uppercase text-gray-600 mb-1">🏷️ Setor</label>
              <select value={departamentoId} onChange={e => setDepartamentoId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option value="">Todos</option>
                {setores.map(s => (<option key={s.id} value={s.id}>{s.nome}</option>))}
              </select>
            </div>
            <div className="col-span-2 md:col-span-4">
              <label className="block text-xs font-bold uppercase text-gray-600 mb-1">👤 Colaborador</label>
              <select value={colaboradorId} onChange={e => setColaboradorId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option value="">Todos{departamentoId ? ` do setor (${colaboradoresFiltrados.length})` : ''}</option>
                {colaboradoresFiltrados.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}{c.matricula ? ` (Mat. ${c.matricula})` : ''}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 md:col-span-2">
              <button onClick={() => pesquisar(false)} disabled={loading}
                className={`w-full px-3 py-2 rounded-lg text-sm font-bold text-white ${loading ? 'bg-gray-400' : 'bg-purple-600 hover:bg-purple-700'}`}>
                {loading ? 'Buscando...' : '🔍 Pesquisar'}
              </button>
            </div>
          </div>
        </div>

        {/* Conteudo */}
        <div className="flex-1 overflow-auto p-3 md:p-4">
          {loading ? (
            <div className="text-center py-20 text-gray-500">
              <div className="text-5xl mb-3 animate-pulse">🏦</div>
              <p className="font-bold">Consultando a RHiD...</p>
              <p className="text-sm text-gray-400 mt-1">E uma consulta por colaborador — com a loja toda pode levar alguns segundos.</p>
            </div>
          ) : !resultado ? (
            <div className="text-center py-20 text-gray-400">
              <div className="text-5xl mb-2">🏦</div>
              <p>Escolha os filtros e clique em <b>Pesquisar</b>.</p>
            </div>
          ) : (
            <>
              {/* Cards de resumo */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-white rounded-xl border border-gray-200 p-3">
                  <div className="text-xs font-bold uppercase text-gray-500">Colaboradores</div>
                  <div className="text-2xl font-bold text-gray-800">{t.colaboradores || 0}</div>
                </div>
                <div className="bg-white rounded-xl border-l-4 border-emerald-500 border-y border-r border-gray-200 p-3">
                  <div className="text-xs font-bold uppercase text-gray-500">Total positivo</div>
                  <div className="text-2xl font-bold text-emerald-600">{fmtMin(t.total_positivo_min) || '0h00'}</div>
                  <div className="text-[11px] text-gray-400">{t.positivos || 0} colaborador(es)</div>
                </div>
                <div className="bg-white rounded-xl border-l-4 border-red-500 border-y border-r border-gray-200 p-3">
                  <div className="text-xs font-bold uppercase text-gray-500">Total negativo</div>
                  <div className="text-2xl font-bold text-red-600">{fmtMin(t.total_negativo_min) || '0h00'}</div>
                  <div className="text-[11px] text-gray-400">{t.negativos || 0} colaborador(es)</div>
                </div>
                <div className="bg-white rounded-xl border-l-4 border-purple-500 border-y border-r border-gray-200 p-3">
                  <div className="text-xs font-bold uppercase text-gray-500">Saldo liquido</div>
                  <div className={`text-2xl font-bold ${(t.liquido_min || 0) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {fmtMin(t.liquido_min) || '0h00'}
                  </div>
                </div>
              </div>

              {/* Tabela */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-800 text-white">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Colaborador</th>
                        <th className="px-3 py-2 text-left font-semibold">Setor</th>
                        <th className="px-3 py-2 text-left font-semibold">Loja</th>
                        <th className="px-3 py-2 text-right font-semibold">Saldo Banco Positivo</th>
                        <th className="px-3 py-2 text-right font-semibold">Saldo Banco Negativo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.linhas.map((l, i) => (
                        <tr key={l.colaborador_id} className={`border-b border-gray-100 ${i % 2 ? 'bg-gray-50/60' : ''}`}>
                          <td className="px-3 py-2 font-semibold text-gray-800">
                            {l.nome}
                            {l.matricula && <span className="ml-1 text-xs font-normal text-gray-400">Mat. {l.matricula}</span>}
                            {l.saldo_min == null && <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">sem apuracao</span>}
                          </td>
                          <td className="px-3 py-2 text-gray-600">{l.setor || '-'}</td>
                          <td className="px-3 py-2 text-gray-600">{l.empresa || '-'}</td>
                          <td className="px-3 py-2 text-right font-bold text-emerald-600">{fmtMin(l.positivo_min) || <span className="text-gray-300">—</span>}</td>
                          <td className="px-3 py-2 text-right font-bold text-red-600">{fmtMin(l.negativo_min) || <span className="text-gray-300">—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-100 font-bold">
                      <tr>
                        <td className="px-3 py-2" colSpan={3}>TOTAL ({t.colaboradores || 0} colaboradores)</td>
                        <td className="px-3 py-2 text-right text-emerald-700">{fmtMin(t.total_positivo_min) || '0h00'}</td>
                        <td className="px-3 py-2 text-right text-red-700">{fmtMin(t.total_negativo_min) || '0h00'}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Diagnostico — quem ficou de fora e por que */}
              {(resultado.diagnostico?.sem_match_rhid > 0 || resultado.diagnostico?.nao_bate_ponto > 0) && (
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                  <b>⚠️ Ficaram de fora:</b>{' '}
                  {resultado.diagnostico.nao_bate_ponto > 0 && <>{resultado.diagnostico.nao_bate_ponto} marcado(s) como "nao bate ponto". </>}
                  {resultado.diagnostico.sem_match_rhid > 0 && (
                    <>{resultado.diagnostico.sem_match_rhid} sem correspondencia na RHiD
                      {resultado.diagnostico.sem_match_nomes?.length ? ` (${resultado.diagnostico.sem_match_nomes.join(', ')})` : ''}.
                      {' '}Use <b>Espelho de Ponto &gt; Sincronizar PIS</b>.
                    </>
                  )}
                </div>
              )}

              <p className="mt-3 text-xs text-gray-400">
                🟢 Dados oficiais da RHiD — mesmo valor do card "Saldo Banco Atual" do Espelho de Ponto (saldo acumulado, ja com queima/pagamento aplicados).
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
