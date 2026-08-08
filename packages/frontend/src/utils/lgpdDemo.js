import { useEffect, useState } from 'react';

/**
 * MODO DEMONSTRACAO LGPD (so master)
 * ----------------------------------
 * Liga/desliga o mascaramento de dado pessoal pra gravar video de divulgacao.
 *
 * O estado mora aqui e vira o header `x-lgpd-demo: 1` em toda requisicao
 * (ver utils/api.js). Quem mascara de verdade e o BACKEND — este modulo so
 * pede. Assim o dado real nem chega no navegador.
 *
 * Escopo: a sessao deste navegador. A Mari e o RH do cliente continuam
 * enxergando os dados reais.
 */

const CHAVE = 'lgpd_demo';
const ouvintes = new Set();

export function isLgpdDemoOn() {
  try {
    return localStorage.getItem(CHAVE) === '1';
  } catch {
    return false;
  }
}

export function setLgpdDemo(ligado) {
  try {
    if (ligado) localStorage.setItem(CHAVE, '1');
    else localStorage.removeItem(CHAVE);
  } catch {
    /* localStorage bloqueado: segue sem persistir */
  }
  ouvintes.forEach((fn) => fn(ligado));
}

export function subscribeLgpdDemo(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

/**
 * Liga/desliga E recarrega a pagina.
 *
 * Por que recarregar: o header so entra nas requisicoes NOVAS. As telas ja
 * abertas guardam em estado o que buscaram antes do clique — sem reload, o
 * usuario aperta o botao e continua vendo dado cru ate trocar de tela (e pior:
 * acha que o modo nao funciona). O reload garante que TODA tela volte do
 * servidor ja mascarada.
 */
export function toggleLgpdDemoComReload(ligado) {
  setLgpdDemo(ligado);
  window.location.reload();
}

/** Hook pra componente reagir ao liga/desliga. */
export function useLgpdDemo() {
  const [ligado, setLigado] = useState(isLgpdDemoOn);
  useEffect(() => subscribeLgpdDemo(setLigado), []);
  return [ligado, setLgpdDemo];
}

/** Master e quem pode ver o botao. */
export function podeUsarLgpdDemo(user) {
  if (!user) return false;
  return user.isMaster === true || user.role === 'master' || user.role === 'MASTER';
}
