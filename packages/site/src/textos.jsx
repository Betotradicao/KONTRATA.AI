import { createContext, useContext, useState, useEffect } from 'react';
import { PADRAO } from './conteudoPadrao';

/**
 * Textos do site vindos do painel interno (/admin → Configurar Site → Textos).
 *
 * A regra, e ela vale pro site inteiro: o padrão é o que está em
 * `conteudoPadrao.js`. O banco só SOBRESCREVE o que estiver preenchido:
 *  - o site nunca fica em branco se a API cair ou a tabela estiver vazia;
 *  - apagar o campo no painel é o jeito de voltar ao original.
 *
 * Por isso o fetch falha em silêncio e o provider já renderiza os filhos na
 * primeira pintura — segurar a página esperando a config transformaria uma
 * lentidão da API numa tela branca.
 */

const Ctx = createContext({});

/** Só conta como sobrescrita o que tem conteúdo de verdade. */
const preenchido = (v) =>
  (typeof v === 'string' && v.trim() !== '') || (Array.isArray(v) && v.length > 0);

/**
 * Modo prévia: o site roda dentro do iframe do painel e recebe o rascunho a
 * cada tecla digitada, por postMessage. Nada disso é gravado — é só pra ver
 * como fica antes de salvar.
 *
 * Fica atrás de `?preview=1` pra o site de verdade não ficar escutando
 * mensagem de origem nenhuma.
 */
const MARCA_PREVIA = 'kontrata:previa';

function ehPrevia() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('preview') === '1';
}

export function TextosProvider({ children }) {
  const [dados, setDados] = useState({});

  useEffect(() => {
    if (ehPrevia()) return; // na prévia quem manda o conteúdo é o painel
    (async () => {
      try {
        const r = await fetch('/admin/api/publico/site');
        const d = await r.json();
        if (d && typeof d === 'object') setDados(d);
      } catch {
        /* sem config: fica tudo com o texto padrão */
      }
    })();
  }, []);

  // Prévia: aplica o rascunho que o painel manda e avisa que já está pronto
  // pra receber (o painel pode ter mandado antes do iframe carregar).
  useEffect(() => {
    if (!ehPrevia()) return;

    const aoReceber = (e) => {
      const msg = e.data;
      if (!msg || msg.tipo !== MARCA_PREVIA) return;
      setDados(msg.dados || {});
      if (msg.irPara) rolarAte(msg.irPara);
    };

    window.addEventListener('message', aoReceber);
    window.parent?.postMessage({ tipo: MARCA_PREVIA, pronto: true }, '*');
    return () => window.removeEventListener('message', aoReceber);
  }, []);

  return <Ctx.Provider value={dados}>{children}</Ctx.Provider>;
}

/** Rola a prévia até a seção que a pessoa está editando. */
function rolarAte(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  else window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Devolve os leitores de uma seção.
 *
 *   const { t, lista } = useTextos('hero');
 *   <h1>{t('titulo1')}</h1>
 *
 * O padrão vem de `conteudoPadrao.js` — não precisa repetir na chamada.
 */
export function useTextos(secao) {
  const dados = useContext(Ctx);
  const bloco = dados?.[secao] || {};
  const padrao = PADRAO[secao] || {};

  const t = (chave) =>
    preenchido(bloco[chave]) ? String(bloco[chave]).trim() : padrao[chave] ?? '';

  // Campo de várias linhas → array. Uma linha por item, linhas vazias fora.
  const lista = (chave) => {
    const v = bloco[chave];
    if (Array.isArray(v)) return v;
    if (preenchido(v)) {
      const itens = v.split('\n').map((l) => l.trim()).filter(Boolean);
      if (itens.length) return itens;
    }
    return padrao[chave] || [];
  };

  /** Verdadeiro quando o texto continua sendo o do código, sem edição. */
  const ehPadrao = (chave) => t(chave) === padrao[chave];

  return { t, lista, ehPadrao };
}
