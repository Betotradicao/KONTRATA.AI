import { createContext, useContext, useState, useEffect } from 'react';

/**
 * Textos do site vindos do painel interno (/admin → Configurar Site → Textos).
 *
 * A regra, e ela vale pro site inteiro: o texto do código é o padrão.
 * O banco só SOBRESCREVE o que estiver preenchido. Isso significa que:
 *  - o site nunca fica em branco se a API cair ou a tabela estiver vazia;
 *  - quem edita não é obrigado a preencher tudo pra mexer numa frase só;
 *  - apagar o campo no painel é o jeito de "voltar ao original".
 *
 * Por isso o fetch falha em silêncio e o provider já renderiza os filhos na
 * primeira pintura — segurar a página esperando a config transformaria uma
 * lentidão da API numa tela branca.
 */

const Ctx = createContext({});

export function TextosProvider({ children }) {
  const [dados, setDados] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/admin/api/publico/site');
        const d = await r.json();
        if (d && typeof d === 'object') setDados(d);
      } catch {
        /* sem config: fica tudo com o texto do código */
      }
    })();
  }, []);

  return <Ctx.Provider value={dados}>{children}</Ctx.Provider>;
}

/** Só conta como sobrescrita o que tem conteúdo de verdade. */
const preenchido = (v) => typeof v === 'string' && v.trim() !== '';

/**
 * Devolve os leitores de uma seção.
 *
 *   const { t, lista } = useTextos('hero');
 *   <h1>{t('titulo1', 'Acabe com o caos')}</h1>
 */
export function useTextos(secao) {
  const dados = useContext(Ctx);
  const bloco = dados?.[secao] || {};

  const t = (chave, padrao = '') => (preenchido(bloco[chave]) ? bloco[chave].trim() : padrao);

  // Campo de várias linhas → array. Uma linha por item, linhas vazias fora.
  const lista = (chave, padrao = []) => {
    if (!preenchido(bloco[chave])) return padrao;
    const itens = bloco[chave].split('\n').map((l) => l.trim()).filter(Boolean);
    return itens.length ? itens : padrao;
  };

  return { t, lista };
}
