import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

const NOMES_MES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS_SEM  = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];

// Cor de fundo do card por loja — paleta suave, ciclo pelo id da empresa
const CORES_LOJA = [
  { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' }, // âmbar
  { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' }, // azul
  { bg: '#dcfce7', border: '#22c55e', text: '#166534' }, // verde
  { bg: '#fce7f3', border: '#ec4899', text: '#9d174d' }, // rosa
  { bg: '#ede9fe', border: '#8b5cf6', text: '#5b21b6' }, // roxo
  { bg: '#ffedd5', border: '#f97316', text: '#9a3412' }, // laranja
];

export default function RhTreinamentosCalendario() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth()); // 0-11
  const [treinamentos, setTreinamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [empresaFiltro, setEmpresaFiltro] = useState('');
  const [empresas, setEmpresas] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [trei, emp] = await Promise.all([
          api.get('/rh/treinamentos'),
          api.get('/rh/empresas'),
        ]);
        const asArray = (resp, key) => {
          const d = resp?.data;
          if (Array.isArray(d)) return d;
          if (key && Array.isArray(d?.[key])) return d[key];
          if (Array.isArray(d?.data)) return d.data;
          return [];
        };
        setTreinamentos(asArray(trei));
        const empList = asArray(emp, 'empresas');
        setEmpresas(empList);
        // Default da loja: principal (isPrincipal=true) OU primeira da lista.
        // Filtro sempre cai numa loja especifica — assim o calendario nao
        // bagunca misturando treinamentos de varias lojas.
        if (empList.length > 0) {
          const principal = empList.find(x => x.isPrincipal) || empList[0];
          setEmpresaFiltro(String(principal.id));
        }
      } catch (e) {
        toast.error('Erro ao carregar calendário');
        console.error(e);
      } finally { setLoading(false); }
    })();
  }, []);

  // Mapeia treinamento → dia(s) do mês visível.
  // Aceita data como string 'YYYY-MM-DD', string ISO ('...T00:00:00.000Z') ou
  // Date object (PG driver as vezes retorna Date para colunas DATE).
  const parseData = (d) => {
    if (!d) return null;
    if (d instanceof Date) return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const s = String(d);
    // Extrai YYYY-MM-DD do inicio da string (ignora tempo/timezone)
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
    const parsed = new Date(s);
    return isNaN(parsed.getTime()) ? null : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  };

  const treinamentosPorDia = useMemo(() => {
    const map = {}; // { 'YYYY-MM-DD': [treinamento, ...] }
    const primeiro = new Date(ano, mes, 1);
    const ultimo = new Date(ano, mes + 1, 0);
    treinamentos.forEach((t) => {
      if (empresaFiltro && String(t.empresa_id) !== empresaFiltro) return;
      const inicio = parseData(t.data_inicio);
      const fim = parseData(t.data_fim) || inicio;
      if (!inicio) return;
      const a = inicio < primeiro ? primeiro : inicio;
      const b = fim > ultimo ? ultimo : fim;
      const cursor = new Date(a);
      while (cursor <= b) {
        const k = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
        if (!map[k]) map[k] = [];
        map[k].push(t);
        cursor.setDate(cursor.getDate() + 1);
      }
    });
    return map;
  }, [treinamentos, ano, mes, empresaFiltro]);

  // Monta 6 semanas x 7 dias = matriz do calendário começando no domingo
  const grid = useMemo(() => {
    const primeiro = new Date(ano, mes, 1);
    const inicioGrid = new Date(primeiro);
    inicioGrid.setDate(primeiro.getDate() - primeiro.getDay()); // recua até domingo
    const dias = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(inicioGrid);
      d.setDate(inicioGrid.getDate() + i);
      dias.push(d);
    }
    return dias;
  }, [ano, mes]);

  const navegar = (delta) => {
    const novoMes = mes + delta;
    if (novoMes < 0) { setMes(11); setAno(ano - 1); }
    else if (novoMes > 11) { setMes(0); setAno(ano + 1); }
    else setMes(novoMes);
  };

  const corLoja = (empresaId) => {
    if (!empresaId) return { bg: '#f3f4f6', border: '#9ca3af', text: '#374151' };
    // empresa_id e UUID (string) — converte pra numero estavel via soma de char codes
    const s = String(empresaId);
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i)) | 0;
    return CORES_LOJA[Math.abs(h) % CORES_LOJA.length];
  };

  const formatHora = (h) => h ? String(h).substring(0, 5) : '';

  const isMesmoMes = (d) => d.getMonth() === mes && d.getFullYear() === ano;
  const isHoje = (d) => {
    const h = new Date();
    return d.getDate() === h.getDate() && d.getMonth() === h.getMonth() && d.getFullYear() === h.getFullYear();
  };

  const imprimir = () => {
    // Monta HTML estático do calendário do mês atual e abre janela de impressão.
    // Layout A4 paisagem com células grandes pra colar na parede.
    const w = window.open('', '_blank');
    if (!w) return;
    const semanas = [];
    for (let i = 0; i < 6; i++) semanas.push(grid.slice(i * 7, (i + 1) * 7));
    const linhasHtml = semanas.map(semana => {
      const tds = semana.map(d => {
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const lista = treinamentosPorDia[k] || [];
        const dimm = isMesmoMes(d) ? '' : 'opacity:.35;';
        const itens = lista.slice(0, 4).map(t => {
          const c = corLoja(t.empresa_id);
          const hr = formatHora(t.hora_inicio);
          const hrTxt = hr ? `${hr} · ` : '';
          const empresa = (t.empresa_nome || '').slice(0, 18);
          const tema = (t.nome_treinamento || '').slice(0, 38);
          return `<div style="background:${c.bg};border-left:3px solid ${c.border};color:${c.text};padding:2px 4px;margin-bottom:2px;border-radius:2px;font-size:8pt;line-height:1.15">
            <div style="font-weight:700">${hrTxt}${tema}</div>
            <div style="font-size:7pt;opacity:.85">${empresa}</div>
          </div>`;
        }).join('');
        const extra = lista.length > 4 ? `<div style="font-size:7pt;color:#6b7280">+${lista.length - 4} mais</div>` : '';
        return `<td style="border:1px solid #d1d5db;vertical-align:top;padding:4px;height:135px;width:14.28%;${dimm}">
          <div style="font-weight:700;font-size:11pt;color:#374151;margin-bottom:3px">${d.getDate()}</div>
          ${itens}${extra}
        </td>`;
      }).join('');
      return `<tr>${tds}</tr>`;
    }).join('');
    const empresaTxt = empresaFiltro ? ` — ${empresas.find(e => String(e.id) === empresaFiltro)?.razao_social || ''}` : '';
    w.document.write(`<!DOCTYPE html><html><head><title>Calendário de Treinamentos — ${NOMES_MES[mes]} ${ano}</title>
      <style>
        @page { size: A4 landscape; margin: 10mm }
        body { font-family: Arial, sans-serif; color:#111; margin:0 }
        h1 { font-size: 18pt; margin: 0 0 4px; text-align:center }
        .sub { text-align:center; font-size:10pt; color:#6b7280; margin-bottom:8px }
        table { width:100%; border-collapse:collapse; table-layout:fixed }
        th { background:#f3f4f6; border:1px solid #d1d5db; font-size:10pt; padding:4px; text-align:center }
      </style></head><body>
      <h1>${NOMES_MES[mes]} de ${ano}${empresaTxt}</h1>
      <div class="sub">Calendário de Treinamentos</div>
      <table>
        <thead><tr>${DIAS_SEM.map(d => `<th>${d}</th>`).join('')}</tr></thead>
        <tbody>${linhasHtml}</tbody>
      </table>
      <script>window.onload=()=>{window.print()}</script>
    </body></html>`);
    w.document.close();
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold">📅 Calendário de Treinamentos</h1>
              <p className="text-orange-100 text-sm mt-1">Visão mensal — pronta pra imprimir e colar na sala</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => navigate('/rh/treinamentos')}
                className="bg-white/20 hover:bg-white/30 text-white border border-white/40 px-4 py-2 rounded-lg text-sm font-semibold transition">
                ← Voltar
              </button>
              <button onClick={imprimir}
                className="bg-white text-orange-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-50 transition flex items-center gap-1">
                🖨️ Imprimir / PDF
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6">
          {/* Toolbar */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <button onClick={() => navegar(-1)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded font-bold text-gray-700">←</button>
              <div className="text-lg font-bold text-gray-800 min-w-[180px] text-center">{NOMES_MES[mes]} de {ano}</div>
              <button onClick={() => navegar(1)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded font-bold text-gray-700">→</button>
              <button onClick={() => { setMes(hoje.getMonth()); setAno(hoje.getFullYear()); }}
                className="ml-2 px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded text-xs font-semibold">
                HOJE
              </button>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-gray-700">Loja:</label>
              <select value={empresaFiltro} onChange={(e) => setEmpresaFiltro(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded text-base font-medium min-w-[280px]">
                {empresas.map(e => (
                  <option key={e.id} value={e.id}>{e.apelido || e.nomeFantasia || e.razaoSocial || '(sem nome)'}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Grid do calendário */}
          {loading ? (
            <div className="text-center py-20 text-gray-400">Carregando treinamentos...</div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {/* Cabeçalho dias */}
              <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
                {DIAS_SEM.map(d => (
                  <div key={d} className="text-center text-xs font-bold text-gray-600 py-2 border-r last:border-r-0 border-gray-200">{d}</div>
                ))}
              </div>
              {/* 6 semanas */}
              <div className="grid grid-cols-7" style={{ gridAutoRows: 'minmax(120px, 1fr)' }}>
                {grid.map((d, idx) => {
                  const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  const lista = treinamentosPorDia[k] || [];
                  const fora = !isMesmoMes(d);
                  const hojeFlag = isHoje(d);
                  return (
                    <div key={idx}
                      className={`border-r border-b border-gray-200 p-1.5 ${fora ? 'bg-gray-50' : 'bg-white'} ${hojeFlag ? 'ring-2 ring-orange-400 ring-inset' : ''}`}
                      style={(idx + 1) % 7 === 0 ? { borderRight: 'none' } : undefined}>
                      <div className={`text-xs font-bold mb-1 ${fora ? 'text-gray-300' : hojeFlag ? 'text-orange-600' : 'text-gray-700'}`}>
                        {d.getDate()}
                      </div>
                      <div className="space-y-1">
                        {lista.slice(0, 4).map(t => {
                          const c = corLoja(t.empresa_id);
                          const hr = formatHora(t.hora_inicio);
                          return (
                            <div key={t.id} title={`${t.nome_treinamento}\n${t.colaborador_nome || ''}\n${t.empresa_nome || ''}`}
                              className="text-[10px] px-1.5 py-1 rounded leading-tight cursor-pointer hover:opacity-80"
                              style={{ background: c.bg, borderLeft: `3px solid ${c.border}`, color: c.text }}
                              onClick={() => navigate('/rh/treinamentos')}>
                              <div className="font-bold truncate">
                                {hr && <span className="opacity-75">{hr} </span>}
                                {t.nome_treinamento}
                              </div>
                              {t.colaborador_nome && (
                                <div className="opacity-75 truncate">{t.colaborador_nome}</div>
                              )}
                            </div>
                          );
                        })}
                        {lista.length > 4 && (
                          <div className="text-[9px] text-gray-500 font-semibold pl-1">+{lista.length - 4} mais</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
