import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import RadarLoading from '../components/RadarLoading';

const initialForm = {
  colaborador_id: '',
  tipo_treinamento_id: '',
  nome_treinamento: '',
  instrutor: '',
  instituicao: '',
  local: '',
  carga_horaria: '',
  data_inicio: '',
  data_fim: '',
  custo: '',
  status_id: '',
  observacoes: '',
};

export default function RhTreinamentos() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [treinamentos, setTreinamentos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dropdowns
  const [tipos, setTipos] = useState([]);
  const [statusList, setStatusList] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);

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
      const [treiRes, tiposRes, statusRes, colabRes] = await Promise.all([
        api.get('/rh/treinamentos'),
        api.get('/rh/configuracoes/tipos-treinamento'),
        api.get('/rh/configuracoes/status-treinamento'),
        api.get('/rh/colaboradores?status=ativo&limit=500'),
      ]);
      setTreinamentos(treiRes.data || []);
      setTipos(tiposRes.data || []);
      setStatusList(statusRes.data || []);
      setColaboradores(colabRes.data.colaboradores || colabRes.data || []);
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
        colaborador_id: treinamento.colaborador_id || '',
        tipo_treinamento_id: treinamento.tipo_treinamento_id || '',
        nome_treinamento: treinamento.nome_treinamento || '',
        instrutor: treinamento.instrutor || '',
        instituicao: treinamento.instituicao || '',
        local: treinamento.local || '',
        carga_horaria: treinamento.carga_horaria || '',
        data_inicio: treinamento.data_inicio ? treinamento.data_inicio.substring(0, 10) : '',
        data_fim: treinamento.data_fim ? treinamento.data_fim.substring(0, 10) : '',
        custo: treinamento.custo || '',
        status_id: treinamento.status_id || '',
        observacoes: treinamento.observacoes || '',
      });
    } else {
      setEditando(null);
      setFormData(initialForm);
    }
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setEditando(null);
    setFormData(initialForm);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSalvar = async () => {
    if (!formData.nome_treinamento.trim()) {
      toast.error('Nome do treinamento e obrigatorio');
      return;
    }
    try {
      setSalvando(true);
      if (editando) {
        await api.put(`/rh/treinamentos/${editando.id}`, formData);
        toast.success('Treinamento atualizado com sucesso');
      } else {
        await api.post('/rh/treinamentos', formData);
        toast.success('Treinamento criado com sucesso');
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
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Colaborador</label>
                    <select
                      name="colaborador_id"
                      value={formData.colaborador_id}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="">Selecione...</option>
                      {colaboradores.map((c) => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Treinamento</label>
                    <select
                      name="tipo_treinamento_id"
                      value={formData.tipo_treinamento_id}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="">Selecione...</option>
                      {tipos.map((t) => (
                        <option key={t.id} value={t.id}>{t.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Treinamento *</label>
                    <input
                      type="text"
                      name="nome_treinamento"
                      value={formData.nome_treinamento}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Instituicao</label>
                    <input
                      type="text"
                      name="instituicao"
                      value={formData.instituicao}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Local</label>
                    <input
                      type="text"
                      name="local"
                      value={formData.local}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Carga Horaria (h)</label>
                    <input
                      type="number"
                      name="carga_horaria"
                      value={formData.carga_horaria}
                      onChange={handleChange}
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data Inicio</label>
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
                      <option value="">Selecione...</option>
                      {statusList.map((s) => (
                        <option key={s.id} value={s.id}>{s.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Observacoes</label>
                    <textarea
                      name="observacoes"
                      value={formData.observacoes}
                      onChange={handleChange}
                      rows={3}
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
