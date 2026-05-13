import { useState, useEffect, useRef } from 'react';
import { MENU_STRUCTURE } from '../../constants/menuConstants';
import { loadModulesConfig, readCachedModulesConfig } from '../../utils/modulesConfig';

export default function PermissionsSelector({ selectedPermissions, onChange }) {
  const [permissions, setPermissions] = useState({});
  const moduleCheckboxRefs = useRef({});
  const [activeModuleIds, setActiveModuleIds] = useState(() => {
    const { config } = readCachedModulesConfig();
    return new Set((config || []).filter(m => m.active).map(m => m.id));
  });

  // Recarrega lista de modulos ativos do backend ao montar
  useEffect(() => {
    (async () => {
      try {
        const { config } = await loadModulesConfig({ force: true });
        setActiveModuleIds(new Set((config || []).filter(m => m.active).map(m => m.id)));
      } catch {}
    })();
  }, []);

  // Inicializar permissions do prop
  useEffect(() => {
    console.log('🔄 PermissionsSelector recebeu selectedPermissions:', selectedPermissions);

    if (selectedPermissions && Array.isArray(selectedPermissions) && selectedPermissions.length > 0) {
      const permissionsObj = {};
      selectedPermissions.forEach(perm => {
        // Se submenus é null = acesso total
        // Se submenus é array vazio [] = também acesso total
        // Se submenus tem itens = acesso parcial
        const isFullAccess = perm.submenus === null || (Array.isArray(perm.submenus) && perm.submenus.length === 0);

        permissionsObj[perm.moduleId] = {
          fullAccess: isFullAccess,
          submenus: perm.submenus || []
        };

        console.log(`   📦 Módulo ${perm.moduleId}:`, {
          fullAccess: isFullAccess,
          submenus: perm.submenus
        });
      });

      console.log('✅ Permissions object criado:', permissionsObj);
      setPermissions(permissionsObj);
    } else {
      console.log('⚠️ selectedPermissions está vazio, não é array, ou length = 0');
      // Limpar permissões se vier vazio
      setPermissions({});
    }
  }, [selectedPermissions]);

  // Converter permissions object para array format esperado pela API
  const convertToApiFormat = (perms) => {
    return Object.keys(perms).map(moduleId => ({
      moduleId,
      submenus: perms[moduleId].fullAccess ? null : perms[moduleId].submenus
    }));
  };

  // Toggle acesso total ao módulo
  const toggleModuleFullAccess = (moduleId, module) => {
    const newPermissions = { ...permissions };

    if (!newPermissions[moduleId]) {
      // Não tinha acesso - ativar acesso total
      newPermissions[moduleId] = {
        fullAccess: true,
        submenus: []
      };
    } else if (newPermissions[moduleId].fullAccess) {
      // Tinha acesso total - remover completamente
      delete newPermissions[moduleId];
    } else {
      // Tinha acesso parcial - ativar acesso total (marcar todos)
      newPermissions[moduleId] = {
        fullAccess: true,
        submenus: []
      };
    }

    console.log('🔄 toggleModuleFullAccess - Novo estado:', newPermissions);
    setPermissions(newPermissions);
    onChange(convertToApiFormat(newPermissions));
  };

  // Toggle submenu individual
  const toggleSubmenu = (moduleId, submenuId, module) => {
    const newPermissions = { ...permissions };

    if (!newPermissions[moduleId]) {
      // Criar novo com esse submenu
      newPermissions[moduleId] = {
        fullAccess: false,
        submenus: [submenuId]
      };
    } else if (newPermissions[moduleId].fullAccess) {
      // Estava com acesso total, agora tirar esse submenu
      const allSubmenus = module.submenus.map(s => s.id);
      const remainingSubmenus = allSubmenus.filter(id => id !== submenuId);

      if (remainingSubmenus.length === 0) {
        // Se não sobrou nenhum, remove o módulo
        delete newPermissions[moduleId];
      } else {
        newPermissions[moduleId] = {
          fullAccess: false,
          submenus: remainingSubmenus
        };
      }
    } else {
      // Acesso parcial
      const currentSubmenus = newPermissions[moduleId].submenus;

      if (currentSubmenus.includes(submenuId)) {
        // Remover submenu
        const newSubmenus = currentSubmenus.filter(id => id !== submenuId);

        if (newSubmenus.length === 0) {
          delete newPermissions[moduleId];
        } else {
          newPermissions[moduleId] = {
            fullAccess: false,
            submenus: newSubmenus
          };
        }
      } else {
        // Adicionar submenu
        const newSubmenus = [...currentSubmenus, submenuId];

        // Verificar se marcou todos - se sim, marcar como fullAccess
        if (newSubmenus.length === module.submenus.length) {
          newPermissions[moduleId] = {
            fullAccess: true,
            submenus: []
          };
        } else {
          newPermissions[moduleId] = {
            fullAccess: false,
            submenus: newSubmenus
          };
        }
      }
    }

    setPermissions(newPermissions);
    onChange(convertToApiFormat(newPermissions));
  };

  // Verificar se módulo tem acesso total
  const hasFullAccess = (moduleId) => {
    return permissions[moduleId]?.fullAccess === true;
  };

  // Verificar se submenu está selecionado
  const isSubmenuSelected = (moduleId, submenuId) => {
    if (!permissions[moduleId]) return false;
    if (permissions[moduleId].fullAccess) return true;
    return permissions[moduleId].submenus.includes(submenuId);
  };

  // Verificar se módulo tem algum acesso (parcial ou total)
  const hasAnyAccess = (moduleId) => {
    return !!permissions[moduleId];
  };

  // Verificar se módulo está em estado parcial (alguns sub-menus marcados, mas não todos)
  const hasPartialAccess = (moduleId) => {
    if (!permissions[moduleId]) return false;
    if (permissions[moduleId].fullAccess) return false;
    return permissions[moduleId].submenus.length > 0;
  };

  // Atualizar estado indeterminate dos checkboxes de módulo
  useEffect(() => {
    Object.keys(moduleCheckboxRefs.current).forEach(moduleId => {
      const checkbox = moduleCheckboxRefs.current[moduleId];
      if (checkbox) {
        checkbox.indeterminate = hasPartialAccess(moduleId);
      }
    });
  }, [permissions]);

  // Mapear emojis para cada módulo
  const moduleEmojis = {
    'gestao-inteligente': '🧠',
    'estoque-margem': '📦',
    'compras': '🛒',
    'pricing': '🏷️',
    'bipagens': '🔖',
    'pdv': '💻',
    'facial': '👤',
    'ruptura': '📋',
    'etiquetas': '🔖',
    'perdas': '📊',
    'producao': '🥖',
    'hortfrut': '🥬',
    'controle-recebimento': '📄',
    'garimpa-fornecedores': '🔎',
    'entradas-saidas': '💰',
    'demonstrativo-caixa': '📊',
    'bancos': '🏦',
    'rota-crescimento': '🚀',
    'ofertas': '🏷️',
    'prevencao-trocas': '🔄',
    'abastecimento': '🚚',
    'metas': '🎯',
    'prevencao-tributaria': '🧾',
    'disparo-whatsapp': '📱',
    'vision-pdv': '🖥️',
    'vision-facial': '👤',
    'vision-bipagens': '📡',
    'checklist-dashboards': '📊',
    'checklist-auditar': '📝',
    'checklist-finalizadas': '✅',
    'checklist-cadastros': '🗂️',
    'rh-colaboradores': '👥',
    'rh-saude': '🏥',
    'rh-ponto': '⏰',
    'rh-recrutamento': '💼',
    'rh-treinamentos': '📚',
    'rh-financeiro': '💵',
    'rh-indicadores': '📈',
    'rh-configuracoes': '⚙️',
    'acougue': '🔪',
  };

  // Separar módulos por seção
  const metasModules = MENU_STRUCTURE.filter(m => m.section === 'metas' && m.submenus.length > 0);
  const gestaoModules = MENU_STRUCTURE.filter(m => m.section === 'gestao' && m.submenus.length > 0);
  const prevencaoModules = MENU_STRUCTURE.filter(m => m.section === 'prevencao' && m.submenus.length > 0);
  const garimpaModules = MENU_STRUCTURE.filter(m => m.section === 'garimpa' && m.submenus.length > 0);
  const financasModules = MENU_STRUCTURE.filter(m => m.section === 'financas' && m.submenus.length > 0);
  const marketingModules = MENU_STRUCTURE.filter(m => m.section === 'marketing' && m.submenus.length > 0);
  const visionModules = MENU_STRUCTURE.filter(m => m.section === 'vision' && m.submenus.length > 0);
  const iaModules = MENU_STRUCTURE.filter(m => m.section === 'ia' && m.submenus.length > 0);
  const checklistModules = MENU_STRUCTURE.filter(m => m.section === 'checklist' && m.submenus.length > 0);
  const rhModules = MENU_STRUCTURE
    .filter(m => m.section === 'rh' && m.submenus.length > 0)
    // Se modulesConfig foi carregado e o modulo nao esta na lista de ativos, esconde
    .filter(m => activeModuleIds.size === 0 || activeModuleIds.has(m.id))
    // Filtra tambem submenus inativos
    .map(m => ({
      ...m,
      submenus: m.submenus.filter(s => activeModuleIds.size === 0 || activeModuleIds.has(s.id))
    }));

  const renderModuleCard = (module) => {
    const moduleEmoji = moduleEmojis[module.id] || '📦';
    const hasAccess = hasAnyAccess(module.id);
    const isFullAccess = hasFullAccess(module.id);
    const isPartial = hasPartialAccess(module.id);

    return (
      <div
        key={module.id}
        className={`border-2 rounded-xl overflow-hidden transition-all duration-200 ${
          hasAccess
            ? 'border-orange-400 shadow-md'
            : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        {/* CABEÇALHO DO MÓDULO - Destaque visual */}
        <div className={`p-4 ${
          hasAccess
            ? 'bg-gradient-to-r from-orange-200 to-amber-100 border-b-2 border-orange-300'
            : 'bg-gray-100 border-b border-gray-200'
        }`}>
          <div className="flex items-center">
            <input
              type="checkbox"
              ref={(el) => moduleCheckboxRefs.current[module.id] = el}
              id={`module-${module.id}`}
              checked={hasAccess}
              onChange={() => toggleModuleFullAccess(module.id, module)}
              className="w-6 h-6 text-orange-500 border-2 border-gray-400 rounded focus:ring-2 focus:ring-orange-500 cursor-pointer"
            />
            <label
              htmlFor={`module-${module.id}`}
              className="ml-3 flex items-center gap-3 cursor-pointer select-none flex-1"
            >
              <span className="text-3xl">{moduleEmoji}</span>
              <div className="flex-1">
                <div className="text-base font-bold text-gray-900 uppercase tracking-wide">{module.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">{module.submenus.length} sub-menu(s)</div>
                {isFullAccess && (
                  <div className="inline-flex items-center gap-1 text-xs text-green-800 font-bold mt-1 bg-green-200 px-2 py-0.5 rounded-full">
                    Acesso Total ao Módulo
                  </div>
                )}
                {isPartial && (
                  <div className="inline-flex items-center gap-1 text-xs text-orange-800 font-bold mt-1 bg-orange-200 px-2 py-0.5 rounded-full">
                    Acesso Parcial
                  </div>
                )}
              </div>
            </label>
          </div>
        </div>

        {/* SUB-MENUS do módulo */}
        {module.submenus.length > 0 && (
          <div className="p-4 bg-white">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7"/>
              </svg>
              <span>Sub-menus deste módulo:</span>
            </div>
            <div className="space-y-2 pl-3 border-l-2 border-orange-300 ml-1">
              {module.submenus.map(submenu => (
                <div
                  key={submenu.id}
                  className={`flex items-center p-2.5 rounded-lg transition-colors ${
                    isSubmenuSelected(module.id, submenu.id)
                      ? 'bg-orange-50 border border-orange-200'
                      : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                  }`}
                >
                  <input
                    type="checkbox"
                    id={`submenu-${module.id}-${submenu.id}`}
                    checked={isSubmenuSelected(module.id, submenu.id)}
                    onChange={() => toggleSubmenu(module.id, submenu.id, module)}
                    className="w-4 h-4 text-orange-500 border-2 border-gray-300 rounded focus:ring-2 focus:ring-orange-500 cursor-pointer"
                  />
                  <label
                    htmlFor={`submenu-${module.id}-${submenu.id}`}
                    className="ml-3 text-sm text-gray-700 cursor-pointer select-none flex-1 font-medium"
                  >
                    {submenu.title}
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header com gradiente */}
      <div className="bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">🔐</span>
          <h3 className="text-lg font-semibold text-orange-900">Controle de Permissões</h3>
        </div>
        <p className="text-sm text-orange-700">
          Selecione os módulos e funcionalidades que este colaborador poderá acessar no sistema.
        </p>
      </div>

      {/* Seção GESTÃO NO RADAR */}
      {/* Seção METAS NO RADAR */}
      {metasModules.length > 0 && (
        <>
          <div className="flex items-center gap-2 mt-2 mb-3">
            <div className="w-6 h-6 bg-amber-500 rounded-md flex items-center justify-center">
              <span className="text-white text-xs font-bold">M</span>
            </div>
            <h4 className="text-sm font-bold text-amber-800 uppercase tracking-wide">Metas no Radar</h4>
            <div className="flex-1 border-t border-amber-200"></div>
          </div>
          {metasModules.map(module => renderModuleCard(module))}
        </>
      )}

      {gestaoModules.length > 0 && (
        <>
          <div className="flex items-center gap-2 mt-2 mb-3">
            <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center">
              <span className="text-white text-xs font-bold">G</span>
            </div>
            <h4 className="text-sm font-bold text-blue-800 uppercase tracking-wide">Gestão no Radar</h4>
            <div className="flex-1 border-t border-blue-200"></div>
          </div>
          {gestaoModules.map(module => renderModuleCard(module))}
        </>
      )}

      {/* Seção PREVENÇÃO NO RADAR */}
      {prevencaoModules.length > 0 && (
        <>
          <div className="flex items-center gap-2 mt-6 mb-3">
            <div className="w-6 h-6 bg-orange-500 rounded-md flex items-center justify-center">
              <span className="text-white text-xs font-bold">P</span>
            </div>
            <h4 className="text-sm font-bold text-orange-800 uppercase tracking-wide">Prevenção no Radar</h4>
            <div className="flex-1 border-t border-orange-200"></div>
          </div>
          {prevencaoModules.map(module => renderModuleCard(module))}
        </>
      )}

      {/* Seção OFERTA NO RADAR */}
      {garimpaModules.length > 0 && (
        <>
          <div className="flex items-center gap-2 mt-6 mb-3">
            <div className="w-6 h-6 bg-green-600 rounded-md flex items-center justify-center">
              <span className="text-white text-xs font-bold">O</span>
            </div>
            <h4 className="text-sm font-bold text-green-800 uppercase tracking-wide">Oferta no Radar</h4>
            <div className="flex-1 border-t border-green-200"></div>
          </div>
          {garimpaModules.map(module => renderModuleCard(module))}
        </>
      )}

      {/* Seção FINANÇAS NO RADAR */}
      {financasModules.length > 0 && (
        <>
          <div className="flex items-center gap-2 mt-6 mb-3">
            <div className="w-6 h-6 bg-emerald-600 rounded-md flex items-center justify-center">
              <span className="text-white text-xs font-bold">$</span>
            </div>
            <h4 className="text-sm font-bold text-emerald-800 uppercase tracking-wide">Finanças no Radar</h4>
            <div className="flex-1 border-t border-emerald-200"></div>
          </div>
          {financasModules.map(module => renderModuleCard(module))}
        </>
      )}

      {/* Seção MARKETING NO RADAR */}
      {marketingModules.length > 0 && (
        <>
          <div className="flex items-center gap-2 mt-6 mb-3">
            <div className="w-6 h-6 bg-green-600 rounded-md flex items-center justify-center">
              <span className="text-white text-xs font-bold">MK</span>
            </div>
            <h4 className="text-sm font-bold text-green-800 uppercase tracking-wide">Marketing no Radar</h4>
            <div className="flex-1 border-t border-green-200"></div>
          </div>
          {marketingModules.map(module => renderModuleCard(module))}
        </>
      )}

      {/* Seção VISION 360 */}
      {visionModules.length > 0 && (
        <>
          <div className="flex items-center gap-2 mt-6 mb-3">
            <div className="w-6 h-6 bg-indigo-600 rounded-md flex items-center justify-center">
              <span className="text-white text-xs font-bold">V</span>
            </div>
            <h4 className="text-sm font-bold text-indigo-800 uppercase tracking-wide">Vision 360</h4>
            <div className="flex-1 border-t border-indigo-200"></div>
          </div>
          {visionModules.map(module => renderModuleCard(module))}
        </>
      )}

      {/* Seção CONSULTOR DIGITAL */}
      {iaModules.length > 0 && (
        <>
          <div className="flex items-center gap-2 mt-6 mb-3">
            <div className="w-6 h-6 bg-purple-600 rounded-md flex items-center justify-center">
              <span className="text-white text-xs font-bold">CD</span>
            </div>
            <h4 className="text-sm font-bold text-purple-800 uppercase tracking-wide">Consultor Digital</h4>
            <div className="flex-1 border-t border-purple-200"></div>
          </div>
          {iaModules.map(module => renderModuleCard(module))}
        </>
      )}

      {/* Seção CHECK LIST NO RADAR */}
      {checklistModules.length > 0 && (
        <>
          <div className="flex items-center gap-2 mt-6 mb-3">
            <div className="w-6 h-6 bg-teal-500 rounded-md flex items-center justify-center">
              <span className="text-white text-xs font-bold">✓</span>
            </div>
            <h4 className="text-sm font-bold text-teal-800 uppercase tracking-wide">Check List no Radar</h4>
            <div className="flex-1 border-t border-teal-200"></div>
          </div>
          {checklistModules.map(module => renderModuleCard(module))}
        </>
      )}

      {/* Seção RH NO RADAR */}
      {rhModules.length > 0 && (
        <>
          <div className="flex items-center gap-2 mt-6 mb-3">
            <div className="w-6 h-6 bg-pink-500 rounded-md flex items-center justify-center">
              <span className="text-white text-xs font-bold">RH</span>
            </div>
            <h4 className="text-sm font-bold text-pink-800 uppercase tracking-wide">RH no Radar</h4>
            <button
              type="button"
              onClick={() => {
                const allSelected = rhModules.every(m => permissions[m.id]?.fullAccess);
                const newPermissions = { ...permissions };
                if (allSelected) {
                  rhModules.forEach(m => { delete newPermissions[m.id]; });
                } else {
                  rhModules.forEach(m => { newPermissions[m.id] = { fullAccess: true, submenus: [] }; });
                }
                setPermissions(newPermissions);
                onChange(convertToApiFormat(newPermissions));
              }}
              className="ml-2 px-3 py-1 text-xs font-semibold bg-pink-100 text-pink-700 rounded-md hover:bg-pink-200 transition-colors border border-pink-300"
            >
              {rhModules.every(m => permissions[m.id]?.fullAccess) ? '✗ Desmarcar todos' : '✓ Selecionar todos'}
            </button>
            <div className="flex-1 border-t border-pink-200"></div>
          </div>
          {rhModules.map(module => renderModuleCard(module))}
        </>
      )}

      {/* Resumo modernizado */}
      <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📊</span>
          <div className="flex-1">
            <div className="text-sm font-semibold text-blue-900">Resumo de Permissões</div>
            <div className="text-sm text-blue-700 mt-1">
              {Object.keys(permissions).length === 0 ? (
                <span>⚠️ Nenhum módulo selecionado - colaborador não terá acesso ao sistema</span>
              ) : (
                <span>✅ {Object.keys(permissions).length} módulo(s) com acesso configurado</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
