import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

// Helper de copia que funciona em http (rede local) e https.
// navigator.clipboard so funciona em contexto seguro (https/localhost) -
// fora disso usamos fallback com textarea + execCommand.
function copiarTexto(texto) {
  const okMsg = '🔗 Link copiado!\n\n' + texto;
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(texto).then(
      () => alert(okMsg),
      () => fallbackCopia(texto, okMsg)
    );
  } else {
    fallbackCopia(texto, okMsg);
  }
}
function fallbackCopia(texto, okMsg) {
  try {
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (ok) alert(okMsg);
    else prompt('Copie o link manualmente (Ctrl+C):', texto);
  } catch {
    prompt('Copie o link manualmente (Ctrl+C):', texto);
  }
}

/**
 * Modulo Entrevistador Digital - 5 abas:
 *   /rh/recrutador/vagas
 *   /rh/recrutador/perguntas
 *   /rh/recrutador/treinar
 *   /rh/recrutador/enviar
 *   /rh/recrutador/entrevistas
 */
export default function RhRecrutadorIA() {
  const navigate = useNavigate();
  const { tab: tabParam } = useParams();
  const [tab, setTab] = useState(tabParam || 'treinar');
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => { if (tabParam) setTab(tabParam); }, [tabParam]);

  const tabs = [
    { id: 'treinar', label: '🎓 Treinar Entrevistadora' },
    { id: 'vagas', label: '💼 Vagas e Critérios' },
    { id: 'perguntas', label: '🧠 Banco de Perguntas' },
    { id: 'enviar', label: '📤 Enviar Entrevista' },
    { id: 'entrevistas', label: '📋 Entrevistas Realizadas' },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <main className="flex-1 p-6">
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 rounded-xl p-6 mb-6 text-white">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🤖</span>
            <div>
              <h1 className="text-2xl font-bold">Entrevistador Digital</h1>
              <p className="text-sm opacity-90">Recrutadora IA conduz entrevistas em escala. Você define a vaga, a IA conduz, e o relatório vem pronto.</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="flex border-b overflow-x-auto">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); navigate(`/rh/recrutador/${t.id}`); }}
                className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                  tab === t.id ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50' : 'text-gray-600 hover:text-orange-600'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {tab === 'vagas' && <TabVagas />}
            {tab === 'perguntas' && <TabPerguntas />}
            {tab === 'treinar' && <TabTreinar />}
            {tab === 'enviar' && <TabEnviar />}
            {tab === 'entrevistas' && <TabEntrevistas />}
          </div>
        </div>
      </main>
    </div>
  );
}

// ============================================================================
// TAB: VAGAS
// ============================================================================
function TabVagas() {
  const [vagas, setVagas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const r = await api.get('/recrutador/vagas');
      setVagas(r.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  if (loading) return <div className="text-gray-500">Carregando...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-gray-900">Vagas Cadastradas ({vagas.length})</h2>
        <button onClick={() => setEditando({})} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium">
          + Nova Vaga
        </button>
      </div>

      {vagas.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-500">Nenhuma vaga cadastrada ainda. Clique em "+ Nova Vaga" pra começar.</p>
        </div>
      )}

      <div className="space-y-3">
        {vagas.map(v => (
          <div key={v.id} className={`p-4 rounded-lg border ${v.ativo ? 'border-orange-200 bg-orange-50' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-bold text-gray-900">{v.titulo} {!v.ativo && <span className="text-xs ml-2 text-gray-500">(inativa)</span>}</h3>
                {v.descricao && <p className="text-sm text-gray-600 mt-1">{v.descricao}</p>}
                <div className="flex flex-wrap gap-2 mt-2 text-xs">
                  {v.perfil_disc_ideal && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded">DISC ideal: {v.perfil_disc_ideal}</span>}
                  {v.carga_horaria && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">{v.carga_horaria}</span>}
                  <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded">Máx {v.max_perguntas} perguntas</span>
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded">{v.qtd_entrevistas || 0} entrevistas</span>
                </div>
              </div>
              <div className="flex gap-2 ml-3">
                <button onClick={() => setEditando(v)} className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200">Editar</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editando && <ModalVaga vaga={editando} onClose={() => { setEditando(null); carregar(); }} />}
    </div>
  );
}

function ModalVaga({ vaga, onClose }) {
  const [form, setForm] = useState({
    titulo: vaga.titulo || '',
    descricao: vaga.descricao || '',
    setor: vaga.setor || '',
    perfil_disc_ideal: vaga.perfil_disc_ideal || '',
    carga_horaria: vaga.carga_horaria || '',
    salario_min: vaga.salario_min || '',
    salario_max: vaga.salario_max || '',
    requisitos_obrigatorios: vaga.requisitos_obrigatorios || '',
    requisitos_desejaveis: vaga.requisitos_desejaveis || '',
    competencias_chave: (vaga.competencias_chave || []).join(', '),
    red_flags: (vaga.red_flags || []).join('; '),
    instrucoes_extras_ia: vaga.instrucoes_extras_ia || '',
    max_perguntas: vaga.max_perguntas || 12,
    requer_experiencia: vaga.requer_experiencia || false,
    ativo: vaga.ativo !== false,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        competencias_chave: form.competencias_chave.split(',').map(s => s.trim()).filter(Boolean),
        red_flags: form.red_flags.split(';').map(s => s.trim()).filter(Boolean),
        salario_min: form.salario_min || null,
        salario_max: form.salario_max || null,
      };
      if (vaga.id) {
        await api.put(`/recrutador/vagas/${vaga.id}`, payload);
      } else {
        await api.post('/recrutador/vagas', payload);
      }
      onClose();
    } catch (e) {
      alert('Erro: ' + (e.response?.data?.error || e.message));
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm('Excluir esta vaga? Entrevistas associadas TAMBÉM serão excluídas.')) return;
    try {
      await api.delete(`/recrutador/vagas/${vaga.id}`);
      onClose();
    } catch (e) {
      alert('Erro: ' + (e.response?.data?.error || e.message));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-xl font-bold">{vaga.id ? 'Editar Vaga' : 'Nova Vaga'}</h3>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Título da Vaga *</label>
            <input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Ex: Operador de Caixa" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Descrição (o que o cargo faz)</label>
            <textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })}
              rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Atende clientes no PDV, opera o sistema, recebe pagamentos..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Perfil DISC ideal</label>
              <select value={form.perfil_disc_ideal} onChange={e => setForm({ ...form, perfil_disc_ideal: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="">Não especificado</option>
                <option value="D">D - Dominante</option>
                <option value="I">I - Influente</option>
                <option value="S">S - Estável</option>
                <option value="C">C - Conformidade</option>
                <option value="DI">DI</option>
                <option value="IS">IS</option>
                <option value="SC">SC</option>
                <option value="DC">DC</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Carga horária</label>
              <input value={form.carga_horaria} onChange={e => setForm({ ...form, carga_horaria: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="44h semanais, escala 6x1" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Salário mínimo (R$)</label>
              <input type="number" value={form.salario_min} onChange={e => setForm({ ...form, salario_min: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="1500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Salário máximo (R$)</label>
              <input type="number" value={form.salario_max} onChange={e => setForm({ ...form, salario_max: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="2000" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Competências-chave (separadas por vírgula)</label>
            <input value={form.competencias_chave} onChange={e => setForm({ ...form, competencias_chave: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="atendimento ao cliente, atenção a detalhes, integridade, agilidade" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Requisitos obrigatórios</label>
            <textarea value={form.requisitos_obrigatorios} onChange={e => setForm({ ...form, requisitos_obrigatorios: e.target.value })}
              rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Ensino médio completo. Disponibilidade fim de semana." />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Requisitos desejáveis</label>
            <textarea value={form.requisitos_desejaveis} onChange={e => setForm({ ...form, requisitos_desejaveis: e.target.value })}
              rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Experiência prévia em supermercado." />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Red flags (separados por ponto-e-vírgula)</label>
            <input value={form.red_flags} onChange={e => setForm({ ...form, red_flags: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="rotatividade alta; brigas com colegas; histórico de furto" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Instruções extras pra IA (opcional)</label>
            <textarea value={form.instrucoes_extras_ia} onChange={e => setForm({ ...form, instrucoes_extras_ia: e.target.value })}
              rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Pergunte sobre experiência com filas grandes. Avaliar paciência." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Setor (pra perguntas técnicas)</label>
              <select value={form.setor} onChange={e => setForm({ ...form, setor: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="">Não especificado</option>
                <option value="caixa">Caixa</option>
                <option value="acougue">Açougue</option>
                <option value="padaria">Padaria</option>
                <option value="hortifruti">Hortifruti</option>
                <option value="frios">Frios e Laticínios</option>
                <option value="peixaria">Peixaria</option>
                <option value="bebidas">Bebidas/Adega</option>
                <option value="mercearia">Mercearia</option>
                <option value="perfumaria">Perfumaria</option>
                <option value="prevencao">Prevenção/Fiscal</option>
                <option value="lideranca">Liderança/Encarregado</option>
                <option value="gerencia">Gerência</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Define qual banco de perguntas técnicas a IA usa</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Máximo de perguntas</label>
              <input type="number" value={form.max_perguntas} onChange={e => setForm({ ...form, max_perguntas: parseInt(e.target.value) || 12 })}
                min={5} max={30} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.requer_experiencia}
                onChange={e => setForm({ ...form, requer_experiencia: e.target.checked })}
                className="w-5 h-5 text-orange-500" />
              <div className="flex-1">
                <span className="text-sm font-bold text-amber-900">🎯 Vaga requer experiência prévia no setor</span>
                <p className="text-xs text-amber-700 mt-0.5">
                  Quando marcado, a IA aplicará <strong>2 a 4 perguntas técnicas</strong> do setor escolhido (ex: identificar cortes de carne, fermentação de pão, frescor de peixe...) pra avaliar conhecimento prático real.
                </p>
              </div>
            </label>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.ativo} onChange={e => setForm({ ...form, ativo: e.target.checked })} />
            <span className="text-sm">Vaga ativa</span>
          </label>
        </div>
        <div className="p-6 border-t border-gray-200 flex justify-between">
          <div>
            {vaga.id && (
              <button onClick={handleDelete} className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg">🗑️ Excluir</button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !form.titulo}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TAB: BANCO DE PERGUNTAS
// ============================================================================
function TabPerguntas() {
  const [perguntas, setPerguntas] = useState([]);
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [editando, setEditando] = useState(null);

  const carregar = async () => {
    try {
      const url = filtroCategoria ? `/recrutador/perguntas?categoria=${encodeURIComponent(filtroCategoria)}` : '/recrutador/perguntas';
      const r = await api.get(url);
      setPerguntas(r.data || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { carregar(); }, [filtroCategoria]);

  const categorias = [...new Set(perguntas.map(p => p.categoria))];

  return (
    <div>
      <div className="flex justify-between items-center mb-4 gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-900">Banco de Perguntas ({perguntas.length})</h2>
          <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded text-sm">
            <option value="">Todas categorias</option>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button onClick={() => setEditando({})} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium">
          + Nova Pergunta
        </button>
      </div>

      <div className="space-y-2">
        {perguntas.map(p => (
          <div key={p.id} className={`p-3 rounded-lg border ${p.ativo ? 'bg-white border-gray-200' : 'bg-gray-100 border-gray-200 opacity-60'}`}>
            <div className="flex justify-between items-start gap-3">
              <div className="flex-1">
                <p className="text-gray-900">{p.pergunta}</p>
                <div className="flex flex-wrap gap-2 mt-2 text-xs">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">{p.categoria}</span>
                  {p.competencia && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded">{p.competencia}</span>}
                  <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded">{p.tipo}</span>
                  <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">{p.nivel_dificuldade}</span>
                </div>
                {p.dica_avaliacao && <p className="text-xs text-gray-500 mt-1 italic">💡 {p.dica_avaliacao}</p>}
              </div>
              <button onClick={() => setEditando(p)} className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                Editar
              </button>
            </div>
          </div>
        ))}
      </div>

      {editando && <ModalPergunta pergunta={editando} onClose={() => { setEditando(null); carregar(); }} />}
    </div>
  );
}

function ModalPergunta({ pergunta, onClose }) {
  const [form, setForm] = useState({
    pergunta: pergunta.pergunta || '',
    categoria: pergunta.categoria || 'comportamental',
    competencia: pergunta.competencia || '',
    tipo: pergunta.tipo || 'comportamental',
    nivel_dificuldade: pergunta.nivel_dificuldade || 'medio',
    dica_avaliacao: pergunta.dica_avaliacao || '',
    ativo: pergunta.ativo !== false,
  });

  const handleSave = async () => {
    try {
      if (pergunta.id) await api.put(`/recrutador/perguntas/${pergunta.id}`, form);
      else await api.post('/recrutador/perguntas', form);
      onClose();
    } catch (e) {
      alert('Erro: ' + (e.response?.data?.error || e.message));
    }
  };

  const handleDelete = async () => {
    if (!confirm('Excluir esta pergunta?')) return;
    await api.delete(`/recrutador/perguntas/${pergunta.id}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-xl w-full" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-xl font-bold">{pergunta.id ? 'Editar Pergunta' : 'Nova Pergunta'}</h3>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Pergunta *</label>
            <textarea value={form.pergunta} onChange={e => setForm({ ...form, pergunta: e.target.value })}
              rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Categoria *</label>
              <input value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="ex: comportamental, etica" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Competência</label>
              <input value={form.competencia} onChange={e => setForm({ ...form, competencia: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="ex: atendimento ao cliente" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tipo</label>
              <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="comportamental">Comportamental</option>
                <option value="situacional">Situacional</option>
                <option value="aberta">Aberta</option>
                <option value="fechada">Fechada</option>
                <option value="tecnica">Técnica</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Dificuldade</label>
              <select value={form.nivel_dificuldade} onChange={e => setForm({ ...form, nivel_dificuldade: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="facil">Fácil</option>
                <option value="medio">Médio</option>
                <option value="dificil">Difícil</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Dica de avaliação (o que olhar)</label>
            <textarea value={form.dica_avaliacao} onChange={e => setForm({ ...form, dica_avaliacao: e.target.value })}
              rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="O que uma boa resposta deve conter? Quais sinais de alerta?" />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.ativo} onChange={e => setForm({ ...form, ativo: e.target.checked })} />
            <span className="text-sm">Pergunta ativa</span>
          </label>
        </div>
        <div className="p-6 border-t border-gray-200 flex justify-between">
          <div>{pergunta.id && <button onClick={handleDelete} className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg">🗑️ Excluir</button>}</div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg">Cancelar</button>
            <button onClick={handleSave} disabled={!form.pergunta || !form.categoria}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg disabled:opacity-50">Salvar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TAB: TREINAR ENTREVISTADORA (config global)
// ============================================================================
function TabTreinar() {
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [vozesDisponiveis, setVozesDisponiveis] = useState([]);
  const [tocandoVoz, setTocandoVoz] = useState(null);

  useEffect(() => { (async () => {
    try { const r = await api.get('/recrutador/config'); setConfig(r.data || {}); }
    catch (e) { console.error(e); }
  })(); }, []);

  // Carregar vozes do navegador (Web Speech API). Em alguns browsers, a lista
  // só fica disponivel apos um evento async, por isso o listener.
  useEffect(() => {
    const carregarVozes = () => {
      if (!('speechSynthesis' in window)) return;
      const vs = window.speechSynthesis.getVoices() || [];
      // Filtra so pt-BR e pt-PT (priorizando pt-BR)
      const pt = vs.filter(v => v.lang.startsWith('pt')).sort((a, b) => {
        if (a.lang === 'pt-BR' && b.lang !== 'pt-BR') return -1;
        if (b.lang === 'pt-BR' && a.lang !== 'pt-BR') return 1;
        return a.name.localeCompare(b.name);
      });
      setVozesDisponiveis(pt);
    };
    carregarVozes();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = carregarVozes;
    }
  }, []);

  // Heurística de gênero pelo nome da voz
  const adivinhaGenero = (nome) => {
    const n = nome.toLowerCase();
    if (/maria|helena|fernanda|luiza|ana|joana|female|mulher|catarina|leila|raquel|francisca|paola|paulina/.test(n)) return 'feminina';
    if (/daniel|andre|antonio|carlos|joao|pedro|male|homem|ricardo|paulo|eduardo|bruno|diogo|felipe/.test(n)) return 'masculina';
    return 'neutra';
  };
  const vozesFem = vozesDisponiveis.filter(v => adivinhaGenero(v.name) === 'feminina');
  const vozesMas = vozesDisponiveis.filter(v => adivinhaGenero(v.name) === 'masculina');
  const vozesNeu = vozesDisponiveis.filter(v => adivinhaGenero(v.name) === 'neutra');

  const fraseDemo = (cfg) => `Olá, eu sou ${cfg?.nome_recrutadora || 'Helen'}, sua recrutadora virtual. Conte comigo pra achar os melhores candidatos pra essa vaga. Vamos lá?`;

  const tocar = (voz) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(fraseDemo(config));
    utt.voice = voz;
    utt.lang = voz.lang;
    utt.rate = 1.0;
    utt.pitch = 1.05;
    utt.onstart = () => setTocandoVoz(voz.name);
    utt.onend = () => setTocandoVoz(null);
    utt.onerror = () => setTocandoVoz(null);
    window.speechSynthesis.speak(utt);
  };

  const escolher = (voz, genero) => {
    setConfig({ ...config, voz_recrutadora: voz.name, voz_genero: genero });
  };

  if (!config) return <div className="text-gray-500">Carregando...</div>;

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/recrutador/config', config);
      alert('✅ Configuração salva!');
    } catch (e) { alert('Erro: ' + (e.response?.data?.error || e.message)); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-3xl space-y-5">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-bold text-blue-900 mb-1">🎓 Aqui você "treina" a personalidade da Entrevistadora IA</h3>
        <p className="text-sm text-blue-800">Tudo que escrever aqui é injetado no system prompt da IA, definindo como ela vai conduzir TODAS as entrevistas.</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Nome da Entrevistadora</label>
        <input value={config.nome_recrutadora || ''} onChange={e => setConfig({ ...config, nome_recrutadora: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Persona / Descrição da entrevistadora</label>
        <textarea value={config.persona_descricao || ''} onChange={e => setConfig({ ...config, persona_descricao: e.target.value })}
          rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
        <p className="text-xs text-gray-500 mt-1">Como ela é, qual experiência tem, qual abordagem usa.</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Tom de comunicação</label>
        <select value={config.tom_comunicacao || 'profissional-acolhedor'} onChange={e => setConfig({ ...config, tom_comunicacao: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg">
          <option value="profissional-acolhedor">Profissional e acolhedor</option>
          <option value="formal-rigoroso">Formal e rigoroso</option>
          <option value="descontraido-empatico">Descontraído e empático</option>
          <option value="objetivo-direto">Objetivo e direto</option>
        </select>
      </div>

      {/* SELETOR DE VOZ — REMOVIDO DAQUI. Agora aparece na aba "Enviar Entrevista" quando modo=voz. */}
      <div className="hidden">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              🎤 Voz da Entrevistadora (Modo Voz)
            </h3>
            <p className="text-xs text-gray-600 mt-0.5">
              Selecione qual voz a {config.nome_recrutadora || 'Helen'} usa nas entrevistas por voz. Clique em ▶ pra ouvir cada uma.
            </p>
          </div>
        </div>

        {vozesDisponiveis.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-900">
            ⚠️ Nenhuma voz pt-BR detectada no seu navegador. Tente abrir esta tela no Chrome ou Edge atualizado.
          </div>
        )}

        {vozesDisponiveis.length > 0 && (
          <div className="grid md:grid-cols-2 gap-4 mt-2">
            {/* FEMININAS */}
            <div>
              <h4 className="font-bold text-pink-700 mb-2 text-sm">👩 Vozes Femininas ({vozesFem.length})</h4>
              <div className="space-y-2">
                {vozesFem.length === 0 && <p className="text-xs text-gray-500 italic">Nenhuma voz feminina pt detectada nesse navegador</p>}
                {vozesFem.map(v => (
                  <div key={v.name} className={`flex items-center gap-2 p-2 rounded border ${
                    config.voz_recrutadora === v.name ? 'border-pink-500 bg-pink-50' : 'border-gray-200 bg-white'
                  }`}>
                    <button type="button" onClick={() => tocar(v)}
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-white ${
                        tocandoVoz === v.name ? 'bg-pink-600 animate-pulse' : 'bg-pink-500 hover:bg-pink-600'
                      }`}
                      title="Ouvir esta voz">
                      {tocandoVoz === v.name ? '🔊' : '▶'}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" title={v.name}>{v.name}</div>
                      <div className="text-xs text-gray-500">{v.lang}</div>
                    </div>
                    <button type="button" onClick={() => escolher(v, 'feminina')}
                      className={`text-xs px-3 py-1 rounded-full font-medium ${
                        config.voz_recrutadora === v.name ? 'bg-pink-600 text-white' : 'bg-gray-100 hover:bg-pink-100 text-gray-700'
                      }`}>
                      {config.voz_recrutadora === v.name ? '✓ Escolhida' : 'Escolher'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* MASCULINAS */}
            <div>
              <h4 className="font-bold text-blue-700 mb-2 text-sm">👨 Vozes Masculinas ({vozesMas.length})</h4>
              <div className="space-y-2">
                {vozesMas.length === 0 && <p className="text-xs text-gray-500 italic">Nenhuma voz masculina pt detectada nesse navegador</p>}
                {vozesMas.map(v => (
                  <div key={v.name} className={`flex items-center gap-2 p-2 rounded border ${
                    config.voz_recrutadora === v.name ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
                  }`}>
                    <button type="button" onClick={() => tocar(v)}
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-white ${
                        tocandoVoz === v.name ? 'bg-blue-600 animate-pulse' : 'bg-blue-500 hover:bg-blue-600'
                      }`}
                      title="Ouvir esta voz">
                      {tocandoVoz === v.name ? '🔊' : '▶'}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" title={v.name}>{v.name}</div>
                      <div className="text-xs text-gray-500">{v.lang}</div>
                    </div>
                    <button type="button" onClick={() => escolher(v, 'masculina')}
                      className={`text-xs px-3 py-1 rounded-full font-medium ${
                        config.voz_recrutadora === v.name ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-blue-100 text-gray-700'
                      }`}>
                      {config.voz_recrutadora === v.name ? '✓ Escolhida' : 'Escolher'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {vozesNeu.length > 0 && (
              <div className="md:col-span-2">
                <h4 className="font-bold text-gray-600 mb-2 text-sm">⚪ Vozes não classificadas ({vozesNeu.length})</h4>
                <div className="space-y-2">
                  {vozesNeu.map(v => (
                    <div key={v.name} className={`flex items-center gap-2 p-2 rounded border ${
                      config.voz_recrutadora === v.name ? 'border-gray-500 bg-gray-100' : 'border-gray-200 bg-white'
                    }`}>
                      <button type="button" onClick={() => tocar(v)}
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-white ${
                          tocandoVoz === v.name ? 'bg-gray-700 animate-pulse' : 'bg-gray-500 hover:bg-gray-600'
                        }`}>
                        {tocandoVoz === v.name ? '🔊' : '▶'}
                      </button>
                      <div className="flex-1 text-sm">{v.name} <span className="text-xs text-gray-500">({v.lang})</span></div>
                      <button type="button" onClick={() => escolher(v, 'neutra')}
                        className={`text-xs px-3 py-1 rounded-full font-medium ${
                          config.voz_recrutadora === v.name ? 'bg-gray-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}>
                        {config.voz_recrutadora === v.name ? '✓' : 'Escolher'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Modelo de IA</label>
        <select value={config.modelo_ia || 'gpt-4o-mini'} onChange={e => setConfig({ ...config, modelo_ia: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg">
          <option value="gpt-4o-mini">GPT-4o Mini (recomendado — barato e bom)</option>
          <option value="gpt-4o">GPT-4o (premium — mais caro)</option>
          <option value="gpt-4.1-mini">GPT-4.1 Mini</option>
          <option value="gpt-4.1">GPT-4.1</option>
          <option value="gpt-5-mini">GPT-5 Mini</option>
          <option value="gpt-5">GPT-5</option>
        </select>
        <p className="text-xs text-gray-500 mt-1">Mini é suficiente pra entrevista por texto. Custo médio: ~R$ 0,10-0,30 por entrevista.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Max tokens por resposta</label>
          <input type="number" value={config.max_tokens_resposta || 300} onChange={e => setConfig({ ...config, max_tokens_resposta: parseInt(e.target.value) || 300 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Timeout (segundos)</label>
          <input type="number" value={config.timeout_resposta_segundos || 90} onChange={e => setConfig({ ...config, timeout_resposta_segundos: parseInt(e.target.value) || 90 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Budget tokens/entrevista</label>
          <input type="number" value={config.budget_max_tokens_entrevista || 30000} onChange={e => setConfig({ ...config, budget_max_tokens_entrevista: parseInt(e.target.value) || 30000 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          <p className="text-xs text-gray-500 mt-1">Limite que para a entrevista automaticamente</p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Instruções extras (regras absolutas pra IA)</label>
        <textarea value={config.instrucoes_extras || ''} onChange={e => setConfig({ ...config, instrucoes_extras: e.target.value })}
          rows={5} className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          placeholder="Ex: Sempre cumprimentar pelo nome. Nunca discriminar. Respeitar LGPD. Encerrar com cortesia se candidato pedir." />
        <p className="text-xs text-gray-500 mt-1">Vão direto pro system prompt — funcionam em TODAS as entrevistas.</p>
      </div>

      <button onClick={handleSave} disabled={saving}
        className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium disabled:opacity-50">
        {saving ? 'Salvando...' : '💾 Salvar Configuração'}
      </button>
    </div>
  );
}

// ============================================================================
// TAB: ENVIAR ENTREVISTA
// ============================================================================
function TabEnviar() {
  const [vagas, setVagas] = useState([]);
  const [form, setForm] = useState({ vaga_id: '', candidato_nome: '', candidato_telefone: '', candidato_email: '', expira_dias: 7, modo_entrevista: 'texto', voz_recrutadora: '' });
  const [resultado, setResultado] = useState(null);
  const [saving, setSaving] = useState(false);
  const [vozes, setVozes] = useState([]);
  const [tocando, setTocando] = useState(null);
  const [nomeRecrutadora, setNomeRecrutadora] = useState('Helen');
  const [textoTeste, setTextoTeste] = useState('Olá, eu sou a Helen, sua recrutadora virtual. Conte comigo pra achar os melhores candidatos pra essa vaga. Vamos lá?');
  const [provedorTts, setProvedorTts] = useState('web_speech'); // 'web_speech' | 'openai' | 'elevenlabs'

  // OpenAI tem 6 vozes oficiais
  const vozesOpenAI = [
    { id: 'nova',    nome: 'Nova',    genero: 'fem', desc: 'Feminina jovem, calorosa — recomendada' },
    { id: 'shimmer', nome: 'Shimmer', genero: 'fem', desc: 'Feminina suave, melodiosa' },
    { id: 'fable',   nome: 'Fable',   genero: 'fem', desc: 'Feminina expressiva, britânica' },
    { id: 'alloy',   nome: 'Alloy',   genero: 'neu', desc: 'Neutra, balanceada' },
    { id: 'echo',    nome: 'Echo',    genero: 'mas', desc: 'Masculina calma, profissional' },
    { id: 'onyx',    nome: 'Onyx',    genero: 'mas', desc: 'Masculina grave, autoritária' },
  ];

  // ElevenLabs vozes pre-feitas mais populares pt-BR
  const vozesElevenLabs = [
    { id: '21m00Tcm4TlvDq8ikWAM', nome: 'Rachel',  genero: 'fem', desc: 'Feminina natural (multilingual)' },
    { id: 'EXAVITQu4vr4xnSDxMaL', nome: 'Bella',   genero: 'fem', desc: 'Feminina jovem, energética' },
    { id: 'AZnzlk1XvdvUeBnXmlld', nome: 'Domi',    genero: 'fem', desc: 'Feminina firme' },
    { id: 'MF3mGyEYCl7XYWbV9V6O', nome: 'Elli',    genero: 'fem', desc: 'Feminina emocional' },
    { id: 'ErXwobaYiN019PkySvjV', nome: 'Antoni',  genero: 'mas', desc: 'Masculina jovem, animada' },
    { id: 'VR6AewLTigWG4xSOukaG', nome: 'Arnold',  genero: 'mas', desc: 'Masculina grave' },
  ];

  // 🇧🇷 Azure Neural — VOZES BRASILEIRAS NATIVAS (recomendado!)
  const vozesAzure = [
    { id: 'pt-BR-FranciscaNeural', nome: 'Francisca', genero: 'fem', desc: '🇧🇷 Feminina brasileira — natural, profissional' },
    { id: 'pt-BR-BrendaNeural',    nome: 'Brenda',    genero: 'fem', desc: '🇧🇷 Feminina jovem, simpática' },
    { id: 'pt-BR-YaraNeural',      nome: 'Yara',      genero: 'fem', desc: '🇧🇷 Feminina expressiva' },
    { id: 'pt-BR-LeticiaNeural',   nome: 'Letícia',   genero: 'fem', desc: '🇧🇷 Feminina suave, jovem' },
    { id: 'pt-BR-LeilaNeural',     nome: 'Leila',     genero: 'fem', desc: '🇧🇷 Feminina madura' },
    { id: 'pt-BR-ElzaNeural',      nome: 'Elza',      genero: 'fem', desc: '🇧🇷 Feminina grave' },
    { id: 'pt-BR-GiovannaNeural',  nome: 'Giovanna',  genero: 'fem', desc: '🇧🇷 Feminina alegre' },
    { id: 'pt-BR-ManuelaNeural',   nome: 'Manuela',   genero: 'fem', desc: '🇧🇷 Feminina elegante' },
    { id: 'pt-BR-ThalitaNeural',   nome: 'Thalita',   genero: 'fem', desc: '🇧🇷 Feminina (multilingual)' },
    { id: 'pt-BR-AntonioNeural',   nome: 'Antônio',   genero: 'mas', desc: '🇧🇷 Masculina, voz grave' },
    { id: 'pt-BR-FabioNeural',     nome: 'Fábio',     genero: 'mas', desc: '🇧🇷 Masculina, profissional' },
    { id: 'pt-BR-HumbertoNeural',  nome: 'Humberto',  genero: 'mas', desc: '🇧🇷 Masculina autoritária' },
    { id: 'pt-BR-JulioNeural',     nome: 'Julio',     genero: 'mas', desc: '🇧🇷 Masculina jovem' },
    { id: 'pt-BR-NicolauNeural',   nome: 'Nicolau',   genero: 'mas', desc: '🇧🇷 Masculina natural' },
    { id: 'pt-BR-ValerioNeural',   nome: 'Valério',   genero: 'mas', desc: '🇧🇷 Masculina madura' },
    { id: 'pt-BR-DonatoNeural',    nome: 'Donato',    genero: 'mas', desc: '🇧🇷 Masculina expressiva' },
  ];

  useEffect(() => { (async () => {
    const r = await api.get('/recrutador/vagas'); setVagas((r.data || []).filter(v => v.ativo));
    try {
      const cfg = await api.get('/recrutador/config');
      if (cfg.data?.nome_recrutadora) setNomeRecrutadora(cfg.data.nome_recrutadora);
      if (cfg.data?.voz_recrutadora) setForm(f => ({ ...f, voz_recrutadora: cfg.data.voz_recrutadora }));
    } catch {}
  })(); }, []);

  // Carregar vozes do navegador (pra modo voz)
  useEffect(() => {
    const carregar = () => {
      if (!('speechSynthesis' in window)) return;
      const vs = (window.speechSynthesis.getVoices() || []).filter(v => v.lang.startsWith('pt'))
        .sort((a, b) => (a.lang === 'pt-BR' ? -1 : 1));
      setVozes(vs);
    };
    carregar();
    if ('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = carregar;
  }, []);

  const adivinhaGenero = (nome) => {
    const n = nome.toLowerCase();
    if (/maria|helena|fernanda|luiza|ana|joana|female|mulher|catarina|leila|raquel|francisca|paola|paulina|brenda|heloisa/.test(n)) return 'fem';
    if (/daniel|andre|antonio|carlos|joao|pedro|male|homem|ricardo|paulo|eduardo|bruno|diogo|felipe|donato/.test(n)) return 'mas';
    return 'neu';
  };

  const tocarPreview = (voz) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const texto = textoTeste && textoTeste.trim() ? textoTeste : `Olá, eu sou ${nomeRecrutadora}.`;
    const u = new SpeechSynthesisUtterance(texto);
    u.voice = voz; u.lang = voz.lang; u.rate = 1.0; u.pitch = 1.05;
    u.onstart = () => setTocando(voz.name);
    u.onend = () => setTocando(null);
    u.onerror = () => setTocando(null);
    window.speechSynthesis.speak(u);
  };

  // Toca via API (OpenAI ou ElevenLabs)
  const audioRef = useRef(null);
  const tocarPreviewApi = async (provedor, vozId) => {
    try {
      setTocando(vozId);
      const texto = textoTeste && textoTeste.trim() ? textoTeste : `Olá, eu sou ${nomeRecrutadora}.`;
      const r = await api.post('/recrutador/tts/preview',
        { provedor, voz: vozId, texto },
        { responseType: 'blob' }
      );
      const url = URL.createObjectURL(r.data);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      const audio = new Audio(url);
      audio.onended = () => { setTocando(null); URL.revokeObjectURL(url); };
      audio.onerror = () => { setTocando(null); URL.revokeObjectURL(url); };
      audioRef.current = audio;
      await audio.play();
    } catch (e) {
      setTocando(null);
      const msg = e.response?.data?.error || (e.response?.data && JSON.parse(await e.response.data.text?.() || '{}').error) || e.message;
      alert('Erro ao tocar preview: ' + msg);
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload = { ...form, provedor_tts: form.modo_entrevista === 'voz' ? provedorTts : null };
      const r = await api.post('/recrutador/entrevistas', payload);
      const url = `${window.location.origin}/recrutamento/${r.data.token}`;
      setResultado({ ...r.data, url });
    } catch (e) {
      alert('Erro: ' + (e.response?.data?.error || e.message));
    } finally { setSaving(false); }
  };

  const copiar = (txt) => copiarTexto(txt);

  return (
    <div className="max-w-2xl space-y-4">
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <h3 className="font-bold text-purple-900">📤 Gerar link de entrevista pra um candidato</h3>
        <p className="text-sm text-purple-800 mt-1">Selecione a vaga, preencha os dados do candidato e gere o link único pra enviar via WhatsApp.</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Vaga *</label>
        <select value={form.vaga_id} onChange={e => setForm({ ...form, vaga_id: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg">
          <option value="">Selecione...</option>
          {vagas.map(v => <option key={v.id} value={v.id}>{v.titulo}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">🎬 Modo de Entrevista *</label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { v: 'texto', i: '💬', t: 'Chat (Texto)', d: 'Candidato responde digitando. Mais simples, mais rápido.', custo: 'R$ 0,10-0,30', dispo: true },
            { v: 'voz',   i: '🎤', t: 'Voz', d: 'Candidato fala e ouve a Helen. TTS configurável.', custo: 'Grátis a R$ 0,40', dispo: true },
            { v: 'video', i: '📹', t: 'Vídeo', d: 'Grava webcam do candidato + voz da Helen. RH revisa o vídeo depois.', custo: 'Grátis (storage MinIO)', dispo: true },
          ].map(opt => (
            <button
              key={opt.v}
              type="button"
              disabled={!opt.dispo}
              onClick={() => opt.dispo && setForm({ ...form, modo_entrevista: opt.v })}
              className={`p-3 rounded-lg border-2 text-left transition-colors ${
                form.modo_entrevista === opt.v
                  ? 'border-orange-500 bg-orange-50'
                  : opt.dispo
                  ? 'border-gray-200 hover:border-orange-300'
                  : 'border-gray-200 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="text-2xl">{opt.i}</div>
              <div className="font-bold text-sm mt-1">{opt.t}</div>
              <div className="text-xs text-gray-600 mt-1">{opt.d}</div>
              <div className="text-xs text-orange-700 mt-1 font-medium">{opt.custo}</div>
              {!opt.dispo && <div className="text-xs text-gray-500 italic mt-1">🚧 Em breve</div>}
            </button>
          ))}
        </div>

        {/* SELETOR DE VOZ — aparece quando modo "voz" está selecionado */}
        {form.modo_entrevista === 'voz' && (
          <div className="mt-3 bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-bold text-gray-900 text-sm">🎤 Escolha o provedor de voz</h4>
                <p className="text-xs text-gray-600 mt-0.5">Compare 3 opções e escolha qual a {nomeRecrutadora} usa nessa entrevista.</p>
              </div>
              {form.voz_recrutadora && (
                <span className="text-xs bg-orange-200 text-orange-900 px-2 py-1 rounded-full font-medium whitespace-nowrap">
                  ✓ Escolhida
                </span>
              )}
            </div>

            {/* 4 CARDS DE PROVEDOR */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[
                { id: 'web_speech', i: '🆓', t: 'Web Speech', sub: 'Navegador (grátis)', q: '⭐⭐', desc: 'Robótica' },
                { id: 'azure',      i: '🇧🇷', t: 'Azure pt-BR', sub: '500k chars grátis/mês', q: '⭐⭐⭐⭐⭐', desc: 'Sotaque brasileiro real', destaque: true },
                { id: 'openai',     i: '✨', t: 'OpenAI HD',   sub: '~R$ 0,40/entrevista', q: '⭐⭐⭐⭐', desc: 'Sotaque americano' },
                { id: 'elevenlabs', i: '🎭', t: 'ElevenLabs',  sub: 'Free tier ou paga', q: '⭐⭐⭐⭐⭐', desc: 'Humana 100%' },
              ].map(p => (
                <button key={p.id} type="button"
                  onClick={() => { setProvedorTts(p.id); setForm({ ...form, voz_recrutadora: '' }); }}
                  className={`p-2 rounded-lg border-2 text-left relative ${
                    provedorTts === p.id ? 'border-orange-500 bg-orange-50' :
                    p.destaque ? 'border-green-400 bg-green-50 hover:border-green-500' :
                    'border-gray-200 bg-white hover:border-orange-300'
                  }`}>
                  {p.destaque && (
                    <span className="absolute -top-2 -right-1 bg-green-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                      RECOMENDADO
                    </span>
                  )}
                  <div className="text-lg">{p.i}</div>
                  <div className="font-bold text-xs">{p.t}</div>
                  <div className="text-[10px] text-gray-600">{p.sub}</div>
                  <div className="text-[10px] text-gray-500">{p.q}</div>
                  <div className={`text-[10px] font-medium ${p.destaque ? 'text-green-700' : 'text-orange-700'}`}>{p.desc}</div>
                </button>
              ))}
            </div>

            {/* Campo de texto livre pra testar */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                ✏️ Texto pra testar (escreva o que quiser, clica ▶ em uma voz e ela fala isso)
              </label>
              <textarea
                value={textoTeste}
                onChange={ev => setTextoTeste(ev.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                placeholder="Digite o texto que a voz vai falar..."
              />
            </div>

            {provedorTts === 'web_speech' && vozes.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-xs text-yellow-900 mb-2">
                ⚠️ Nenhuma voz pt-BR detectada nesse navegador. Use Chrome/Edge atualizado.
              </div>
            )}

            {/* Lista pra Azure pt-BR */}
            {provedorTts === 'azure' && (
              <div className="space-y-1.5 bg-white p-2 rounded">
                <p className="text-[11px] text-gray-600 mb-1">🇧🇷 Vozes Microsoft Azure Neural — sotaque brasileiro real, 500k chars grátis/mês</p>
                {vozesAzure.map(v => (
                  <div key={v.id} className={`flex items-center gap-2 p-2 rounded border ${
                    form.voz_recrutadora === v.id ? 'border-green-500 bg-green-50' : 'border-gray-200'
                  }`}>
                    <button type="button" onClick={() => tocarPreviewApi('azure', v.id)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs ${
                        tocando === v.id ? 'bg-green-600 animate-pulse' : 'bg-green-500 hover:bg-green-600'
                      }`}>
                      {tocando === v.id ? '🔊' : '▶'}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium">{v.genero === 'fem' ? '👩' : v.genero === 'mas' ? '👨' : '⚪'} {v.nome}</div>
                      <div className="text-[10px] text-gray-500">{v.desc}</div>
                    </div>
                    <button type="button" onClick={() => setForm({ ...form, voz_recrutadora: v.id })}
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        form.voz_recrutadora === v.id ? 'bg-green-600 text-white' : 'bg-gray-100 hover:bg-green-100'
                      }`}>
                      {form.voz_recrutadora === v.id ? '✓' : 'Escolher'}
                    </button>
                  </div>
                ))}
                <p className="text-[10px] text-gray-500 mt-2">
                  💡 Pra ativar: 1) Cria conta grátis em <strong>portal.azure.com</strong>. 2) Cria recurso "Speech Service" tier F0 (grátis, 500k chars/mês). 3) Copia a "Key 1" e a "Region". 4) Configure abaixo na seção API Keys.
                </p>
              </div>
            )}

            {/* Lista pra OpenAI */}
            {provedorTts === 'openai' && (
              <div className="space-y-1.5 bg-white p-2 rounded">
                <p className="text-[11px] text-gray-600 mb-1">✨ Vozes OpenAI TTS-1-HD (qualidade premium, ~R$ 0,40/entrevista)</p>
                {vozesOpenAI.map(v => (
                  <div key={v.id} className={`flex items-center gap-2 p-2 rounded border ${
                    form.voz_recrutadora === v.id ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
                  }`}>
                    <button type="button" onClick={() => tocarPreviewApi('openai', v.id)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs ${
                        tocando === v.id ? 'bg-orange-600 animate-pulse' : 'bg-orange-500 hover:bg-orange-600'
                      }`}>
                      {tocando === v.id ? '🔊' : '▶'}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium">{v.genero === 'fem' ? '👩' : v.genero === 'mas' ? '👨' : '⚪'} {v.nome}</div>
                      <div className="text-[10px] text-gray-500">{v.desc}</div>
                    </div>
                    <button type="button" onClick={() => setForm({ ...form, voz_recrutadora: v.id })}
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        form.voz_recrutadora === v.id ? 'bg-orange-600 text-white' : 'bg-gray-100 hover:bg-orange-100'
                      }`}>
                      {form.voz_recrutadora === v.id ? '✓' : 'Escolher'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Lista pra ElevenLabs */}
            {provedorTts === 'elevenlabs' && (
              <div className="space-y-1.5 bg-white p-2 rounded">
                <p className="text-[11px] text-gray-600 mb-1">🎭 Vozes ElevenLabs (gold standard - precisa API key configurada)</p>
                {vozesElevenLabs.map(v => (
                  <div key={v.id} className={`flex items-center gap-2 p-2 rounded border ${
                    form.voz_recrutadora === v.id ? 'border-purple-500 bg-purple-50' : 'border-gray-200'
                  }`}>
                    <button type="button" onClick={() => tocarPreviewApi('elevenlabs', v.id)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs ${
                        tocando === v.id ? 'bg-purple-600 animate-pulse' : 'bg-purple-500 hover:bg-purple-600'
                      }`}>
                      {tocando === v.id ? '🔊' : '▶'}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium">{v.genero === 'fem' ? '👩' : v.genero === 'mas' ? '👨' : '⚪'} {v.nome}</div>
                      <div className="text-[10px] text-gray-500">{v.desc}</div>
                    </div>
                    <button type="button" onClick={() => setForm({ ...form, voz_recrutadora: v.id })}
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        form.voz_recrutadora === v.id ? 'bg-purple-600 text-white' : 'bg-gray-100 hover:bg-purple-100'
                      }`}>
                      {form.voz_recrutadora === v.id ? '✓' : 'Escolher'}
                    </button>
                  </div>
                ))}
                <p className="text-[10px] text-gray-500 mt-2">
                  💡 Pra ativar: cadastre-se em <strong>elevenlabs.io</strong> (10k chars grátis/mês), copie a API Key (em "Profile") e configure abaixo.
                </p>
              </div>
            )}

            {/* SEÇÃO: Configurar API Keys (Azure + ElevenLabs) */}
            {(provedorTts === 'azure' || provedorTts === 'elevenlabs') && (
              <details className="mt-3 bg-blue-50 border border-blue-200 rounded p-2">
                <summary className="text-xs font-medium text-blue-900 cursor-pointer">
                  🔑 Configurar API Keys (clique pra abrir)
                </summary>
                <ConfigKeysAPI provedor={provedorTts} />
              </details>
            )}

            {provedorTts === 'web_speech' && vozes.length > 0 && (
              <div className="grid md:grid-cols-2 gap-3">
                {/* Femininas */}
                <div>
                  <h5 className="text-xs font-bold text-pink-700 mb-1.5">👩 Femininas</h5>
                  <div className="space-y-1.5">
                    {vozes.filter(v => adivinhaGenero(v.name) === 'fem').map(v => (
                      <div key={v.name} className={`flex items-center gap-1.5 p-1.5 rounded border ${
                        form.voz_recrutadora === v.name ? 'border-pink-500 bg-pink-50' : 'border-gray-200 bg-white'
                      }`}>
                        <button type="button" onClick={() => tocarPreview(v)}
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs ${
                            tocando === v.name ? 'bg-pink-600 animate-pulse' : 'bg-pink-500 hover:bg-pink-600'
                          }`} title="Ouvir">
                          {tocando === v.name ? '🔊' : '▶'}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate" title={v.name}>{v.name}</div>
                          <div className="text-[10px] text-gray-500">{v.lang}</div>
                        </div>
                        <button type="button" onClick={() => setForm({ ...form, voz_recrutadora: v.name })}
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                            form.voz_recrutadora === v.name ? 'bg-pink-600 text-white' : 'bg-gray-100 hover:bg-pink-100'
                          }`}>
                          {form.voz_recrutadora === v.name ? '✓' : 'Escolher'}
                        </button>
                      </div>
                    ))}
                    {vozes.filter(v => adivinhaGenero(v.name) === 'fem').length === 0 && (
                      <p className="text-xs text-gray-400 italic">Nenhuma feminina detectada</p>
                    )}
                  </div>
                </div>

                {/* Masculinas */}
                <div>
                  <h5 className="text-xs font-bold text-blue-700 mb-1.5">👨 Masculinas</h5>
                  <div className="space-y-1.5">
                    {vozes.filter(v => adivinhaGenero(v.name) === 'mas').map(v => (
                      <div key={v.name} className={`flex items-center gap-1.5 p-1.5 rounded border ${
                        form.voz_recrutadora === v.name ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
                      }`}>
                        <button type="button" onClick={() => tocarPreview(v)}
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs ${
                            tocando === v.name ? 'bg-blue-600 animate-pulse' : 'bg-blue-500 hover:bg-blue-600'
                          }`} title="Ouvir">
                          {tocando === v.name ? '🔊' : '▶'}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate" title={v.name}>{v.name}</div>
                          <div className="text-[10px] text-gray-500">{v.lang}</div>
                        </div>
                        <button type="button" onClick={() => setForm({ ...form, voz_recrutadora: v.name })}
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                            form.voz_recrutadora === v.name ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-blue-100'
                          }`}>
                          {form.voz_recrutadora === v.name ? '✓' : 'Escolher'}
                        </button>
                      </div>
                    ))}
                    {vozes.filter(v => adivinhaGenero(v.name) === 'mas').length === 0 && (
                      <p className="text-xs text-gray-400 italic">Nenhuma masculina detectada</p>
                    )}
                  </div>
                </div>

                {vozes.filter(v => adivinhaGenero(v.name) === 'neu').length > 0 && (
                  <div className="md:col-span-2">
                    <h5 className="text-xs font-bold text-gray-600 mb-1.5">⚪ Neutras / Outras</h5>
                    <div className="space-y-1.5">
                      {vozes.filter(v => adivinhaGenero(v.name) === 'neu').map(v => (
                        <div key={v.name} className={`flex items-center gap-1.5 p-1.5 rounded border ${
                          form.voz_recrutadora === v.name ? 'border-gray-500 bg-gray-100' : 'border-gray-200 bg-white'
                        }`}>
                          <button type="button" onClick={() => tocarPreview(v)}
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs ${
                              tocando === v.name ? 'bg-gray-700 animate-pulse' : 'bg-gray-500 hover:bg-gray-600'
                            }`}>
                            {tocando === v.name ? '🔊' : '▶'}
                          </button>
                          <div className="flex-1 text-xs">{v.name} <span className="text-[10px] text-gray-500">({v.lang})</span></div>
                          <button type="button" onClick={() => setForm({ ...form, voz_recrutadora: v.name })}
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              form.voz_recrutadora === v.name ? 'bg-gray-700 text-white' : 'bg-gray-100 hover:bg-gray-200'
                            }`}>
                            {form.voz_recrutadora === v.name ? '✓' : 'Escolher'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Nome do candidato *</label>
        <input value={form.candidato_nome} onChange={e => setForm({ ...form, candidato_nome: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="João Silva" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Telefone</label>
          <input value={form.candidato_telefone} onChange={e => setForm({ ...form, candidato_telefone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="11999999999" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">E-mail</label>
          <input value={form.candidato_email} onChange={e => setForm({ ...form, candidato_email: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="joao@email.com" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Link expira em (dias)</label>
        <input type="number" value={form.expira_dias} onChange={e => setForm({ ...form, expira_dias: parseInt(e.target.value) || 7 })}
          min={1} max={30} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
      </div>

      <button onClick={handleSubmit} disabled={saving || !form.vaga_id || !form.candidato_nome}
        className="w-full px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium disabled:opacity-50">
        {saving ? 'Gerando...' : '🔗 Gerar Link de Entrevista'}
      </button>

      {resultado && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
          <h3 className="font-bold text-green-900">✅ Link gerado pro candidato {resultado.candidato_nome}</h3>
          <div className="bg-white p-3 rounded border border-gray-200 break-all font-mono text-sm">{resultado.url}</div>
          <button onClick={() => copiar(resultado.url)} className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm">
            📋 Copiar Link
          </button>
          <p className="text-xs text-gray-600 mt-2">
            Mande esse link pra {resultado.candidato_nome} via WhatsApp. Ele pode abrir em qualquer navegador (sem login). O link expira em {form.expira_dias} dias.
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TAB: ENTREVISTAS REALIZADAS
// ============================================================================
function TabEntrevistas() {
  const [entrevistas, setEntrevistas] = useState([]);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [detalhe, setDetalhe] = useState(null);
  const [comparando, setComparando] = useState(false);

  const carregar = async () => {
    try {
      const url = filtroStatus ? `/recrutador/entrevistas?status=${filtroStatus}` : '/recrutador/entrevistas';
      const r = await api.get(url);
      setEntrevistas(r.data || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { carregar(); }, [filtroStatus]);

  const fmtCusto = (centavos) => 'R$ ' + ((centavos || 0) / 100).toFixed(2);
  const corStatus = (s) => ({
    pendente: 'bg-gray-200 text-gray-700',
    em_andamento: 'bg-blue-200 text-blue-700',
    finalizada: 'bg-green-200 text-green-700',
    expirada: 'bg-orange-200 text-orange-700',
    descartada: 'bg-red-200 text-red-700',
  })[s] || 'bg-gray-200 text-gray-700';
  const corRecomenda = (r) => ({
    contratar: 'bg-green-100 text-green-800 border-green-300',
    segunda_etapa: 'bg-blue-100 text-blue-800 border-blue-300',
    reserva: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    descartar: 'bg-red-100 text-red-800 border-red-300',
  })[r] || 'bg-gray-100 text-gray-700 border-gray-300';

  return (
    <div>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <div className="flex gap-3 items-center">
          <h2 className="text-lg font-bold">Entrevistas ({entrevistas.length})</h2>
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded text-sm">
            <option value="">Todos</option>
            <option value="pendente">Pendente</option>
            <option value="em_andamento">Em Andamento</option>
            <option value="finalizada">Finalizada</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setComparando(true)}
            className="px-4 py-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium text-sm flex items-center gap-2"
            title="Compare 2 ou mais candidatos da mesma vaga lado a lado"
          >
            📊 Comparar Candidatos
          </button>
          <div className="text-sm text-gray-500">
            Custo total: <strong>{fmtCusto(entrevistas.reduce((acc, e) => acc + (e.custo_estimado_centavos || 0), 0))}</strong>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {entrevistas.length === 0 && <p className="text-gray-500 text-center py-8">Nenhuma entrevista ainda.</p>}
        {entrevistas.map(e => {
          const linkPublico = `${window.location.origin}/recrutamento/${e.token}`;
          const podeCopiar = e.status === 'pendente' || e.status === 'em_andamento';
          return (
            <div key={e.id} className="p-3 bg-white rounded-lg border border-gray-200 hover:border-orange-300">
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 cursor-pointer" onClick={() => setDetalhe(e.id)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <strong className="text-gray-900">{e.candidato_nome}</strong>
                    <span className="text-sm text-gray-600">→ {e.vaga_titulo}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${corStatus(e.status)}`}>{e.status}</span>
                    {e.recomendacao && <span className={`text-xs px-2 py-0.5 rounded-full border ${corRecomenda(e.recomendacao)}`}>{e.recomendacao}</span>}
                  </div>
                  <div className="flex gap-3 text-xs text-gray-500 mt-1 flex-wrap">
                    {e.score_final !== null && <span>Score: <strong>{e.score_final}</strong></span>}
                    {e.disc_inferido && <span>DISC: <strong>{e.disc_inferido}</strong></span>}
                    <span>Tokens: {e.tokens_consumidos}</span>
                    <span>Custo: {fmtCusto(e.custo_estimado_centavos)}</span>
                    <span>Modelo: {e.modelo_usado || '-'}</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {podeCopiar && (
                    <button
                      onClick={(ev) => {
                        ev.stopPropagation();
                        copiarTexto(linkPublico);
                      }}
                      className="text-xs px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded font-medium"
                      title={linkPublico}
                    >
                      🔗 Copiar Link
                    </button>
                  )}
                  <button
                    onClick={async (ev) => {
                      ev.stopPropagation();
                      if (!confirm(`Excluir entrevista de ${e.candidato_nome}?\n\nEsta açao removerá o transcript e o relatório.`)) return;
                      try {
                        await api.delete(`/recrutador/entrevistas/${e.id}`);
                        carregar();
                      } catch (err) {
                        alert('Erro ao excluir: ' + (err.response?.data?.error || err.message));
                      }
                    }}
                    className="text-xs px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded font-medium"
                    title="Excluir entrevista"
                  >
                    🗑️ Excluir
                  </button>
                  <button onClick={() => setDetalhe(e.id)} className="text-sm text-orange-600 hover:underline">Ver detalhes →</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {detalhe && <ModalEntrevistaDetalhe id={detalhe} onClose={() => setDetalhe(null)} />}
      {comparando && <ModalComparacao entrevistas={entrevistas} onClose={() => setComparando(false)} />}
    </div>
  );
}

// ============================================================================
// MODAL: COMPARAR CANDIDATOS (radar sobreposto)
// ============================================================================
function ModalComparacao({ entrevistas, onClose }) {
  const [vagaId, setVagaId] = useState('');
  const [selecionadas, setSelecionadas] = useState(new Set());

  // Apenas finalizadas com relatorio
  const finalizadas = entrevistas.filter(e => e.status === 'finalizada' && e.score_final !== null);
  // Vagas distintas
  const vagas = [...new Map(finalizadas.map(e => [e.vaga_titulo, { titulo: e.vaga_titulo, count: 0 }])).values()];
  finalizadas.forEach(e => { const v = vagas.find(x => x.titulo === e.vaga_titulo); if (v) v.count++; });

  // Filtra por vaga
  const candidatos = vagaId
    ? finalizadas.filter(e => e.vaga_titulo === vagaId)
    : finalizadas;

  const toggle = (id) => {
    const ns = new Set(selecionadas);
    if (ns.has(id)) ns.delete(id);
    else if (ns.size < 6) ns.add(id);
    setSelecionadas(ns);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[95vh] overflow-y-auto" onClick={ev => ev.stopPropagation()}>
        <div className="p-6 border-b border-gray-200 sticky top-0 bg-white z-10 flex justify-between items-start">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">📊 Comparar Candidatos</h3>
            <p className="text-sm text-gray-600">Selecione até 6 candidatos da mesma vaga pra ver no mesmo gráfico</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>

        <div className="p-6 space-y-4">
          {/* Filtro por vaga */}
          <div>
            <label className="block text-sm font-medium mb-1">Filtrar por vaga (recomendado)</label>
            <select value={vagaId} onChange={e => { setVagaId(e.target.value); setSelecionadas(new Set()); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg">
              <option value="">Todas as vagas</option>
              {vagas.map(v => <option key={v.titulo} value={v.titulo}>{v.titulo} ({v.count})</option>)}
            </select>
          </div>

          {/* Lista de candidatos selecionáveis */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Candidatos disponíveis ({candidatos.length}) — selecionados: {selecionadas.size}/6
            </label>
            {candidatos.length === 0 && (
              <p className="text-sm text-gray-500 italic p-4 bg-gray-50 rounded">
                Nenhum candidato com relatório finalizado encontrado.
              </p>
            )}
            <div className="grid md:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
              {candidatos.map(c => (
                <label key={c.id} className={`flex items-center gap-2 p-2 rounded border cursor-pointer ${
                  selecionadas.has(c.id) ? 'bg-purple-50 border-purple-400' : 'bg-white border-gray-200 hover:border-purple-300'
                }`}>
                  <input type="checkbox" checked={selecionadas.has(c.id)} onChange={() => toggle(c.id)}
                    className="w-4 h-4" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c.candidato_nome}</div>
                    <div className="text-xs text-gray-500">
                      {c.vaga_titulo} • Score {c.score_final} • {c.recomendacao} {c.disc_inferido ? `• DISC ${c.disc_inferido}` : ''}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {selecionadas.size >= 1 && (
            <ComparacaoRadarChart candidatosIds={[...selecionadas]} />
          )}
        </div>
      </div>
    </div>
  );
}

// Gráfico radar sobreposto: carrega cada candidato e renderiza
function ComparacaoRadarChart({ candidatosIds }) {
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    Promise.all(candidatosIds.map(id => api.get(`/recrutador/entrevistas/${id}`).then(r => r.data.entrevista).catch(() => null)))
      .then(arr => { if (!cancelado) { setDados(arr.filter(Boolean)); setLoading(false); } });
    return () => { cancelado = true; };
  }, [candidatosIds.join(',')]);

  if (loading) return <div className="text-sm text-gray-500 p-4">Carregando...</div>;
  if (dados.length === 0) return null;

  const cores = [
    { bg: 'rgba(255, 99, 132, 0.20)', border: 'rgba(255, 99, 132, 1)' },   // pink
    { bg: 'rgba(54, 162, 235, 0.20)', border: 'rgba(54, 162, 235, 1)' },   // blue
    { bg: 'rgba(75, 192, 75, 0.20)',  border: 'rgba(75, 192, 75, 1)' },    // green
    { bg: 'rgba(255, 159, 64, 0.20)', border: 'rgba(255, 159, 64, 1)' },   // orange
    { bg: 'rgba(153, 102, 255, 0.20)',border: 'rgba(153, 102, 255, 1)' },  // purple
    { bg: 'rgba(255, 206, 86, 0.20)', border: 'rgba(255, 206, 86, 1)' },   // yellow
  ];

  const radarData = {
    labels: ['Técnica', 'Comportamental', 'Comunicação', 'Ética', 'Motivação', 'Fit Cultural'],
    datasets: dados.map((e, i) => {
      const dim = e.relatorio_json?.scores_dimensoes || {};
      const cor = cores[i % cores.length];
      return {
        label: `${e.candidato_nome} (${e.score_final})`,
        data: [
          dim.tecnica ?? 0, dim.comportamental ?? 0, dim.comunicacao ?? 0,
          dim.etica ?? 0, dim.motivacao ?? 0, dim.fit_cultural ?? 0
        ],
        backgroundColor: cor.bg,
        borderColor: cor.border,
        borderWidth: 2,
        pointBackgroundColor: cor.border,
        pointRadius: 4
      };
    })
  };
  const radarOptions = {
    scales: { r: { suggestedMin: 0, suggestedMax: 10, ticks: { stepSize: 2 } } },
    plugins: { legend: { position: 'top' } },
    maintainAspectRatio: false
  };

  // Ranking ordenado por score
  const ranking = [...dados].sort((a, b) => (b.score_final || 0) - (a.score_final || 0));
  const fmtBRL = (centavos) => 'R$ ' + ((centavos || 0) / 100).toFixed(2);
  const corReco = (r) => ({
    contratar: 'bg-green-100 text-green-800',
    segunda_etapa: 'bg-blue-100 text-blue-800',
    reserva: 'bg-yellow-100 text-yellow-800',
    descartar: 'bg-red-100 text-red-800'
  })[r] || 'bg-gray-100 text-gray-700';

  return (
    <div className="grid md:grid-cols-3 gap-4 mt-4">
      {/* Radar 2/3 */}
      <div className="md:col-span-2 bg-white border border-gray-200 rounded-xl p-4">
        <h4 className="font-bold mb-2">Comparativo de Dimensões</h4>
        <div style={{ height: '420px' }}>
          <Radar data={radarData} options={radarOptions} />
        </div>
      </div>

      {/* Ranking 1/3 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h4 className="font-bold mb-2">🏆 Ranking</h4>
        <div className="space-y-2">
          {ranking.map((e, idx) => (
            <div key={e.id} className="border border-gray-200 rounded-lg p-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}º`}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">{e.candidato_nome}</div>
                  <div className="text-xs text-gray-500">Score: <strong className="text-gray-900">{e.score_final}</strong></div>
                </div>
                <div className="w-3 h-3 rounded-full" style={{ background: cores[dados.findIndex(d => d.id === e.id) % cores.length].border }}></div>
              </div>
              <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-medium ${corReco(e.recomendacao)}`}>
                {e.recomendacao}
              </span>
              {e.disc_inferido && <span className="ml-1 text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">DISC {e.disc_inferido}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Resumo IA por candidato */}
      <div className="md:col-span-3 grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {dados.map((e, i) => (
          <div key={e.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: cores[i % cores.length].border }}></div>
              <strong className="text-sm">{e.candidato_nome}</strong>
            </div>
            <p className="text-xs text-gray-700 line-clamp-4">{e.relatorio_json?.resumo_final || '—'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModalEntrevistaDetalhe({ id, onClose }) {
  const [data, setData] = useState(null);

  useEffect(() => { (async () => {
    try { const r = await api.get(`/recrutador/entrevistas/${id}`); setData(r.data); }
    catch (e) { console.error(e); }
  })(); }, [id]);

  if (!data) return null;
  const { entrevista: e, respostas } = data;
  const r = e.relatorio_json || {};
  const dim = r.scores_dimensoes || {};

  const recoCfg = {
    contratar:    { cor: 'bg-green-500',  texto: '✅ CONTRATAR',  sub: 'Indicado para a vaga' },
    segunda_etapa:{ cor: 'bg-blue-500',   texto: '🔵 2ª ETAPA',   sub: 'Avançar para próxima fase' },
    reserva:      { cor: 'bg-yellow-500', texto: '⏸️ RESERVA',    sub: 'Manter no banco de talentos' },
    descartar:    { cor: 'bg-red-500',    texto: '❌ DESCARTAR',  sub: 'Não indicado para essa vaga' }
  }[e.recomendacao] || { cor: 'bg-gray-400', texto: '—', sub: '' };

  const sim = r.recomendacao_simples || (e.recomendacao === 'contratar' ? 'SIM' : e.recomendacao === 'descartar' ? 'NAO' : 'TALVEZ');

  const radarData = {
    labels: ['Técnica', 'Comportamental', 'Comunicação', 'Ética', 'Motivação', 'Fit Cultural'],
    datasets: [{
      label: e.candidato_nome,
      data: [dim.tecnica ?? 0, dim.comportamental ?? 0, dim.comunicacao ?? 0, dim.etica ?? 0, dim.motivacao ?? 0, dim.fit_cultural ?? 0],
      backgroundColor: 'rgba(255, 107, 0, 0.25)',
      borderColor: 'rgba(255, 107, 0, 1)',
      borderWidth: 2,
      pointBackgroundColor: 'rgba(255, 107, 0, 1)',
      pointRadius: 4
    }]
  };
  const radarOptions = {
    scales: { r: { suggestedMin: 0, suggestedMax: 10, ticks: { stepSize: 2 } } },
    plugins: { legend: { display: false } },
    maintainAspectRatio: false
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto" onClick={ev => ev.stopPropagation()}>
        <div className="p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-bold">{e.candidato_nome}</h3>
              <p className="text-sm text-gray-600">{e.vaga_titulo}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {!e.relatorio_json && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-900 flex items-center justify-between flex-wrap gap-3">
              <div>
                {e.status === 'finalizada' ? (
                  <>⚠️ Entrevista finalizada mas sem relatório (provavelmente estourou budget de tokens). Você pode gerar o relatório agora a partir do transcript.</>
                ) : (
                  <>⚠️ Esta entrevista ainda não foi finalizada — relatório só fica disponível ao concluir.</>
                )}
              </div>
              {(respostas.length > 0) && (
                <button
                  onClick={async () => {
                    if (!confirm('Gerar relatório agora a partir do transcript? Vai consumir tokens da OpenAI (~R$ 0,30).')) return;
                    try {
                      await api.post(`/recrutador/entrevistas/${e.id}/regerar-relatorio`);
                      alert('✅ Relatório gerado! Recarregando...');
                      window.location.reload();
                    } catch (err) {
                      alert('Erro: ' + (err.response?.data?.error || err.message));
                    }
                  }}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium text-sm whitespace-nowrap"
                >
                  🔄 Gerar Relatório agora
                </button>
              )}
            </div>
          )}

          {e.video_url && (
            <div className="bg-black rounded-xl overflow-hidden">
              <div className="bg-gray-900 text-white px-4 py-2 flex items-center justify-between">
                <span className="text-sm font-medium">📹 Vídeo da entrevista</span>
                <a href={e.video_url} download target="_blank" rel="noreferrer" className="text-xs text-blue-300 hover:underline">
                  ⬇️ Baixar vídeo
                </a>
              </div>
              <video src={e.video_url} controls className="w-full max-h-96 bg-black" preload="metadata" />
            </div>
          )}

          {e.relatorio_json && (
            <>
              <div className={`${recoCfg.cor} text-white rounded-xl p-5 flex items-center justify-between gap-4 flex-wrap`}>
                <div className="flex-1 min-w-[150px]">
                  <div className="text-xs uppercase opacity-80">Recomendação</div>
                  <div className="text-2xl font-bold">{recoCfg.texto}</div>
                  <div className="text-sm opacity-90 mt-0.5">{recoCfg.sub}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs uppercase opacity-80">Indicaria?</div>
                  <div className="text-3xl font-extrabold">{sim}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs uppercase opacity-80">Score</div>
                  <div className="text-4xl font-extrabold">{e.score_final}</div>
                  <div className="text-xs opacity-80">/100</div>
                </div>
                <div className="text-center">
                  <div className="text-xs uppercase opacity-80">DISC</div>
                  <div className="text-3xl font-bold">{e.disc_inferido || '—'}</div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-5">
                <div className="bg-white p-4 rounded-xl border border-gray-200">
                  <h4 className="font-bold mb-2 text-gray-900">📊 Análise por Dimensão</h4>
                  <div style={{ height: '280px' }}>
                    <Radar data={radarData} options={radarOptions} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                    {[['Técnica', dim.tecnica], ['Comport.', dim.comportamental], ['Comun.', dim.comunicacao], ['Ética', dim.etica], ['Motivação', dim.motivacao], ['Fit Cult.', dim.fit_cultural]].map(([lbl, v]) => (
                      <div key={lbl} className="bg-gray-50 p-2 rounded text-center">
                        <div className="text-gray-500">{lbl}</div>
                        <div className="font-bold text-gray-900">{v ?? '—'}/10</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-200">
                  <h4 className="font-bold mb-2 text-gray-900">📝 Resumo da Análise</h4>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{r.resumo_final}</p>
                  {r.compatibilidade_disc && (
                    <div className="mt-3 p-2 bg-purple-50 rounded text-xs text-purple-900">
                      <strong>Compatibilidade DISC:</strong> {r.compatibilidade_disc}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {r.pontos_fortes?.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <h4 className="font-bold text-green-900 mb-2 flex items-center gap-2"><span>💪</span> Pontos Fortes</h4>
                    <ul className="space-y-1.5 text-sm text-green-900">
                      {r.pontos_fortes.map((p, i) => <li key={i} className="flex gap-2"><span>✓</span><span>{p}</span></li>)}
                    </ul>
                  </div>
                )}
                {r.pontos_atencao?.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                    <h4 className="font-bold text-yellow-900 mb-2 flex items-center gap-2"><span>⚠️</span> Pontos de Atenção</h4>
                    <ul className="space-y-1.5 text-sm text-yellow-900">
                      {r.pontos_atencao.map((p, i) => <li key={i} className="flex gap-2"><span>•</span><span>{p}</span></li>)}
                    </ul>
                  </div>
                )}
                {r.possiveis_ganhos?.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2"><span>🚀</span> Possíveis Ganhos com a Contratação</h4>
                    <ul className="space-y-1.5 text-sm text-blue-900">
                      {r.possiveis_ganhos.map((p, i) => <li key={i} className="flex gap-2"><span>+</span><span>{p}</span></li>)}
                    </ul>
                  </div>
                )}
                {r.possiveis_problemas?.length > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <h4 className="font-bold text-orange-900 mb-2 flex items-center gap-2"><span>🎯</span> Possíveis Problemas / Riscos</h4>
                    <ul className="space-y-1.5 text-sm text-orange-900">
                      {r.possiveis_problemas.map((p, i) => <li key={i} className="flex gap-2"><span>!</span><span>{p}</span></li>)}
                    </ul>
                  </div>
                )}
                {r.red_flags?.length > 0 && (
                  <div className="bg-red-50 border border-red-300 rounded-xl p-4 md:col-span-2">
                    <h4 className="font-bold text-red-900 mb-2 flex items-center gap-2"><span>🚩</span> Red Flags Detectados</h4>
                    <ul className="space-y-1.5 text-sm text-red-900">
                      {r.red_flags.map((p, i) => <li key={i} className="flex gap-2"><span>⚠</span><span>{p}</span></li>)}
                    </ul>
                  </div>
                )}
                {r.sugestao_treinamento?.length > 0 && (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 md:col-span-2">
                    <h4 className="font-bold text-purple-900 mb-2 flex items-center gap-2"><span>🎓</span> Treinamentos Sugeridos (caso contrate)</h4>
                    <ul className="space-y-1.5 text-sm text-purple-900">
                      {r.sugestao_treinamento.map((p, i) => <li key={i} className="flex gap-2"><span>→</span><span>{p}</span></li>)}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h4 className="font-bold mb-3 text-gray-900">💬 Transcript Completo ({respostas.length} turnos)</h4>
            <div className="space-y-3">
              {respostas.map((rr, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="bg-orange-50 p-3 rounded-lg border-l-4 border-orange-400">
                    <strong className="text-xs text-orange-700">👩‍💼 Entrevistadora ({rr.ordem}):</strong>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{rr.pergunta}</p>
                  </div>
                  {rr.resposta && (
                    <div className="bg-gray-50 p-3 rounded-lg border-l-4 border-gray-400 ml-6">
                      <strong className="text-xs text-gray-700">👤 {e.candidato_nome}:</strong>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{rr.resposta}</p>
                      {rr.analise_ia && <p className="text-xs text-gray-500 mt-1 italic">Análise IA: {rr.analise_ia}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="text-xs text-gray-500 border-t pt-3 flex justify-between flex-wrap gap-2">
            <span><strong>Custo:</strong> R$ {((e.custo_estimado_centavos || 0) / 100).toFixed(2)} ({e.tokens_consumidos} tokens, {e.modelo_usado})</span>
            <span><strong>Iniciada:</strong> {e.iniciada_em ? new Date(e.iniciada_em).toLocaleString('pt-BR') : '—'} | <strong>Finalizada:</strong> {e.finalizada_em ? new Date(e.finalizada_em).toLocaleString('pt-BR') : '—'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENTE: ConfigKeysAPI — inputs pra configurar as keys de Azure/ElevenLabs
// ============================================================================
function ConfigKeysAPI({ provedor }) {
  const [azureKey, setAzureKey] = useState('');
  const [azureRegion, setAzureRegion] = useState('brazilsouth');
  const [elevenKey, setElevenKey] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState('');

  const salvar = async () => {
    setSalvando(true); setMsg('');
    try {
      const data = {};
      if (provedor === 'azure') {
        if (azureKey) data.azure_speech_key = azureKey;
        if (azureRegion) data.azure_speech_region = azureRegion;
      }
      if (provedor === 'elevenlabs') {
        if (elevenKey) data.elevenlabs_api_key = elevenKey;
      }
      if (Object.keys(data).length === 0) { setMsg('⚠️ Preencha algum campo'); return; }
      await api.post('/config/configurations', data);
      setMsg('✅ Salvo! Já pode testar a voz clicando ▶ acima.');
      setAzureKey(''); setElevenKey('');
    } catch (e) {
      setMsg('❌ Erro: ' + (e.response?.data?.error || e.message));
    } finally { setSalvando(false); }
  };

  return (
    <div className="mt-2 space-y-2">
      {provedor === 'azure' && (
        <>
          <div>
            <label className="block text-[11px] font-medium text-gray-700 mb-0.5">Azure Speech Key (Key 1)</label>
            <input type="password" value={azureKey} onChange={e => setAzureKey(e.target.value)}
              placeholder="cole aqui a key do Azure Speech Service" autoComplete="off"
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs font-mono" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-700 mb-0.5">Region</label>
            <select value={azureRegion} onChange={e => setAzureRegion(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs">
              <option value="brazilsouth">Brazil South (recomendado)</option>
              <option value="eastus">East US</option>
              <option value="westus">West US</option>
              <option value="westeurope">West Europe</option>
            </select>
          </div>
        </>
      )}
      {provedor === 'elevenlabs' && (
        <div>
          <label className="block text-[11px] font-medium text-gray-700 mb-0.5">ElevenLabs API Key</label>
          <input type="password" value={elevenKey} onChange={e => setElevenKey(e.target.value)}
            placeholder="cole aqui a API key do ElevenLabs" autoComplete="off"
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs font-mono" />
        </div>
      )}
      <div className="flex items-center gap-2">
        <button type="button" onClick={salvar} disabled={salvando}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs disabled:opacity-50">
          {salvando ? 'Salvando...' : '💾 Salvar Key'}
        </button>
        {msg && <span className="text-xs">{msg}</span>}
      </div>
    </div>
  );
}
