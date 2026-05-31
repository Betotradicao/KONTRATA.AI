import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

/**
 * Regras de Cobertura por Setor — base do motor IA de escala.
 *
 * Aqui o RH cadastra, pra cada setor de cada loja:
 *   - Rotação padrão (5x2, 6x1...)
 *   - Dias de pico (sex/sáb/dom geralmente)
 *   - Mínimo de pessoas por turno e por dia da semana
 *   - Horário de pico
 *   - Horário de funcionamento
 *   - Custo da hora extra (R$/h)
 *
 * Usado em 2 momentos:
 *   1. Validacao: ao salvar uma celula da escala, avisa se ficou
 *      abaixo do mínimo de cobertura
 *   2. Geração IA (futura): solver de otimização lê isso como restrição
 */

const DIAS_SEMANA = [
  { key: 'dom', label: 'Dom', dow: 0 },
  { key: 'seg', label: 'Seg', dow: 1 },
  { key: 'ter', label: 'Ter', dow: 2 },
  { key: 'qua', label: 'Qua', dow: 3 },
  { key: 'qui', label: 'Qui', dow: 4 },
  { key: 'sex', label: 'Sex', dow: 5 },
  { key: 'sab', label: 'Sáb', dow: 6 },
];

const TURNOS_PERIODO = [
  { key: 'manha', label: 'Manhã (até 13h)' },
  { key: 'tarde', label: 'Tarde (13h-22h)' },
  { key: 'pico',  label: 'Pico (horário cheio)' },
];

export default function RhEscalaRegrasSetor() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [empresas, setEmpresas] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
  const [regras, setRegras] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form (regra atual sendo editada)
  const [empresaSel, setEmpresaSel] = useState('');
  const [departamentoSel, setDepartamentoSel] = useState('');
  const [form, setForm] = useState({
    rotacao_padrao: '6x1',
    dias_pico: ['sex', 'sab', 'dom'],
    cobertura_minima: {},
    picos_por_dia: {}, // { sex: [{ ini, fim }], sab: [{ ini, fim }, { ini, fim }] }
    funcionamento_inicio: '07:00',
    funcionamento_fim: '22:00',
    custo_hora_extra: '',
    observacoes: '',
  });
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [empR, depR, regR] = await Promise.all([
          api.get('/rh/empresas'),
          api.get('/rh/configuracoes/departamentos'),
          api.get('/rh/escala/regras-setor'),
        ]);
        const asArr = (resp, key) => {
          const d = resp?.data;
          if (Array.isArray(d)) return d;
          if (key && Array.isArray(d?.[key])) return d[key];
          return [];
        };
        const empList = asArr(empR, 'empresas');
        setEmpresas(empList);
        setDepartamentos(asArr(depR));
        setRegras(asArr(regR));
        if (empList.length > 0) {
          const principal = empList.find(x => x.isPrincipal) || empList[0];
          setEmpresaSel(String(principal.id));
        }
      } catch (e) { console.error(e); toast.error('Erro ao carregar'); }
      finally { setLoading(false); }
    })();
  }, []);

  // Quando muda empresa+departamento, carrega a regra existente (se houver)
  useEffect(() => {
    if (!empresaSel || !departamentoSel) return;
    const r = regras.find(x => String(x.empresa_id) === empresaSel && String(x.departamento_id) === String(departamentoSel));
    if (r) {
      setForm({
        rotacao_padrao: r.rotacao_padrao || '6x1',
        dias_pico: Array.isArray(r.dias_pico) ? r.dias_pico : [],
        cobertura_minima: typeof r.cobertura_minima === 'object' && r.cobertura_minima ? r.cobertura_minima : {},
        picos_por_dia: typeof r.picos_por_dia === 'object' && r.picos_por_dia ? r.picos_por_dia : {},
        funcionamento_inicio: r.funcionamento_inicio ? String(r.funcionamento_inicio).slice(0,5) : '07:00',
        funcionamento_fim: r.funcionamento_fim ? String(r.funcionamento_fim).slice(0,5) : '22:00',
        custo_hora_extra: r.custo_hora_extra != null ? String(r.custo_hora_extra) : '',
        observacoes: r.observacoes || '',
      });
    } else {
      // Reseta pra defaults — regra nova
      setForm({
        rotacao_padrao: '6x1',
        dias_pico: ['sex', 'sab', 'dom'],
        cobertura_minima: {},
        picos_por_dia: {},
        funcionamento_inicio: '07:00',
        funcionamento_fim: '22:00',
        custo_hora_extra: '',
        observacoes: '',
      });
    }
  }, [empresaSel, departamentoSel, regras]);

  const toggleDiaPico = (key) => {
    setForm(prev => {
      const novosDias = prev.dias_pico.includes(key)
        ? prev.dias_pico.filter(x => x !== key)
        : [...prev.dias_pico, key];
      const novosPicos = { ...prev.picos_por_dia };
      if (!novosDias.includes(key)) {
        // Tirou o dia da lista de pico — remove as faixas tambem
        delete novosPicos[key];
      } else if (!novosPicos[key]) {
        // Adicionou dia novo — cria 1 faixa padrao
        novosPicos[key] = [{ ini: '14:00', fim: '19:00' }];
      }
      return { ...prev, dias_pico: novosDias, picos_por_dia: novosPicos };
    });
  };

  const addFaixaPico = (diaKey) => {
    setForm(prev => {
      const novos = { ...prev.picos_por_dia };
      novos[diaKey] = [...(novos[diaKey] || []), { ini: '', fim: '' }];
      return { ...prev, picos_por_dia: novos };
    });
  };

  const removeFaixaPico = (diaKey, idx) => {
    setForm(prev => {
      const novos = { ...prev.picos_por_dia };
      novos[diaKey] = (novos[diaKey] || []).filter((_, i) => i !== idx);
      if (novos[diaKey].length === 0) delete novos[diaKey];
      return { ...prev, picos_por_dia: novos };
    });
  };

  const setFaixaPico = (diaKey, idx, campo, valor) => {
    setForm(prev => {
      const novos = { ...prev.picos_por_dia };
      const faixas = [...(novos[diaKey] || [])];
      faixas[idx] = { ...faixas[idx], [campo]: valor };
      novos[diaKey] = faixas;
      return { ...prev, picos_por_dia: novos };
    });
  };

  const setCobertura = (diaKey, turnoKey, valor) => {
    setForm(prev => {
      const cob = { ...prev.cobertura_minima };
      if (!cob[diaKey]) cob[diaKey] = {};
      const n = parseInt(valor);
      if (Number.isFinite(n) && n > 0) cob[diaKey][turnoKey] = n;
      else delete cob[diaKey][turnoKey];
      if (Object.keys(cob[diaKey]).length === 0) delete cob[diaKey];
      return { ...prev, cobertura_minima: cob };
    });
  };

  const getCobertura = (diaKey, turnoKey) =>
    form.cobertura_minima?.[diaKey]?.[turnoKey] ?? '';

  const salvar = async () => {
    if (!empresaSel || !departamentoSel) {
      toast.error('Selecione loja e setor'); return;
    }
    setSalvando(true);
    try {
      await api.post('/rh/escala/regras-setor', {
        empresa_id: empresaSel,
        departamento_id: Number(departamentoSel),
        ...form,
        custo_hora_extra: form.custo_hora_extra === '' ? null : Number(form.custo_hora_extra),
      });
      toast.success('Regras salvas');
      // Recarrega a lista de regras
      const r = await api.get('/rh/escala/regras-setor');
      setRegras(Array.isArray(r.data) ? r.data : []);
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || 'Erro ao salvar');
    } finally { setSalvando(false); }
  };

  const setoresComRegra = useMemo(() => {
    const set = new Set();
    regras.filter(r => String(r.empresa_id) === empresaSel).forEach(r => set.add(r.departamento_id));
    return set;
  }, [regras, empresaSel]);

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 overflow-y-auto">
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold">🎯 Regras de Cobertura por Setor</h1>
              <p className="text-orange-100 text-sm">Configure mínimo de pessoas, pico e horário — base do motor IA da escala</p>
            </div>
            <button onClick={() => navigate('/rh/escala')}
              className="bg-white/20 hover:bg-white/30 text-white border border-white/40 px-4 py-2 rounded-lg text-sm font-semibold">
              ← Voltar pra Escala
            </button>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Carregando...</div>
          ) : (
            <div className="space-y-4">
              {/* Seletor Loja + Setor */}
              <div className="bg-white rounded-lg shadow p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-1">🏪 Loja</label>
                    <select value={empresaSel} onChange={e => { setEmpresaSel(e.target.value); setDepartamentoSel(''); }}
                      className="w-full border rounded-lg px-3 py-2 text-sm">
                      <option value="">— escolha —</option>
                      {empresas.map(e => (
                        <option key={e.id} value={e.id}>{e.apelido || e.nomeFantasia || e.razaoSocial}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-1">📋 Setor</label>
                    <select value={departamentoSel} onChange={e => setDepartamentoSel(e.target.value)}
                      disabled={!empresaSel}
                      className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100">
                      <option value="">— escolha —</option>
                      {departamentos.map(d => (
                        <option key={d.id} value={d.id}>
                          {setoresComRegra.has(d.id) ? '✓ ' : ''}{d.nome}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-gray-500 mt-1">✓ = setor já tem regra cadastrada</p>
                  </div>
                </div>
              </div>

              {/* Lista de regras cadastradas pra essa loja */}
              {empresaSel && (() => {
                const regrasDaLoja = regras.filter(r => String(r.empresa_id) === empresaSel);
                return (
                  <div className="bg-white rounded-lg shadow p-4">
                    <h2 className="text-sm font-bold text-gray-800 mb-2">📚 Regras já cadastradas nesta loja</h2>
                    {regrasDaLoja.length === 0 ? (
                      <div className="text-center py-6 text-gray-400 text-sm">
                        Nenhuma regra cadastrada ainda — escolha um setor acima e configure a primeira.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {regrasDaLoja.map(r => {
                          const ativo = String(r.departamento_id) === departamentoSel;
                          const totalMin = (() => {
                            let n = 0;
                            const cob = r.cobertura_minima || {};
                            Object.keys(cob).forEach(d => {
                              Object.keys(cob[d] || {}).forEach(t => { n += Number(cob[d][t]) || 0; });
                            });
                            return n;
                          })();
                          const qtdPicos = (() => {
                            const pp = r.picos_por_dia || {};
                            return Object.values(pp).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);
                          })();
                          return (
                            <button key={r.id} type="button" onClick={() => setDepartamentoSel(String(r.departamento_id))}
                              className={`text-left p-3 rounded-lg border-2 transition hover:shadow ${ativo ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-white hover:border-purple-300'}`}>
                              <div className="font-bold text-gray-800 text-sm flex items-center gap-1">
                                {ativo && <span className="text-purple-600">▶</span>}
                                {r.departamento_nome || `Setor #${r.departamento_id}`}
                              </div>
                              <div className="text-xs text-gray-600 mt-1 flex flex-wrap gap-1.5">
                                <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{r.rotacao_padrao}</span>
                                {(r.dias_pico || []).length > 0 && (
                                  <span className="bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded">🔥 {r.dias_pico.length} dias pico</span>
                                )}
                                {qtdPicos > 0 && (
                                  <span className="bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded">{qtdPicos} faixas</span>
                                )}
                                {totalMin > 0 && (
                                  <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">Σ min: {totalMin}</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {empresaSel && departamentoSel && (
                <>
                  {/* Rotação padrão + Dias de pico + Horários */}
                  <div className="bg-white rounded-lg shadow p-4">
                    <h2 className="text-sm font-bold text-gray-800 mb-3">⚙️ Configuração Geral</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Rotação Padrão</label>
                        <select value={form.rotacao_padrao}
                          onChange={e => setForm(f => ({ ...f, rotacao_padrao: e.target.value }))}
                          className="w-full border rounded px-3 py-2 text-sm">
                          <option value="6x1">6x1 (6 trab, 1 folga)</option>
                          <option value="5x2">5x2 (5 trab, 2 folga)</option>
                          <option value="5x1">5x1 (5 trab, 1 folga)</option>
                          <option value="6x2">6x2 (6 trab, 2 folga)</option>
                          <option value="12x36">12x36 (12h trab, 36h folga)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Custo Hora Extra (R$/h)</label>
                        <input type="number" step="0.01"
                          value={form.custo_hora_extra}
                          onChange={e => setForm(f => ({ ...f, custo_hora_extra: e.target.value }))}
                          placeholder="Ex: 25.00"
                          className="w-full border rounded px-3 py-2 text-sm" />
                        <p className="text-[10px] text-gray-500 mt-1">CLT: hora extra +75% (deixe vazio pra calcular automático).</p>
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Dias de Pico</label>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {DIAS_SEMANA.map(d => {
                            const ativo = form.dias_pico.includes(d.key);
                            return (
                              <button key={d.key} type="button" onClick={() => toggleDiaPico(d.key)}
                                className={`px-2.5 py-1 rounded text-xs font-bold border-2 transition ${ativo ? 'bg-orange-500 border-orange-600 text-white' : 'bg-white border-gray-300 text-gray-600'}`}>
                                {d.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div>
                        <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Funcionamento — Início</label>
                        <input type="time" value={form.funcionamento_inicio}
                          onChange={e => setForm(f => ({ ...f, funcionamento_inicio: e.target.value }))}
                          className="w-full border rounded px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Funcionamento — Fim</label>
                        <input type="time" value={form.funcionamento_fim}
                          onChange={e => setForm(f => ({ ...f, funcionamento_fim: e.target.value }))}
                          className="w-full border rounded px-3 py-2 text-sm" />
                      </div>
                    </div>
                  </div>

                  {/* Faixas de Pico por Dia */}
                  <div className="bg-white rounded-lg shadow p-4">
                    <h2 className="text-sm font-bold text-gray-800 mb-2">🔥 Horários de Pico por Dia</h2>
                    <p className="text-xs text-gray-500 mb-3">
                      Pra cada dia marcado como pico você pode definir <strong>uma ou mais</strong> faixas de horário.
                      Ex: sábado pico de 10h–14h <strong>e</strong> 18h–22h.
                    </p>
                    {form.dias_pico.length === 0 ? (
                      <div className="text-center py-6 text-sm text-gray-400">
                        Nenhum dia de pico marcado. Selecione os dias em "Dias de Pico" acima.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {DIAS_SEMANA.filter(d => form.dias_pico.includes(d.key)).map(d => {
                          const faixas = form.picos_por_dia?.[d.key] || [];
                          return (
                            <div key={d.key} className="border border-orange-200 bg-orange-50/40 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="font-bold text-orange-800 text-sm flex items-center gap-2">
                                  🔥 {DIAS_SEMANA.find(x => x.key === d.key)?.label === 'Sex' ? 'Sexta-feira'
                                       : DIAS_SEMANA.find(x => x.key === d.key)?.label === 'Sáb' ? 'Sábado'
                                       : DIAS_SEMANA.find(x => x.key === d.key)?.label === 'Dom' ? 'Domingo'
                                       : DIAS_SEMANA.find(x => x.key === d.key)?.label === 'Seg' ? 'Segunda-feira'
                                       : DIAS_SEMANA.find(x => x.key === d.key)?.label === 'Ter' ? 'Terça-feira'
                                       : DIAS_SEMANA.find(x => x.key === d.key)?.label === 'Qua' ? 'Quarta-feira'
                                       : 'Quinta-feira'}
                                </div>
                                <button type="button" onClick={() => addFaixaPico(d.key)}
                                  className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 rounded font-semibold">
                                  ➕ Adicionar faixa
                                </button>
                              </div>
                              {faixas.length === 0 && (
                                <div className="text-xs text-gray-400 italic">Nenhuma faixa cadastrada — clique em "Adicionar faixa".</div>
                              )}
                              <div className="space-y-2">
                                {faixas.map((f, idx) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-orange-700 w-10">#{idx + 1}</span>
                                    <span className="text-xs text-gray-600">de</span>
                                    <input type="time" value={f.ini || ''}
                                      onChange={e => setFaixaPico(d.key, idx, 'ini', e.target.value)}
                                      className="border border-orange-300 rounded px-2 py-1 text-sm font-mono" />
                                    <span className="text-xs text-gray-600">até</span>
                                    <input type="time" value={f.fim || ''}
                                      onChange={e => setFaixaPico(d.key, idx, 'fim', e.target.value)}
                                      className="border border-orange-300 rounded px-2 py-1 text-sm font-mono" />
                                    <button type="button" onClick={() => removeFaixaPico(d.key, idx)}
                                      title="Remover faixa"
                                      className="text-red-500 hover:text-red-700 text-xs px-2">
                                      🗑️
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Matriz de cobertura mínima */}
                  <div className="bg-white rounded-lg shadow p-4">
                    <h2 className="text-sm font-bold text-gray-800 mb-3">👥 Cobertura Mínima por Turno</h2>
                    <p className="text-xs text-gray-500 mb-3">
                      Quantas pessoas <strong>no mínimo</strong> precisam estar trabalhando no setor naquele turno/dia.
                      Dias de pico têm linha extra <strong>"Pico"</strong> automática.
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-2 py-2 text-left font-semibold text-gray-700">Turno</th>
                            {DIAS_SEMANA.map(d => (
                              <th key={d.key} className="px-2 py-2 text-center font-semibold text-gray-700 min-w-[60px]">
                                {d.label}
                                {form.dias_pico.includes(d.key) && <span className="ml-1 text-orange-500" title="Dia de pico">🔥</span>}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {TURNOS_PERIODO.map(t => (
                            <tr key={t.key} className="hover:bg-gray-50">
                              <td className="px-2 py-2 font-semibold text-gray-700">{t.label}</td>
                              {DIAS_SEMANA.map(d => (
                                <td key={d.key} className="px-1 py-1 text-center">
                                  <input type="text" inputMode="numeric"
                                    value={getCobertura(d.key, t.key)}
                                    onChange={e => {
                                      // Aceita só dígitos pra evitar texto bagunçar
                                      const v = e.target.value.replace(/\D/g, '');
                                      setCobertura(d.key, t.key, v);
                                    }}
                                    placeholder="-"
                                    className="w-14 border border-gray-200 rounded text-center text-sm py-1 focus:border-orange-400 focus:ring-1 focus:ring-orange-200" />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Observações */}
                  <div className="bg-white rounded-lg shadow p-4">
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Observações</label>
                    <textarea value={form.observacoes}
                      onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                      rows={2}
                      placeholder="Ex: Açougue precisa de cobertura especial em datas comemorativas"
                      className="w-full border rounded px-3 py-2 text-sm" />
                  </div>

                  {/* Salvar */}
                  <div className="flex justify-end">
                    <button onClick={salvar} disabled={salvando}
                      className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-bold shadow disabled:opacity-50">
                      {salvando ? 'Salvando...' : '💾 Salvar Regras'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
