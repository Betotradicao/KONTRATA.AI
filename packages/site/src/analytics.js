/**
 * Google Analytics 4.
 *
 * O ID de medição (G-XXXXXXXXXX) vem do PAINEL INTERNO
 * (kontrataai.com.br/admin → Integrações), buscado quando a página abre.
 *
 * POR QUE NÃO NO BUILD: antes o ID vinha de VITE_GA_ID, o que amarrava trocar
 * a medição a republicar o site inteiro. Vindo do painel, muda na hora.
 *
 * Sem ID configurado, nada é carregado — rodar local não suja as métricas.
 */
let idMedicao = null;

async function buscarId() {
  // Se o painel estiver fora do ar, o site continua funcionando sem medição.
  try {
    const r = await fetch('/admin/api/publico/config-site');
    const d = await r.json();
    return d?.googleAnalyticsId || null;
  } catch {
    return null;
  }
}

export async function iniciarAnalytics() {
  idMedicao = await buscarId();
  if (!idMedicao) return;

  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${idMedicao}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', idMedicao);
}

/**
 * Registra um evento. Usado nos botões que importam (agendar demo, ver planos,
 * assinar) pra saber o que converte — não só quantos acessos entraram.
 */
export function evento(nome, params = {}) {
  if (!idMedicao || typeof window.gtag !== 'function') return;
  window.gtag('event', nome, params);
}

/** Troca de página numa SPA não dispara pageview sozinho — precisa avisar. */
export function pageview(caminho) {
  if (!idMedicao || typeof window.gtag !== 'function') return;
  window.gtag('event', 'page_view', {
    page_path: caminho,
    page_location: window.location.href,
    page_title: document.title,
  });
}
