/**
 * Cliente HTTP do painel interno.
 * O nginx encaminha /admin/api -> container kontrata-admin-api.
 */
const BASE = '/admin/api';
const CHAVE_TOKEN = 'kontrata_admin_token';

export const pegarToken = () => localStorage.getItem(CHAVE_TOKEN);
export const guardarToken = (t) => localStorage.setItem(CHAVE_TOKEN, t);
export const limparToken = () => localStorage.removeItem(CHAVE_TOKEN);

async function requisitar(caminho, opcoes = {}) {
  const token = pegarToken();
  const r = await fetch(BASE + caminho, {
    ...opcoes,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opcoes.headers || {}),
    },
  });

  // Token vencido/inválido: derruba a sessão em vez de deixar a tela num
  // limbo mostrando "erro" em cada botão.
  if (r.status === 401) {
    limparToken();
    if (!caminho.startsWith('/login')) window.location.reload();
    throw new Error('Sessão expirada');
  }

  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(corpo.erro || 'Erro na requisição');
  return corpo;
}

export const api = {
  get: (c) => requisitar(c),
  post: (c, dados) => requisitar(c, { method: 'POST', body: JSON.stringify(dados) }),
  put: (c, dados) => requisitar(c, { method: 'PUT', body: JSON.stringify(dados) }),
  del: (c) => requisitar(c, { method: 'DELETE' }),
};
