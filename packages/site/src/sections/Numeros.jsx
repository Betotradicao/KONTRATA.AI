import { useState, useEffect, useRef } from 'react';
import { useTextos } from '../textos';

/**
 * Prova social, em duas metades: os números à esquerda, os logos dos clientes
 * à direita.
 *
 * Os números vêm do painel interno, que copia de tempos em tempos o que cada
 * cliente tem no Banco de Currículos. Não é ao vivo ao segundo — e não precisa
 * ser: o que convence é a ordem de grandeza, não o dígito da unidade.
 *
 * Cada metade some sozinha se não tiver o que mostrar, e a seção inteira some
 * se as duas estiverem vazias. Prova social com zero é pior que prova social
 * nenhuma.
 */

const formatar = (n) => (Number(n) || 0).toLocaleString('pt-BR');

/** As duas metades usam o mesmo título pra faixa não ficar torta. */
const TITULO =
  'font-display font-bold text-white text-center text-xl sm:text-2xl lg:text-3xl mb-8';

/**
 * Número que "roda" de zero até o valor final quando entra na tela.
 *
 * Dispara pelo IntersectionObserver, e não ao carregar a página: animar um
 * número que ninguém está vendo desperdiça o efeito — quando o visitante
 * chega ali, já teria parado.
 *
 * Roda UMA vez (`observer.disconnect()`). Repetir a cada rolagem viraria
 * enfeite piscando e tiraria a credibilidade do dado.
 */
function NumeroQueRoda({ valor, duracaoMs = 1600 }) {
  const [atual, setAtual] = useState(0);
  const ref = useRef(null);
  const jaRodou = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Sem IntersectionObserver (navegador antigo): mostra o número final.
    if (typeof IntersectionObserver === 'undefined') {
      setAtual(valor);
      return;
    }

    const observer = new IntersectionObserver(
      (entradas) => {
        if (!entradas[0].isIntersecting || jaRodou.current) return;
        jaRodou.current = true;
        observer.disconnect();

        const inicio = performance.now();
        const passo = (agora) => {
          const p = Math.min((agora - inicio) / duracaoMs, 1);
          // Desacelera no fim: dá a sensação de "travar" no número certo,
          // em vez de parar seco no meio da contagem.
          const suave = 1 - Math.pow(1 - p, 3);
          setAtual(Math.round(valor * suave));
          if (p < 1) requestAnimationFrame(passo);
        };
        requestAnimationFrame(passo);
      },
      // 40% visível: garante que a seção está de fato na frente do visitante.
      { threshold: 0.4 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [valor, duracaoMs]);

  return (
    <span ref={ref} className="tabular-nums">
      {formatar(atual)}
    </span>
  );
}

/**
 * Avisa quando o elemento entra na tela. Uma vez só — o efeito é de chegada,
 * repetir a cada rolagem viraria enfeite piscando.
 */
/**
 * ⚠️ Devolve uma REF DE CALLBACK, não um useRef.
 *
 * A faixa de logos só existe depois que a lista chega da API. Com `useRef`, o
 * efeito rodava uma vez na montagem, achava `ref.current === null` e desistia
 * — e como a identidade do objeto ref nunca muda, nunca rodava de novo. Os
 * logos ficavam em `opacity-0` pra sempre: presentes no HTML, invisíveis na
 * tela. Foi exatamente o que aconteceu em 25/08/2026.
 *
 * Como ref de callback, o React chama a função quando o elemento nasce, e o
 * efeito reage a isso.
 */
function useEntrouNaTela(margem = 0.25) {
  const [elemento, setElemento] = useState(null);
  const [entrou, setEntrou] = useState(false);

  useEffect(() => {
    if (!elemento) return;
    if (typeof IntersectionObserver === 'undefined') {
      setEntrou(true); // navegador antigo: mostra tudo, sem animação
      return;
    }
    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setEntrou(true);
        obs.disconnect();
      },
      { threshold: margem }
    );
    obs.observe(elemento);
    return () => obs.disconnect();
  }, [elemento, margem]);

  return [setElemento, entrou];
}

/**
 * Um logo. Se a imagem não carregar, some — melhor que um ícone quebrado.
 *
 * Nasce invisível e surge quando a faixa entra na tela, com um atraso por
 * posição pra virem em cascata em vez de piscarem todos juntos.
 */
function Logo({ cliente, aparecer, ordem }) {
  const [falhou, setFalhou] = useState(false);
  if (falhou) return null;

  return (
    <div
      className={`transition-all duration-700 ease-out ${
        aparecer ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
      style={{ transitionDelay: `${ordem * 120}ms` }}
    >
      {/* Caixa branca de tamanho fixo: os logos vêm em proporções diferentes
          (uns quadrados, outros deitados) e sem isso a fileira fica desalinhada. */}
      <div className="flex items-center justify-center h-16 w-28 sm:h-20 sm:w-32 rounded-xl bg-white/95 px-3 py-2">
        <img
          src={`/admin/api/publico/clientes/${cliente.id}/logo`}
          alt={cliente.nome}
          loading="lazy"
          onError={() => setFalhou(true)}
          className="max-h-full max-w-full object-contain"
        />
      </div>
      <p className="text-center text-white/80 text-xs mt-2 w-28 sm:w-32 truncate">
        {cliente.nome}
      </p>
    </div>
  );
}

export default function Numeros() {
  const { t } = useTextos('numeros');
  const [dados, setDados] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [faixaLogos, logosNaTela] = useEntrouNaTela();

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/admin/api/publico/numeros');
        const d = await r.json();
        if (d && (d.curriculos > 0 || d.contratados > 0)) setDados(d);
      } catch {
        /* sem números, essa metade não aparece */
      }
    })();

    (async () => {
      try {
        const r = await fetch('/admin/api/publico/clientes');
        const lista = await r.json();
        if (Array.isArray(lista)) setClientes(lista);
      } catch {
        /* sem clientes marcados, essa metade não aparece */
      }
    })();
  }, []);

  if (!dados && !clientes.length) return null;

  return (
    <section id="numeros" className="py-14 lg:py-20 bg-hero-bg">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-8">
        {/* Divisória só existe com as duas metades na tela: no celular vira
            linha horizontal entre elas, no desktop, vertical no meio. */}
        <div
          className={`grid gap-10 ${
            dados && clientes.length
              ? 'lg:grid-cols-2 lg:gap-14 lg:divide-x divide-white/15'
              : 'grid-cols-1'
          }`}
        >
          {dados && (
            <div>
              <h2 className={TITULO}>{t('titulo_numeros')}</h2>
              <div className="grid grid-cols-2 gap-6 text-center">
                <div>
                  <p className="font-display font-bold text-amber-400 text-4xl sm:text-5xl">
                    <NumeroQueRoda valor={dados.curriculos} />
                  </p>
                  <p className="text-white/90 text-sm sm:text-base mt-2">{t('rotulo1')}</p>
                </div>
                <div>
                  <p className="font-display font-bold text-amber-400 text-4xl sm:text-5xl">
                    <NumeroQueRoda valor={dados.contratados} />
                  </p>
                  <p className="text-white/90 text-sm sm:text-base mt-2">{t('rotulo2')}</p>
                </div>
              </div>
            </div>
          )}

          {clientes.length > 0 && (
            <div className="lg:pl-14">
              <h2 className={TITULO}>{t('titulo_clientes')}</h2>
              {/* Grade de 3 colunas, não flex-wrap: assim as fileiras ficam
                  alinhadas entre si e a ordem do painel é respeitada — com
                  wrap, a quebra dependia da largura de cada logo. */}
              <div
                ref={faixaLogos}
                className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-5 justify-items-center"
              >
                {clientes.map((c, i) => (
                  <Logo key={c.id} cliente={c} aparecer={logosNaTela} ordem={i} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
