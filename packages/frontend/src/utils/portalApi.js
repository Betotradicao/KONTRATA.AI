import axios from 'axios';
import { getApiBaseUrl } from './api';

// Axios do Portal do Colaborador: token PRÓPRIO (localStorage.portal_token), separado do
// token do painel — um colaborador logado nunca carrega credencial de admin e vice-versa.
export const PORTAL_TOKEN_KEY = 'portal_token';
export const PORTAL_USER_KEY = 'portal_user';

export const portalApi = axios.create({ headers: { 'Content-Type': 'application/json' } });

portalApi.interceptors.request.use((config) => {
  const baseURL = getApiBaseUrl();
  if (!config.url.startsWith('http')) {
    if (baseURL.endsWith('/api') && config.url.startsWith('/api')) config.url = config.url.substring(4);
    config.baseURL = baseURL;
  }
  try {
    const token = localStorage.getItem(PORTAL_TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch { /* storage bloqueado */ }
  return config;
});

portalApi.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401 && !String(error.config?.url || '').includes('/portal/login')) {
      portalLogout();
      if (window.location.pathname.startsWith('/portal') && !window.location.pathname.startsWith('/portal/primeiro-acesso')) {
        window.location.href = '/portal';
      }
    }
    return Promise.reject(error);
  }
);

export function portalLogout() {
  try { localStorage.removeItem(PORTAL_TOKEN_KEY); localStorage.removeItem(PORTAL_USER_KEY); } catch { /* ignore */ }
}

export function portalUser() {
  try { return JSON.parse(localStorage.getItem(PORTAL_USER_KEY) || 'null'); } catch { return null; }
}

export function portalLogado() {
  try { return !!localStorage.getItem(PORTAL_TOKEN_KEY); } catch { return false; }
}

export const formatCpf = (v) => {
  const d = String(v || '').replace(/\D/g, '').slice(0, 11);
  return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
};
