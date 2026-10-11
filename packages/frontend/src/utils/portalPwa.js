import { useEffect, useState } from 'react';

// "Instalar app" do Portal do Colaborador (PWA).
// - Android/Chrome: o navegador dispara `beforeinstallprompt`; guardamos o evento e o botão chama prompt().
// - iPhone/Safari: não existe prompt programático — mostramos o passo a passo (Compartilhar → Adicionar à Tela de Início).
// - Já instalado (display-mode standalone): esconde o botão.
// O evento pode disparar antes do React montar, então capturamos no carregamento do módulo.

let deferredPrompt = null;
const listeners = new Set();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    listeners.forEach(fn => fn());
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    listeners.forEach(fn => fn());
  });
  if ('serviceWorker' in navigator && window.location.pathname.startsWith('/portal')) {
    navigator.serviceWorker.register('/portal-sw.js', { scope: '/portal' }).catch(() => { /* sem SW = sem botão no Android */ });
  }
}

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function usePortalInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force(n => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);

  const instalado = isStandalone();
  const ios = isIOS();
  const podeInstalar = !instalado && (!!deferredPrompt || ios);

  const instalar = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch { /* ignore */ }
      deferredPrompt = null;
      listeners.forEach(f => f());
      return 'prompt';
    }
    return ios ? 'ios' : 'indisponivel';
  };

  return { podeInstalar, instalado, ios, instalar };
}
