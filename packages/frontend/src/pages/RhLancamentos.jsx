import { useEffect, useState, Fragment } from 'react';
import { api } from '../utils/api';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const PROVENTOS = [
  { key: 'hora_extra_60', label: 'HE 60%' },
  { key: 'hora_extra_60_inter', label: 'HE 60% Interj.' },
  { key: 'hora_extra_100', label: 'HE 100%' },
  { key: 'adicional_noturno', label: 'Adic. Noturno' },
  { key: 'quebra_caixa', label: 'Quebra Caixa' },
  { key: 'ajuda_custo_domingo', label: 'Aj. Dom.' },
  { key: 'ajuda_custo_feriado', label: 'Aj. Feriado' },
  { key: 'insalubridade', label: 'Insalub.' },
  { key: 'premio', label: 'Prêmio' },
];
const DESCONTOS = [
  { key: 'falta_dias', label: 'Falta (dias)' },
  { key: 'atraso_horas', label: 'Atraso (h)' },
  { key: 'desconto_dsr', label: 'Desc. DSR' },
  { key: 'vale_transporte', label: 'VT' },
  { key: 'desconto_quebra_caixa', label: 'Desc. Quebra' },
  { key: 'contribuicao_sindical', label: 'Contrib. Sind.' },
  { key: 'adiantamento', label: 'Adiantamento' },
  { key: 'compras', label: 'Compras' },
];
const ALL = [...PROVENTOS, ...DESCONTOS];

// Valida se string e um numero monetario valido OU formato horas HH:MM.
// Aceita: "", "10", "10,5", "10.50", "1.234,56" (BR), "1:20" (hora:min), "0:30"
// Rejeita: "1,,0", "abc", "1,2,3", "1:99" etc.
function isValorValido(v) {
  if (v == null || v === '') return true;
  const s = String(v).trim().replace(/R\$|\s/gi, '');
  if (s === '') return true;
  // Formato horas HH:MM (minutos 00-59)
  if (/^-?\d+:[0-5]?\d$/.test(s)) return true;
  return /^-?(\d+|\d{1,3}(\.\d{3})*|\d{1,3}(,\d{3})*)([.,]\d{1,2})?$/.test(s);
}

// Converte string BR/US/HH:MM pra Number.
// "10,50" -> 10.50 | "1:20" -> 1.3333 (1h + 20/60) | "2:00" -> 2.0
// Retorna 0 se invalido.
function parseValor(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  let s = String(v).trim().replace(/R\$|\s/gi, '');
  // Formato horas HH:MM -> decimal
  const m = s.match(/^(-?)(\d+):([0-5]?\d)$/);
  if (m) {
    const sign = m[1] === '-' ? -1 : 1;
    return sign * (parseInt(m[2], 10) + parseInt(m[3], 10) / 60);
  }
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

// Mostra string vazia quando valor e zero/null/undefined.
// Pra inputs nao ficarem com "0,00" e o usuario ter que apagar antes de digitar.
function displayVal(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'number') return v === 0 ? '' : v;
  const s = String(v).trim();
  if (s === '' || /^-?0+([.,]0+)?$/.test(s)) return '';
  return v;
}

function hoje() { return new Date().toISOString().split('T')[0]; }
function primeiroDiaMes() {
  const d = new Date(); d.setDate(1);
  return d.toISOString().split('T')[0];
}

export default function RhLancamentos() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [aba, setAba] = useState('apontar'); // 'apontar' | 'salvos'
  const [periodos, setPeriodos] = useState([]);
  const [loadingPeriodos, setLoadingPeriodos] = useState(false);
  const [selecaoPeriodo, setSelecaoPeriodo] = useState(null);

  const [empresas, setEmpresas] = useState([]);
  const [companyId, setCompanyId] = useState('');
  const [dataInicio, setDataInicio] = useState(primeiroDiaMes());
  const [dataFim, setDataFim] = useState(hoje());
  const [mesCompetencia, setMesCompetencia] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [mesCaixa, setMesCaixa] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Campos customizados (extras)
  const [camposExtras, setCamposExtras] = useState([]); // [{ chave, label, tipo }]
  const [showNovaColuna, setShowNovaColuna] = useState(false);
  const [novaLabel, setNovaLabel] = useState('');
  const [novoTipo, setNovoTipo] = useState('provento');
  const [novoMostraQtd, setNovoMostraQtd] = useState(true);
  const [novoMostraValor, setNovoMostraValor] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/rh/empresas/stores/list');
        const data = Array.isArray(r.data) ? r.data : (r.data?.companies || []);
        setEmpresas(data);
      } catch { /* ignore */ }
    })();
    carregarCampos();
  }, []);

  const carregarCampos = async () => {
    try {
      const r = await api.get('/rh/apontamentos/campos');
      setCamposExtras(Array.isArray(r.data) ? r.data : []);
    } catch { setCamposExtras([]); }
  };

  const carregarPeriodos = async () => {
    setLoadingPeriodos(true);
    try {
      const r = await api.get('/rh/apontamentos/periodos');
      setPeriodos(Array.isArray(r.data) ? r.data : []);
    } catch { toast.error('Erro ao carregar periodos salvos'); }
    finally { setLoadingPeriodos(false); }
  };

  useEffect(() => {
    if (aba === 'salvos') carregarPeriodos();
  }, [aba]);

  const editarPeriodo = async (p) => {
    setDataInicio(p.data_inicio);
    setDataFim(p.data_fim);
    setCompanyId(p.company_id || '');
    if (p.mes_referencia) setMesCompetencia(p.mes_referencia);
    if (p.mes_caixa) setMesCaixa(p.mes_caixa);
    setAba('apontar');
    setTimeout(() => carregar(), 100);
  };

  const excluirPeriodo = async (p) => {
    const ini = String(p.data_inicio).slice(0, 10);
    const fim = String(p.data_fim).slice(0, 10);
    if (!window.confirm(`Excluir TODOS os apontamentos do período ${ini} → ${fim}? Esta ação não pode ser desfeita.`)) return;
    try {
      const r = await api.post('/rh/apontamentos/periodos/deletar', {
        data_inicio: ini,
        data_fim: fim,
        company_id: p.company_id || null,
      });
      toast.success(`${r.data?.removidos || 0} apontamento(s) removido(s)`);
      if (selecaoPeriodo && selecaoPeriodo.data_inicio === p.data_inicio && selecaoPeriodo.data_fim === p.data_fim) {
        setSelecaoPeriodo(null);
      }
      await carregarPeriodos();
    } catch {
      toast.error('Erro ao excluir período');
    }
  };

  // Formata "YYYY-MM-DD" pra "DD/MM/YYYY" sem cair em Invalid Date
  const fmtDataBR = (str) => {
    if (!str) return '—';
    const s = String(str).slice(0, 10);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
  };

  const criarColuna = async () => {
    if (!novaLabel.trim()) return;
    if (!novoMostraQtd && !novoMostraValor) {
      toast.error('Marque pelo menos QTD ou R$');
      return;
    }
    try {
      await api.post('/rh/apontamentos/campos', {
        label: novaLabel.trim(), tipo: novoTipo,
        mostra_qtd: novoMostraQtd, mostra_valor: novoMostraValor,
      });
      toast.success('Coluna criada');
      setShowNovaColuna(false);
      setNovaLabel('');
      setNovoTipo('provento');
      setNovoMostraQtd(true);
      setNovoMostraValor(true);
      await carregarCampos();
    } catch (err) { toast.error(err?.response?.data?.error || 'Erro ao criar coluna'); }
  };

  const deletarColuna = async (id) => {
    if (!window.confirm('Remover essa coluna? (os valores já salvos permanecem no banco)')) return;
    try {
      await api.delete(`/rh/apontamentos/campos/${id}`);
      toast.success('Coluna removida');
      await carregarCampos();
    } catch { toast.error('Erro'); }
  };

  const extrasProventos = camposExtras.filter(c => c.tipo === 'provento');
  const extrasDescontos = camposExtras.filter(c => c.tipo === 'desconto');

  const carregar = async () => {
    if (!dataInicio || !dataFim) { toast.error('Informe o período'); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ data_inicio: dataInicio, data_fim: dataFim });
      if (companyId) params.append('company_id', companyId);
      const r = await api.get(`/rh/apontamentos?${params.toString()}`);
      const data = Array.isArray(r.data) ? r.data : [];
      // Normaliza campos numericos
      setRows(data.map(d => {
        const obj = { ...d, campos_extras: d.campos_extras || {} };
        ALL.forEach(c => { obj[c.key] = d[c.key] == null ? '' : String(d[c.key]); });
        return obj;
      }));
      // Restaura mes_referencia / mes_caixa do primeiro apontamento que tem
      const comDado = data.find(d => d.mes_referencia || d.mes_caixa);
      if (comDado) {
        if (comDado.mes_referencia) setMesCompetencia(comDado.mes_referencia);
        if (comDado.mes_caixa) setMesCaixa(comDado.mes_caixa);
      }
    } catch (err) {
      toast.error('Erro ao carregar apontamentos');
    } finally { setLoading(false); }
  };

  const updateCell = (colaboradorId, key, value) => {
    setRows(rs => rs.map(r => r.colaborador_id === colaboradorId ? { ...r, [key]: value } : r));
  };
  const updateExtra = (colaboradorId, chave, value) => {
    setRows(rs => rs.map(r => r.colaborador_id === colaboradorId
      ? { ...r, campos_extras: { ...(r.campos_extras || {}), [chave]: value } } : r));
  };

  const salvarTudo = async () => {
    if (rows.length === 0) { toast.error('Nada pra salvar'); return; }
    if (!mesCompetencia) { toast.error('Informe o Mês de Competência'); return; }
    if (!mesCaixa) { toast.error('Informe o Mês Caixa'); return; }
    setSaving(true);
    try {
      const payload = {
        data_inicio: dataInicio,
        data_fim: dataFim,
        company_id: companyId || null,
        mes_referencia: mesCompetencia,
        mes_caixa: mesCaixa,
        apontamentos: rows.map(r => {
          const a = { colaborador_id: r.colaborador_id, observacao: r.observacao || '', campos_extras: r.campos_extras || {} };
          ALL.forEach(c => { a[c.key] = r[c.key]; });
          return a;
        })
      };
      const r = await api.post('/rh/apontamentos/batch', payload);
      toast.success(`${r.data.salvos || 0} registro(s) salvo(s)`);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Erro ao salvar');
    } finally { setSaving(false); }
  };

  const exportar = async (tipo) => {
    if (!dataInicio || !dataFim) { toast.error('Informe o período (DE / ATÉ) antes de exportar'); return; }
    try {
      const params = new URLSearchParams({ data_inicio: dataInicio, data_fim: dataFim });
      if (companyId) params.append('company_id', companyId);
      const endpoint = tipo === 'pdf' ? 'pdf' : 'excel';
      const r = await api.get(`/rh/apontamentos/${endpoint}?${params.toString()}`, { responseType: 'blob' });
      const mime = tipo === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const ext = tipo === 'pdf' ? 'pdf' : 'xlsx';
      const blob = new Blob([r.data], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `apontamento_${dataInicio}_${dataFim}.${ext}`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { toast.error('Erro ao exportar'); }
  };

  // Totais por colaborador — soma R$ dos campos _valor (qtd nao entra no dinheiro)
  // Pra colunas extras: soma sempre o R$ se houver, senao soma o QTD direto
  const valorExtra = (r, c) => {
    const showVal = c.mostra_valor !== false;
    const chaveValor = showVal ? `${c.chave}_valor` : c.chave;
    return parseValor(r.campos_extras?.[chaveValor]);
  };

  const totais = (r) => {
    const prov = PROVENTOS.reduce((s, c) => s + parseValor(r.campos_extras?.[`${c.key}_valor`]), 0)
      + extrasProventos.reduce((s, c) => s + valorExtra(r, c), 0);
    const desc = DESCONTOS.reduce((s, c) => s + parseValor(r.campos_extras?.[`${c.key}_valor`]), 0)
      + extrasDescontos.reduce((s, c) => s + valorExtra(r, c), 0);
    const sal = parseValor(r.salario);
    const bruto = sal + prov;
    return { prov, desc, bruto, liq: bruto - desc };
  };

  const fmtMoney = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Lançamentos Financeiros</h1>
              <p className="text-orange-100 text-sm">Apontamento de folha de pagamento por período</p>
            </div>
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-purple-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Abas */}
        <div className="bg-white border-b border-gray-200 px-4">
          <div className="flex gap-1">
            <button onClick={() => setAba('apontar')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${aba === 'apontar' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              📝 Apontamento
            </button>
            <button onClick={() => setAba('salvos')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${aba === 'salvos' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              💾 Lançamentos Salvos {periodos.length > 0 && <span className="ml-1 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">{periodos.length}</span>}
            </button>
          </div>
        </div>

        {/* Tela de Lancamentos Salvos */}
        {aba === 'salvos' && (
          <div className="flex-1 overflow-auto p-4">
            <div className="bg-white rounded-lg shadow border">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div>
                  <h2 className="font-bold text-gray-800">Lançamentos Salvos</h2>
                  <p className="text-xs text-gray-500">Uma linha por período — clica + Editar pra abrir e continuar</p>
                </div>
                <div className="flex gap-2">
                  {selecaoPeriodo && (
                    <button onClick={() => editarPeriodo(selecaoPeriodo)}
                      className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold">
                      ✏️ Editar período selecionado
                    </button>
                  )}
                  <button onClick={carregarPeriodos} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm">↻ Recarregar</button>
                </div>
              </div>
              {loadingPeriodos ? (
                <div className="text-center py-10 text-gray-400">Carregando...</div>
              ) : periodos.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <div className="text-4xl mb-2">📋</div>
                  <p className="font-semibold">Nenhum lançamento salvo ainda</p>
                  <p className="text-xs mt-1">Volta na aba Apontamento, preenche e clica em Gravar.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-600 text-white">
                    <tr>
                      <th className="text-left px-4 py-2 w-10"></th>
                      <th className="text-left px-4 py-2">Período</th>
                      <th className="text-left px-4 py-2">📅 Competência</th>
                      <th className="text-left px-4 py-2">💰 Caixa</th>
                      <th className="text-left px-4 py-2">Empresa</th>
                      <th className="text-center px-4 py-2">Colaboradores</th>
                      <th className="text-right px-4 py-2">Total Salários</th>
                      <th className="text-left px-4 py-2">Última alteração</th>
                      <th className="text-right px-4 py-2">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {periodos.map(p => {
                      const chave = `${p.data_inicio}|${p.data_fim}|${p.company_id || ''}`;
                      const selected = selecaoPeriodo && `${selecaoPeriodo.data_inicio}|${selecaoPeriodo.data_fim}|${selecaoPeriodo.company_id || ''}` === chave;
                      return (
                        <tr key={chave}
                            onClick={() => setSelecaoPeriodo(p)}
                            onDoubleClick={() => editarPeriodo(p)}
                            className={`cursor-pointer ${selected ? 'bg-orange-100' : 'hover:bg-orange-50'}`}>
                          <td className="px-4 py-2">
                            <input type="radio" checked={!!selected} onChange={() => setSelecaoPeriodo(p)} />
                          </td>
                          <td className="px-4 py-2 font-semibold text-gray-700">
                            do dia <span className="text-orange-700">{fmtDataBR(p.data_inicio)}</span> ao dia <span className="text-orange-700">{fmtDataBR(p.data_fim)}</span>
                          </td>
                          <td className="px-4 py-2">
                            {p.mes_referencia ? (
                              <span className="inline-block px-2 py-0.5 rounded bg-orange-100 text-orange-800 text-xs font-bold">
                                {(() => {
                                  const [y, m] = p.mes_referencia.split('-');
                                  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                                  return `${nomes[parseInt(m) - 1] || m}/${y}`;
                                })()}
                              </span>
                            ) : <span className="text-gray-400 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-2">
                            {p.mes_caixa ? (
                              <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs font-bold">
                                {(() => {
                                  const [y, m] = p.mes_caixa.split('-');
                                  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                                  return `${nomes[parseInt(m) - 1] || m}/${y}`;
                                })()}
                              </span>
                            ) : <span className="text-gray-400 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-2 text-gray-700">
                            {p.empresa_apelido || p.empresa_nome || <span className="text-gray-400">— Todas —</span>}
                          </td>
                          <td className="px-4 py-2 text-center">{p.total_colaboradores}</td>
                          <td className="px-4 py-2 text-right font-semibold text-emerald-700">{fmtMoney(p.total_salario_bruto)}</td>
                          <td className="px-4 py-2 text-xs text-gray-600">
                            {(() => {
                              const d = p.ultima_alteracao;
                              if (!d) return '—';
                              const dt = new Date(d);
                              if (isNaN(dt.getTime())) return String(d).slice(0, 10);
                              return dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                            })()}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <button onClick={e => { e.stopPropagation(); excluirPeriodo(p); }}
                              className="text-red-600 hover:text-red-800 text-sm font-medium">
                              🗑️ Excluir
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Filtros — só quando na aba Apontamento */}
        {aba === 'apontar' && (
        <div className="bg-white border-b border-gray-200 p-3 md:p-4">
          <div className="grid grid-cols-2 md:grid-cols-8 gap-3 items-end">
            <div className="col-span-2">
              <label className="block text-xs font-bold uppercase text-gray-600 mb-1">🏪 Empresa</label>
              <select value={companyId} onChange={e => setCompanyId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                <option value="">Todas</option>
                {empresas.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.apelido ? `Loja ${e.cod_loja} - ${e.apelido}` : (e.label || e.nome_fantasia)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-600 mb-1">De</label>
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Até</label>
              <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-600 mb-1" title="Mês a que se refere a folha (ex: trabalho de 26/03 a 24/04 = competência Março)">📅 Mês Competência *</label>
              <input type="month" value={mesCompetencia} onChange={e => setMesCompetencia(e.target.value)}
                className="w-full border-2 border-orange-300 rounded-lg px-3 py-2 text-sm font-semibold" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-600 mb-1" title="Mês em que o pagamento entra no caixa (data de pagamento)">💰 Mês Caixa *</label>
              <input type="month" value={mesCaixa} onChange={e => setMesCaixa(e.target.value)}
                className="w-full border-2 border-emerald-300 rounded-lg px-3 py-2 text-sm font-semibold" />
            </div>
            <button onClick={carregar} disabled={loading}
              className={`px-4 py-2 rounded-lg text-sm font-bold text-white ${loading ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'}`}>
              {loading ? 'Carregando...' : '🔍 Carregar'}
            </button>
            <div className="flex gap-2 flex-wrap">
              <button onClick={salvarTudo} disabled={saving || rows.length === 0}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold text-white ${saving || rows.length === 0 ? 'bg-gray-300' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
                {saving ? 'Salvando...' : '💾 Gravar'}
              </button>
              <button onClick={() => exportar('pdf')} disabled={rows.length === 0}
                className="px-3 py-2 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-300">
                📄 PDF
              </button>
              <button onClick={() => exportar('excel')} disabled={rows.length === 0}
                className="px-3 py-2 rounded-lg text-sm font-bold text-white bg-green-700 hover:bg-green-800 disabled:bg-gray-300">
                📊 Excel
              </button>
              <button onClick={() => setShowNovaColuna(true)}
                className="px-3 py-2 rounded-lg text-sm font-bold text-white bg-purple-600 hover:bg-purple-700"
                title="Adicionar nova coluna de provento ou desconto">
                + Coluna
              </button>
            </div>
          </div>
        </div>
        )}

        {/* Tabela — só quando na aba Apontamento */}
        {aba === 'apontar' && (
        <div className="flex-1 overflow-auto p-3 md:p-4">
          {rows.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <div className="text-5xl mb-2">📋</div>
              <p className="font-semibold">Informe o período e clique em <strong>Carregar</strong></p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-auto max-h-[calc(100vh-280px)]">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-30">
                  <tr className="bg-gray-600 text-white">
                    <th className="px-2 py-2 text-left sticky left-0 bg-gray-600 z-40 min-w-[180px]" rowSpan={2}>Colaborador</th>
                    <th className="px-2 py-2 text-left bg-gray-600" rowSpan={2}>Cargo</th>
                    <th className="px-2 py-2 text-right bg-gray-600" rowSpan={2}>Salário</th>
                    {PROVENTOS.map(c => (
                      <th key={c.key} colSpan={2} className="px-2 py-1 text-center bg-emerald-700 border-l border-emerald-600" title={c.label}>
                        {c.label}
                      </th>
                    ))}
                    {extrasProventos.map(c => {
                      const showQtd = c.mostra_qtd !== false;
                      const showVal = c.mostra_valor !== false;
                      const span = (showQtd && showVal) ? 2 : 1;
                      return (
                        <th key={c.chave} colSpan={span}
                          className="px-2 py-1 text-center bg-emerald-800 min-w-[80px] relative group"
                          title={c.label} rowSpan={span === 2 ? 1 : 2}>
                          {c.label}
                          <button onClick={() => deletarColuna(c.id)} className="absolute top-0 right-0 text-[10px] px-1 opacity-0 group-hover:opacity-100 hover:text-red-200" title="Remover">✖</button>
                        </th>
                      );
                    })}
                    {DESCONTOS.map(c => (
                      <th key={c.key} colSpan={2} className="px-2 py-1 text-center bg-rose-700 border-l border-rose-600" title={c.label}>
                        {c.label}
                      </th>
                    ))}
                    {extrasDescontos.map(c => (
                      <th key={c.chave} className="px-2 py-2 text-center bg-rose-800 min-w-[80px] relative group" title={c.label} rowSpan={2}>
                        {c.label}
                        <button onClick={() => deletarColuna(c.id)} className="absolute top-0 right-0 text-[10px] px-1 opacity-0 group-hover:opacity-100 hover:text-rose-200" title="Remover">✖</button>
                      </th>
                    ))}
                    <th className="px-2 py-2 text-right bg-amber-600" rowSpan={2} title="Salário + total de proventos (antes dos descontos)">Bruto</th>
                    <th className="px-2 py-2 text-right bg-blue-700" rowSpan={2}>Líquido</th>
                    <th className="px-2 py-2 text-left min-w-[150px]" rowSpan={2}>Obs</th>
                  </tr>
                  <tr className="bg-gray-500 text-white text-xs">
                    {PROVENTOS.map(c => (
                      <Fragment key={c.key}>
                        <th className="px-1 py-1 text-center bg-emerald-600 min-w-[60px] font-normal">QTD</th>
                        <th className="px-1 py-1 text-center bg-emerald-500 min-w-[70px] font-bold">R$</th>
                      </Fragment>
                    ))}
                    {extrasProventos.filter(c => c.mostra_qtd !== false && c.mostra_valor !== false).map(c => (
                      <Fragment key={`sub-${c.chave}`}>
                        <th className="px-1 py-1 text-center bg-emerald-700 min-w-[60px] font-normal">QTD</th>
                        <th className="px-1 py-1 text-center bg-emerald-600 min-w-[70px] font-bold">R$</th>
                      </Fragment>
                    ))}
                    {DESCONTOS.map(c => (
                      <Fragment key={c.key}>
                        <th className="px-1 py-1 text-center bg-rose-600 min-w-[60px] font-normal">QTD</th>
                        <th className="px-1 py-1 text-center bg-rose-500 min-w-[70px] font-bold">R$</th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r, idx) => {
                    const t = totais(r);
                    return (
                      <tr key={r.colaborador_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-2 py-1 font-semibold sticky left-0 bg-inherit z-10">
                          <div>{r.nome}</div>
                          <div className="text-xs text-gray-400">Mat. {r.matricula || '-'}</div>
                        </td>
                        <td className="px-2 py-1 text-gray-600">{r.cargo_nome || '-'}</td>
                        <td className="px-2 py-1 text-right font-semibold text-gray-700">{fmtMoney(r.salario)}</td>
                        {PROVENTOS.map(c => (
                          <Fragment key={c.key}>
                            <td className="px-1 py-1 bg-emerald-50/30 border-l border-emerald-200">
                              <input type="text" inputMode="decimal" value={displayVal(r[c.key])}
                                onChange={e => updateCell(r.colaborador_id, c.key, e.target.value)}
                                className="w-full px-1 py-1 text-right border border-transparent hover:border-gray-300 focus:border-orange-400 rounded bg-transparent focus:bg-white focus:outline-none"
                                placeholder="" />
                            </td>
                            <td className="px-1 py-1 bg-emerald-100/40">
                              {(() => {
                                const v = displayVal(r.campos_extras?.[`${c.key}_valor`]);
                                const invalido = !isValorValido(v);
                                return (
                                  <input type="text" inputMode="decimal" value={v}
                                    onChange={e => updateExtra(r.colaborador_id, `${c.key}_valor`, e.target.value)}
                                    className={`w-full px-1 py-1 text-right border rounded focus:outline-none font-semibold ${invalido ? 'border-red-500 bg-red-100 text-red-700 animate-pulse' : 'border-transparent hover:border-gray-300 focus:border-orange-400 bg-transparent focus:bg-white text-emerald-800'}`}
                                    placeholder="R$ 0,00" />
                                );
                              })()}
                            </td>
                          </Fragment>
                        ))}
                        {extrasProventos.map(c => {
                          const showQtd = c.mostra_qtd !== false;
                          const showVal = c.mostra_valor !== false;
                          return (
                            <Fragment key={c.chave}>
                              {showQtd && (
                                <td className="px-1 py-1 bg-emerald-50/30">
                                  <input type="text" inputMode="decimal"
                                    value={displayVal(r.campos_extras?.[c.chave])}
                                    onChange={e => updateExtra(r.colaborador_id, c.chave, e.target.value)}
                                    className="w-full px-1 py-1 text-right border border-transparent hover:border-gray-300 focus:border-orange-400 rounded bg-transparent focus:bg-white focus:outline-none"
                                    placeholder="" />
                                </td>
                              )}
                              {showVal && (
                                <td className="px-1 py-1 bg-emerald-100/40">
                                  {(() => {
                                    const v = displayVal(r.campos_extras?.[`${c.chave}_valor`]);
                                    const inv = !isValorValido(v);
                                    return (
                                      <input type="text" inputMode="decimal" value={v}
                                        onChange={e => updateExtra(r.colaborador_id, `${c.chave}_valor`, e.target.value)}
                                        className={`w-full px-1 py-1 text-right border rounded focus:outline-none font-semibold ${inv ? 'border-red-500 bg-red-100 text-red-700 animate-pulse' : 'border-transparent hover:border-gray-300 focus:border-orange-400 bg-transparent focus:bg-white text-emerald-800'}`}
                                        placeholder="R$ 0,00" />
                                    );
                                  })()}
                                </td>
                              )}
                            </Fragment>
                          );
                        })}
                        {DESCONTOS.map(c => (
                          <Fragment key={c.key}>
                            <td className="px-1 py-1 bg-rose-50/30 border-l border-rose-200">
                              <input type="text" inputMode="decimal" value={displayVal(r[c.key])}
                                onChange={e => updateCell(r.colaborador_id, c.key, e.target.value)}
                                className="w-full px-1 py-1 text-right border border-transparent hover:border-gray-300 focus:border-orange-400 rounded bg-transparent focus:bg-white focus:outline-none"
                                placeholder="" />
                            </td>
                            <td className="px-1 py-1 bg-rose-100/40">
                              {(() => {
                                const v = displayVal(r.campos_extras?.[`${c.key}_valor`]);
                                const inv = !isValorValido(v);
                                return (
                                  <input type="text" inputMode="decimal" value={v}
                                    onChange={e => updateExtra(r.colaborador_id, `${c.key}_valor`, e.target.value)}
                                    className={`w-full px-1 py-1 text-right border rounded focus:outline-none font-semibold ${inv ? 'border-red-500 bg-red-100 text-red-700 animate-pulse' : 'border-transparent hover:border-gray-300 focus:border-orange-400 bg-transparent focus:bg-white text-rose-800'}`}
                                    placeholder="R$ 0,00" />
                                );
                              })()}
                            </td>
                          </Fragment>
                        ))}
                        {extrasDescontos.map(c => {
                          const showQtd = c.mostra_qtd !== false;
                          const showVal = c.mostra_valor !== false;
                          return (
                            <Fragment key={c.chave}>
                              {showQtd && (
                                <td className="px-1 py-1 bg-rose-50/30">
                                  <input type="text" inputMode="decimal"
                                    value={displayVal(r.campos_extras?.[c.chave])}
                                    onChange={e => updateExtra(r.colaborador_id, c.chave, e.target.value)}
                                    className="w-full px-1 py-1 text-right border border-transparent hover:border-gray-300 focus:border-orange-400 rounded bg-transparent focus:bg-white focus:outline-none"
                                    placeholder="" />
                                </td>
                              )}
                              {showVal && (
                                <td className="px-1 py-1 bg-rose-100/40">
                                  {(() => {
                                    const v = displayVal(r.campos_extras?.[`${c.chave}_valor`]);
                                    const inv = !isValorValido(v);
                                    return (
                                      <input type="text" inputMode="decimal" value={v}
                                        onChange={e => updateExtra(r.colaborador_id, `${c.chave}_valor`, e.target.value)}
                                        className={`w-full px-1 py-1 text-right border rounded focus:outline-none font-semibold ${inv ? 'border-red-500 bg-red-100 text-red-700 animate-pulse' : 'border-transparent hover:border-gray-300 focus:border-orange-400 bg-transparent focus:bg-white text-rose-800'}`}
                                        placeholder="R$ 0,00" />
                                    );
                                  })()}
                                </td>
                              )}
                            </Fragment>
                          );
                        })}
                        <td className="px-2 py-1 text-right font-bold text-amber-700 bg-amber-50/40 whitespace-nowrap">
                          {fmtMoney(t.bruto)}
                        </td>
                        <td className="px-2 py-1 text-right font-bold text-blue-700 bg-blue-50/30 whitespace-nowrap">
                          {fmtMoney(t.liq)}
                        </td>
                        <td className="px-1 py-1">
                          <input type="text" value={r.observacao || ''}
                            onChange={e => updateCell(r.colaborador_id, 'observacao', e.target.value)}
                            className="w-full px-2 py-1 border border-transparent hover:border-gray-300 focus:border-orange-400 rounded bg-transparent focus:bg-white focus:outline-none text-xs" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-bold text-sm">
                    <td colSpan={3} className="px-2 py-2 text-right">TOTAIS:</td>
                    {PROVENTOS.map(c => (
                      <Fragment key={c.key}>
                        <td className="px-2 py-2 text-right bg-emerald-50">
                          {rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0).toFixed(2)}
                        </td>
                        <td className="px-2 py-2 text-right bg-emerald-100 text-emerald-800">
                          {fmtMoney(rows.reduce((s, r) => s + (Number(r.campos_extras?.[`${c.key}_valor`]) || 0), 0))}
                        </td>
                      </Fragment>
                    ))}
                    {extrasProventos.map(c => {
                      const showQtd = c.mostra_qtd !== false;
                      const showVal = c.mostra_valor !== false;
                      return (
                        <Fragment key={c.chave}>
                          {showQtd && (
                            <td className="px-2 py-2 text-right bg-emerald-50">
                              {rows.reduce((s, r) => s + (Number(r.campos_extras?.[c.chave]) || 0), 0).toFixed(2)}
                            </td>
                          )}
                          {showVal && (
                            <td className="px-2 py-2 text-right bg-emerald-100 text-emerald-800">
                              {fmtMoney(rows.reduce((s, r) => s + (Number(r.campos_extras?.[`${c.chave}_valor`]) || 0), 0))}
                            </td>
                          )}
                        </Fragment>
                      );
                    })}
                    {DESCONTOS.map(c => (
                      <Fragment key={c.key}>
                        <td className="px-2 py-2 text-right bg-rose-50">
                          {rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0).toFixed(2)}
                        </td>
                        <td className="px-2 py-2 text-right bg-rose-100 text-rose-800">
                          {fmtMoney(rows.reduce((s, r) => s + (Number(r.campos_extras?.[`${c.key}_valor`]) || 0), 0))}
                        </td>
                      </Fragment>
                    ))}
                    {extrasDescontos.map(c => {
                      const showQtd = c.mostra_qtd !== false;
                      const showVal = c.mostra_valor !== false;
                      return (
                        <Fragment key={c.chave}>
                          {showQtd && (
                            <td className="px-2 py-2 text-right bg-rose-50">
                              {rows.reduce((s, r) => s + (Number(r.campos_extras?.[c.chave]) || 0), 0).toFixed(2)}
                            </td>
                          )}
                          {showVal && (
                            <td className="px-2 py-2 text-right bg-rose-100 text-rose-800">
                              {fmtMoney(rows.reduce((s, r) => s + (Number(r.campos_extras?.[`${c.chave}_valor`]) || 0), 0))}
                            </td>
                          )}
                        </Fragment>
                      );
                    })}
                    <td className="px-2 py-2 text-right bg-amber-100 text-amber-800">
                      {fmtMoney(rows.reduce((s, r) => s + totais(r).bruto, 0))}
                    </td>
                    <td className="px-2 py-2 text-right bg-blue-100">
                      {fmtMoney(rows.reduce((s, r) => s + totais(r).liq, 0))}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
        )}
      </div>

      {/* Modal Nova Coluna */}
      {showNovaColuna && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">+ Nova Coluna</h3>
              <p className="text-xs text-gray-500">Cria uma coluna extra de provento ou desconto</p>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Nome da Coluna</label>
                <input type="text" value={novaLabel}
                  onChange={e => setNovaLabel(e.target.value.toUpperCase())}
                  style={{ textTransform: 'uppercase' }}
                  placeholder="Ex: GRATIFICAÇÃO, CESTA BÁSICA..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Tipo</label>
                <div className="grid grid-cols-2 gap-2">
                  <label className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer ${novoTipo === 'provento' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200'}`}>
                    <input type="radio" value="provento" checked={novoTipo === 'provento'}
                      onChange={e => setNovoTipo(e.target.value)} className="accent-emerald-500" />
                    <span className="font-bold text-emerald-700">💰 Provento</span>
                  </label>
                  <label className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer ${novoTipo === 'desconto' ? 'border-rose-500 bg-rose-50' : 'border-gray-200'}`}>
                    <input type="radio" value="desconto" checked={novoTipo === 'desconto'}
                      onChange={e => setNovoTipo(e.target.value)} className="accent-rose-500" />
                    <span className="font-bold text-rose-700">📉 Desconto</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 mb-1">O que vai ter na coluna?</label>
                <div className="grid grid-cols-2 gap-2">
                  <label className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer ${novoMostraQtd ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                    <input type="checkbox" checked={novoMostraQtd}
                      onChange={e => setNovoMostraQtd(e.target.checked)} className="accent-blue-500 w-4 h-4" />
                    <span className="font-bold text-blue-700">📊 QTD (quantidade)</span>
                  </label>
                  <label className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer ${novoMostraValor ? 'border-amber-500 bg-amber-50' : 'border-gray-200'}`}>
                    <input type="checkbox" checked={novoMostraValor}
                      onChange={e => setNovoMostraValor(e.target.checked)} className="accent-amber-500 w-4 h-4" />
                    <span className="font-bold text-amber-700">💵 R$ (valor)</span>
                  </label>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">Marque os 2 pra ter QTD e R$ lado a lado.</p>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => { setShowNovaColuna(false); setNovaLabel(''); }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold">
                Cancelar
              </button>
              <button onClick={criarColuna} disabled={!novaLabel.trim()}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold disabled:bg-gray-300">
                Criar Coluna
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
