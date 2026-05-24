import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../contexts/AuthContext';

export default function RhAusencias() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Ponto e Ausencias</h1>
              <p className="text-orange-100 text-sm mt-1">Controle de ausencias, ferias e afastamentos</p>
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
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
              <p className="text-sm text-gray-600">Total Ausencias</p>
              <p className="text-2xl font-bold text-gray-900">0</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 border border-green-200">
              <p className="text-sm text-gray-600">Justificadas</p>
              <p className="text-2xl font-bold text-green-600">0</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 border border-red-200">
              <p className="text-sm text-gray-600">Nao Justificadas</p>
              <p className="text-2xl font-bold text-red-600">0</p>
            </div>
          </div>

          {/* Em Breve Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="flex flex-col items-center justify-center text-center py-12">
              <div className="bg-orange-100 rounded-full p-6 mb-6">
                <svg className="w-16 h-16 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Em breve</h2>
              <p className="text-gray-500 max-w-md mb-6">
                O modulo de Ponto e Ausencias esta sendo desenvolvido. Em breve voce podera registrar
                e acompanhar todas as ausencias dos colaboradores, incluindo ferias, atestados medicos,
                faltas justificadas e nao justificadas, com relatorios completos de absenteismo.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <span className="bg-orange-50 text-orange-700 px-4 py-2 rounded-full text-sm font-medium border border-orange-200">
                  Controle de Ferias
                </span>
                <span className="bg-orange-50 text-orange-700 px-4 py-2 rounded-full text-sm font-medium border border-orange-200">
                  Atestados Medicos
                </span>
                <span className="bg-orange-50 text-orange-700 px-4 py-2 rounded-full text-sm font-medium border border-orange-200">
                  Faltas e Atrasos
                </span>
                <span className="bg-orange-50 text-orange-700 px-4 py-2 rounded-full text-sm font-medium border border-orange-200">
                  Relatorios de Absenteismo
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
