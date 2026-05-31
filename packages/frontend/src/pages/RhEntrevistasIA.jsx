import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { TabEntrevistas } from './RhRecrutadorIA';

// Pagina standalone das Entrevistas Realizadas pela IA.
// Reaproveita o componente TabEntrevistas do recrutador.
export default function RhEntrevistasIA() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 min-w-0 overflow-auto">
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white p-4 shadow">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden bg-white/20 hover:bg-white/30 rounded-lg p-2 transition">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-3xl">🤖</span>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Entrevistas Realizadas I.A</h1>
              <p className="text-xs sm:text-sm opacity-90">Entrevistas conduzidas pela Helen (recrutadora IA) — score, custo, relatório</p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <TabEntrevistas />
        </div>
      </div>
    </div>
  );
}
