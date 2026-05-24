import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import RadarLoading from '../components/RadarLoading';

export default function RhAdmissoes() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [colaboradores, setColaboradores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');

  useEffect(() => {
    fetchAdmissoes();
  }, []);

  const fetchAdmissoes = async () => {
    try {
      setLoading(true);
      const res = await api.get('/rh/colaboradores?status=ativo&limit=100');
      const data = res.data.colaboradores || res.data || [];
      // Sort by most recent admission date
      const sorted = [...data].sort((a, b) => {
        const dA = a.data_admissao ? new Date(a.data_admissao) : new Date(0);
        const dB = b.data_admissao ? new Date(b.data_admissao) : new Date(0);
        return dB - dA;
      });
      setColaboradores(sorted);
    } catch (err) {
      toast.error('Erro ao carregar admissoes');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('pt-BR');
  };

  const formatCurrency = (v) => {
    if (!v && v !== 0) return '-';
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const filtered = colaboradores.filter((c) =>
    !filtro || (c.nome || '').toLowerCase().includes(filtro.toLowerCase())
  );

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
              <h1 className="text-2xl font-bold">Admissoes</h1>
              <p className="text-orange-100 text-sm mt-1">Colaboradores ativos ordenados por data de admissao</p>
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
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-4 border border-green-200">
              <p className="text-sm text-gray-600">Total Admissoes (Ativos)</p>
              <p className="text-2xl font-bold text-green-600">{filtered.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
              <p className="text-sm text-gray-600">Admissoes no Ano</p>
              <p className="text-2xl font-bold text-gray-900">
                {filtered.filter((c) => {
                  if (!c.data_admissao) return false;
                  return new Date(c.data_admissao).getFullYear() === new Date().getFullYear();
                }).length}
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Buscar por nome..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Matricula</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cargo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Empresa</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data Admissao</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Salario</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        Nenhum colaborador encontrado
                      </td>
                    </tr>
                  ) : (
                    filtered.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{c.matricula || '-'}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.nome}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{c.cargo_nome || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{c.empresa_nome || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatDate(c.data_admissao)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatCurrency(c.salario)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
