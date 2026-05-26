// Persistencia de modulos habilitados/desabilitados.
// Antes: localStorage por dispositivo (bug — celular nao via mesma config do desktop).
// Agora: tabela `configurations` no banco (key=modules_config, modules_visibility_mode).
// localStorage continua como cache pra render imediato e fallback offline.

import api from '../services/api';

const KEY_CONFIG = 'modules_config';
const KEY_MODE = 'modules_visibility_mode';

let _memoryCache = null; // { config: [...], mode: 'disabled'|'hidden' }
let _loadPromise = null;

/** Le do backend. Se vazio, faz migracao do localStorage uma vez. */
export async function loadModulesConfig({ force = false } = {}) {
  if (_memoryCache && !force) return _memoryCache;
  if (_loadPromise && !force) return _loadPromise;

  _loadPromise = (async () => {
    let config = null;
    let mode = 'disabled';

    // 1. Tenta backend
    try {
      const [rConfig, rMode] = await Promise.all([
        api.get(`/configurations/${KEY_CONFIG}`).catch(e => e?.response?.status === 404 ? null : Promise.reject(e)),
        api.get(`/configurations/${KEY_MODE}`).catch(e => e?.response?.status === 404 ? null : Promise.reject(e)),
      ]);
      if (rConfig?.data?.value) {
        try { config = JSON.parse(rConfig.data.value); } catch {}
      }
      if (rMode?.data?.value === 'disabled' || rMode?.data?.value === 'hidden') {
        mode = rMode.data.value;
      }
    } catch (err) {
      console.warn('[modulesConfig] backend offline, usando localStorage', err?.message);
    }

    // 2. Migracao: se backend vazio mas localStorage tem dados, sobe pro backend
    if (!Array.isArray(config) || config.length === 0) {
      const lsRaw = localStorage.getItem(KEY_CONFIG);
      if (lsRaw) {
        try {
          const lsConfig = JSON.parse(lsRaw);
          if (Array.isArray(lsConfig) && lsConfig.length > 0) {
            config = lsConfig;
            // dispara migracao em background
            api.put(`/configurations/${KEY_CONFIG}`, { value: lsRaw }).catch(() => {});
          }
        } catch {}
      }
      const lsMode = localStorage.getItem(KEY_MODE);
      if ((lsMode === 'disabled' || lsMode === 'hidden') && mode === 'disabled') {
        mode = lsMode;
        api.put(`/configurations/${KEY_MODE}`, { value: lsMode }).catch(() => {});
      }
    }

    // 3. Cache em localStorage pra render imediato no proximo refresh
    if (Array.isArray(config) && config.length > 0) {
      try { localStorage.setItem(KEY_CONFIG, JSON.stringify(config)); } catch {}
    }
    try { localStorage.setItem(KEY_MODE, mode); } catch {}

    _memoryCache = { config: Array.isArray(config) ? config : [], mode };
    return _memoryCache;
  })();

  try { return await _loadPromise; }
  finally { _loadPromise = null; }
}

/** Le sincronamente do localStorage (cache). Pra primeiro render rapido. */
export function readCachedModulesConfig() {
  if (_memoryCache) return _memoryCache;
  let config = [];
  let mode = 'disabled';
  try {
    const raw = localStorage.getItem(KEY_CONFIG);
    if (raw) config = JSON.parse(raw);
  } catch {}
  const m = localStorage.getItem(KEY_MODE);
  if (m === 'disabled' || m === 'hidden') mode = m;
  return { config: Array.isArray(config) ? config : [], mode };
}

/** Salva no backend + atualiza cache + dispara evento pros listeners. */
export async function saveModulesConfig(config, mode) {
  const value = JSON.stringify(config || []);
  _memoryCache = { config: config || [], mode: mode || 'disabled' };
  try { localStorage.setItem(KEY_CONFIG, value); } catch {}
  try { localStorage.setItem(KEY_MODE, mode || 'disabled'); } catch {}

  // Notifica componentes (Sidebar) que estao escutando
  try { window.dispatchEvent(new Event('modulesConfigChanged')); } catch {}

  // Persiste no backend (se falhar, pelo menos localStorage tem)
  await Promise.all([
    api.put(`/configurations/${KEY_CONFIG}`, { value }).catch(err => {
      console.warn('[modulesConfig] erro ao salvar config no backend', err?.message);
    }),
    api.put(`/configurations/${KEY_MODE}`, { value: mode || 'disabled' }).catch(err => {
      console.warn('[modulesConfig] erro ao salvar mode no backend', err?.message);
    }),
  ]);
}

/** Reseta cache (pra forcar reload do backend, ex: apos login) */
export function resetModulesCache() {
  _memoryCache = null;
  _loadPromise = null;
}

/**
 * Verifica se um modulo (rh-indicadores, rh-recrutamento, etc) esta ativo
 * pro cliente atual. Usa cache do localStorage pra resposta sincrona.
 * Master sempre tem acesso (caso queira chamar com user role).
 */
export function isModuleActive(moduleId, { isMaster = false } = {}) {
  if (isMaster) return true;
  const { config } = readCachedModulesConfig();
  if (!Array.isArray(config) || config.length === 0) return true; // default: todos ativos
  const m = config.find(x => x.id === moduleId);
  return m ? m.active !== false : true;
}

/**
 * Lista ordenada de rotas e o moduleId que governa cada uma.
 * Usado pra decidir a "primeira tela permitida" no redirect raiz.
 * Ordem = prioridade (primeiro item ativo = destino).
 */
const ROUTE_MODULE_MAP = [
  { path: '/rh/indicadores',           moduleId: 'rh-indicadores' },
  { path: '/rh/cadastro',              moduleId: 'rh-cadastro-geral' },
  { path: '/rh/documentacao',          moduleId: 'rh-documentacao' },
  { path: '/rh/aso',                   moduleId: 'rh-saude' },
  { path: '/rh/ausencias',             moduleId: 'rh-ausencias' },
  { path: '/rh/vagas',                 moduleId: 'rh-vagas' },
  { path: '/rh/recrutador/vagas',      moduleId: 'rh-recrutador-ia' },
  { path: '/rh/modelo-curriculo',      moduleId: 'rh-curriculo-modelo' },
  { path: '/rh/curriculos',            moduleId: 'rh-curriculo-banco' },
  { path: '/rh/metodo-disc',           moduleId: 'rh-metodo-disc' },
  { path: '/rh/pesquisa-clima/analise',moduleId: 'rh-clima-analise' },
  { path: '/rh/pesquisa-clima/criar',  moduleId: 'rh-clima-criar' },
  { path: '/rh/treinamentos',          moduleId: 'rh-cadastro-treinamento' },
  { path: '/rh/lancamentos',           moduleId: 'rh-lancamentos' },
  { path: '/rh/folha',                 moduleId: 'rh-folha' },
  { path: '/rh/escala',                moduleId: 'rh-escala-grid' },
  { path: '/rh/escala/eventos',        moduleId: 'rh-escala-eventos' },
  { path: '/rh/departamento-pessoal',  moduleId: 'rh-dp' },
];

/** Retorna a primeira rota permitida pro usuario, ou '/perfil' como fallback. */
export function findFirstAllowedPath({ isMaster = false } = {}) {
  if (isMaster) return '/rh/indicadores';
  for (const r of ROUTE_MODULE_MAP) {
    if (isModuleActive(r.moduleId)) return r.path;
  }
  return '/perfil';
}
