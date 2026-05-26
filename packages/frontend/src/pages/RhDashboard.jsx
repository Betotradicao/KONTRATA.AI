import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import RadarLoading from '../components/RadarLoading';

export default function RhDashboard() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/rh/colaboradores/stats');
      setStats(response.data);
    } catch (err) {
      console.error('Erro ao carregar estatísticas RH:', err);
      toast.error('Erro ao carregar estatísticas de RH');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar
        user={user}
        onLogout={logout}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">👥 RH no Radar</h1>
              <p className="text-orange-100 text-sm">Gestão de Recursos Humanos</p>
            </div>
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-purple-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-20">
              <RadarLoading message="Carregando dados de RH..." />
            </div>
          ) : (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-500 rounded-lg p-4 text-white shadow-lg">
                  <p className="text-blue-100 text-sm font-medium">Total Colaboradores</p>
                  <p className="text-3xl font-bold mt-1">{stats?.totalColaboradores ?? 0}</p>
                </div>
                <div className="bg-green-500 rounded-lg p-4 text-white shadow-lg">
                  <p className="text-green-100 text-sm font-medium">Ativos</p>
                  <p className="text-3xl font-bold mt-1">{stats?.ativos ?? 0}</p>
                </div>
                <div className="bg-red-500 rounded-lg p-4 text-white shadow-lg">
                  <p className="text-red-100 text-sm font-medium">Desligados</p>
                  <p className="text-3xl font-bold mt-1">{stats?.desligados ?? 0}</p>
                </div>
                <div className="bg-orange-500 rounded-lg p-4 text-white shadow-lg">
                  <p className="text-orange-100 text-sm font-medium">Admissões no Ano</p>
                  <p className="text-3xl font-bold mt-1">{stats?.admissoesAno ?? 0}</p>
                </div>
              </div>

              {/* Secondary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Gênero</h3>
                  <div className="flex justify-between items-center">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{stats?.masculino ?? 0}</p>
                      <p className="text-xs text-gray-500 mt-1">Masculino</p>
                    </div>
                    <div className="h-10 w-px bg-gray-200" />
                    <div className="text-center">
                      <p className="text-2xl font-bold text-pink-600">{stats?.feminino ?? 0}</p>
                      <p className="text-xs text-gray-500 mt-1">Feminino</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">CLT</h3>
                  <p className="text-3xl font-bold text-indigo-600">{stats?.clt ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-1">Colaboradores CLT</p>
                </div>
                <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Aprendiz</h3>
                  <p className="text-3xl font-bold text-amber-600">{stats?.aprendiz ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-1">Jovens Aprendizes</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
