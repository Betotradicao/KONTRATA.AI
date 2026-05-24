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
  });
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
        if (rTpl.data) {
          setTemplate({
            tipoRotacao: rTpl.data.tipoRotacao || '6x1',
            folgaPreferida: rTpl.data.folgaPreferida || '',
            trabalhaFeriado: rTpl.data.trabalhaFeriado !== false,
            padraoSemanal: Array.isArray(rTpl.data.padraoSemanal) && rTpl.data.padraoSemanal.length > 0
              ? rTpl.data.padraoSemanal
              : [[null, null, null, null, null, null, null]],
            observacao: rTpl.data.observacao || '',
          });
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

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 overflow-y-auto">
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white px-6 py-4 flex items-center gap-4">
          <button onClick={() => navigate('/rh/escala')} className="bg-white/20 hover:bg-white/30 rounded px-2 py-1 text-sm">← Voltar</button>
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
              <div>
                <label className="text-[10px] uppercase text-gray-500 font-semibold">Trabalha em feriado?</label>
                <div className="flex items-center gap-4 py-2">
                  <label className="flex items-center gap-1 text-sm"><input type="radio" checked={template.trabalhaFeriado} onChange={() => setTemplate(t => ({ ...t, trabalhaFeriado: true }))} /> Sim</label>
                  <label className="flex items-center gap-1 text-sm"><input type="radio" checked={!template.trabalhaFeriado} onChange={() => setTemplate(t => ({ ...t, trabalhaFeriado: false }))} /> Não</label>
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
