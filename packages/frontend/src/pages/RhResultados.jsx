import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../contexts/AuthContext';
import RadarLoading from '../components/RadarLoading';
import toast from 'react-hot-toast';

export default function RhResultados() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('admissoes');
  const [colaboradores, setColaboradores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');

  const abas = [
    { id: 'admissoes', label: 'Admissoes' },
    { id: 'desligamentos', label: 'Desligamentos' }
  ];

  useEffect(() => {
    carregarDados();
  }, [abaAtiva]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const status = abaAtiva === 'admissoes' ? 'ativo' : 'desligado';
      const response = await api.get(`/rh/colaboradores?status=${status}&limit=50`);
      const data = response.data;
      const lista = Array.isArray(data?.data) ? data.data
        : Array.isArray(data?.colaboradores) ? data.colaboradores
        : Array.isArray(data) ? data
        : [];
      setColaboradores(lista);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados de colaboradores');
      setColaboradores([]);
    } finally {
      setLoading(false);
    }
  };

  const formatarData = (data) => {
    if (!data) return '-';
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const formatarMoeda = (valor) => {
    if (!valor && valor !== 0) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  const agora = new Date();
  const mesAtual = agora.getMonth();
  const anoAtual = agora.getFullYear();

  const totalNoMes = colaboradores.filter((c) => {
    const campo = abaAtiva === 'admissoes' ? c.data_admissao : c.data_desligamento;
    if (!campo) return false;
    const d = new Date(campo);
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
  }).length;

  const totalNoAno = colaboradores.filter((c) => {
    const campo = abaAtiva === 'admissoes' ? c.data_admissao : c.data_desligamento;
    if (!campo) return false;
    const d = new Date(campo);
    return d.getFullYear() === anoAtual;
  }).length;

  const colaboradoresFiltrados = colaboradores.filter((c) => {
    if (!busca) return true;
    const termo = busca.toLowerCase();
    return (
      (c.nome && c.nome.toLowerCase().includes(termo)) ||
      (c.matricula && String(c.matricula).includes(termo)) ||
      (c.cargo && c.cargo.toLowerCase().includes(termo))
    );
  });

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Resultados RH</h1>
              <p className="text-orange-100 text-sm mt-1">Controle de admissoes e desligamentos</p>
            </div>
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

        <div className="p-6">
          {/* Abas */}
          <div className="flex gap-3 mb-6">
            {abas.map((aba) => (
              <button
                key={aba.id}
                onClick={() => setAbaAtiva(aba.id)}
                className={`
                  flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-sm transition-all
                  ${abaAtiva === aba.id
                    ? 'bg-white text-gray-900 shadow-md border-2 border-orange-500'
                    : 'bg-white text-gray-700 hover:bg-gray-50 shadow-sm border border-gray-200'
                  }
                `}
              >
                {aba.label}
              </button>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
              <p className="text-sm text-gray-600">Total Carregado</p>
              <p className="text-2xl font-bold text-gray-900">{colaboradores.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
              <p className="text-sm text-gray-600">
                {abaAtiva === 'admissoes' ? 'Admissoes no Mes' : 'Desligamentos no Mes'}
              </p>
              <p className={`text-2xl font-bold ${abaAtiva === 'admissoes' ? 'text-green-600' : 'text-red-600'}`}>
                {totalNoMes}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
              <p className="text-sm text-gray-600">
                {abaAtiva === 'admissoes' ? 'Admissoes no Ano' : 'Desligamentos no Ano'}
              </p>
              <p className="text-2xl font-bold text-blue-600">{totalNoAno}</p>
            </div>
          </div>

          {/* Busca */}
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 mb-6">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Buscar por nome, matricula ou cargo..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
              <button
                onClick={carregarDados}
                className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center justify-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Atualizar
              </button>
            </div>
          </div>

          {/* Conteudo */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RadarLoading />
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                {abaAtiva === 'admissoes' ? (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-600 text-white">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Matricula</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Nome</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Cargo</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Empresa</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Data Admissao</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Salario</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {colaboradoresFiltrados.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                            Nenhum registro encontrado
                          </td>
                        </tr>
                      ) : (
                        colaboradoresFiltrados.map((c, index) => (
                          <tr key={c.id || index} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {c.matricula || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {c.nome || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {c.cargo || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {c.empresa || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatarData(c.data_admissao)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {formatarMoeda(c.salario)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-600 text-white">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Matricula</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Nome</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Cargo</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Data Admissao</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Data Desligamento</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Motivo</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {colaboradoresFiltrados.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                            Nenhum registro encontrado
                          </td>
                        </tr>
                      ) : (
                        colaboradoresFiltrados.map((c, index) => (
                          <tr key={c.id || index} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {c.matricula || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {c.nome || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {c.cargo || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatarData(c.data_admissao)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatarData(c.data_desligamento)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {c.motivo_desligamento || '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
