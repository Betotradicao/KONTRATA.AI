export default function TabsNavigation({ activeTab, onChange, pageType = 'config' }) {
  // Abas para Configurações de REDE
  const redeTabs = [
    { id: 'apis', label: 'APIs' },
    { id: 'whatsapp-groups', label: 'Grupos WhatsApp' },
    { id: 'reset-admin', label: 'Resetar Senha Admin' },
    { id: 'email', label: 'Email' },
    { id: 'modulos', label: 'Módulos' },
    { id: 'personalizacao', label: 'Personalização' },
    { id: 'lgpd', label: '🛡️ Privacidade e LGPD' },
    { id: 'logs-acesso', label: '📋 Logs de Acesso' }
  ];

  // Abas para Configurações normais
  // Obs: "Ativar Produtos" foi movido pra Vision Bipagens > Ativar Produtos (/ativar-produtos)
  // Obs: "Leitores" foi movido pra Vision Bipagens > Leitores (/leitores)
  // Obs: "Caixas HortFrut" e "Fornecedores" foram removidos (nao usados mais)
  const configTabs = [
    { id: 'sectors', label: 'Setores' },
    { id: 'holidays', label: 'Feriados' }
  ];

  const tabs = pageType === 'rede' ? redeTabs : configTabs;

  return (
    <div className="border-b border-gray-200">
      <nav className="flex space-x-8" aria-label="Tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm transition
              ${activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
