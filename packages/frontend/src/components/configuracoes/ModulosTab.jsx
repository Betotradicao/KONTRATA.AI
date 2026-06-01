import { useState, useEffect } from 'react';
import { loadModulesConfig, saveModulesConfig } from '../../utils/modulesConfig';

const SECTIONS = [
  {
    id: 'rh-radar',
    name: 'RH no Radar',
    icon: '👥',
    color: 'pink',
    modules: [
      { id: 'rh-indicadores', name: 'Indicadores RH', icon: '📊' },
      { id: 'rh-colaboradores', name: 'Colaboradores', icon: '👥', subs: [
        { id: 'rh-cadastro-geral', name: 'Cadastro Geral' },
        { id: 'rh-documentacao', name: 'Documentação' },
        { id: 'rh-saude', name: 'Saúde Ocupacional' },
      ]},
      { id: 'rh-ponto', name: 'Ponto e Ausências', icon: '⏰', subs: [
        { id: 'rh-jornadas', name: 'Jornadas de Trabalho' },
        { id: 'rh-ausencias', name: 'Lançar Ausências' },
        { id: 'rh-ferias', name: 'Controle de Férias' },
        { id: 'rh-absenteismo', name: 'Análise Absenteísmo' },
      ]},
      { id: 'rh-recrutamento', name: 'Recrutamento', icon: '💼', subs: [
        { id: 'rh-recrutador-ia', name: 'Recrutador(a) Inteligente' },
        { id: 'rh-vagas', name: 'Vagas Abertas' },
        { id: 'rh-metodo-disc', name: 'Método DISC' },
        { id: 'rh-curriculo-modelo', name: 'Modelo de Currículo' },
        { id: 'rh-curriculo-banco', name: 'Banco de Currículos' },
        { id: 'rh-entrevistas-ia', name: 'Entrevistas Realizadas I.A' },
      ]},
      { id: 'rh-pesquisa-clima', name: 'Pesquisa de Clima', icon: '😊', subs: [
        { id: 'rh-clima-analise', name: 'Análise Pesquisas' },
        { id: 'rh-clima-criar', name: 'Criar Pesquisas' },
      ]},
      { id: 'rh-treinamentos', name: 'Treinamentos', icon: '📚', subs: [
        { id: 'rh-cadastro-treinamento', name: 'Cadastrar Treinamento' },
        { id: 'rh-presenca', name: 'Controle de Presença' },
        { id: 'rh-certificados', name: 'Certificados' },
      ]},
      { id: 'rh-financeiro', name: 'Financeiro RH', icon: '💵', subs: [
        { id: 'rh-lancamentos', name: 'Lançamentos' },
        { id: 'rh-folha', name: 'Folha de Pagamento' },
      ]},
      { id: 'rh-escala', name: 'Escala de Trabalho', icon: '📅', subs: [
        { id: 'rh-escala-grid', name: 'Grid Mensal' },
        { id: 'rh-escala-eventos', name: 'Férias / Licenças' },
      ]},
      { id: 'rh-dp', name: 'Departamento Pessoal', icon: '📂' },
      { id: 'rh-configuracoes', name: 'Configurações RH', icon: '⚙️' },
    ]
  },
];

// Flatten all modules + submodules for initial state
const ALL_MODULES = SECTIONS.flatMap(s => s.modules.flatMap(m => [m, ...(m.subs || []).map(sub => ({ ...sub, icon: m.icon }))]));

const SECTION_COLORS = {
  blue: { bg: 'bg-blue-600', bgLight: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', ring: 'ring-blue-500' },
  red: { bg: 'bg-red-600', bgLight: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', ring: 'ring-red-500' },
  purple: { bg: 'bg-purple-600', bgLight: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', ring: 'ring-purple-500' },
  green: { bg: 'bg-green-600', bgLight: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', ring: 'ring-green-500' },
  orange: { bg: 'bg-orange-600', bgLight: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', ring: 'ring-orange-500' },
  amber: { bg: 'bg-amber-600', bgLight: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', ring: 'ring-amber-500' },
  teal: { bg: 'bg-teal-600', bgLight: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-800', ring: 'ring-teal-500' },
  pink: { bg: 'bg-pink-600', bgLight: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-800', ring: 'ring-pink-500' },
};

export default function ModulosTab() {
  const [modules, setModules] = useState(() =>
    ALL_MODULES.map(m => ({ ...m, active: true }))
  );
  const [visibilityMode, setVisibilityMode] = useState('disabled'); // 'disabled' | 'hidden'
  const [success, setSuccess] = useState(null);

  // Carregar config do BACKEND (com fallback/migracao do localStorage antigo)
  useEffect(() => {
    (async () => {
      const { config, mode } = await loadModulesConfig({ force: true });
      // Garante que TODOS os modulos existam (preserva active state dos salvos)
      const migrated = ALL_MODULES.map(defaultMod => {
        const saved = (config || []).find(m => m.id === defaultMod.id);
        return { ...defaultMod, active: saved ? saved.active : true };
      });
      setModules(migrated);
      if (mode === 'disabled' || mode === 'hidden') setVisibilityMode(mode);
      // Persiste estrutura completa (caso modulos novos tenham sido adicionados)
      if (!config || config.length !== migrated.length) {
        saveModulesConfig(migrated, mode || 'disabled');
      }
    })();
  }, []);

  const handleVisibilityModeChange = (mode) => {
    setVisibilityMode(mode);
    saveModulesConfig(modules, mode);
    setSuccess(mode === 'hidden'
      ? 'Modo TOTALMENTE INVISIVEL ativado - modulos inativos serao removidos do menu'
      : 'Modo INVISIVEL (visualizacao desabilitada) ativado - modulos inativos aparecem mas nao sao clicaveis');
    setTimeout(() => setSuccess(null), 3500);
  };

  const saveAndNotify = (updated) => {
    setModules(updated);
    saveModulesConfig(updated, visibilityMode);
  };

  const handleToggleModule = (moduleId) => {
    const updated = modules.map(mod =>
      mod.id === moduleId ? { ...mod, active: !mod.active } : mod
    );
    saveAndNotify(updated);
    const toggled = updated.find(m => m.id === moduleId);
    setSuccess(`${toggled.name} ${toggled.active ? 'ativado' : 'desativado'} com sucesso!`);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleToggleSection = (sectionId) => {
    const section = SECTIONS.find(s => s.id === sectionId);
    if (!section) return;
    const sectionModuleIds = section.modules.map(m => m.id);
    const allActive = sectionModuleIds.every(id => modules.find(m => m.id === id)?.active);
    const newState = !allActive;
    const updated = modules.map(mod =>
      sectionModuleIds.includes(mod.id) ? { ...mod, active: newState } : mod
    );
    saveAndNotify(updated);
    setSuccess(`${section.name} ${newState ? 'ativado' : 'desativado'} por completo!`);
    setTimeout(() => setSuccess(null), 3000);
  };

  const getSectionState = (sectionId) => {
    const section = SECTIONS.find(s => s.id === sectionId);
    if (!section) return 'off';
    const sectionModuleIds = section.modules.map(m => m.id);
    const activeCount = sectionModuleIds.filter(id => modules.find(m => m.id === id)?.active).length;
    if (activeCount === sectionModuleIds.length) return 'on';
    if (activeCount === 0) return 'off';
    return 'partial';
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Gerenciar Módulos do Sistema</h2>
          <p className="text-sm text-gray-600 mt-1">
            Ative ou desative módulos e seções inteiras. Módulos desativados ficarão inacessíveis no menu lateral.
          </p>
        </div>

        {/* Modo de visibilidade */}
        <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
          <h3 className="font-bold text-sm text-blue-900 mb-2">Como exibir módulos desativados no menu?</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <label className={`flex items-start gap-2 p-3 rounded-lg cursor-pointer border-2 transition ${visibilityMode === 'disabled' ? 'border-blue-500 bg-blue-100' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
              <input
                type="radio"
                name="visibility-mode"
                checked={visibilityMode === 'disabled'}
                onChange={() => handleVisibilityModeChange('disabled')}
                className="mt-1"
              />
              <div>
                <div className="font-bold text-sm text-gray-800">INVISIVEL</div>
                <p className="text-xs text-gray-600">Modulos desativados aparecem no menu (transparentes) mas nao sao clicaveis.</p>
              </div>
            </label>
            <label className={`flex items-start gap-2 p-3 rounded-lg cursor-pointer border-2 transition ${visibilityMode === 'hidden' ? 'border-blue-500 bg-blue-100' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
              <input
                type="radio"
                name="visibility-mode"
                checked={visibilityMode === 'hidden'}
                onChange={() => handleVisibilityModeChange('hidden')}
                className="mt-1"
              />
              <div>
                <div className="font-bold text-sm text-gray-800">TOTALMENTE INVISIVEL</div>
                <p className="text-xs text-gray-600">Modulos desativados sao removidos completamente do menu. So aparece o que esta ativo.</p>
              </div>
            </label>
          </div>
        </div>

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
            </svg>
            {success}
          </div>
        )}

        <div className="space-y-6">
          {SECTIONS.map(section => {
            const colors = SECTION_COLORS[section.color];
            const sectionState = getSectionState(section.id);

            return (
              <div key={section.id} className={`rounded-xl border-2 ${sectionState === 'off' ? 'border-gray-200 bg-gray-50' : `${colors.border} ${colors.bgLight}`} overflow-hidden transition-all`}>
                {/* Section Header */}
                <div className={`flex items-center justify-between px-5 py-4 ${sectionState === 'off' ? 'bg-gray-100' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 ${sectionState === 'off' ? 'bg-gray-400' : colors.bg} rounded-lg flex items-center justify-center text-lg`}>
                      <span>{section.icon}</span>
                    </div>
                    <div>
                      <h3 className={`font-bold text-base ${sectionState === 'off' ? 'text-gray-500' : colors.text}`}>
                        {section.name}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {section.modules.length} módulo{section.modules.length > 1 ? 's' : ''} &middot;{' '}
                        {sectionState === 'on' ? 'Todos ativos' : sectionState === 'off' ? 'Todos inativos' : 'Parcialmente ativo'}
                      </p>
                    </div>
                  </div>

                  {/* Section Toggle */}
                  <button
                    onClick={() => handleToggleSection(section.id)}
                    className={`
                      relative inline-flex h-8 w-14 items-center rounded-full transition-colors
                      ${sectionState === 'on' ? 'bg-green-500' : sectionState === 'partial' ? 'bg-yellow-400' : 'bg-gray-300'}
                    `}
                    title={sectionState === 'on' ? 'Desativar seção inteira' : 'Ativar seção inteira'}
                  >
                    <span
                      className={`
                        inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow
                        ${sectionState === 'on' ? 'translate-x-7' : sectionState === 'partial' ? 'translate-x-4' : 'translate-x-1'}
                      `}
                    />
                  </button>
                </div>

                {/* Module List */}
                <div className="px-5 pb-4 pt-1">
                  <div className="space-y-2">
                    {section.modules.map(mod => {
                      const moduleState = modules.find(m => m.id === mod.id);
                      const isActive = moduleState?.active ?? true;

                      return (
                        <div key={mod.id}>
                          <div
                            className={`
                              flex items-center justify-between px-4 py-3 rounded-lg border transition-all
                              ${isActive
                                ? 'border-gray-200 bg-white hover:bg-gray-50'
                                : 'border-gray-200 bg-gray-100'
                              }
                              ${mod.subs ? 'rounded-b-none' : ''}
                            `}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`text-xl ${!isActive && 'opacity-40 grayscale'}`}>
                                {mod.icon}
                              </span>
                              <span className={`font-medium ${isActive ? 'text-gray-800' : 'text-gray-400'}`}>
                                {mod.name}
                              </span>
                              {mod.subs && (
                                <span className="text-xs text-gray-400">({mod.subs.length} sub)</span>
                              )}
                            </div>

                            <button
                              onClick={() => handleToggleModule(mod.id)}
                              className={`
                                relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                                ${isActive ? 'bg-green-500' : 'bg-gray-300'}
                              `}
                              title={isActive ? 'Desativar módulo' : 'Ativar módulo'}
                            >
                              <span
                                className={`
                                  inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm
                                  ${isActive ? 'translate-x-6' : 'translate-x-1'}
                                `}
                              />
                            </button>
                          </div>

                          {/* Submenus */}
                          {mod.subs && isActive && (
                            <div className="border border-t-0 border-gray-200 rounded-b-lg bg-gray-50 px-4 py-2 space-y-1">
                              {mod.subs.map(sub => {
                                const subState = modules.find(m => m.id === sub.id);
                                const isSubActive = subState?.active ?? true;
                                return (
                                  <div key={sub.id} className="flex items-center justify-between py-1.5 pl-8">
                                    <span className={`text-sm ${isSubActive ? 'text-gray-700' : 'text-gray-400'}`}>
                                      {sub.name}
                                    </span>
                                    <button
                                      onClick={() => handleToggleModule(sub.id)}
                                      className={`
                                        relative inline-flex h-5 w-9 items-center rounded-full transition-colors
                                        ${isSubActive ? 'bg-green-400' : 'bg-gray-300'}
                                      `}
                                      title={isSubActive ? 'Desativar' : 'Ativar'}
                                    >
                                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${isSubActive ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex gap-2">
            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-800">
              <p className="font-medium">Informação importante:</p>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>Use o toggle da seção para ativar/desativar todos os módulos de uma vez</li>
                <li>Módulos desativados ficarão em cinza e inacessíveis no menu lateral</li>
                <li>Apenas administradores podem ativar/desativar módulos</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
