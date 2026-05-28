import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import toast from 'react-hot-toast';

/**
 * Ficha de Admissão (1ª FASE CONTRATAÇÃO).
 * - RH cria uma ficha com dados de contratação usando dropdowns dos cadastros.
 * - Gera link público pro candidato preencher dados pessoais (FASE B).
 * - Depois vira colaborador com 1 clique (FASE B).
 */
export default function FichasAdmissaoSection() {
  const [fichas, setFichas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [fichaEditando, setFichaEditando] = useState(null);

  // Cadastros (dropdowns)
  const [empresas, setEmpresas] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
  const [jornadas, setJornadas] = useState([]);
  const [escalas, setEscalas] = useState([]);
  const [escalasDomingo, setEscalasDomingo] = useState([]);
  const [regimes, setRegimes] = useState([]);
  const [prazos, setPrazos] = useState([]);
  const [formasPgto, setFormasPgto] = useState([]);

  const carregarFichas = async () => {
    try {
      const r = await api.get('/rh/fichas-admissao');
      setFichas(Array.isArray(r.data) ? r.data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const carregarCadastros = async () => {
    try {
      const [emp, ca, dep, jo, es, ed, re, pr, fp] = await Promise.all([
        api.get('/rh/empresas').catch(() => ({ data: [] })),
        api.get('/rh/configuracoes/cargos').catch(() => ({ data: [] })),
        api.get('/rh/configuracoes/departamentos').catch(() => ({ data: [] })),
        api.get('/rh/configuracoes/jornadas').catch(() => ({ data: [] })),
        api.get('/rh/configuracoes/escalas').catch(() => ({ data: [] })),
        api.get('/rh/configuracoes/escalas-domingo').catch(() => ({ data: [] })),
        api.get('/rh/configuracoes/regimes-trabalho').catch(() => ({ data: [] })),
        api.get('/rh/configuracoes/prazos-experiencia').catch(() => ({ data: [] })),
        api.get('/rh/configuracoes/formas-pagamento').catch(() => ({ data: [] })),
      ]);
      const arr = d => Array.isArray(d?.data) ? d.data : [];
      setEmpresas(arr(emp));
      setCargos(arr(ca));
      setDepartamentos(arr(dep));
      setJornadas(arr(jo));
      setEscalas(arr(es));
      setEscalasDomingo(arr(ed));
      setRegimes(arr(re));
      setPrazos(arr(pr));
      setFormasPgto(arr(fp));
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    carregarFichas();
    carregarCadastros();
  }, []);

  const novaFicha = () => {
    setFichaEditando({
      candidato_nome: '', candidato_email: '', candidato_celular: '',
      company_id: empresas.length === 1 ? empresas[0].id : '',
      data_admissao: '', cargo_id: '', departamento_id: '', jornada_id: '',
      escala_id: '', escala_domingo_id: '', regime_trabalho_id: '',
      prazo_experiencia_id: '', forma_pagamento_id: '', salario: '',
      horario_entrada: '', horario_intervalo: '', horario_saida: '',
      primeiro_emprego: false, contribuicao_sindical: false, vale_transporte: false,
    });
    setModalAberto(true);
  };

  const abrirFicha = (f) => { setFichaEditando({ ...f }); setModalAberto(true); };

  const salvar = async () => {
    const f = fichaEditando;
    if (!f.candidato_nome?.trim()) { toast.error('Nome do candidato é obrigatório'); return; }
    try {
      // Limpa strings vazias pra null (FKs)
      const payload = { ...f };
      ['company_id','cargo_id','departamento_id','jornada_id','escala_id','escala_domingo_id',
       'regime_trabalho_id','prazo_experiencia_id','forma_pagamento_id','data_admissao','salario'
      ].forEach(k => { if (payload[k] === '') payload[k] = null; });

      if (f.id) {
        await api.put(`/rh/fichas-admissao/${f.id}`, payload);
        toast.success('Ficha atualizada');
      } else {
        await api.post('/rh/fichas-admissao', payload);
        toast.success('Ficha criada');
      }
      setModalAberto(false);
      setFichaEditando(null);
      carregarFichas();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Erro ao salvar');
    }
  };

  const excluir = async (id) => {
    if (!window.confirm('Excluir esta ficha?')) return;
    try {
      await api.delete(`/rh/fichas-admissao/${id}`);
      toast.success('Excluída');
      carregarFichas();
    } catch (e) { toast.error('Erro ao excluir'); }
  };

  const gerarLink = async (id) => {
    try {
      const r = await api.post(`/rh/fichas-admissao/${id}/gerar-link`);
      const url = `${window.location.origin}/admissao/${r.data.public_token}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success('Link gerado e copiado!');
      window.prompt('Link do candidato (Ctrl+C pra copiar):', url);
      carregarFichas();
    } catch (e) { toast.error('Erro ao gerar link'); }
  };

  const statusBadge = (status) => {
    const map = {
      rascunho:              { label: 'Rascunho',          cls: 'bg-gray-200 text-gray-700' },
      aguardando_candidato:  { label: 'Aguardando candidato', cls: 'bg-amber-100 text-amber-800' },
      preenchida:            { label: 'Preenchida',       cls: 'bg-blue-100 text-blue-800' },
      colaborador_criado:    { label: 'Colaborador criado', cls: 'bg-emerald-100 text-emerald-800' },
      cancelada:             { label: 'Cancelada',          cls: 'bg-red-100 text-red-700' },
    };
    const m = map[status] || map.rascunho;
    return <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${m.cls}`}>{m.label}</span>;
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Carregando fichas...</div>;

  return (
    <div className="space-y-3">
      {/* Header com botão Nova Ficha */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-bold text-gray-800">📋 Fichas de Admissão</h3>
            <p className="text-xs text-gray-500">RH preenche os dados de contratação; o candidato completa dados pessoais via link.</p>
          </div>
          <button onClick={novaFicha}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-4 py-2 rounded text-sm shadow">
            + Nova Ficha
          </button>
        </div>

        {fichas.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            Nenhuma ficha criada ainda. Clique em <strong>+ Nova Ficha</strong> pra começar.
          </div>
        ) : (
          <div className="space-y-2">
            {fichas.map(f => (
              <div key={f.id} className="border border-gray-200 rounded-lg p-3 hover:border-emerald-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-gray-800 truncate">{f.candidato_nome}</span>
                      {statusBadge(f.status)}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {[f.cargo_nome, f.empresa_nome, f.data_admissao ? `Admissão: ${new Date(f.data_admissao).toLocaleDateString('pt-BR')}` : null]
                        .filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => abrirFicha(f)}
                      className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded font-semibold">✏️ Editar</button>
                    <button onClick={() => gerarLink(f.id)}
                      className="text-xs px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded font-semibold">🔗 Link</button>
                    <button onClick={() => excluir(f.id)}
                      className="text-xs px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded font-semibold">🗑️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalAberto && fichaEditando && (
        <FichaAdmissaoModal
          ficha={fichaEditando} setFicha={setFichaEditando}
          empresas={empresas} cargos={cargos} departamentos={departamentos}
          jornadas={jornadas} escalas={escalas} escalasDomingo={escalasDomingo}
          regimes={regimes} prazos={prazos} formasPgto={formasPgto}
          onSalvar={salvar} onFechar={() => { setModalAberto(false); setFichaEditando(null); }}
        />
      )}
    </div>
  );
}

// ============================================================
// Modal do formulário da ficha
// ============================================================
function FichaAdmissaoModal({ ficha, setFicha, empresas, cargos, departamentos, jornadas, escalas, escalasDomingo, regimes, prazos, formasPgto, onSalvar, onFechar }) {
  const set = (k, v) => setFicha({ ...ficha, [k]: v });

  const labelCls = 'block text-xs font-semibold uppercase text-gray-600 mb-1';
  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500';
  const selectCls = inputCls;
  const sectionCls = 'bg-white border border-gray-200 rounded-lg p-4';

  const optList = (arr, lblKey = 'nome') => (arr || []).map(o => (
    <option key={o.id} value={o.id}>{o[lblKey] || o.nome || o.label || `#${o.id}`}</option>
  ));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">{ficha.id ? 'Editar Ficha de Admissão' : 'Nova Ficha de Admissão'}</h3>
            <p className="text-xs text-gray-500">Preencha o que você sabe agora — o candidato completa os dados pessoais via link.</p>
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 bg-gray-50 space-y-4">
          {/* Candidato */}
          <div className={sectionCls}>
            <h4 className="text-sm font-bold text-gray-700 mb-3">Candidato</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-3">
                <label className={labelCls}>Nome completo *</label>
                <input className={inputCls} value={ficha.candidato_nome || ''} onChange={e => set('candidato_nome', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>E-mail</label>
                <input type="email" className={inputCls} value={ficha.candidato_email || ''} onChange={e => set('candidato_email', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Celular</label>
                <input className={inputCls} value={ficha.candidato_celular || ''} onChange={e => set('candidato_celular', e.target.value)} placeholder="(00) 00000-0000" />
              </div>
              <div>
                <label className={labelCls}>Empresa</label>
                <select className={selectCls} value={ficha.company_id || ''} onChange={e => set('company_id', e.target.value)}>
                  <option value="">— Selecione —</option>
                  {(empresas || []).map(e => <option key={e.id} value={e.id}>{e.apelido || e.nome_fantasia || e.razao_social || `#${e.id}`}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Dados Admissão */}
          <div className={sectionCls}>
            <h4 className="text-sm font-bold text-gray-700 mb-3">Dados Admissão</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Data de Admissão</label>
                <input type="date" className={inputCls} value={ficha.data_admissao || ''} onChange={e => set('data_admissao', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Cargo / Função</label>
                <select className={selectCls} value={ficha.cargo_id || ''} onChange={e => set('cargo_id', e.target.value)}>
                  <option value="">— Selecione —</option>{optList(cargos)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Departamento</label>
                <select className={selectCls} value={ficha.departamento_id || ''} onChange={e => set('departamento_id', e.target.value)}>
                  <option value="">— Selecione —</option>{optList(departamentos)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Salário</label>
                <input type="number" step="0.01" className={inputCls} value={ficha.salario || ''} onChange={e => set('salario', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Prazo de Experiência</label>
                <select className={selectCls} value={ficha.prazo_experiencia_id || ''} onChange={e => set('prazo_experiencia_id', e.target.value)}>
                  <option value="">— Selecione —</option>{optList(prazos)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Forma de Pagamento</label>
                <select className={selectCls} value={ficha.forma_pagamento_id || ''} onChange={e => set('forma_pagamento_id', e.target.value)}>
                  <option value="">— Selecione —</option>{optList(formasPgto)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Regime de Trabalho</label>
                <select className={selectCls} value={ficha.regime_trabalho_id || ''} onChange={e => set('regime_trabalho_id', e.target.value)}>
                  <option value="">— Selecione —</option>{optList(regimes)}
                </select>
              </div>
            </div>
          </div>

          {/* Horário */}
          <div className={sectionCls}>
            <h4 className="text-sm font-bold text-gray-700 mb-3">Horário de Trabalho</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Entrada</label>
                <input type="time" className={inputCls} value={ficha.horario_entrada || ''} onChange={e => set('horario_entrada', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Intervalo</label>
                <input className={inputCls} value={ficha.horario_intervalo || ''} onChange={e => set('horario_intervalo', e.target.value)} placeholder="ex: 12:00 às 13:00" />
              </div>
              <div>
                <label className={labelCls}>Saída</label>
                <input type="time" className={inputCls} value={ficha.horario_saida || ''} onChange={e => set('horario_saida', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Jornada</label>
                <select className={selectCls} value={ficha.jornada_id || ''} onChange={e => set('jornada_id', e.target.value)}>
                  <option value="">— Selecione —</option>{optList(jornadas)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Escala</label>
                <select className={selectCls} value={ficha.escala_id || ''} onChange={e => set('escala_id', e.target.value)}>
                  <option value="">— Selecione —</option>{optList(escalas)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Escala Domingo</label>
                <select className={selectCls} value={ficha.escala_domingo_id || ''} onChange={e => set('escala_domingo_id', e.target.value)}>
                  <option value="">— Selecione —</option>{optList(escalasDomingo)}
                </select>
              </div>
            </div>
          </div>

          {/* Opções */}
          <div className={sectionCls}>
            <h4 className="text-sm font-bold text-gray-700 mb-3">Opções</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!ficha.primeiro_emprego} onChange={e => set('primeiro_emprego', e.target.checked)} className="w-4 h-4 text-emerald-600" />
                <span className="text-sm">É o primeiro registro (1º emprego)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!ficha.contribuicao_sindical} onChange={e => set('contribuicao_sindical', e.target.checked)} className="w-4 h-4 text-emerald-600" />
                <span className="text-sm">Contribuição Sindical</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!ficha.vale_transporte} onChange={e => set('vale_transporte', e.target.checked)} className="w-4 h-4 text-emerald-600" />
                <span className="text-sm">Vale Transporte</span>
              </label>
            </div>
          </div>
        </div>

        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onFechar} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-semibold">Cancelar</button>
          <button onClick={onSalvar} className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-sm font-bold">
            💾 Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
