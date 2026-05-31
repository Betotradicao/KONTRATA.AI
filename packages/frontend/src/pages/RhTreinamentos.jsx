import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import RadarLoading from '../components/RadarLoading';

const initialForm = {
  empresa_id: '',
  colaborador_id: '',
  colaborador_ids: [], // multi-select; quando >1, vira lote (cria 1 treinamento por colab)
  tipo_treinamento_id: '',
  nome_treinamento: '',
  instrutor: '',
  instituicao: '',
  local: '',
  local_tipo: 'INTERNO',
  carga_horaria: '',
  data_inicio: '',
  data_fim: '',
  hora_inicio: '',
  hora_fim: '',
  custo: '',
  status_id: '',
  observacoes: '',
};

export default function RhTreinamentos() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [treinamentos, setTreinamentos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dropdowns
  const [tipos, setTipos] = useState([]);
  const [statusList, setStatusList] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [materiais, setMateriais] = useState([]);
  const [origem, setOrigem] = useState('LIVRE'); // 'LIVRE' | 'PRONTO'

  // Modal
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [formData, setFormData] = useState(initialForm);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [treiRes, tiposRes, statusRes, colabRes, empRes, matRes] = await Promise.all([
        api.get('/rh/treinamentos'),
        api.get('/rh/configuracoes/tipos-treinamento'),
        api.get('/rh/configuracoes/status-treinamento'),
        api.get('/rh/colaboradores?status=ativo&limit=500'),
        api.get('/rh/empresas'),
        api.get('/rh/treinamentos-materiais').catch(() => ({ data: [] })),
      ]);
      const asArray = (resp, key) => {
        const d = resp?.data;
        if (Array.isArray(d)) return d;
        if (key && Array.isArray(d?.[key])) return d[key];
        if (Array.isArray(d?.data)) return d.data;
        return [];
      };
      setTreinamentos(asArray(treiRes));
      setTipos(asArray(tiposRes));
      setStatusList(asArray(statusRes));
      setColaboradores(asArray(colabRes, 'colaboradores'));
      setEmpresas(asArray(empRes, 'empresas'));
      setMateriais(asArray(matRes));
    } catch (err) {
      toast.error('Erro ao carregar treinamentos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('pt-BR');
  };

  const abrirModal = (treinamento = null) => {
    if (treinamento) {
      setEditando(treinamento);
      setFormData({
        empresa_id: treinamento.empresa_id || '',
        colaborador_id: treinamento.colaborador_id || '',
        colaborador_ids: treinamento.colaborador_id ? [treinamento.colaborador_id] : [],
        tipo_treinamento_id: treinamento.tipo_treinamento_id || '',
        nome_treinamento: treinamento.nome_treinamento || '',
        instrutor: treinamento.instrutor || '',
        instituicao: treinamento.instituicao || '',
        local: treinamento.local || '',
        local_tipo: treinamento.local_tipo || 'INTERNO',
        carga_horaria: treinamento.carga_horaria || '',
        data_inicio: treinamento.data_inicio ? treinamento.data_inicio.substring(0, 10) : '',
        data_fim: treinamento.data_fim ? treinamento.data_fim.substring(0, 10) : '',
        hora_inicio: treinamento.hora_inicio ? treinamento.hora_inicio.substring(0, 5) : '',
        hora_fim: treinamento.hora_fim ? treinamento.hora_fim.substring(0, 5) : '',
        custo: treinamento.custo || '',
        status_id: treinamento.status_id || '',
        observacoes: treinamento.observacoes || '',
      });
    } else {
      setEditando(null);
      setFormData(initialForm);
    }
    setOrigem('LIVRE'); // resetar pra LIVRE por padrao ao abrir modal
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setEditando(null);
    setFormData(initialForm);
  };

  // Campos que NAO devem ser maiusculizados (numericos/dates/times/selects vazios)
  const NAO_UPPER = new Set(['custo', 'carga_horaria', 'data_inicio', 'data_fim', 'hora_inicio', 'hora_fim']);
  const handleChange = (e) => {
    const { name, value } = e.target;
    const v = (typeof value === 'string' && !NAO_UPPER.has(name)) ? value.toUpperCase() : value;
    setFormData((prev) => ({ ...prev, [name]: v }));
  };

  // Quando muda o colaborador, exibimos Setor/Função vindos do registro dele.
  // Esses campos sao read-only no modal — derivados, nao salvos na ficha do
  // treinamento (a fonte da verdade fica em rh_colaboradores).
  // Em modo LOTE (varios colabs selecionados), setor/funcao ficam "(varia)".
  const isLote = (formData.colaborador_ids || []).length > 1;
  const unicoColabId = isLote ? null : (formData.colaborador_ids?.[0] || formData.colaborador_id);
  const colabSelecionado = colaboradores.find(c => String(c.id) === String(unicoColabId));
  const setorDoColab = isLote ? '— VARIA —' : (colabSelecionado?.setor_nome || colabSelecionado?.setor_departamento_nome || '');
  const cargoDoColab = isLote ? '— VARIA —' : (colabSelecionado?.cargo_nome || '');

  // Toggle de selecao individual no multi-select
  const toggleColab = (id) => {
    const ids = formData.colaborador_ids || [];
    const has = ids.some(x => String(x) === String(id));
    const next = has ? ids.filter(x => String(x) !== String(id)) : [...ids, id];
    setFormData(prev => ({ ...prev, colaborador_ids: next, colaborador_id: next.length === 1 ? next[0] : '' }));
  };

  // UI de busca dentro do multi-select
  const [buscaColab, setBuscaColab] = useState('');
  const [showColabPicker, setShowColabPicker] = useState(false);
  const colabsFiltrados = colaboradores.filter(c =>
    !buscaColab.trim() ||
    (c.nome || '').toLowerCase().includes(buscaColab.toLowerCase())
  );
  const nomesSelecionados = (formData.colaborador_ids || [])
    .map(id => colaboradores.find(c => String(c.id) === String(id))?.nome)
    .filter(Boolean);

  const handleSalvar = async () => {
    if (!formData.nome_treinamento.trim()) {
      toast.error('Nome do treinamento e obrigatorio');
      return;
    }
    try {
      setSalvando(true);
      if (editando) {
        // Edicao continua single (1 colaborador por linha)
        await api.put(`/rh/treinamentos/${editando.id}`, formData);
        toast.success('Treinamento atualizado com sucesso');
      } else {
        // Criacao: se varios colaboradores selecionados, cria 1 treinamento por colab.
        // Setor/Funcao sao derivados do colaborador (nao salvos aqui), entao podem variar.
        const ids = (formData.colaborador_ids || []).filter(Boolean);
        if (ids.length > 1) {
          // Cria em lote — uma chamada por colaborador
          let ok = 0, fail = 0;
          for (const cid of ids) {
            try {
              await api.post('/rh/treinamentos', { ...formData, colaborador_id: cid });
              ok++;
            } catch (e) { fail++; console.error('Erro lote:', e); }
          }
          if (fail === 0) toast.success(`${ok} treinamentos criados`);
          else toast.error(`${ok} criados, ${fail} falharam`);
        } else {
          await api.post('/rh/treinamentos', formData);
          toast.success('Treinamento criado com sucesso');
        }
      }
      fecharModal();
      fetchAll();
    } catch (err) {
      toast.error('Erro ao salvar treinamento');
      console.error(err);
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (id) => {
    if (!window.confirm('Deseja realmente excluir este treinamento?')) return;
    try {
      await api.delete(`/rh/treinamentos/${id}`);
      toast.success('Treinamento excluido com sucesso');
      fetchAll();
    } catch (err) {
      toast.error('Erro ao excluir treinamento');
      console.error(err);
    }
  };

  const getStatusBadge = (treinamento) => {
    const statusNome = treinamento.status_nome || '-';
    const statusCor = treinamento.status_cor || '#6b7280';
    return (
      <span
        className="px-2 py-1 rounded-full text-xs font-medium"
        style={{ backgroundColor: `${statusCor}20`, color: statusCor }}
      >
        {statusNome}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-100">
        <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
        <div className="flex-1 flex items-center justify-center">
          <RadarLoading />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Treinamentos</h1>
              <p className="text-orange-100 text-sm mt-1">Gestao de treinamentos e capacitacoes</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/rh/treinamentos/calendario')}
                className="bg-white/20 hover:bg-white/30 text-white border border-white/40 px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-1"
              >
                📅 Calendário
              </button>
              <button
                onClick={() => abrirModal()}
                className="bg-white text-orange-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-50 transition"
              >
                + Novo Treinamento
              </button>
              <button
                className="md:hidden text-white"
                onClick={() => setIsMobileMenuOpen(true)}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
              <p className="text-sm text-gray-600">Total Treinamentos</p>
              <p className="text-2xl font-bold text-gray-900">{treinamentos.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 border border-blue-200">
              <p className="text-sm text-gray-600">Tipos de Treinamento</p>
              <p className="text-2xl font-bold text-blue-600">{tipos.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 border border-green-200">
              <p className="text-sm text-gray-600">Colaboradores Treinados</p>
              <p className="text-2xl font-bold text-green-600">
                {new Set(treinamentos.map((t) => t.colaborador_id).filter(Boolean)).size}
              </p>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Colaborador</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Treinamento</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Instrutor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data Inicio</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data Fim</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Carga Horaria</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acoes</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {treinamentos.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                        Nenhum treinamento cadastrado
                      </td>
                    </tr>
                  ) : (
                    treinamentos.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{t.colaborador_nome || '-'}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{t.nome_treinamento}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{t.tipo_nome || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{t.instrutor || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatDate(t.data_inicio)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatDate(t.data_fim)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{t.carga_horaria ? `${t.carga_horaria}h` : '-'}</td>
                        <td className="px-4 py-3 text-sm">{getStatusBadge(t)}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex gap-2">
                            <button
                              onClick={() => abrirModal(t)}
                              className="text-orange-600 hover:text-orange-800 text-xs font-medium"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleExcluir(t.id)}
                              className="text-red-600 hover:text-red-800 text-xs font-medium"
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal */}
        {modalAberto && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">{editando ? 'Editar Treinamento' : 'Novo Treinamento'}</h2>
                <button onClick={fecharModal} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Loja</label>
                    <select
                      name="empresa_id"
                      value={formData.empresa_id}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="">SELECIONE...</option>
                      {empresas.map((e) => (
                        <option key={e.id} value={e.id}>{e.apelido || e.nomeFantasia || e.razaoSocial || '(sem nome)'}</option>
                      ))}
                    </select>
                  </div>
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Colaborador(es){nomesSelecionados.length > 0 && <span className="ml-2 text-xs font-bold text-orange-600">({nomesSelecionados.length} selecionado{nomesSelecionados.length > 1 ? 's' : ''})</span>}
                    </label>
                    <button type="button"
                      onClick={() => setShowColabPicker(v => !v)}
                      className="w-full text-left px-3 py-2 border border-gray-300 rounded-lg bg-white hover:border-orange-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm flex items-center justify-between">
                      <span className="truncate">
                        {nomesSelecionados.length === 0 && <span className="text-gray-400">SELECIONE...</span>}
                        {nomesSelecionados.length === 1 && nomesSelecionados[0]}
                        {nomesSelecionados.length > 1 && `${nomesSelecionados.length} colaboradores selecionados`}
                      </span>
                      <span className="text-gray-400 ml-2">{showColabPicker ? '▲' : '▼'}</span>
                    </button>
                    {showColabPicker && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-72 overflow-hidden flex flex-col">
                        <div className="p-2 border-b border-gray-200 flex items-center gap-2">
                          <input type="text" value={buscaColab} onChange={e => setBuscaColab(e.target.value)}
                            placeholder="🔍 Buscar..."
                            className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm" />
                          <button type="button" onClick={() => setFormData(prev => ({ ...prev, colaborador_ids: [], colaborador_id: '' }))}
                            className="text-xs text-red-600 hover:underline">Limpar</button>
                        </div>
                        <div className="overflow-y-auto flex-1">
                          {colabsFiltrados.length === 0 && <div className="p-3 text-sm text-gray-400 text-center">Nenhum colaborador</div>}
                          {colabsFiltrados.map((c) => {
                            const checked = (formData.colaborador_ids || []).some(x => String(x) === String(c.id));
                            return (
                              <label key={c.id}
                                className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-orange-50 text-sm ${checked ? 'bg-orange-50' : ''}`}>
                                <input type="checkbox" checked={checked} onChange={() => toggleColab(c.id)}
                                  className="w-4 h-4 accent-orange-500" />
                                <span className={checked ? 'font-semibold text-orange-900' : ''}>{c.nome}</span>
                              </label>
                            );
                          })}
                        </div>
                        <div className="p-2 border-t border-gray-200 bg-gray-50 text-right">
                          <button type="button" onClick={() => setShowColabPicker(false)}
                            className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs font-semibold">
                            ✓ OK
                          </button>
                        </div>
                      </div>
                    )}
                    {isLote && (
                      <p className="text-[10px] text-amber-700 mt-1 italic">⚠️ Lote: vai criar 1 treinamento pra cada colaborador. Setor/Função ficam ocultos pois variam.</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Setor</label>
                    <input
                      type="text"
                      value={setorDoColab}
                      readOnly
                      disabled={isLote}
                      placeholder="— ESCOLHA O COLABORADOR —"
                      className={`w-full px-3 py-2 border rounded-lg text-sm ${isLote ? 'border-gray-200 bg-gray-100 text-gray-400 italic' : 'border-gray-200 bg-gray-50 text-gray-700'}`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Função / Cargo</label>
                    <input
                      type="text"
                      value={cargoDoColab}
                      readOnly
                      disabled={isLote}
                      placeholder="— ESCOLHA O COLABORADOR —"
                      className={`w-full px-3 py-2 border rounded-lg text-sm ${isLote ? 'border-gray-200 bg-gray-100 text-gray-400 italic' : 'border-gray-200 bg-gray-50 text-gray-700'}`}
                    />
                  </div>
                  {/* Origem do treinamento: PRONTO (pega da Biblioteca) ou LIVRE (digita) */}
                  <div className="md:col-span-2 bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="origem_treinamento" value="PRONTO" checked={origem === 'PRONTO'}
                          onChange={() => setOrigem('PRONTO')}
                          className="w-4 h-4 accent-indigo-600" />
                        <span className="text-sm font-semibold text-indigo-900">📚 PRONTO (da Biblioteca)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="origem_treinamento" value="LIVRE" checked={origem === 'LIVRE'}
                          onChange={() => setOrigem('LIVRE')}
                          className="w-4 h-4 accent-indigo-600" />
                        <span className="text-sm font-semibold text-indigo-900">✏️ LIVRE (digite o tema)</span>
                      </label>
                    </div>
                    <p className="text-[10px] text-indigo-700 mt-1">
                      PRONTO = escolha entre materiais já cadastrados em <strong>CADASTRAR TREINAMENTO</strong>.
                      LIVRE = digite o tema do treinamento livremente.
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tema do Treinamento *</label>
                    {origem === 'PRONTO' ? (
                      <select
                        name="nome_treinamento"
                        value={formData.nome_treinamento}
                        onChange={(e) => {
                          // Quando escolhe da biblioteca, preenche o tema com o nome do material
                          setFormData(prev => ({ ...prev, nome_treinamento: e.target.value }));
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      >
                        <option value="">SELECIONE DA BIBLIOTECA...</option>
                        {materiais.length === 0 && (
                          <option disabled>— BIBLIOTECA VAZIA — cadastre em "CADASTRAR TREINAMENTO" —</option>
                        )}
                        {materiais.map((m) => {
                          const label = m.tema ? `${m.tema} — ${m.nome}` : m.nome;
                          return <option key={m.id} value={label}>{label}</option>;
                        })}
                      </select>
                    ) : (
                      <input
                        type="text"
                        name="nome_treinamento"
                        value={formData.nome_treinamento}
                        onChange={handleChange}
                        placeholder="EX: NR-35 TRABALHO EM ALTURA"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Treinamento</label>
                    <select
                      name="tipo_treinamento_id"
                      value={formData.tipo_treinamento_id}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="">SELECIONE...</option>
                      {tipos.map((t) => (
                        <option key={t.id} value={t.id}>{t.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Local *</label>
                    <select
                      name="local_tipo"
                      value={formData.local_tipo}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="INTERNO">INTERNO (NA EMPRESA)</option>
                      <option value="EXTERNO">EXTERNO (FORA DA EMPRESA)</option>
                    </select>
                  </div>
                  {formData.local_tipo === 'EXTERNO' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Escola / Instituição</label>
                        <input
                          type="text"
                          name="instituicao"
                          value={formData.instituicao}
                          onChange={handleChange}
                          placeholder="EX: SENAC, SESI..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Endereço / Local Externo</label>
                        <input
                          type="text"
                          name="local"
                          value={formData.local}
                          onChange={handleChange}
                          placeholder="EX: RUA X, 123 - SALA 4"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                      </div>
                    </>
                  )}
                  {formData.local_tipo === 'INTERNO' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Sala / Local Interno</label>
                      <input
                        type="text"
                        name="local"
                        value={formData.local}
                        onChange={handleChange}
                        placeholder="EX: SALA DE TREINAMENTO, REFEITÓRIO"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Instrutor</label>
                    <input
                      type="text"
                      name="instrutor"
                      value={formData.instrutor}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data Início</label>
                    <input
                      type="date"
                      name="data_inicio"
                      value={formData.data_inicio}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data Fim</label>
                    <input
                      type="date"
                      name="data_fim"
                      value={formData.data_fim}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Horário Início</label>
                    <input
                      type="time"
                      name="hora_inicio"
                      value={formData.hora_inicio}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Horário Fim</label>
                    <input
                      type="time"
                      name="hora_fim"
                      value={formData.hora_fim}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Carga Horária (h)</label>
                    <input
                      type="number"
                      name="carga_horaria"
                      value={formData.carga_horaria}
                      onChange={handleChange}
                      min="0"
                      step="0.5"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Custo (R$)</label>
                    <input
                      type="number"
                      name="custo"
                      value={formData.custo}
                      onChange={handleChange}
                      step="0.01"
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      name="status_id"
                      value={formData.status_id}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="">SELECIONE...</option>
                      {statusList.map((s) => (
                        <option key={s.id} value={s.id}>{s.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                    <textarea
                      name="observacoes"
                      value={formData.observacoes}
                      onChange={handleChange}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={fecharModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSalvar}
                  disabled={salvando}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium disabled:opacity-50"
                >
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
