import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const ROTACOES = [
  { value: '6x1', label: '6x1 (6 dias trab., 1 folga)' },
  { value: '5x2', label: '5x2 (seg-sex trab., sáb+dom folga)' },
  { value: '1x1_dom', label: '1x1 Domingo (domingos alternados)' },
  { value: '2x1_dom', label: '2x1 Domingo (2 trab., 1 folga)' },
  { value: 'folguista', label: 'Folguista (cobre quem folga)' },
  { value: 'livre', label: 'Livre (sem rotação fixa)' },
];
const FOLGAS = [
  { value: '', label: '—' },
  { value: '1o_dom', label: '1º domingo do mês' },
  { value: '2o_dom', label: '2º domingo do mês' },
  { value: '3o_dom', label: '3º domingo do mês' },
  { value: 'sempre', label: 'Todo domingo' },
  { value: 'nunca', label: 'Nunca folga em domingo' },
  { value: 'qualquer', label: 'Qualquer (sistema decide)' },
];

export default function RhEscalaTemplate() {
  const { colaboradorId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [colaborador, setColaborador] = useState(null);
  const [turnos, setTurnos] = useState([]);
  const [template, setTemplate] = useState({
    tipoRotacao: '6x1',
    folgaPreferida: '',
    trabalhaFeriado: true,
    padraoSemanal: [[null, null, null, null, null, null, null]],
    observacao: '',
    // === Pré-preencher automático (motor de regras) ===
    tipoFolga: 'FIXA',
    diaFolgaFixa: 2,           // 0=Dom, 1=Seg, 2=Ter, ..., 6=Sab
    diaFolgaFixa2: null,       // segundo dia de folga (5x2 — geralmente Sab+Dom)
    dataRefFolga: '',
    rotacaoDomingo: '2x1',
    dataRefDomingo: '',
    turnoPadraoId: '',
    turnoSabadoId: '',
    turnoDomingoId: '',
    feriadoComportamento: 'trabalha',
  });
  const [prePreenchendo, setPrePreenchendo] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [rColab, rTurnos, rTpl] = await Promise.all([
          api.get(`/rh/colaboradores/${colaboradorId}`),
          api.get('/rh/escala/turnos'),
          api.get(`/rh/escala/templates/${colaboradorId}`),
        ]);
        setColaborador(rColab.data);
        setTurnos(Array.isArray(rTurnos.data) ? rTurnos.data : []);

        // Detecta a rotacao do cadastro do colaborador (rh_colaboradores.escala_nome ou escala_cadastro)
        // pra usar como default quando o template ainda nao existe.
        const escalaCadastro = (rColab.data?.escala_nome || rColab.data?.escala_cadastro || '').toLowerCase();
        const rotacaoDefault =
          escalaCadastro.includes('5x2') ? '5x2' :
          escalaCadastro.includes('5x1') ? '5x1' :
          escalaCadastro.includes('6x1') ? '6x1' :
          escalaCadastro.includes('6x2') ? '6x2' : '6x1';

        if (rTpl.data) {
          setTemplate(prev => ({
            ...prev,
            tipoRotacao: rTpl.data.tipoRotacao || rotacaoDefault,
            folgaPreferida: rTpl.data.folgaPreferida || '',
            trabalhaFeriado: rTpl.data.trabalhaFeriado !== false,
            padraoSemanal: Array.isArray(rTpl.data.padraoSemanal) && rTpl.data.padraoSemanal.length > 0
              ? rTpl.data.padraoSemanal
              : [[null, null, null, null, null, null, null]],
            observacao: rTpl.data.observacao || '',
            tipoFolga: rTpl.data.tipoFolga || 'FIXA',
            diaFolgaFixa: rTpl.data.diaFolgaFixa != null ? rTpl.data.diaFolgaFixa : (rotacaoDefault === '5x2' ? 6 : 2),
            diaFolgaFixa2: rTpl.data.diaFolgaFixa2 != null ? rTpl.data.diaFolgaFixa2 : (rotacaoDefault === '5x2' ? 0 : null),
            dataRefFolga: rTpl.data.dataRefFolga ? String(rTpl.data.dataRefFolga).substring(0, 10) : '',
            rotacaoDomingo: rTpl.data.rotacaoDomingo || (rotacaoDefault === '5x2' ? 'nunca' : '2x1'),
            dataRefDomingo: rTpl.data.dataRefDomingo ? String(rTpl.data.dataRefDomingo).substring(0, 10) : '',
            turnoPadraoId: rTpl.data.turnoPadraoId || '',
            turnoSabadoId: rTpl.data.turnoSabadoId || '',
            turnoDomingoId: rTpl.data.turnoDomingoId || '',
            feriadoComportamento: rTpl.data.feriadoComportamento || 'trabalha',
          }));
        } else {
          // Template não existe — pré-preenche com base na escala do cadastro
          setTemplate(prev => ({
            ...prev,
            tipoRotacao: rotacaoDefault,
            diaFolgaFixa: rotacaoDefault === '5x2' ? 6 : 2,                  // Sab pra 5x2, Ter pra 6x1
            diaFolgaFixa2: rotacaoDefault === '5x2' ? 0 : null,               // Dom pra 5x2
            rotacaoDomingo: rotacaoDefault === '5x2' ? 'nunca' : '2x1',
          }));
        }
      } catch (e) { console.error(e); }
    })();
  }, [colaboradorId]);

  const addSemana = () => {
    setTemplate(t => ({ ...t, padraoSemanal: [...t.padraoSemanal, [null, null, null, null, null, null, null]] }));
  };
  const removeSemana = (idx) => {
    if (template.padraoSemanal.length <= 1) return;
    setTemplate(t => ({ ...t, padraoSemanal: t.padraoSemanal.filter((_, i) => i !== idx) }));
  };
  const setCelula = (semIdx, diaIdx, turnoId) => {
    setTemplate(t => {
      const novo = t.padraoSemanal.map(s => [...s]);
      novo[semIdx][diaIdx] = turnoId;
      return { ...t, padraoSemanal: novo };
    });
  };

  const turnoById = (id) => turnos.find(t => t.id === id);

  const horasSemana = (semana) => {
    return semana.reduce((s, tid) => {
      const t = turnoById(tid);
      return s + (t?.totalHoras ? Number(t.totalHoras) : 0);
    }, 0);
  };

  const salvar = async () => {
    setSaving(true);
    try {
      await api.put(`/rh/escala/templates/${colaboradorId}`, template);
      toast.success('Template salvo — a escala vai aplicar daqui pra frente');
    } catch { toast.error('Erro ao salvar template'); }
    finally { setSaving(false); }
  };

  // Salva template + dispara o motor de pre-preencher pro mes corrente.
  // Resultado: a escala mensal do colaborador fica preenchida automaticamente.
  const salvarEPrePreencher = async () => {
    if (!template.turnoPadraoId) {
      toast.error('Escolha o turno padrão antes de pré-preencher');
      return;
    }
    setPrePreenchendo(true);
    try {
      await api.put(`/rh/escala/templates/${colaboradorId}`, template);
      const hoje = new Date();
      const mes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
      const r = await api.post(`/rh/escala/pre-preencher/${colaboradorId}?mes=${mes}`);
      toast.success(`✨ Pré-preenchido: ${r.data.gerados} dias gerados em ${mes}`);
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || 'Erro ao pré-preencher');
    } finally { setPrePreenchendo(false); }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 overflow-y-auto">
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white px-6 py-4 flex items-center gap-4">
          <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-purple-700 shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button onClick={() => navigate('/rh/escala')} className="bg-white/20 hover:bg-white/30 rounded px-2 py-1 text-sm shrink-0">← Voltar</button>
          <div>
            <h1 className="text-2xl font-bold">Template Semanal</h1>
            <p className="text-orange-100 text-sm">
              {colaborador?.nome || 'Colaborador'} · {colaborador?.cargo_nome || ''}
              {colaborador?.jornada_carga && <> · Jornada contratada: <strong>{colaborador.jornada_carga}</strong></>}
            </p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Configurações */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] uppercase text-gray-500 font-semibold">Tipo de rotação</label>
                <select value={template.tipoRotacao} onChange={e => setTemplate(t => ({ ...t, tipoRotacao: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-1.5 text-sm">
                  {ROTACOES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase text-gray-500 font-semibold">Folga preferida</label>
                <select value={template.folgaPreferida} onChange={e => setTemplate(t => ({ ...t, folgaPreferida: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-1.5 text-sm">
                  {FOLGAS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* 🪄 Pré-preencher Automático — motor de regras */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-lg shadow p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-indigo-900 text-lg flex items-center gap-2">🪄 Pré-preencher automático</h3>
                <p className="text-xs text-indigo-700">Configure as regras 1 vez e o sistema enche o mês inteiro sozinho.</p>
              </div>
              <button onClick={salvarEPrePreencher} disabled={prePreenchendo}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow disabled:opacity-50 whitespace-nowrap">
                {prePreenchendo ? '⏳ Preenchendo...' : '🪄 Salvar e Pré-preencher Mês'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Folga semanal */}
              <div className="bg-white rounded-lg p-3 border border-indigo-100">
                <div className="text-xs font-bold text-indigo-900 mb-2 uppercase">📋 Folga Semanal</div>
                <div className="flex items-center gap-3 mb-2">
                  <label className="flex items-center gap-1 text-sm cursor-pointer">
                    <input type="radio" checked={template.tipoFolga === 'FIXA'}
                      onChange={() => setTemplate(t => ({ ...t, tipoFolga: 'FIXA' }))}
                      className="accent-indigo-600" /> Fixa
                  </label>
                  <label className="flex items-center gap-1 text-sm cursor-pointer">
                    <input type="radio" checked={template.tipoFolga === 'ROTATIVA'}
                      onChange={() => setTemplate(t => ({ ...t, tipoFolga: 'ROTATIVA' }))}
                      className="accent-indigo-600" /> Rotativa
                  </label>
                </div>
                {template.tipoFolga === 'FIXA' ? (
                  <div>
                    <label className="text-[10px] uppercase text-gray-500 font-semibold">Folga sempre em:</label>
                    <select value={template.diaFolgaFixa}
                      onChange={e => setTemplate(t => ({ ...t, diaFolgaFixa: Number(e.target.value) }))}
                      className="w-full border rounded px-3 py-1.5 text-sm">
                      <option value={0}>Domingo</option>
                      <option value={1}>Segunda-feira</option>
                      <option value={2}>Terça-feira</option>
                      <option value={3}>Quarta-feira</option>
                      <option value={4}>Quinta-feira</option>
                      <option value={5}>Sexta-feira</option>
                      <option value={6}>Sábado</option>
                    </select>
                    {template.tipoRotacao === '5x2' && (
                      <p className="text-[10px] text-indigo-700 mt-1">Pra 5x2 escolha Sábado aqui — o domingo é tratado pela rotação ao lado.</p>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="text-[10px] uppercase text-gray-500 font-semibold">Última folga conhecida:</label>
                    <input type="date" value={template.dataRefFolga}
                      onChange={e => setTemplate(t => ({ ...t, dataRefFolga: e.target.value }))}
                      className="w-full border rounded px-3 py-1.5 text-sm" />
                    <p className="text-[10px] text-gray-500 mt-1">O sistema vai contar 7 dias a partir daqui pra projetar as próximas.</p>
                  </div>
                )}
              </div>

              {/* Domingo */}
              <div className="bg-white rounded-lg p-3 border border-indigo-100">
                <div className="text-xs font-bold text-indigo-900 mb-2 uppercase">☀️ Rotação de Domingo</div>
                <div className="mb-2">
                  <select value={template.rotacaoDomingo}
                    onChange={e => setTemplate(t => ({ ...t, rotacaoDomingo: e.target.value }))}
                    className="w-full border rounded px-3 py-1.5 text-sm">
                    <option value="sempre">Trabalha todo domingo</option>
                    <option value="nunca">Folga todo domingo (5x2)</option>
                    <option value="1x1">1x1 (alternado — 1 trab / 1 folga)</option>
                    <option value="2x1">2x1 (trab 2 dom / folga 1)</option>
                    <option value="3x1">3x1 (trab 3 dom / folga 1)</option>
                    <option value="mensal_1">Sempre folga no 1º domingo do mês</option>
                    <option value="mensal_2">Sempre folga no 2º domingo do mês</option>
                    <option value="mensal_3">Sempre folga no 3º domingo do mês</option>
                    <option value="mensal_4">Sempre folga no 4º domingo do mês</option>
                    <option value="mensal_ultimo">Sempre folga no ÚLTIMO domingo do mês</option>
                  </select>
                </div>
                {['1x1', '2x1', '3x1'].includes(template.rotacaoDomingo) && (
                  <div>
                    <label className="text-[10px] uppercase text-gray-500 font-semibold">Último domingo de FOLGA conhecido:</label>
                    <input type="date" value={template.dataRefDomingo}
                      onChange={e => setTemplate(t => ({ ...t, dataRefDomingo: e.target.value }))}
                      className="w-full border rounded px-3 py-1.5 text-sm" />
                    <p className="text-[10px] text-gray-500 mt-1">Sistema usa essa data como pivô da rotação.</p>
                  </div>
                )}
              </div>

              {/* Turnos por tipo de dia — 3 cards com horarios detalhados abaixo do select */}
              <div className="bg-white rounded-lg p-3 border border-indigo-100 md:col-span-2">
                <div className="text-xs font-bold text-indigo-900 mb-2 uppercase">⏰ Turnos Padrão</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { label: 'Seg–Sex *', field: 'turnoPadraoId', placeholder: '— escolha —',
                      folga: false },
                    { label: 'Sábado',    field: 'turnoSabadoId', placeholder: '(igual ao padrão)',
                      // sábado é folga quando: dia_folga_fixa OU dia_folga_fixa_2 == 6
                      folga: template.tipoFolga === 'FIXA' && (template.diaFolgaFixa === 6 || template.diaFolgaFixa2 === 6) },
                    { label: 'Domingo',   field: 'turnoDomingoId', placeholder: '(igual ao padrão)',
                      // domingo é folga quando: rotação = nunca (5x2) OU folga fixa cai em domingo
                      folga: template.rotacaoDomingo === 'nunca'
                          || (template.tipoFolga === 'FIXA' && (template.diaFolgaFixa === 0 || template.diaFolgaFixa2 === 0)) },
                  ].map(card => {
                    if (card.folga) {
                      // Dia configurado como FOLGA — não mostra turno
                      return (
                        <div key={card.field} className="border-2 border-dashed border-emerald-300 rounded-lg p-3 bg-emerald-50/50 flex flex-col items-center justify-center text-center min-h-[120px]">
                          <label className="text-[10px] uppercase text-gray-500 font-semibold mb-2">{card.label}</label>
                          <div className="text-3xl mb-1">🌴</div>
                          <div className="text-sm font-bold text-emerald-700 uppercase">FOLGA</div>
                          <div className="text-[10px] text-emerald-600 mt-1">Não trabalha neste dia</div>
                        </div>
                      );
                    }
                    const turnoSel = turnos.find(x => x.id === template[card.field])
                      || (card.field !== 'turnoPadraoId' ? turnos.find(x => x.id === template.turnoPadraoId) : null);
                    return (
                      <div key={card.field} className="border border-indigo-100 rounded-lg p-2 bg-indigo-50/30">
                        <label className="text-[10px] uppercase text-gray-500 font-semibold">{card.label}</label>
                        <select value={template[card.field] || ''}
                          onChange={e => setTemplate(t => ({ ...t, [card.field]: e.target.value }))}
                          className="w-full border rounded px-2 py-1.5 text-sm mb-2 font-mono"
                          style={turnoSel?.cor ? { backgroundColor: turnoSel.cor } : undefined}>
                          <option value="">{card.placeholder}</option>
                          {turnos.filter(t => t.tipo === 'turno').map(t => {
                            const ent = t.horaInicio?.slice(0,5) || '--:--';
                            const pi = t.pausaInicio?.slice(0,5) || '--:--';
                            const pf = t.pausaFim?.slice(0,5) || '--:--';
                            const sai = t.horaFim?.slice(0,5) || '--:--';
                            return (
                              <option key={t.id} value={t.id}>
                                {`${t.codigo.padEnd(10, ' ')}  ${ent} • ${pi}-${pf} • ${sai}`}
                              </option>
                            );
                          })}
                        </select>
                        <div className="grid grid-cols-4 gap-1 text-center text-[10px]">
                          <div>
                            <div className="font-semibold text-indigo-900 uppercase">Entrada</div>
                            <div className="font-mono text-gray-700">{turnoSel?.horaInicio ? turnoSel.horaInicio.slice(0,5) : <span className="text-gray-300">—</span>}</div>
                          </div>
                          <div>
                            <div className="font-semibold text-indigo-900 uppercase">P. Ini</div>
                            <div className="font-mono text-gray-700">{turnoSel?.pausaInicio ? turnoSel.pausaInicio.slice(0,5) : <span className="text-gray-300">—</span>}</div>
                          </div>
                          <div>
                            <div className="font-semibold text-indigo-900 uppercase">P. Fim</div>
                            <div className="font-mono text-gray-700">{turnoSel?.pausaFim ? turnoSel.pausaFim.slice(0,5) : <span className="text-gray-300">—</span>}</div>
                          </div>
                          <div>
                            <div className="font-semibold text-indigo-900 uppercase">Saída</div>
                            <div className="font-mono text-gray-700">{turnoSel?.horaFim ? turnoSel.horaFim.slice(0,5) : <span className="text-gray-300">—</span>}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-gray-500 mt-2">Sábado/Domingo em branco = usa o mesmo turno de Seg–Sex.</p>
              </div>

              {/* Feriado */}
              <div className="bg-white rounded-lg p-3 border border-indigo-100 md:col-span-2">
                <div className="text-xs font-bold text-indigo-900 mb-2 uppercase">🎉 Comportamento em Feriado</div>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-1 text-sm cursor-pointer">
                    <input type="radio" checked={template.feriadoComportamento === 'trabalha'}
                      onChange={() => setTemplate(t => ({ ...t, feriadoComportamento: 'trabalha', trabalhaFeriado: true }))}
                      className="accent-indigo-600" /> Trabalho normal
                  </label>
                  <label className="flex items-center gap-1 text-sm cursor-pointer">
                    <input type="radio" checked={template.feriadoComportamento === 'folga'}
                      onChange={() => setTemplate(t => ({ ...t, feriadoComportamento: 'folga', trabalhaFeriado: false }))}
                      className="accent-indigo-600" /> Sempre folgo
                  </label>
                  <label className="flex items-center gap-1 text-sm cursor-pointer">
                    <input type="radio" checked={template.feriadoComportamento === 'alternado'}
                      onChange={() => setTemplate(t => ({ ...t, feriadoComportamento: 'alternado', trabalhaFeriado: false }))}
                      className="accent-indigo-600" /> Alternado
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Semanas do ciclo */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-gray-800">Ciclo semanal</h3>
                <p className="text-xs text-gray-500">Define o turno de cada dia. O sistema aplica em sequência mês a mês.</p>
              </div>
              <button onClick={addSemana} className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded text-sm font-semibold">+ Semana</button>
            </div>
            <div className="space-y-3">
              {template.padraoSemanal.map((semana, sIdx) => (
                <div key={sIdx} className="border rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm">Semana {sIdx + 1}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-600">Σ {horasSemana(semana).toFixed(2)}h</span>
                      {template.padraoSemanal.length > 1 && (
                        <button onClick={() => removeSemana(sIdx)} className="text-red-600 text-xs hover:underline">Remover</button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {DIAS.map((dia, dIdx) => (
                      <div key={dIdx}>
                        <div className={`text-center text-xs font-semibold mb-1 ${dIdx === 0 ? 'text-red-600' : 'text-gray-600'}`}>{dia}</div>
                        <select value={semana[dIdx] || ''} onChange={e => setCelula(sIdx, dIdx, e.target.value || null)}
                          className="w-full text-xs border rounded px-1 py-1"
                          style={{ backgroundColor: semana[dIdx] ? (turnoById(semana[dIdx])?.cor || '#fff') : '#fff' }}>
                          <option value="">—</option>
                          {turnos.map(t => (
                            <option key={t.id} value={t.id}>{t.codigo}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Observação */}
          <div className="bg-white rounded-lg shadow p-4">
            <label className="text-[10px] uppercase text-gray-500 font-semibold">Observação</label>
            <textarea value={template.observacao} onChange={e => setTemplate(t => ({ ...t, observacao: e.target.value }))}
              rows={2} className="w-full border rounded px-3 py-2 text-sm" />
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => navigate('/rh/escala')} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold">Cancelar</button>
            <button onClick={salvar} disabled={saving} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar Template'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
