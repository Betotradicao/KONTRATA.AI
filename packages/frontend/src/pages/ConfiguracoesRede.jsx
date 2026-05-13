import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import TabsNavigation from '../components/configuracoes/TabsNavigation';
import ModulosTab from '../components/configuracoes/ModulosTab';
import APIsTab from '../components/configuracoes/APIsTab';
import WhatsAppGroupsTab from '../components/configuracoes/WhatsAppGroupsTab';
import EmailTab from '../components/configuracoes/EmailTab';
import ResetSenhaAdminTab from '../components/configuracoes/ResetSenhaAdminTab';
import EmpresaConfigTab from '../components/configuracoes/EmpresaConfigTab';

export default function ConfiguracoesRede() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    return searchParams.get('tab') || 'apis';
  });

  // Verificar se usuário é master ao carregar a página
  useEffect(() => {
    if (!user?.isMaster) {
      // Se não é master, redireciona para dashboard
      navigate('/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl && ['modulos','apis','whatsapp-groups','email','reset-admin','personalizacao'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Se não é master, não renderiza nada (vai redirecionar)
  if (!user?.isMaster) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        user={user}
        onLogout={logout}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-auto lg:ml-0">
        {/* Mobile Header */}
        <div className="lg:hidden bg-white shadow-sm p-4 flex items-center justify-between">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-gray-600 hover:text-gray-900"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Configurações de REDE</h1>
          <button
            onClick={logout}
            className="p-2 text-gray-600 hover:text-red-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6">
          {/* Card com Gradiente Laranja */}
          <div className="hidden lg:block rounded-lg shadow-lg p-6 mb-6 text-white" style={{ background: 'linear-gradient(135deg, #6B21A8 0%, #3D1B7E 100%)' }}>
            <div className="flex items-center justify-between">
              <h1 className="text-2xl lg:text-3xl font-bold">🌐 Configurações de REDE</h1>
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
                </svg>
              </div>
            </div>
          </div>

          <TabsNavigation activeTab={activeTab} onChange={handleTabChange} pageType="rede" />

          <div className="mt-6">
            {activeTab === 'modulos' && <ModulosTab />}
            {activeTab === 'apis' && <APIsTab />}
            {activeTab === 'whatsapp-groups' && <WhatsAppGroupsTab />}
            {activeTab === 'email' && <EmailTab />}
            {activeTab === 'reset-admin' && <ResetSenhaAdminTab />}
            {activeTab === 'personalizacao' && <EmpresaConfigTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
