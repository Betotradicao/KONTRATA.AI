/**
 * Google Analytics 4.
 *
 * O ID vem da variavel de ambiente VITE_GA_ID (ex: G-XXXXXXXXXX), definida no
 * build. Sem ID, nada e carregado — assim rodar local nao suja as metricas de
 * producao com acesso de desenvolvimento.
 *
 * Onde por o ID: packages/site/.env.production  ->  VITE_GA_ID=G-XXXXXXXXXX
 */
const GA_ID = import.meta.env.VITE_GA_ID;

export function iniciarAnalytics() {
  if (!GA_ID) return; // sem ID configurado: nao mede nada

  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA_ID);
}

/**
 * Registra um evento. Usado nos botoes que importam (agendar demo, ver planos,
 * assinar) pra saber o que converte — nao so quantos acessos entraram.
 */
export function evento(nome, params = {}) {
  if (!GA_ID || typeof window.gtag !== 'function') return;
  window.gtag('event', nome, params);
}

/** Troca de pagina numa SPA nao dispara pageview sozinho — precisa avisar. */
export function pageview(caminho) {
  if (!GA_ID || typeof window.gtag !== 'function') return;
  window.gtag('event', 'page_view', {
    page_path: caminho,
    page_location: window.location.href,
    page_title: document.title,
  });
}
